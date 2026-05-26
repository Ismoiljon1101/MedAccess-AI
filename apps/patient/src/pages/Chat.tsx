import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Send, Phone, Plus, Headphones, BookText, Image as ImageIcon } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AiAvatar, type AvatarState } from '@/components/AiAvatar';
import { streamChatRequest, transcribeAudio, loadSession, analyzeReport } from '@/lib/api';
import { useAppStore } from '@/store/app';

interface RagCitation {
  id: string;
  title: string;
  score: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  citations?: RagCitation[];
}

const GREETING: Message = {
  id: 'greeting',
  role: 'assistant',
  content:
    "Hi, I'm MA Agent — your MedAccess health assistant. Tell me what's bothering you today and I'll help you understand what might be going on. Type your symptoms or tap the mic to speak.",
};

export default function Chat() {
  const { language, upsertSession } = useAppStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const resumeId = searchParams.get('s') ?? undefined;

  const [messages, setMessages]       = useState<Message[]>([GREETING]);
  const [input, setInput]             = useState('');
  const [sessionId, setSessionId]     = useState<string | undefined>(resumeId);
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [recording, setRecording]     = useState(false);
  const [loadError, setLoadError]     = useState<string | null>(null);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRef    = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const abortRef    = useRef<AbortController | null>(null);
  const speechRef   = useRef<SpeechRecognition | null>(null);
  // Track first user message for history preview
  const previewRef  = useRef<string>('');
  const msgCountRef = useRef<number>(0);

  // ── Load resumed session ──────────────────────────────────────────────
  useEffect(() => {
    if (!resumeId) return;
    loadSession(resumeId)
      .then((msgs) => {
        if (!msgs.length) return;
        setMessages(
          msgs.map((m) => ({ id: crypto.randomUUID(), role: m.role, content: m.content })),
        );
        msgCountRef.current = msgs.length;
        const firstUser = msgs.find((m) => m.role === 'user');
        if (firstUser) previewRef.current = firstUser.content.slice(0, 80);
      })
      .catch(() => setLoadError('Session not found or expired. Starting a new chat.'));
  }, [resumeId]);

  // ── Auto-scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Auto-resize textarea ─────────────────────────────────────────────
  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  // ── Persist session metadata to store ────────────────────────────────
  function persistSession(sid: string, extraCount = 0) {
    msgCountRef.current += extraCount;
    upsertSession({
      sessionId:    sid,
      preview:      previewRef.current || 'New chat',
      messageCount: msgCountRef.current,
      language,
      createdAt:    Date.now(),
    });
  }

  // ── Send / stream message ─────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Save first user message as preview
      if (!previewRef.current) previewRef.current = trimmed.slice(0, 80);

      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      const userId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: userId, role: 'user', content: trimmed }]);
      setAvatarState('thinking');

      const aiId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: aiId, role: 'assistant', content: '', streaming: true },
      ]);

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        let assembled = '';
        let resolvedSid = sessionId;

        let resolvedCitations: RagCitation[] = [];

        for await (const event of streamChatRequest(trimmed, sessionId, language, ctrl.signal)) {
          if (ctrl.signal.aborted) break;
          if (event.type === 'meta') {
            if (event.data.sessionId) {
              resolvedSid = event.data.sessionId;
              setSessionId(resolvedSid);
            }
            if (event.data.citations?.length) {
              resolvedCitations = event.data.citations;
            }
          } else if (event.type === 'token') {
            assembled += event.data.delta ?? '';
            setMessages((prev) =>
              prev.map((m) => (m.id === aiId ? { ...m, content: assembled } : m)),
            );
          } else if (event.type === 'done' || event.type === 'error') {
            break;
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? { ...m, streaming: false, citations: resolvedCitations.length ? resolvedCitations : undefined }
              : m,
          ),
        );

        // Persist to local history
        if (resolvedSid) persistSession(resolvedSid, 2); // +user +assistant
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId
                ? { ...m, content: "Sorry, I couldn't reach the server. Please try again.", streaming: false }
                : m,
            ),
          );
        }
      } finally {
        setAvatarState('idle');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, language],
  );

  // ── Voice recording (Web Speech API primary, MediaRecorder fallback) ─────
  async function toggleVoice() {
    if (recording) {
      speechRef.current?.stop();
      mediaRef.current?.stop();
      return;
    }

    // Try Web Speech API first (no server key needed)
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const sr: SpeechRecognition = new SR();
      sr.lang = language || 'en-US';
      sr.interimResults = false;
      sr.maxAlternatives = 1;
      speechRef.current = sr;
      setRecording(true);
      setAvatarState('listening');
      sr.onresult = (e: SpeechRecognitionEvent) => {
        const text = e.results[0]?.[0]?.transcript?.trim();
        if (text) sendMessage(text);
        else setAvatarState('idle');
        setRecording(false);
      };
      sr.onerror = () => { setRecording(false); setAvatarState('idle'); };
      sr.onend   = () => { setRecording(false); };
      sr.start();
      return;
    }

    // Fallback: MediaRecorder → backend Whisper
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        try {
          const text = await transcribeAudio(blob, language);
          if (text) await sendMessage(text);
          else setAvatarState('idle');
        } catch { setAvatarState('idle'); }
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setAvatarState('listening');
    } catch { /* mic denied */ }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const userId = crypto.randomUUID();
    const imageName = file.name || 'image.jpg';
    const imageUrl = URL.createObjectURL(file);
    setMessages((prev) => [...prev, {
      id: userId,
      role: 'user',
      content: `[Uploaded: ${imageName}]`,
    }]);

    const aiId = crypto.randomUUID();
    setMessages((prev) => [...prev, {
      id: aiId,
      role: 'assistant',
      content: '',
      streaming: true,
    }]);

    try {
      const result = await analyzeReport(file, language, sessionId);
      const analysisText = `
**Medical Image Analysis:**
- Type: ${result.imageType}
- Quality: ${result.qualityNotes}

**Key Observations:**
${result.keyObservations.map((o) => `- ${o}`).join('\n')}

**Findings:**
${result.findings.map((f) => `- ${f.finding} (${f.confidence}): ${f.notes}`).join('\n')}

**Suggested Follow-Up:**
${result.suggestedFollowUp.map((s) => `- ${s}`).join('\n')}

_${result.disclaimer}_
      `.trim();

      setMessages((prev) =>
        prev.map((m) => (m.id === aiId ? { ...m, content: analysisText, streaming: false } : m)),
      );

      if (sessionId) persistSession(sessionId, 1);
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) => (m.id === aiId ? { ...m, content: `Error analyzing image: ${err.message}`, streaming: false } : m)),
      );
    } finally {
      if (imageInputRef.current) imageInputRef.current.value = '';
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function startNewChat() {
    abortRef.current?.abort();
    previewRef.current = '';
    msgCountRef.current = 0;
    setMessages([GREETING]);
    setInput('');
    setSessionId(undefined);
    setLoadError(null);
    setAvatarState('idle');
    navigate('/');
  }

  const isThinking = avatarState === 'thinking';

  const lastAiIdx = messages.reduce<number>(
    (acc, msg, i) => (msg.role === 'assistant' ? i : acc),
    -1,
  );

  return (
    <div className="chat-layout">
      {/* ── Top bar: New chat button (only when session active) ───── */}
      {(sessionId || resumeId) && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-surface-700 shrink-0">
          <span className="text-xs text-slate-500 truncate">
            {previewRef.current || 'Active session'}
          </span>
          <button
            type="button"
            onClick={startNewChat}
            className="flex items-center gap-1 rounded-lg border border-surface-600 bg-surface-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-brand-500/50 transition"
          >
            <Plus size={13} /> New chat
          </button>
        </div>
      )}

      {/* ── Session load error ───────────────────────────────────── */}
      {loadError && (
        <div className="mx-3 mt-3 rounded-xl border border-warn-500/30 bg-warn-500/10 px-3 py-2 text-xs text-warn-400 shrink-0">
          {loadError}
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────────────── */}
      <div className="chat-messages">
        {messages.map((msg, idx) => {
          const isLastAi = msg.role === 'assistant' && idx === lastAiIdx;
          const thisState: AvatarState = isLastAi
            ? msg.streaming ? 'thinking' : avatarState
            : 'idle';

          return (
            <div key={msg.id} className="flex flex-col">
              <div className={`chat-row ${msg.role === 'user' ? 'chat-row-user' : 'chat-row-ai'}`}>
                {msg.role === 'assistant' && (
                  <div className="chat-avatar-wrap">
                    <AiAvatar state={thisState} size={56} />
                  </div>
                )}
                <div className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
                  {msg.content || (msg.streaming && (
                    <span className="chat-typing" aria-label="Thinking…">
                      <span /><span /><span />
                    </span>
                  ))}
                </div>
              </div>
              {msg.role === 'assistant' && !msg.streaming && msg.citations?.length ? (
                <div className="ml-[68px] mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                    <BookText size={10} /> sources
                  </span>
                  {msg.citations.map((c) => (
                    <span
                      key={c.id}
                      title={`Relevance: ${c.score}`}
                      className="inline-flex items-center rounded-full border border-brand-500/25 bg-brand-500/10 px-2 py-0.5 text-[10px] font-medium text-brand-400"
                    >
                      {c.title}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* ── Emergency pill ───────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] shrink-0">
        <Phone size={11} className="text-danger-400 shrink-0" />
        <span className="text-slate-500">Life-threatening?</span>
        <a href="tel:112" className="font-semibold text-danger-400">112 / 911 / 999</a>
      </div>

      {/* ── Input bar ────────────────────────────────────────────── */}
      <div className="chat-input-bar">
        {/* Image upload */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
          aria-label="Upload medical image"
        />
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          aria-label="Upload image"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-surface-600 bg-surface-700 text-slate-400 transition hover:border-brand-500/50 hover:text-slate-200"
        >
          <ImageIcon size={20} />
        </button>

        <textarea
          ref={textareaRef}
          className="chat-input-field"
          rows={1}
          placeholder="Describe your symptoms…"
          value={input}
          onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
          onKeyDown={handleKeyDown}
          disabled={isThinking}
        />

        {/* Voice mode button */}
        <button
          type="button"
          onClick={() => navigate(`/voice${sessionId ? `?s=${sessionId}` : ''}`)}
          aria-label="Voice mode"
          title="Voice Mode"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-500/40 bg-brand-600/15 text-brand-400 transition hover:bg-brand-600/25 hover:border-brand-400"
        >
          <Headphones size={18} />
        </button>

        <button
          type="button"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isThinking}
          aria-label="Send"
          className="chat-send-btn"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

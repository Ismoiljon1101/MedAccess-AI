import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Phone, Plus, Headphones, BookText, Image as ImageIcon, MapPin, X, Mic, MicOff, Brain } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AiAvatar, type AvatarState } from '@/components/AiAvatar';
import ImageCaptureFlow from '@/components/ImageCaptureFlow';
import type { ImageModality } from '@/components/ImageCaptureFlow';
import { streamChatRequest, loadSession, analyzeReport } from '@/lib/api';
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
  imageUrl?: string;
  imageName?: string;
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
  const [loadError, setLoadError]     = useState<string | null>(null);

  const [ctaSpec, setCtaSpec] = useState<{ specialty: string; urgency: string } | null>(null);
  const [showCapture, setShowCapture] = useState(false);
  const [micActive, setMicActive]     = useState(false);  // inline voice input
  const [isReasoning, setIsReasoning] = useState(false);  // model is in <think> block

  const bottomRef    = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const abortRef     = useRef<AbortController | null>(null);
  const inlineSrRef  = useRef<SpeechRecognition | null>(null);
  // Track first user message for history preview
  const previewRef  = useRef<string>('');
  const msgCountRef = useRef<number>(0);
  // Count user turns (not counting greeting)
  const userTurnRef = useRef<number>(0);

  // ── Clinical Snapshot CTA detection ──────────────────────────────────
  function detectClinicalSnapshot(text: string, userTurns: number): { specialty: string; urgency: string } | null {
    if (userTurns < 3) return null;
    const t = text.toLowerCase();
    const clinicalKeywords = ['recommend', 'consult', 'specialist', 'clinic', 'doctor', 'appointment',
      'see a ', 'urgent', 'emergency', 'diagnosis', 'condition', 'treatment', 'follow up', 'seek care',
      'medical attention', 'possible cause', 'likely cause', 'suggest', 'refer'];
    const hasClinical = clinicalKeywords.some((k) => t.includes(k));
    if (!hasClinical) return null;

    // Urgency
    let urgency = 'see-clinician-soon';
    if (/emergency|immediately|call 9|call 1|life.threaten/i.test(t)) urgency = 'emergency';
    else if (/urgent|as soon as possible|asap|right away/i.test(t)) urgency = 'urgent';
    else if (/self.care|home remedy|rest at home|over.the.counter/i.test(t)) urgency = 'self-care';

    // Specialty
    let specialty = 'General Practice';
    if (/heart|cardiac|chest pain|palpitation|cardiovascular/i.test(t)) specialty = 'Cardiology';
    else if (/headache|migraine|neurolog|seizure|stroke|nerve/i.test(t)) specialty = 'Neurology';
    else if (/breath|respiratory|lung|asthma|pulmon|cough/i.test(t)) specialty = 'Respiratory';
    else if (/mental|anxiety|depress|psychiatr|psycholog/i.test(t)) specialty = 'Mental Health';
    else if (/child|pediatr|infant|baby/i.test(t)) specialty = 'Pediatrics';
    else if (/urgent care|minor injur|wound/i.test(t)) specialty = 'Urgent Care';
    else if (/emergency|trauma/i.test(t)) specialty = 'Emergency';

    return { specialty, urgency };
  }

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

  // ── Revoke object URLs on unmount (memory cleanup) ────────────────────
  useEffect(() => {
    return () => {
      messages.forEach((m) => {
        if (m.imageUrl) URL.revokeObjectURL(m.imageUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      userTurnRef.current += 1;

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
          } else if (event.type === 'thinking_start') {
            setIsReasoning(true);
          } else if (event.type === 'thinking_end') {
            setIsReasoning(false);
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

        // Check for clinical snapshot → show Connect to Care CTA
        const snap = detectClinicalSnapshot(assembled, userTurnRef.current);
        if (snap) setCtaSpec(snap);

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
        setIsReasoning(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, language],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  // ── Inline voice: tap mic → speak → pause → auto-send ────────────────
  function toggleInlineMic() {
    if (micActive) {
      inlineSrRef.current?.abort();
      setMicActive(false);
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      // No Web Speech API — open full VoiceMode instead
      navigate(`/voice${sessionId ? `?s=${sessionId}` : ''}`);
      return;
    }

    const sr: SpeechRecognition = new SR();
    sr.lang           = language === 'auto' || !language ? 'en-US' : language;
    sr.continuous     = false;    // stop after user pauses (browser VAD)
    sr.interimResults = true;     // show transcript live
    sr.maxAlternatives = 1;
    inlineSrRef.current = sr;
    setMicActive(true);

    let interim = '';

    sr.onresult = (e: SpeechRecognitionEvent) => {
      let final = '';
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      // Show interim in textarea as user speaks
      setInput(final || interim);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
      }
    };

    sr.onend = () => {
      setMicActive(false);
      inlineSrRef.current = null;
      // Auto-send whatever was captured
      setInput((current) => {
        const text = current.trim();
        if (text) sendMessage(text);
        return '';
      });
    };

    (sr as any).onerror = (e: any) => {
      if (e.error !== 'aborted') setMicActive(false);
    };

    sr.start();
  }

  async function handleCaptureConfirm(file: File, _modality: ImageModality) {
    setShowCapture(false);

    const userId   = crypto.randomUUID();
    const imageName = file.name || 'image.jpg';
    const imageUrl  = URL.createObjectURL(file);
    setMessages((prev) => [...prev, { id: userId, role: 'user', content: '', imageUrl, imageName }]);

    const aiId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: aiId, role: 'assistant', content: '', streaming: true }]);

    try {
      const result = await analyzeReport(file, language, sessionId);
      const analysisText = [
        '**Medical Image Analysis:**',
        `- Type: ${result.imageType}`,
        `- Quality: ${result.qualityNotes}`,
        '',
        '**Key Observations:**',
        ...result.keyObservations.map((o) => `- ${o}`),
        '',
        '**Findings:**',
        ...result.findings.map((f) => `- ${f.finding} (${f.confidence})${f.notes ? ': ' + f.notes : ''}`),
        '',
        '**Suggested Follow-Up:**',
        ...result.suggestedFollowUp.map((s) => `- ${s}`),
        '',
        `_${result.disclaimer}_`,
      ].join('\n');

      setMessages((prev) =>
        prev.map((m) => (m.id === aiId ? { ...m, content: analysisText, streaming: false } : m)),
      );
      if (sessionId) persistSession(sessionId, 1);
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiId ? { ...m, content: `Error analyzing image: ${err.message}`, streaming: false } : m,
        ),
      );
    } finally {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function startNewChat() {
    abortRef.current?.abort();
    previewRef.current = '';
    msgCountRef.current = 0;
    userTurnRef.current = 0;
    setMessages([GREETING]);
    setInput('');
    setSessionId(undefined);
    setLoadError(null);
    setAvatarState('idle');
    setIsReasoning(false);
    setCtaSpec(null);
    navigate('/');
  }

  const isThinking = avatarState === 'thinking';

  const lastAiIdx = messages.reduce<number>(
    (acc, msg, i) => (msg.role === 'assistant' ? i : acc),
    -1,
  );

  return (
    <div className="chat-layout">
      {/* ── Image capture flow (modal) ─────────────────────────────── */}
      {showCapture && (
        <ImageCaptureFlow
          onConfirm={handleCaptureConfirm}
          onCancel={() => setShowCapture(false)}
        />
      )}
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
                  {msg.imageUrl && (
                    <div className="mb-1.5">
                      <img
                        src={msg.imageUrl}
                        alt={msg.imageName ?? 'Uploaded image'}
                        className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
                        loading="lazy"
                      />
                      {msg.imageName && (
                        <p className="mt-1 text-[10px] text-slate-400 truncate max-w-[200px]">
                          {msg.imageName}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Reasoning indicator: model is thinking / generating first token */}
                  {isLastAi && msg.streaming && !msg.content && (
                    <div className="flex items-center gap-2 text-xs text-brand-400">
                      <Brain size={13} className="shrink-0 animate-pulse" />
                      <span className="animate-pulse">{isReasoning ? 'Reasoning…' : 'Thinking…'}</span>
                      <span className="chat-typing scale-75 origin-left"><span /><span /><span /></span>
                    </div>
                  )}

                  {/* Message content — rendered as markdown */}
                  {msg.content ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p:      ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
                        ul:     ({ children }) => <ul className="mb-1.5 ml-3 space-y-0.5 list-disc">{children}</ul>,
                        ol:     ({ children }) => <ol className="mb-1.5 ml-3 space-y-0.5 list-decimal">{children}</ol>,
                        li:     ({ children }) => <li className="leading-relaxed">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                        em:     ({ children }) => <em className="italic text-slate-300">{children}</em>,
                        h3:     ({ children }) => <h3 className="font-semibold text-white mt-2 mb-1">{children}</h3>,
                        h4:     ({ children }) => <h4 className="font-medium text-slate-200 mt-1.5 mb-0.5">{children}</h4>,
                        code:   ({ children }) => <code className="rounded bg-surface-700 px-1 py-0.5 text-[11px] font-mono text-brand-300">{children}</code>,
                        hr:     () => <hr className="my-2 border-surface-600" />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : null}
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

      {/* ── Connect to Care CTA ──────────────────────────────────── */}
      {ctaSpec && !isThinking && (
        <div className="shrink-0 mx-3 mb-1 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2.5 flex items-center gap-2">
          <MapPin size={16} className="text-brand-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-brand-300">Ready to see a {ctaSpec.specialty} provider?</p>
            <p className="text-[11px] text-slate-400 truncate">Find clinics and book an appointment near you</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams();
              params.set('specialty', ctaSpec.specialty);
              params.set('urgency', ctaSpec.urgency);
              if (sessionId) params.set('s', sessionId);
              if (previewRef.current) params.set('summary', previewRef.current);
              navigate(`/find-care?${params.toString()}`);
            }}
            className="shrink-0 rounded-xl border border-brand-500/40 bg-brand-600/20 px-3 py-1.5 text-xs font-semibold text-brand-400 hover:bg-brand-600/30 transition whitespace-nowrap"
          >
            Find Care →
          </button>
          <button
            type="button"
            onClick={() => setCtaSpec(null)}
            aria-label="Dismiss recommendation"
            title="Dismiss"
            className="shrink-0 rounded-full p-1 text-slate-500 hover:text-slate-200 hover:bg-surface-700/60 transition"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Emergency pill ───────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] shrink-0">
        <Phone size={11} className="text-danger-400 shrink-0" />
        <span className="text-slate-500">Life-threatening?</span>
        <a href="tel:112" className="font-semibold text-danger-400">112 / 911 / 999</a>
      </div>

      {/* ── Input bar ────────────────────────────────────────────── */}
      <div className="chat-input-bar">
        {/* Image capture — opens quality-gated flow */}
        <button
          type="button"
          onClick={() => setShowCapture(true)}
          aria-label="Upload medical image"
          title="Upload image"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink-700 bg-ink-800 text-ink-400 transition hover:border-brand-500/50 hover:text-ink-200"
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

        {/* Inline mic: tap → speak → pause = auto-send */}
        <button
          type="button"
          onClick={toggleInlineMic}
          aria-label={micActive ? 'Stop recording' : 'Speak your message'}
          title={micActive ? 'Listening — pause to send' : 'Tap to speak'}
          className={`chat-mic-btn transition ${
            micActive
              ? 'border-brand-400 text-brand-400 animate-pulse'
              : ''
          }`}
        >
          {micActive ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Full immersive voice mode */}
        <button
          type="button"
          onClick={() => navigate(`/voice${sessionId ? `?s=${sessionId}` : ''}`)}
          aria-label="Full voice mode"
          title="Hands-free voice conversation"
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

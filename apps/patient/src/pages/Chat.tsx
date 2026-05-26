import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Send, Phone } from 'lucide-react';
import { AiAvatar, type AvatarState } from '@/components/AiAvatar';
import { streamChatRequest, transcribeAudio } from '@/lib/api';
import { useAppStore } from '@/store/app';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

const GREETING: Message = {
  id: 'greeting',
  role: 'assistant',
  content:
    "Hi, I'm your AI health assistant. Tell me what's bothering you today — describe your symptoms and I'll help you understand what might be going on. You can type or tap the mic to speak.",
};

export default function Chat() {
  const { language } = useAppStore();

  const [messages, setMessages]       = useState<Message[]>([GREETING]);
  const [input, setInput]             = useState('');
  const [sessionId, setSessionId]     = useState<string | undefined>();
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [recording, setRecording]     = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRef   = useRef<MediaRecorder | null>(null);
  const chunksRef  = useRef<Blob[]>([]);
  const abortRef   = useRef<AbortController | null>(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      // Append user bubble
      const userId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: userId, role: 'user', content: trimmed }]);
      setAvatarState('thinking');

      // Append empty AI bubble that will stream into
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

        for await (const event of streamChatRequest(
          trimmed,
          sessionId,
          language,
          ctrl.signal,
        )) {
          if (ctrl.signal.aborted) break;

          if (event.type === 'meta' && event.data.sessionId) {
            setSessionId(event.data.sessionId);
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
          prev.map((m) => (m.id === aiId ? { ...m, streaming: false } : m)),
        );
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId
                ? {
                    ...m,
                    content: "Sorry, I couldn't reach the server. Please check your connection and try again.",
                    streaming: false,
                  }
                : m,
            ),
          );
        }
      } finally {
        setAvatarState('idle');
      }
    },
    [sessionId, language],
  );

  async function toggleVoice() {
    if (recording) {
      mediaRef.current?.stop();
      return;
    }
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
          if (text) {
            await sendMessage(text);
          } else {
            setAvatarState('idle');
          }
        } catch {
          setAvatarState('idle');
        }
      };

      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setAvatarState('listening');
    } catch {
      // mic permission denied or not available
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const isThinking = avatarState === 'thinking';

  // Which AI message index gets the animated avatar
  const lastAiIdx = messages.reduce<number>(
    (acc, msg, i) => (msg.role === 'assistant' ? i : acc),
    -1,
  );

  return (
    <div className="chat-layout">
      {/* ── Messages ──────────────────────────────────────────── */}
      <div className="chat-messages">
        {messages.map((msg, idx) => {
          const isLastAi = msg.role === 'assistant' && idx === lastAiIdx;

          // Active avatar state on the last AI message
          const thisState: AvatarState = isLastAi
            ? msg.streaming
              ? 'thinking'
              : avatarState
            : 'idle';

          return (
            <div
              key={msg.id}
              className={`chat-row ${msg.role === 'user' ? 'chat-row-user' : 'chat-row-ai'}`}
            >
              {msg.role === 'assistant' && (
                <div className="chat-avatar-wrap">
                  <AiAvatar state={thisState} size={56} />
                </div>
              )}

              <div
                className={`chat-bubble ${
                  msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'
                }`}
              >
                {msg.content || (msg.streaming && (
                  <span className="chat-typing" aria-label="Thinking…">
                    <span /><span /><span />
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        {/* Scroll anchor */}
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* ── Emergency pill ────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1.5 py-1.5 text-[10px]">
        <Phone size={11} className="text-danger-400 shrink-0" />
        <span className="text-slate-500">Life-threatening?</span>
        <a href="tel:112" className="font-semibold text-danger-400">112 / 911 / 999</a>
      </div>

      {/* ── Input bar ─────────────────────────────────────────── */}
      <div className="chat-input-bar">
        <button
          type="button"
          onClick={toggleVoice}
          aria-label={recording ? 'Stop recording' : 'Voice input'}
          className={`chat-mic-btn ${
            recording
              ? 'border-danger-500/50 bg-danger-500/15 text-danger-400'
              : 'text-slate-400'
          }`}
        >
          {recording ? <MicOff size={20} /> : <Mic size={20} />}
          {recording && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-danger-500 border-2 border-surface-900" />
          )}
        </button>

        <textarea
          ref={textareaRef}
          className="chat-input-field"
          rows={1}
          placeholder={recording ? 'Listening…' : 'Describe your symptoms…'}
          value={input}
          onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
          onKeyDown={handleKeyDown}
          disabled={isThinking || recording}
        />

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

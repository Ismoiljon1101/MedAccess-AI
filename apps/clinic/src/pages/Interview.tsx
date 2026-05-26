import { ArrowUp, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import CitationList from '@/components/CitationList';
import MessageBubble from '@/components/MessageBubble';
import VoiceButton from '@/components/VoiceButton';
import { streamChat, type Citation } from '@/lib/api';
import { useAppStore } from '@/store/app';
import type { ChatMessage } from '@medaccess/shared';

export default function Interview() {
  const { language, model } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [citationsMap, setCitationsMap] = useState<Record<number, Citation[]>>({});
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function scrollBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    setError(null);

    const userMsg: ChatMessage = { role: 'user', content: text };
    const assistantPlaceholder: ChatMessage = { role: 'assistant', content: '' };
    const nextMessages = [...messages, userMsg, assistantPlaceholder];
    const assistantIdx = nextMessages.length - 1;
    setMessages(nextMessages);
    scrollBottom();

    let accum = '';
    setStreaming(true);

    await streamChat(
      { sessionId, message: text, language, model, useRag: true },
      {
        onMeta: ({ sessionId: sid, citations }) => {
          if (sid) setSessionId(sid);
          if (citations?.length) {
            setCitationsMap((prev) => ({ ...prev, [assistantIdx]: citations }));
          }
        },
        onToken: (delta) => {
          accum += delta;
          setMessages((prev) => {
            const updated = [...prev];
            updated[assistantIdx] = { role: 'assistant', content: accum };
            return updated;
          });
          scrollBottom();
        },
        onError: (err) => setError(err.message),
      }
    );

    setStreaming(false);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col gap-4">
      <div className="card card-pad shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white">Patient Interview</h1>
          <p className="mt-1 text-sm text-ink-300">
            Conversational diagnostic intake. The copilot asks one focused question at a time,
            grounded in the clinical knowledge base.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessages([]);
            setCitationsMap({});
            setSessionId(undefined);
            setError(null);
          }}
          className="btn text-xs shrink-0 self-start sm:self-center border-ink-700 hover:border-accent-500 hover:text-accent-400"
        >
          New session
        </button>
      </div>

      <div className="card flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-400">
            Start by describing the patient's chief complaint.
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i}>
              <MessageBubble message={msg} />
              {msg.role === 'assistant' && citationsMap[i] && (
                <div className="ml-11">
                  <CitationList citations={citationsMap[i]} />
                </div>
              )}
            </div>
          ))
        )}
        {error && (
          <div className="rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="card card-pad shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            className="input min-h-[60px] flex-1 resize-none"
            placeholder="Type a symptom or answer…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={streaming}
          />
          <VoiceButton
            language={language}
            onTranscript={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))}
            disabled={streaming}
          />
          <button
            type="button"
            onClick={send}
            disabled={!input.trim() || streaming}
            className="btn-primary h-10 w-10 rounded-full p-0"
          >
            {streaming ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

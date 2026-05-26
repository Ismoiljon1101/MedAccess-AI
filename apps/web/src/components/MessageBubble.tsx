import ReactMarkdown from 'react-markdown';
import { Bot, User } from 'lucide-react';
import type { ChatMessage } from '@medaccess/shared';

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30">
          <Bot size={16} />
        </div>
      )}
      <div
        className={[
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
          isUser
            ? 'bg-accent-500/15 text-white ring-1 ring-accent-500/30'
            : 'bg-ink-800/70 text-ink-100 ring-1 ring-ink-700/60',
        ].join(' ')}
      >
        <div className="prose-medic">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
      {isUser && (
        <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-ink-700/70 text-ink-200">
          <User size={16} />
        </div>
      )}
    </div>
  );
}

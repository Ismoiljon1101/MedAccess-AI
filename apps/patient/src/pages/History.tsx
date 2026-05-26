import { useNavigate } from 'react-router-dom';
import { MessageCircle, Trash2, Clock, ChevronRight, HistoryIcon } from 'lucide-react';
import { useAppStore } from '@/store/app';

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min  = Math.floor(diff / 60_000);
  const hr   = Math.floor(diff / 3_600_000);
  const day  = Math.floor(diff / 86_400_000);
  if (min < 1)  return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24)  return `${hr}h ago`;
  if (day < 7)  return `${day}d ago`;
  return new Date(ms).toLocaleDateString();
}

export default function History() {
  const { chatHistory, removeSession, clearHistory } = useAppStore();
  const navigate = useNavigate();

  function resume(sessionId: string) {
    navigate(`/?s=${sessionId}`);
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
    <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto">

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Chat history</h1>
        {chatHistory.length > 0 && (
          <button
            type="button"
            onClick={() => { if (confirm('Clear all chat history?')) clearHistory(); }}
            className="flex items-center gap-1.5 rounded-lg border border-danger-500/40 px-3 py-1.5 text-xs font-medium text-danger-400 hover:bg-danger-500/10 transition"
          >
            <Trash2 size={13} /> Clear all
          </button>
        )}
      </div>

      {chatHistory.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-700 ring-1 ring-surface-600">
            <HistoryIcon size={24} className="text-slate-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-300">No conversations yet</p>
            <p className="text-xs text-slate-500 mt-1">Your chats will appear here</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn-primary px-5"
          >
            Start a chat
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {chatHistory.map((session) => (
            <div
              key={session.sessionId}
              className="card flex items-center gap-3 px-4 py-3.5 hover:border-brand-500/40 transition cursor-pointer group"
              onClick={() => resume(session.sessionId)}
            >
              {/* Icon */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600/15 text-brand-400 ring-1 ring-brand-500/20">
                <MessageCircle size={16} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {session.preview || 'Chat session'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Clock size={11} className="text-slate-500 shrink-0" />
                  <span className="text-xs text-slate-500">{timeAgo(session.updatedAt)}</span>
                  <span className="text-xs text-slate-600">·</span>
                  <span className="text-xs text-slate-500">{session.messageCount} messages</span>
                  {session.language !== 'English' && (
                    <>
                      <span className="text-xs text-slate-600">·</span>
                      <span className="text-xs text-slate-500">{session.language}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label="Delete session"
                  onClick={(e) => { e.stopPropagation(); removeSession(session.sessionId); }}
                  className="rounded-lg p-2 text-slate-600 hover:text-danger-400 hover:bg-danger-500/10 transition opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
                <ChevronRight size={16} className="text-slate-600 group-hover:text-brand-400 transition" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  );
}

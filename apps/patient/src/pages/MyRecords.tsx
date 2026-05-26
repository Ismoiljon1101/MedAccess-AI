import { useAppStore } from '@/store/app';
import { useNavigate } from 'react-router-dom';
import { FileText, ImageIcon, Clock, ChevronRight, Trash2, AlertCircle } from 'lucide-react';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function MyRecords() {
  const { chatHistory, removeSession } = useAppStore();
  const navigate = useNavigate();

  const sorted = [...chatHistory].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-surface-700 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">My Records</h2>
          <p className="text-xs text-slate-500 mt-0.5">Past consultations &amp; analyses</p>
        </div>
        {sorted.length > 0 && (
          <span className="rounded-full bg-surface-700 px-2.5 py-0.5 text-xs text-slate-400">
            {sorted.length}
          </span>
        )}
      </div>

      {/* Report uploads note */}
      <div className="shrink-0 mx-3 mt-3 rounded-xl border border-brand-500/20 bg-brand-500/8 px-3 py-2 flex items-start gap-2">
        <AlertCircle size={13} className="text-brand-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400">
          Uploaded medical images and clinic reports will appear here once synced. Upload images via the chat <ImageIcon size={10} className="inline" />.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="rounded-2xl bg-surface-800 p-5">
            <FileText size={32} className="text-slate-600 mx-auto" />
          </div>
          <p className="text-sm font-medium text-slate-400">No records yet</p>
          <p className="text-xs text-slate-600">Start a chat to create your first health consultation record.</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn-primary text-xs mt-1"
          >
            Start a Chat
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {sorted.map((session) => (
            <div
              key={session.sessionId}
              className="card p-3.5 flex items-start gap-3 cursor-pointer hover:border-surface-600 transition-colors"
              onClick={() => navigate(`/?s=${session.sessionId}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/?s=${session.sessionId}`)}
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-600/15 text-brand-400">
                <FileText size={15} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {session.preview || 'Health consultation'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Clock size={10} /> {timeAgo(session.createdAt)}
                  </span>
                  <span className="text-[11px] text-slate-600">·</span>
                  <span className="text-[11px] text-slate-500">
                    {session.messageCount} messages
                  </span>
                  {session.language && session.language !== 'English' && (
                    <>
                      <span className="text-[11px] text-slate-600">·</span>
                      <span className="text-[11px] text-slate-500">{session.language}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <ChevronRight size={14} className="text-slate-600" />
                <button
                  type="button"
                  aria-label="Delete record"
                  onClick={(e) => { e.stopPropagation(); removeSession(session.sessionId); }}
                  className="rounded-lg p-1.5 text-slate-600 hover:text-danger-400 hover:bg-danger-500/10 transition"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

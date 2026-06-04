import { useState } from 'react';
import { useAppStore } from '@/store/app';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Clock, ChevronRight, Trash2, AlertCircle,
  Calendar, CheckCircle, XCircle, Loader2, MapPin,
  Stethoscope, User,
} from 'lucide-react';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   'bg-warn-500/15 text-warn-400 border border-warn-500/30',
    confirmed: 'bg-ok-500/15 text-ok-400 border border-ok-500/30',
    cancelled: 'bg-danger-500/15 text-danger-400 border border-danger-500/30',
    completed: 'bg-ink-500/15 text-ink-400 border border-ink-500/30',
  };
  const icon: Record<string, React.ReactNode> = {
    pending:   <Loader2 size={10} />,
    confirmed: <CheckCircle size={10} />,
    cancelled: <XCircle size={10} />,
    completed: <CheckCircle size={10} />,
  };
  return (
    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${map[status] ?? map.pending}`}>
      {icon[status]} {status}
    </span>
  );
}

export default function MyRecords() {
  const { chatHistory, removeSession, appointments } = useAppStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'consultations' | 'appointments'>('consultations');

  const sortedChats = [...chatHistory].sort((a, b) => b.createdAt - a.createdAt);
  const sortedAppts = [...appointments].sort((a, b) => b.bookedAt - a.bookedAt);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-0 border-b border-ink-700">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-white">My Records</h2>
            <p className="text-xs text-ink-500 mt-0.5">Consultations &amp; appointments</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex items-center gap-1.5 rounded-xl border border-ink-600 bg-ink-700 px-3 py-1.5 text-xs text-ink-400 hover:text-white hover:border-ink-500 transition"
          >
            <User size={13} /> Profile
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {([
            { id: 'consultations', label: 'Consultations', count: sortedChats.length },
            { id: 'appointments',  label: 'Appointments',  count: sortedAppts.length },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-ink-500 hover:text-ink-200'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  tab === t.id ? 'bg-brand-500/20 text-brand-400' : 'bg-ink-700 text-ink-500'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Consultations tab ─────────────────────────────────────────────── */}
      {tab === 'consultations' && (
        <>
          <div className="shrink-0 mx-3 mt-3 rounded-xl border border-brand-500/20 bg-brand-500/8 px-3 py-2 flex items-start gap-2">
            <AlertCircle size={12} className="text-brand-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-ink-400">
              AI-generated consultation records. Upload images via the chat for report analysis.
            </p>
          </div>

          {sortedChats.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="rounded-2xl bg-ink-800 p-5">
                <FileText size={32} className="text-ink-600 mx-auto" />
              </div>
              <p className="text-sm font-medium text-ink-400">No consultations yet</p>
              <p className="text-xs text-ink-600">Start a chat to create your first record.</p>
              <button type="button" onClick={() => navigate('/')} className="btn-primary text-xs mt-1">
                Start Chat
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {sortedChats.map((session) => (
                <div
                  key={session.sessionId}
                  className="card p-3.5 flex items-start gap-3 cursor-pointer hover:border-ink-600 transition-colors"
                  onClick={() => navigate(`/?s=${session.sessionId}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/?s=${session.sessionId}`)}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-600/15 text-brand-400">
                    <FileText size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-200 truncate">
                      {session.preview || 'Health consultation'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-[11px] text-ink-500">
                        <Clock size={10} /> {timeAgo(session.createdAt)}
                      </span>
                      <span className="text-[11px] text-ink-600">·</span>
                      <span className="text-[11px] text-ink-500">{session.messageCount} messages</span>
                      {session.language && session.language !== 'English' && (
                        <>
                          <span className="text-[11px] text-ink-600">·</span>
                          <span className="text-[11px] text-ink-500">{session.language}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ChevronRight size={14} className="text-ink-600" />
                    <button
                      type="button"
                      aria-label="Delete record"
                      onClick={(e) => { e.stopPropagation(); removeSession(session.sessionId); }}
                      className="rounded-lg p-1.5 text-ink-600 hover:text-danger-400 hover:bg-danger-500/10 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Appointments tab ──────────────────────────────────────────────── */}
      {tab === 'appointments' && (
        <>
          {sortedAppts.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="rounded-2xl bg-ink-800 p-5">
                <Calendar size={32} className="text-ink-600 mx-auto" />
              </div>
              <p className="text-sm font-medium text-ink-400">No appointments yet</p>
              <p className="text-xs text-ink-600">Book a slot via Find Care.</p>
              <button type="button" onClick={() => navigate('/find-care')} className="btn-primary text-xs mt-1">
                Find Care
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {sortedAppts.map((appt) => (
                <div key={appt.appointmentId} className="card p-4 space-y-2">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{appt.doctorName}</p>
                      <p className="text-[11px] text-ink-500 mt-0.5 flex items-center gap-1">
                        <Stethoscope size={10} /> {appt.specialty}
                      </p>
                    </div>
                    <StatusBadge status={appt.status} />
                  </div>

                  {/* Facility */}
                  <div className="flex items-center gap-1.5 text-[11px] text-ink-500">
                    <MapPin size={10} />
                    <span className="truncate">{appt.facilityName}</span>
                    <span className="text-ink-600">·</span>
                    <span>{appt.facilityCity}</span>
                  </div>

                  {/* Date + time */}
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1 text-ink-400">
                      <Calendar size={10} /> {formatDate(appt.date)}
                    </span>
                    <span className="flex items-center gap-1 text-brand-400 font-medium">
                      <Clock size={10} /> {appt.startTime}–{appt.endTime}
                    </span>
                  </div>

                  <p className="text-[10px] text-ink-600">ID: {appt.appointmentId}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

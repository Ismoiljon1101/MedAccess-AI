import { useState, useEffect, useCallback } from 'react';
import { Users, RefreshCw, Clock, Phone, FileText, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2, AlertTriangle, Zap, Activity, Heart } from 'lucide-react';
import { getReferrals, updateReferral, type ReferralRecord } from '@/lib/api';

const URGENCY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  emergency:           { label: 'Emergency',        color: 'text-red-400 border-red-500/40 bg-red-500/10',    icon: <Zap size={12} /> },
  urgent:              { label: 'Urgent',            color: 'text-orange-400 border-orange-500/40 bg-orange-500/10', icon: <AlertTriangle size={12} /> },
  'see-clinician-soon':{ label: 'See Clinician Soon',color: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10', icon: <Activity size={12} /> },
  'self-care':         { label: 'Self Care',         color: 'text-green-400 border-green-500/40 bg-green-500/10', icon: <Heart size={12} /> },
};

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  pending:   { label: 'Pending',   dot: 'bg-yellow-400' },
  confirmed: { label: 'Confirmed', dot: 'bg-green-400'  },
  cancelled: { label: 'Cancelled', dot: 'bg-slate-500'  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const POLL_INTERVAL_MS = 30_000;

export default function Patients() {
  const [referrals, setReferrals]   = useState<ReferralRecord[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [updating, setUpdating]     = useState<string | null>(null);
  const [filter, setFilter]         = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [lastSync, setLastSync]     = useState<Date | null>(null);

  // ── Load referrals. silent=true skips loading spinner (used by poller) ──
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await getReferrals();
      setReferrals(data);
      setLastSync(new Date());
    } catch (e: any) {
      setError(e.message || 'Failed to load referrals');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // ── Initial load ───────────────────────────────────────────────────────
  useEffect(() => { load(); }, [load]);

  // ── Background polling every 30s so new referrals appear automatically ──
  useEffect(() => {
    const id = setInterval(() => {
      // Skip poll if a mutation is in-flight to avoid stomping local state
      if (!updating) load(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load, updating]);

  // ── Refresh when tab becomes visible (catches changes while away) ──────
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') load(true);
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  async function handleStatus(id: string, status: 'confirmed' | 'cancelled' | 'pending') {
    setUpdating(id);
    try {
      const updated = await updateReferral(id, status);
      setReferrals((prev) => prev.map((r) => r._id === id ? { ...r, status: updated.status } : r));
    } catch (e: any) {
      setError(e.message || 'Update failed');
    } finally {
      setUpdating(null);
    }
  }

  const filtered = filter === 'all' ? referrals : referrals.filter((r) => r.status === filter);

  const counts = {
    all: referrals.length,
    pending: referrals.filter((r) => r.status === 'pending').length,
    confirmed: referrals.filter((r) => r.status === 'confirmed').length,
    cancelled: referrals.filter((r) => r.status === 'cancelled').length,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-ink-700/60 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-accent-400" />
          <div>
            <h1 className="text-base font-semibold text-white">Patient Queue</h1>
            <p className="text-xs text-ink-300 mt-0.5">Incoming referrals from MA Agent</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastSync && (
            <span className="text-[11px] text-ink-400 hidden sm:inline">
              Auto-refresh · synced {timeAgo(lastSync.toISOString())}
            </span>
          )}
          <button
            type="button"
            onClick={() => load(false)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-ink-200 hover:border-accent-500/50 transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="shrink-0 flex gap-2 px-6 pt-3 pb-2">
        {(['all', 'pending', 'confirmed', 'cancelled'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition capitalize ${
              filter === f
                ? 'border-accent-500/60 bg-accent-500/15 text-accent-400'
                : 'border-ink-600 bg-ink-800 text-ink-300 hover:border-ink-500'
            }`}
          >
            {f} <span className="ml-1 text-[10px] opacity-60">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="shrink-0 mx-6 mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2 space-y-3">
        {loading && !referrals.length && (
          <div className="flex items-center justify-center py-16 gap-2 text-ink-400">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Users size={32} className="text-ink-600" />
            <p className="text-sm text-ink-400">No {filter !== 'all' ? filter : ''} referrals yet.</p>
            <p className="text-xs text-ink-500">Patients booked via MA Agent will appear here.</p>
          </div>
        )}

        {filtered.map((ref) => {
          const urg  = URGENCY_CONFIG[ref.urgency] ?? URGENCY_CONFIG['see-clinician-soon'];
          const stat = STATUS_CONFIG[ref.status]   ?? STATUS_CONFIG['pending'];
          const isOpen = expanded === ref._id;

          return (
            <div key={ref._id} className="rounded-2xl border border-ink-700/60 bg-ink-900/60 overflow-hidden">
              {/* Card header */}
              <div className="p-4 flex items-start gap-3">
                {/* Urgency icon */}
                <div className={`mt-0.5 flex items-center justify-center rounded-xl border p-2 ${urg.color}`}>
                  {urg.icon}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white truncate">{ref.patientName}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${urg.color}`}>
                      {urg.icon} {urg.label}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-ink-400">
                      <span className={`h-1.5 w-1.5 rounded-full ${stat.dot}`} /> {stat.label}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-400">
                    <span className="text-accent-400 font-medium">{ref.specialty}</span>
                    {ref.patientPhone && (
                      <span className="flex items-center gap-1"><Phone size={10} /> {ref.patientPhone}</span>
                    )}
                    {ref.preferredTime && (
                      <span className="flex items-center gap-1"><Clock size={10} /> {ref.preferredTime}</span>
                    )}
                    <span className="text-ink-500">{timeAgo(ref.createdAt)}</span>
                  </div>

                  {ref.summary && (
                    <p className="mt-1.5 text-[11px] text-ink-300 line-clamp-2">{ref.summary}</p>
                  )}
                </div>

                {/* Expand toggle */}
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : ref._id)}
                  className="shrink-0 text-ink-500 hover:text-white transition p-1"
                >
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t border-ink-700/60 px-4 py-3 space-y-3">
                  {ref.summary && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-ink-500 mb-1 flex items-center gap-1">
                        <FileText size={10} /> MA Agent Summary
                      </p>
                      <p className="text-xs text-ink-200 leading-relaxed">{ref.summary}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-ink-500">Session ID</span>
                      <p className="text-ink-300 font-mono truncate">{ref.sessionId}</p>
                    </div>
                    <div>
                      <span className="text-ink-500">Referral ID</span>
                      <p className="text-ink-300 font-mono truncate">{ref._id}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              {ref.status === 'pending' && (
                <div className="border-t border-ink-700/60 px-4 py-3 flex gap-2">
                  <button
                    type="button"
                    disabled={updating === ref._id}
                    onClick={() => handleStatus(ref._id, 'confirmed')}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-green-500/40 bg-green-500/10 py-2 text-xs font-medium text-green-400 hover:bg-green-500/20 transition disabled:opacity-50"
                  >
                    {updating === ref._id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                    Confirm Appointment
                  </button>
                  <button
                    type="button"
                    disabled={updating === ref._id}
                    onClick={() => handleStatus(ref._id, 'cancelled')}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-ink-600 bg-ink-800 px-4 py-2 text-xs font-medium text-ink-400 hover:border-red-500/40 hover:text-red-400 transition disabled:opacity-50"
                  >
                    <XCircle size={13} /> Decline
                  </button>
                </div>
              )}

              {ref.status === 'confirmed' && (
                <div className="border-t border-ink-700/60 px-4 py-2 flex items-center gap-2 text-xs text-green-400">
                  <CheckCircle size={13} /> Appointment confirmed
                </div>
              )}

              {ref.status === 'cancelled' && (
                <div className="border-t border-ink-700/60 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs text-ink-500 flex items-center gap-1.5"><XCircle size={13} /> Declined</span>
                  <button
                    type="button"
                    onClick={() => handleStatus(ref._id, 'pending')}
                    className="text-[11px] text-accent-400 hover:underline"
                  >
                    Reopen
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

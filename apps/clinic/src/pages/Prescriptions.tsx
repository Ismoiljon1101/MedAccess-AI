import { useState, useEffect, useCallback } from 'react';
import {
  Pill, RefreshCw, Clock, Phone, FileText, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Loader2, User,
} from 'lucide-react';
import { getReferrals, updateReferral, type ReferralRecord } from '@/lib/api';

// For v0.1: prescriptions = referrals with urgency 'self-care'
// (patient can handle at pharmacy without full clinic visit)
// v0.2: dedicated Prescription model with medication list, dosage, etc.

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Prescriptions() {
  const [all, setAll]           = useState<ReferralRecord[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter]     = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('pending');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await getReferrals();
      // For now all referrals are shown; in v0.2 filter by type=prescription
      setAll(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load prescriptions');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => { if (!updating) load(true); }, 30_000);
    return () => clearInterval(id);
  }, [load, updating]);

  async function handleAction(id: string, status: 'confirmed' | 'cancelled' | 'pending') {
    setUpdating(id);
    try {
      const updated = await updateReferral(id, status);
      setAll((prev) => prev.map((r) => r._id === id ? { ...r, status: updated.status } : r));
    } catch (e: any) {
      setError(e.message || 'Update failed');
    } finally {
      setUpdating(null);
    }
  }

  const filtered = filter === 'all' ? all : all.filter((r) => r.status === filter);
  const counts = {
    all:       all.length,
    pending:   all.filter((r) => r.status === 'pending').length,
    confirmed: all.filter((r) => r.status === 'confirmed').length,
    cancelled: all.filter((r) => r.status === 'cancelled').length,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-ink-700/60 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Pill size={20} className="text-accent-400" />
          <div>
            <h1 className="font-display text-xl text-white tracking-tight">Prescription Queue</h1>
            <p className="text-xs text-ink-300 mt-0.5">Requests forwarded from MA Agent & doctors</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load(false)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-ink-200 hover:border-accent-500/50 transition"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="shrink-0 flex gap-2 px-6 pt-3 pb-2">
        {(['pending', 'confirmed', 'cancelled', 'all'] as const).map((f) => (
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

      {error && (
        <div className="shrink-0 mx-6 mt-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-xs text-danger-500">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2 space-y-3">
        {loading && !all.length && (
          <div className="flex items-center justify-center py-16 gap-2 text-ink-400">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Pill size={32} className="text-ink-600" />
            <p className="text-sm text-ink-400">No {filter !== 'all' ? filter : ''} prescriptions yet.</p>
            <p className="text-xs text-ink-500">Prescription requests from MA Agent will appear here.</p>
          </div>
        )}

        {filtered.map((rx) => {
          const isOpen = expanded === rx._id;
          return (
            <div key={rx._id} className="card overflow-hidden">
              <div className="p-4 flex items-start gap-3">
                {/* Icon */}
                <div className="mt-0.5 flex items-center justify-center rounded-xl border border-accent-500/40 bg-accent-500/10 p-2 text-accent-400">
                  <Pill size={13} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{rx.patientName}</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-accent-500/30 bg-accent-500/10 px-2 py-0.5 text-[10px] text-accent-400">
                      <Pill size={9} /> {rx.specialty}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      rx.status === 'confirmed' ? 'bg-ok-500/15 text-ok-500' :
                      rx.status === 'cancelled' ? 'bg-ink-700 text-ink-400' :
                      'bg-warn-500/15 text-warn-500'
                    }`}>{rx.status}</span>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-400">
                    {rx.patientPhone && (
                      <span className="flex items-center gap-1"><Phone size={10} /> {rx.patientPhone}</span>
                    )}
                    {rx.preferredTime && (
                      <span className="flex items-center gap-1"><Clock size={10} /> {rx.preferredTime}</span>
                    )}
                    <span className="text-ink-500">{timeAgo(rx.createdAt)}</span>
                  </div>

                  {rx.summary && (
                    <p className="mt-1.5 text-[11px] text-ink-300 line-clamp-2">{rx.summary}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : rx._id)}
                  className="shrink-0 text-ink-500 hover:text-white transition p-1"
                >
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {/* Expanded */}
              {isOpen && (
                <div className="border-t border-ink-700/60 px-4 py-3 space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-ink-500 mb-1 flex items-center gap-1">
                      <FileText size={10} /> MA Agent Summary
                    </p>
                    <p className="text-xs text-ink-200 leading-relaxed">{rx.summary || 'No summary provided.'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-ink-500">Patient</span>
                      <p className="text-ink-300 flex items-center gap-1"><User size={10} /> {rx.patientName}</p>
                    </div>
                    <div>
                      <span className="text-ink-500">Session ID</span>
                      <p className="text-ink-300 font-mono truncate">{rx.sessionId}</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-ink-800/60 border border-ink-700/40 p-3 text-xs text-ink-400">
                    <p className="font-medium text-ink-300 mb-1">⚠️ Prescription model coming in v0.2</p>
                    <p>Full prescription (medication name, dosage, route, frequency, duration) will be structured in the v0.2 database. For now, the MA Agent summary contains the recommendation.</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              {rx.status === 'pending' && (
                <div className="border-t border-ink-700/60 px-4 py-3 flex gap-2">
                  <button
                    type="button"
                    disabled={updating === rx._id}
                    onClick={() => handleAction(rx._id, 'confirmed')}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-accent-500/40 bg-accent-500/10 py-2 text-xs font-medium text-accent-400 hover:bg-accent-500/20 transition disabled:opacity-50"
                  >
                    {updating === rx._id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                    Dispense
                  </button>
                  <button
                    type="button"
                    disabled={updating === rx._id}
                    onClick={() => handleAction(rx._id, 'cancelled')}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-ink-600 bg-ink-800 px-4 py-2 text-xs font-medium text-ink-400 hover:border-danger-500/40 hover:text-danger-500 transition disabled:opacity-50"
                  >
                    <XCircle size={13} /> Flag
                  </button>
                </div>
              )}
              {rx.status === 'confirmed' && (
                <div className="border-t border-ink-700/60 px-4 py-2 flex items-center gap-2 text-xs text-accent-400">
                  <CheckCircle size={13} /> Dispensed
                </div>
              )}
              {rx.status === 'cancelled' && (
                <div className="border-t border-ink-700/60 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs text-ink-500 flex items-center gap-1.5"><XCircle size={13} /> Flagged / declined</span>
                  <button type="button" onClick={() => handleAction(rx._id, 'pending')} className="text-[11px] text-accent-400 hover:underline">
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

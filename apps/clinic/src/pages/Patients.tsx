import { useState, useEffect, useCallback } from 'react';
import {
  Users, RefreshCw, Clock, Phone,
  ChevronDown, ChevronUp, CheckCircle, XCircle,
  Loader2, AlertTriangle, Zap, Activity, Heart, User,
  Stethoscope, ImageIcon, Brain, Calendar,
} from 'lucide-react';
import { getReferrals, updateReferral, type ReferralRecord, type PatientInfo } from '@/lib/api';

const URGENCY_CONFIG: Record<string, { label: string; bar: string; badge: string; icon: React.ReactNode }> = {
  emergency:            { label: 'Emergency',         bar: 'bg-red-500',    badge: 'border-red-500/40 bg-red-500/10 text-red-400',       icon: <Zap size={11} /> },
  urgent:               { label: 'Urgent',            bar: 'bg-orange-500', badge: 'border-orange-500/40 bg-orange-500/10 text-orange-400', icon: <AlertTriangle size={11} /> },
  'see-clinician-soon': { label: 'See Clinician Soon',bar: 'bg-yellow-500', badge: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400', icon: <Activity size={11} /> },
  'self-care':          { label: 'Self Care',         bar: 'bg-green-500',  badge: 'border-green-500/40 bg-green-500/10 text-green-400',   icon: <Heart size={11} /> },
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:   { label: '대기 · Pending',   cls: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30' },
  confirmed: { label: '확정 · Confirmed', cls: 'bg-green-500/15 text-green-400 border border-green-500/30'   },
  cancelled: { label: '취소 · Cancelled', cls: 'bg-ink-700/60 text-ink-500 border border-ink-600/40'         },
  completed: { label: '완료 · Completed', cls: 'bg-ink-700/60 text-ink-500 border border-ink-600/40'         },
};

const TRIAGE_LEVEL_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  RED:    { color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/40',    label: '🔴 RED — Immediate' },
  ORANGE: { color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/40', label: '🟠 ORANGE — Very Urgent' },
  YELLOW: { color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/40', label: '🟡 YELLOW — Urgent' },
  GREEN:  { color: 'text-green-400',  bg: 'bg-green-500/15 border-green-500/40',  label: '🟢 GREEN — Standard' },
  BLUE:   { color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/40',   label: '🔵 BLUE — Non-Urgent' },
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

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

const POLL_MS = 30_000;

export default function Patients() {
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [updating, setUpdating]   = useState<string | null>(null);
  const [filter, setFilter]       = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [lastSync, setLastSync]   = useState<Date | null>(null);
  const [search, setSearch]       = useState('');

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

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => { if (!updating) load(true); }, POLL_MS);
    return () => clearInterval(id);
  }, [load, updating]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  async function handleStatus(id: string, status: 'confirmed' | 'cancelled' | 'pending' | 'completed') {
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

  const byStatus = filter === 'all' ? referrals : referrals.filter((r) => r.status === filter);
  const filtered = search.trim()
    ? byStatus.filter((r) =>
        (r.patientName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        r.specialty.toLowerCase().includes(search.toLowerCase())
      )
    : byStatus;

  const counts = {
    all:       referrals.length,
    pending:   referrals.filter((r) => r.status === 'pending').length,
    confirmed: referrals.filter((r) => r.status === 'confirmed').length,
    cancelled: referrals.filter((r) => r.status === 'cancelled').length,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-ink-700/60 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent-500/15 grid place-items-center text-accent-400 ring-1 ring-accent-500/30">
              <Users size={18} />
            </div>
            <div>
              <h1 className="font-display text-xl text-white tracking-tight">Patient Queue</h1>
              <p className="text-[11px] text-ink-400 mt-0.5">
                {lastSync ? `Synced ${timeAgo(lastSync.toISOString())}` : 'Loading…'} · auto-refresh 30s
              </p>
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

        {/* Search + filters */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <input
            className="input flex-1 min-w-[180px] h-8 py-0 text-xs"
            placeholder="Search by name or specialty…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-1.5">
            {(['all', 'pending', 'confirmed', 'cancelled'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium border transition capitalize ${
                  filter === f
                    ? 'border-accent-500/60 bg-accent-500/15 text-accent-400'
                    : 'border-ink-600 bg-ink-800 text-ink-400 hover:border-ink-500'
                }`}
              >
                {f} <span className="opacity-60">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="shrink-0 mx-6 mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-3 space-y-2.5">
        {loading && !referrals.length && (
          <div className="flex items-center justify-center py-16 gap-2 text-ink-400">
            <Loader2 size={16} className="animate-spin" /> Loading referrals…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Users size={36} className="text-ink-700" />
            <p className="text-sm text-ink-400">No referrals found</p>
            <p className="text-xs text-ink-500">Patients booked via MA Agent will appear here automatically.</p>
          </div>
        )}

        {filtered.map((ref) => {
          const urg  = URGENCY_CONFIG[ref.urgency] ?? URGENCY_CONFIG['see-clinician-soon'];
          const stat = STATUS_CONFIG[ref.status]   ?? STATUS_CONFIG['pending'];
          const isOpen = expanded === ref._id;

          return (
            <div
              key={ref._id}
              className="rounded-2xl border border-ink-700/60 bg-ink-900/60 overflow-hidden hover:border-ink-600/80 transition-colors"
            >
              <div className="flex">
                {/* Urgency bar */}
                <div className={`w-1 shrink-0 ${urg.bar}`} />

                <div className="flex-1 p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="h-9 w-9 shrink-0 rounded-xl bg-ink-800 ring-1 ring-ink-700/60 grid place-items-center text-xs font-bold text-ink-300 mt-0.5">
                      {initials(ref.patientName ?? '?')}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">{ref.patientName}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${urg.badge}`}>
                          {urg.icon} {urg.label}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${stat.cls}`}>
                          {stat.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-400">
                        <span className="text-accent-400 font-medium">{ref.specialty}</span>
                        {ref.patientPhone && (
                          <span className="flex items-center gap-1"><Phone size={10} /> {ref.patientPhone}</span>
                        )}
                        {ref.preferredTime && (
                          <span className="flex items-center gap-1"><Clock size={10} /> {ref.preferredTime}</span>
                        )}
                        <span className="text-ink-600">{timeAgo(ref.createdAt)}</span>
                      </div>
                      {ref.summary && (
                        <p className="mt-1.5 text-[11px] text-ink-300 line-clamp-2 leading-relaxed">{ref.summary}</p>
                      )}
                    </div>

                    {/* Expand toggle */}
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : ref._id)}
                      className="shrink-0 text-ink-500 hover:text-white transition p-1 mt-0.5"
                    >
                      {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>

                  {/* Expanded detail — full patient record + agent analysis */}
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-ink-700/40 space-y-2.5">

                      {/* ── Patient Profile ───────────────────────────────── */}
                      {ref.patientId && typeof ref.patientId === 'object' && (
                        <div className="patient-section">
                          <p className="patient-section-title">
                            <User size={10} /> Patient Profile
                          </p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                            {(ref.patientId as PatientInfo).fullName && (
                              <div className="patient-field">
                                <span className="patient-field-label">Name</span>
                                <span className="patient-field-value font-medium text-white">{(ref.patientId as PatientInfo).fullName}</span>
                              </div>
                            )}
                            {(ref.patientId as PatientInfo).phone && (
                              <div className="patient-field">
                                <span className="patient-field-label">Phone</span>
                                <a href={`tel:${(ref.patientId as PatientInfo).phone}`} className="patient-field-value text-accent-400 flex items-center gap-1">
                                  <Phone size={9} /> {(ref.patientId as PatientInfo).phone}
                                </a>
                              </div>
                            )}
                            {(ref.patientId as PatientInfo).sex && (
                              <div className="patient-field">
                                <span className="patient-field-label">Sex</span>
                                <span className="patient-field-value capitalize">{(ref.patientId as PatientInfo).sex}</span>
                              </div>
                            )}
                            {(ref.patientId as PatientInfo).dateOfBirth && (
                              <div className="patient-field">
                                <span className="patient-field-label">DOB</span>
                                <span className="patient-field-value font-mono-data">{(ref.patientId as PatientInfo).dateOfBirth}</span>
                              </div>
                            )}
                            {(ref.patientId as PatientInfo).knownAllergies?.length ? (
                              <div className="patient-field col-span-2">
                                <span className="patient-field-label text-red-400">Allergies</span>
                                <span className="patient-field-value text-red-300">{(ref.patientId as PatientInfo).knownAllergies!.join(', ')}</span>
                              </div>
                            ) : null}
                            {(ref.patientId as PatientInfo).chronicConditions?.length ? (
                              <div className="patient-field col-span-2">
                                <span className="patient-field-label">Conditions</span>
                                <span className="patient-field-value">{(ref.patientId as PatientInfo).chronicConditions!.join(', ')}</span>
                              </div>
                            ) : null}
                            {(ref.patientId as PatientInfo).currentMedications?.length ? (
                              <div className="patient-field col-span-2">
                                <span className="patient-field-label">Medications</span>
                                <span className="patient-field-value">{(ref.patientId as PatientInfo).currentMedications!.join(', ')}</span>
                              </div>
                            ) : null}
                            {(ref.patientId as PatientInfo).emergencyContact && (
                              <div className="patient-field col-span-2">
                                <span className="patient-field-label">Emergency</span>
                                <span className="patient-field-value">
                                  {(ref.patientId as PatientInfo).emergencyContact!.name}
                                  {' '}({(ref.patientId as PatientInfo).emergencyContact!.relationship})
                                  {' · '}{(ref.patientId as PatientInfo).emergencyContact!.phone}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ── Triage Result ─────────────────────────────────── */}
                      {ref.agentAnalysis?.triageId && (
                        <div className="patient-section">
                          <p className="patient-section-title"><AlertTriangle size={10} /> Triage Assessment</p>
                          {(() => {
                            const t = ref.agentAnalysis!.triageId!;
                            const lvl = TRIAGE_LEVEL_CONFIG[t.level] ?? TRIAGE_LEVEL_CONFIG.YELLOW;
                            return (
                              <div className="space-y-2">
                                <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${lvl.bg} ${lvl.color}`}>
                                  {lvl.label}
                                  {t.targetTimeToCare && <span className="opacity-70 font-normal">· {t.targetTimeToCare}</span>}
                                </div>
                                {t.actions?.length ? (
                                  <ul className="space-y-0.5">
                                    {t.actions.map((a: string, i: number) => (
                                      <li key={i} className="text-[11px] text-ink-300 flex items-start gap-1.5">
                                        <span className="text-accent-400 mt-0.5 shrink-0">›</span> {a}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                                {t.warningSigns?.length ? (
                                  <div className="mt-1">
                                    <p className="text-[10px] text-red-400 font-medium mb-0.5">⚠ Warning signs</p>
                                    <p className="text-[11px] text-red-300/80">{t.warningSigns.join(' · ')}</p>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* ── Symptom Analysis ──────────────────────────────── */}
                      {ref.agentAnalysis?.symptomsId && (
                        <div className="patient-section">
                          <p className="patient-section-title"><Stethoscope size={10} /> Symptom Analysis</p>
                          {(() => {
                            const s = ref.agentAnalysis!.symptomsId!;
                            return (
                              <div className="space-y-1.5">
                                {s.differentials?.slice(0, 4).map((d: any, i: number) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${
                                      d.likelihood === 'high' ? 'bg-red-400' : d.likelihood === 'moderate' ? 'bg-yellow-400' : 'bg-ink-500'
                                    }`} />
                                    <span className="text-[11px] text-ink-200 flex-1 truncate">{d.condition}</span>
                                    <span className={`font-mono-data text-[10px] shrink-0 ${
                                      d.likelihood === 'high' ? 'text-red-400' : d.likelihood === 'moderate' ? 'text-yellow-400' : 'text-ink-500'
                                    }`}>{d.probabilityPct}%</span>
                                  </div>
                                ))}
                                {s.recommendedNextSteps?.length ? (
                                  <div className="mt-1.5 pt-1.5 border-t border-ink-700/40">
                                    <p className="text-[10px] text-ink-500 mb-1">Recommended next steps</p>
                                    {s.recommendedNextSteps.slice(0, 3).map((step: string, i: number) => (
                                      <p key={i} className="text-[11px] text-ink-300">• {step}</p>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* ── Image Analysis ────────────────────────────────── */}
                      {ref.imageAnalysis && (
                        <div className="patient-section">
                          <p className="patient-section-title text-accent-400">
                            <ImageIcon size={10} /> AI Image Analysis — {ref.imageAnalysis.imageType}
                          </p>
                          {ref.imageAnalysis.findings?.length > 0 ? (
                            <ul className="space-y-1">
                              {ref.imageAnalysis.findings.map((f: any, i: number) => (
                                <li key={i} className="text-[11px] text-ink-200 flex items-start gap-2">
                                  <span className={`shrink-0 mt-1 h-1.5 w-1.5 rounded-full ${
                                    f.confidence === 'high' ? 'bg-red-400' : f.confidence === 'moderate' ? 'bg-amber-400' : 'bg-ink-500'
                                  }`} />
                                  <span><strong className="text-white">{f.finding}</strong> <span className="text-ink-500">({f.confidence})</span>{f.notes ? ` — ${f.notes}` : ''}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-ink-500">No specific findings detected</p>
                          )}
                          {ref.imageAnalysis.suggestedFollowUp?.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-ink-700/40">
                              <p className="text-[10px] text-ink-500 mb-1">Suggested follow-up</p>
                              {ref.imageAnalysis.suggestedFollowUp.map((s: string, i: number) => (
                                <p key={i} className="text-[11px] text-ink-300">• {s}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── MA Agent Summary ──────────────────────────────── */}
                      {ref.summary && (
                        <div className="patient-section">
                          <p className="patient-section-title"><Brain size={10} /> MA Agent Summary</p>
                          <p className="text-[11px] text-ink-200 leading-relaxed">{ref.summary}</p>
                        </div>
                      )}

                      {/* ── Appointment details ───────────────────────────── */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-ink-600 pt-1">
                        {ref.scheduledDate && (
                          <span className="flex items-center gap-1 font-mono-data">
                            <Calendar size={9} /> {ref.scheduledDate} {ref.scheduledTime}
                          </span>
                        )}
                        <span className="font-mono-data truncate">ID: {ref._id}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {ref.status === 'pending' && (
                <div className="border-t border-ink-700/40 px-4 py-3 flex gap-2 bg-ink-900/40">
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
                <div className="border-t border-ink-700/40 px-4 py-2.5 flex items-center justify-between bg-green-500/5">
                  <span className="text-xs text-green-400 flex items-center gap-1.5"><CheckCircle size={13} /> 확정됨 · Confirmed</span>
                  <button type="button" onClick={() => handleStatus(ref._id, 'completed')} className="text-[11px] text-ink-500 hover:text-ink-300 transition">
                    Mark complete
                  </button>
                </div>
              )}

              {ref.status === 'cancelled' && (
                <div className="border-t border-ink-700/40 px-4 py-2.5 flex items-center justify-between bg-ink-900/40">
                  <span className="text-xs text-ink-500 flex items-center gap-1.5"><XCircle size={13} /> Declined</span>
                  <button type="button" onClick={() => handleStatus(ref._id, 'pending')} className="text-[11px] text-accent-400 hover:underline">
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

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Clock, CheckCircle, AlertTriangle, Zap, Activity, Heart,
  ArrowRight, Pill, TrendingUp, Calendar, RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { getReferrals, type ReferralRecord } from '@/lib/api';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const URGENCY_COLOR: Record<string, string> = {
  emergency:            'bg-red-500',
  urgent:               'bg-orange-500',
  'see-clinician-soon': 'bg-yellow-500',
  'self-care':          'bg-green-500',
};

const URGENCY_TEXT: Record<string, string> = {
  emergency:            'text-red-400',
  urgent:               'text-orange-400',
  'see-clinician-soon': 'text-yellow-400',
  'self-care':          'text-green-400',
};

const URGENCY_ICON: Record<string, React.ReactNode> = {
  emergency:            <Zap size={11} />,
  urgent:               <AlertTriangle size={11} />,
  'see-clinician-soon': <Activity size={11} />,
  'self-care':          <Heart size={11} />,
};

function StatCard({
  label, value, icon, sub, accentClass,
}: { label: string; value: number | string; icon: React.ReactNode; sub?: string; accentClass: string }) {
  return (
    <div className={`rounded-2xl border border-ink-700/60 bg-ink-900/70 backdrop-blur-sm p-5 flex items-start gap-4 border-l-[3px] ${accentClass} transition hover:bg-ink-800/50`}>
      <div className="mt-0.5 text-ink-500">{icon}</div>
      <div>
        <p className="font-mono-data text-2xl font-bold text-white leading-none">{value}</p>
        <p className="text-xs text-ink-300 mt-1.5 font-medium">{label}</p>
        {sub && <p className="text-[10px] text-ink-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SkeletonStatCard() {
  return (
    <div className="card p-5 flex items-start gap-4 border-l-2 border-ink-700 animate-pulse">
      <div className="mt-0.5 h-5 w-5 rounded-md bg-ink-700" />
      <div className="space-y-2 flex-1">
        <div className="h-7 w-12 rounded bg-ink-700" />
        <div className="h-3 w-20 rounded bg-ink-800" />
        <div className="h-2 w-16 rounded bg-ink-800" />
      </div>
    </div>
  );
}

// ── Doctor dashboard ────────────────────────────────────────────────────

function DoctorDashboard({ referrals }: { referrals: ReferralRecord[] }) {
  const pending   = referrals.filter((r) => r.status === 'pending');
  const confirmed = referrals.filter((r) => r.status === 'confirmed');
  const urgent    = referrals.filter((r) => r.urgency === 'emergency' || r.urgency === 'urgent');
  const recent    = [...referrals].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Pending"    value={pending.length}   icon={<Clock size={18} />}         sub="awaiting review"     accentClass="border-yellow-500" />
        <StatCard label="Confirmed"  value={confirmed.length} icon={<CheckCircle size={18} />}   sub="appointments set"    accentClass="border-green-500"  />
        <StatCard label="Urgent"     value={urgent.length}    icon={<AlertTriangle size={18} />}  sub="emergency + urgent"  accentClass="border-red-500"    />
        <StatCard label="Total"      value={referrals.length} icon={<Users size={18} />}         sub="all time"            accentClass="border-accent-500" />
      </div>

      {/* Recent queue */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Recent Patient Queue</h2>
          <Link to="/patients" className="text-xs text-accent-400 hover:underline flex items-center gap-1">
            View all <ArrowRight size={11} />
          </Link>
        </div>
        <div className="space-y-2">
          {recent.length === 0 && (
            <div className="card p-8 text-center text-ink-500 text-sm">
              No referrals yet. Patients booked via MA Agent will appear here.
            </div>
          )}
          {recent.map((r) => (
            <div key={r._id} className="card px-4 py-3 flex items-center gap-3">
              {/* Urgency bar */}
              <div className={`h-8 w-1 rounded-full shrink-0 ${URGENCY_COLOR[r.urgency] ?? 'bg-ink-600'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">{r.patientName}</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${URGENCY_TEXT[r.urgency] ?? 'text-ink-400'}`}>
                    {URGENCY_ICON[r.urgency]} {r.urgency}
                  </span>
                </div>
                <p className="text-[11px] text-ink-400 mt-0.5 truncate">{r.specialty} · {r.summary?.slice(0, 70) || 'No summary'}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  r.status === 'confirmed' ? 'bg-green-500/15 text-green-400' :
                  r.status === 'cancelled' ? 'bg-ink-700 text-ink-400' :
                  'bg-yellow-500/15 text-yellow-400'
                }`}>{r.status}</span>
                <p className="text-[10px] text-ink-500 mt-1">{timeAgo(r.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Pharmacist dashboard ────────────────────────────────────────────────

function PharmacistDashboard({ referrals }: { referrals: ReferralRecord[] }) {
  // For v0.1: treat self-care urgency referrals as pharmacy-relevant
  const rxQueue   = referrals.filter((r) => r.urgency === 'self-care');
  const pending   = rxQueue.filter((r) => r.status === 'pending');
  const confirmed = rxQueue.filter((r) => r.status === 'confirmed');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Pending Rx"    value={pending.length}   icon={<Clock size={18} />}       sub="awaiting review"   accentClass="border-yellow-500" />
        <StatCard label="Dispensed"     value={confirmed.length} icon={<CheckCircle size={18} />} sub="approved today"    accentClass="border-violet-500" />
        <StatCard label="Total Queue"   value={rxQueue.length}   icon={<Pill size={18} />}        sub="all prescriptions" accentClass="border-green-500"  />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Recent Prescriptions</h2>
          <Link to="/prescriptions" className="text-xs text-violet-400 hover:underline flex items-center gap-1">
            View all <ArrowRight size={11} />
          </Link>
        </div>
        <div className="space-y-2">
          {pending.length === 0 && (
            <div className="card p-8 text-center text-ink-500 text-sm">
              No pending prescriptions. They'll appear here when doctors send them.
            </div>
          )}
          {pending.slice(0, 5).map((r) => (
            <div key={r._id} className="card px-4 py-3 flex items-center gap-3">
              <div className="h-8 w-1 rounded-full shrink-0 bg-violet-500" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-white truncate">{r.patientName}</span>
                <p className="text-[11px] text-ink-400 mt-0.5 truncate">{r.summary?.slice(0, 80)}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-medium">pending</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Admin dashboard ─────────────────────────────────────────────────────

function AdminDashboard({ referrals }: { referrals: ReferralRecord[] }) {
  const pending   = referrals.filter((r) => r.status === 'pending').length;
  const confirmed = referrals.filter((r) => r.status === 'confirmed').length;
  const urgent    = referrals.filter((r) => r.urgency === 'emergency' || r.urgency === 'urgent').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total"      value={referrals.length} icon={<TrendingUp size={18} />}  sub="all referrals"   accentClass="border-amber-500"  />
        <StatCard label="Pending"    value={pending}          icon={<Clock size={18} />}      sub="need attention"  accentClass="border-yellow-500" />
        <StatCard label="Confirmed"  value={confirmed}        icon={<Calendar size={18} />}   sub="booked"          accentClass="border-green-500"  />
        <StatCard label="Urgent"     value={urgent}           icon={<AlertTriangle size={18} />} sub="high priority" accentClass="border-red-500"    />
      </div>
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-white mb-1">Staff Management</h2>
        <p className="text-xs text-ink-400">Add doctors, pharmacists and manage clinic settings. Full staff module coming in v0.2.</p>
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReferrals();
      setReferrals(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 pb-2 border-b border-ink-700/40">
        <div>
          <p className="text-xs font-medium text-ink-500 tracking-widest uppercase">{greeting}</p>
          <h1 className="font-display text-3xl text-white mt-0.5 leading-tight">{user?.name}</h1>
          <p className="text-sm text-ink-400 mt-1">
            <span className="text-accent-400 font-medium">{user?.specialty || user?.occupation || user?.role}</span>
            <span className="text-ink-600"> · </span>
            {user?.clinicName || 'MedAccess Clinic'}
          </p>
        </div>
        <div className="shrink-0 text-right hidden sm:block">
          <p className="font-mono-data text-xs text-ink-600">{new Date().toLocaleDateString('ko-KR')}</p>
          <p className="font-mono-data text-xs text-ink-600 mt-0.5">{new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center justify-between gap-3 text-sm text-red-400">
          <span className="flex items-center gap-2">
            <AlertTriangle size={15} /> {error}
          </span>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs hover:bg-red-500/20 transition"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card px-4 py-3 flex items-center gap-3 animate-pulse">
                <div className="h-8 w-1 rounded-full bg-ink-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 rounded bg-ink-700" />
                  <div className="h-2.5 w-56 rounded bg-ink-800" />
                </div>
                <div className="h-5 w-16 rounded-full bg-ink-700" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && user?.role === 'doctor'     && <DoctorDashboard     referrals={referrals} />}
      {!loading && !error && user?.role === 'pharmacist' && <PharmacistDashboard referrals={referrals} />}
      {!loading && !error && user?.role === 'admin'      && <AdminDashboard      referrals={referrals} />}
    </div>
  );
}

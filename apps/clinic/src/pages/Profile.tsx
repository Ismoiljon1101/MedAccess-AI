import { UserCircle, Building2, BadgeCheck, Mail, ShieldCheck, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

const ROLE_COLOR: Record<string, string> = {
  doctor:     'from-accent-500 to-accent-700',
  pharmacist: 'from-violet-500 to-violet-700',
  admin:      'from-amber-500 to-amber-700',
};

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div>
      <label className="label flex items-center gap-1.5">{icon} {label}</label>
      <div className="input flex items-center text-ink-200">{value || <span className="text-ink-600">—</span>}</div>
    </div>
  );
}

export default function Profile() {
  const { user, logout } = useAuthStore();
  if (!user) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-white">Profile</h1>

      {/* Avatar + role */}
      <div className="card p-6 flex items-center gap-5">
        <div className={`h-16 w-16 shrink-0 rounded-2xl bg-gradient-to-br ${ROLE_COLOR[user.role] ?? 'from-ink-600 to-ink-700'} grid place-items-center text-xl font-bold text-white shadow-glow`}>
          {initials(user.name)}
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-white">{user.name}</p>
          <p className="text-sm text-ink-400 capitalize mt-0.5">{user.role}</p>
          {user.clinicName && <p className="text-xs text-ink-500 mt-0.5">{user.clinicName}</p>}
        </div>
      </div>

      {/* Account details (read-only — sourced from your authenticated account) */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white mb-2">Account</h2>
        <Field icon={<UserCircle size={11} />} label="Full name" value={user.name} />
        <Field icon={<Mail size={11} />} label="Email" value={user.email} />
        <Field
          icon={<BadgeCheck size={11} />}
          label={user.role === 'doctor' ? 'Specialty' : user.role === 'pharmacist' ? 'Role / Occupation' : 'Title'}
          value={user.specialty || user.occupation}
        />
        <Field icon={<Building2 size={11} />} label="Clinic / Hospital" value={user.clinicName} />
        <Field icon={<ShieldCheck size={11} />} label="Bookable by patients" value={user.doctorId ? 'Yes' : 'No'} />
      </div>

      <button
        type="button"
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-danger-500/40 bg-danger-500/10 py-2.5 text-sm font-medium text-danger-400 hover:bg-danger-500/20 transition"
      >
        <LogOut size={14} /> Sign out
      </button>
    </div>
  );
}

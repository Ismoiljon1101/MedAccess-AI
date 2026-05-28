import { useState } from 'react';
import { Stethoscope, Pill, ShieldCheck, ArrowRight, Building2 } from 'lucide-react';
import { useAuthStore, type Role, type AuthUser } from '@/store/auth';
import { MEDICAL_SPECIALTIES } from '@medaccess/shared';

interface RoleCard {
  role: Role;
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  ring: string;
  bg: string;
  specialtyLabel: string;
  specialtyPlaceholder: string;
}

const ROLES: RoleCard[] = [
  {
    role: 'doctor',
    icon: <Stethoscope size={28} strokeWidth={1.8} />,
    title: 'Doctor',
    desc: 'Review AI-generated patient reports, manage encounters, write prescriptions and referrals.',
    color: 'text-accent-400',
    ring: 'ring-accent-500/40 hover:ring-accent-500/80',
    bg: 'bg-accent-500/10 hover:bg-accent-500/15',
    specialtyLabel: 'Specialty',
    specialtyPlaceholder: 'e.g. General Practice, Cardiology, Pediatrics',
  },
  {
    role: 'pharmacist',
    icon: <Pill size={28} strokeWidth={1.8} />,
    title: 'Pharmacist',
    desc: 'Receive prescription requests from MA Agent and doctors. Review, approve or flag before dispensing.',
    color: 'text-violet-400',
    ring: 'ring-violet-500/40 hover:ring-violet-500/80',
    bg: 'bg-violet-500/10 hover:bg-violet-500/15',
    specialtyLabel: 'Role',
    specialtyPlaceholder: 'e.g. Clinical Pharmacist, Dispensary Lead',
  },
  {
    role: 'admin',
    icon: <ShieldCheck size={28} strokeWidth={1.8} />,
    title: 'Admin',
    desc: 'Manage clinic staff, roles, and settings. Oversee the full patient and prescription flow.',
    color: 'text-amber-400',
    ring: 'ring-amber-500/40 hover:ring-amber-500/80',
    bg: 'bg-amber-500/10 hover:bg-amber-500/15',
    specialtyLabel: 'Title',
    specialtyPlaceholder: 'e.g. Clinic Manager, Head Administrator',
  },
];

export default function Login() {
  const login = useAuthStore((s) => s.login);
  const [selected, setSelected] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [error, setError] = useState('');

  const card = ROLES.find((r) => r.role === selected);

  function handleSubmit() {
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!selected) return;
    const user: AuthUser = {
      name: name.trim(),
      role: selected,
      specialty: selected === 'doctor' ? specialty.trim() || undefined : undefined,
      occupation: selected !== 'doctor' ? specialty.trim() || undefined : undefined,
      clinicName: clinicName.trim() || undefined,
    };
    login(user);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 shadow-glow">
          <Stethoscope size={22} strokeWidth={2.5} className="text-ink-950" />
        </div>
        <div>
          <div className="text-xl font-bold text-white tracking-tight">MedAccess AI</div>
          <div className="text-xs text-ink-400">Clinical Portal · v0.1</div>
        </div>
      </div>

      <div className="w-full max-w-3xl">
        {!selected ? (
          <>
            <h1 className="text-2xl font-semibold text-white text-center mb-1">Who are you?</h1>
            <p className="text-sm text-ink-400 text-center mb-8">Select your role to continue</p>

            <div className="grid gap-4 sm:grid-cols-3">
              {ROLES.map((r) => (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => setSelected(r.role)}
                  className={`
                    relative text-left rounded-2xl border border-ink-700/60 p-6 transition-all duration-200
                    ring-1 ${r.ring} ${r.bg} cursor-pointer
                  `}
                >
                  <div className={`mb-4 ${r.color}`}>{r.icon}</div>
                  <h3 className="text-base font-semibold text-white mb-2">{r.title}</h3>
                  <p className="text-xs leading-relaxed text-ink-300">{r.desc}</p>
                  <div className={`mt-4 flex items-center gap-1 text-xs font-medium ${r.color}`}>
                    Select <ArrowRight size={12} />
                  </div>
                </button>
              ))}
            </div>

            <p className="text-center text-[11px] text-ink-500 mt-8">
              No account needed for v0.1 — authentication coming in v0.2
            </p>
          </>
        ) : (
          <div className="max-w-sm mx-auto">
            <button
              type="button"
              onClick={() => { setSelected(null); setError(''); }}
              className="text-xs text-ink-400 hover:text-white mb-6 flex items-center gap-1"
            >
              ← Change role
            </button>

            <div className={`flex items-center gap-3 mb-6 p-4 rounded-2xl border border-ink-700/60 ${card?.bg}`}>
              <div className={card?.color}>{card?.icon}</div>
              <div>
                <div className="text-sm font-semibold text-white">{card?.title}</div>
                <div className="text-xs text-ink-400">{card?.desc.slice(0, 60)}…</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Full name *</label>
                <input
                  className="input"
                  placeholder="Dr. Sarah Johnson"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  autoFocus
                />
              </div>

              <div>
                <label className="label">{card?.specialtyLabel}</label>
                {selected === 'doctor' ? (
                  <select
                    className="input"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                  >
                    <option value="">— Select specialty —</option>
                    {MEDICAL_SPECIALTIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    placeholder={card?.specialtyPlaceholder}
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                  />
                )}
              </div>

              <div>
                <label className="label flex items-center gap-1.5">
                  <Building2 size={11} /> Clinic / Hospital name
                </label>
                <input
                  className="input"
                  placeholder="City General Hospital"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                type="button"
                onClick={handleSubmit}
                className="btn-primary w-full justify-center mt-2"
              >
                Enter portal <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

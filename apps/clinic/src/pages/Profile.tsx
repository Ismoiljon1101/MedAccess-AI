import { useState } from 'react';
import { UserCircle, Building2, BadgeCheck, Phone, Mail, Save } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

const ROLE_COLOR: Record<string, string> = {
  doctor:     'from-accent-500 to-accent-700',
  pharmacist: 'from-violet-500 to-violet-700',
  admin:      'from-amber-500 to-amber-700',
};

export default function Profile() {
  const { user, login } = useAuthStore();
  const u = user!; // safe: rendered only when user exists (see AuthGuard in App.tsx)
  if (!user) return null;

  const [name, setName]         = useState(user.name);
  const [specialty, setSpecialty] = useState(user.specialty || user.occupation || '');
  const [clinicName, setClinicName] = useState(user.clinicName || '');
  const [licenseNo, setLicenseNo]   = useState(user.licenseNo || '');
  const [saved, setSaved]           = useState(false);

  function save() {
    login({
      name:        name.trim() || u.name,
      role:        u.role,
      specialty:   u.role === 'doctor' ? specialty.trim() || undefined : undefined,
      occupation:  u.role !== 'doctor' ? specialty.trim() || undefined : undefined,
      clinicName:  clinicName.trim() || undefined,
      licenseNo:   licenseNo.trim() || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-white">Profile</h1>

      {/* Avatar + role */}
      <div className="card p-6 flex items-center gap-5">
        <div className={`h-16 w-16 shrink-0 rounded-2xl bg-gradient-to-br ${ROLE_COLOR[user.role] ?? 'from-ink-600 to-ink-700'} grid place-items-center text-xl font-bold text-white shadow-glow`}>
          {initials(user.name)}
        </div>
        <div>
          <p className="text-base font-semibold text-white">{user.name}</p>
          <p className="text-sm text-ink-400 capitalize mt-0.5">{user.role}</p>
          {user.clinicName && <p className="text-xs text-ink-500 mt-0.5">{user.clinicName}</p>}
        </div>
      </div>

      {/* Edit form */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white mb-2">Personal Information</h2>

        <div>
          <label className="label flex items-center gap-1.5"><UserCircle size={11} /> Full name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
        </div>

        <div>
          <label className="label flex items-center gap-1.5">
            <BadgeCheck size={11} />
            {user.role === 'doctor' ? 'Specialty' : user.role === 'pharmacist' ? 'Role / Occupation' : 'Title'}
          </label>
          <input
            className="input"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder={user.role === 'doctor' ? 'e.g. General Practice, Cardiology' : 'e.g. Clinical Pharmacist'}
          />
        </div>

        <div>
          <label className="label flex items-center gap-1.5"><Building2 size={11} /> Clinic / Hospital</label>
          <input className="input" value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="City General Hospital" />
        </div>

        <div>
          <label className="label flex items-center gap-1.5"><BadgeCheck size={11} /> License number</label>
          <input className="input" value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} placeholder="e.g. MD-2024-00123" />
        </div>

        {/* Read-only fields (future: phone, email after auth) */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-ink-700/40">
          <div>
            <label className="label flex items-center gap-1.5"><Phone size={11} /> Phone</label>
            <input className="input opacity-50 cursor-not-allowed" disabled placeholder="Coming in v0.2 (with auth)" />
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Mail size={11} /> Email</label>
            <input className="input opacity-50 cursor-not-allowed" disabled placeholder="Coming in v0.2 (with auth)" />
          </div>
        </div>

        <button type="button" onClick={save} className="btn-primary">
          <Save size={14} /> {saved ? 'Saved!' : 'Save changes'}
        </button>
      </div>

      <p className="text-[11px] text-ink-600 text-center">
        Full authentication (email/password, sessions, RBAC) ships in v0.2.
      </p>
    </div>
  );
}

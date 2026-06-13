import { useState, useEffect } from 'react';
import {
  Stethoscope, Pill, ShieldCheck, ArrowRight, Building2,
  Loader2, Search, Plus, ChevronLeft, MapPin, CheckCircle2, Mail, Lock,
} from 'lucide-react';
import { useAuthStore, type Role } from '@/store/auth';
import { MEDICAL_SPECIALTIES } from '@medaccess/shared';

const BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://localhost:4000' : '');

interface FacilityOption {
  id: string;
  name: string;
  city?: string;
  type: 'hospital' | 'clinic' | 'pharmacy';
  specialties: string[];
}

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
    icon: <Stethoscope size={26} strokeWidth={1.8} />,
    title: 'Doctor',
    desc: 'Review AI-generated patient reports, manage encounters and referrals.',
    color: 'text-accent-400',
    ring: 'ring-1 ring-accent-500/40 hover:ring-accent-500/70',
    bg: 'bg-accent-500/8 hover:bg-accent-500/12',
    specialtyLabel: 'Specialty',
    specialtyPlaceholder: 'e.g. General Practice, Cardiology',
  },
  {
    role: 'pharmacist',
    icon: <Pill size={26} strokeWidth={1.8} />,
    title: 'Pharmacist',
    desc: 'Receive and review prescription requests from MA Agent and doctors.',
    color: 'text-violet-400',
    ring: 'ring-1 ring-violet-500/40 hover:ring-violet-500/70',
    bg: 'bg-violet-500/8 hover:bg-violet-500/12',
    specialtyLabel: 'Role',
    specialtyPlaceholder: 'e.g. Clinical Pharmacist',
  },
  {
    role: 'admin',
    icon: <ShieldCheck size={26} strokeWidth={1.8} />,
    title: 'Admin',
    desc: 'Manage clinic staff, roles, settings and oversee the full patient flow.',
    color: 'text-amber-400',
    ring: 'ring-1 ring-amber-500/40 hover:ring-amber-500/70',
    bg: 'bg-amber-500/8 hover:bg-amber-500/12',
    specialtyLabel: 'Title',
    specialtyPlaceholder: 'e.g. Clinic Manager',
  },
];

const FACILITY_TYPES = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic',   label: 'Clinic' },
  { value: 'pharmacy', label: 'Pharmacy' },
] as const;

async function getBrowserCoords(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: 37.5665, lng: 126.9780 });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      ()  => resolve({ lat: 37.5665, lng: 126.9780 }),
      { timeout: 3000 },
    );
  });
}

type Mode = 'signin' | 'register';

export default function Login() {
  const doLogin    = useAuthStore((s) => s.login);
  const doRegister = useAuthStore((s) => s.register);

  const [mode, setMode] = useState<Mode>('signin');

  // Shared credentials
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');

  // Register: role + profile
  const [selected,  setSelected]  = useState<Role | null>(null);
  const card = ROLES.find((r) => r.role === selected);
  const [name,      setName]      = useState('');
  const [specialty, setSpecialty] = useState('');
  const [clinicName,setClinicName]= useState('');

  // Doctor-only bookable registration
  const [wantBookable, setWantBookable] = useState(false);
  const [facilityId,   setFacilityId]   = useState('');
  const [licenseNo,    setLicenseNo]    = useState('');

  // Facility picker
  const [facilities,        setFacilities]        = useState<FacilityOption[]>([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [facilitySearch,    setFacilitySearch]    = useState('');

  // New clinic sub-form
  const [showNewClinic,    setShowNewClinic]    = useState(false);
  const [newClinicName,    setNewClinicName]    = useState('');
  const [newClinicType,    setNewClinicType]    = useState<'hospital'|'clinic'|'pharmacy'>('clinic');
  const [newClinicCity,    setNewClinicCity]    = useState('');
  const [newClinicPhone,   setNewClinicPhone]   = useState('');
  const [newClinicSpecs,   setNewClinicSpecs]   = useState('');
  const [registeringClinic,setRegisteringClinic]= useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  // Load facilities when doctor toggles bookable
  useEffect(() => {
    if (!wantBookable || facilities.length > 0) return;
    setFacilitiesLoading(true);
    fetch(`${BASE}/api/facilities`)
      .then((r) => r.json())
      .then((d) => setFacilities(
        (d.facilities ?? []).map((f: any) => ({
          id: f.id ?? f._id, name: f.name, city: f.city, type: f.type, specialties: f.specialties ?? [],
        })),
      ))
      .catch(() => {})
      .finally(() => setFacilitiesLoading(false));
  }, [wantBookable, facilities.length]);

  async function handleRegisterClinic() {
    if (!newClinicName.trim()) { setError('Clinic name is required'); return; }
    setError('');
    setRegisteringClinic(true);
    try {
      const { lat, lng } = await getBrowserCoords();
      const res = await fetch(`${BASE}/api/facilities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClinicName.trim(), type: newClinicType,
          city: newClinicCity.trim() || undefined, phone: newClinicPhone.trim() || undefined,
          specialties: newClinicSpecs.trim() ? newClinicSpecs.split(',').map((s) => s.trim()).filter(Boolean) : [],
          lat, lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Registration failed');
      const nf: FacilityOption = {
        id: data.facility._id ?? data.facility.id, name: data.facility.name,
        city: data.facility.city, type: data.facility.type, specialties: data.facility.specialties ?? [],
      };
      setFacilities((prev) => [nf, ...prev]);
      setFacilityId(nf.id); setClinicName(nf.name); setShowNewClinic(false);
      setNewClinicName(''); setNewClinicType('clinic'); setNewClinicCity(''); setNewClinicPhone(''); setNewClinicSpecs('');
    } catch (err: any) {
      setError(err.message || 'Failed to register clinic');
    } finally {
      setRegisteringClinic(false);
    }
  }

  // ── Sign in ──────────────────────────────────────────────────────────────
  async function handleSignIn() {
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setError(''); setSubmitting(true);
    try {
      await doLogin(email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Create account ─────────────────────────────────────────────────────────
  async function handleRegister() {
    if (!selected) { setError('Select your role.'); return; }
    if (!name.trim())  { setError('Please enter your name.'); return; }
    if (!email.trim()) { setError('Please enter your email.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (selected === 'doctor' && !specialty.trim()) { setError('Please select your specialty.'); return; }
    setError(''); setSubmitting(true);

    try {
      let linkedDoctorId: string | undefined;
      let linkedFacilityId: string | undefined;

      // Optional: register the doctor as a bookable provider at a facility.
      if (selected === 'doctor' && wantBookable) {
        if (!facilityId.trim()) { setError('Select your clinic (or register it).'); setSubmitting(false); return; }
        const res = await fetch(`${BASE}/api/facilities/${facilityId}/doctors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(), specialty: specialty.trim(), facilityId: facilityId.trim(),
            licenseNo: licenseNo.trim() || undefined, email: email.trim() || undefined,
            languages: ['English'], consultationMinutes: 30,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || 'Could not register you as bookable');
        linkedDoctorId   = data.doctor?._id ?? data.doctor?.id;
        linkedFacilityId = facilityId.trim();
      }

      await doRegister({
        email:      email.trim(),
        password,
        name:       name.trim(),
        role:       selected,
        facilityId: linkedFacilityId,
        doctorId:   linkedDoctorId,
        specialty:  selected === 'doctor' ? specialty.trim() || undefined : undefined,
        occupation: selected !== 'doctor' ? specialty.trim() || undefined : undefined,
        clinicName: clinicName.trim() || undefined,
      });
      // On success the store sets user/token → AuthGuard routes to the dashboard.
    } catch (err: any) {
      setError(err.message || 'Could not create your account.');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedFacility = facilities.find((f) => f.id === facilityId);
  const filteredFacilities = facilities.filter((f) =>
    !facilitySearch ||
    f.name.toLowerCase().includes(facilitySearch.toLowerCase()) ||
    (f.city ?? '').toLowerCase().includes(facilitySearch.toLowerCase()),
  );

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-start sm:justify-center px-4 py-6 sm:py-12">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 shadow-glow">
          <Stethoscope size={22} strokeWidth={2.5} className="text-ink-950" />
        </div>
        <div>
          <div className="font-display text-xl text-white tracking-tight">MedAccess AI</div>
          <div className="text-xs text-ink-400">Clinical Portal · v0.1</div>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="mb-6 inline-flex rounded-xl border border-ink-700 bg-ink-900 p-1 text-sm">
        {(['signin', 'register'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(''); }}
            className={`px-5 py-2 rounded-lg font-medium transition ${
              mode === m ? 'bg-accent-500/20 text-accent-300 border border-accent-500/40' : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            {m === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      {/* ── Sign in ───────────────────────────────────────────────────── */}
      {mode === 'signin' && (
        <div className="w-full max-w-sm space-y-4">
          <div>
            <label className="label flex items-center gap-1.5"><Mail size={11} /> Email</label>
            <input className="input" type="email" autoComplete="email" placeholder="you@clinic.com"
              value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSignIn()} autoFocus />
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Lock size={11} /> Password</label>
            <input className="input" type="password" autoComplete="current-password" placeholder="••••••••"
              value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSignIn()} />
          </div>
          {error && <p className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-xs text-danger-400">{error}</p>}
          <button type="button" onClick={handleSignIn} disabled={submitting} className="btn-primary w-full justify-center">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-center text-xs text-ink-500">
            No account? <button type="button" className="text-accent-400 hover:underline" onClick={() => { setMode('register'); setError(''); }}>Create one</button>
          </p>
        </div>
      )}

      {/* ── Create account ────────────────────────────────────────────── */}
      {mode === 'register' && (
        <div className="w-full max-w-3xl">
          {!selected ? (
            <>
              <h1 className="font-display text-2xl text-white text-center mb-1 tracking-tight">Create your account</h1>
              <p className="text-sm text-ink-400 text-center mb-6">Select your role to continue</p>
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
                {ROLES.map((r) => (
                  <button key={r.role} type="button" onClick={() => setSelected(r.role)}
                    className={`relative text-left rounded-2xl border border-ink-700/60 p-5 sm:p-6 transition-all ${r.ring} ${r.bg} cursor-pointer flex sm:block items-center gap-4`}>
                    <div className={`mb-0 sm:mb-4 shrink-0 ${r.color}`}>{r.icon}</div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-white mb-1 sm:mb-2">{r.title}</h3>
                      <p className="text-xs leading-relaxed text-ink-300">{r.desc}</p>
                      <div className={`mt-2 sm:mt-4 flex items-center gap-1 text-xs font-medium ${r.color}`}>Select <ArrowRight size={12} /></div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="max-w-sm mx-auto">
              <button type="button" onClick={() => { setSelected(null); setError(''); setWantBookable(false); setFacilityId(''); }}
                className="text-xs text-ink-400 hover:text-white mb-6 flex items-center gap-1 transition">
                <ChevronLeft size={13} /> Change role
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
                  <input className="input" placeholder="Dr. Sarah Kim" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} autoFocus />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="label flex items-center gap-1.5"><Mail size={11} /> Email *</label>
                    <input className="input" type="email" autoComplete="email" placeholder="you@clinic.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
                  </div>
                  <div>
                    <label className="label flex items-center gap-1.5"><Lock size={11} /> Password *</label>
                    <input className="input" type="password" autoComplete="new-password" placeholder="At least 6 characters" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} />
                  </div>
                </div>

                <div>
                  <label className="label">{card?.specialtyLabel}</label>
                  {selected === 'doctor' ? (
                    <select className="input" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
                      <option value="">— Select specialty —</option>
                      {MEDICAL_SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <input className="input" placeholder={card?.specialtyPlaceholder} value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
                  )}
                </div>

                {selected !== 'doctor' && (
                  <div>
                    <label className="label flex items-center gap-1.5"><Building2 size={11} /> Hospital / Clinic</label>
                    <input className="input" placeholder="Seoul General Hospital" value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
                  </div>
                )}

                {/* Doctor: make bookable */}
                {selected === 'doctor' && (
                  <div className="rounded-2xl border border-ink-700/50 bg-ink-900/60 p-4 space-y-3">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <div className="relative mt-0.5">
                        <input type="checkbox" className="sr-only" checked={wantBookable} onChange={(e) => { setWantBookable(e.target.checked); setError(''); }} />
                        <div className={`h-5 w-5 rounded flex items-center justify-center border transition ${wantBookable ? 'bg-accent-500 border-accent-500' : 'border-ink-600 bg-ink-800'}`}>
                          {wantBookable && <CheckCircle2 size={13} className="text-white" strokeWidth={2.5} />}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Make me bookable by patients</p>
                        <p className="text-[11px] text-ink-500 mt-0.5 leading-relaxed">
                          {wantBookable ? 'You\'ll appear in patient search and they can book you. Your account is linked to this clinic.' : 'You can still review all incoming appointments for your clinic.'}
                        </p>
                      </div>
                    </label>

                    {wantBookable && (
                      <div className="space-y-3 pt-1 border-t border-ink-700/40">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Your clinic</p>
                        {facilitiesLoading && <div className="flex items-center gap-2 text-xs text-ink-400 py-2"><Loader2 size={12} className="animate-spin" /> Loading clinics…</div>}

                        {!facilitiesLoading && !showNewClinic && (
                          <>
                            <div className="relative">
                              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
                              <input className="input pl-7 text-xs h-9" placeholder="Search registered clinics…" value={facilitySearch} onChange={(e) => setFacilitySearch(e.target.value)} />
                            </div>
                            {filteredFacilities.length > 0 ? (
                              <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-ink-700 bg-ink-950 p-1">
                                {filteredFacilities.map((f) => (
                                  <button key={f.id} type="button" onClick={() => { setFacilityId(f.id); setClinicName(f.name); }}
                                    className={`w-full text-left rounded-lg px-3 py-2.5 text-xs transition ${facilityId === f.id ? 'bg-accent-500/20 border border-accent-500/40 text-white' : 'hover:bg-ink-800 text-ink-300'}`}>
                                    <div className="flex items-center gap-2">
                                      <Building2 size={11} className={facilityId === f.id ? 'text-accent-400' : 'text-ink-500'} />
                                      <span className="font-medium truncate">{f.name}</span>
                                    </div>
                                    <div className="mt-0.5 ml-[19px] text-ink-500 text-[10px]">
                                      {[f.type, f.city].filter(Boolean).join(' · ')}{f.specialties.length > 0 && ` · ${f.specialties.slice(0, 2).join(', ')}`}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-ink-500 py-1">{facilitySearch ? `No results for "${facilitySearch}"` : 'No clinics registered yet.'}</p>
                            )}
                            <button type="button" onClick={() => setShowNewClinic(true)} className="flex items-center gap-1.5 text-xs text-accent-400 hover:text-accent-300 transition">
                              <Plus size={12} /> Register my clinic
                            </button>
                          </>
                        )}

                        {!facilitiesLoading && showNewClinic && (
                          <div className="space-y-3 rounded-xl border border-accent-500/20 bg-ink-900/80 p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-white">Register your clinic</p>
                              <button type="button" onClick={() => { setShowNewClinic(false); setError(''); }} className="text-[10px] text-ink-500 hover:text-ink-200 transition">← Back to list</button>
                            </div>
                            <div>
                              <label className="label text-[10px]">Clinic / Hospital name *</label>
                              <input className="input h-9 text-sm" placeholder="Seoul Medical Center" value={newClinicName} onChange={(e) => setNewClinicName(e.target.value)} autoFocus />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="label text-[10px]">Type *</label>
                                <select className="input h-9 text-sm" value={newClinicType} onChange={(e) => setNewClinicType(e.target.value as any)}>
                                  {FACILITY_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="label text-[10px]">City</label>
                                <input className="input h-9 text-sm" placeholder="Seoul" value={newClinicCity} onChange={(e) => setNewClinicCity(e.target.value)} />
                              </div>
                            </div>
                            <div>
                              <label className="label text-[10px]">Phone</label>
                              <input className="input h-9 text-sm" placeholder="+82 2 0000 0000" value={newClinicPhone} onChange={(e) => setNewClinicPhone(e.target.value)} />
                            </div>
                            <div>
                              <label className="label text-[10px]">Specialties offered (comma-separated)</label>
                              <input className="input h-9 text-sm" placeholder="Cardiology, General Practice" value={newClinicSpecs} onChange={(e) => setNewClinicSpecs(e.target.value)} />
                            </div>
                            <p className="text-[10px] text-ink-500 flex items-center gap-1"><MapPin size={9} /> Location auto-detected from your browser</p>
                            <button type="button" onClick={handleRegisterClinic} disabled={registeringClinic}
                              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-accent-500/50 bg-accent-500/15 py-2 text-xs font-semibold text-accent-400 hover:bg-accent-500/25 transition disabled:opacity-50">
                              {registeringClinic ? <><Loader2 size={12} className="animate-spin" /> Registering…</> : <><Plus size={12} /> Register clinic</>}
                            </button>
                          </div>
                        )}

                        {selectedFacility && (
                          <div className="flex items-center gap-1.5 text-xs text-ok-400">
                            <CheckCircle2 size={12} /><span>Selected: <strong>{selectedFacility.name}</strong></span>
                          </div>
                        )}
                        {facilityId && (
                          <div>
                            <label className="label">License No.</label>
                            <input className="input h-9 text-sm" placeholder="KR-12345" value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {error && <p className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-xs text-danger-400">{error}</p>}

                <button type="button" onClick={handleRegister} disabled={submitting} className="btn-primary w-full justify-center mt-2">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                  {submitting ? 'Creating account…' : 'Create account & enter'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

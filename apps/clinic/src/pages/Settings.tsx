import { useState } from 'react';
import { Moon, Sun, LogOut, Building2, CheckCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useAppStore } from '@/store/app';

// Relative by default so requests ride the Vite dev proxy (/api → :4000) and work
// over the Cloudflare tunnel on phones. Override with VITE_API_BASE for a split deploy.
const BASE = import.meta.env.VITE_API_BASE || '';

const LANGUAGES = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'en',   label: 'English' },
  { code: 'uz',   label: 'Uzbek' },
  { code: 'ru',   label: 'Russian' },
  { code: 'es',   label: 'Spanish' },
  { code: 'hi',   label: 'Hindi' },
  { code: 'fr',   label: 'French' },
  { code: 'ko',   label: 'Korean' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6 space-y-4">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-white">{label}</p>
        {sub && <p className="text-[11px] text-ink-400 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const { language, setLanguage, theme, setTheme } = useAppStore();
  const { user, logout } = useAuthStore();

  // ── Clinic registration ────────────────────────────────────────────────────
  const [regName,         setRegName]         = useState(user?.clinicName || '');
  const [regType,         setRegType]         = useState('clinic');
  const [regAddress,      setRegAddress]      = useState('');
  const [regCity,         setRegCity]         = useState('');
  const [regCountry,      setRegCountry]      = useState('KR');
  const [regPhone,        setRegPhone]        = useState('');
  const [regSpecialties,  setRegSpecialties]  = useState(user?.specialty || '');
  const [regHours,        setRegHours]        = useState('Mon–Fri 09:00–18:00');
  const [regLat,          setRegLat]          = useState('');
  const [regLng,          setRegLng]          = useState('');
  const [regSubmitting,   setRegSubmitting]   = useState(false);
  const [regDone,         setRegDone]         = useState<string | null>(null);
  const [regError,        setRegError]        = useState('');
  const [showRegForm,     setShowRegForm]     = useState(false);

  async function handleRegister() {
    if (!regName.trim() || !regCity.trim()) {
      setRegError('Clinic name and city are required.');
      return;
    }
    setRegSubmitting(true);
    setRegError('');
    try {
      const body = new URLSearchParams({
        name:          regName.trim(),
        type:          regType,
        address:       regAddress.trim(),
        city:          regCity.trim(),
        country:       regCountry.trim(),
        phone:         regPhone.trim(),
        openingHours:  regHours.trim(),
        specialties:   regSpecialties.trim(),
        contactName:   user?.name || '',
        contactRole:   user?.role || 'doctor',
        doctorName:    user?.role === 'doctor' ? (user?.name || '') : '',
        doctorSpecialty: user?.specialty || '',
        ...(regLat ? { lat: regLat } : {}),
        ...(regLng ? { lng: regLng } : {}),
      });
      const res = await fetch(`${BASE}/api/register/clinic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setRegDone(data.message);
      setShowRegForm(false);
    } catch (err: any) {
      setRegError(err.message || 'Registration failed');
    } finally {
      setRegSubmitting(false);
    }
  }

  // Auto-fill GPS
  function fillGPS() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setRegLat(String(pos.coords.latitude.toFixed(6)));
      setRegLng(String(pos.coords.longitude.toFixed(6)));
    });
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-white">Settings</h1>

      <Section title="Language">
        <Row label="Portal language" sub="Affects the AI response language when set to a specific locale">
          <select
            className="input w-auto min-w-[160px]"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title="Notifications">
        <Row label="New referral alert" sub="Notify when a patient is referred via MA Agent">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" defaultChecked className="sr-only peer" />
            <div className="w-9 h-5 bg-ink-700 rounded-full peer peer-checked:bg-accent-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
          </label>
        </Row>
        <Row label="Urgent case alert" sub="Push notification for emergency + urgent cases">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" defaultChecked className="sr-only peer" />
            <div className="w-9 h-5 bg-ink-700 rounded-full peer peer-checked:bg-accent-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
          </label>
        </Row>
        <p className="text-[11px] text-ink-600">Push notifications require PWA install + browser permission. Coming fully in v0.2.</p>
      </Section>

      <Section title="Appearance">
        <Row label="Theme" sub={theme === 'light' ? 'Light mode active' : 'Dark mode active'}>
          <button
            type="button"
            role="switch"
            aria-checked={theme === 'light'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-ink-700 bg-ink-800 text-xs text-ink-300 hover:border-accent-500/50 transition"
          >
            {theme === 'light' ? <Sun size={13} className="text-amber-400" /> : <Moon size={13} />}
            {theme === 'light' ? 'Light' : 'Dark'}
          </button>
        </Row>
      </Section>

      <Section title="Account">
        <Row label="Role" sub={`Signed in as ${user?.name}`}>
          <span className="capitalize text-xs px-2.5 py-1 rounded-full bg-accent-500/15 text-accent-400 border border-accent-500/30">
            {user?.role}
          </span>
        </Row>
        <Row label="Authentication" sub="Email/password auth coming in v0.2">
          <span className="text-[11px] text-ink-500">v0.2</span>
        </Row>
        <div className="pt-2 border-t border-ink-700/40">
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition"
          >
            <LogOut size={14} /> Sign out of portal
          </button>
        </div>
      </Section>

      {/* ── Clinic Registration ─────────────────────────────────────────── */}
      <Section title="Register Your Clinic">
        <p className="text-[11px] text-ink-400 leading-relaxed">
          Register your clinic or hospital to appear in the MedAccess patient app (Find Care).
          Patients near you will see your clinic first and can book appointments directly.
        </p>

        {regDone ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-ok-500/30 bg-ok-500/10 px-3 py-3">
            <CheckCircle size={15} className="text-ok-400 shrink-0 mt-0.5" />
            <p className="text-xs text-ok-300">{regDone}</p>
          </div>
        ) : !showRegForm ? (
          <button
            type="button"
            onClick={() => setShowRegForm(true)}
            className="flex items-center gap-2 text-sm font-medium text-accent-400 hover:text-accent-300 transition"
          >
            <Building2 size={15} /> Register on MedAccess →
          </button>
        ) : (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Clinic / Hospital name *</label>
                <input className="input" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Seoul General Hospital" />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={regType} onChange={(e) => setRegType(e.target.value)}>
                  <option value="clinic">Clinic</option>
                  <option value="hospital">Hospital</option>
                  <option value="pharmacy">Pharmacy</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">City *</label>
                <input className="input" value={regCity} onChange={(e) => setRegCity(e.target.value)} placeholder="Seoul" />
              </div>
              <div>
                <label className="label">Country</label>
                <input className="input" value={regCountry} onChange={(e) => setRegCountry(e.target.value)} placeholder="KR" />
              </div>
            </div>

            <div>
              <label className="label">Address</label>
              <input className="input" value={regAddress} onChange={(e) => setRegAddress(e.target.value)} placeholder="123 Gangnam-daero, Gangnam-gu" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Phone</label>
                <input className="input" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="+82-2-1234-5678" />
              </div>
              <div>
                <label className="label">Opening hours</label>
                <input className="input" value={regHours} onChange={(e) => setRegHours(e.target.value)} placeholder="Mon–Fri 09:00–18:00" />
              </div>
            </div>

            <div>
              <label className="label">Specialties (comma-separated)</label>
              <input className="input" value={regSpecialties} onChange={(e) => setRegSpecialties(e.target.value)} placeholder="Dermatology, Internal Medicine, Pediatrics" />
            </div>

            <div>
              <label className="label">Location (GPS) — used for distance sorting</label>
              <div className="flex gap-2">
                <input className="input flex-1" value={regLat} onChange={(e) => setRegLat(e.target.value)} placeholder="Latitude (e.g. 37.5665)" />
                <input className="input flex-1" value={regLng} onChange={(e) => setRegLng(e.target.value)} placeholder="Longitude (e.g. 126.9780)" />
                <button type="button" onClick={fillGPS} className="btn shrink-0 text-xs">Use GPS</button>
              </div>
            </div>

            {regError && <p className="text-xs text-red-400">{regError}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleRegister}
                disabled={regSubmitting}
                className="btn-primary flex items-center gap-2"
              >
                {regSubmitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                {regSubmitting ? 'Registering…' : 'Register clinic'}
              </button>
              <button type="button" onClick={() => setShowRegForm(false)} className="btn text-xs">Cancel</button>
            </div>
            <p className="text-[10px] text-ink-600">Your clinic will appear in patient search immediately. Verification badge granted after manual review.</p>
          </div>
        )}
      </Section>

      <Section title="About">
        <div className="space-y-2 text-xs text-ink-400">
          <div className="flex justify-between"><span>Version</span><span className="text-ink-300">v0.1.0</span></div>
          <div className="flex justify-between"><span>LLM Provider</span><span className="text-ink-300">OpenRouter (Qwen 3.6 Plus)</span></div>
          <div className="flex justify-between"><span>RAG Corpus</span><span className="text-ink-300">31 clinical documents</span></div>
          <div className="flex justify-between"><span>Image ML</span><span className="text-ink-300">Python sidecar (Phase 1 in progress)</span></div>
        </div>
        <p className="text-[11px] text-ink-600 pt-2 border-t border-ink-700/40">
          MedAccess AI is a clinical decision-support copilot. It is not a certified medical device and does not replace clinical judgment.
        </p>
      </Section>
    </div>
  );
}

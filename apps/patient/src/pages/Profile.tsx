import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Save, ChevronLeft, Phone, Mail, AlertCircle, Heart, Cloud, HardDrive } from 'lucide-react';
import { useAppStore, type PatientProfile } from '@/store/app';
import { updateMyPatient } from '@/lib/api';
import { BLOOD_TYPES } from '@medaccess/shared';

const BLOOD_TYPE_OPTIONS = ['', ...BLOOD_TYPES] as const;

export default function Profile() {
  const navigate = useNavigate();
  const { patientProfile, setPatientProfile } = useAppStore();

  const p = patientProfile;
  const [fullName,              setFullName]              = useState(p?.fullName              || '');
  const [phone,                 setPhone]                 = useState(p?.phone                 || '');
  const [email,                 setEmail]                 = useState(p?.email                 || '');
  const [dob,                   setDob]                   = useState(p?.dob                   || '');
  const [sex,                   setSex]                   = useState(p?.sex                   || '');
  const [bloodType,             setBloodType]             = useState(p?.bloodType             || '');
  const [city,                  setCity]                  = useState(p?.city                  || '');
  const [country,               setCountry]               = useState(p?.country               || '');
  const [knownAllergies,        setKnownAllergies]        = useState(p?.knownAllergies        || '');
  const [chronicConditions,     setChronicConditions]     = useState(p?.chronicConditions     || '');
  const [currentMedications,    setCurrentMedications]    = useState(p?.currentMedications    || '');
  const [emergencyContactName,  setEmergencyContactName]  = useState(p?.emergencyContactName  || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(p?.emergencyContactPhone || '');
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    const profile: PatientProfile = {
      fullName:               fullName.trim(),
      phone:                  phone.trim()                 || undefined,
      email:                  email.trim()                 || undefined,
      dob:                    dob                          || undefined,
      sex:                    (sex as PatientProfile['sex']) || undefined,
      bloodType:              (bloodType as PatientProfile['bloodType']) || undefined,
      city:                   city.trim()                  || undefined,
      country:                country.trim()               || undefined,
      knownAllergies:         knownAllergies.trim()        || undefined,
      chronicConditions:      chronicConditions.trim()     || undefined,
      currentMedications:     currentMedications.trim()    || undefined,
      emergencyContactName:   emergencyContactName.trim()  || undefined,
      emergencyContactPhone:  emergencyContactPhone.trim() || undefined,
    };

    // Always save locally first
    setPatientProfile(profile);

    // Sync to server if phone identity is established
    const phoneKey = phone.trim();
    if (phoneKey) {
      updateMyPatient(phoneKey, {
        fullName:          profile.fullName,
        email:             profile.email,
        dateOfBirth:       profile.dob,
        sex:               profile.sex,
        bloodType:         profile.bloodType as any,
        city:              profile.city,
        country:           profile.country,
        knownAllergies:    profile.knownAllergies ? [profile.knownAllergies] : [],
        chronicConditions: profile.chronicConditions ? [profile.chronicConditions] : [],
        currentMedications: profile.currentMedications ? [profile.currentMedications] : [],
        emergencyContact:  profile.emergencyContactName
          ? {
              name:         profile.emergencyContactName,
              phone:        profile.emergencyContactPhone ?? '',
              relationship: 'Emergency contact',
            }
          : undefined,
      }).catch(() => { /* non-fatal — local save is the source of truth */ });
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">{title}</p>
        <div className="space-y-3">{children}</div>
      </div>
    );
  }

  function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
    return (
      <div>
        <label className="label">{label}</label>
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-ink-700 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink-700 text-ink-400 hover:text-white transition"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-white">My Profile</h2>
          <p className="text-xs text-ink-500 mt-0.5 flex items-center gap-1.5">
            {patientProfile?.phone
              ? <><Cloud size={10} className="text-ok-400" /> Synced to server</>
              : <><HardDrive size={10} /> Local only</>}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
            saved
              ? 'bg-ok-500/20 border border-ok-500/40 text-ok-400'
              : 'btn-primary'
          }`}
        >
          <Save size={13} />
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      {/* Avatar */}
      <div className="shrink-0 flex flex-col items-center py-5 border-b border-ink-700">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/30 to-brand-700/30 border border-brand-500/30 text-2xl font-bold text-brand-400">
          {fullName.trim() ? fullName.trim()[0].toUpperCase() : <User size={28} />}
        </div>
        {fullName && <p className="mt-2 text-sm font-semibold text-white">{fullName}</p>}
        <p className="text-xs text-ink-500 mt-0.5">Patient</p>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">

        <Section title="Identity">
          <Field label="Full name *">
            <input className="input" placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of birth">
              <input className="input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </Field>
            <Field label="Sex">
              <select className="input" value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Blood type">
              <select className="input" value={bloodType} onChange={(e) => setBloodType(e.target.value)}>
                {BLOOD_TYPE_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b || '—'}</option>
                ))}
              </select>
            </Field>
            <Field label="Country">
              <input className="input" placeholder="KR" value={country} onChange={(e) => setCountry(e.target.value)} />
            </Field>
          </div>
          <Field label="City">
            <input className="input" placeholder="Your city" value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
        </Section>

        <Section title="Contact">
          <Field label={<span className="flex items-center gap-1"><Phone size={11} /> Phone</span>}>
            <input className="input" type="tel" placeholder="+82 10 0000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label={<span className="flex items-center gap-1"><Mail size={11} /> Email</span>}>
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </Section>

        <Section title="Medical history">
          <p className="text-[11px] text-ink-500">Shared with doctor when you book an appointment.</p>
          <Field label={<span className="flex items-center gap-1"><AlertCircle size={11} /> Known allergies</span>}>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="e.g. Penicillin, peanuts"
              value={knownAllergies}
              onChange={(e) => setKnownAllergies(e.target.value)}
            />
          </Field>
          <Field label={<span className="flex items-center gap-1"><Heart size={11} /> Chronic conditions</span>}>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="e.g. Type 2 diabetes, hypertension"
              value={chronicConditions}
              onChange={(e) => setChronicConditions(e.target.value)}
            />
          </Field>
          <Field label="Current medications">
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="e.g. Metformin 500mg, Aspirin 100mg"
              value={currentMedications}
              onChange={(e) => setCurrentMedications(e.target.value)}
            />
          </Field>
        </Section>

        <Section title="Emergency contact">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <input className="input" placeholder="Contact name" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} />
            </Field>
            <Field label="Phone">
              <input className="input" type="tel" placeholder="+82 10…" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} />
            </Field>
          </div>
        </Section>

        <div className="rounded-xl border border-ink-700 bg-ink-800 px-4 py-3">
          <p className="text-[11px] text-ink-500 leading-relaxed">
            <span className="text-ink-400 font-medium">Privacy:</span> Profile data is saved locally and, when your phone number is set, synced to our server so your medical history is available to doctors you book with. No passwords, no accounts.
          </p>
        </div>

        <div className="pb-4">
          <button type="button" onClick={handleSave} className="btn-primary w-full justify-center">
            <Save size={14} />
            {saved ? 'Profile saved!' : 'Save profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

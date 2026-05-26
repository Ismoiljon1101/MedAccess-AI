import { useState } from 'react';
import { MapPin, Phone, Clock, Star, ChevronRight, Navigation, Stethoscope, AlertCircle } from 'lucide-react';

interface Clinic {
  id: string;
  name: string;
  specialty: string[];
  distance: string;
  address: string;
  phone: string;
  hours: string;
  rating: number;
  available: boolean;
  waitTime?: string;
}

// Seed data — will be replaced by real API once clinic DB is built
const SEED_CLINICS: Clinic[] = [
  {
    id: 'c1',
    name: 'City General Outpatient',
    specialty: ['General Practice', 'Internal Medicine'],
    distance: '0.8 km',
    address: '14 Hospital Road',
    phone: '+1-800-555-0101',
    hours: 'Mon–Fri 8am–6pm',
    rating: 4.5,
    available: true,
    waitTime: '~15 min',
  },
  {
    id: 'c2',
    name: 'MedQuick Urgent Care',
    specialty: ['Urgent Care', 'Minor Injuries'],
    distance: '1.2 km',
    address: '88 Central Ave',
    phone: '+1-800-555-0102',
    hours: 'Daily 7am–10pm',
    rating: 4.2,
    available: true,
    waitTime: '~30 min',
  },
  {
    id: 'c3',
    name: 'Primary Health Clinic',
    specialty: ['Family Medicine', 'Pediatrics', 'Womens Health'],
    distance: '2.1 km',
    address: '5 Green Street',
    phone: '+1-800-555-0103',
    hours: 'Mon–Sat 9am–5pm',
    rating: 4.7,
    available: false,
  },
  {
    id: 'c4',
    name: 'District Hospital A&E',
    specialty: ['Emergency', 'All Specialties'],
    distance: '3.4 km',
    address: '1 District Boulevard',
    phone: '+1-800-555-0104',
    hours: '24 / 7',
    rating: 4.0,
    available: true,
    waitTime: '~45 min',
  },
];

const SPECIALTIES = [
  'All', 'General Practice', 'Urgent Care', 'Emergency',
  'Pediatrics', 'Womens Health', 'Mental Health',
];

export default function FindCare() {
  const [filter, setFilter] = useState('All');
  const [locationRequested, setLocationRequested] = useState(false);

  const filtered = filter === 'All'
    ? SEED_CLINICS
    : SEED_CLINICS.filter((c) => c.specialty.some((s) => s.includes(filter)));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-surface-700">
        <h2 className="text-base font-semibold text-white">Find Care Near You</h2>
        <p className="text-xs text-slate-500 mt-0.5">Clinics and urgent care facilities</p>
      </div>

      {/* Location banner */}
      {!locationRequested && (
        <div className="shrink-0 mx-3 mt-3 rounded-xl border border-brand-500/25 bg-brand-500/10 px-3 py-2.5 flex items-center gap-2.5">
          <Navigation size={14} className="text-brand-400 shrink-0" />
          <p className="text-xs text-slate-300 flex-1">
            Enable location for accurate nearby results
          </p>
          <button
            type="button"
            onClick={() => {
              navigator.geolocation?.getCurrentPosition(() => setLocationRequested(true));
              setLocationRequested(true);
            }}
            className="text-[11px] font-semibold text-brand-400 whitespace-nowrap"
          >
            Allow
          </button>
        </div>
      )}

      {/* Coming soon note */}
      <div className="shrink-0 mx-3 mt-2 rounded-xl border border-warn-500/20 bg-warn-500/8 px-3 py-2 flex items-start gap-2">
        <AlertCircle size={13} className="text-warn-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-warn-400">
          Live clinic availability & booking coming soon. Showing demo data.
        </p>
      </div>

      {/* Specialty filter */}
      <div className="shrink-0 flex gap-2 px-3 pt-3 pb-2 overflow-x-auto scrollbar-none">
        {SPECIALTIES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors border ${
              filter === s
                ? 'border-brand-500 bg-brand-600/20 text-brand-400'
                : 'border-surface-600 bg-surface-800 text-slate-500'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Clinic list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2.5">
        {filtered.map((clinic) => (
          <div key={clinic.id} className="card p-4 flex flex-col gap-3">
            {/* Top row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${clinic.available ? 'bg-ok-500' : 'bg-slate-600'}`} />
                  <h3 className="text-sm font-semibold text-white truncate">{clinic.name}</h3>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {clinic.specialty.map((s) => (
                    <span key={s} className="inline-flex items-center rounded-full bg-surface-700 px-2 py-0.5 text-[10px] text-slate-400">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0 gap-1">
                <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
                  <MapPin size={11} /> {clinic.distance}
                </span>
                <span className="flex items-center gap-0.5 text-[11px] text-ok-400">
                  <Star size={10} fill="currentColor" /> {clinic.rating}
                </span>
              </div>
            </div>

            {/* Info row */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><Clock size={11} /> {clinic.hours}</span>
              {clinic.waitTime && (
                <span className="flex items-center gap-1 text-ok-400">
                  <Stethoscope size={11} /> Wait {clinic.waitTime}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <a
                href={`tel:${clinic.phone}`}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-surface-600 bg-surface-700 py-2 text-xs font-medium text-slate-300 transition hover:border-brand-500/50"
              >
                <Phone size={13} /> Call
              </a>
              <button
                type="button"
                disabled
                title="Booking coming soon"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-brand-500/40 bg-brand-600/15 py-2 text-xs font-medium text-brand-400 opacity-60 cursor-not-allowed"
              >
                Book Appointment <ChevronRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

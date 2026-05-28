import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin, Phone, Clock, Star, ChevronRight, Navigation, Stethoscope, Loader2, CheckCircle, X, Map } from 'lucide-react';
import { searchClinics, createReferral, type ClinicResult } from '@/lib/api';
import { useAppStore } from '@/store/app';

type MapProvider = 'google' | 'naver';

function getNavUrl(provider: MapProvider, clinicName: string): string {
  const q = encodeURIComponent(clinicName);
  if (provider === 'naver') return `https://map.naver.com/v5/search/${q}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

const SPECIALTIES = ['All', 'General Practice', 'Urgent Care', 'Emergency', 'Cardiology', 'Neurology', 'Pediatrics', 'Mental Health', 'Respiratory'];

interface BookingState {
  clinicId: string;
  clinicName: string;
  specialty: string;
}

export default function FindCare() {
  const { chatHistory } = useAppStore();
  const [searchParams] = useSearchParams();

  // Pre-fill specialty from query param (set by MA Agent CTA)
  const preSpecialty = searchParams.get('specialty') || 'All';
  const preSessionId = searchParams.get('s') || undefined;
  const preSummary   = searchParams.get('summary') || '';
  const preUrgency   = searchParams.get('urgency') || 'see-clinician-soon';

  const [mapProvider, setMapProvider]  = useState<MapProvider>('google');
  const [filter, setFilter]           = useState(preSpecialty);
  const [clinics, setClinics]         = useState<ClinicResult[]>([]);
  const [loading, setLoading]         = useState(false);
  const [locationDone, setLocationDone] = useState(false);
  const [coords, setCoords]           = useState<{ lat: number; lng: number } | null>(null);
  const [booking, setBooking]         = useState<BookingState | null>(null);
  const [booked, setBooked]           = useState(false);
  const [bookError, setBookError]     = useState('');

  // Booking form state
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [preferred, setPreferred] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadClinics(lat?: number, lng?: number, specialty?: string) {
    setLoading(true);
    try {
      const results = await searchClinics({
        lat,
        lng,
        specialty: specialty && specialty !== 'All' ? specialty : undefined,
      });
      setClinics(results);
    } catch {
      setClinics([]);
    } finally {
      setLoading(false);
    }
  }

  function requestLocation() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        setLocationDone(true);
        loadClinics(latitude, longitude, filter);
      },
      () => {
        setLocationDone(true);
        loadClinics(undefined, undefined, filter);
      },
      { timeout: 6000 }
    );
  }

  useEffect(() => {
    loadClinics(undefined, undefined, filter);
  }, []);

  function handleFilterChange(s: string) {
    setFilter(s);
    loadClinics(coords?.lat, coords?.lng, s);
  }

  async function handleBook() {
    if (!booking || !name.trim()) { setBookError('Please enter your name.'); return; }
    setSubmitting(true);
    setBookError('');

    // Get latest chat summary from history
    const session = chatHistory.find((h) => h.sessionId === preSessionId);
    const summary = preSummary || session?.preview || 'Patient referred via MA Agent';

    try {
      await createReferral({
        sessionId:    preSessionId,
        patientName:  name.trim(),
        patientPhone: phone.trim() || undefined,
        clinicId:     booking.clinicId,
        clinicName:   booking.clinicName,
        specialty:    booking.specialty,
        urgency:      preUrgency as any,
        summary,
        preferredTime: preferred.trim() || undefined,
      });
      setBooked(true);
      setBooking(null);
    } catch (e: any) {
      setBookError(e.message || 'Failed to send request. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-surface-700">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-white">Find Care Near You</h2>
            <p className="text-xs text-slate-500 mt-0.5">Clinics and urgent care facilities</p>
          </div>
          {/* Map provider picker */}
          <div className="flex items-center gap-1 rounded-lg border border-surface-600 bg-surface-800 p-0.5">
            <button
              type="button"
              onClick={() => setMapProvider('google')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition ${
                mapProvider === 'google'
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-500/40'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Map size={10} /> Google
            </button>
            <button
              type="button"
              onClick={() => setMapProvider('naver')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition ${
                mapProvider === 'naver'
                  ? 'bg-ok-500/20 text-ok-400 border border-ok-500/40'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Map size={10} /> Naver
            </button>
          </div>
        </div>
      </div>

      {/* Location banner */}
      {!locationDone && (
        <div className="shrink-0 mx-3 mt-3 rounded-xl border border-brand-500/25 bg-brand-500/10 px-3 py-2.5 flex items-center gap-2.5">
          <Navigation size={14} className="text-brand-400 shrink-0" />
          <p className="text-xs text-slate-300 flex-1">Enable location for accurate distance sorting</p>
          <button type="button" onClick={requestLocation} className="text-[11px] font-semibold text-brand-400 whitespace-nowrap">
            Allow
          </button>
        </div>
      )}

      {/* MA Agent referral context */}
      {(preSpecialty !== 'All' || preSummary) && (
        <div className="shrink-0 mx-3 mt-2 rounded-xl border border-ok-500/20 bg-ok-500/8 px-3 py-2">
          <p className="text-[11px] text-ok-400 font-medium">MA Agent recommendation</p>
          {preSpecialty !== 'All' && (
            <p className="text-[11px] text-slate-400 mt-0.5">Suggested specialty: <span className="text-white font-medium">{preSpecialty}</span></p>
          )}
          {preSummary && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{preSummary}</p>}
        </div>
      )}

      {/* Booking success */}
      {booked && (
        <div className="shrink-0 mx-3 mt-2 rounded-xl border border-ok-500/30 bg-ok-500/10 px-3 py-3 flex items-center gap-2.5">
          <CheckCircle size={16} className="text-ok-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-ok-400">Appointment requested!</p>
            <p className="text-[11px] text-slate-400 mt-0.5">The clinic will contact you to confirm. Your report has been sent.</p>
          </div>
        </div>
      )}

      {/* Specialty filter */}
      <div className="shrink-0 flex gap-2 px-3 pt-3 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {SPECIALTIES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleFilterChange(s)}
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
        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Loading clinics…
          </div>
        )}

        {!loading && clinics.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <p className="text-sm text-slate-500">No clinics found for this specialty.</p>
            <button type="button" onClick={() => handleFilterChange('All')} className="text-xs text-brand-400">Show all</button>
          </div>
        )}

        {!loading && clinics.map((clinic) => (
          <div key={clinic.id} className="card p-4 flex flex-col gap-3">
            {/* Top row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${clinic.available ? 'bg-ok-500' : 'bg-slate-600'}`} />
                  <h3 className="text-sm font-semibold text-white truncate">{clinic.name}</h3>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {clinic.specialty.slice(0, 3).map((s) => (
                    <span key={s} className="inline-flex items-center rounded-full bg-surface-700 px-2 py-0.5 text-[10px] text-slate-400">{s}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0 gap-1">
                <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
                  <MapPin size={11} /> {clinic.distanceLabel}
                </span>
                <span className="flex items-center gap-0.5 text-[11px] text-ok-400">
                  <Star size={10} fill="currentColor" /> {clinic.rating}
                </span>
              </div>
            </div>

            {/* Info row */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><Clock size={11} /> {clinic.hours}</span>
              {clinic.waitMinutes != null && (
                <span className="flex items-center gap-1 text-ok-400">
                  <Stethoscope size={11} /> Wait ~{clinic.waitMinutes} min
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <a
                href={`tel:${clinic.phone}`}
                className="flex items-center justify-center gap-1 rounded-xl border border-surface-600 bg-surface-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-brand-500/50"
              >
                <Phone size={13} />
              </a>
              <a
                href={getNavUrl(mapProvider, clinic.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 rounded-xl border border-surface-600 bg-surface-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-brand-500/50"
                title={`Open in ${mapProvider === 'naver' ? 'Naver Maps' : 'Google Maps'}`}
              >
                <Navigation size={13} />
              </a>
              <button
                type="button"
                disabled={!clinic.available}
                onClick={() => { setBooking({ clinicId: clinic.id, clinicName: clinic.name, specialty: clinic.specialty[0] }); setBooked(false); }}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-medium transition ${
                  clinic.available
                    ? 'border-brand-500/40 bg-brand-600/15 text-brand-400 hover:bg-brand-600/25'
                    : 'border-surface-600 bg-surface-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                {clinic.available ? 'Book' : 'Unavailable'} <ChevronRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Booking sheet */}
      {booking && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setBooking(null)}>
          <div
            className="w-full rounded-t-2xl bg-surface-900 border-t border-surface-700 p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Request Appointment</p>
                <p className="text-xs text-slate-500 mt-0.5">{booking.clinicName} · {booking.specialty}</p>
              </div>
              <button type="button" onClick={() => setBooking(null)} className="text-slate-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">Your name *</label>
                <input
                  className="input"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Phone number</label>
                <input
                  className="input"
                  placeholder="+1 555 000 0000"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Preferred time</label>
                <input
                  className="input"
                  placeholder="e.g. Tomorrow morning, ASAP"
                  value={preferred}
                  onChange={(e) => setPreferred(e.target.value)}
                />
              </div>
            </div>

            {bookError && (
              <p className="text-xs text-danger-400">{bookError}</p>
            )}

            <button
              type="button"
              onClick={handleBook}
              disabled={submitting}
              className="btn-primary w-full justify-center"
            >
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : 'Send Appointment Request'}
            </button>

            <p className="text-[10px] text-slate-600 text-center">
              Your MA Agent report will be sent to the clinic with this request.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

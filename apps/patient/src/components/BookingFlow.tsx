import { useState, useEffect, useCallback } from 'react';
import {
  Building2, MapPin, Clock, CheckCircle, Loader2, X,
  ChevronLeft, CalendarDays, Stethoscope, Globe,
} from 'lucide-react';
import {
  searchFacilities, getFacilitySlots, bookAppointment,
  type FacilityResult, type DoctorResult, type SlotResult,
} from '@/lib/api';

interface BookingFlowProps {
  specialty: string;
  urgency?: string;
  lat?: number;
  lng?: number;
  patientPhone?: string;
  sessionId?: string;
  /** Rich, clinician-facing summary attached to the appointment. */
  agentSummary: string;
  /** When the agent suggested a specific doctor (<<BOOK>> marker), preselect that clinic. */
  preferredDoctorId?: string;
  preferredFacilityId?: string;
  onBooked: (result: { date: string; time: string; doctorName: string; facilityName: string }) => void;
  onClose: () => void;
}

type Step = 'clinic' | 'time' | 'booking' | 'done';

// Next 7 calendar days, excluding Sundays (clinics closed) — matches server slot rules.
function upcomingDates(count = 6): { value: string; label: string; weekday: string }[] {
  const out: { value: string; label: string; weekday: string }[] = [];
  const d = new Date();
  for (let i = 1; out.length < count && i <= 10; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    if (day.getDay() === 0) continue; // Sunday — closed
    out.push({
      value:   day.toISOString().slice(0, 10),
      label:   day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      weekday: day.toLocaleDateString(undefined, { weekday: 'short' }),
    });
  }
  return out;
}

function matchingDoctor(f: FacilityResult, specialty: string, preferredDoctorId?: string): DoctorResult | undefined {
  if (preferredDoctorId) {
    const exact = f.doctors.find((d) => d.id === preferredDoctorId);
    if (exact) return exact;
  }
  return (
    f.doctors.find((d) => d.specialty.toLowerCase().includes(specialty.toLowerCase())) ??
    f.doctors[0]
  );
}

export default function BookingFlow(props: BookingFlowProps) {
  const { specialty, urgency, lat, lng, patientPhone, sessionId, agentSummary,
          preferredDoctorId, preferredFacilityId, onBooked, onClose } = props;

  const [step, setStep]           = useState<Step>('clinic');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [facilities, setFacilities] = useState<FacilityResult[]>([]);

  const [facility, setFacility]   = useState<FacilityResult | null>(null);
  const [doctor, setDoctor]       = useState<DoctorResult | null>(null);

  const dates = upcomingDates();
  const [date, setDate]           = useState<string>(dates[0]?.value ?? '');
  const [slots, setSlots]         = useState<SlotResult[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot]           = useState<SlotResult | null>(null);

  // ── Load clinics for this specialty near the patient ──────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchFacilities({ specialty, lat, lng, radius: 100 })
      .then((list) => {
        if (cancelled) return;
        // keep only clinics that actually have a usable doctor
        const usable = list.filter((f) => matchingDoctor(f, specialty, preferredDoctorId));
        setFacilities(usable);
        // Auto-advance if the agent already named a clinic
        const pre = preferredFacilityId
          ? usable.find((f) => f.id === preferredFacilityId)
          : undefined;
        if (pre) selectFacility(pre);
        else if (usable.length === 0) setError('No in-network clinics found for this specialty nearby.');
      })
      .catch((e) => { if (!cancelled) setError(e.message || 'Could not load clinics'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialty]);

  // ── Load slots whenever doctor or date changes ────────────────────────
  const loadSlots = useCallback(async (f: FacilityResult, d: DoctorResult, dateStr: string) => {
    setSlotsLoading(true);
    setSlot(null);
    try {
      const res = await getFacilitySlots(f.id, d.id, dateStr);
      setSlots(res.slots);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  function selectFacility(f: FacilityResult) {
    const d = matchingDoctor(f, specialty, preferredDoctorId);
    if (!d) return;
    setFacility(f);
    setDoctor(d);
    setStep('time');
    const firstDate = dates[0]?.value ?? '';
    setDate(firstDate);
    loadSlots(f, d, firstDate);
  }

  function pickDate(dateStr: string) {
    setDate(dateStr);
    if (facility && doctor) loadSlots(facility, doctor, dateStr);
  }

  async function confirm() {
    if (!facility || !doctor || !slot) return;
    setStep('booking');
    setError(null);
    try {
      const result = await bookAppointment({
        patientPhone,
        doctorId:      doctor.id,
        facilityId:    facility.id,
        scheduledDate: date,
        scheduledTime: slot.startTime,
        specialty,
        urgency:       urgency || 'see-clinician-soon',
        agentSummary,
        sessionId,
      });
      setStep('done');
      onBooked({
        date: result.scheduledDate,
        time: result.scheduledTime,
        doctorName: doctor.name,
        facilityName: facility.name,
      });
    } catch (e: any) {
      setError(e.message || 'Booking failed. Please try another time.');
      setStep('time');
    }
  }

  return (
    <div className="shrink-0 mx-3 mb-1 rounded-2xl border border-brand-500/40 bg-gradient-to-b from-brand-500/12 to-brand-500/[0.04] backdrop-blur-sm shadow-lg shadow-brand-900/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-brand-500/15">
        <div className="flex items-center gap-2 min-w-0">
          {step === 'time' && !preferredFacilityId && (
            <button
              type="button"
              onClick={() => { setStep('clinic'); setFacility(null); setDoctor(null); }}
              aria-label="Back to clinics"
              className="-ml-1 rounded-full p-1 text-ink-400 hover:text-ink-100 hover:bg-ink-700/60 transition"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <Stethoscope size={15} className="text-brand-400 shrink-0" />
          <p className="text-xs font-semibold text-brand-300 uppercase tracking-wide truncate">
            {step === 'done' ? 'Appointment Booked' : `Book ${specialty}`}
          </p>
        </div>
        {step !== 'done' && step !== 'booking' && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close booking"
            className="rounded-full p-1 text-ink-500 hover:text-ink-200 hover:bg-ink-700/60 transition"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="px-4 py-3">
        {/* Error */}
        {error && step !== 'booking' && (
          <div className="mb-2.5 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[11px] text-danger-400">
            {error}
          </div>
        )}

        {/* ── Step: pick clinic ─────────────────────────────────────── */}
        {step === 'clinic' && (
          <>
            {loading ? (
              <div className="flex items-center gap-2 py-6 justify-center text-xs text-ink-400">
                <Loader2 size={14} className="animate-spin" /> Finding clinics near you…
              </div>
            ) : facilities.length === 0 && !error ? (
              <p className="py-4 text-center text-xs text-ink-400">No clinics available.</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto -mx-1 px-1">
                {facilities.map((f) => {
                  const d = matchingDoctor(f, specialty, preferredDoctorId)!;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => selectFacility(f)}
                      className="w-full text-left rounded-xl border border-ink-700/70 bg-ink-800/50 px-3 py-2.5 hover:border-brand-500/50 hover:bg-brand-500/[0.06] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                            <Building2 size={13} className="text-brand-400 shrink-0" /> {f.name}
                          </p>
                          <p className="text-[11px] text-ink-300 mt-0.5 truncate">
                            {d.name} · {d.specialty}
                          </p>
                          {f.address && (
                            <p className="text-[10px] text-ink-500 mt-0.5 truncate flex items-center gap-1">
                              <MapPin size={9} className="shrink-0" /> {f.address}
                            </p>
                          )}
                          {d.languages?.length > 0 && (
                            <p className="text-[10px] text-ink-500 mt-0.5 truncate flex items-center gap-1">
                              <Globe size={9} className="shrink-0" /> {d.languages.join(', ')}
                            </p>
                          )}
                        </div>
                        {f.distanceKm != null && (
                          <span className="shrink-0 text-[10px] font-medium text-brand-400 bg-brand-500/10 rounded-full px-2 py-0.5">
                            {f.distanceKm.toFixed(1)} km
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Step: pick date + time ────────────────────────────────── */}
        {step === 'time' && facility && doctor && (
          <>
            <div className="mb-2.5">
              <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Building2 size={13} className="text-brand-400 shrink-0" /> {facility.name}
              </p>
              <p className="text-[11px] text-ink-300 mt-0.5">{doctor.name} · {doctor.specialty}</p>
            </div>

            {/* Date selector */}
            <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto -mx-1 px-1 pb-1">
              <CalendarDays size={13} className="text-ink-500 shrink-0" />
              {dates.map((dt) => (
                <button
                  key={dt.value}
                  type="button"
                  onClick={() => pickDate(dt.value)}
                  className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-center transition ${
                    date === dt.value
                      ? 'border-brand-500/60 bg-brand-500/15 text-brand-300'
                      : 'border-ink-700 bg-ink-800/60 text-ink-400 hover:border-ink-500'
                  }`}
                >
                  <span className="block text-[9px] uppercase tracking-wide opacity-70">{dt.weekday}</span>
                  <span className="block text-xs font-semibold">{dt.label}</span>
                </button>
              ))}
            </div>

            {/* Slots */}
            {slotsLoading ? (
              <div className="flex items-center gap-2 py-5 justify-center text-xs text-ink-400">
                <Loader2 size={14} className="animate-spin" /> Loading times…
              </div>
            ) : slots.length === 0 ? (
              <p className="py-4 text-center text-xs text-ink-500">No open times this day — try another date.</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto">
                {slots.map((s) => (
                  <button
                    key={s.startTime}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={`rounded-lg border py-1.5 text-xs font-medium transition ${
                      slot?.startTime === s.startTime
                        ? 'border-brand-500/70 bg-brand-500/20 text-brand-200'
                        : 'border-ink-700 bg-ink-800/60 text-ink-300 hover:border-brand-500/40'
                    }`}
                  >
                    {s.startTime}
                  </button>
                ))}
              </div>
            )}

            {/* Confirm */}
            <button
              type="button"
              disabled={!slot || !patientPhone}
              onClick={confirm}
              className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl border border-brand-500/50 bg-brand-600/25 py-2.5 text-xs font-semibold text-brand-200 hover:bg-brand-600/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <Clock size={13} />
              {!patientPhone
                ? 'Sign in to book'
                : slot
                  ? `Confirm ${date} at ${slot.startTime}`
                  : 'Select a time'}
            </button>
          </>
        )}

        {/* ── Step: booking in flight ───────────────────────────────── */}
        {step === 'booking' && (
          <div className="flex items-center gap-2 py-6 justify-center text-xs text-ink-300">
            <Loader2 size={15} className="animate-spin text-brand-400" /> Booking your appointment…
          </div>
        )}

        {/* ── Step: done ────────────────────────────────────────────── */}
        {step === 'done' && facility && doctor && (
          <div className="flex items-start gap-3 py-1">
            <CheckCircle size={20} className="text-ok-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{doctor.name}</p>
              <p className="text-[11px] text-ink-300">{facility.name}</p>
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-ok-500/30 bg-ok-500/10 px-2.5 py-1">
                <CalendarDays size={11} className="text-ok-400" />
                <span className="text-xs font-medium text-ok-300">{date} · {slot?.startTime}</span>
              </div>
              <p className="text-[10px] text-ink-500 mt-2">
                The clinic received your AI health summary and will confirm shortly. Track it under My Records.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto shrink-0 rounded-full p-1 text-ink-500 hover:text-ink-200 transition"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

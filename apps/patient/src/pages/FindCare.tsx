/**
 * FindCare — find hospitals/clinics/pharmacies near you and book a time slot.
 *
 * Flow:
 *  1. Browse facilities (filter by type / specialty / city)
 *  2. Tap facility → expand to see doctor list
 *  3. Tap "Book" on a doctor → date + slot picker sheet
 *  4. Fill patient info → confirm → appointment stored locally
 */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MapPin, Phone, Clock, ChevronRight, ChevronDown, Navigation,
  Loader2, CheckCircle, X, Stethoscope, Pill, Building2,
  Calendar, User, Map, ShieldCheck, List,
} from 'lucide-react';
import {
  searchFacilities, getFacilitySlots, bookAppointment,
  searchMapNearby, loadSession,
  type FacilityResult, type DoctorResult, type SlotResult, type MapPlace,
} from '@/lib/api';
import { useAppStore } from '@/store/app';

// ── Helpers ───────────────────────────────────────────────────────────────────
type FacilityType = 'all' | 'hospital' | 'clinic' | 'pharmacy';
type MapProvider  = 'google' | 'naver';
type ViewMode     = 'list' | 'map';

/**
 * Build an OpenStreetMap embed URL with a bounding box that fits all pins
 * plus a marker for the user (or the first facility) at the centre.
 * No API key required — OSM is free.
 */
function buildOsmEmbedUrl(
  pins: Array<{ lat: number; lng: number }>,
  centre: { lat: number; lng: number },
): string {
  if (pins.length === 0) {
    // Fall back to a single-marker view around the centre (~0.04° box ≈ 4 km)
    const pad = 0.04;
    const bbox = [centre.lng - pad, centre.lat - pad, centre.lng + pad, centre.lat + pad].join(',');
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${centre.lat}%2C${centre.lng}`;
  }
  const lats = pins.map((p) => p.lat).concat(centre.lat);
  const lngs = pins.map((p) => p.lng).concat(centre.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  // Add 10% padding so pins aren't on the edge of the viewport
  const padLat = Math.max((maxLat - minLat) * 0.15, 0.01);
  const padLng = Math.max((maxLng - minLng) * 0.15, 0.01);
  const bbox = [minLng - padLng, minLat - padLat, maxLng + padLng, maxLat + padLat].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${centre.lat}%2C${centre.lng}`;
}

const TYPE_TABS: { id: FacilityType; label: string; icon: React.ReactNode }[] = [
  { id: 'all',      label: 'All',       icon: <Building2 size={12} /> },
  { id: 'hospital', label: 'Hospital',  icon: <Building2 size={12} /> },
  { id: 'clinic',   label: 'Clinic',    icon: <Stethoscope size={12} /> },
  { id: 'pharmacy', label: 'Pharmacy',  icon: <Pill size={12} /> },
];

const SPECIALTY_CHIPS = [
  'All', 'General Practice', 'Family Medicine', 'Emergency Medicine',
  'Cardiology', 'Pediatrics', 'Obstetrics & Gynecology', 'Orthopedics',
  'Neurology', 'Psychiatry', 'Dermatology', 'ENT', 'Oncology', 'Pharmacy',
] as const;

/** One-tap navigation deep-link — Naver Maps first (Korea), Google fallback. */
function navUrl(provider: MapProvider, lat: number | undefined, lng: number | undefined, name: string, city: string): string {
  const q = encodeURIComponent(`${name} ${city}`);
  if (lat != null && lng != null) {
    return provider === 'naver'
      // Naver Maps web + mobile deeplink (nmap:// for Naver app, web fallback for browser)
      ? `https://map.naver.com/v5/search/${q}?c=${lng},${lat},15,0,0,0,dh`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  return provider === 'naver'
    ? `https://map.naver.com/v5/search/${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Skeleton card shown while loading */
function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-xl bg-ink-700 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-2/3 rounded bg-ink-700" />
          <div className="h-2.5 w-1/2 rounded bg-ink-800" />
        </div>
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-16 rounded-full bg-ink-800" />
        <div className="h-5 w-20 rounded-full bg-ink-800" />
      </div>
    </div>
  );
}

function typeBadgeClass(type: FacilityResult['type']): string {
  if (type === 'hospital') return 'bg-brand-500/15 text-brand-400 border border-brand-500/30';
  if (type === 'pharmacy') return 'bg-violet-500/15 text-violet-400 border border-violet-500/30';
  return 'bg-ok-500/15 text-ok-400 border border-ok-500/30';
}

// Generate next 7 non-Sunday days
function getNextDays(count = 7): Array<{ date: string; day: string; label: string }> {
  const result: Array<{ date: string; day: string; label: string }> = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let cursor = new Date(now);

  while (result.length < count) {
    cursor = new Date(cursor.getTime() + 86_400_000);
    if (cursor.getDay() === 0) continue; // skip Sunday
    result.push({
      date:  cursor.toISOString().slice(0, 10),
      day:   cursor.toLocaleDateString('en-US', { weekday: 'short' }),
      label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
  }
  return result;
}

const DAYS = getNextDays();

// ── Component ─────────────────────────────────────────────────────────────────
export default function FindCare() {
  const [searchParams] = useSearchParams();
  const { patientProfile, addAppointment } = useAppStore();

  // Query param pre-fill from MA Agent CTA
  const preSpecialty    = searchParams.get('specialty')   || 'All';
  const preSummary      = searchParams.get('summary')     || '';
  const preUrgency      = searchParams.get('urgency')     || 'see-clinician-soon';
  const preSessionId    = searchParams.get('s')           || undefined;
  const preDoctorId     = searchParams.get('doctorId')    || undefined;
  const preFacilityId   = searchParams.get('facilityId')  || undefined;
  // imageReport=true is set when the CTA came from image analysis (summary contains AI findings)

  // Search state
  const [typeFilter,    setTypeFilter]    = useState<FacilityType>('all');
  const [specialty,     setSpecialty]     = useState(preSpecialty);
  const [citySearch,    setCitySearch]    = useState('');
  const [mapProvider,   setMapProvider]   = useState<MapProvider>('naver');
  const [viewMode,      setViewMode]      = useState<ViewMode>('list');
  const [coords,        setCoords]        = useState<{ lat: number; lng: number } | null>(null);
  const [locDone,       setLocDone]       = useState(false);
  const [locLabel,      setLocLabel]      = useState<string>('');   // human-readable address
  const [locRequesting, setLocRequesting] = useState(false);

  // Data state — Tier 1 (enrolled) + Tier 2 (Google Places fallback)
  const [facilities,   setFacilities]   = useState<FacilityResult[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [mapPlaces,       setMapPlaces]       = useState<MapPlace[]>([]);
  const [mapLoading,      setMapLoading]      = useState(false);
  const [specialtyFallback, setSpecialtyFallback] = useState<string | null>(null);
  const [expanded,     setExpanded]     = useState<string | null>(null);

  // Booking sheet state
  const [bookDoctor,    setBookDoctor]    = useState<{ doctor: DoctorResult; facility: FacilityResult } | null>(null);
  const [selectedDate,  setSelectedDate]  = useState(DAYS[0].date);
  const [slots,         setSlots]         = useState<SlotResult[]>([]);
  const [slotsLoading,  setSlotsLoading]  = useState(false);
  const [selectedSlot,  setSelectedSlot]  = useState<SlotResult | null>(null);

  // Patient form
  const [pName,     setPName]     = useState(patientProfile?.fullName   || '');
  const [pPhone,    setPPhone]    = useState(patientProfile?.phone      || '');
  const [pEmail,    setPEmail]    = useState(patientProfile?.email      || '');
  const [pAge,      setPAge]      = useState('');
  const [pSex,      setPSex]      = useState<string>(patientProfile?.sex || '');
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState('');

  // Success state
  const [bookedAppt, setBookedAppt] = useState<{ doctorName: string; date: string; startTime: string; endTime: string } | null>(null);

  // Assembled summary for appointment (from session + preSummary)
  const [assembledSummary, setAssembledSummary] = useState(preSummary);

  // ── Load facilities ───────────────────────────────────────────────────────
  const load = useCallback(async (overrides?: Partial<{
    lat: number; lng: number; spec: string; type: FacilityType; city: string;
  }>) => {
    setLoading(true);
    setLoadError(null);
    setMapPlaces([]);
    try {
      const spec = overrides?.spec ?? specialty;
      const typ  = overrides?.type ?? typeFilter;
      const city = overrides?.city ?? citySearch;
      const lat  = overrides?.lat  ?? coords?.lat;
      const lng  = overrides?.lng  ?? coords?.lng;

      let results = await searchFacilities({
        lat, lng,
        specialty: spec && spec !== 'All' ? spec : undefined,
        type:      typ  !== 'all'         ? typ  : undefined,
        city:      city.trim()            || undefined,
        radius:    500,
      });

      // Soft specialty filter: if no in-network results match the specialty,
      // fall back to showing ALL nearby in-network clinics with a notice.
      // Prevents empty screen when user is outside Uzbekistan or specialty
      // is rare (e.g. Pulmonology has 0 in-network matches).
      if (results.length === 0 && spec && spec !== 'All') {
        const fallback = await searchFacilities({
          lat, lng,
          type: typ !== 'all' ? typ : undefined,
          city: city.trim() || undefined,
          radius: 500,
        });
        if (fallback.length > 0) {
          setSpecialtyFallback(spec); // show notice to user
          results = fallback;
        }
      } else {
        setSpecialtyFallback(null);
      }

      setFacilities(results);

      // Tier 2: always fire when GPS coords available (shows local real-world results)
      // or when enrolled DB returned too few results
      if (results.length < 3 || (lat != null && lng != null)) {
        setMapLoading(true);
        searchMapNearby({
          ...(lat != null && lng != null ? { lat, lng } : {}),
          type:    typ !== 'all' ? typ : 'hospital',
          radius:  5000,
          keyword: spec && spec !== 'All' ? spec : undefined,
        })
          .then((r) => setMapPlaces(r.places.slice(0, 8)))
          .catch(() => {/* silent — Tier 2 is best-effort */})
          .finally(() => setMapLoading(false));
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load facilities.');
      setFacilities([]);
    } finally {
      setLoading(false);
    }
  }, [specialty, typeFilter, citySearch, coords]);

  // ── Geolocation — request first, THEN load facilities with real coords ──────
  useEffect(() => {
    if (!navigator.geolocation) {
      // No GPS support — load immediately without coords
      setLocDone(true);
      load();
      return;
    }

    setLocRequesting(true);

    // Try GPS first (3s timeout). On success → load with real coords.
    // On fail/deny → load without coords (all facilities, unsorted).
    const gpsTimeout = setTimeout(() => {
      // GPS took too long — load without coords rather than show blank screen
      setLocDone(true);
      setLocRequesting(false);
      load();
    }, 3000);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        clearTimeout(gpsTimeout);
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        setLocDone(true);
        setLocRequesting(false);
        // Pass coords directly — don't rely on state being updated yet
        load({ lat, lng });

        // Reverse-geocode via Nominatim (no API key)
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
            { headers: { 'User-Agent': 'MedAccessAI/1.0' } },
          );
          if (r.ok) {
            const d = await r.json() as any;
            const addr = d.address;
            setLocLabel(
              [addr?.road || addr?.suburb, addr?.city || addr?.town || addr?.county, addr?.country]
                .filter(Boolean).join(', '),
            );
          }
        } catch { /* non-fatal */ }
      },
      () => {
        clearTimeout(gpsTimeout);
        setLocDone(true);
        setLocRequesting(false);
        load(); // denied — load without coords
      },
      { timeout: 5000, enableHighAccuracy: false },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requestLocation() {
    if (locRequesting) return;
    setLocLabel('');
    setLocDone(false);
    setLocRequesting(true);
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        setLocDone(true);
        setLocRequesting(false);
        load({ lat, lng });
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
            { headers: { 'User-Agent': 'MedAccessAI/1.0' } },
          );
          if (r.ok) {
            const d = await r.json() as any;
            const addr = d.address;
            setLocLabel([addr?.road || addr?.suburb, addr?.city || addr?.town, addr?.country].filter(Boolean).join(', '));
          }
        } catch { /* non-fatal */ }
      },
      () => { setLocDone(true); setLocRequesting(false); load(); },
      { timeout: 8000 },
    );
  }

  // ── Load and assemble session summary from chat ────────────────────────────
  useEffect(() => {
    if (!preSessionId) return;
    loadSession(preSessionId)
      .then((messages) => {
        if (!messages.length) return;
        // Assemble full interview transcript + image analysis
        const summary = messages
          .map((m) => {
            if (m.role === 'user') return `Patient: ${m.content}`;
            return `Agent: ${m.content}`;
          })
          .join('\n\n');
        setAssembledSummary(summary);
      })
      .catch(() => {
        // Silent fail — use pre-filled summary
      });
  }, [preSessionId]);

  // ── Auto-open doctor when pre-selected from Chat ──────────────────────────
  useEffect(() => {
    if (!preDoctorId || !preFacilityId) return;
    // Find the pre-selected doctor in loaded facilities
    const facility = facilities.find((f) => f.id === preFacilityId);
    if (facility) {
      const doctor = facility.doctors?.find((d) => d.id === preDoctorId);
      if (doctor) {
        setBookDoctor({ doctor, facility });
        setExpanded(preFacilityId);
      }
    }
  }, [facilities, preDoctorId, preFacilityId]);

  // ── Load slots for selected doctor + date ─────────────────────────────────
  useEffect(() => {
    if (!bookDoctor) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    getFacilitySlots(bookDoctor.facility.id, bookDoctor.doctor.id, selectedDate)
      .then((r) => setSlots(r.slots))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [bookDoctor, selectedDate]);

  // ── Booking submit ────────────────────────────────────────────────────────
  async function handleBook() {
    if (!bookDoctor || !selectedSlot) return;
    if (!pName.trim()) { setFormError('Your name is required.'); return; }

    setSubmitting(true);
    setFormError('');
    try {
      const result = await bookAppointment({
        patientName:    pName.trim(),
        patientPhone:   pPhone.trim()  || undefined,
        patientEmail:   pEmail.trim()  || undefined,
        patientAge:     pAge ? Number(pAge) : undefined,
        patientSex:     pSex             || undefined,
        doctorId:       bookDoctor.doctor.id,
        facilityId:     bookDoctor.facility.id,
        date:           selectedDate,
        startTime:      selectedSlot.startTime,
        specialty:      bookDoctor.doctor.specialty,
        urgency:        preUrgency,
        maAgentSummary: assembledSummary || undefined,
        sessionId:      preSessionId,
      });

      addAppointment({
        appointmentId: result.appointmentId,
        facilityId:    bookDoctor.facility.id,
        facilityName:  bookDoctor.facility.name,
        facilityCity:  bookDoctor.facility.city,
        facilityType:  bookDoctor.facility.type,
        doctorId:      bookDoctor.doctor.id,
        doctorName:    result.doctorName,
        specialty:     bookDoctor.doctor.specialty,
        date:          selectedDate,
        startTime:     result.startTime,
        endTime:       result.endTime,
        status:        'pending',
        bookedAt:      Date.now(),
      });

      setBookedAppt({ doctorName: result.doctorName, date: selectedDate, startTime: result.startTime, endTime: result.endTime });
      setBookDoctor(null);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function openBooking(doctor: DoctorResult, facility: FacilityResult) {
    setBookDoctor({ doctor, facility });
    setSelectedDate(DAYS[0].date);
    setSelectedSlot(null);
    setFormError('');
    setPName(patientProfile?.fullName || '');
    setPPhone(patientProfile?.phone   || '');
    setPEmail(patientProfile?.email   || '');
    setPAge('');
    setPSex(patientProfile?.sex || '');
    setBookedAppt(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-surface-700">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-base font-semibold text-white">Find Care</h2>
            <p className="text-xs text-slate-500 mt-0.5">Hospitals · Clinics · Pharmacies</p>
          </div>
          <div className="flex items-center gap-1.5">
            {/* List ↔ Map view toggle */}
            <div className="flex items-center gap-0.5 rounded-lg border border-surface-600 bg-surface-800 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition ${
                  viewMode === 'list'
                    ? 'bg-brand-600/20 text-brand-400 border border-brand-500/40'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <List size={10} /> List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                aria-label="Map view"
                aria-pressed={viewMode === 'map'}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition ${
                  viewMode === 'map'
                    ? 'bg-brand-600/20 text-brand-400 border border-brand-500/40'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Map size={10} /> Map
              </button>
            </div>

            {/* Map provider toggle */}
            <div className="flex items-center gap-0.5 rounded-lg border border-surface-600 bg-surface-800 p-0.5">
              {(['naver', 'google'] as MapProvider[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMapProvider(p)}
                  aria-label={`Use ${p === 'google' ? 'Google' : 'Naver'} Maps for directions`}
                  aria-pressed={mapProvider === p}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition ${
                    mapProvider === p
                      ? 'bg-brand-600/20 text-brand-400 border border-brand-500/40'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {p === 'google' ? 'Google' : 'Naver'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* City search */}
        <input
          className="input text-sm"
          placeholder="Search by city (e.g. Tashkent, Samarkand…)"
          value={citySearch}
          onChange={(e) => setCitySearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load({ city: citySearch })}
        />
      </div>

      {/* ── Type tabs ──────────────────────────────────────────────────── */}
      <div className="shrink-0 flex gap-1.5 px-3 pt-2.5 pb-1">
        {TYPE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTypeFilter(t.id); load({ type: t.id }); }}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium border transition ${
              typeFilter === t.id
                ? 'border-brand-500 bg-brand-600/20 text-brand-400'
                : 'border-surface-600 bg-surface-800 text-slate-500'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Specialty chips ────────────────────────────────────────────── */}
      <div className="shrink-0 flex gap-1.5 px-3 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {SPECIALTY_CHIPS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setSpecialty(s); load({ spec: s }); }}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition ${
              specialty === s
                ? 'border-brand-500/80 bg-brand-600/20 text-brand-400'
                : 'border-surface-600/60 bg-surface-800/60 text-slate-500'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── Location banner ────────────────────────────────────────────── */}
      {locRequesting ? (
        <div className="shrink-0 mx-3 mb-2 rounded-xl border border-brand-500/25 bg-brand-500/8 px-3 py-2 flex items-center gap-2">
          <Loader2 size={13} className="text-brand-400 shrink-0 animate-spin" />
          <p className="text-[11px] text-slate-400 flex-1">Detecting your location…</p>
        </div>
      ) : locDone && coords ? (
        <div className="shrink-0 mx-3 mb-2 rounded-xl border border-ok-500/25 bg-ok-500/8 px-3 py-2 flex items-center gap-2">
          <Navigation size={13} className="text-ok-400 shrink-0" />
          <p className="text-[11px] text-slate-300 flex-1 truncate">
            {locLabel || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`}
          </p>
          <button type="button" onClick={requestLocation} className="text-[10px] text-slate-500 hover:text-slate-300 shrink-0">Refresh</button>
        </div>
      ) : !locDone ? (
        <div className="shrink-0 mx-3 mb-2 rounded-xl border border-brand-500/25 bg-brand-500/8 px-3 py-2 flex items-center gap-2">
          <Navigation size={13} className="text-brand-400 shrink-0" />
          <p className="text-[11px] text-slate-400 flex-1">Enable location for distance sorting</p>
          <button type="button" onClick={requestLocation} className="text-[11px] font-semibold text-brand-400">Allow</button>
        </div>
      ) : null}

      {/* ── MA Agent context ───────────────────────────────────────────── */}
      {(preSpecialty !== 'All' || preSummary) && (
        <div className="shrink-0 mx-3 mb-2 rounded-xl border border-ok-500/20 bg-ok-500/8 px-3 py-2">
          <p className="text-[10px] text-ok-400 font-semibold mb-0.5">MA Agent recommendation</p>
          {preSpecialty !== 'All' && (
            <p className="text-[11px] text-slate-400">Specialty: <span className="text-white font-medium">{preSpecialty}</span></p>
          )}
          {preSummary && <p className="text-[11px] text-slate-500 truncate mt-0.5">{preSummary}</p>}
        </div>
      )}

      {/* ── Specialty fallback notice ───────────────────────────────────── */}
      {specialtyFallback && (
        <div className="shrink-0 mx-3 mb-2 rounded-xl border border-warn-500/25 bg-warn-500/8 px-3 py-2">
          <p className="text-[11px] text-warn-400">
            No <strong>{specialtyFallback}</strong> specialists in our network nearby — showing all available clinics.
          </p>
        </div>
      )}

      {/* ── Booked success banner ───────────────────────────────────────── */}
      {bookedAppt && (
        <div className="shrink-0 mx-3 mb-2 rounded-xl border border-ok-500/30 bg-ok-500/10 px-3 py-3 flex items-start gap-2.5">
          <CheckCircle size={16} className="text-ok-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-ok-400">Appointment booked!</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {bookedAppt.doctorName} · {bookedAppt.date} · {bookedAppt.startTime}–{bookedAppt.endTime}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Status: pending · The clinic will confirm.</p>
          </div>
          <button type="button" onClick={() => setBookedAppt(null)} aria-label="Dismiss booking confirmation" className="ml-auto text-slate-600 hover:text-slate-400"><X size={14} /></button>
        </div>
      )}

      {/* ── Map view (OSM iframe + horizontal facility strip) ───────────── */}
      {viewMode === 'map' && !loading && (facilities.length > 0 || mapPlaces.length > 0) && (
        <div className="shrink-0 mx-3 mb-2 rounded-xl overflow-hidden border border-surface-700">
          <iframe
            key={`${facilities.length}-${mapPlaces.length}-${coords?.lat ?? 0}`}
            title="Facilities map"
            src={buildOsmEmbedUrl(
              [
                ...facilities.map((f) => ({ lat: f.lat, lng: f.lng })),
                ...mapPlaces.map((p) => ({ lat: p.lat, lng: p.lng })),
              ].filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number'),
              coords ?? { lat: 41.3111, lng: 69.2797 }, // Tashkent fallback
            )}
            className="w-full h-56 bg-surface-800"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="bg-surface-800/80 px-3 py-1.5 flex items-center justify-between text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <Map size={10} /> {facilities.length + mapPlaces.length} place{facilities.length + mapPlaces.length === 1 ? '' : 's'} on map
            </span>
            <span>© OpenStreetMap</span>
          </div>
        </div>
      )}

      {/* ── Facility list ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">

        {/* Skeleton loading */}
        {loading && [0, 1, 2].map((i) => <SkeletonCard key={i} />)}

        {/* Error state */}
        {!loading && loadError && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="rounded-2xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-400 max-w-xs">
              {loadError}
            </div>
            <button type="button" onClick={() => load()} className="text-xs text-brand-400">
              Retry
            </button>
          </div>
        )}

        {/* Empty state (Tier 1 empty, Tier 2 loading or also empty) */}
        {!loading && !loadError && facilities.length === 0 && !mapLoading && mapPlaces.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <Building2 size={32} className="text-ink-700" />
            <p className="text-sm text-ink-400">No facilities found nearby.</p>
            <p className="text-xs text-ink-600 max-w-xs leading-relaxed">
              Enable location or search by city for better results.
            </p>
            <button
              type="button"
              onClick={() => { setTypeFilter('all'); setSpecialty('All'); setCitySearch(''); load({ type: 'all', spec: 'All', city: '' }); }}
              className="text-xs font-medium text-brand-400 hover:text-brand-300 transition"
            >
              Clear filters &amp; retry
            </button>
          </div>
        )}

        {/* ── TIER 1: Enrolled clinics ─────────────────────────────── */}
        {!loading && facilities.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 px-1 pt-1 flex items-center gap-1.5">
              <ShieldCheck size={10} className="text-ok-400" /> In-network · Book here
            </p>
            {facilities.map((f) => (
          <div key={f.id} className="card overflow-hidden">
            {/* Facility header */}
            <button
              type="button"
              className="w-full p-4 flex items-start gap-3 text-left hover:bg-surface-700/30 transition-colors"
              onClick={() => setExpanded(expanded === f.id ? null : f.id)}
            >
              {/* Type icon */}
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                f.type === 'hospital' ? 'bg-brand-500/15 text-brand-400'
                : f.type === 'pharmacy' ? 'bg-violet-500/15 text-violet-400'
                : 'bg-ok-500/15 text-ok-400'
              }`}>
                {f.type === 'pharmacy' ? <Pill size={15} /> : f.type === 'hospital' ? <Building2 size={15} /> : <Stethoscope size={15} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white leading-snug">{f.name}</span>
                  {f.verified && <span title="Verified"><ShieldCheck size={12} className="text-ok-400 shrink-0" /></span>}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadgeClass(f.type)}`}>
                    {f.type}
                  </span>
                  <span className="flex items-center gap-0.5 text-[11px] text-slate-500">
                    <MapPin size={10} /> {f.city}
                    {f.distanceKm != null && ` · ${f.distanceKm} km`}
                  </span>
                  <span className="flex items-center gap-0.5 text-[11px] text-slate-500">
                    <Clock size={10} /> {f.openingHours}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {f.specialties.slice(0, 4).map((s) => (
                    <span key={s} className="rounded-full bg-surface-700 px-2 py-0.5 text-[10px] text-slate-400">{s}</span>
                  ))}
                  {f.specialties.length > 4 && (
                    <span className="rounded-full bg-surface-700 px-2 py-0.5 text-[10px] text-slate-500">+{f.specialties.length - 4}</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {f.phone && (
                  <a
                    href={`tel:${f.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-700 text-slate-400 hover:text-white transition"
                  >
                    <Phone size={13} />
                  </a>
                )}
                <a
                  href={navUrl(mapProvider, f.lat, f.lng, f.name, f.city ?? '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-800 text-ink-400 hover:text-white transition"
                  title={`Navigate in ${mapProvider === 'naver' ? 'Naver' : 'Google'} Maps`}
                >
                  <Navigation size={13} />
                </a>
                <ChevronDown
                  size={15}
                  className={`text-slate-500 transition-transform duration-200 mt-0.5 ${expanded === f.id ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            {/* Doctor list (expanded) */}
            {expanded === f.id && (
              <div className="border-t border-surface-700 divide-y divide-surface-700/60">
                {f.doctors.length === 0 && (
                  <p className="px-4 py-3 text-xs text-slate-500">No staff listed.</p>
                )}
                {f.doctors.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-700 text-slate-400 text-xs font-bold">
                      {doc.name.split(' ').slice(-1)[0]?.[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{doc.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {doc.specialty} · {doc.consultationMinutes} min · {doc.languages.join(', ')}
                      </p>
                      {doc.bio && <p className="text-[10px] text-slate-600 mt-0.5 truncate">{doc.bio}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => openBooking(doc, f)}
                      className="shrink-0 flex items-center gap-1 rounded-xl border border-brand-500/40 bg-brand-600/15 px-3 py-1.5 text-xs font-medium text-brand-400 hover:bg-brand-600/25 transition"
                    >
                      Book <ChevronRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
          </div>
        )}

        {/* ── TIER 2: Naver / public map fallback ──────────────────── */}
        {(mapLoading || mapPlaces.length > 0) && (
          <div className="space-y-2 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 px-1 flex items-center gap-1.5">
              <Map size={10} /> 네이버 지도 검색 결과 · Navigate only
            </p>
            {mapLoading && [0, 1].map((i) => <SkeletonCard key={i} />)}
            {mapPlaces.map((p) => (
              <div key={p.placeId} className="card p-4 flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-ink-400">
                  <Building2 size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white leading-snug">{p.name}</p>
                  <p className="text-[11px] text-ink-500 mt-0.5 truncate">{p.address}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {p.rating != null && (
                      <span className="text-[10px] text-warn-400">★ {p.rating.toFixed(1)}</span>
                    )}
                    {p.openNow != null && (
                      <span className={`text-[10px] font-medium ${p.openNow ? 'text-ok-400' : 'text-danger-400'}`}>
                        {p.openNow ? 'Open now' : 'Closed'}
                      </span>
                    )}
                    {p.distanceKm != null && (
                      <span className="text-[10px] text-ink-500">{p.distanceKm} km</span>
                    )}
                  </div>
                </div>
                <a
                  href={p.navUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1 rounded-xl border border-ink-700 bg-ink-800 px-3 py-2 text-xs font-medium text-ink-300 hover:border-brand-500/50 hover:text-ink-100 transition"
                  title="Open navigation"
                >
                  <Navigation size={13} /> Navigate
                </a>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ── Booking sheet ──────────────────────────────────────────────────── */}
      {bookDoctor && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
          onClick={() => setBookDoctor(null)}
        >
          <div
            className="w-full max-h-[90vh] rounded-t-2xl bg-surface-900 border-t border-surface-700 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet header */}
            <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-3 border-b border-surface-700">
              <div>
                <p className="text-sm font-semibold text-white">{bookDoctor.doctor.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {bookDoctor.doctor.specialty} · {bookDoctor.facility.name}
                </p>
              </div>
              <button type="button" onClick={() => setBookDoctor(null)} aria-label="Close booking sheet" className="text-slate-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* Date selector */}
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                  <Calendar size={12} /> Select date
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {DAYS.map((d) => (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => setSelectedDate(d.date)}
                      className={`shrink-0 flex flex-col items-center rounded-xl border px-3 py-2 text-center transition ${
                        selectedDate === d.date
                          ? 'border-brand-500 bg-brand-600/20 text-brand-400'
                          : 'border-surface-600 bg-surface-800 text-slate-400 hover:border-surface-500'
                      }`}
                    >
                      <span className="text-[10px] font-medium uppercase">{d.day}</span>
                      <span className="text-xs font-semibold mt-0.5">{d.label.split(' ')[1]}</span>
                      <span className="text-[9px] mt-0.5 opacity-70">{d.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slot selector */}
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                  <Clock size={12} /> Available slots
                  <span className="ml-1 text-[10px] text-slate-600">({bookDoctor.doctor.consultationMinutes} min)</span>
                </p>
                {slotsLoading && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                    <Loader2 size={13} className="animate-spin" /> Loading slots…
                  </div>
                )}
                {!slotsLoading && slots.length === 0 && (
                  <p className="text-xs text-slate-500 py-2">No available slots on this day.</p>
                )}
                {!slotsLoading && slots.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {slots.map((s) => (
                      <button
                        key={s.startTime}
                        type="button"
                        onClick={() => setSelectedSlot(s)}
                        className={`rounded-xl border px-2 py-2 text-[11px] font-medium text-center transition ${
                          selectedSlot?.startTime === s.startTime
                            ? 'border-brand-500 bg-brand-600/20 text-brand-400'
                            : 'border-surface-600 bg-surface-800 text-slate-400 hover:border-surface-500'
                        }`}
                      >
                        {s.startTime}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Patient form — only shown after slot selected */}
              {selectedSlot && (
                <div className="space-y-3 pt-1 border-t border-surface-700">
                  <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <User size={12} /> Your details
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="label">Full name *</label>
                      <input className="input" placeholder="Your full name" value={pName} onChange={(e) => setPName(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Phone</label>
                      <input className="input" type="tel" placeholder="+998…" value={pPhone} onChange={(e) => setPPhone(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Age</label>
                      <input className="input" type="number" placeholder="25" min={0} max={130} value={pAge} onChange={(e) => setPAge(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input className="input" type="email" placeholder="you@example.com" value={pEmail} onChange={(e) => setPEmail(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Sex</label>
                      <select className="input" value={pSex} onChange={(e) => setPSex(e.target.value)}>
                        <option value="">—</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  {formError && <p className="text-xs text-danger-400">{formError}</p>}

                  <button
                    type="button"
                    onClick={handleBook}
                    disabled={submitting}
                    className="btn-primary w-full justify-center"
                  >
                    {submitting
                      ? <><Loader2 size={14} className="animate-spin" /> Booking…</>
                      : `Confirm · ${selectedSlot.startTime}–${selectedSlot.endTime}`
                    }
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

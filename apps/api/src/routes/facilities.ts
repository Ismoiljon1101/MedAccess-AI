/**
 * /api/facilities — in-network facility registry + booking.
 *
 * NO seed data. Two tiers of care discovery:
 *   Tier 1 (this file): clinics that self-register via POST /register.
 *     → bookable (have doctors + generated slots), shown first in patient app.
 *   Tier 2 (routes/maps.ts): Naver Local Search — real nearby hospitals.
 *     → navigation only, not bookable (we don't have their scheduling system).
 *
 * Registered facilities live in-memory (MVP). Swap for MongoDB Facility model
 * when persistence across restarts is needed.
 */
import { Router } from 'express';

const router = Router();

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Doctor {
  id: string;
  facilityId: string;
  name: string;
  specialty: string;
  consultationMinutes: number;
  languages: string[];
  bio?: string;
}

export interface Facility {
  id: string;
  name: string;
  type: 'hospital' | 'clinic' | 'pharmacy';
  address: string;
  city: string;
  country: string;
  lat?: number;
  lng?: number;
  phone?: string;
  openingHours: string;
  specialties: string[];
  verified: boolean;
  source: 'registered';
  registeredAt: string;
  contactName: string;
  contactRole: string;
  doctors: Doctor[];
}

// ── In-memory registry (no fake data — populated by registration) ─────────────
const facilities: Facility[] = [];

export function getRegisteredFacilities(): Facility[] {
  return facilities;
}
export function findFacility(id: string): Facility | undefined {
  return facilities.find((f) => f.id === id);
}
export function findDoctor(facilityId: string, doctorId: string): Doctor | undefined {
  return facilities.find((f) => f.id === facilityId)?.doctors.find((d) => d.id === doctorId);
}

// ── Slot generation (09:00–17:00, skip 13:00 lunch) ──────────────────────────
function generateSlots(consultationMinutes: number, _date: string): { startTime: string; endTime: string }[] {
  const slots: { startTime: string; endTime: string }[] = [];
  const startHour = 9, endHour = 17, lunchHour = 13;
  let cursor = startHour * 60;
  const endMinutes = endHour * 60;
  while (cursor + consultationMinutes <= endMinutes) {
    const h = Math.floor(cursor / 60);
    if (h === lunchHour) { cursor += 60; continue; }
    const startTime = `${String(h).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`;
    const endTime = `${String(Math.floor((cursor + consultationMinutes) / 60)).padStart(2, '0')}:${String((cursor + consultationMinutes) % 60).padStart(2, '0')}`;
    slots.push({ startTime, endTime });
    cursor += consultationMinutes;
  }
  return slots;
}

// ── POST /api/facilities/register ────────────────────────────────────────────
// Self-enrollment. Clinic appears in patient search immediately.
router.post('/register', (req, res) => {
  const {
    name, type, address, city, country,
    lat, lng, phone, openingHours, specialties,
    contactName, contactRole,
    doctorName, doctorSpecialty,
  } = req.body as Record<string, string>;

  if (!name?.trim() || !city?.trim() || !contactName?.trim()) {
    res.status(400).json({ error: 'name, city, and contactName are required' });
    return;
  }

  const facilityId = `reg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const facility: Facility = {
    id:           facilityId,
    name:         name.trim(),
    type:         (['hospital', 'clinic', 'pharmacy'].includes(type) ? type : 'clinic') as Facility['type'],
    address:      address?.trim() || '',
    city:         city.trim(),
    country:      country?.trim() || 'KR',
    lat:          lat ? parseFloat(lat) : undefined,
    lng:          lng ? parseFloat(lng) : undefined,
    phone:        phone?.trim() || undefined,
    openingHours: openingHours?.trim() || 'Mon–Fri 09:00–18:00',
    specialties:  specialties ? specialties.split(',').map((s) => s.trim()).filter(Boolean) : [],
    verified:     false,
    source:       'registered',
    registeredAt: new Date().toISOString(),
    contactName:  contactName.trim(),
    contactRole:  contactRole?.trim() || 'Doctor',
    doctors: doctorName?.trim() ? [{
      id:                  `dr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      facilityId,
      name:                doctorName.trim(),
      specialty:           doctorSpecialty?.trim() || 'General Practice',
      consultationMinutes: 30,
      languages:           ['en'],
    }] : [],
  };

  facilities.push(facility);
  console.log(`[facilities] Registered: ${facility.name} (${facility.city}) — id=${facilityId}`);

  res.status(201).json({
    message:    `${facility.name} registered. You now appear in patient search.`,
    facilityId,
    facility,
  });
});

// ── GET /api/facilities ───────────────────────────────────────────────────────
// Returns registered (in-network, bookable) facilities only.
// Patient app shows these first, then layers Naver Tier-2 results below.
router.get('/', (req, res) => {
  const lat       = req.query.lat ? parseFloat(req.query.lat as string) : null;
  const lng       = req.query.lng ? parseFloat(req.query.lng as string) : null;
  const specialty = ((req.query.specialty as string) || '').toLowerCase().trim();
  const type      = ((req.query.type as string) || '').toLowerCase().trim();
  const city      = ((req.query.city as string) || '').toLowerCase().trim();
  const radius    = req.query.radius ? parseFloat(req.query.radius as string) : 100;

  let results = facilities.map((f) => {
    const distKm = lat != null && lng != null && f.lat != null && f.lng != null
      ? haversine(lat, lng, f.lat, f.lng)
      : null;
    return { ...f, distanceKm: distKm != null ? Number(distKm.toFixed(2)) : null };
  });

  if (type && type !== 'all') {
    results = results.filter((f) => f.type === type);
  }
  if (specialty && specialty !== 'all') {
    results = results.filter((f) =>
      f.specialties.some((s) => s.toLowerCase().includes(specialty)) ||
      f.doctors.some((d) => d.specialty.toLowerCase().includes(specialty)),
    );
  }
  if (city) {
    results = results.filter((f) => f.city.toLowerCase().includes(city));
  }
  if (lat != null && lng != null) {
    results = results.filter((f) => (f.distanceKm ?? 0) <= radius);
    results.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  }

  res.json({ facilities: results, total: results.length });
});

// ── GET /api/facilities/registered ────────────────────────────────────────────
router.get('/registered', (_req, res) => {
  res.json({ facilities, total: facilities.length });
});

// ── GET /api/facilities/:id ───────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const facility = findFacility(req.params.id);
  if (!facility) { res.status(404).json({ error: 'Facility not found' }); return; }
  res.json({ facility });
});

// ── GET /api/facilities/:id/doctors ──────────────────────────────────────────
router.get('/:id/doctors', (req, res) => {
  const facility = findFacility(req.params.id);
  if (!facility) { res.status(404).json({ error: 'Facility not found' }); return; }
  res.json({ doctors: facility.doctors });
});

// ── GET /api/facilities/:id/slots?doctorId=&date= ────────────────────────────
router.get('/:id/slots', (req, res) => {
  const { doctorId, date } = req.query as { doctorId?: string; date?: string };
  if (!doctorId || !date) {
    res.status(400).json({ error: 'doctorId and date are required' });
    return;
  }
  const doctor = findDoctor(req.params.id, doctorId);
  if (!doctor) { res.status(404).json({ error: 'Doctor not found at this facility' }); return; }

  const all = generateSlots(doctor.consultationMinutes, date);
  const booked = inMemoryBookedSlots.get(`${doctorId}_${date}`) ?? new Set<string>();
  const available = all.filter((s) => !booked.has(s.startTime));

  res.json({
    doctorId,
    facilityId: req.params.id,
    date,
    consultationMinutes: doctor.consultationMinutes,
    slots: available,
    totalSlots: all.length,
    availableSlots: available.length,
  });
});

// ── Shared in-memory booked slots ─────────────────────────────────────────────
// Key: `${doctorId}_${date}` → Set of booked startTime strings
export const inMemoryBookedSlots = new Map<string, Set<string>>();

export default router;

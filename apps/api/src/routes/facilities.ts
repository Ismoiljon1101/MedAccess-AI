/**
 * /api/facilities — search + booking for registered in-network facilities.
 *
 * NO seed data. Sources:
 *   Tier 1 (this file): Clinics registered via POST /api/register/clinic,
 *     approved by admin → Facility.active=true, Doctor.active=true in MongoDB.
 *     Bookable (slots + appointments).
 *   Tier 2 (routes/maps.ts): Naver Local Search — real nearby places.
 *     Navigation only, not bookable.
 */
import { Router } from 'express';
import { Facility, Doctor, dbReady } from '@medaccess/db';
import { inMemoryClinics, inMemoryDoctors } from './register.js';

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

// ── Slot generation (09:00–17:00, skip 13:00 lunch) ──────────────────────────
function generateSlots(consultationMinutes: number, dateStr: string): { startTime: string; endTime: string }[] {
  const d = new Date(dateStr + 'T00:00:00');
  if (d.getDay() === 0) return []; // Sunday closed

  const slots: { startTime: string; endTime: string }[] = [];
  const blocks = [{ startH: 9, endH: 12 }, { startH: 13, endH: 17 }];
  for (const { startH, endH } of blocks) {
    let cur = startH * 60;
    while (cur + consultationMinutes <= endH * 60) {
      const s = cur, e = cur + consultationMinutes;
      slots.push({
        startTime: `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`,
        endTime:   `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`,
      });
      cur = e;
    }
  }
  return slots;
}

// ── DB lookup helpers (used by appointments.ts, chat.ts, clinics.ts) ─────────
export async function findFacilityById(id: string) {
  if (dbReady()) return Facility.findById(id).lean();
  return inMemoryClinics.find((c) => c.id === id) ?? null;
}

export async function findDoctorById(facilityId: string, doctorId: string) {
  if (dbReady()) return Doctor.findOne({ _id: doctorId, facilityId, active: true }).lean();
  return inMemoryDoctors.find((d) => d.id === doctorId && d.facilityId === facilityId) ?? null;
}

export async function getAllActiveDoctors(specialty?: string) {
  if (dbReady()) {
    const q: Record<string, any> = { active: true };
    if (specialty) q['specialty'] = { $regex: specialty, $options: 'i' };
    return Doctor.find(q).lean();
  }
  return inMemoryDoctors.filter((d) =>
    d.status === 'approved' && (!specialty || d.specialty.toLowerCase().includes(specialty.toLowerCase())),
  );
}

// ── GET /api/facilities ───────────────────────────────────────────────────────
// Returns only active/approved in-network facilities from MongoDB (or in-memory).
router.get('/', async (req, res, next) => {
  try {
    const lat       = req.query.lat ? parseFloat(req.query.lat as string) : null;
    const lng       = req.query.lng ? parseFloat(req.query.lng as string) : null;
    const specialty = ((req.query.specialty as string) || '').toLowerCase().trim();
    const type      = ((req.query.type as string) || '').toLowerCase().trim();
    const city      = ((req.query.city as string) || '').toLowerCase().trim();
    const radius    = req.query.radius ? parseFloat(req.query.radius as string) : 100;

    let rawFacilities: any[] = [];

    if (dbReady()) {
      const query: Record<string, any> = { active: true };
      if (type && type !== 'all') query['type'] = type;
      if (city) query['city'] = { $regex: city, $options: 'i' };
      if (specialty && specialty !== 'all') {
        query['specialties'] = { $regex: specialty, $options: 'i' };
      }

      const dbFacilities = await Facility.find(query).lean();
      rawFacilities = await Promise.all(dbFacilities.map(async (f) => {
        const doctors = await Doctor.find({ facilityId: String(f._id), active: true }).lean();
        const distKm = lat != null && lng != null
          ? Number(haversine(lat, lng, f.lat, f.lng).toFixed(2))
          : null;
        return {
          id:           String(f._id),
          name:         f.name,
          type:         f.type,
          address:      f.address,
          city:         f.city,
          country:      f.country,
          lat:          f.lat,
          lng:          f.lng,
          phone:        f.phone,
          openingHours: (f.openingHours ?? []).map((h: any) => `${h.day} ${h.open}–${h.close}`).join(', '),
          specialties:  f.specialties,
          verified:     f.verified,
          source:       'registered',
          distanceKm:   distKm,
          doctors:      doctors.map((d) => ({
            id:                  String(d._id),
            facilityId:          String(f._id),
            name:                d.name,
            specialty:           d.specialty,
            consultationMinutes: d.consultationMinutes,
            languages:           d.languages,
            bio:                 d.bio,
          })),
        };
      }));
    } else {
      // In-memory fallback — only approved registrations
      rawFacilities = inMemoryClinics
        .filter((c) => c.status === 'approved' &&
          (!type || type === 'all' || c.type === type) &&
          (!city || c.city.toLowerCase().includes(city)) &&
          (!specialty || c.specialties.some((s) => s.toLowerCase().includes(specialty))))
        .map((c) => {
          const doctors = inMemoryDoctors
            .filter((d) => d.facilityId === c.id && d.status === 'approved')
            .map((d) => ({
              id: d.id, facilityId: c.id, name: d.name, specialty: d.specialty,
              consultationMinutes: d.consultationMinutes, languages: d.languages,
            }));
          return {
            ...c, verified: false, source: 'registered',
            distanceKm: lat != null && lng != null
              ? Number(haversine(lat, lng, c.lat, c.lng).toFixed(2)) : null,
            doctors,
          };
        });
    }

    // Radius filter + sort by distance
    let results = rawFacilities;
    if (lat != null && lng != null) {
      results = results.filter((f: any) => (f.distanceKm ?? 0) <= radius);
      results.sort((a: any, b: any) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    }

    res.json({ facilities: results, total: results.length });
  } catch (err) { next(err); }
});

// ── GET /api/facilities/registered (alias for admin) ─────────────────────────
router.get('/registered', async (_req, res, next) => {
  try {
    if (dbReady()) {
      const all = await Facility.find({ source: 'manual' }).lean();
      return res.json({ facilities: all, total: all.length });
    }
    res.json({ facilities: inMemoryClinics, total: inMemoryClinics.length });
  } catch (err) { next(err); }
});

// ── GET /api/facilities/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const f = await findFacilityById(req.params.id);
    if (!f) return res.status(404).json({ error: 'Facility not found' });
    res.json({ facility: f });
  } catch (err) { next(err); }
});

// ── GET /api/facilities/:id/doctors ──────────────────────────────────────────
router.get('/:id/doctors', async (req, res, next) => {
  try {
    if (dbReady()) {
      const docs = await Doctor.find({ facilityId: req.params.id, active: true }).lean();
      return res.json({ doctors: docs });
    }
    const docs = inMemoryDoctors.filter((d) => d.facilityId === req.params.id && d.status === 'approved');
    res.json({ doctors: docs });
  } catch (err) { next(err); }
});

// ── GET /api/facilities/:id/slots?doctorId=&date= ────────────────────────────
router.get('/:id/slots', async (req, res, next) => {
  try {
    const { doctorId, date } = req.query as { doctorId?: string; date?: string };
    if (!doctorId || !date) return res.status(400).json({ error: 'doctorId and date are required' });

    const doctor = await findDoctorById(req.params.id, doctorId);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found at this facility' });

    const consultMins = (doctor as any).consultationMinutes ?? 30;
    const all = generateSlots(consultMins, date);
    const booked = inMemoryBookedSlots.get(`${doctorId}_${date}`) ?? new Set<string>();
    const available = all.filter((s) => !booked.has(s.startTime));

    res.json({
      doctorId,
      facilityId:          req.params.id,
      date,
      consultationMinutes: consultMins,
      slots:               available,
      totalSlots:          all.length,
      availableSlots:      available.length,
    });
  } catch (err) { next(err); }
});

// ── Shared in-memory booked slots ─────────────────────────────────────────────
export const inMemoryBookedSlots = new Map<string, Set<string>>();

export default router;

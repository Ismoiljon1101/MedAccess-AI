import { Router } from 'express';
import { Referral, Doctor, dbReady } from '@medaccess/db';
import { HttpError } from '../middleware/error.js';

const router: Router = Router();

// ── Haversine distance (km) ───────────────────────────────────────────
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

// ── Seed clinic data (global demo — works anywhere) ───────────────────
// Offsets are relative so they work near ANY user location.
const BASE_OFFSETS = [
  { id: 'c1', name: 'City General Outpatient',  specialty: ['General Practice', 'Internal Medicine'],        dLat:  0.007, dLng:  0.012, phone: '+1-800-555-0101', hours: 'Mon–Fri 8am–6pm', rating: 4.5, waitMinutes: 15 },
  { id: 'c2', name: 'MedQuick Urgent Care',      specialty: ['Urgent Care', 'Minor Injuries'],               dLat: -0.004, dLng:  0.019, phone: '+1-800-555-0102', hours: 'Daily 7am–10pm',  rating: 4.2, waitMinutes: 30 },
  { id: 'c3', name: 'Primary Health Clinic',     specialty: ['Family Medicine', 'Pediatrics', 'Womens Health'], dLat: 0.015, dLng: -0.008, phone: '+1-800-555-0103', hours: 'Mon–Sat 9am–5pm', rating: 4.7, waitMinutes: null },
  { id: 'c4', name: 'District Hospital A&E',     specialty: ['Emergency', 'Cardiology', 'Neurology'],        dLat: -0.022, dLng:  0.031, phone: '+1-800-555-0104', hours: '24 / 7',          rating: 4.0, waitMinutes: 45 },
  { id: 'c5', name: 'Community Mental Health',   specialty: ['Mental Health', 'Psychiatry'],                 dLat:  0.018, dLng: -0.021, phone: '+1-800-555-0105', hours: 'Mon–Fri 9am–7pm', rating: 4.3, waitMinutes: 60 },
  { id: 'c6', name: 'Respiratory & Chest Clinic', specialty: ['Pulmonology', 'Respiratory', 'Urgent Care'],  dLat: -0.009, dLng: -0.016, phone: '+1-800-555-0106', hours: 'Mon–Sat 8am–6pm', rating: 4.4, waitMinutes: 20 },
];

// ── GET /api/clinics  ─────────────────────────────────────────────────
// Query: ?lat=&lng=&specialty=
router.get('/', (req, res) => {
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : null;
  const lng = req.query.lng ? parseFloat(req.query.lng as string) : null;
  const specialty = (req.query.specialty as string || '').toLowerCase();

  let clinics = BASE_OFFSETS.map((c) => {
    const cLat = lat ? lat + c.dLat : 0;
    const cLng = lng ? lng + c.dLng : 0;
    const distanceKm = lat && lng ? haversine(lat, lng, cLat, cLng) : null;
    return {
      id:          c.id,
      name:        c.name,
      specialty:   c.specialty,
      phone:       c.phone,
      hours:       c.hours,
      rating:      c.rating,
      available:   c.waitMinutes !== null,
      waitMinutes: c.waitMinutes,
      distanceKm:  distanceKm ? Number(distanceKm.toFixed(2)) : null,
      distanceLabel: distanceKm ? `${distanceKm.toFixed(1)} km` : 'Nearby',
    };
  });

  // Filter by specialty if provided
  if (specialty && specialty !== 'all') {
    clinics = clinics.filter((c) =>
      c.specialty.some((s) => s.toLowerCase().includes(specialty))
    );
  }

  // Sort by distance if we have location
  if (lat && lng) {
    clinics.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  }

  res.json({ clinics });
});

// ── GET /api/clinics/:id/doctors  ─────────────────────────────────────
// Returns doctors for a clinic by matching clinicId to facilityId on Doctor model.
// Falls back to seed data when DB unavailable.
router.get('/:id/doctors', async (req, res, next) => {
  try {
    const clinicId = req.params.id;

    if (dbReady()) {
      // Clinic portal ID matches facilityId on Doctor documents
      const docs = await Doctor.find({ facilityId: clinicId, active: true })
        .select('name specialty consultationMinutes languages bio')
        .lean();
      return res.json({
        clinicId,
        doctors: docs.map((d) => ({
          id:                  String(d._id),
          name:                d.name,
          specialty:           d.specialty,
          consultationMinutes: d.consultationMinutes,
          languages:           d.languages,
          bio:                 d.bio,
        })),
      });
    }

    // In-memory fallback: pull doctors from the registered facility registry
    const { findFacility } = await import('./facilities.js');
    const doctors = (findFacility(clinicId)?.doctors ?? []).map((d) => ({
      id:                  d.id,
      name:                d.name,
      specialty:           d.specialty,
      consultationMinutes: d.consultationMinutes,
      languages:           d.languages,
      bio:                 d.bio,
    }));
    return res.json({ clinicId, doctors });

  } catch (err) {
    next(err);
  }
});

// ── POST /api/referrals  ──────────────────────────────────────────────
// Patient books / requests an appointment
router.post('/referrals', async (req, res, next) => {
  try {
    const { sessionId, patientName, patientPhone, clinicId, clinicName, specialty, urgency, summary, imageAnalysis, preferredTime } = req.body;

    if (!patientName || !clinicId || !clinicName) {
      return next(new HttpError(400, 'patientName, clinicId, clinicName are required'));
    }

    // reason: Record<string, any> because imageAnalysis is optional mixed-schema
    const referral: Record<string, any> = {
      sessionId:    sessionId || 'anonymous',
      patientName:  patientName.slice(0, 100),
      patientPhone: patientPhone?.slice(0, 30),
      clinicId,
      clinicName,
      specialty:    specialty || 'General Practice',
      urgency:      urgency || 'see-clinician-soon',
      summary:      (summary || '').slice(0, 2000),
      preferredTime: preferredTime?.slice(0, 100),
      status:       'pending',
    };

    // Attach AI image analysis report if present (from image upload flow)
    if (imageAnalysis && typeof imageAnalysis === 'object') {
      referral.imageAnalysis = {
        imageType: imageAnalysis.imageType || 'unknown',
        findings: Array.isArray(imageAnalysis.findings) ? imageAnalysis.findings.slice(0, 10) : [],
        suggestedFollowUp: Array.isArray(imageAnalysis.suggestedFollowUp) ? imageAnalysis.suggestedFollowUp.slice(0, 10) : [],
        model: imageAnalysis.model || '',
      };
    }

    if (dbReady()) {
      const doc = await Referral.create(referral);
      return res.status(201).json({ referralId: doc._id, status: 'pending', message: 'Appointment request sent to clinic.' });
    }

    // In-memory fallback (no DB)
    const fakeId = `ref_${Date.now()}`;
    inMemoryReferrals.push({ _id: fakeId, ...referral, createdAt: new Date() });
    return res.status(201).json({ referralId: fakeId, status: 'pending', message: 'Appointment request sent to clinic.' });

  } catch (err) {
    next(err);
  }
});

// ── In-memory fallback when MongoDB not connected ─────────────────────
// Exported so appointments.ts can cross-post new bookings here, keeping
// the clinic Patients queue in sync with the new booking flow.
export const inMemoryReferrals: any[] = [];

// ── GET /api/referrals  ───────────────────────────────────────────────
// Clinic portal fetches patient queue
router.get('/referrals', async (_req, res, next) => {
  try {
    if (dbReady()) {
      const docs = await Referral.find().sort({ createdAt: -1 }).limit(100).lean();
      return res.json({ referrals: docs });
    }
    // In-memory fallback
    return res.json({ referrals: [...inMemoryReferrals].reverse() });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/referrals/:id  ─────────────────────────────────────────
// Clinic confirms / cancels
router.patch('/referrals/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['confirmed', 'cancelled', 'pending'].includes(status)) {
      return next(new HttpError(400, 'status must be confirmed | cancelled | pending'));
    }
    if (dbReady()) {
      const doc = await Referral.findByIdAndUpdate(req.params.id, { status }, { new: true });
      if (!doc) return next(new HttpError(404, 'Referral not found'));
      return res.json({ referral: doc });
    }
    const ref = inMemoryReferrals.find((r) => r._id === req.params.id);
    if (!ref) return next(new HttpError(404, 'Referral not found'));
    ref.status = status;
    return res.json({ referral: ref });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from 'express';
import { FacilityRegisterSchema, DoctorRegisterSchema } from '@medaccess/shared';
import {
  searchEnrolled,
  findFacilityById,
  getAvailableSlots,
  getAllActiveDoctors,
  registerFacility,
  registerDoctor,
} from '../services/facility.service.js';
import { HttpError } from '../middleware/error.js';

const router = Router();

// GET /api/facilities — search enrolled in-network facilities
router.get('/', async (req, res, next) => {
  try {
    const lat       = req.query.lat      ? parseFloat(req.query.lat as string)      : undefined;
    const lng       = req.query.lng      ? parseFloat(req.query.lng as string)      : undefined;
    const radius    = req.query.radius   ? parseFloat(req.query.radius as string)   : 100;
    const specialty = (req.query.specialty as string) || '';
    const type      = (req.query.type as string)      || '';
    const city      = (req.query.city as string)      || '';

    const facilities = await searchEnrolled({ specialty, lat, lng, type, city, radius });
    res.json({ facilities, total: facilities.length });
  } catch (err) { next(err); }
});

// GET /api/facilities/:id — single facility
router.get('/:id', async (req, res, next) => {
  try {
    const facility = await findFacilityById(req.params.id);
    if (!facility) return next(new HttpError(404, 'Facility not found'));
    res.json({ facility });
  } catch (err) { next(err); }
});

// GET /api/facilities/:id/doctors — doctors at a facility
router.get('/:id/doctors', async (req, res, next) => {
  try {
    const all = await getAllActiveDoctors();
    const doctors = (all as any[]).filter((d) => String(d.facilityId) === req.params.id);
    res.json({ doctors });
  } catch (err) { next(err); }
});

// GET /api/facilities/:id/slots?doctorId=&date= — available slots
router.get('/:id/slots', async (req, res, next) => {
  try {
    const { doctorId, date } = req.query as { doctorId?: string; date?: string };
    if (!doctorId || !date) return next(new HttpError(400, 'doctorId and date are required'));

    const slots = await getAvailableSlots(doctorId, req.params.id, date);
    if (slots === null) return next(new HttpError(404, 'Doctor not found at this facility'));

    res.json({ doctorId, facilityId: req.params.id, date, slots, availableSlots: slots.length });
  } catch (err) { next(err); }
});

// POST /api/facilities — register a new facility (open, immediately active)
router.post('/', async (req, res, next) => {
  try {
    const parsed = FacilityRegisterSchema.parse(req.body);
    const facility = await registerFacility(parsed);
    res.status(201).json({ facility });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return next(new HttpError(400, 'Invalid request', { publicMessage: err.errors?.[0]?.message }));
    }
    next(err);
  }
});

// POST /api/facilities/:id/doctors — register a doctor at a facility
router.post('/:id/doctors', async (req, res, next) => {
  try {
    const parsed = DoctorRegisterSchema.parse({ ...req.body, facilityId: req.params.id });
    const doctor = await registerDoctor(parsed);
    res.status(201).json({ doctor });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return next(new HttpError(400, 'Invalid request', { publicMessage: err.errors?.[0]?.message }));
    }
    next(err);
  }
});

export default router;

import { Router } from 'express';
import { PatientCreateSchema, PatientUpdateSchema } from '@medaccess/shared';
import { findByPhone, findOrCreate, updateByPhone } from '../services/patient.service.js';
import { HttpError } from '../middleware/error.js';

const router = Router();

// POST /api/patients — create or retrieve patient (idempotent by phone)
router.post('/', async (req, res, next) => {
  try {
    const parsed = PatientCreateSchema.parse(req.body);
    const patient = await findOrCreate(parsed);
    res.status(201).json({ patient });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return next(new HttpError(400, 'Invalid request', { publicMessage: err.errors?.[0]?.message }));
    }
    next(err);
  }
});

// GET /api/patients/me — get patient by phone (X-Patient-Phone header)
router.get('/me', async (req, res, next) => {
  try {
    const phone = req.headers['x-patient-phone'] as string | undefined;
    if (!phone) return next(new HttpError(400, 'X-Patient-Phone header required'));

    const patient = await findByPhone(phone);
    if (!patient) return next(new HttpError(404, 'Patient not found'));
    res.json({ patient });
  } catch (err) { next(err); }
});

// PATCH /api/patients/me — update profile
router.patch('/me', async (req, res, next) => {
  try {
    const phone = req.headers['x-patient-phone'] as string | undefined;
    if (!phone) return next(new HttpError(400, 'X-Patient-Phone header required'));

    const parsed = PatientUpdateSchema.parse(req.body);
    const patient = await updateByPhone(phone, parsed);
    if (!patient) return next(new HttpError(404, 'Patient not found'));
    res.json({ patient });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return next(new HttpError(400, 'Invalid request', { publicMessage: err.errors?.[0]?.message }));
    }
    next(err);
  }
});

export default router;

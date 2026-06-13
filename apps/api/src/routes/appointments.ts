import { Router } from 'express';
import { BookAppointmentSchema, AppointmentStatusSchema } from '@medaccess/shared';
import { book, getQueue, updateStatus, getPatientAppointments } from '../services/appointment.service.js';
import { findDoctorById } from '../services/facility.service.js';
import { getIdByPhone, findOrCreate } from '../services/patient.service.js';
import { HttpError } from '../middleware/error.js';

const router = Router();

// POST /api/appointments — manual booking (agent or patient-initiated)
router.post('/', async (req, res, next) => {
  try {
    const parsed = BookAppointmentSchema.parse(req.body);

    // Resolve the patient id. Prefer an existing record by phone; otherwise, if
    // the Find Care form supplied a name + phone, create the Patient now so the
    // appointment always has a valid patientId (C1: avoids a 500 + orphaned slot).
    let patientId = parsed.patientPhone ? (await getIdByPhone(parsed.patientPhone) ?? undefined) : undefined;
    if (!patientId && parsed.patientPhone && parsed.patientName) {
      const patient = await findOrCreate({
        fullName:          parsed.patientName,
        phone:             parsed.patientPhone,
        email:             parsed.patientEmail || undefined,
        sex:               parsed.patientSex,
        country:           'South Korea',
        preferredLanguage: 'Korean',
        knownAllergies:    [],
        chronicConditions: [],
        currentMedications: [],
      });
      patientId = String(patient._id);
    }
    if (!patientId) {
      return next(new HttpError(400, 'A registered phone number (or name + phone) is required to book.'));
    }

    const doctor = await findDoctorById(parsed.facilityId, parsed.doctorId);
    if (!doctor) return next(new HttpError(404, 'Doctor not found at this facility'));

    const result = await book({
      patientId,
      doctorId:            parsed.doctorId,
      facilityId:          parsed.facilityId,
      specialty:           parsed.specialty,
      urgency:             parsed.urgency,
      scheduledDate:       parsed.scheduledDate,
      scheduledTime:       parsed.scheduledTime,
      consultationMinutes: (doctor as any).consultationMinutes ?? 30,
      agentSummary:        parsed.agentSummary,
      agentAnalysis:       parsed.agentAnalysis,
      sessionId:           parsed.sessionId,
    });

    res.status(201).json(result);
  } catch (err: any) {
    if (err.message === 'SLOT_TAKEN') return next(new HttpError(409, 'This slot is already booked'));
    if (err.name === 'ZodError') {
      return next(new HttpError(400, 'Invalid request', { publicMessage: err.errors?.[0]?.message }));
    }
    next(err);
  }
});

// GET /api/appointments — clinic queue or patient history
router.get('/', async (req, res, next) => {
  try {
    const { facilityId, doctorId, status, patientPhone } = req.query as Record<string, string | undefined>;

    if (patientPhone) {
      const patientId = await getIdByPhone(patientPhone);
      if (!patientId) return res.json({ appointments: [], total: 0 });
      const appointments = await getPatientAppointments(patientId);
      return res.json({ appointments, total: (appointments as any[]).length });
    }

    const appointments = await getQueue({ facilityId, doctorId, status });
    res.json({ appointments, total: (appointments as any[]).length });
  } catch (err) { next(err); }
});

// PATCH /api/appointments/:id — update status (confirm / cancel / complete)
router.patch('/:id', async (req, res, next) => {
  try {
    const { status, doctorNotes } = req.body;

    // Require a valid status — without it updateStatus would write `undefined`
    // and corrupt the in-memory record (C12).
    if (!status) return next(new HttpError(400, 'A status value is required'));
    const parsed = AppointmentStatusSchema.safeParse(status);
    if (!parsed.success) return next(new HttpError(400, 'Invalid status value'));

    const appointment = await updateStatus(req.params.id, status, doctorNotes);
    if (!appointment) return next(new HttpError(404, 'Appointment not found'));
    res.json({ appointment });
  } catch (err) { next(err); }
});

export default router;

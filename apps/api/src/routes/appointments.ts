import { Router } from 'express';
import { BookAppointmentSchema, AppointmentStatusSchema } from '@medaccess/shared';
import { book, getQueue, updateStatus, getPatientAppointments } from '../services/appointment.service.js';
import { findDoctorById } from '../services/facility.service.js';
import { getIdByPhone } from '../services/patient.service.js';
import { confirmFromProposal } from '../services/agent-booking.service.js';
import { HttpError } from '../middleware/error.js';

const router = Router();

// POST /api/appointments — manual booking (agent or patient-initiated)
router.post('/', async (req, res, next) => {
  try {
    const parsed = BookAppointmentSchema.parse(req.body);

    const patientId = await getIdByPhone(parsed.patientPhone) ?? undefined;

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

// POST /api/appointments/confirm — confirm an agent booking proposal
router.post('/confirm', async (req, res, next) => {
  try {
    const { proposalKey, patientPhone, agentSummary, agentAnalysis, sessionId } = req.body;
    const patientId = patientPhone ? (await getIdByPhone(patientPhone) ?? undefined) : undefined;

    const result = await confirmFromProposal({
      proposalKey,
      patientId,
      agentSummary,
      agentAnalysis,
      sessionId,
    });

    res.status(201).json(result);
  } catch (err: any) {
    if (err.message === 'SLOT_TAKEN') return next(new HttpError(409, 'This slot is already booked'));
    if (err.message === 'Missing required booking fields') return next(new HttpError(400, err.message));
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

    if (status) {
      const parsed = AppointmentStatusSchema.safeParse(status);
      if (!parsed.success) return next(new HttpError(400, 'Invalid status value'));
    }

    const appointment = await updateStatus(req.params.id, status, doctorNotes);
    if (!appointment) return next(new HttpError(404, 'Appointment not found'));
    res.json({ appointment });
  } catch (err) { next(err); }
});

export default router;

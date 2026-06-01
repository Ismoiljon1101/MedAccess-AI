/**
 * /api/appointments — book a slot and retrieve appointments
 *
 * POST /api/appointments        — book a slot (creates Appointment, locks TimeSlot)
 * GET  /api/appointments        — list appointments (clinic portal queue) ?status=&doctorId=
 * PATCH /api/appointments/:id   — update status (confirm / cancel / complete)
 */
import { Router } from 'express';
import { dbReady, Appointment, TimeSlot, Referral } from '@medaccess/db';
import { HttpError } from '../middleware/error.js';
import { inMemoryBookedSlots, findFacility, findDoctor } from './facilities.js';
import { inMemoryReferrals } from './clinics.js';

const router = Router();

// ── In-memory appointment store (no-DB fallback) ──────────────────────────────
interface MemAppointment {
  _id: string;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  patientAge?: number;
  patientSex?: string;
  slotId: string;      // `${doctorId}_${date}_${startTime}` in-memory key
  doctorId: string;
  facilityId: string;
  specialty: string;
  urgency: string;
  maAgentSummary?: string;
  sessionId?: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  doctorNotes?: string;
  createdAt: Date;
}

const inMemoryAppointments: MemAppointment[] = [];

// ── POST /api/appointments ────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const {
      patientName, patientPhone, patientEmail, patientAge, patientSex,
      doctorId, facilityId, date, startTime,
      specialty, urgency, maAgentSummary, sessionId,
    } = req.body;

    // Validate required fields
    if (!patientName?.trim()) return next(new HttpError(400, 'patientName is required'));
    if (!doctorId)            return next(new HttpError(400, 'doctorId is required'));
    if (!facilityId)          return next(new HttpError(400, 'facilityId is required'));
    if (!date)                return next(new HttpError(400, 'date is required (YYYY-MM-DD)'));
    if (!startTime)           return next(new HttpError(400, 'startTime is required (HH:MM)'));

    // Verify doctor exists in the registered facility registry
    const doctor = findDoctor(facilityId, doctorId);
    if (!doctor) return next(new HttpError(404, 'Doctor not found at this facility'));

    // Resolve facility name for referral cross-post
    const facility = findFacility(facilityId);
    const facilityName = facility?.name ?? facilityId;

    // Check slot availability (in-memory)
    const slotKey = `${doctorId}_${date}`;
    const booked = inMemoryBookedSlots.get(slotKey) ?? new Set<string>();
    if (booked.has(startTime)) {
      return next(new HttpError(409, 'This time slot is already booked. Please choose another.'));
    }

    // Calculate endTime from consultationMinutes
    const [h, m] = startTime.split(':').map(Number);
    const endTotalMins = h * 60 + m + doctor.consultationMinutes;
    const endTime = `${String(Math.floor(endTotalMins / 60)).padStart(2, '0')}:${String(endTotalMins % 60).padStart(2, '0')}`;

    if (dbReady()) {
      // ── DB path: create TimeSlot + Appointment ──────────────────────────────
      const slot = await TimeSlot.create({
        doctorId,
        facilityId,
        date,
        startTime,
        endTime,
        isBooked: true,
      });

      const appt = await Appointment.create({
        patientName:    patientName.trim().slice(0, 100),
        patientPhone:   patientPhone?.slice(0, 30),
        patientEmail:   patientEmail?.slice(0, 100),
        patientAge:     patientAge ? Number(patientAge) : undefined,
        patientSex:     patientSex,
        slotId:         slot._id,
        doctorId,
        facilityId,
        specialty:      specialty || doctor.specialty,
        urgency:        urgency || 'see-clinician-soon',
        maAgentSummary: maAgentSummary?.slice(0, 4000),
        sessionId,
        status:         'pending',
      });

      // Back-link slot → appointment
      await TimeSlot.findByIdAndUpdate(slot._id, { appointmentId: appt._id });

      // Cross-post to clinic Patients queue as a Referral so the clinic portal
      // sees this booking immediately — referral.summary includes doctor + slot.
      await Referral.create({
        sessionId:    sessionId || 'anonymous',
        patientName:  patientName.trim().slice(0, 100),
        patientPhone: patientPhone?.slice(0, 30),
        clinicId:     facilityId,
        clinicName:   facilityName,
        specialty:    specialty || doctor.specialty,
        urgency:      urgency || 'see-clinician-soon',
        summary:      `Booked: ${doctor.name} · ${date} ${startTime}–${endTime}. ${(maAgentSummary || '').slice(0, 1800)}`,
        preferredTime: `${date} ${startTime}`,
        status:       'pending',
        appointmentId: String(appt._id),
      }).catch(() => { /* non-fatal — appointment still created */ });

      return res.status(201).json({
        appointmentId: appt._id,
        slotId:        slot._id,
        doctorName:    doctor.name,
        date, startTime, endTime,
        status: 'pending',
        message: 'Appointment booked successfully.',
      });
    }

    // ── In-memory path ────────────────────────────────────────────────────────
    // Lock slot
    booked.add(startTime);
    inMemoryBookedSlots.set(slotKey, booked);

    const apptId = `appt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newAppt: MemAppointment = {
      _id:           apptId,
      patientName:   patientName.trim().slice(0, 100),
      patientPhone:  patientPhone?.slice(0, 30),
      patientEmail:  patientEmail?.slice(0, 100),
      patientAge:    patientAge ? Number(patientAge) : undefined,
      patientSex,
      slotId:        `${slotKey}_${startTime}`,
      doctorId,
      facilityId,
      specialty:     specialty || doctor.specialty,
      urgency:       urgency || 'see-clinician-soon',
      maAgentSummary: maAgentSummary?.slice(0, 4000),
      sessionId,
      date, startTime, endTime,
      status:        'pending',
      createdAt:     new Date(),
    };
    inMemoryAppointments.push(newAppt);

    // Cross-post to in-memory referrals so clinic Patients queue shows this booking
    inMemoryReferrals.push({
      _id:          `ref_${apptId}`,
      sessionId:    sessionId || 'anonymous',
      patientName:  newAppt.patientName,
      patientPhone: newAppt.patientPhone,
      clinicId:     facilityId,
      clinicName:   facilityName,
      specialty:    newAppt.specialty,
      urgency:      newAppt.urgency,
      summary:      `Booked: ${doctor.name} · ${date} ${startTime}–${endTime}. ${(maAgentSummary || '').slice(0, 1800)}`,
      preferredTime: `${date} ${startTime}`,
      status:       'pending',
      appointmentId: apptId,
      createdAt:    new Date(),
    });

    return res.status(201).json({
      appointmentId: apptId,
      slotId:        newAppt.slotId,
      doctorName:    doctor.name,
      date, startTime, endTime,
      status: 'pending',
      message: 'Appointment booked successfully.',
    });

  } catch (err) {
    next(err);
  }
});

// ── GET /api/appointments ─────────────────────────────────────────────────────
// Query: ?status=pending&doctorId=d1&facilityId=f1&date=2025-06-01
router.get('/', async (req, res, next) => {
  try {
    const { status, doctorId, facilityId, date } = req.query as Record<string, string | undefined>;

    if (dbReady()) {
      const filter: Record<string, unknown> = {};
      if (status)     filter['status']     = status;
      if (doctorId)   filter['doctorId']   = doctorId;
      if (facilityId) filter['facilityId'] = facilityId;

      const docs = await Appointment.find(filter).sort({ createdAt: -1 }).limit(200).lean();
      return res.json({ appointments: docs, total: docs.length });
    }

    // In-memory filter
    let results = [...inMemoryAppointments];
    if (status)     results = results.filter((a) => a.status === status);
    if (doctorId)   results = results.filter((a) => a.doctorId === doctorId);
    if (facilityId) results = results.filter((a) => a.facilityId === facilityId);
    if (date)       results = results.filter((a) => a.date === date);

    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return res.json({ appointments: results, total: results.length });

  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/appointments/:id ───────────────────────────────────────────────
router.patch('/:id', async (req, res, next) => {
  try {
    const { status, doctorNotes } = req.body;

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (status && !validStatuses.includes(status)) {
      return next(new HttpError(400, `status must be one of: ${validStatuses.join(' | ')}`));
    }

    if (dbReady()) {
      const update: Record<string, unknown> = {};
      if (status)      { update['status'] = status; }
      if (doctorNotes) { update['doctorNotes'] = doctorNotes.slice(0, 4000); }
      if (status === 'confirmed')  update['confirmedAt'] = new Date();
      if (status === 'completed')  update['completedAt'] = new Date();

      const doc = await Appointment.findByIdAndUpdate(req.params.id, update, { new: true });
      if (!doc) return next(new HttpError(404, 'Appointment not found'));
      return res.json({ appointment: doc });
    }

    // In-memory
    const appt = inMemoryAppointments.find((a) => a._id === req.params.id);
    if (!appt) return next(new HttpError(404, 'Appointment not found'));
    if (status)      appt.status = status;
    if (doctorNotes) appt.doctorNotes = doctorNotes.slice(0, 4000);
    return res.json({ appointment: appt });

  } catch (err) {
    next(err);
  }
});

export default router;

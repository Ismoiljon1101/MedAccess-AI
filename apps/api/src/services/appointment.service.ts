import { Appointment, TimeSlot, dbReady } from '@medaccess/db';
import type { AppointmentStatus } from '@medaccess/db';
import { inMemoryBookedSlots } from './facility.service.js';

// ── In-memory store ───────────────────────────────────────────────────────────
interface MemAppointment {
  _id: string;
  patientId?: string;
  doctorId: string;
  facilityId: string;
  specialty: string;
  urgency: string;
  agentSummary?: string;
  agentAnalysis?: { symptomsId?: string; triageId?: string; imageReportId?: string };
  sessionId?: string;
  scheduledDate: string;
  scheduledTime: string;
  scheduledEndTime: string;
  status: AppointmentStatus;
  doctorNotes?: string;
  createdAt: Date;
}

const inMemoryAppointments: MemAppointment[] = [];

// ── Shared input type ─────────────────────────────────────────────────────────
export interface BookingInput {
  patientId?: string;
  doctorId: string;
  facilityId: string;
  specialty: string;
  urgency?: string;
  scheduledDate: string;
  scheduledTime: string;
  consultationMinutes: number;
  agentSummary?: string;
  agentAnalysis?: { symptomsId?: string; triageId?: string; imageReportId?: string };
  sessionId?: string;
}

// ── Book appointment ──────────────────────────────────────────────────────────
export async function book(input: BookingInput) {
  const [h, m] = input.scheduledTime.split(':').map(Number);
  const endMins = h * 60 + m + input.consultationMinutes;
  const endTime = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;

  // Check slot availability (in-memory gate, also enforced by DB uniqueness)
  const slotKey = `${input.doctorId}_${input.scheduledDate}`;
  const booked = inMemoryBookedSlots.get(slotKey) ?? new Set<string>();
  if (booked.has(input.scheduledTime)) throw new Error('SLOT_TAKEN');

  if (dbReady()) {
    const slot = await TimeSlot.create({
      doctorId:   input.doctorId,
      facilityId: input.facilityId,
      date:       input.scheduledDate,
      startTime:  input.scheduledTime,
      endTime,
      isBooked:   true,
    });

    const appt = await Appointment.create({
      patientId:     input.patientId,
      doctorId:      input.doctorId,
      facilityId:    input.facilityId,
      slotId:        slot._id,
      specialty:     input.specialty,
      urgency:       input.urgency ?? 'see-clinician-soon',
      agentSummary:  input.agentSummary?.slice(0, 4000),
      agentAnalysis: input.agentAnalysis,
      sessionId:     input.sessionId,
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime,
      status:        'pending',
    });

    await TimeSlot.findByIdAndUpdate(slot._id, { appointmentId: appt._id });

    return {
      appointmentId:   String(appt._id),
      slotId:          String(slot._id),
      scheduledDate:   input.scheduledDate,
      scheduledTime:   input.scheduledTime,
      scheduledEndTime: endTime,
      status:          'pending' as AppointmentStatus,
    };
  }

  // In-memory path
  booked.add(input.scheduledTime);
  inMemoryBookedSlots.set(slotKey, booked);

  const apptId = `appt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  inMemoryAppointments.push({
    _id:             apptId,
    patientId:       input.patientId,
    doctorId:        input.doctorId,
    facilityId:      input.facilityId,
    specialty:       input.specialty,
    urgency:         input.urgency ?? 'see-clinician-soon',
    agentSummary:    input.agentSummary?.slice(0, 4000),
    agentAnalysis:   input.agentAnalysis,
    sessionId:       input.sessionId,
    scheduledDate:   input.scheduledDate,
    scheduledTime:   input.scheduledTime,
    scheduledEndTime: endTime,
    status:          'pending',
    createdAt:       new Date(),
  });

  return {
    appointmentId:   apptId,
    scheduledDate:   input.scheduledDate,
    scheduledTime:   input.scheduledTime,
    scheduledEndTime: endTime,
    status:          'pending' as AppointmentStatus,
  };
}

// ── Clinic queue ──────────────────────────────────────────────────────────────
export async function getQueue(filter: {
  facilityId?: string;
  doctorId?: string;
  status?: string;
}): Promise<any[]> {
  if (dbReady()) {
    const q: Record<string, unknown> = {};
    if (filter.facilityId) q['facilityId'] = filter.facilityId;
    if (filter.status)     q['status']     = filter.status;

    // Resilience: skip legacy/corrupt rows whose doctorId/facilityId are not real
    // ObjectIds (e.g. "d14" from the old fake-data era). A single such row would
    // otherwise make .populate() throw a Cast error and 500 the whole queue.
    if (filter.doctorId) q['doctorId'] = filter.doctorId;
    else                 q['doctorId'] = { $type: 'objectId' };
    if (!filter.facilityId) q['facilityId'] = { $type: 'objectId' };

    return Appointment.find(q)
      .populate('patientId', 'fullName phone email sex dateOfBirth knownAllergies chronicConditions currentMedications emergencyContact')
      .populate('doctorId', 'name specialty')
      .populate('facilityId', 'name city address phone')
      .populate({ path: 'agentAnalysis.symptomsId', select: 'urgency differentials recommendedNextSteps' })
      .populate({ path: 'agentAnalysis.triageId',   select: 'level levelLabel targetTimeToCare actions warningSigns' })
      .populate({ path: 'agentAnalysis.imageReportId', select: 'imageType findings suggestedFollowUp' })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
  }

  let results = [...inMemoryAppointments];
  if (filter.facilityId) results = results.filter((a) => a.facilityId === filter.facilityId);
  if (filter.doctorId)   results = results.filter((a) => a.doctorId === filter.doctorId);
  if (filter.status)     results = results.filter((a) => a.status === filter.status);
  return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// ── Patient appointment history ───────────────────────────────────────────────
export async function getPatientAppointments(patientId: string): Promise<any[]> {
  if (dbReady()) {
    // Same resilience as getQueue: skip corrupt legacy rows so one bad doctor/
    // facility ref can't 500 the patient's whole history via .populate().
    return Appointment.find({ patientId, doctorId: { $type: 'objectId' }, facilityId: { $type: 'objectId' } })
      .populate('doctorId', 'name specialty')
      .populate('facilityId', 'name city address phone')
      .sort({ scheduledDate: -1 })
      .lean();
  }
  return inMemoryAppointments
    .filter((a) => a.patientId === patientId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// ── Update status ─────────────────────────────────────────────────────────────
export async function updateStatus(
  id: string,
  status: AppointmentStatus,
  doctorNotes?: string,
): Promise<any | null> {
  if (dbReady()) {
    const update: Record<string, unknown> = { status };
    if (doctorNotes)       update['doctorNotes'] = doctorNotes.slice(0, 4000);
    if (status === 'confirmed') update['confirmedAt'] = new Date();
    if (status === 'completed') update['completedAt'] = new Date();
    return Appointment.findByIdAndUpdate(id, update, { new: true }).lean();
  }

  const appt = inMemoryAppointments.find((a) => a._id === id);
  if (!appt) return null;
  appt.status = status;
  if (doctorNotes) appt.doctorNotes = doctorNotes.slice(0, 4000);
  return appt;
}

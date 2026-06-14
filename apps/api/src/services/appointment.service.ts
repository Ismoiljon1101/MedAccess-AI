import { Appointment, TimeSlot, dbReady } from '@medaccess/db';
import type { AppointmentStatus } from '@medaccess/db';
import { inMemoryBookedSlots, inMemoryDoctors, inMemoryFacilities } from './facility.service.js';
import { findPatientByIdInMemory } from './patient.service.js';

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
    // The in-memory gate above is inert in DB mode, so guard against a taken slot
    // here too. The unique index on (doctorId,date,startTime) is the race backstop.
    const existing = await TimeSlot.findOne({
      doctorId:   input.doctorId,
      date:       input.scheduledDate,
      startTime:  input.scheduledTime,
      isBooked:   true,
    }).lean();
    if (existing) throw new Error('SLOT_TAKEN');

    const slot = await TimeSlot.create({
      doctorId:   input.doctorId,
      facilityId: input.facilityId,
      date:       input.scheduledDate,
      startTime:  input.scheduledTime,
      endTime,
      isBooked:   true,
    }).catch((e: any) => {
      // Duplicate-key from the unique index = a concurrent booking won the race.
      if (e?.code === 11000) throw new Error('SLOT_TAKEN');
      throw e;
    });

    let appt;
    try {
      appt = await Appointment.create({
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
    } catch (e) {
      // Appointment failed (e.g. validation) — free the slot we just reserved so
      // it isn't blocked forever (C1: no orphaned TimeSlot).
      await TimeSlot.findByIdAndDelete(slot._id).catch(() => {});
      throw e;
    }

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

// ── Hydrate an in-memory appointment with populated-like name objects ──────────
// Mirrors the DB .populate() shape so the clinic queue / patient records show
// real names even when running without Mongo (B4).
function hydrateInMemory(a: MemAppointment): any {
  const doctor   = inMemoryDoctors.find((d) => d.id === a.doctorId);
  const facility = inMemoryFacilities.find((f) => f.id === a.facilityId);
  const patient  = a.patientId ? findPatientByIdInMemory(a.patientId) : null;
  return {
    ...a,
    doctorId: doctor
      ? { _id: doctor.id, name: doctor.name, specialty: doctor.specialty }
      : a.doctorId,
    facilityId: facility
      ? { _id: facility.id, name: facility.name, city: facility.city, address: facility.address, phone: facility.phone }
      : a.facilityId,
    patientId: patient
      ? {
          _id: patient._id, fullName: patient.fullName, phone: patient.phone, sex: patient.sex,
          dateOfBirth: patient.dateOfBirth, knownAllergies: patient.knownAllergies,
          chronicConditions: patient.chronicConditions, currentMedications: patient.currentMedications,
          emergencyContact: patient.emergencyContact,
        }
      : a.patientId,
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
    if (filter.status)     q['status']     = filter.status;

    // Resilience: skip legacy/corrupt rows whose doctorId/facilityId are not real
    // ObjectIds (e.g. "d14" from the old fake-data era). A single such row would
    // otherwise make .populate() throw a Cast error and 500 the whole queue.
    // A malformed *filter* value would do the same, so validate before using it.
    const isObjectId = (s: string) => /^[a-fA-F0-9]{24}$/.test(s);
    if (filter.facilityId && isObjectId(filter.facilityId)) q['facilityId'] = filter.facilityId;
    else                                                     q['facilityId'] = { $type: 'objectId' };
    if (filter.doctorId && isObjectId(filter.doctorId)) q['doctorId'] = filter.doctorId;
    else                                                 q['doctorId'] = { $type: 'objectId' };

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
  return results
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(hydrateInMemory);
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
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(hydrateInMemory);
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
    const updated = await Appointment.findByIdAndUpdate(id, update, { new: true }).lean();
    // Cancelling must free the time slot so it can be booked again — otherwise a
    // declined appointment blocks that doctor/date/time forever.
    if (updated && status === 'cancelled' && (updated as any).slotId) {
      await TimeSlot.findByIdAndUpdate((updated as any).slotId, { isBooked: false, appointmentId: null }).catch(() => {});
    }
    return updated;
  }

  const appt = inMemoryAppointments.find((a) => a._id === id);
  if (!appt) return null;
  appt.status = status;
  if (doctorNotes) appt.doctorNotes = doctorNotes.slice(0, 4000);
  // Free the in-memory slot gate on cancel so the time reopens.
  if (status === 'cancelled') {
    const booked = inMemoryBookedSlots.get(`${appt.doctorId}_${appt.scheduledDate}`);
    booked?.delete(appt.scheduledTime);
  }
  return appt;
}

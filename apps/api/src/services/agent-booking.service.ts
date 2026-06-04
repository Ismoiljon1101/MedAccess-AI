import { searchEnrolled, findDoctorById, findNextAvailableSlot } from './facility.service.js';
import { book } from './appointment.service.js';
import type { BookingInput } from './appointment.service.js';

// ── Booking proposal (pre-booking, awaiting patient confirmation) ─────────────
export interface BookingProposal {
  proposalKey: string;
  facilityId: string;
  facilityName: string;
  facilityAddress?: string;
  facilityPhone?: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  proposedDate: string;
  proposedTime: string;
  proposedEndTime: string;
  specialty: string;
  urgency: string;
  distanceKm?: number;
  fromNaver: false;
}

interface StoredProposal extends BookingProposal {
  patientId?: string;
  sessionId?: string;
  consultationMinutes: number;
  createdAt: number;
}

const PROPOSAL_TTL_MS = 30 * 60 * 1000; // 30 minutes
const proposals = new Map<string, StoredProposal>();

function purgeExpired() {
  const cutoff = Date.now() - PROPOSAL_TTL_MS;
  for (const [key, p] of proposals) {
    if (p.createdAt < cutoff) proposals.delete(key);
  }
}

// ── Find best option and create a proposal ────────────────────────────────────
export async function findBestOption(opts: {
  specialty: string;
  urgency: string;
  lat?: number;
  lng?: number;
  patientId?: string;
  sessionId?: string;
}): Promise<BookingProposal | null> {
  purgeExpired();

  const facilities = await searchEnrolled({
    specialty: opts.specialty,
    lat: opts.lat,
    lng: opts.lng,
    radius: 100,
  });

  for (const facility of facilities) {
    // Pick the first doctor whose specialty matches (or any doctor)
    const matchingDoctor =
      facility.doctors?.find((d: any) =>
        d.specialty.toLowerCase().includes(opts.specialty.toLowerCase()),
      ) ?? facility.doctors?.[0];

    if (!matchingDoctor) continue;

    const slot = await findNextAvailableSlot(matchingDoctor.id, facility.id);
    if (!slot) continue;

    const consultMins = matchingDoctor.consultationMinutes ?? 30;
    const [h, m] = slot.startTime.split(':').map(Number);
    const endMins = h * 60 + m + consultMins;
    const endTime = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;

    const proposalKey = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const proposal: BookingProposal = {
      proposalKey,
      facilityId:      facility.id,
      facilityName:    facility.name,
      facilityAddress: facility.address,
      facilityPhone:   facility.phone,
      doctorId:        matchingDoctor.id,
      doctorName:      matchingDoctor.name,
      doctorSpecialty: matchingDoctor.specialty,
      proposedDate:    slot.date,
      proposedTime:    slot.startTime,
      proposedEndTime: endTime,
      specialty:       opts.specialty,
      urgency:         opts.urgency,
      distanceKm:      facility.distanceKm,
      fromNaver:       false,
    };

    proposals.set(proposalKey, {
      ...proposal,
      patientId:           opts.patientId,
      sessionId:           opts.sessionId,
      consultationMinutes: consultMins,
      createdAt:           Date.now(),
    });

    return proposal;
  }

  return null;
}

// ── Confirm a proposal → creates Appointment ──────────────────────────────────
export async function confirmFromProposal(opts: {
  proposalKey?: string;
  // Direct booking fields (when no proposalKey)
  facilityId?: string;
  doctorId?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  specialty?: string;
  urgency?: string;
  consultationMinutes?: number;
  // Context
  patientId?: string;
  sessionId?: string;
  agentSummary?: string;
  agentAnalysis?: { symptomsId?: string; triageId?: string; imageReportId?: string };
}) {
  let input: BookingInput;

  if (opts.proposalKey && proposals.has(opts.proposalKey)) {
    const p = proposals.get(opts.proposalKey)!;
    proposals.delete(opts.proposalKey);

    input = {
      patientId:           opts.patientId ?? p.patientId,
      doctorId:            p.doctorId,
      facilityId:          p.facilityId,
      specialty:           p.specialty,
      urgency:             p.urgency,
      scheduledDate:       p.proposedDate,
      scheduledTime:       p.proposedTime,
      consultationMinutes: p.consultationMinutes,
      agentSummary:        opts.agentSummary,
      agentAnalysis:       opts.agentAnalysis,
      sessionId:           opts.sessionId ?? p.sessionId,
    };
  } else {
    if (!opts.facilityId || !opts.doctorId || !opts.scheduledDate || !opts.scheduledTime) {
      throw new Error('Missing required booking fields');
    }
    // Fallback: look up consultationMinutes from doctor
    let consultMins = opts.consultationMinutes ?? 30;
    if (!opts.consultationMinutes) {
      const doctor = await findDoctorById(opts.facilityId, opts.doctorId);
      consultMins = (doctor as any)?.consultationMinutes ?? 30;
    }
    input = {
      patientId:           opts.patientId,
      doctorId:            opts.doctorId,
      facilityId:          opts.facilityId,
      specialty:           opts.specialty ?? 'General Practice',
      urgency:             opts.urgency ?? 'see-clinician-soon',
      scheduledDate:       opts.scheduledDate,
      scheduledTime:       opts.scheduledTime,
      consultationMinutes: consultMins,
      agentSummary:        opts.agentSummary,
      agentAnalysis:       opts.agentAnalysis,
      sessionId:           opts.sessionId,
    };
  }

  return book(input);
}

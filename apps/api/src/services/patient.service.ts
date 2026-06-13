import { Patient, dbReady } from '@medaccess/db';
import type { PatientCreate, PatientUpdate } from '@medaccess/shared';

// In-memory store for no-DB runs
interface MemPatient {
  _id: string;
  phone: string;
  fullName: string;
  dateOfBirth?: string;
  sex?: string;
  bloodType?: string;
  email?: string;
  address?: string;
  city?: string;
  country: string;
  preferredLanguage: string;
  knownAllergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
  emergencyContact?: { name: string; phone: string; relationship: string };
  active: boolean;
  createdAt: Date;
}

const inMemoryPatients = new Map<string, MemPatient>(); // keyed by phone

export async function findByPhone(phone: string): Promise<any | null> {
  if (dbReady()) return Patient.findOne({ phone }).lean();
  return inMemoryPatients.get(phone) ?? null;
}

export async function getIdByPhone(phone: string): Promise<string | null> {
  const p = await findByPhone(phone);
  return p ? String(p._id) : null;
}

/** In-memory patient lookup by _id — used to hydrate names in the no-DB path. */
export function findPatientByIdInMemory(id: string): MemPatient | null {
  for (const p of inMemoryPatients.values()) {
    if (p._id === id) return p;
  }
  return null;
}

export async function findOrCreate(data: PatientCreate): Promise<any> {
  if (dbReady()) {
    const existing = await Patient.findOne({ phone: data.phone });
    if (existing) return existing.toObject();
    return (await Patient.create({
      ...data,
      country: data.country || 'South Korea',
      preferredLanguage: data.preferredLanguage || 'Korean',
    })).toObject();
  }

  const existing = inMemoryPatients.get(data.phone);
  if (existing) return existing;

  const newPatient: MemPatient = {
    _id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    phone: data.phone,
    fullName: data.fullName,
    dateOfBirth: data.dateOfBirth,
    sex: data.sex,
    bloodType: data.bloodType,
    email: data.email,
    address: data.address,
    city: data.city,
    country: data.country || 'South Korea',
    preferredLanguage: data.preferredLanguage || 'Korean',
    knownAllergies: data.knownAllergies ?? [],
    chronicConditions: data.chronicConditions ?? [],
    currentMedications: data.currentMedications ?? [],
    emergencyContact: data.emergencyContact,
    active: true,
    createdAt: new Date(),
  };
  inMemoryPatients.set(data.phone, newPatient);
  return newPatient;
}

export async function updateByPhone(phone: string, data: PatientUpdate): Promise<any | null> {
  if (dbReady()) {
    return Patient.findOneAndUpdate({ phone }, { $set: data }, { new: true }).lean();
  }
  const patient = inMemoryPatients.get(phone);
  if (!patient) return null;
  const updated = { ...patient, ...data };
  inMemoryPatients.set(phone, updated);
  return updated;
}

import { Facility, Doctor, TimeSlot, dbReady } from '@medaccess/db';
import type { FacilityRegister, DoctorRegister } from '@medaccess/shared';

// ── In-memory stores (used when DB not connected) ─────────────────────────────
interface MemFacility {
  id: string;
  name: string;
  type: 'hospital' | 'clinic' | 'pharmacy';
  address?: string;
  city?: string;
  country: string;
  lat: number;
  lng: number;
  phone?: string;
  email?: string;
  specialties: string[];
  enrolled: boolean;
  active: boolean;
  createdAt: Date;
}

interface MemDoctor {
  id: string;
  name: string;
  specialty: string;
  facilityId: string;
  licenseNo?: string;
  phone?: string;
  email?: string;
  bio?: string;
  languages: string[];
  consultationMinutes: number;
  active: boolean;
  createdAt: Date;
}

export const inMemoryFacilities: MemFacility[] = [];
export const inMemoryDoctors: MemDoctor[] = [];
export const inMemoryBookedSlots = new Map<string, Set<string>>();

// ── Haversine distance (km) ───────────────────────────────────────────────────
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Slot generation (09:00–12:00 / 13:00–17:00, skip Sunday) ─────────────────
export function generateSlots(
  consultationMinutes: number,
  dateStr: string,
): { startTime: string; endTime: string }[] {
  const d = new Date(dateStr + 'T00:00:00');
  if (d.getDay() === 0) return [];

  const slots: { startTime: string; endTime: string }[] = [];
  for (const { startH, endH } of [{ startH: 9, endH: 12 }, { startH: 13, endH: 17 }]) {
    let cur = startH * 60;
    while (cur + consultationMinutes <= endH * 60) {
      const e = cur + consultationMinutes;
      slots.push({
        startTime: `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`,
        endTime:   `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`,
      });
      cur = e;
    }
  }
  return slots;
}

// ── Lookups ───────────────────────────────────────────────────────────────────
export async function findFacilityById(id: string): Promise<any | null> {
  if (dbReady()) return Facility.findById(id).lean();
  return inMemoryFacilities.find((f) => f.id === id) ?? null;
}

export async function findDoctorById(facilityId: string, doctorId: string): Promise<any | null> {
  if (dbReady()) {
    return Doctor.findOne({ _id: doctorId, facilityId, active: true }).lean();
  }
  return inMemoryDoctors.find((d) => d.id === doctorId && d.facilityId === facilityId) ?? null;
}

export async function getAllActiveDoctors(specialty?: string): Promise<any[]> {
  if (dbReady()) {
    const q: Record<string, any> = { active: true };
    if (specialty) q['specialty'] = { $regex: specialty, $options: 'i' };
    return Doctor.find(q).lean();
  }
  return inMemoryDoctors.filter(
    (d) => d.active && (!specialty || d.specialty.toLowerCase().includes(specialty.toLowerCase())),
  );
}

// ── Search enrolled facilities (Tier 1) ───────────────────────────────────────
export async function searchEnrolled(opts: {
  specialty?: string;
  lat?: number;
  lng?: number;
  type?: string;
  city?: string;
  radius?: number;
}): Promise<any[]> {
  const { specialty, lat, lng, type, city, radius = 100 } = opts;

  let results: any[] = [];

  if (dbReady()) {
    const query: Record<string, any> = { active: true, enrolled: true };
    if (type && type !== 'all') query['type'] = type;
    if (city) query['city'] = { $regex: city, $options: 'i' };
    if (specialty && specialty !== 'all') query['specialties'] = { $regex: specialty, $options: 'i' };

    const dbFacilities = await Facility.find(query).lean();
    results = await Promise.all(
      dbFacilities.map(async (f) => {
        const doctors = await Doctor.find({ facilityId: String(f._id), active: true }).lean();
        const distKm = lat != null && lng != null
          ? Number(haversine(lat, lng, f.lat, f.lng).toFixed(2))
          : null;
        return {
          id:           String(f._id),
          name:         f.name,
          type:         f.type,
          address:      f.address,
          city:         f.city,
          country:      f.country,
          lat:          f.lat,
          lng:          f.lng,
          phone:        f.phone,
          openingHours: (f.openingHours ?? []).map((h: any) => `${h.day} ${h.open}–${h.close}`).join(', '),
          specialties:  f.specialties,
          enrolled:     true,
          distanceKm:   distKm,
          doctors: doctors.map((d) => ({
            id:                  String(d._id),
            facilityId:          String(f._id),
            name:                d.name,
            specialty:           d.specialty,
            consultationMinutes: d.consultationMinutes,
            languages:           d.languages,
            bio:                 d.bio,
          })),
        };
      }),
    );
  } else {
    results = inMemoryFacilities
      .filter(
        (f) =>
          f.active && f.enrolled &&
          (!type || type === 'all' || f.type === type) &&
          (!city || (f.city ?? '').toLowerCase().includes(city.toLowerCase())) &&
          (!specialty || f.specialties.some((s) => s.toLowerCase().includes(specialty!.toLowerCase()))),
      )
      .map((f) => ({
        ...f,
        id:         f.id,
        enrolled:   true,
        distanceKm: lat != null && lng != null ? Number(haversine(lat, lng, f.lat, f.lng).toFixed(2)) : null,
        doctors: inMemoryDoctors
          .filter((d) => d.facilityId === f.id && d.active)
          .map((d) => ({
            id: d.id, facilityId: f.id, name: d.name, specialty: d.specialty,
            consultationMinutes: d.consultationMinutes, languages: d.languages,
          })),
      }));
  }

  if (lat != null && lng != null) {
    results = results
      .filter((f) => (f.distanceKm ?? 0) <= radius)
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  }

  return results;
}

// ── Get available slots for a doctor on a date ────────────────────────────────
export async function getAvailableSlots(
  doctorId: string,
  facilityId: string,
  dateStr: string,
): Promise<{ startTime: string; endTime: string }[] | null> {
  const doctor = await findDoctorById(facilityId, doctorId);
  if (!doctor) return null;

  const consultMins = doctor.consultationMinutes ?? 30;
  const all = generateSlots(consultMins, dateStr);

  let bookedTimes = new Set<string>();
  if (dbReady()) {
    const booked = await TimeSlot.find({ doctorId, facilityId, date: dateStr, isBooked: true }).lean();
    bookedTimes = new Set(booked.map((s) => s.startTime));
  } else {
    bookedTimes = inMemoryBookedSlots.get(`${doctorId}_${dateStr}`) ?? new Set();
  }

  return all.filter((s) => !bookedTimes.has(s.startTime));
}

// ── Find next available slot within 7 days ───────────────────────────────────
export async function findNextAvailableSlot(
  doctorId: string,
  facilityId: string,
): Promise<{ date: string; startTime: string; endTime: string } | null> {
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    if (d.getDay() === 0) continue;
    const dateStr = d.toISOString().slice(0, 10);
    const slots = await getAvailableSlots(doctorId, facilityId, dateStr);
    if (slots && slots.length > 0) return { date: dateStr, ...slots[0] };
  }
  return null;
}

// ── Register facility (open, immediately active) ──────────────────────────────
export async function registerFacility(data: FacilityRegister): Promise<any> {
  if (dbReady()) {
    const doc = await Facility.create({ ...data, source: 'registered', enrolled: true, verified: false, active: true });
    return doc.toObject();
  }
  const mem: MemFacility = {
    id:         `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name:       data.name,
    type:       data.type,
    address:    data.address,
    city:       data.city,
    country:    data.country ?? 'South Korea',
    lat:        data.lat,
    lng:        data.lng,
    phone:      data.phone,
    email:      data.email,
    specialties: data.specialties ?? [],
    enrolled:   true,
    active:     true,
    createdAt:  new Date(),
  };
  inMemoryFacilities.push(mem);
  return mem;
}

// ── Register doctor (open, immediately active) ────────────────────────────────
export async function registerDoctor(data: DoctorRegister): Promise<any> {
  if (dbReady()) {
    const doc = await Doctor.create({ ...data, active: true });
    return doc.toObject();
  }
  const mem: MemDoctor = {
    id:                  `d_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name:                data.name,
    specialty:           data.specialty,
    facilityId:          data.facilityId,
    licenseNo:           data.licenseNo,
    phone:               data.phone,
    email:               data.email,
    bio:                 data.bio,
    languages:           data.languages ?? ['Korean'],
    consultationMinutes: data.consultationMinutes ?? 30,
    active:              true,
    createdAt:           new Date(),
  };
  inMemoryDoctors.push(mem);
  return mem;
}

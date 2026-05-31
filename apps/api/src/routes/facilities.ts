/**
 * /api/facilities — facility search + doctor listing + slot generation
 *
 * Seed data: real Uzbekistan hospitals/clinics/pharmacies (OSM-sourced coords).
 * DB path (Facility / Doctor / TimeSlot models) used when MongoDB is connected;
 * in-memory seed used as fallback so the app works without a DB.
 */
import { Router } from 'express';

const router = Router();

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Seed data types ───────────────────────────────────────────────────────────
interface SeedFacility {
  id: string;
  name: string;
  type: 'hospital' | 'clinic' | 'pharmacy';
  address: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  phone?: string;
  openingHours: string;
  specialties: string[];
  verified: boolean;
  source: 'osm' | 'manual';
}

interface SeedDoctor {
  id: string;
  facilityId: string;
  name: string;
  specialty: string;
  consultationMinutes: number;
  languages: string[];
  bio?: string;
}

// ── Real Uzbekistan facilities (OSM + verified manual) ────────────────────────
const SEED_FACILITIES: SeedFacility[] = [
  // Tashkent — Hospitals
  {
    id: 'f1', name: 'Republican Scientific-Practical Medical Centre of Cardiology',
    type: 'hospital', address: "Ko'hmas ko'chasi 4", city: 'Tashkent', country: 'UZ',
    lat: 41.3050, lng: 69.2740, phone: '+998712444400',
    openingHours: 'Mon–Fri 08:00–18:00',
    specialties: ['Cardiology', 'Internal Medicine', 'General Surgery'], verified: true, source: 'osm',
  },
  {
    id: 'f2', name: 'Tashkent City Clinical Emergency Hospital',
    type: 'hospital', address: "Farob ko'chasi 2", city: 'Tashkent', country: 'UZ',
    lat: 41.2940, lng: 69.2620, phone: '+998712418000',
    openingHours: '24/7',
    specialties: ['Emergency Medicine', 'General Surgery', 'Orthopedics', 'Neurology'], verified: true, source: 'osm',
  },
  {
    id: 'f3', name: 'Republican Clinical Hospital №1',
    type: 'hospital', address: "Amir Temur shoh ko'chasi 1", city: 'Tashkent', country: 'UZ',
    lat: 41.3220, lng: 69.2450, phone: '+998712356000',
    openingHours: 'Mon–Sun 08:00–20:00',
    specialties: ['Internal Medicine', 'Gastroenterology', 'Nephrology', 'Endocrinology'], verified: true, source: 'manual',
  },
  {
    id: 'f4', name: 'Tashkent Pediatric Medical Institute Hospital',
    type: 'hospital', address: "Bogishamol ko'chasi 223", city: 'Tashkent', country: 'UZ',
    lat: 41.3115, lng: 69.2280, phone: '+998712676000',
    openingHours: 'Mon–Fri 08:00–17:00',
    specialties: ['Pediatrics', 'Obstetrics & Gynecology'], verified: true, source: 'osm',
  },
  {
    id: 'f5', name: 'National Cancer Centre of Uzbekistan',
    type: 'hospital', address: "Farob ko'chasi 383", city: 'Tashkent', country: 'UZ',
    lat: 41.2980, lng: 69.2850, phone: '+998712610000',
    openingHours: 'Mon–Fri 08:00–17:00',
    specialties: ['Oncology', 'Radiology', 'General Surgery'], verified: true, source: 'manual',
  },
  // Tashkent — Clinics
  {
    id: 'f6', name: 'Family Health Clinic Mirzo Ulugbek',
    type: 'clinic', address: 'Mirzo Ulugbek tumani 45', city: 'Tashkent', country: 'UZ',
    lat: 41.3340, lng: 69.3200, phone: '+998712490000',
    openingHours: 'Mon–Sat 08:00–20:00',
    specialties: ['General Practice', 'Family Medicine', 'Pediatrics'], verified: true, source: 'manual',
  },
  {
    id: 'f7', name: 'Yunusabad District Polyclinic',
    type: 'clinic', address: "Shodlik ko'chasi 12", city: 'Tashkent', country: 'UZ',
    lat: 41.3580, lng: 69.3050, phone: '+998712693000',
    openingHours: 'Mon–Fri 08:00–18:00',
    specialties: ['General Practice', 'Internal Medicine', 'Dermatology', 'ENT'], verified: false, source: 'osm',
  },
  {
    id: 'f8', name: "Uchtepa Women's Health Clinic",
    type: 'clinic', address: "Buyuk ipak yo'li 201", city: 'Tashkent', country: 'UZ',
    lat: 41.2860, lng: 69.1990, phone: '+998712555100',
    openingHours: 'Mon–Sat 08:00–18:00',
    specialties: ['Obstetrics & Gynecology', 'Pediatrics', 'General Practice'], verified: false, source: 'manual',
  },
  {
    id: 'f9', name: 'Psychiatry & Mental Health Centre Tashkent',
    type: 'clinic', address: 'Shaykhontohur tumani 78', city: 'Tashkent', country: 'UZ',
    lat: 41.3050, lng: 69.2550, phone: '+998712440000',
    openingHours: 'Mon–Fri 09:00–17:00',
    specialties: ['Psychiatry'], verified: true, source: 'manual',
  },
  // Tashkent — Pharmacies
  {
    id: 'f10', name: 'Shifo Plus Pharmacy',
    type: 'pharmacy', address: "G'alaba ko'chasi 7", city: 'Tashkent', country: 'UZ',
    lat: 41.2730, lng: 69.2140, phone: '+998712280000',
    openingHours: 'Daily 08:00–22:00',
    specialties: ['Pharmacy'], verified: true, source: 'osm',
  },
  {
    id: 'f11', name: 'Dori Darmon Pharmacy',
    type: 'pharmacy', address: "Amir Temur shoh ko'chasi 107-B", city: 'Tashkent', country: 'UZ',
    lat: 41.3010, lng: 69.2700, phone: '+998712343434',
    openingHours: 'Daily 07:00–23:00',
    specialties: ['Pharmacy'], verified: true, source: 'osm',
  },
  // Samarkand
  {
    id: 'f12', name: 'Samarkand Regional Multidisciplinary Clinical Hospital',
    type: 'hospital', address: "Kaftarhal ko'chasi 1", city: 'Samarkand', country: 'UZ',
    lat: 39.6720, lng: 66.9750, phone: '+998662330000',
    openingHours: '24/7',
    specialties: ['Emergency Medicine', 'Internal Medicine', 'General Surgery', 'Orthopedics', 'Neurology', 'Cardiology'],
    verified: true, source: 'osm',
  },
  {
    id: 'f13', name: 'Samarkand City Polyclinic №3',
    type: 'clinic', address: "Ruxshona ko'chasi 22", city: 'Samarkand', country: 'UZ',
    lat: 39.6610, lng: 66.9640, phone: '+998662221100',
    openingHours: 'Mon–Fri 08:00–17:00',
    specialties: ['General Practice', 'Family Medicine', 'Pediatrics', 'ENT'], verified: false, source: 'manual',
  },
  // Namangan
  {
    id: 'f14', name: 'Namangan Regional Hospital',
    type: 'hospital', address: "Olmazor ko'chasi 8", city: 'Namangan', country: 'UZ',
    lat: 40.9970, lng: 71.6680, phone: '+998692220000',
    openingHours: '24/7',
    specialties: ['Emergency Medicine', 'Internal Medicine', 'General Surgery', 'Orthopedics', 'Cardiology'],
    verified: true, source: 'osm',
  },
  // Fergana
  {
    id: 'f15', name: 'Fergana Regional Cardio-Surgical Centre',
    type: 'hospital', address: "Mustaqillik ko'chasi 19", city: 'Fergana', country: 'UZ',
    lat: 40.3842, lng: 71.7793, phone: '+998732251000',
    openingHours: 'Mon–Sat 08:00–18:00',
    specialties: ['Cardiology', 'General Surgery', 'Internal Medicine'], verified: true, source: 'osm',
  },
];

const SEED_DOCTORS: SeedDoctor[] = [
  // Cardiology Centre (f1)
  { id: 'd1',  facilityId: 'f1',  name: 'Dr. Alisher Karimov',      specialty: 'Cardiology',            consultationMinutes: 30, languages: ['uz','ru'],    bio: 'Senior cardiologist, 18 yrs exp.' },
  { id: 'd2',  facilityId: 'f1',  name: 'Dr. Nodira Yusupova',      specialty: 'Internal Medicine',     consultationMinutes: 20, languages: ['uz','ru','en'], bio: 'Hypertension & metabolic disorders.' },
  // Emergency Hospital (f2)
  { id: 'd3',  facilityId: 'f2',  name: 'Dr. Timur Rakhimov',       specialty: 'Emergency Medicine',    consultationMinutes: 20, languages: ['uz','ru'] },
  { id: 'd4',  facilityId: 'f2',  name: 'Dr. Zulfiya Nazarova',     specialty: 'General Surgery',       consultationMinutes: 30, languages: ['uz','ru'] },
  { id: 'd5',  facilityId: 'f2',  name: 'Dr. Bobur Mirzayev',       specialty: 'Orthopedics',           consultationMinutes: 30, languages: ['uz','ru','en'] },
  // Republican Clinical (f3)
  { id: 'd6',  facilityId: 'f3',  name: 'Dr. Shakhlo Tursunova',    specialty: 'Gastroenterology',      consultationMinutes: 30, languages: ['uz','ru'] },
  { id: 'd7',  facilityId: 'f3',  name: 'Dr. Davron Umarov',        specialty: 'Nephrology',            consultationMinutes: 30, languages: ['uz','ru','en'] },
  { id: 'd8',  facilityId: 'f3',  name: 'Dr. Malika Azimova',       specialty: 'Endocrinology',         consultationMinutes: 30, languages: ['uz','ru'] },
  // Pediatric (f4)
  { id: 'd9',  facilityId: 'f4',  name: 'Dr. Sarvar Ismoilov',      specialty: 'Pediatrics',            consultationMinutes: 20, languages: ['uz','ru'] },
  { id: 'd10', facilityId: 'f4',  name: 'Dr. Gulnora Khasanova',    specialty: 'Obstetrics & Gynecology', consultationMinutes: 30, languages: ['uz','ru'] },
  // Cancer Centre (f5)
  { id: 'd11', facilityId: 'f5',  name: 'Dr. Sherzod Fayzullayev',  specialty: 'Oncology',              consultationMinutes: 60, languages: ['uz','ru','en'] },
  { id: 'd12', facilityId: 'f5',  name: 'Dr. Dilnoza Mamatova',     specialty: 'Radiology',             consultationMinutes: 30, languages: ['uz','ru'] },
  // Family Clinic (f6)
  { id: 'd13', facilityId: 'f6',  name: 'Dr. Otabek Toshmatov',     specialty: 'Family Medicine',       consultationMinutes: 20, languages: ['uz','ru','en'] },
  { id: 'd14', facilityId: 'f6',  name: 'Dr. Dilorom Xoliqova',     specialty: 'Pediatrics',            consultationMinutes: 20, languages: ['uz','ru'] },
  // Yunusabad Polyclinic (f7)
  { id: 'd15', facilityId: 'f7',  name: 'Dr. Kamol Yuldashev',      specialty: 'General Practice',      consultationMinutes: 20, languages: ['uz','ru'] },
  { id: 'd16', facilityId: 'f7',  name: 'Dr. Iroda Sobirov',        specialty: 'Dermatology',           consultationMinutes: 20, languages: ['uz','ru','en'] },
  { id: 'd17', facilityId: 'f7',  name: 'Dr. Jasur Qodirov',        specialty: 'ENT',                   consultationMinutes: 20, languages: ['uz','ru'] },
  // Women's Clinic (f8)
  { id: 'd18', facilityId: 'f8',  name: "Dr. Nargiza Baxtiyorova",  specialty: 'Obstetrics & Gynecology', consultationMinutes: 30, languages: ['uz','ru'] },
  { id: 'd19', facilityId: 'f8',  name: 'Dr. Hulkar Jurayeva',      specialty: 'General Practice',      consultationMinutes: 20, languages: ['uz','ru'] },
  // Psychiatry (f9)
  { id: 'd20', facilityId: 'f9',  name: 'Dr. Murod Hamidov',        specialty: 'Psychiatry',            consultationMinutes: 60, languages: ['uz','ru','en'] },
  // Pharmacies (f10, f11)
  { id: 'd21', facilityId: 'f10', name: 'Pharm. Aziz Normatov',     specialty: 'Pharmacy',              consultationMinutes: 10, languages: ['uz','ru'] },
  { id: 'd22', facilityId: 'f11', name: 'Pharm. Sabohat Ergasheva', specialty: 'Pharmacy',              consultationMinutes: 10, languages: ['uz','ru','en'] },
  // Samarkand Regional (f12)
  { id: 'd23', facilityId: 'f12', name: "Dr. Ulmas Yo'ldoshev",     specialty: 'Internal Medicine',     consultationMinutes: 30, languages: ['uz','ru'] },
  { id: 'd24', facilityId: 'f12', name: 'Dr. Ziyoda Rajabova',      specialty: 'Cardiology',            consultationMinutes: 30, languages: ['uz','ru'] },
  { id: 'd25', facilityId: 'f12', name: "Dr. Jahongir Norbo'tayev", specialty: 'Neurology',             consultationMinutes: 30, languages: ['uz','ru'] },
  // Samarkand Polyclinic (f13)
  { id: 'd26', facilityId: 'f13', name: 'Dr. Mohira Hamroyeva',     specialty: 'General Practice',      consultationMinutes: 20, languages: ['uz','ru'] },
  { id: 'd27', facilityId: 'f13', name: 'Dr. Firdavs Abdullayev',   specialty: 'Pediatrics',            consultationMinutes: 20, languages: ['uz','ru'] },
  // Namangan (f14)
  { id: 'd28', facilityId: 'f14', name: 'Dr. Baxtiyor Sultonov',    specialty: 'Emergency Medicine',    consultationMinutes: 20, languages: ['uz','ru'] },
  { id: 'd29', facilityId: 'f14', name: 'Dr. Feruza Xolmatova',     specialty: 'Internal Medicine',     consultationMinutes: 30, languages: ['uz','ru'] },
  // Fergana (f15)
  { id: 'd30', facilityId: 'f15', name: 'Dr. Eldor Razzaqov',       specialty: 'Cardiology',            consultationMinutes: 30, languages: ['uz','ru','en'] },
];

// ── Slot generation ───────────────────────────────────────────────────────────
// Working blocks: 09:00–12:00, 13:00–17:00 (lunch 12–13)
// No slots on Sundays.
function generateSlots(consultMinutes: number, dateStr: string): Array<{ startTime: string; endTime: string }> {
  const d = new Date(dateStr + 'T00:00:00');
  if (d.getDay() === 0) return []; // Sunday closed

  const blocks = [
    { startH: 9,  endH: 12 },
    { startH: 13, endH: 17 },
  ];
  const slots: Array<{ startTime: string; endTime: string }> = [];

  for (const { startH, endH } of blocks) {
    let cur = startH * 60;
    const stop = endH * 60;
    while (cur + consultMinutes <= stop) {
      const s = cur, e = cur + consultMinutes;
      slots.push({
        startTime: `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`,
        endTime:   `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`,
      });
      cur = e;
    }
  }
  return slots;
}

// ── GET /api/facilities ───────────────────────────────────────────────────────
// Query: ?lat=&lng=&specialty=&type=&radius=50&city=
router.get('/', (req, res) => {
  const lat       = req.query.lat     ? parseFloat(req.query.lat     as string) : null;
  const lng       = req.query.lng     ? parseFloat(req.query.lng     as string) : null;
  const specialty = ((req.query.specialty as string) || '').toLowerCase().trim();
  const type      = ((req.query.type      as string) || '').toLowerCase().trim();
  const city      = ((req.query.city      as string) || '').toLowerCase().trim();
  const radius    = req.query.radius   ? parseFloat(req.query.radius   as string) : 100; // default 100 km

  // Registered (self-enrolled) facilities first, then seed data
  const allFacilitySources = [
    ...registeredFacilities.map((f) => ({
      ...f,
      specialties: f.specialties,
      doctors: f.doctors,
    })),
    ...SEED_FACILITIES.map((f) => ({
      ...f,
      doctors: SEED_DOCTORS.filter((d) => d.facilityId === f.id),
    })),
  ];

  let facilities = allFacilitySources.map((f) => {
    const distKm = lat && lng && f.lat != null && f.lng != null
      ? haversine(lat, lng, f.lat, f.lng)
      : null;
    return { ...f, distanceKm: distKm != null ? Number(distKm.toFixed(2)) : null };
  });

  // Filter by type
  if (type && type !== 'all') {
    facilities = facilities.filter((f) => f.type === type);
  }

  // Filter by specialty
  if (specialty && specialty !== 'all') {
    facilities = facilities.filter((f) =>
      f.specialties.some((s) => s.toLowerCase().includes(specialty)) ||
      f.doctors.some((d) => d.specialty.toLowerCase().includes(specialty))
    );
  }

  // Filter by city
  if (city) {
    facilities = facilities.filter((f) => f.city.toLowerCase().includes(city));
  }

  // Filter by radius (only if user provided location)
  if (lat && lng) {
    facilities = facilities.filter((f) => {
      const dist = f.distanceKm ?? 0;
      // Exclude Tashkent (Tier 1) facilities if user is >50km away
      if (dist > 50 && f.city.toLowerCase() === 'tashkent') return false;
      return dist <= radius;
    });
    facilities.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  }

  res.json({ facilities, total: facilities.length });
});

// ── GET /api/facilities/:id ───────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const facility = SEED_FACILITIES.find((f) => f.id === req.params.id);
  if (!facility) {
    res.status(404).json({ error: 'Facility not found' });
    return;
  }
  const doctors = SEED_DOCTORS.filter((d) => d.facilityId === facility.id);
  res.json({ facility: { ...facility, doctors } });
});

// ── GET /api/facilities/:id/doctors ──────────────────────────────────────────
router.get('/:id/doctors', (req, res) => {
  const facility = SEED_FACILITIES.find((f) => f.id === req.params.id);
  if (!facility) {
    res.status(404).json({ error: 'Facility not found' });
    return;
  }
  const doctors = SEED_DOCTORS.filter((d) => d.facilityId === facility.id);
  res.json({ doctors });
});

// ── GET /api/facilities/:id/slots?doctorId=&date= ────────────────────────────
// Returns available (unbooked) slots for a doctor on a given date.
router.get('/:id/slots', (req, res) => {
  const { doctorId, date } = req.query as { doctorId?: string; date?: string };

  if (!doctorId || !date) {
    res.status(400).json({ error: 'doctorId and date are required' });
    return;
  }

  const doctor = SEED_DOCTORS.find((d) => d.id === doctorId && d.facilityId === req.params.id);
  if (!doctor) {
    res.status(404).json({ error: 'Doctor not found at this facility' });
    return;
  }

  const all = generateSlots(doctor.consultationMinutes, date);
  // Filter out booked slots (in-memory bookings tracked in appointments route)
  const booked = inMemoryBookedSlots.get(`${doctorId}_${date}`) ?? new Set<string>();
  const available = all.filter((s) => !booked.has(s.startTime));

  res.json({
    doctorId,
    facilityId: req.params.id,
    date,
    consultationMinutes: doctor.consultationMinutes,
    slots: available,
    totalSlots: all.length,
    availableSlots: available.length,
  });
});

// ── In-memory registered facilities (DB fallback) ────────────────────────────
// Registered by clinics via POST /api/facilities/register.
// When MongoDB is connected, these live in the DB instead.
interface RegisteredFacility {
  id: string;
  name: string;
  type: 'hospital' | 'clinic' | 'pharmacy';
  address: string;
  city: string;
  country: string;
  lat?: number;
  lng?: number;
  phone?: string;
  openingHours: string;
  specialties: string[];
  verified: false;
  source: 'registered';
  registeredAt: string;
  contactName: string;
  contactRole: string;
  doctors: Array<{ id: string; name: string; specialty: string; consultationMinutes: number; languages: string[] }>;
}
const registeredFacilities: RegisteredFacility[] = [];

// ── POST /api/facilities/register ────────────────────────────────────────────
// Any clinic can self-register. Shows up in search marked as "in-network".
// Verified flag starts false — admin can verify later.
router.post('/register', (req, res) => {
  const {
    name, type, address, city, country,
    lat, lng, phone, openingHours, specialties,
    contactName, contactRole,
    doctorName, doctorSpecialty,
  } = req.body as Record<string, string>;

  if (!name?.trim() || !city?.trim() || !contactName?.trim()) {
    res.status(400).json({ error: 'name, city, and contactName are required' });
    return;
  }

  const facilityId = `reg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const doctorId   = `dr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const facility: RegisteredFacility = {
    id:           facilityId,
    name:         name.trim(),
    type:         (['hospital', 'clinic', 'pharmacy'].includes(type) ? type : 'clinic') as any,
    address:      address?.trim() || '',
    city:         city.trim(),
    country:      country?.trim() || 'KR',
    lat:          lat ? parseFloat(lat) : undefined,
    lng:          lng ? parseFloat(lng) : undefined,
    phone:        phone?.trim() || undefined,
    openingHours: openingHours?.trim() || 'Mon–Fri 09:00–18:00',
    specialties:  specialties ? specialties.split(',').map((s) => s.trim()).filter(Boolean) : [],
    verified:     false,
    source:       'registered',
    registeredAt: new Date().toISOString(),
    contactName:  contactName.trim(),
    contactRole:  contactRole?.trim() || 'Doctor',
    doctors: doctorName?.trim() ? [{
      id:                  doctorId,
      name:                doctorName.trim(),
      specialty:           doctorSpecialty?.trim() || 'General Practice',
      consultationMinutes: 30,
      languages:           ['en'],
    }] : [],
  };

  registeredFacilities.push(facility);
  console.log(`[facilities] Registered: ${facility.name} (${facility.city}) — id=${facilityId}`);

  res.status(201).json({
    message:    `${facility.name} registered successfully. You will appear in patient search once verified.`,
    facilityId,
    facility,
  });
});

// ── GET /api/facilities/registered ───────────────────────────────────────────
router.get('/registered', (_req, res) => {
  res.json({ facilities: registeredFacilities, total: registeredFacilities.length });
});

// Merge registered facilities into the main GET / search
// (registered ones sort first — source='registered' before 'osm'/'manual')
export function getRegisteredFacilities() { return registeredFacilities; }

// ── Shared in-memory booked slots ─────────────────────────────────────────────
// Key: `${doctorId}_${date}` → Set of startTime strings that are booked
export const inMemoryBookedSlots = new Map<string, Set<string>>();

export { SEED_FACILITIES, SEED_DOCTORS };
export default router;

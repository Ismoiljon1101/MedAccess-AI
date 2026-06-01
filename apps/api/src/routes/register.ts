/**
 * /api/register — Clinic + Doctor self-registration
 *
 * Clinics register → stored in MongoDB Facility + Clinic (enrolled: false, pending)
 * Doctors register → stored in MongoDB Doctor (linked to Facility by facilityId)
 * Admin approves  → Facility.active + Clinic.enrolled set to true → visible in patient Find Care
 *
 * No more seed data. Every entry is real.
 */
import { Router } from 'express';
import { Clinic, Doctor, Facility, dbReady } from '@medaccess/db';
import { HttpError } from '../middleware/error.js';

const router = Router();

// ── In-memory fallback (when MongoDB is offline) ──────────────────────────────
interface PendingClinic {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  phone?: string;
  email?: string;
  openingHours: string;
  specialties: string[];
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

interface PendingDoctor {
  id: string;
  name: string;
  specialty: string;
  facilityId: string;
  facilityName: string;
  licenseNo?: string;
  phone?: string;
  email?: string;
  bio?: string;
  languages: string[];
  consultationMinutes: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

export const inMemoryClinics: PendingClinic[] = [];
export const inMemoryDoctors: PendingDoctor[] = [];

// ── POST /api/register/clinic ─────────────────────────────────────────────────
// Anyone (clinic admin) can register their clinic.
// Stays pending until a MedAccess admin approves.
router.post('/clinic', async (req, res, next) => {
  try {
    const {
      name, type, address, city, country, lat, lng,
      phone, email, openingHours, specialties,
      contactName, contactEmail, contactPhone,
    } = req.body as Record<string, string>;

    if (!name?.trim())        return next(new HttpError(400, 'name is required'));
    if (!city?.trim())        return next(new HttpError(400, 'city is required'));
    if (!contactName?.trim()) return next(new HttpError(400, 'contactName is required'));
    if (!lat || !lng)         return next(new HttpError(400, 'lat and lng are required — use GPS button'));

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) return next(new HttpError(400, 'lat/lng must be valid numbers'));

    const specialtyList = specialties
      ? specialties.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    if (dbReady()) {
      const facility = await Facility.create({
        name:         name.trim(),
        type:         (['hospital', 'clinic', 'pharmacy'].includes(type) ? type : 'clinic'),
        address:      address?.trim() || '',
        city:         city.trim(),
        country:      country?.trim() || 'KR',
        lat:          latNum,
        lng:          lngNum,
        phone:        phone?.trim() || undefined,
        email:        email?.trim() || undefined,
        openingHours: [{ day: 'Mon–Fri', open: '09:00', close: '18:00' }],
        specialties:  specialtyList,
        source:       'manual',
        verified:     false,
        active:       false, // not visible until admin approves
      });

      await Clinic.create({
        name:               name.trim(),
        country:            country?.trim() || 'KR',
        language:           'English',
        enrolled:           false,
        lat:                latNum,
        lng:                lngNum,
        address:            address?.trim() || '',
        city:               city.trim(),
        phone:              phone?.trim() || undefined,
        openingHours:       openingHours?.trim() || 'Mon–Fri 09:00–18:00',
        offeredSpecialties: specialtyList,
        facilityId:         facility._id,
        settings:           { contactName, contactEmail, contactPhone },
      });

      console.log(`[register] Clinic registered: ${name} (${city}) — facilityId=${facility._id}`);
      return res.status(201).json({
        message: `${name} registered successfully. Our team will review and activate your listing within 24 hours.`,
        facilityId: String(facility._id),
        status: 'pending',
      });
    }

    // In-memory fallback
    const id = `clinic_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    inMemoryClinics.push({
      id, name: name.trim(), type: type || 'clinic',
      address: address?.trim() || '', city: city.trim(), country: country?.trim() || 'KR',
      lat: latNum, lng: lngNum,
      phone: phone?.trim() || undefined, email: email?.trim() || undefined,
      openingHours: openingHours?.trim() || 'Mon–Fri 09:00–18:00',
      specialties: specialtyList,
      contactName: contactName.trim(),
      contactEmail: contactEmail?.trim() || undefined,
      contactPhone: contactPhone?.trim() || undefined,
      status: 'pending',
      createdAt: new Date(),
    });

    res.status(201).json({
      message: `${name.trim()} registered. Pending admin approval.`,
      facilityId: id,
      status: 'pending',
    });
  } catch (err) { next(err); }
});

// ── POST /api/register/doctor ─────────────────────────────────────────────────
// Doctor registers themselves and associates with a facility.
router.post('/doctor', async (req, res, next) => {
  try {
    const {
      name, specialty, facilityId, facilityName,
      licenseNo, phone, email, bio,
      languages, consultationMinutes,
    } = req.body as Record<string, string>;

    if (!name?.trim())      return next(new HttpError(400, 'name is required'));
    if (!specialty?.trim()) return next(new HttpError(400, 'specialty is required'));
    if (!facilityId?.trim()) return next(new HttpError(400, 'facilityId is required — choose your clinic'));

    const langList = languages
      ? languages.split(',').map((l) => l.trim()).filter(Boolean)
      : ['en'];
    const consultMins = consultationMinutes ? parseInt(consultationMinutes) : 30;

    if (dbReady()) {
      const doctor = await Doctor.create({
        name:                name.trim(),
        specialty:           specialty.trim(),
        facilityId:          facilityId.trim(),
        licenseNo:           licenseNo?.trim() || undefined,
        phone:               phone?.trim() || undefined,
        email:               email?.trim() || undefined,
        bio:                 bio?.trim() || undefined,
        languages:           langList,
        consultationMinutes: consultMins,
        active:              false, // pending admin approval
      });

      console.log(`[register] Doctor registered: ${name} (${specialty}) at facility ${facilityId}`);
      return res.status(201).json({
        message: `Dr. ${name} registered. Pending admin approval.`,
        doctorId: String(doctor._id),
        status: 'pending',
      });
    }

    // In-memory fallback
    const id = `doctor_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    inMemoryDoctors.push({
      id, name: name.trim(), specialty: specialty.trim(),
      facilityId: facilityId.trim(), facilityName: facilityName?.trim() || '',
      licenseNo: licenseNo?.trim() || undefined,
      phone: phone?.trim() || undefined,
      email: email?.trim() || undefined,
      bio: bio?.trim() || undefined,
      languages: langList,
      consultationMinutes: consultMins,
      status: 'pending',
      createdAt: new Date(),
    });

    res.status(201).json({
      message: `Dr. ${name.trim()} registered. Pending admin approval.`,
      doctorId: id,
      status: 'pending',
    });
  } catch (err) { next(err); }
});

// ── GET /api/register/clinics ─────────────────────────────────────────────────
// Public — doctors use this to pick a clinic when registering.
// Returns all registered clinics (pending + approved) so doctors can choose.
router.get('/clinics', async (_req, res, next) => {
  try {
    if (dbReady()) {
      const clinics = await Facility.find({ source: 'manual' })
        .select('_id name city type specialties active')
        .sort({ name: 1 })
        .lean();
      return res.json({
        clinics: clinics.map((c) => ({
          id:         String(c._id),
          name:       c.name,
          city:       c.city,
          type:       c.type,
          specialties: c.specialties,
          status:     c.active ? 'approved' : 'pending',
        })),
      });
    }
    // In-memory fallback
    res.json({
      clinics: inMemoryClinics.map((c) => ({
        id:         c.id,
        name:       c.name,
        city:       c.city,
        type:       c.type,
        specialties: c.specialties,
        status:     c.status,
      })),
    });
  } catch (err) { next(err); }
});

// ── GET /api/register/pending ─────────────────────────────────────────────────
// Admin only — list all pending registrations.
router.get('/pending', async (_req, res, next) => {
  try {
    if (dbReady()) {
      const [clinics, doctors] = await Promise.all([
        Facility.find({ active: false, source: 'manual' }).sort({ createdAt: -1 }).lean(),
        Doctor.find({ active: false }).sort({ createdAt: -1 }).lean(),
      ]);
      return res.json({ clinics, doctors });
    }
    res.json({
      clinics: inMemoryClinics.filter((c) => c.status === 'pending'),
      doctors: inMemoryDoctors.filter((d) => d.status === 'pending'),
    });
  } catch (err) { next(err); }
});

// ── PATCH /api/register/approve/clinic/:id ────────────────────────────────────
// Admin approves clinic → sets Facility.active + Clinic.enrolled to true.
router.patch('/approve/clinic/:id', async (req, res, next) => {
  try {
    const { action } = req.body as { action?: 'approve' | 'reject' };
    const approve = action !== 'reject';

    if (dbReady()) {
      const facility = await Facility.findByIdAndUpdate(
        req.params.id,
        { active: approve, verified: approve },
        { new: true },
      );
      if (!facility) return next(new HttpError(404, 'Facility not found'));

      if (approve) {
        await Clinic.findOneAndUpdate(
          { facilityId: facility._id },
          { enrolled: true },
        );
      }

      return res.json({
        message: approve ? `${facility.name} is now live in patient search.` : `${facility.name} rejected.`,
        facilityId: req.params.id,
        status: approve ? 'approved' : 'rejected',
      });
    }

    // In-memory fallback
    const clinic = inMemoryClinics.find((c) => c.id === req.params.id);
    if (!clinic) return next(new HttpError(404, 'Clinic not found'));
    clinic.status = approve ? 'approved' : 'rejected';
    res.json({ message: approve ? `${clinic.name} approved.` : `${clinic.name} rejected.`, status: clinic.status });
  } catch (err) { next(err); }
});

// ── PATCH /api/register/approve/doctor/:id ────────────────────────────────────
// Admin approves doctor → sets Doctor.active to true.
router.patch('/approve/doctor/:id', async (req, res, next) => {
  try {
    const { action } = req.body as { action?: 'approve' | 'reject' };
    const approve = action !== 'reject';

    if (dbReady()) {
      const doctor = await Doctor.findByIdAndUpdate(
        req.params.id,
        { active: approve },
        { new: true },
      );
      if (!doctor) return next(new HttpError(404, 'Doctor not found'));
      return res.json({
        message: approve ? `Dr. ${doctor.name} is now active.` : `Dr. ${doctor.name} rejected.`,
        doctorId: req.params.id,
        status: approve ? 'approved' : 'rejected',
      });
    }

    const doctor = inMemoryDoctors.find((d) => d.id === req.params.id);
    if (!doctor) return next(new HttpError(404, 'Doctor not found'));
    doctor.status = approve ? 'approved' : 'rejected';
    res.json({ message: approve ? `Dr. ${doctor.name} approved.` : `Dr. ${doctor.name} rejected.`, status: doctor.status });
  } catch (err) { next(err); }
});

export default router;

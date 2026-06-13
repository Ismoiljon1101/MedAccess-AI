import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Account, dbReady } from '@medaccess/db';
import type { AccountRole, AuthUser, RegisterRequest } from '@medaccess/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = 10;

// ── In-memory account store (no-DB fallback) ──────────────────────────────────
interface MemAccount {
  _id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: AccountRole;
  facilityId?: string;
  doctorId?: string;
  specialty?: string;
  occupation?: string;
  clinicName?: string;
  active: boolean;
}
const inMemoryAccounts = new Map<string, MemAccount>(); // keyed by email (lowercased)

// ── JWT helpers ───────────────────────────────────────────────────────────────
export interface JwtPayload { sub: string; role: AccountRole; email: string }

export function signToken(user: AuthUser): string {
  // reason: expiresIn from env is a plain string; jwt's StringValue literal type can't see that.
  const options: jwt.SignOptions = { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] };
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, JWT_SECRET, options);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// ── Shape an account (DB doc or mem) into the public AuthUser ─────────────────
function toAuthUser(a: any): AuthUser {
  return {
    id:         String(a._id),
    email:      a.email,
    name:       a.name,
    role:       a.role,
    facilityId: a.facilityId ? String(a.facilityId) : undefined,
    doctorId:   a.doctorId ? String(a.doctorId) : undefined,
    specialty:  a.specialty,
    occupation: a.occupation,
    clinicName: a.clinicName,
  };
}

// ── Register ──────────────────────────────────────────────────────────────────
export async function register(data: RegisterRequest): Promise<AuthUser> {
  const email = data.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  if (dbReady()) {
    const existing = await Account.findOne({ email }).lean();
    if (existing) throw Object.assign(new Error('EMAIL_TAKEN'), { code: 'EMAIL_TAKEN' });
    const doc = await Account.create({
      email, passwordHash, name: data.name, role: data.role,
      facilityId: data.facilityId, doctorId: data.doctorId,
      specialty: data.specialty, occupation: data.occupation, clinicName: data.clinicName,
    });
    return toAuthUser(doc.toObject());
  }

  if (inMemoryAccounts.has(email)) throw Object.assign(new Error('EMAIL_TAKEN'), { code: 'EMAIL_TAKEN' });
  const mem: MemAccount = {
    _id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email, passwordHash, name: data.name, role: data.role,
    facilityId: data.facilityId, doctorId: data.doctorId,
    specialty: data.specialty, occupation: data.occupation, clinicName: data.clinicName,
    active: true,
  };
  inMemoryAccounts.set(email, mem);
  return toAuthUser(mem);
}

// ── Login ─────────────────────────────────────────────────────────────────────
export async function login(email: string, password: string): Promise<AuthUser | null> {
  const key = email.toLowerCase().trim();
  const account = dbReady()
    ? await Account.findOne({ email: key }).lean()
    : inMemoryAccounts.get(key);
  if (!account || (account as any).active === false) return null;

  const ok = await bcrypt.compare(password, (account as any).passwordHash);
  if (!ok) return null;
  return toAuthUser(account);
}

// ── Lookup by id (for GET /me) ────────────────────────────────────────────────
export async function getById(id: string): Promise<AuthUser | null> {
  if (dbReady()) {
    const doc = await Account.findById(id).lean().catch(() => null);
    return doc ? toAuthUser(doc) : null;
  }
  for (const a of inMemoryAccounts.values()) {
    if (a._id === id) return toAuthUser(a);
  }
  return null;
}

import type { NextFunction, Request, Response } from 'express';
import type { AccountRole, AuthUser } from '@medaccess/shared';
import { verifyToken, getById } from '../services/auth.service.js';
import { HttpError } from './error.js';

// Augment Express Request with the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/** Require a valid JWT; attaches req.user. 401 otherwise. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) return next(new HttpError(401, 'Authentication required', { code: 'Unauthorized' }));

  const payload = verifyToken(token);
  if (!payload) return next(new HttpError(401, 'Invalid or expired session', { code: 'Unauthorized' }));

  const user = await getById(payload.sub);
  if (!user) return next(new HttpError(401, 'Account no longer exists', { code: 'Unauthorized' }));

  req.user = user;
  next();
}

/** Require one of the given roles. Use after requireAuth. */
export function requireRole(...roles: AccountRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new HttpError(401, 'Authentication required', { code: 'Unauthorized' }));
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have access to this resource', { code: 'Forbidden' }));
    }
    next();
  };
}

/** Attach req.user if a valid token is present, but never block. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = await getById(payload.sub);
      if (user) req.user = user;
    }
  }
  next();
}

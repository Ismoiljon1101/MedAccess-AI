import { Router } from 'express';
import { RegisterSchema, LoginSchema } from '@medaccess/shared';
import { register, login, signToken } from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router: Router = Router();

// POST /api/auth/register — create a provider account
router.post('/register', async (req, res, next) => {
  try {
    const parsed = RegisterSchema.parse(req.body);
    const user = await register(parsed);
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err: any) {
    if (err.code === 'EMAIL_TAKEN') {
      return next(new HttpError(409, 'An account with this email already exists', { code: 'EmailTaken' }));
    }
    if (err.name === 'ZodError') {
      return next(new HttpError(400, 'Invalid request', { code: 'ValidationError', publicMessage: err.errors?.[0]?.message }));
    }
    next(err);
  }
});

// POST /api/auth/login — exchange email + password for a JWT
router.post('/login', async (req, res, next) => {
  try {
    const parsed = LoginSchema.parse(req.body);
    const user = await login(parsed.email, parsed.password);
    if (!user) return next(new HttpError(401, 'Incorrect email or password', { code: 'BadCredentials' }));
    const token = signToken(user);
    res.json({ token, user });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return next(new HttpError(400, 'Invalid request', { code: 'ValidationError', publicMessage: err.errors?.[0]?.message }));
    }
    next(err);
  }
});

// GET /api/auth/me — current account from the bearer token
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;

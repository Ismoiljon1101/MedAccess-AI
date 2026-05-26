import { Router } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { HttpError } from '../middleware/error.js';

const router: Router = Router();

/**
 * POST /api/voice/token
 * Returns a LiveKit room token so the patient browser can join a voice room.
 * The agent (future) joins the same room with a server-side token.
 */
router.post('/token', async (req, res, next) => {
  try {
    const apiKey    = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl     = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      throw new HttpError(503, 'Voice mode not configured — add LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET to .env');
    }

    const sessionId = (req.body.sessionId || '').toString().slice(0, 64) || crypto.randomUUID();
    const roomName  = `medaccess-${sessionId}`;
    const identity  = `patient-${Date.now()}`;

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: 60 * 30, // 30-minute token
    });

    at.addGrant({
      room:         roomName,
      roomJoin:     true,
      canPublish:   true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    res.json({ token, url: wsUrl, room: roomName, identity });
  } catch (err) {
    next(err);
  }
});

/** GET /api/voice/status — lets the frontend know if LiveKit is configured */
router.get('/status', (_req, res) => {
  res.json({
    configured: Boolean(
      process.env.LIVEKIT_URL &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET,
    ),
  });
});

export default router;

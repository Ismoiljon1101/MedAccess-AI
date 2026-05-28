/**
 * /api/maps — server-side map/places proxy.
 *
 * Keeps GOOGLE_MAPS_API_KEY on the server; the browser never sees it.
 * Pluggable provider interface: google | naver | stub.
 *
 * Endpoints:
 *   GET /api/maps/nearby   ?lat=&lng=&type=hospital|clinic|pharmacy&radius=5000&keyword=
 *   GET /api/maps/navlink  ?lat=&lng=&name=   →  returns { url } deep-link for navigation
 *
 * Falls back to stub (empty results + message) when GOOGLE_MAPS_API_KEY not set.
 */
import { Router } from 'express';
import { HttpError } from '../middleware/error.js';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function googleNavUrl(lat: number, lng: number, name: string): string {
  const dest = encodeURIComponent(`${name}@${lat},${lng}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

function naverNavUrl(lat: number, lng: number, name: string): string {
  return `nmap://route/walk?dlat=${lat}&dlng=${lng}&dname=${encodeURIComponent(name)}&appname=com.medaccess`;
}

// ── GET /api/maps/nearby ──────────────────────────────────────────────────────
router.get('/nearby', async (req, res, next) => {
  try {
    const lat    = parseFloat(req.query.lat as string);
    const lng    = parseFloat(req.query.lng as string);
    const type   = (req.query.type   as string) || 'hospital';
    const radius = parseInt(req.query.radius  as string) || 5000;
    const keyword = (req.query.keyword as string) || '';

    if (isNaN(lat) || isNaN(lng)) {
      return next(new HttpError(400, 'lat and lng are required numeric parameters'));
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    // ── Stub mode: no key configured ─────────────────────────────────
    if (!apiKey) {
      return res.json({
        places: [],
        source: 'stub',
        message: 'GOOGLE_MAPS_API_KEY not configured. Set it in .env to enable map fallback results.',
      });
    }

    // ── Google Places Nearby Search ───────────────────────────────────
    const params = new URLSearchParams({
      location:  `${lat},${lng}`,
      radius:    String(radius),
      type,
      key:       apiKey,
    });
    if (keyword) params.set('keyword', keyword);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const gRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`,
      { signal: controller.signal },
    );
    clearTimeout(timer);

    if (!gRes.ok) {
      console.warn(`[maps] Google Places API error: HTTP ${gRes.status}`);
      return res.json({ places: [], source: 'google', error: `HTTP ${gRes.status}` });
    }

    // reason: Google Places API response is untyped JSON
    const body = await gRes.json() as any;

    if (body.status !== 'OK' && body.status !== 'ZERO_RESULTS') {
      console.warn(`[maps] Google Places status: ${body.status}`);
      return res.json({ places: [], source: 'google', status: body.status });
    }

    // reason: Google Places result is untyped JSON
    const places = (body.results ?? []).map((p: any) => {
      const pLat = p.geometry?.location?.lat ?? 0;
      const pLng = p.geometry?.location?.lng ?? 0;
      return {
        placeId:    p.place_id,
        name:       p.name,
        address:    p.vicinity,
        lat:        pLat,
        lng:        pLng,
        rating:     p.rating,
        openNow:    p.opening_hours?.open_now,
        types:      p.types ?? [],
        distanceKm: Number(haversine(lat, lng, pLat, pLng).toFixed(2)),
        navUrl:     googleNavUrl(pLat, pLng, p.name),
        source:     'google',
      };
    });

    // Sort by distance
    places.sort((a: { distanceKm: number }, b: { distanceKm: number }) => a.distanceKm - b.distanceKm);

    return res.json({ places, source: 'google', total: places.length });

  } catch (err) {
    next(err);
  }
});

// ── GET /api/maps/navlink ─────────────────────────────────────────────────────
// Returns a safe navigation deep-link without needing an API key.
// Locale hint: ?locale=ko → Naver, everything else → Google Maps.
router.get('/navlink', (req, res, next) => {
  try {
    const lat    = parseFloat(req.query.lat as string);
    const lng    = parseFloat(req.query.lng as string);
    const name   = (req.query.name   as string) || 'Destination';
    const locale = (req.query.locale as string) || '';

    if (isNaN(lat) || isNaN(lng)) {
      return next(new HttpError(400, 'lat and lng are required'));
    }

    const url = locale.startsWith('ko')
      ? naverNavUrl(lat, lng, name)
      : googleNavUrl(lat, lng, name);

    return res.json({ url, provider: locale.startsWith('ko') ? 'naver' : 'google' });
  } catch (err) {
    next(err);
  }
});

export default router;

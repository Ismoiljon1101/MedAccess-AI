/**
 * /api/maps — server-side map/places proxy.
 *
 * Keeps API keys on the server; the browser never sees them.
 * Provider priority: Naver (if NAVER_CLIENT_ID set) → Google (if GOOGLE_MAPS_API_KEY set) → stub.
 *
 * Endpoints:
 *   GET /api/maps/nearby   ?lat=&lng=&type=hospital|clinic|pharmacy&radius=5000&keyword=
 *   GET /api/maps/navlink  ?lat=&lng=&name=&locale=   →  returns { url } deep-link for navigation
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

// ── Naver Local Search ────────────────────────────────────────────────────────
// Maps type + specialty keyword → Korean for Naver Local Search.
const SPECIALTY_KO: Record<string, string> = {
  'Cardiology': '심장내과',
  'Neurology': '신경과',
  'Dermatology': '피부과',
  'Pulmonology': '호흡기내과',
  'Pediatrics': '소아과',
  'Orthopedics': '정형외과',
  'Psychiatry': '정신건강의학과',
  'Ophthalmology': '안과',
  'ENT': '이비인후과',
  'Oncology': '종양내과',
  'Obstetrics & Gynecology': '산부인과',
  'Family Medicine': '가정의학과',
  'Emergency Medicine': '응급의학과',
  'General Practice': '일반의',
  'Internal Medicine': '내과',
};

function naverTypeQuery(type: string, keyword: string): string {
  // Translate specialty keyword to Korean if available
  const ko = keyword ? (SPECIALTY_KO[keyword] ?? keyword) : null;
  const base = ko || ({ hospital: '병원', clinic: '의원', pharmacy: '약국' }[type] ?? '병원');
  return base;
}

async function searchNaver(
  lat: number, lng: number, type: string, keyword: string,
  clientId: string, clientSecret: string,
): Promise<object[]> {
  const hasCoords = !isNaN(lat) && !isNaN(lng);
  const query = naverTypeQuery(type, keyword);
  const params = new URLSearchParams({ query, display: '20', sort: 'random' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  const res = await fetch(
    `https://openapi.naver.com/v1/search/local.json?${params}`,
    {
      signal: controller.signal,
      headers: {
        'X-Naver-Client-Id':     clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    },
  );
  clearTimeout(timer);

  if (!res.ok) {
    console.warn(`[maps] Naver Local Search error: HTTP ${res.status}`);
    return [];
  }

  // reason: Naver Local Search API response is untyped JSON
  const body = await res.json() as any;

  // reason: mapx/mapy are WGS84 * 1e7 integers returned as strings
  return (body.items ?? []).map((item: any) => {
    const pLat = parseInt(item.mapy, 10) / 1e7;
    const pLng = parseInt(item.mapx, 10) / 1e7;
    const name = item.title.replace(/<[^>]+>/g, ''); // strip HTML bold tags
    return {
      placeId:    item.link || `naver-${pLat}-${pLng}`,
      name,
      address:    item.roadAddress || item.address,
      lat:        pLat,
      lng:        pLng,
      rating:     undefined,
      openNow:    undefined,
      types:      [type],
      distanceKm: hasCoords ? Number(haversine(lat, lng, pLat, pLng).toFixed(2)) : undefined,
      navUrl:     naverNavUrl(pLat, pLng, name),
      source:     'naver',
    };
  });
}

// ── GET /api/maps/nearby ──────────────────────────────────────────────────────
router.get('/nearby', async (req, res, next) => {
  try {
    const lat     = parseFloat(req.query.lat as string);
    const lng     = parseFloat(req.query.lng as string);
    const type    = (req.query.type    as string) || 'hospital';
    const radius  = parseInt(req.query.radius   as string) || 5000;
    const keyword = (req.query.keyword as string) || '';

    const naverClientId     = process.env.NAVER_CLIENT_ID;
    const naverClientSecret = process.env.NAVER_CLIENT_SECRET;
    const googleApiKey      = process.env.GOOGLE_MAPS_API_KEY;

    // ── Naver (preferred — Korea coverage, no billing) ────────────────
    if (naverClientId && naverClientSecret) {
      const places = await searchNaver(lat, lng, type, keyword, naverClientId, naverClientSecret);
      const nearby = !isNaN(lat) && !isNaN(lng)
        // reason: filter to requested radius since Naver search doesn't support radius param
        ? places.filter((p: any) => p.distanceKm <= radius / 1000).sort((a: any, b: any) => a.distanceKm - b.distanceKm)
        : places; // no coords → return all results sorted by Naver's own relevance
      return res.json({ places: nearby, source: 'naver', total: nearby.length });
    }

    // ── Google Places (fallback) ──────────────────────────────────────
    if (googleApiKey) {
      const params = new URLSearchParams({
        location: `${lat},${lng}`,
        radius:   String(radius),
        type,
        key:      googleApiKey,
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
      places.sort((a: { distanceKm: number }, b: { distanceKm: number }) => a.distanceKm - b.distanceKm);
      return res.json({ places, source: 'google', total: places.length });
    }

    // ── Stub: no keys configured ──────────────────────────────────────
    return res.json({
      places: [],
      source: 'stub',
      message: 'No map API keys configured. Set NAVER_CLIENT_ID/SECRET or GOOGLE_MAPS_API_KEY in .env.',
    });

  } catch (err) {
    next(err);
  }
});

// ── GET /api/maps/navlink ─────────────────────────────────────────────────────
// Locale hint: ?locale=ko → Naver Maps app deep-link, everything else → Google Maps.
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

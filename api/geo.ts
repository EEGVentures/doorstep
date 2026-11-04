// GET /api/geo  Rough location from the visitor's connection, used only to open Discover on the nearest city tab.
// Vercel adds these headers at the edge (city-level, from the IP). We don't store the IP or the result.
import { handler } from '../server/http.js';

const h = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default handler(['GET'], async (req, res) => {
  const lat = Number(h(req.headers['x-vercel-ip-latitude']));
  const lng = Number(h(req.headers['x-vercel-ip-longitude']));
  const city = decodeURIComponent(h(req.headers['x-vercel-ip-city']));
  res.setHeader('cache-control', 'private, no-store');
  res.status(200).json({
    city: city || null,
    country: h(req.headers['x-vercel-ip-country']) || null,
    lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
    lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
  });
});

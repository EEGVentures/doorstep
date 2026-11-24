import { useEffect, useMemo, useState } from 'react';

/**
 * City tabs (Nathan, 4 Nov 2026). Events are grouped by their venue's city. The first visit opens on the city
 * nearest the visitor's connection (/api/geo, city-level IP lookup at Vercel's edge); a tab the visitor picks is
 * remembered on this device and always wins. No postcode, no location prompt.
 *
 * Staging (Nathan, 24 Nov 2026): "all events in all cities". The list starts with an "every city" option and opens
 * on it, without guessing from the connection. Set GUESS_FROM_CONNECTION back to true to open on the nearest city.
 */
export const ALL = 'every city';
const GUESS_FROM_CONNECTION = false;
const KEY = 'ds_city_v2'; // new key so devices that saved a city before 24 Nov open on every city
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (c: string) => { try { localStorage.setItem(KEY, c); } catch { /* private mode */ } };

type Place = { venue_city: string; venue_lat?: number | null; venue_lng?: number | null };

const dist = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const r = (d: number) => (d * Math.PI) / 180, dLat = r(bLat - aLat), dLng = r(bLng - aLng);
  return Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
};

export function useCity(listings: Place[] | undefined) {
  // Cities with nights on, busiest first, each with a centre from its venues.
  const cities = useMemo(() => {
    const m = new Map<string, { name: string; n: number; lat: number; lng: number; k: number }>();
    for (const l of listings ?? []) {
      const c = m.get(l.venue_city) ?? { name: l.venue_city, n: 0, lat: 0, lng: 0, k: 0 };
      c.n++;
      if (l.venue_lat != null && l.venue_lng != null) { c.lat += l.venue_lat; c.lng += l.venue_lng; c.k++; }
      m.set(l.venue_city, c);
    }
    const list = [...m.values()].map((c) => ({ name: c.name, count: c.n, lat: c.k ? c.lat / c.k : null, lng: c.k ? c.lng / c.k : null }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return list.length ? [{ name: ALL, count: listings!.length, lat: null, lng: null }, ...list] : list;
  }, [listings]);

  const [chosen, setChosen] = useState<string | null>(read);
  const [guess, setGuess] = useState<string | null>(null);
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    if (!GUESS_FROM_CONNECTION || chosen || !cities.length) return;
    let off = false;
    fetch('/api/geo').then((r) => (r.ok ? r.json() : null)).then((g: { city: string | null; lat: number | null; lng: number | null } | null) => {
      if (off || !g) return;
      const byName = g.city && cities.find((c) => c.name.toLowerCase() === g.city!.toLowerCase());
      const near = g.lat != null && g.lng != null
        ? cities.filter((c) => c.name !== ALL && c.lat != null).sort((a, b) => dist(g.lat!, g.lng!, a.lat!, a.lng!) - dist(g.lat!, g.lng!, b.lat!, b.lng!))[0]
        : undefined;
      const pick = (byName || near)?.name;
      if (pick) { setGuess(pick); setDetected(true); }
    }).catch(() => {});
    return () => { off = true; };
  }, [chosen, cities]);

  const valid = (c: string | null) => (c && cities.some((x) => x.name === c) ? c : null);
  const city = valid(chosen) ?? valid(guess) ?? cities[0]?.name ?? null;
  const choose = (c: string) => { write(c); setChosen(c); };
  return { cities, city, choose, detected: detected && !chosen };
}

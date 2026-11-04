import { useCallback, useState } from 'react';

/** The customer's "doorstep": a postcode district (outcode) and its centre. Stored on this device only. */
export type Area = { outcode: string; label: string; lat: number; lng: number };

const KEY = 'ds_area';
const read = (): Area | null => { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; } };
const write = (a: Area | null) => { try { a ? localStorage.setItem(KEY, JSON.stringify(a)) : localStorage.removeItem(KEY); } catch { /* private mode */ } };

export function useArea() {
  const [area, setAreaState] = useState<Area | null>(read);
  const setArea = useCallback((a: Area | null) => { write(a); setAreaState(a); }, []);
  return { area, setArea };
}

/** Turns "CF11 7EN" or "cf11" into an outcode and looks up its centre (postcodes.io, free, no key). */
export async function lookupArea(input: string): Promise<Area> {
  const outcode = input.trim().toUpperCase().replace(/\s+/g, ' ').split(' ')[0];
  if (!/^[A-Z]{1,2}\d[A-Z\d]?$/.test(outcode)) throw new Error('That doesn’t look like a UK postcode. Try the first half, like CF11.');
  const res = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(outcode)}`);
  if (!res.ok) throw new Error(`We couldn’t find ${outcode}. Check it and try again.`);
  const { result } = await res.json();
  const town = (result.admin_district?.[0] as string | undefined) ?? '';
  return { outcode, label: town ? `${outcode}, ${town}` : outcode, lat: result.latitude, lng: result.longitude };
}

const km = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const r = (d: number) => (d * Math.PI) / 180, dLat = r(bLat - aLat), dLng = r(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/** Rough door-to-door time. Walk under ~2km, otherwise a city-pace drive. A hint, not a route planner. */
export function travel(area: Area | null, lat?: number | null, lng?: number | null) {
  if (!area || lat == null || lng == null) return null;
  const d = km(area.lat, area.lng, lat, lng) * 1.3; // streets are not straight lines
  if (d <= 2.2) return { km: d, mins: Math.max(3, Math.round((d / 4.8) * 60)), mode: 'walk' as const, label: `${Math.max(3, Math.round((d / 4.8) * 60))} min walk` };
  // City pace for the first 10km, then main roads.
  const mins = Math.round((Math.min(d, 10) / 25) * 60 + (Math.max(0, d - 10) / 80) * 60 + 6);
  return { km: d, mins, mode: 'drive' as const, label: mins >= 60 ? `${Math.round((mins / 60) * 2) / 2} hr drive` : `${mins} min drive` };
}

/** How far counts as "on your doorstep". Further nights still show, in their own row. */
export const NEAR_KM = 30;

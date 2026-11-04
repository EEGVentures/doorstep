export const pounds = (pence: number | null | undefined) =>
  pence == null ? '' : `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
export const pounds2 = (pence: number) => `£${(pence / 100).toFixed(2)}`;

const fmt = (iso: string, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...o }).format(new Date(iso));
export const eventDate = (iso: string, tz = 'Europe/London') => fmt(iso, tz, { weekday: 'short', day: 'numeric', month: 'short' });
export const eventDateLong = (iso: string, tz = 'Europe/London') => fmt(iso, tz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const eventTime = (iso: string, tz = 'Europe/London') => fmt(iso, tz, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '').toLowerCase();

export function untilText(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const h = Math.floor(ms / 3600_000);
  if (h >= 48) return `in ${Math.floor(h / 24)} days`;
  if (h >= 1) return `in ${h} hour${h === 1 ? '' : 's'}`;
  return `in ${Math.max(1, Math.round(ms / 60_000))} minutes`;
}

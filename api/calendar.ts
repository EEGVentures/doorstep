// GET /api/calendar?event=<slug>  Add-to-calendar file for an event.
import { handler, HttpError } from '../server/http.js';
import { db } from '../server/supabase.js';

const ics = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');

export default handler(['GET'], async (req, res) => {
  const slug = String(req.query.event ?? '');
  const { data: ev } = await db().from('events').select('id, slug, title, starts_at, doors_at, venue:venues(name, address_line, city, postcode)').eq('slug', slug).neq('status', 'draft').maybeSingle();
  if (!ev) throw new HttpError(404, 'NOT_FOUND', 'Event not found');
  const v = ev.venue as unknown as { name: string; address_line: string | null; city: string; postcode: string | null };
  const start = new Date(ev.doors_at);
  const end = new Date(new Date(ev.starts_at).getTime() + 3 * 3600_000);
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Doorstep//Tickets//EN', 'BEGIN:VEVENT',
    `UID:${ev.id}@doorstep.live`, `DTSTAMP:${ics(new Date())}`, `DTSTART:${ics(start)}`, `DTEND:${ics(end)}`,
    `SUMMARY:${esc(ev.title)}`, `LOCATION:${esc([v.name, v.address_line, v.city, v.postcode].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${esc('Your tickets are in your Doorstep wallet from 48 hours before doors.')}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  res.setHeader('content-type', 'text/calendar; charset=utf-8');
  res.setHeader('content-disposition', `attachment; filename="${ev.slug}.ics"`);
  res.status(200).send(body);
});

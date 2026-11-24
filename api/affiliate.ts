// Partner show links (e.g. Blue Light Card, Tickets for Good). Public, no sign-in needed to view.
// GET  /api/affiliate?code=XYZ   -> the event and its tickets for that link
// POST /api/affiliate { code, visitorId, utm_*, referrer }  -> records a visit for partner reporting
import { z } from 'zod';
import { bodyOf, handler, HttpError } from '../server/http.js';
import { db } from '../server/supabase.js';

const Code = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,40}$/);

async function resolve(code: string) {
  const { data } = await db().from('affiliate_links')
    .select('id, code, status, max_per_order, expires_at, event_id, partner:partners(name, status, welcome_title, welcome_line)')
    .eq('code', code).maybeSingle();
  return data;
}

export default handler(['GET', 'POST'], async (req) => {
  if (req.method === 'GET') {
    const code = Code.safeParse(req.query.code);
    if (!code.success) throw new HttpError(404, 'LINK_NOT_FOUND', 'This link is not valid.');
    const link = await resolve(code.data);
    if (!link) throw new HttpError(404, 'LINK_NOT_FOUND', 'This link is not valid.');
    // The database decides validity (approved partner, active link, before sales close).
    const { data: valid } = await db().rpc('valid_affiliate_link', { p_code: code.data, p_event: link.event_id });
    const { data: ev } = await db().from('events')
      .select('id, slug, title, description, image_url, starts_at, doors_at, status, venue:venues(name, city, address_line, postcode, timezone), ticket_types(id, name, price_pence, fee_pence, face_value_pence, capacity, sold, held, max_per_order, active, sort_order)')
      .eq('id', link.event_id).single();
    if (!ev) throw new HttpError(404, 'LINK_NOT_FOUND', 'This link is not valid.');
    const partner = link.partner as unknown as { name: string; welcome_title: string | null; welcome_line: string | null };
    return {
      code: link.code,
      valid: Boolean(valid?.id),
      partnerName: partner?.name ?? null,
      welcomeTitle: partner?.welcome_title ?? null,
      welcomeLine: partner?.welcome_line ?? null,
      maxPerOrder: link.max_per_order,
      event: {
        ...ev,
        ticket_types: (ev.ticket_types as any[]).filter((t) => t.active).sort((a, b) => a.sort_order - b.sort_order)
          .map(({ capacity, sold, held, ...t }) => ({ ...t, available: Math.max(capacity - sold - held, 0) > 0 })),
      },
    };
  }

  const body = bodyOf(req, z.object({
    code: Code,
    visitorId: z.string().min(8).max(64),
    referrer: z.string().max(500).optional(),
    utm_source: z.string().max(100).optional(),
    utm_medium: z.string().max(100).optional(),
    utm_campaign: z.string().max(100).optional(),
  }).parse);
  const link = await resolve(body.code);
  if (!link) return { recorded: false };
  let referrerHost: string | null = null;
  try { referrerHost = body.referrer ? new URL(body.referrer).host : null; } catch { /* ignore */ }
  // One visit per visitor per link per 30 minutes, so refreshes do not inflate partner numbers.
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { count } = await db().from('affiliate_link_visits').select('id', { count: 'exact', head: true })
    .eq('link_id', link.id).eq('visitor_id', body.visitorId).gte('landed_at', since);
  if (!count) {
    await db().from('affiliate_link_visits').insert({
      link_id: link.id, visitor_id: body.visitorId, referrer_host: referrerHost,
      utm_source: body.utm_source ?? null, utm_medium: body.utm_medium ?? null, utm_campaign: body.utm_campaign ?? null,
    });
  }
  return { recorded: true };
});

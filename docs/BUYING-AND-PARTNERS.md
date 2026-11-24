# Buying tickets and partner links

**Model change (Nathan, 24 Nov 2026):** no paid membership or subscription. Browsing is free on the web and in the app; a free account is needed to buy; the only payment is the ticket. Tickets go to the Doorstep wallet and Apple Wallet. Reason: every gateway before purchase adds drop-off.

## Two ways to buy a ticket

1. **Direct route.** Anyone signed in can book any on-sale event. Up to 6 tickets per order by default. Recorded as `route = 'direct'`.
2. **Partner route.** A visitor arrives on an event-specific partner link (`/go/CODE`), for example from Blue Light Card or Tickets for Good. The page opens with the partner's own welcome header (`partners.welcome_title` / `welcome_line`, e.g. "Thank you to our Blue Light services!"). They create a free account and book. **No upsell before purchase** (Nathan, 4 Nov 2026). Recorded as `route = 'affiliate'` with the link, for partner reporting.

The database decides the route (`create_reservation()`): a valid link for that event makes it a partner order; otherwise it is direct. An account can hold stock for at most 3 events at once, and a new hold on an event replaces the earlier one (`DS_HOLD_LIMIT`, security review 24 Nov 2026). A link is valid when its partner is admin-approved, the link is active, and the event's sales have not closed (or the link's own expiry, if set).

## What we capture on the partner route

| Data | Stored in | Why |
| --- | --- | --- |
| Each visit to the link (random first-party visitor id, referrer host, UTM tags) | `affiliate_link_visits` | Funnel: visits to sign-ups to sales |
| Who signed up through which link and partner (first touch wins) | `profiles.acquired_via_link_id / _partner_id` | Audience growth per partner |
| Marketing consent, as an explicit unticked-by-default choice with timestamp and policy version | `consent_events`, `profiles.marketing_email_consent` | Lawful follow-up marketing (UK GDPR/PECR) |
| Every order made through the link, with refunds netted | `orders.affiliate_link_id`, view `partner_sales_ledger` | Accurate partner reporting |

## Reporting back to partners

- Live table on `/ops`: visits, unique visitors, sign-ups, marketing opt-ins, orders, tickets, net sales, per link.
- **Partner statement**: `/api/ops?action=partner-statement&partnerId=…&from=YYYY-MM-DD&to=YYYY-MM-DD` (button on `/ops`). CSV, one row per order with ticket value, fees, refunds and net. It contains **no customer names or emails**, so it can be sent to the partner as it is. Each download is audited.
- Commission is not calculated yet (open decision). The statement has the figures needed once a rate is agreed.

## Prices for guests

Open decision (24 Nov 2026, mock-up `price-visibility-options.png` in project files): show prices to everyone, or only after sign-in. The code ships **signed-in only**: guests have no column grant on `ticket_types` prices and `event_listings.from_price_pence` is null for them (`listing_from_price()`). To show prices to everyone, change `public.prices_public()` to return true and grant the price columns to `anon` (one migration).

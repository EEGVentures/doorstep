# Membership and partner links

## Two ways to buy a ticket

1. **Member route.** Anyone with an active membership can book any on-sale event. Up to 6 tickets per order by default.
2. **Partner route.** A visitor arrives on an event-specific partner link (`/go/CODE`), for example from Blue Light Card or Tickets for Good. They create a free account and book. **No membership, no paywall, no upsell before purchase** (Nathan, 4 Nov 2026: we are building our audience from partners' audiences and must not lose them at the first hurdle).

The database decides which route applies (`create_reservation()`): a valid link for that event wins; otherwise an active membership is required. A link is valid when its partner is admin-approved, the link is active, and the event's sales have not closed (or the link's own expiry, if set).

## What we capture on the partner route

| Data | Stored in | Why |
| --- | --- | --- |
| Each visit to the link (random first-party visitor id, referrer host, UTM tags) | `affiliate_link_visits` | Funnel: visits to sign-ups to sales |
| Who signed up through which link and partner (first touch wins) | `profiles.acquired_via_link_id / _partner_id` | Audience growth per partner |
| Marketing consent, as an explicit unticked-by-default choice with timestamp and policy version | `consent_events`, `profiles.marketing_email_consent` | Lawful follow-up marketing (UK GDPR/PECR) |
| Every order made through the link, with refunds netted | `orders.affiliate_link_id`, view `partner_sales_ledger` | Accurate partner reporting |
| Later conversion to membership | `affiliate_link_stats.converted_to_members` | Shows partners' long-term value |

## Reporting back to partners

- Live table on `/ops`: visits, unique visitors, sign-ups, marketing opt-ins, orders, tickets, net sales and members gained, per link.
- **Partner statement**: `/api/ops?action=partner-statement&partnerId=…&from=YYYY-MM-DD&to=YYYY-MM-DD` (button on `/ops`). CSV, one row per order with ticket value, fees, refunds and net. It contains **no customer names or emails**, so it can be sent to the partner as it is. Each download is audited.
- Commission is not calculated yet (open decision). The statement has the figures needed once a rate is agreed.

## Membership

- **Web:** Stripe Billing subscription, monthly. Price comes from the Stripe Price with lookup key `doorstep_membership_monthly`, so changing the price never needs a code change. Optional free trial (`MEMBERSHIP_TRIAL_DAYS`, default 0). Members manage and cancel in the Stripe customer portal (cancel at period end), which meets the UK online-cancellation expectation.
- **iOS:** auto-renewable in-app purchase (`live.doorstep.membership.monthly`), Small Business Program. The app sets `appAccountToken` to the Supabase user id. App Store Server Notifications V2 go to `/api/webhooks/apple`.
- **One entitlement:** both write to `membership_entitlements`; `has_active_membership()` reads it. A member from either store can book on both.
- **States:** active and trialing have access; past due keeps access for `MEMBERSHIP_GRACE_DAYS` (default 7) after the period end while Stripe retries; cancelled keeps access to the end of the paid period; an immediate cancellation, refund or revoke ends it straight away.
- **Emails:** membership-active on first activation; renewal reminder from Stripe's `invoice.upcoming` (timing set in the Stripe dashboard; see `docs/DECISIONS.md`).

## Converting partner customers to members (later, never at the first hurdle)

Recommended, not built: after the event, a follow-up email to opted-in partner customers offering membership (for example a free first month, as in the customer cycle PDF). This uses consent already captured and never blocks the partner purchase.

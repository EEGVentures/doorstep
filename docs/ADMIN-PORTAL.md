# Admin portal scope (agreed direction, 4 Nov 2026)

Doorstep staff only. Not self-service: promoters, venues and partners do not log in. Roles are set by an admin, never self-assigned (enforced: `profiles.role` is not writable by users).

## Nathan's three focuses

1. **Top-level admin access for Doorstep staff.** Roles `admin` and `ops` (later `finance`), two-factor sign-in for staff, every change written to `audit_events`.
2. **Bulk import of events.** Upload a CSV or a promoter's on-sale sheet; preview and fix rows; create events and ticket types as drafts; publish in one step. Port of Base44 `BulkUpload` (it also used AI extraction).
3. **Analytics home.** Financial reporting plus page views, traffic sources, trackable links, affiliates and external analytics sources.

## Also needed (proposed additions)

| Area | Why | Notes |
| --- | --- | --- |
| Event and stock management | Create and edit events, ticket types, allocations and prices; on sale, pause, close, cancel with automatic refunds | Port of Base44 `BuildShow`; cancel-and-refund is already in `api/ops.ts` |
| Venues and close-offs | Venue details, close-off recipients and schedule, delivery and import-confirmation status per report, the switch to go live per venue | Tables exist; ack is on `/ops` |
| Partners and links | Approve partners, create show links, download statements, commission when agreed | Built in the API; needs screens |
| Venue and promoter settlement | What Doorstep owes each venue or promoter per event (allocation cost price × tickets sold, less refunds) | Base44 had `cost_price` on allocations; needs a settlement table and statement |
| Orders and customer support | Find a customer or order, refund, resend an email, see the issue queue (paid-after-expiry, amount mismatch) | Exceptions already listed on `/ops` |
| Members | Member count, new, cancelled, churn, monthly recurring revenue, comp memberships | From `membership_entitlements` and Stripe |
| Emails and communications | Delivery log per customer, failed sends, consented marketing audience export | From `email_outbox`, `consent_events` |
| Privacy requests | Export or delete a customer's data on request (UK GDPR, one month to respond) | Keep order records needed for accounting |
| Safety switches | See at a glance whether live payments, venue sending and real emails are on | Read-only display of env settings |
| Homepage curation | Feature events, order categories | Later |

## Analytics home: data sources

| Data | Source | Notes |
| --- | --- | --- |
| Revenue, fees, refunds, net, by event, venue, partner and channel | Our database (orders, refunds) | Exact, reconciles with Stripe |
| Stripe payouts and fees | Stripe API | Reconciliation view |
| Membership revenue and churn | Stripe Billing + App Store | |
| Page views, visitors, traffic sources, funnel (view, sign-up, join, checkout, paid) | First-party events table in Supabase, cookieless | No consent banner needed for basic, anonymous counts; works without third-party tools |
| Trackable links (UTM, partner codes, QR codes on posters) | `affiliate_link_visits` + UTM on orders | Extend to non-partner campaign links |
| Paid ads and social | GA4 / Google Ads, Meta pixel and Conversions API, Metricool | Only after cookie consent; Google Ads needs event-ticket-seller certification first |

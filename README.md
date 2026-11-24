# Doorstep

Good nights out, on your Doorstep. Web app and API for Doorstep Tickets, rebuilt off Base44 onto company-owned services.

| Part | Choice (approved 4 Nov 2026) |
| --- | --- |
| Web app | React 18 + Vite + React Router + TanStack Query + Tailwind (`src/`) |
| Server | Vercel serverless functions (`api/`, shared code in `server/`) |
| Database, auth | Supabase Postgres with row-level security, Supabase Auth (`supabase/migrations/`) |
| Payments | Stripe Checkout for tickets, the only payment (no membership since 24 Nov 2026). TEST MODE until Nathan approves live. |
| Email | Resend from `tickets@doorsteptickets.com` (root domain verified in Resend, eu-west-1), templates in `emails/` |

Start here on Friday: **[docs/KICKOFF-FRIDAY.md](docs/KICKOFF-FRIDAY.md)**.

## Commands

```sh
npm ci
npm run dev          # web app on :5173 (use `vercel dev` to run the API too)
npm test             # unit tests (pricing rules, close-off CSV, emails, partner statements)
npm run test:db      # migrations + RLS + business rules + last-ticket race on a throwaway Postgres
npm run build        # type-check and build
npm run email:build  # re-embed emails/*.html after editing a template
npm run stripe:setup # create the ticket-payment webhook in Stripe TEST mode
```

## How the important rules are enforced

| Rule | Where |
| --- | --- |
| Free to browse; a free account is needed to buy; partner links recorded on the order | `create_reservation()` in `supabase/migrations/…no_membership.sql` |
| Partner links open with the partner's welcome header and no upsell; visits, sign-ups and sales tracked per link | `src/pages/PartnerLink.tsx`, `affiliate_link_visits`, `affiliate_link_stats`, `partner_sales_ledger` |
| Last ticket sold once | conditional stock update in `create_reservation()`; `tests/db/concurrency.mjs` |
| Paid only on a verified Stripe event; duplicates harmless | `api/webhooks/stripe.ts`, `provider_events`, `fulfil_order()` |
| Barcodes random, unique forever, never reused | `generate_barcode()`, `ticket_barcodes` (immutable) |
| Barcode visible to the buyer only from 48h before doors | RLS policy `barcodes_owner_after_reveal` |
| One standard close-off CSV, versioned, sold-out events included | `server/closeoff.ts`, `server/closeoff-runner.ts` |
| No live payments, venue sends or real customer emails by accident | `ALLOW_LIVE_PAYMENTS`, `CLOSEOFF_LIVE_SENDING`, `EMAIL_SANDBOX_TO` in `server/env.ts` |

See `docs/` for the buying and partner design, open decisions and what still needs porting from Base44.

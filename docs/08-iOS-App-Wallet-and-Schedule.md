# 08 — iOS App, Apple Wallet, Approved Decisions and Dated Plan

Status: approved by Nathan on 4 November 2026 unless marked PROPOSED. Add this file to `docs/`, list it in `docs/00-READING-ORDER.md` after `docs/06`, and treat it as superseding any statement elsewhere in the pack that a native app is out of scope.

## 1. Decisions now approved

| Topic | Decision |
| --- | --- |
| Web stack | Keep React 18 + Vite + React Router + TanStack Query + Tailwind. No Next.js rewrite. Hosted on Vercel, with server code in Vercel serverless functions. |
| Database, auth, storage | Supabase (Postgres with row-level security, Supabase Auth, Supabase Storage). Approved. |
| Transactional email | Resend. Approved. Mailchimp only for consented marketing. |
| Payments | The existing Stripe account in the Doorstep company name. Stripe Checkout for tickets, Stripe Billing for web membership. |
| iOS app | Required at soft launch (Nathan's decision, 14 Oct 2026). Expo (React Native), same Supabase backend and logins. Not Capacitor. |
| Ticket reveal | One server-enforced rule: barcodes become visible to the buyer 48 hours before the event's doors time. Venue close-off export is not blocked by the reveal. |
| Affiliate link defaults | Up to 6 tickets per order. Repeat orders allowed while the link is live. Link expires when the event's sales close. An admin approves every affiliate partner. Admins can override per link. |
| Scheduled jobs | PROPOSED: Vercel Cron triggering idempotent Supabase-backed job rows. Confirm with Nathan before adding Inngest or another provider. |

## 2. iOS app scope

- Same features as the web customer app: Discover, event detail, sign-in, membership, checkout, wallet, account. Admin and venue operations stay web-only.
- Shares the Supabase backend, API contracts and entitlement checks with the web app. No business logic lives only in the app.
- Uses the brand pack: C wordmark and v4 emblem from `assets/current/identity/`, bundled Poppins and Inter, the emblem-only waving loader (native Lottie or sprite equivalent, with a reduced-motion fallback).
- App icon and splash from the approved icon pack.
- Push notifications: PROPOSED, not required for soft launch (Expo notifications if added; OneSignal is not approved).
- Distributed through TestFlight to Nathan for every build from December.

## 3. Payments inside the iOS app (Apple rules)

Source: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), read 4 Nov 2026. This is our reading, not an Apple ruling.

- **Event tickets** are services used outside the app. Guideline 3.1.3(e) says these must use a payment method other than in-app purchase. Tickets (member and affiliate) are paid through Stripe, with Apple Pay offered inside Stripe.
- **Monthly membership** is a subscription bought in the app. Guidelines 3.1.1 and 3.1.2 say subscriptions that unlock functionality must use in-app purchase. The guidelines do not clearly exempt a membership whose only benefit is the right to buy physical tickets, so assume in-app purchase is required.
- **Build it this way:**
  1. iOS sells membership as an auto-renewable in-app purchase subscription. Enrol in the App Store Small Business Program (15% commission instead of 30%).
  2. Web sells membership through Stripe Billing.
  3. Both write to one `membership_entitlements` record in Supabase, fed by Stripe webhooks and App Store Server Notifications V2. A member who joined on either channel can buy tickets on both.
  4. The iOS app must not link or point users to the web to buy membership (UK storefront rules in 3.1.1(a) and 3.1.3). Emails outside the app are allowed.
  5. Prices may differ between iOS and web. Nathan sets both when the price is decided.
- Before App Store submission, describe the membership model in the review notes. If App Review challenges it, ask Nathan before changing the payment design.

## 4. Apple Wallet tickets

- Each valid ticket can be added to Apple Wallet as a pass from the app and from the web wallet.
- The pass is generated server-side on Vercel and signed with a Pass Type ID certificate from the company's Apple Developer account. The certificate and keys live only in Vercel environment variables, never in Git or `VITE_` variables.
- The pass becomes available at the 48-hour reveal, not before. It carries the same exact barcode string that goes in the venue close-off report, as a QR code (the standard format in section 5a).
- Passes support Wallet's update web service: a refunded or cancelled ticket's pass is voided, and a reissued ticket gets a new pass with a new code.
- Google Wallet: PROPOSED, after soft launch.

## 5. Barcode and close-off rules to add to `docs/06`

- Every event with at least one valid ticket gets a close-off report, whatever its sale status. This includes `sold_out` events (the Base44 code only processed `on_sale`).
- A barcode value is issued once. A refunded, cancelled or replaced ticket's code is never reused or resold.
- Codes come from a cryptographically secure random generator, are unique in the database, and follow the one platform-wide format in section 5a.

## 5a. One standard close-off format (approved 4 Nov 2026)

Doorstep produces close-offs in one standard format, the way Tixr, Ticket Tailor and Ticketmaster export barcodes for third-party scanners. Do not build per-venue or per-scanner adapters. This replaces any instruction in `docs/06` or `CLAUDE.md` to build venue-specific CSV templates or import mappings.

Standard CSV, UTF-8, comma-separated, header row, every value quoted as text so leading zeros survive:

```csv
barcode,status,event_id,event_name,venue_name,doors_local,ticket_type,ticket_price,order_ref,holder_first_name,holder_last_name,issued_at,report_version
```

- `barcode`: the exact issued string. Alphanumeric, fixed length set once platform-wide (PROPOSED: 12 characters, uppercase A–Z and 2–9, no lookalike characters).
- `status`: `valid` or `revoked`. A full report lists all valid tickets. A revision report lists only rows that changed since the previous version.
- `doors_local`: ISO 8601 with offset, e.g. `2027-02-12T19:00:00+00:00`.
- `ticket_price`: decimal pounds, e.g. `12.60`.
- Ticket barcodes and Wallet passes use QR by default, carrying the same `barcode` string.

Each report email carries the CSV plus a summary: event, doors time, version, total valid tickets, counts by ticket type, and added and revoked counts since the last version. Venues import the same file whatever scanner they run; a venue that needs a different layout is handled by hand, not by a code adapter.

## 6. Dated plan to soft launch

The October migration plan targets a soft launch in early February 2027. Membership, affiliates and direct venue sending are new scope, so the dates below are tighter. If phase 4 slips, cut scope (see list below) rather than move the launch.

| # | Phase | Dates | Exit check |
| --- | --- | --- | --- |
| 1 | Local foundation (`START-IN-CLAUDE.md`) | 4–21 Nov 2026 | Fixture app renders all routes, network-blocking tests pass |
| 2 | Supabase schema, RLS, auth, Vercel preview | 17 Nov – 5 Dec | A test user signs in on a Vercel preview; RLS tests pass |
| 3 | Commerce: ticket checkout, Stripe Billing membership, affiliate links, 48h reveal | 24 Nov – 19 Dec | Test member and affiliate purchases succeed; non-member purchase is refused |
| 4 | iOS app (Expo), in-app purchase membership, Apple Wallet passes | 1 Dec – 16 Jan 2027 | Nathan buys a test ticket in TestFlight and adds it to Wallet |
| 5 | Close-off production workflow, Tramshed Cardiff rehearsal to Nathan's inbox | 1 Dec – 9 Jan | A mock Tramshed event produces versioned reports on schedule |
| 6 | Test and harden: payments, load test, penetration test, GDPR paperwork | 5–30 Jan | No high-severity pen-test findings open |
| 7 | App Store submission | by 23 Jan | Build submitted with review notes on membership |
| 8 | Soft launch | early Feb 2027 | Real events live, with daily checks |

Christmas is inside phases 3–5; the January dates assume about one week off.

**Cut list if the date is at risk (in this order):** P1 operational reports; affiliate admin polish beyond create/approve/expire; Google Wallet; push notifications; iOS-only polish. Never cut: the membership gate, server-side entitlements, barcode rules above, or close-off delivery tracking.

## 7. Still for Nathan to decide

- Monthly membership price (web and iOS), what it includes beyond purchase access, and cancellation/grace rules.
- Whether affiliates earn commission, and how much.
- Tramshed Cardiff's real box-office recipient (see the Tramshed venue profile).
- Barcode length and character set (PROPOSED in section 5a).

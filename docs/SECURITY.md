# Security review before the paid test (24 Nov 2026)

Reviewed: `main` at 1c799ac plus open PR #1 (API grants), the staging Vercel project and its settings.
Purpose: fix what we can before the focused security test (about £2,000), so the tester finds less.

## What is already in good shape

- **Card details never touch Doorstep.** Stripe Checkout takes the payment. Prices are set on the server.
- **Database rules (RLS) are on for every table.** A customer can read only their own orders and tickets.
  Barcodes are readable only by the owner from 48 hours before doors. Payments, stock, refunds and
  partner data are server-only. Guests cannot read private tables at all once PR #1 is merged.
- **The admin (service role) key is server-only.** Only `VITE_SUPABASE_URL` and the publishable key go to the browser.
- **Stripe webhook checks Stripe's signature** on the raw body and processes each event once.
- **No secrets in Git**, in any branch or in history. `.env` files are ignored.
- **Order refs and barcodes are cryptographically random**, so they cannot be guessed in sequence.
- **Preview deployments are behind Vercel sign-in.** Only the real domain will be public.
- **Partner visits store no IP address**, only a random visitor id, referrer site and UTM tags.

## Fixed in this PR

| Issue | Fix |
| --- | --- |
| Sign-in `?next=//evil.site` could send a customer to a look-alike site after signing in (also a known React Router issue) | `src/lib/safeNext.ts` only allows paths on our own site; tested |
| No Content Security Policy: if any script injection was found, it could send data anywhere | CSP in `vercel.json`: scripts only from our site, data only to our site and Supabase, no framing. Checked in Chromium with no violations |
| Cron secret compared with `!==` (timing leak) | Constant-time comparison |
| Partner link codes made with `Math.random` (predictable) | Cryptographic random codes |

## For the no-membership rebuild (needs database changes, so it belongs on that branch)

1. **Stock hoarding by fake accounts.** Email confirmation is off and sign-up has no CAPTCHA, so a bot could
   create many accounts and hold every ticket for 35 minutes each. Add CAPTCHA (below) and cap active holds per
   account per event in `create_reservation`, with a test in `tests/db/`.
2. **Delete my account.** Add a self-service delete that anonymises the profile but keeps order records
   (needed for accounts for 6 years), and a scheduled job that deletes partner visit rows after 13 months
   and anonymises accounts inactive for 3 years. Numbers to confirm in the privacy policy.
3. **Staff two-step sign-in.** Require Supabase MFA (`aal2`) in `requireStaff`, so a stolen staff password
   alone cannot open the ops tools or download partner statements.
4. **`Join.tsx` uses `next` unchecked.** It goes away with membership; if any part stays, use `safeNext`.
5. **Close-off CSV carries barcodes as an email attachment.** Consider an expiring download link for venues
   instead, in line with the "barcodes never in emails" rule.
6. **Dependencies.** `zod` 3 (memory advisory, not reachable: no array inputs) and `react-router` 6
   (redirect advisory, covered by `safeNext`) should move to their current majors. `vitest` and
   `@vercel/node` advisories are dev-only and never shipped.

## Account settings only Nathan can change

1. **Vercel:** re-save `STRIPE_WEBHOOK_SECRET` as *Sensitive* (Vercel flags it as readable). Mark
   `STRIPE_SECRET_KEY` Sensitive when it is added.
2. **Two-step sign-in** on Vercel, Supabase, Stripe, GitHub, Resend, Google Workspace and Apple Developer,
   with every login in a password manager.
3. **Supabase, Authentication > Attack Protection:** turn on CAPTCHA (Cloudflare Turnstile, free) and
   leaked-password protection; keep the default sign-in rate limits.
4. **Supabase production:** point-in-time recovery (paid add-on) and daily backups.
5. **Vercel Firewall:** turn on bot protection and add rate limits for `/api/checkout` and `/api/affiliate`.
6. **GitHub:** protect `main` (CI must pass), turn on secret scanning and Dependabot alerts.
7. **Paperwork:** ICO registration, privacy policy, a one-page breach plan (report to the ICO within 72 hours),
   and data agreements with partners such as Blue Light Card.

## Ask the tester to focus on

Partner links (`/go/CODE`) and attribution, sign-up and sign-in, checkout (price tampering, holding stock),
the wallet and barcode reveal time, and the ops endpoints (`/api/ops`) with a customer account.

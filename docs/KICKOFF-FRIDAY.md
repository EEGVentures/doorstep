# Friday 6 November 2026, 9:00 GMT: build kickoff

Goal for the day: the app running on a Vercel **preview** against a Supabase **staging** project, Stripe in **test mode**, Resend sending to Nathan's inbox only. A test member and a test partner-link customer each buy a ticket end to end. Nothing goes to production, no live billing, no venue sends.

## Before 9:00 (Nathan, about 30 minutes)

Use company accounts. Sign up with accounts@doorstep.live once Google Workspace exists, or your own address for now and transfer later.

| # | Do this | Then give Claude |
| --- | --- | --- |
| 1 | Create a GitHub organisation for Doorstep (free plan is fine) and an empty **private** repo, e.g. `doorstep`. Connect it here: https://claude.ai/connect-github | The repo name |
| 2 | Create a **Supabase** project called `doorstep-staging`, region **London (eu-west-2)**. Save the database password somewhere safe. | Project URL, anon key, service-role key (Settings → API) |
| 3 | Create a **Vercel** team for Doorstep. Pro is needed for the 5-minute cron (close-offs, reminders); Hobby works for day one. Don't import the repo yet. | Nothing yet |
| 4 | **Stripe:** stay in **Test mode** (toggle top right). Developers → API keys → reveal the test secret key (`sk_test_…`). | The test secret key |
| 5 | Create a **Resend** account. Add the domain `send.doorstep.live`; it shows 3–4 DNS records. Add them in Wix DNS (doorstep.live stays on Wix until cutover). | API key (`re_…`) |

Keys go into Vercel's environment variables, not chat, if you prefer. Claude can walk you through it on the day.

## 9:00 to 10:30 (Claude, with Nathan on hand)

1. **Push the code.** Push the prepared repo (from `/mnt/project-files/doorstep/build/doorstep-rebuild.bundle`) to the company repo, `main` protected, CI on.
2. **Database.** `supabase link` to staging, then `supabase db push` runs the three migrations. Run `supabase/seed.sql` for the Tramshed test event and the `BLC-TEST` partner link. Supabase Auth: set Site URL to the Vercel preview URL; decide on email confirmation (docs/DECISIONS.md item 8).
3. **Vercel.** Import the repo (framework Vite, root `/`). Add every variable from `.env.example` to **Preview** (not Production). Generate `CRON_SECRET` with `openssl rand -hex 24`. Set `EMAIL_SANDBOX_TO` and `CLOSEOFF_TEST_RECIPIENT` to nathan@ernestpromotions.com.
4. **Stripe.** `MEMBERSHIP_PRICE_PENCE=<test price> SITE_URL=<preview URL> npm run stripe:setup`. It refuses live keys. It creates the membership price, the customer portal and the webhook, and prints the webhook secret for `STRIPE_WEBHOOK_SECRET`. In Stripe Billing settings, set the upcoming-renewal email event to the agreed number of days.
5. **Smoke test on the preview.**
   - Sign up as a new user. The event page asks you to join. Join with test card `4242 4242 4242 4242`. The account shows Member.
   - Buy 2 tickets. The wallet shows them as "lands in N days". Order email arrives in Nathan's inbox, marked [preview].
   - In a private window, open `/go/BLC-TEST`. No membership mention anywhere. Sign up, buy 1 ticket. `/ops` shows 1 visit, 1 sign-up, 1 order for the partner; the statement CSV downloads.
   - Refund one order from the Stripe dashboard. Its tickets turn revoked in the wallet.
   - Make yourself admin: in Supabase SQL editor, `update profiles set role = 'admin' where email = 'nathan@ernestpromotions.com';`
6. **Close-off rehearsal.** Move the test event's doors to 47 hours from now. The next cron tick emails a `[TEST] Preview v1` CSV to Nathan only.

## After the kickoff (this week and next)

Phase 2 of docs/08 (17 Nov to 5 Dec): port the admin screens (create event, bulk upload, dashboards) from docs/PORTING-BACKLOG.md, write the six remaining launch emails, and add Sentry or Vercel monitoring. Phase 3 (from 24 Nov): live-like rehearsal of payments and refunds.

## Things that are already true

- `npm test` (25 tests) and `npm run test:db` (schema, row-level security, every business rule, and a 25-buyer race for the last 5 tickets) pass.
- `npm run build` passes.
- Live payments, venue sending and real customer emails are each behind a switch that defaults to off.

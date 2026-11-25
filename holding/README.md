# Doorstep holding page (doorsteptickets.com until launch)

A standalone pre-launch page: "Good nights out, on your Doorstep.", a small app mock-up, **Launching February 2027**,
a first-access email sign-up, and a separate route for event promoters and venues (partners@doorsteptickets.com).
It is deliberately separate from the app rebuild in the rest of this repo. No build step, no dependencies.

```
holding/
  index.html      the page
  privacy.html    privacy notice for the sign-up (served at /privacy)
  styles.css      brand tokens, Liquid Glass, bento, soft 3D, motion
  app.js          entrance motion + sign-up form
  api/signup.js   POST /api/signup -> Supabase public.register_launch_interest()
  assets/         brand logos (public/brand copies), fonts, placeholder photos, og.jpg
  vercel.json     security headers, CSP, London region
```

## Sign-ups and enquiries (Resend)

- `POST /api/signup`: the person becomes a Resend contact in the segment **First access** (and **News opt-in** if
  they ticked the unticked marketing box). Segments are created automatically on first use. New contacts get one
  confirmation email from `Doorstep <tickets@doorsteptickets.com>`, reply-to `support@`. Someone already on the list
  is never emailed twice.
- `POST /api/partner`: promoter / venue enquiries are emailed to `partners@doorsteptickets.com` (override with
  `PARTNERS_TO`) with reply-to set to the enquirer. No auto-reply.
- Optional consent record in Supabase (`public.launch_signups`, migration `20261124130000_launch_signups.sql`) when
  `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.
- **Only doorsteptickets.com and www store or send anything.** preview.doorsteptickets.com and *.vercel.app are demos:
  the forms say thanks and nothing is saved or sent. `HOLDING_PREVIEW=1` forces demo mode everywhere.
- Tests: `tests/unit/holding-signup.test.ts`, `tests/db/40_launch_signups.sql`.

### Bot protection
Same-origin check, hidden honeypot field, minimum fill time (2.5s), and a per-IP hourly limit (5 sign-ups, 3
enquiries). IPs are only used as a salted hash. Bots get a fake "ok". If spam gets through, add Cloudflare Turnstile.

## Hosting

Vercel project `doorstep-holding` (team EEG VENTURES), Root Directory `holding`, no build step.
Environment variables: `RESEND_API_KEY` (a **Full access** Resend key, needed for contacts and segments; never `VITE_`),
optional `HOLDING_IP_SALT`, `PARTNERS_TO`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `COMPANY_LEGAL_NAME`,
`COMPANY_NUMBER`, `COMPANY_ADDRESS` for the confirmation email footer (left out until set).
DNS (GoDaddy): `A @ 216.198.79.1`, `CNAME www -> <value Vercel shows>`, `CNAME preview -> <value Vercel shows>`.
At launch, move doorsteptickets.com to the app project.

## Before it goes live
- Photos are the placeholder set from the app demo (AI reference images). Swap for licensed photos.
- Privacy notice: add the company's registered name and address once Doorstep Tickets Ltd details are final, and make sure the `privacy@` group exists.

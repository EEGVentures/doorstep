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

## Sign-ups

Stored in Supabase table `public.launch_signups` (migration `supabase/migrations/20261124130000_launch_signups.sql`,
tests in `tests/db/40_launch_signups.sql` and `tests/unit/holding-signup.test.ts`).

- The email is used to tell the person when accounts open (that is what they asked for).
- Marketing is a separate, **unticked** box. When ticked we store the exact wording and the time (UK GDPR / PECR).
  Not ticking it on a later visit never removes an earlier yes. Withdrawal sets `unsubscribed_at`.
- Server-only: RLS on, no policies, no grants to `anon` or `authenticated`.

Export for the launch email (Supabase > SQL Editor):

```sql
select email, marketing_consent from public.launch_signups where unsubscribed_at is null order by created_at;
```

### Bot protection
Same-origin check, a hidden honeypot field, a minimum fill time (2.5s), and at most 5 attempts per IP per hour,
enforced in the database. IPs are never stored, only a salted SHA-256 hash, and those rows are deleted after a day.
Bots get a fake "ok" so they learn nothing. If spam still gets through, add Cloudflare Turnstile.

## Deploying (needs Nathan's go-ahead before it goes on doorsteptickets.com)

1. Run the migration on Supabase staging (SQL Editor, paste the migration file, Run).
2. Vercel: new project from `EEGVentures/doorstep`, team EEG VENTURES, **Root Directory `holding`**, Framework "Other", no build command.
3. Environment variables (Production + Preview): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (the `sb_secret_...` key), and
   optionally `HOLDING_IP_SALT` (any long random string). Never prefix these with `VITE_`.
4. Check the preview URL, then add `doorsteptickets.com` (+ `www`) to this project. At launch, move the domain to the app project.

## Before it goes live
- Photos are the placeholder set from the app demo (AI reference images). Swap for licensed photos.
- Privacy notice: add the company's registered name and address once Doorstep Tickets Ltd details are final, and make sure the `privacy@` group exists.

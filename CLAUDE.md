# Working rules for this repo (Claude and humans)

- Never deploy to production, switch on live Stripe billing (`ALLOW_LIVE_PAYMENTS`), or send close-off reports to a real venue (`CLOSEOFF_LIVE_SENDING` / `venue_closeoff_settings.sending_enabled`) without Nathan's explicit go-ahead in writing.
- Partner (affiliate) show links must never show the membership paywall or a membership upsell before purchase. Track visits, sign-ups and sales for every link.
- Money is integer pence. The server prices everything; the browser never sends a price.
- Business rules live in the database functions and RLS. Add a test in `tests/db/` for every rule you change, and run `npm test && npm run test:db && npm run build` before pushing.
- Barcodes never appear in emails, logs or error messages.
- Brand: `public/brand/` assets only (C lockup, v4 emblem). Primary button is the gradient-frame pill (Nathan, 4 Nov 2026). Tagline: "Good nights out, on your Doorstep."
- Secrets never get a `VITE_` prefix and never go in Git.
- Approved decisions and dated plan: `docs/08-iOS-App-Wallet-and-Schedule.md`. Open questions: `docs/DECISIONS.md`.

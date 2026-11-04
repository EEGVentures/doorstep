# Open decisions (as of 4 Nov 2026)

The code runs with the defaults shown, so none of these blocks Friday.

| # | Decision | Default in the code | Where to change it |
| --- | --- | --- | --- |
| 1 | Monthly membership price (web and iOS) | Any test value when running `stripe:setup` | Stripe Price (lookup key), App Store Connect |
| 2 | Free first month for new members? | Off (`MEMBERSHIP_TRIAL_DAYS=0`) | Vercel env var |
| 3 | Booking fee refunded when an event is cancelled? | Yes, full refund including fee | `api/ops.ts` `refundOrder()` |
| 4 | Renewal reminder timing (UK DMCC subscription rules from 2027) | Stripe `invoice.upcoming`, days set in Stripe | Stripe dashboard, Billing settings |
| 5 | Company footer details for emails | Placeholders | `COMPANY_*` env vars |
| 6 | Affiliate commission | Not calculated; statements carry the figures | `server/partners.ts` |
| 7 | Barcode format | 12 characters, A–Z and 2–9 without lookalikes, QR | `generate_barcode()` |
| 8 | Email confirmation at sign-up | Supabase default (confirm email on). Partner visitors must click a link before booking, which is a hurdle. Recommend turning confirmation off and relying on the order email. | Supabase Auth settings |
| 9 | Tramshed real box-office contact | Test recipient nathan@ernestpromotions.com | `venue_closeoff_settings` |
| 10 | Google sign-in (Base44 had it) | Email and password only | Supabase Auth providers |

## Deliberately not carried over from Base44

- **Referral wallet credit:** holding customer credit raises FCA e-money questions (Ken, 3 Nov). Left out until decided.
- **"Give Back" charity record per order:** the charity mechanism is not approved, so no contribution claims are made.
- **Mailchimp for every buyer:** replaced with consent-based marketing. Transactional email is Resend only.

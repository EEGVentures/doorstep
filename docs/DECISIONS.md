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
| 8 | Email confirmation at sign-up | **Decided 4 Nov: off**, for partner and own traffic alike. Marketing emails should still go only to addresses that have opened or clicked a Doorstep email, since sign-up addresses are not verified. | `supabase/config.toml` |
| 9 | Tramshed real box-office contact | Test recipient nathan@ernestpromotions.com | `venue_closeoff_settings` |
| 10 | Google sign-in (Base44 had it) | Email and password only | Supabase Auth providers |

## Email placeholders to fill before launch (agreed 5 Nov 2026)

The twelve service emails are being rebuilt in the new app style with clearly marked placeholders, so the design work doesn't wait on these answers. Each placeholder is a `{{TBC:...}}` token that shows highlighted in previews. A launch check will fail the production build while any token remains.

| Placeholder | Appears in | Needed from |
| --- | --- | --- |
| ~~`{{TBC:membership_price}}`~~ | Resolved 5 Nov 2026: **£4.99 a month**, sold through Stripe (web and in the iOS app). It is the only route to buying the £5 member tickets. | Nathan (confirmed) |
| `{{TBC:fee_refund_policy}}` | Event cancelled, refund confirmation | Nathan (solicitor review) |
| `{{TBC:renewal_reminder_days}}` | Renewal reminder, Stripe Billing setting | Nathan |
| `{{TBC:company_footer}}` | Every email footer (registered name, number, address) | Nathan, once Doorstep Tickets Ltd details are final |

## Deliberately not carried over from Base44

- **Referral wallet credit:** holding customer credit raises FCA e-money questions (Ken, 3 Nov). Left out until decided.
- **"Give Back" charity record per order:** the charity mechanism is not approved, so no contribution claims are made.
- **Mailchimp for every buyer:** replaced with consent-based marketing. Transactional email is Resend only.

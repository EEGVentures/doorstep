# Open decisions (as of 24 Nov 2026)

The code runs with the defaults shown, so none of these blocks Friday.

| # | Decision | Default in the code | Where to change it |
| --- | --- | --- | --- |
| 1 | ~~Monthly membership price~~ | **Withdrawn 24 Nov 2026: no membership or subscription.** | |
| 2 | Prices shown to guests (signed out)? | Signed-in only | `prices_public()` + column grant, see `docs/BUYING-AND-PARTNERS.md` |
| 3 | Booking fee refunded when an event is cancelled? | Yes, full refund including fee | `api/ops.ts` `refundOrder()` |
| 4 | ~~Renewal reminder timing~~ | Withdrawn 24 Nov 2026 (no subscriptions). | |
| 5 | Company footer details for emails | Placeholders | `COMPANY_*` env vars |
| 6 | Affiliate commission | Not calculated; statements carry the figures | `server/partners.ts` |
| 7 | Barcode format | 12 characters, A–Z and 2–9 without lookalikes, QR | `generate_barcode()` |
| 8 | Email confirmation at sign-up | **Decided 4 Nov: off**, for partner and own traffic alike. Marketing emails should still go only to addresses that have opened or clicked a Doorstep email, since sign-up addresses are not verified. | `supabase/config.toml` |
| 9 | Tramshed real box-office contact | Test recipient nathan@ernestpromotions.com | `venue_closeoff_settings` |
| 10 | Google sign-in (Base44 had it) | Email and password only | Supabase Auth providers |

## Email placeholders to fill before launch (agreed 5 Nov 2026)

The service emails (ten now that the membership-active and renewal-reminder emails are gone) are being rebuilt in the new app style with clearly marked placeholders, so the design work doesn't wait on these answers. Each placeholder is a `{{TBC:...}}` token that shows highlighted in previews. A launch check will fail the production build while any token remains.

| Placeholder | Appears in | Needed from |
| --- | --- | --- |
| ~~`{{TBC:membership_price}}`~~ | Withdrawn 24 Nov 2026: no membership. | |
| `{{TBC:fee_refund_policy}}` | Event cancelled, refund confirmation | Nathan (solicitor review) |
| ~~`{{TBC:renewal_reminder_days}}`~~ | Withdrawn 24 Nov 2026 with the renewal reminder email. | |
| `{{TBC:company_footer}}` | Every email footer (registered name, number, address) | Nathan, once Doorstep Tickets Ltd details are final |

## Service emails (updated 25 Nov 2026)

- **Door passes on purchase (Nathan, 25 Nov 2026).** The buyer gets their code as soon as they pay, not 48 hours before doors. The order email carries the door passes; the old tickets-ready email is now `event-reminder`, sent 24 hours before doors (skipped if the show is less than about a day away). Knock-on: codes can be screenshotted or passed on for longer before the show. Each code still scans once, and a refunded ticket's code disappears from the wallet and is revoked for the venue.
- Built: welcome, order confirmed (with door passes), event reminder, event cancelled. Stickers removed (no-orange rule), the tagline underline covers "on your Doorstep.", buttons stack on phones.
- The welcome email is queued by `handle_new_user()` when an account is created. When existing customers are copied over in bulk (for example from Base44), set `skip_welcome: true` in their user metadata so they are not welcomed again.
- Still to write before launch: password reset (until then Supabase sends its own plain email), event changed, refund issued.
- Still due: the Liquid Glass and motion redesign to match the finished app.

## Deliberately not carried over from Base44

- **Referral wallet credit:** holding customer credit raises FCA e-money questions (Ken, 3 Nov). Left out until decided.
- **"Give Back" charity record per order:** the charity mechanism is not approved, so no contribution claims are made.
- **Mailchimp for every buyer:** replaced with consent-based marketing. Transactional email is Resend only.

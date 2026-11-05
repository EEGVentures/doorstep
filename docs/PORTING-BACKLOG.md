# Base44 screens and functions still to port

The Base44 export (Oct 2026) is the reference. Everything below is listed in rough order of need for the soft launch.

| Base44 | Status in this repo | Notes |
| --- | --- | --- |
| Discover, EventDetail, Wallet, Account, Login/Register | Rebuilt | New brand, real data via Supabase |
| create-checkout, stripe-webhook, refund-order | Rebuilt | Audit bugs fixed: race, 10-min expiry, idempotency, barcode reuse |
| auto-close-off, generate-export-csv | Rebuilt | Standard CSV, versioned schedule, sold-out events included, direct to recipient |
| send-reveal-notifications | Rebuilt | `tickets-ready` email scheduled at doors minus 48h |
| BuildShow (create event) | **To port** | Admin form writing `events` + `ticket_types`; see docs/ADMIN-PORTAL.md |
| BulkUpload | **To port** | CSV/AI-assisted event import |
| Admin, LiveDashboard, Insights | **To port** | Sales, occupancy and channel charts; read from views |
| PromoCodeManager, validate-promo-code | **To port** | Needs a pricing decision alongside membership prices |
| Waitlist | Table exists | UI and notify-on-refund to add |
| Support chat agent | **To port** | Claude API, plus support@ triage (email setup PDF) |
| send-abandoned-checkout-emails | **To port** | Template not written yet |
| Meta Conversions API, analytics | **To port** | Only with cookie consent |
| ProducerOneSheet, AdminGuide, mockups | Not needed for launch | |
| Six more launch emails | **To write** | Confirm email, sign-in/reset, payment failed, membership cancelled, event changed, refund issued |
| Apple Wallet pass | **To build (Dec)** | Needs Pass Type ID certificate; see docs/08 section 4 |
| Expo iOS app | **To build (Dec)** | Same API and entitlement |

## SEO build (16 to 27 Nov 2026, about 3 to 4 days)

From the SEO plan (https://claude.ai/artifact/7vvM732C28YKKniu1Wdrno). The app is a Vite single-page app, so search engines and link previews need help:

- Server-filled page heads: a Vercel function (or edge middleware) answers `/events/:slug`, city and venue URLs with the real `<title>`, description, canonical and Open Graph/Twitter preview card tags, then serves the app.
- schema.org `Event` JSON-LD on event pages (name, startDate, location, image, offers with availability and url but **no price**).
- Decision (Nathan, 5 Nov 2026): public pages Google can see never show the member price figure; they say "Members' price" instead. That covers page heads, preview cards, JSON-LD and the logged-out view of Discover and event pages (Google renders the app, so guest tiles and the buy bar must not show "From £x"). Members signed in still see prices.
- `sitemap.xml` built from on-sale events, cities and venues; `robots.txt` pointing to it.
- City pages (`/cardiff`) and venue pages (`/venues/tramshed`), server-filled the same way.
- Partner `/go/*` links stay `noindex` (meta robots and `X-Robots-Tag`), as do `/ops`, `/account`, `/wallet`, `/signin`.

## iOS membership route (from the Apple fees thread, 5 Nov 2026; recommended, awaiting Nathan's confirmation)

- Plan A: sell membership inside the iOS app through Stripe, like tickets, under App Review guideline 3.1.3(e) (services used outside the app). Correction (Nathan, 5 Nov): membership IS access to book event tickets, not better rates or content. Browsing stays free for guests; membership gates only the booking step. Paywall copy: "Become a member to book tickets to live events near you", never "unlock the app". Nothing digital behind membership in the app: no members-only content, articles, video or app features.
- Apple in-app purchase is a fallback only, behind a flag (expo-iap or RevenueCat), in case App Review rejects Plan A. Nathan to enrol in the Small Business Program (15%) just in case.
- Paywall copy in the app talks about nights out, never app features.
- UK storefront: the app must not link out to the website to buy membership (US-only allowance).
- Partner links already bypass membership; no change.
- App Review notes (submission 23 Jan 2027) explain membership as a members' club for live events.

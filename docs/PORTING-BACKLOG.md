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
| PromoCodeManager, validate-promo-code | **To port** | Needs a pricing decision |
| Waitlist | Table exists | UI and notify-on-refund to add |
| Support chat agent | **To port** | Claude API, plus support@ triage (email setup PDF) |
| send-abandoned-checkout-emails | **To port** | Template not written yet |
| Meta Conversions API, analytics | **To port** | Only with cookie consent |
| ProducerOneSheet, AdminGuide, mockups | Not needed for launch | |
| Six more launch emails | **To write** | Confirm email, sign-in/reset, event changed, refund issued (membership cancelled and payment failed dropped 24 Nov 2026) |
| Apple Wallet pass | **To build (Dec)** | Needs Pass Type ID certificate; see docs/08 section 4 |
| Expo iOS app | **To build (Dec)** | Same API and entitlement |

## SEO build (16 to 27 Nov 2026, about 3 to 4 days)

From the SEO plan (https://claude.ai/artifact/7vvM732C28YKKniu1Wdrno). The app is a Vite single-page app, so search engines and link previews need help:

- Server-filled page heads: a Vercel function (or edge middleware) answers `/events/:slug`, city and venue URLs with the real `<title>`, description, canonical and Open Graph/Twitter preview card tags, then serves the app.
- schema.org `Event` JSON-LD on event pages (name, startDate, location, image, offers with availability and url but **no price**).
- Superseded 24 Nov 2026 (no membership; guest price display is open decision 2 in DECISIONS.md). Was: (Nathan, 5 Nov 2026): public pages Google can see never show the member price figure; they say "Members' price" instead. That covers page heads, preview cards, JSON-LD and the logged-out view of Discover and event pages (Google renders the app, so guest tiles and the buy bar must not show "From £x"). Members signed in still see prices.
- `sitemap.xml` built from on-sale events, cities and venues; `robots.txt` pointing to it.
- City pages (`/cardiff`) and venue pages (`/venues/tramshed`), server-filled the same way.
- Partner `/go/*` links stay `noindex` (meta robots and `X-Robots-Tag`), as do `/ops`, `/account`, `/wallet`, `/signin`.

## iOS membership route

Withdrawn 24 Nov 2026: no membership, so no in-app purchase or Stripe-in-app membership. Tickets in the iOS app are paid through Stripe (guideline 3.1.3(e), services used outside the app).

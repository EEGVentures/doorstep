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

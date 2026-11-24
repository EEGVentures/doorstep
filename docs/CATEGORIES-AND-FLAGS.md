# Categories and flag banners

Added 24 Nov 2026 (Nathan): browse by category, and Doorstep flag banners on tiles and event pages.
We take the features seat-filler sites have, not their look.

## Categories

Fixed list, checked by the database (`events_category_known`):
Theatre, Music, Comedy, Ballet & Opera, Classical, Jazz & Blues, Club nights, Quiz & games, Family, Talks.
The What's on page shows a pill for each category that has something on in the chosen city and window, with a count.
To add a category, change the check in a new migration and `CATEGORIES` in `src/pages/Discover.tsx`.

## Flags

Worked out by `event_flag()` in the database and served on `event_listings.flag`. First match wins:

| Flag | Rule |
| --- | --- |
| none | sold out, or staff set `flag_override = 'none'` |
| staff choice | `flag_override` is `new`, `selling_fast` or `last_few` |
| Last few | 10 or fewer tickets left, or under 10% left |
| Selling fast | 60% or more sold |
| New | listed in the last 7 days (`events.listed_at`) |

Shown as a swallowtail pennant with the coral-to-amber gradient as a thin pole only (no orange or coral fills).
"Last few" carries a small pulsing dot (still under reduced motion it does not move).

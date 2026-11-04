# Design direction: Liquid Glass, bento, soft 3D (Nathan, 4 Nov 2026)

Applies across the app and all comms. Brand palette and fonts are unchanged; this is how surfaces, layout and depth behave.

| Element | Rule | In the code |
| --- | --- | --- |
| Liquid Glass | Translucent white (dark variant over dark photos), strong blur, bright top rim. Used for captions over imagery, the floating header, chips and filters. Text on glass is ink, or white on the dark variant, never muted grey. Solid fallback when blur is unsupported. | `.glass`, `.glass-dark` in `src/styles.css` |
| Bento | Square tiles on a 4-column grid (2 on phones, slightly taller 4:5 tiles). One large 2×2 lead tile, mixed with message tiles (membership, how it works). | `.bento`, `.tile`, `.tile-big`, `.tile-wide`; `src/pages/Discover.tsx` |
| Soft 3D | On filled sections only: tiles, panels, pills and buttons get a lit top edge, a softly shaded bottom edge and a layered drop shadow, so they look moulded. **Never on icons or the emblem**, which stay flat (Nathan, 4 Nov 2026). Tiles lift slightly on hover. No hard bevels. | `.card`, `.tile-wash`, `.surface-ink`, `.surface-3d`, `.btn-primary` shadow |
| Ambience | Very faint warm light behind the top of each page so glass has something to refract. Kept faint so it never reads as a pink wash. | `.ambient` |
| Motion | Lifts and image zooms only; all switched off under reduced motion. Loader stays the approved waving emblem. | |

Comms (email, social): same three ideas. Bento squares suit social grids and carousels; glass captions over event photography; soft 3D on filled panels, with flat icons. Email clients do not support blur, so emails use the solid fallback look.

## Critique pass (Impeccable + Emil Kowalski), applied 4 Nov 2026

Nathan approved the critique fixes on 4 Nov 2026. Before and after screenshots are in the project's `briefing/` folder.

- **Motion tokens** in `src/styles.css`: `--ease-out` (0.23, 1, 0.32, 1), `--ease-in-out` (0.77, 0, 0.175, 1), `--ease-drawer` (0.32, 0.72, 0, 1). UI motion stays at or under 350ms. Buttons fill in 250ms, the arrow nudges in 200ms, and press feedback is `scale(0.97)` over 120ms.
- **Hover only on mouse devices**: tile lift and photo zoom (1.03) sit inside `@media (hover: hover) and (pointer: fine)`.
- **Glass only on floating layers**: the header (clear at the top, glass once scrolled), the city filter, the date pill, the phone buy bar and sheets. Captions on photos use a dark fade with white text, not a glass slab. Dark glass goes over photos and light glass over the page.
- **Bento rhythm**: one lead tile, then rows built from one wide tile and two small ones, with at most three wide tiles (`bentoSizes()` in Discover). Desktop rows are sized from the container width, so wide and small tiles line up. Large tiles have a 28px radius and small ones 20px. There's no filler tile. Events without a photo get a typographic tile on a neutral white surface (Nathan, 4 Nov: no orange fill blocks). Sold out tiles are desaturated and carry a white pill.
- **Type**: no uppercase eyebrows. The headline uses the coral-to-amber stroke from the emails (`.brand-underline`). Prices and times use tabular numbers.
- **Discover motion**: an ink pill slides between cities in 200ms. Tiles enter from `scale(0.98)` with a 40ms stagger on first load only, and the grid fades out in 150ms on a filter change. Skeletons load first, and the waving emblem appears only after one second.
- **Tile to event**: the photo grows into the hero through the View Transitions API (`Link viewTransition` plus a shared `view-transition-name`, 350ms on the drawer curve). The hero caption fades in on top of it.
- **Phones**: the event page has a sticky glass buy bar that opens a bottom sheet (`BottomSheet.tsx`). The sheet closes on Escape, a backdrop tap, a drag past a quarter of its height, or a flick faster than 0.11px/ms.
- **Reduced motion** keeps the fades and removes movement, scale and the shared-element morph.

## Motion polish, second pass (Emil Kowalski), 4 Nov 2026

- **City filter**: a white-on-ink copy of the chips sits on top, clipped to the selected city with `clip-path: inset(... round 999px)`. The clip moves over 260ms ease-in-out, so the text turns white exactly where the pill is.
- **Scroll reveal**: tiles rise 14px from `scale(0.98)` and the photo un-clips from the top as each tile enters the viewport, once (`useReveal`, IntersectionObserver). This uses transitions, not keyframes, so a fast scroll retargets smoothly. Tiles already on screen keep the 40ms stagger, and hover and press take over once the entrance has played.
- **Lead tile drift** (mouse only, not under reduced motion): the photo drifts up to 7px against the pointer and zooms to 1.05. It's smoothed by a critically damped spring written straight to the image transform, with no React renders.
- **Bottom sheet**: drag writes the transform and backdrop opacity straight to the DOM. Pulling upwards meets growing friction (a log curve, never a hard stop). The sheet takes one pointer at a time and uses pointer capture. It dismisses past a quarter of its height, or on a flick faster than 0.11px/ms measured over the last 100ms, so a slow drag that stops springs back. Text selection is blocked while dragging. It opens in 460ms on the drawer curve and closes faster, in 240ms ease-out.
- **Buy bar**: rises in with `@starting-style` and tucks away while the sheet is open.
- **Micro details**: the quantity digit rolls in the direction of the change. The primary button label swaps through a 3px blur. The header's active pill is one element with a shared `view-transition-name`, so it slides between links on navigation, and the header itself stays still while the page crossfades.

## Brand push: "iconically Doorstep", 4 Nov 2026

Nathan asked for the app to feel like Doorstep and not a listings page. Three ideas:

1. **Close to home.** A first visit asks "Where's your doorstep?" and takes a postcode. Only the outcode is used, through postcodes.io, and it's stored on the device (`src/lib/area.ts`). After that:
   - every tile shows a door-to-door hint ("9 min walk", "16 min drive");
   - the grid is headed "Tonight / This weekend / This week on your doorstep";
   - nights over 30 km away move to a "Worth the trip" row.

   Venue coordinates come from `venues.lat/lng` through `event_listings` (migration 20261106090300).
2. **The door.** The emblem's gable is the shape system:
   - The lead tile is house-shaped, with the date as the house sign. The lead is always the soonest night with a photo, and a photo-less lead goes ink.
   - Tapping a tile opens the event like double doors (`html[data-vt=door]`), while the photo grows into the hero. The event page is seeded from the tapped listing, so the transition never lands on a skeleton.
   - Tickets are **door passes**: an ink door with the gable, a live countdown to doors, the code in a white letterbox panel from 48h, and the coral-to-amber "doorstep line" underneath. The gradient is used only as a line.
3. **Voice.** Labels speak like a local friend:
   - "Fancy it?" on the booking panel;
   - "This one's for members" when booking needs a membership;
   - "Wrong door" on the 404 page;
   - "Your door passes" and "No nights booked yet" in the wallet.

The preview build (`scripts/build-demo.sh`) shows all of it with sample data.

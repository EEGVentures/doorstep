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

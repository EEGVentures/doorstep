# Design direction: Liquid Glass, bento, soft 3D (Nathan, 4 Nov 2026)

Applies across the app and all comms. Brand palette and fonts are unchanged; this is how surfaces, layout and depth behave.

| Element | Rule | In the code |
| --- | --- | --- |
| Liquid Glass | Translucent white (dark variant over dark photos), strong blur, bright top rim. Used for captions over imagery, the floating header, chips and filters. Text on glass is ink, or white on the dark variant, never muted grey. Solid fallback when blur is unsupported. | `.glass`, `.glass-dark` in `src/styles.css` |
| Bento | Square tiles on a 4-column grid (2 on phones, slightly taller 4:5 tiles). One large 2×2 lead tile, mixed with message tiles (membership, how it works). | `.bento`, `.tile`, `.tile-big`, `.tile-wide`; `src/pages/Discover.tsx` |
| Soft 3D | 28px corners, a white top highlight and layered soft shadows; tiles lift slightly on hover; the emblem gets a warm drop shadow so it sits off the surface. No hard bevels. | `.card`, `.emblem-3d`, `.btn-primary` shadow |
| Ambience | Very faint warm light behind the top of each page so glass has something to refract. Kept faint so it never reads as a pink wash. | `.ambient` |
| Motion | Lifts and image zooms only; all switched off under reduced motion. Loader stays the approved waving emblem. | |

Comms (email, social): same three ideas. Bento squares suit social grids and carousels; glass captions over event photography; the emblem in soft 3D. Email clients do not support blur, so emails use the solid fallback look.

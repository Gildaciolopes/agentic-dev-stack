# agentic-dev-stack site: design system

Source of truth for values: `src/app/globals.css`. This file explains the why and the rules. Visual identity is taken from the "Sbont" concept site (reference only, never named in shipped UI). Motion and behaviour come from Fluid (`@usefluid/motion`). Where they clash: reference look, Fluid behaviour.

## 1. Principles

1. **Every effect explains the product.** The isometric cube on a ring is the stack; slabs are layers; toggles are the free/native switch; packets travelling an edge are requests. No decoration that maps to nothing.
2. **Black stage, colour only where it means something.** Saturated gradient appears only in isometric illustrations and the primary button. Everything else is black, grey and white.
3. **Monospace everywhere.** One family (JetBrains Mono). It reads as terminal, which is what the product is.
4. **Square.** Buttons, cards, nav, code windows: 0 radius. Round shapes are reserved for things that are round by nature (toggles, avatars, packets).
5. **Roomy and quiet.** Muted body, wide line-height, slight tracking, big headlines ending with a period.
6. **Accessible first.** AA on every text pair, 44px targets, visible focus, reduced-motion path for every animation.

## 2. Tokens

Dark is the native look. Light is derived (section 12). All names are shadcn variables unless noted.

| Token | Dark | Light |
|---|---|---|
| `--background` | `#000000` | `#ffffff` |
| `--foreground` | `#ffffff` | `#000000` |
| `--band` (banded section) | `#090909` | `#f3f6f7` |
| `--card` / `--popover` | `#0d0d0d` | `#f7f9fa` / `#ffffff` |
| `--card-foreground` | `#ffffff` | `#000000` |
| `--primary` / `-foreground` | `#ffffff` / `#000000` | `#000000` / `#ffffff` |
| `--secondary`, `--muted` | `#141414` | `#eef2f4` |
| `--muted-foreground` | `#8a8a8a` | `#4f5459` |
| `--subtle-foreground` | `#808080` | `#656b71` |
| `--code-muted` | `#8a8a8a` | `#8a8a8a` |
| `--accent` | `#101a1c` | `#e3f8fd` |
| `--destructive` | `#ff5a5f` | `#c8102e` |
| `--success` | `#3ddc84` | `#0b7a52` |
| `--border`, `--input` | `#1f1f1f` | `#dde3e6` |
| `--ring` | `#6ee6ff` | `#0a7ea4` |
| `--link` | `#6ee6ff` | `#0a6f91` |
| `--code-bg` / `--code-fg` | `#0d0d0d` / `#e8e8e8` | `#0b0b0b` / `#e8e8e8` |
| `--kind-optional` | `#8a8a8a` | `#6b7177` |
| `--kind-neutral` | `#8a8a8a` (= `--muted-foreground`) | `#4f5459` (= `--muted-foreground`) |
| `--kind-hermes` | `#da77f2` | `#9c36b5` |
| `--kind-economy` | `#4dabf7` | `#1971c2` |

Contrast of the new kind tokens (WCAG relative luminance, computed; card is `#0d0d0d` dark / `#f7f9fa` light):

| Token | Dark on background | Dark on card | Light on background | Light on card |
|---|---|---|---|---|
| `--kind-neutral` | 6.08:1 | 5.63:1 | 7.65:1 | 7.24:1 |
| `--kind-hermes` | 7.90:1 | 7.31:1 | 5.82:1 | 5.51:1 |
| `--kind-economy` | 8.48:1 | 7.85:1 | 5.02:1 | 4.75:1 |

All three clear 4.5:1 in both themes. The kind tokens are used only for non-text graphics (node and edge strokes, arrowheads, packets, legend dots), where 3:1 (WCAG 1.4.11) applies; node labels and edge labels use `--foreground` / `--muted-foreground`. `--kind-neutral` is `--muted-foreground`, which is also a text token and passes 4.5:1 as text. No value needed adjusting.

Theme-independent spectrum (`--spectrum-*`): sky `#03c3fb`, cyan `#05d7fd`, ice `#6ee6ff`, blue `#3d74ef`, cobalt `#065bbc`, indigo `#3a2a8f`, coral `#f64a35`, pink `#ec3079`, red `#fe0506`, mint `#2ad8c4`, teal `#257772`, mintlight `#befcfc`, peach `#facd86`.

Gradients: `--grad-primary` 90deg `#0fbae3` to `#2ad8c4`; `--grad-frame` `#309fe5` to `#01e2ff`; `--grad-cool` ice to blue to indigo; `--grad-warm` coral to pink; `--grad-mint` mintlight to mint to teal; `--grad-peach` mintlight to peach.

Legend kinds: native `#3ddc84`, google mint, free `#ff8a3d`, optional grey, lead cyan.

### How Fluid and 3D read the tokens

| Consumer | Mapping |
|---|---|
| `--fluid-accent` / `--fluid-on-accent` | `--foreground` / `--background` (inverted solid, black-on-white or white-on-black) |
| `--fluid-surface`, `--fluid-surface-2` | `--card`, `--secondary` |
| `--fluid-text`, `--fluid-text-2` | `--foreground`, `--muted-foreground` |
| `--fluid-border`, `--fluid-focus` | `--border`, `--ring` |
| `--fluid-radius`, `--fluid-pill` | `--radius` (0), `--radius-pill` (0). Fluid pills become square. Toggles override with `--radius-round`. |
| `--fluid-font` | `--font-mono` |
| 3D side faces | `--spectrum-blue/cobalt/indigo` (cool), coral/pink (warm), mint/teal (mint) |
| 3D top faces | `#ffffff` always, in both themes |
| 3D glow under object | `--glow-under` (mint at 45% dark, 35% light) |

## 3. Contrast (WCAG 2.x, computed)

Text needs 4.5:1, large text and UI components 3:1. All text pairs below pass.

| Pair | Ratio |
|---|---|
| dark foreground / background | 21.00 |
| dark foreground / card | 19.44 |
| dark muted `#8a8a8a` / background | 6.08 |
| dark muted / band | 5.77 |
| dark muted / card | 5.63 |
| dark muted / secondary | 5.34 |
| dark subtle `#808080` / background | 5.32 |
| dark subtle / band | 5.04 |
| dark subtle / card | 4.92 |
| dark subtle / secondary | 4.66 |
| dark code-muted `#8a8a8a` / code-bg | 5.63 to 5.70 |
| dark link `#6ee6ff` / background | 14.43 |
| dark link / card | 13.35 |
| dark destructive / background | 6.88 |
| dark success / background | 11.77 |
| dark code-fg / code-bg | 15.86 |
| black label / primary gradient start `#0fbae3` | 9.15 |
| black label / primary gradient end `#2ad8c4` | 11.72 |
| white label / primary gradient (rejected) | 2.29 / 1.79 |
| black / cyan brand panel `#05d7fd` | 12.14 |
| light foreground / background | 21.00 |
| light muted `#4f5459` / background | 7.65 |
| light muted / band | 7.04 |
| light muted / card | 7.24 |
| light subtle `#656b71` / background | 5.39 |
| light subtle / band | 4.96 |
| light subtle / card | 5.11 |
| light subtle / secondary | 4.79 |
| light link `#0a6f91` / background | 5.68 |
| light link / card | 5.38 |
| light destructive / background | 5.88 |
| light success / background | 5.36 |
| black / white (gradient frame card inner) | 21.00 |
| non-text: light ring `#0a7ea4` / background | 4.63 |
| non-text: dark ring / background | 14.43 |

Fixes recorded: `--subtle-foreground` was `#7a7a7a` / `#6b7177` and failed on `--secondary` (4.29 / 4.38), now `#808080` / `#656b71`; measured reference body grey `#707070` raised to `#8a8a8a`; primary label is black, not white; `--kind-optional` was `#8a8a8a` in both themes (3.45 on white, fails as text) and is now `#6b7177` in light. `--border` is decorative (1.27 to 1.30) and never the only cue for an interactive control: interactive borders use `--foreground` (secondary button) or the focus ring.

## 4. Type scale

Family: JetBrains Mono 400/700 via `next/font` (`--font-jetbrains` to `--font-mono`). Tailwind utilities `text-display`, `text-h2`, `text-h3`, `text-body`, `text-small`, `text-label`.

| Role | Size | Line-height | Tracking | Weight |
|---|---|---|---|---|
| `display` (h1) | clamp 36px to 64px | 1.12 | -0.02em | 700 |
| `h2` | clamp 28px to 56px | 1.15 | -0.015em | 700 |
| `h3` | clamp 18px to 22px | 1.3 | 0 | 700 |
| body | 16px | 1.75 | +0.01em | 400 |
| small | 14px | 1.6 | +0.01em | 400 |
| label | 12px | 1.4 | +0.08em, uppercase | 400 |

Headlines end with a period and may use two lines (`\n`). Body copy max width about 60ch. Headings use `text-wrap: balance`, paragraphs `pretty`.

## 5. Spacing and grid

- Container 1200px (`--container`), horizontal gutter `clamp(16px, 4vw, 48px)`.
- Section rhythm `--section-y: clamp(80px, 12vw, 160px)` top and bottom. Alternate `bg-background` and `bg-band` for banding.
- Desktop (>= 1024px): 12-column grid, 24px gap. Tablet (768 to 1023): 6 columns. Below 768: single column, no horizontal scroll, 16px gutter.
- Base unit 4px; component padding 16/24/32; stack gaps 8/16/24/48.
- Nav height `--nav-h: 64px`; `scroll-padding-top` accounts for it.

## 6. Radii

`--radius`, `--radius-pill`: **0**. Round (`--radius-round`, 999px) only for toggles, avatars and packets.

**Decision record: square vs pills.** Fluid components ship as pills; the reference is square and sharp. We keep the reference look: all Fluid pill components get `--fluid-pill: 0px` and `--fluid-radius: 0px` (CopyMorph reads `var(--fluid-pill)`). Toggles stay round because a squared switch thumb loses the metaphor of a sliding bead. Consequence: the floating nav is floating (Fluid behaviour) but square (reference look).

## 7. Elevation

- `--elev-1`: hairline plus soft drop, for cards that must lift off a band.
- `--elev-2`: large soft drop plus 1px inner top highlight, for floating nav and dialogs.
- Dark mode favours borders and inner highlights over shadows (black on black hides shadows).
- Glow under 3D objects: radial teal ellipse `--glow-under`, blurred 40 to 80px, sitting on the ring platform, never on UI chrome.

## 8. Components

**Button** (`ui/button.tsx`). Variants: `primary` (gradient, black bold label), `secondary` (2px foreground outline, fills on hover), `ghost`. Sizes sm/md/lg (padding 16x8, 24x12, 32x16). Min height 44px. Square. Press: scale 0.98. `href` renders an i18n `Link` for `/` paths, `<a>` otherwise. Focus: global 2px `--ring` outline, 3px offset.

**Card** (`ui/card.tsx`). `bg-card`, 1px `--border`, 24px padding, square. Title h3, body small muted.

**Gradient-frame card** (`ui/grad-frame-card.tsx`). 12px gradient frame (warm red to pink, cool blue to pink, mint to peach) around a white inner card with black text in both themes.

**Nav.** Floating, square, 64px, inset 16px from top, `--elev-2`, translucent card with backdrop blur. Logo left, links centre, theme toggle (round) and language switch right. Collapses to a sheet below 768px.

**Code block / terminal** (`ui/code-window.tsx`, `ui/install-command.tsx`). `bg-code`, 1px border, title bar with filename and three square dots (coral, peach, mint), mono body 14px, horizontal scroll with `tabIndex=0`. Copy via Copy Morph (announces the result politely).

**Marquee** (`ui/marquee.tsx`). Two rows, opposite directions, dark cards (`--card`). Track holds items twice, slides -50%, linear, 30 to 60s per loop. Pauses on hover and focus-within. Edge mask fades 8%. Reduced motion: duplicate hidden, items wrap as a static grid.

**Section header** (`ui/section-header.tsx`). Numbered label ("01 Architecture", label style), giant two-line headline via Text Reveal (plays once in view), short muted paragraph. Reveal reserves its layout box so there is no CLS; full text is in the server HTML and an sr-only span.


**Legend chip** (`ui/legend-chip.tsx`). Toggle button, 44px, square, 12px swatch of `--kind-*`, `aria-pressed`. Pressed = inverted fill.

**Iso icon** (`ui/iso-icon.tsx`). Static SVG: cube, slabs, toggle, striped, arch. For feature trios.

## 9. Illustration rules

- **Camera**: orthographic only. Isometric angles: rotateX 35.264° (arctan 1/√2), rotateY 45°. No perspective distortion.
- **Materials** (gradient stops, light to dark):
  - cool: `#6ee6ff`, `#3d74ef`, `#3a2a8f`; cube sides `#065bbc`
  - warm: `#f64a35`, `#ec3079`
  - mint: `#befcfc`, `#2ad8c4`, `#257772`
  - peach: `#befcfc`, `#facd86`
- **Tops are always white** (`#ffffff`), both themes.
- **Fragments**: crescent, arch, quarter-ring pieces and striped cards float near the hero object; small grey dashes (1 to 3px) drift as depth cues.
- **Glow**: soft teal ellipse under the object on the ring platform.
- **Palette per kind**: native = green accent over cool body; google = mint; free = orange accent; optional = grey, flat; lead = cyan. Illustrations carry the same `--kind-*` swatches as the legend.
- Backgrounds stay pure black or `--band`; no gradients behind illustrations except the glow.

## 10. Motion

- Springs (from `@usefluid/motion` `springs`, w = rad/s, z = damping ratio): **snappy** w22 z0.8 for UI, **soft** w13 z0.86 for layout, **bouncy** w17 z0.58 for the mascot only. `--spring-*` in `globals.css` mirror these. `firm` (w32 z1) exists but is unused.
- Hover/press: 150ms ease-out on colour/transform; press scale 0.98.
- Reveals play once, when in view (`useInView`). Nothing animates before it enters the viewport.
- Canvases and tickers pause off-screen and when the tab is hidden; no loops run off-screen. CSS marquee pauses on hover/focus.
- **Reduced motion**: global rule collapses CSS animations and transitions to 0.01ms; Text Reveal shows letters immediately; marquee becomes a static grid; spring-driven pieces use `useSkip`/immediate; 3D hero renders one static frame; theme switch skips the circular View Transition.
- Theme switch: circular View Transition reveal from the toggle.

## 11. Page frame and bands

Page is pure black. Alternate sections with `--band` (`#090909`). One light moment per page: the cyan brand panel (`#05d7fd` to `#03c3fb`, black text, 12.14:1). Gradient frame cards use red, blue to pink, mint to peach.

## 12. Light theme derivation

Light inverts the roles, not the hues.
1. `--background` white, `--foreground` black; `--band` and `--card` are cool off-whites tinted toward the cyan panel (`#f3f6f7`, `#f7f9fa`).
2. Muted greys are darkened until AA holds on background, band and card (`#4f5459` gives 7.04 to 7.65).
3. Brand-colour text (link, ring) is a darker cyan: `#6ee6ff` becomes `#0a6f91` (link, 5.68) and `#0a7ea4` (ring, 4.63).
4. Primary button is unchanged (gradient with black label) so the brand mark is identical in both themes.
5. Code windows stay dark in light mode (a terminal reads as dark); white-top 3D materials keep white tops; the glow drops from 45% to 35%.
6. Shadows return (`--elev-*`) since light surfaces can show them.
7. Gradient-frame cards are theme-independent.
8. Status colours (`--destructive`, `--success`) are darkened to keep 4.5:1 on white.

## 13. Showcase

`/[locale]/kit` renders every primitive in a dark and a light column. `robots: noindex`. Not linked from the site.

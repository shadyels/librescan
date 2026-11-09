---
name: LibreScan
description: Photograph your bookshelf; a calm paper-and-ink interface lets the books do the talking.
colors:
  ground: "#f5f0e6"
  surface: "#ece5d8"
  raised: "#fffdf8"
  line: "#ded6c8"
  ink: "#1e2433"
  ink-muted: "#5f6677"
  accent: "#23395d"
  accent-ink: "#f5f0e6"
  highlight: "#f3c9b5"
  highlight-ink: "#1e2433"
  coral: "#d2603f"
  focus: "#23395d"
  danger: "#b42318"
  success: "#2e6b3f"
  ground-dark: "#151821"
  surface-dark: "#1a1d29"
  raised-dark: "#1e2230"
  line-dark: "#2e3446"
  ink-dark: "#eef0f5"
  ink-muted-dark: "#a6adbf"
  accent-dark: "#9db4e0"
  accent-ink-dark: "#151821"
  highlight-dark: "#5a3a30"
  highlight-ink-dark: "#f6dccf"
  coral-dark: "#ef8a6a"
  focus-dark: "#9db4e0"
  danger-dark: "#f2877b"
  success-dark: "#79c08a"
  cloth-navy: "#23395d"
  cloth-coral: "#d2603f"
  cloth-sage: "#6e8b74"
  cloth-mustard: "#c9a55c"
  cloth-linen: "#e9e1d2"
  cloth-brick: "#8c4a3c"
  cloth-slate: "#4f5d75"
typography:
  display:
    fontFamily: "Young Serif, Georgia, serif"
    fontSize: "clamp(3.75rem, 6vw, 5.25rem)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Young Serif, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.1
  title:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
    fontFeature: "'tnum' 1"
  lede:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    fontFeature: "'tnum' 1"
rounded:
  cover: "10px"
  card: "16px"
  photo: "20px"
  sticker: "20px"
  dialog: "24px"
  pill: "9999px"
spacing:
  gutter-sm: "16px"
  gutter-md: "24px"
  gutter-lg: "40px"
  row: "16px"
  section: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-primary-lg:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
    padding: "0 28px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-ghost:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  chip-toggle:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  chip-toggle-on:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
  sticker:
    backgroundColor: "{colors.highlight}"
    textColor: "{colors.highlight-ink}"
    rounded: "{rounded.sticker}"
  input:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "0 16px"
    height: "48px"
  book-card:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.card}"
    padding: "12px"
  book-cover:
    rounded: "{rounded.cover}"
  dialog:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    padding: "28px"
    width: "min(28rem, calc(100% - 2rem))"
  read-rule:
    height: "4px"
---

# Design System: LibreScan

## Overview

**Creative North Star: "Ink Blue on Paper"**

A well-made paperback, not a dashboard. Warm cream paper, navy ink, one soft peach highlight, and a single coral detail. The interface is calm so the books (real covers, or generated bookcloth covers) carry the colour. Headings are set in Young Serif, a sturdy bookish serif; everything you read or operate is set in Outfit, a clean geometric sans.

The friendliness comes from shape, not from hue. Controls are full pills. Content sits on cream-white cards with hairline borders and soft, ink-tinted shadows. A few tilted "stickers" (the upload icon, status icons, confidence badges) add a hand-placed touch without adding colours.

There is one signature effect, and it only appears while work is happening. The hairline under the nav becomes a navy-to-coral progress rule, and a single coral scan line crosses the shelf photo.

**Key Characteristics:**
- Cream ground, navy ink and accent, peach highlight, coral reserved for large display words and the read line.
- Young Serif display (one weight) and Outfit UI; tabular figures everywhere.
- Pill buttons; 16px cards, 20px photo frame and stickers, 10px covers, 24px dialog.
- Soft tinted shadows (`shadow-card`, `shadow-lift`, `shadow-sticker`); no hard offset shadows, no ink outlines.
- A plain hairline under the nav that becomes the reading progress bar.
- Light and dark follow the OS (`prefers-color-scheme`); reduced motion follows the OS.

## Colors

One accent, one highlight, one detail. Everything else is paper and ink.

### Primary
- **Accent** (`accent`, navy; light blue-grey in dark mode): the only interactive colour. It fills primary buttons, selected chips, selected sort segments, selected reading-level tiles, done or active step chips, checkbox ticks and the focus ring. Text on it is `accent-ink`, which is the ground colour.
- **Ink** (`ink`): text. Navy-black in light mode, near-white in dark mode.

### Secondary
- **Highlight** (`highlight`, peach; brown-rose in dark mode): soft emphasis. Used for the active nav pill, author chips, confidence badges, the upload and status stickers, and text selection. Text on it is `highlight-ink`.
- **Coral** (`coral`): a detail, never a fill for controls. Used for the one emphasised word in a page h1 ("shelf", "next"), the elapsed-seconds counter, the read line and the end of the progress rule, and the underline of auth footer links. In light mode coral on cream is 3.4:1, which passes AA for large text only. Never use it for body or label text.

### Neutral
- **Ground** (`ground`): page background, and the veil of the read sweep.
- **Surface** (`surface`): skeletons and the sort-control track.
- **Raised** (`raised`): cards, inputs, dialogs, secondary buttons and the active pipeline step.
- **Line** (`line`): hairline borders, outlined chips, idle steps, the idle rule under the nav.
- **Ink Muted** (`ink-muted`): ledes, metadata, hints and inactive nav. 5.1:1 on ground.

### Functional
- **Focus** (`focus`): a 2px outline at 3px offset on every focusable element. It equals the accent.
- **Danger** / **Success**: notices use an 8–10% tint with a 25% border and a solid icon. Danger also fills the destructive button, with white text in light mode and ground-coloured text in dark mode.

### Bookcloth (generated covers)
Seven muted cloth tones (`cloth-*`: navy, coral, sage, mustard, linen, brick, slate). A coverless book gets a stable colour by hashing its title. Cover text is ink or off-white, picked by luminance (threshold 0.2). These are mid-tones on purpose, so a grid reads as books and not as sweets.

### Named Rules
**The One Accent Rule.** Navy is the only colour that means "you can press this" or "selected". Peach is emphasis, coral is a detail. Do not add a fourth hue to the chrome.

**The Untinted Cover Rule.** Covers are shown as delivered: no overlays, tints, duotones or filters. A missing cover is bound in bookcloth with the title in the display face.

## Typography

**Display Font:** Young Serif (Google Fonts, single weight 400) with a Georgia fallback.
**Body Font:** Outfit variable 400–700 with a system sans fallback.

**Character:** A friendly, slightly old-style serif for headings, like a paperback title page, set against a clean geometric sans for everything you read or operate.

### Hierarchy
- **Display** (`type-display`: Young Serif, line-height 1.02, -0.015em, balanced wrap). Page h1s are 60px on phones and 72px from `sm`, and 84px on the Home hero. Status views use 48–60px and auth pages 60–72px. One word may be coral. The elapsed counter on Recommendations is 80–96px in coral. The wordmark is 27px.
- **Headline** (Young Serif, 20–30px): recommendation titles (24px), dialog titles (24px), account-CTA titles (24–30px), preference group titles (20px), and titles on generated covers (18px).
- **Title** (Outfit 600, 16px): book titles in grids, the active step label, and field labels (14px).
- **Body** (Outfit 400, 15px, relaxed). The **Lede** is 17px with a maximum of about 60ch, under every h1. Recommendation reasons are 16px.
- **Label** (`type-label`, Outfit 600, 12–13px, sentence case): badges, step states and counts.

### Named Rules
**The Tabular Figures Rule.** `tabular-nums` is set on the body, so counts, percentages, timings and sizes always align.

## Layout

A single centred column capped at 80rem, with side padding of 16px / 24px / 40px (base / `sm` / `lg`) and 32–40px top padding. The header is a 72px row: wordmark, nav pills, then account pills on the right. It is followed by the full-bleed 4px read rule. On phones, signed-in nav links drop to a second row.

Pages are left-aligned. Home is a two-column grid from `lg` (a fluid photo column and a 380px pipeline column); on phones the actions sit directly under the photo. Auth pages split a display title from a 420px form card. Book grids step 2 → 3 → 4 → 5 → 6 columns with 16–20px gaps. Recommendations are stacked cards, each with a three-column grid from `md` (cover 120px, title block, reason). Preferences use a 16rem label column beside the controls, with a translucent sticky save bar.

## Elevation & Depth

Soft and quiet. Three ink-tinted shadows, defined as utilities in `src/styles/index.css`:
- `shadow-card`: cards, the photo frame, the active step, and book cards on hover.
- `shadow-lift`: filled buttons. It drops away on press as the button settles 1px.
- `shadow-sticker`: a faint coral glow under peach stickers.

The dialog uses one larger shadow over a 50% navy-black backdrop. There is no glass and no hard offset shadow. The only gradient is the navy-to-coral fill of the read rule.

## Shapes

Controls (buttons, chips, nav and sort segments) are full pills. Cards, inputs, notices, step rows and option tiles use 16px. The photo frame, account CTA, auth card and recommendation cards use 20px. Stickers use 20px and are tilted −6°. Covers use 10px with a slight inset shadow on the spine edge, the dialog uses 24px, and the mini covers in Saved use 4px. Borders are 1px `line`; the empty photo frame is dashed.

## Components

### Buttons
- **Sizes:** 36 / 44 / 52px tall, 13 / 14 / 16px semibold, with an optional 16px Lucide icon.
- **Primary and danger:** filled, with `shadow-lift`. They rise 1px on hover and settle 1px with no shadow on press (CSS only, and disabled under reduced motion).
- **Secondary:** raised fill with a 1px line border, which turns muted ink on hover. **Ghost:** muted text with a faint ink wash, used for back links.
- **Loading:** a spinner replaces the icon and the cursor becomes "wait"; busy buttons do not dim. Only a plainly disabled button drops to 45% opacity.

### Chips, Badges and Segments
- **Toggle chip (genres):** 36px pill, raised with a line border; selected fills navy with a check icon.
- **Removable chip (authors):** peach pill with a round dismiss button.
- **Confidence badge:** a peach pill tilted −2°. Low confidence (under 75%) becomes a dashed navy outline tilted +1°. The category chip is a plain line-outlined pill.
- **Sort segment:** a surface track; the selected navy pill slides between options on the shared spring.
- **Option tile (reading level):** a 16px card that fills navy when selected; the focus ring is drawn on the tile.

### Inputs / Fields
48px tall, raised fill, 1px line border, 16px corner, 15px text. The label is 14px semibold above, with a 13px muted hint below. On focus the border turns navy and the global focus ring is added. Checkboxes are native and tinted with the accent.

### Cards
- **Book card:** a raised 16px card with a hairline border and 12px padding. On hover it gains `shadow-card`, and the cover lifts 4px and tilts −1°.
- **Recommendation card:** a raised 20px card with `shadow-card`: cover, then title, author and category chips, then the reason (16px) and a three-line description.
- **Saved list:** one raised 20px card with hairline rows; a selected row takes a peach wash. Each row shows three fanned mini covers in bookcloth.

### Book Cover
2:3 with a 10px corner, never tinted. A loaded cover fades in over 500ms. Before that, and when no cover exists, it shows the bookcloth colour with the title in Young Serif (hyphenated) and the author beneath.

### Home Pipeline
Four steps: choose a photo, read the spines, match covers, recommendations. Each has a 36px numbered chip. Done and active chips fill navy (active is tilted −6°, done shows a check). The active row is a raised card. Working steps show a pulsing coral dot.

### Notices and Status Views
- **Notice:** a 16px card with a tint and border in danger or success, a solid icon, ink text and an optional dismiss. It springs in.
- **Status view:** a left-aligned block for empty, error and login-gated states. It has a tilted 64px peach sticker holding the icon (a danger tint for errors), a display title, a lede and actions.

### Dialog
A native modal `<dialog>` with a raised fill, hairline border and 24px corner, 28px padding and a maximum width of 28rem. It springs in from 96% scale. Actions stack on phones and right-align from `sm`.

### Navigation
The wordmark sits on the left in Young Serif. Links are 14px semibold pills, muted when inactive. The active link sits on a peach pill that slides between links on the spring. Account actions are small pills: outlined Log in and filled Sign up, or outlined Log out with the email beside it from `md`.

### Read Rule (signature)
A full-bleed 4px hairline in `line` under the header. While a page reports reading (`useReading(true)` from `src/reading.jsx`: the Home upload and Recommendations generation), it becomes an indeterminate progress bar. A navy-to-coral fill scales from 0 toward 92% over 14s on an ease-out and waits there, and the page navigates away when the work ends. It is exposed as `role="progressbar"` without a value while reading, and is `aria-hidden` when idle. Under reduced motion the fill appears without animating.

### Read Sweep (signature)
While the photo is read, a 55% ground veil slides off it, and a 3px coral line with a soft coral glow travels with its edge. The loop is a 2.6s travel plus a 0.35s hold on a sinusoidal ease, phase-locked to the wall clock. It is hidden entirely under reduced motion; the read rule, step states and button state carry progress instead.

### Motion grammar
Entrances use the exponential ease-out `cubic-bezier(0.16, 1, 0.3, 1)`. A page change is a 10px rise and fade over 350ms. Cards in grids and lists use the `pop` variant, a spring from 95% scale and 12px below with a 50–70ms stagger. Layout moves (the nav pill, sort pill, author chips, re-sorted books and the dialog) share one spring: stiffness 440, damping 30, mass 0.8. Only transform and opacity animate. `MotionConfig reducedMotion="user"` removes travel app-wide.

## Do's and Don'ts

### Do:
- **Do** keep the chrome to paper, ink, navy, peach and the occasional coral word.
- **Do** call `useReading(true)` from a page while it waits on slow work, so the rule under the nav shows progress.
- **Do** set page h1s in Young Serif with a 17px muted lede beneath, and colour at most one word coral.
- **Do** use pills for controls, 16–20px cards for content, and soft tinted shadows for depth.
- **Do** use Lucide icons (1.75–2 stroke); no inline SVG.
- **Do** animate only transform and opacity, and give every looping effect a reduced-motion fallback.
- **Do** check every new colour pair in both light and dark mode (AA: 4.5:1 for text, 3:1 for large text).

### Don't:
- **Don't** tint, overlay or filter book covers.
- **Don't** add more brights: no rainbow palettes, multicolour chips or candy-coloured covers.
- **Don't** use coral for text under 24px, or as a control fill.
- **Don't** use a violet or aubergine dark mode; dark mode is navy-black.
- **Don't** put a decorative band or graphic under the nav; the rule is a hairline until something is reading.
- **Don't** use hard offset shadows or thick ink outlines (the rejected "chunky playful" direction).
- **Don't** return to the retired "Spine Spectrum" look (grey, condensed uppercase Archivo, ink rules, no colour).

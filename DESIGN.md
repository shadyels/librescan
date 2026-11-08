---
name: LibreScan
description: Photograph your bookshelf; the shelf's own colours run the interface.
colors:
  ground: "#f4f4f2"
  surface: "#e9e9e6"
  raised: "#ffffff"
  line: "#d4d4cf"
  ink: "#141518"
  ink-muted: "#55575d"
  accent: "#141518"
  accent-ink: "#f4f4f2"
  focus: "#2a5a8f"
  danger: "#b42318"
  success: "#2e6b3f"
  ground-dark: "#111214"
  surface-dark: "#1c1d20"
  raised-dark: "#24252a"
  line-dark: "#34353a"
  ink-dark: "#ededea"
  ink-muted-dark: "#a3a5ab"
  focus-dark: "#8fb2ea"
  danger-dark: "#f2877b"
  success-dark: "#79c08a"
  house-oxblood: "#8f2d26"
  house-rust: "#c46a1e"
  house-ochre: "#c9a227"
  house-green: "#2f6b45"
  house-blue: "#2a5a8f"
  house-violet: "#4b3a7a"
  house-plum: "#7a2d55"
  spine-black: "#1d1f24"
  spine-bone: "#e4e1d8"
  spine-graphite: "#3a3c42"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3.75rem, 6vw, 5.25rem)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.005em"
    fontVariation: "'wdth' 62"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
    fontFeature: "'tnum' 1"
  lede:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    fontVariation: "'wdth' 72"
    fontFeature: "'tnum' 1"
rounded:
  photo: "4px"
  dialog: "8px"
  pill: "9999px"
spacing:
  gutter-sm: "16px"
  gutter-md: "24px"
  gutter-lg: "40px"
  row: "16px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "40px"
  button-primary-lg:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-secondary:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.ground}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "40px"
  button-ghost:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "32px"
  chip-toggle:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  chip-toggle-on:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
  input:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.photo}"
    padding: "0 14px"
    height: "44px"
  book-cover:
    rounded: "{rounded.photo}"
  dialog:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    padding: "24px"
    width: "min(28rem, calc(100% - 2rem))"
  spectrum-band:
    height: "28px"
---

# Design System: LibreScan

## Overview

**Creative North Star: "Spine Spectrum"**

The shelf's own colours run the interface. Everything LibreScan draws itself is neutral: a cool off-white ground (near-black in dark mode), ink type, ink rules. Colour enters the screen from exactly two places: the spine spectrum, a band of thin vertical stripes sampled from the user's shelf photo (or a fixed house spectrum of bookcloth hues before there is a photo), and book covers, which are shown untouched. The band sits full-width directly under the nav on every page, so each screen is literally coloured by the shelf it is about.

Type carries the identity the palette withholds. Archivo's variable width axis does double duty: squeezed to 62% at 800 weight in uppercase it becomes spine lettering for display headings; at normal width it is a plain, legible UI face. Density is moderate and list-like: steps, recommendations, saved sets and preference groups are rows separated by 1.5px ink rules rather than boxed cards. Surfaces are flat; there are no shadows at rest, no gradients, no glass.

Motion is short and physical: exponential ease-out for entrances, one shared spring for layout changes, stripes that grow up from their baseline, and one signature effect, the read sweep, where a white read-line crosses the photo and the band while the unread side stays veiled.

**Key Characteristics:**
- Neutral ground and ink; chromatic colour comes only from the spine spectrum and covers.
- Full-width spectrum band under the nav on every route (20px mobile, 28px from `sm`).
- Condensed uppercase Archivo display (62% width, 800); normal-width Archivo for UI; tabular figures everywhere.
- Ink-filled and ink-outlined pill buttons; 4px corners on photos, covers and fields.
- 1.5px ink rules between rows instead of cards.
- Flat at rest; Lucide icons at 1.75 stroke.
- Light and dark follow the OS (`prefers-color-scheme`); reduced motion follows the OS.

## Colors

A colourless instrument: neutral ground and ink, with all hue delegated to the shelf.

### Primary
- **Ink** (`ink` / `ink-dark`): text, rules, the active-nav underline, text selection fill, and (as `accent`) the fill of primary buttons, the selected sort segment and selected chips. Accent is deliberately the same value as ink: the "brand colour" is black on light, bone on dark.
- **Accent Ink** (`accent-ink`): text on ink-filled controls; equals the ground.

### Secondary
- **The Spine Spectrum** (`house-*` plus `spine-black`, `spine-bone`, `spine-graphite`): seven bookcloth hues (oxblood, rust, ochre, green, blue, violet, plum). Used three ways only: (1) the default band before a photo exists, 60 stripes with every fourth one a neutral spine so it reads as a shelf, not a rainbow; (2) the stable generated colour of a coverless book (hash of the title into the seven hues); (3) the band for a scan whose photo spectrum is no longer on this device. Once a photo exists, the band is sampled from it (64 stripes) and replaces the house hues entirely.
- Text on any spine colour uses black ink or near-white chosen by luminance (threshold 0.22), never a fixed colour.

### Neutral
- **Ground** (`ground` / `ground-dark`): page background, and text on danger buttons.
- **Surface** (`surface` / `surface-dark`): empty photo frame, sort-control track, author chips, loading skeletons.
- **Raised** (`raised` / `raised-dark`): inputs and dialogs, the only surfaces lighter than the ground.
- **Line** (`line` / `line-dark`): input borders, inactive chip outlines, quiet row dividers, the "later" pipeline steps.
- **Ink Muted** (`ink-muted` / `ink-muted-dark`): ledes, metadata, hints, inactive nav.

### Functional
- **Focus** (`focus`): 2px focus outline at 2px offset on every focusable element. Light value shares the house blue.
- **Danger** / **Success**: notice tints at 12% alpha with a solid icon; danger also fills the destructive button and the error status icon. Never decorative.

### Named Rules
**The Shelf Owns The Colour Rule.** Interface chrome is ink and neutrals only. A hue on screen must come from the spectrum band, a cover, a generated spine binding, or a functional state (focus, danger, success).

**The Untinted Cover Rule.** Covers are shown as delivered: no overlays, tints, duotones or filters. A missing cover is bound in its generated spine colour with the title in spine lettering.

## Typography

**Display Font:** Archivo variable at 62% width (with ui-sans-serif, system-ui fallback)
**Body Font:** Archivo variable at normal width
**Label Font:** Archivo at 72% width, bold

**Character:** One family on its width axis: condensed caps that read like lettering on a spine, against a neutral grotesque for everything you actually read. Loaded from Google Fonts with `wdth 62..125, wght 400..800`.

### Hierarchy
- **Display** (800, 62% width, uppercase, 0.92 line-height, balanced wrap): page h1 only; 60px on phones, 72px from `sm`, 84px on the Home hero; 48–60px in status views; 60–72px on auth pages. Also the elapsed-seconds counter on Recommendations (80–96px) and titles on generated covers (20px). The wordmark uses the same face in mixed case at 26px.
- **Headline** (700, 20px): recommendation titles, account-CTA and dialog titles (18px), preference group titles (18px).
- **Title** (600, 16px, snug): book titles in grids, active step labels, field labels (14px).
- **Body** (400, 15px, relaxed): metadata lines and supporting copy; **Lede** (17px, relaxed, max ~56–60ch) under every h1; recommendation reasons at 16px.
- **Label** (700, 72% width, 13px, sentence case): figures and short state words: step numbers (18px), step states, confidence ("92% · good"), saved-set counts, cover author lines.

### Named Rules
**The Spine Lettering Rule.** Condensed uppercase is for display headings and cover titles only. Labels stay sentence case; body never condenses.

**The Tabular Figures Rule.** `tabular-nums` is set on the body; counts, percentages, timings and sizes always align.

## Layout

A single centred column capped at 80rem with side padding of 16px / 24px / 40px (base / `sm` / `lg`) and 32–40px top padding. The header is a 64px row (wordmark, nav, account pills right) followed by the full-bleed spectrum band, which ignores the column.

Pages are left-aligned, never centred heroes. The Home scan screen is a two-column grid from `lg` (fluid photo column, 380px pipeline column, 56px gap); on phones the actions move directly under the photo. Auth pages split a display title from a 400px form column. Book grids step 2 → 3 → 4 → 5 → 6 columns with 20px column gaps and ~36px row gaps. Recommendations are rows: cover, title block, reason, in a three-column grid from `md` (cover 120px). Preferences use a 16rem label column beside controls, with a sticky save bar ruled in ink at the bottom.

Rhythm: 16px inside rows, 24–32px between rows, 40–64px between sections. On phones signed-in nav links drop to a second row under the header.

## Elevation & Depth

Flat. No surface casts a shadow at rest or on hover; depth is tonal (surface is darker than ground, raised is lighter) and structural (ink rules). The only `box-shadow` uses in the build are not elevation: a 1.5px inset ring that acts as a border on outlined pills and option tiles, and a 1px hard edge that keeps the white read-line visible on pale photos. Modal dialogs separate from the page with a 55% black backdrop, not a shadow.

### Named Rules
**The Flat Shelf Rule.** No drop shadows, gradients or backdrop blur. If something needs to stand apart, use a rule, a tonal step, or the dialog backdrop.

## Shapes

Two corner languages, by role. Photographic and data objects (shelf photo frame, covers, fields, notices, option tiles, skeletons) take a tight 4px corner, close to a printed object. Controls (buttons, chips, sort segments, dismiss buttons) are full pills. The dialog alone uses 8px. Covers are always 2:3; the photo frame is 3:2. Rules are 1.5px ink for structure, 1px line for quiet subdivision; the photo frame uses a 1.5px line border that turns ink while a file is dragged over it.

## Components

### Buttons
Solid and tactile; they press in (scale 0.97 on tap).
- **Shape:** full pill.
- **Sizes:** 32px / 40px / 48px tall, 13 / 14 / 15px semibold, optional 16px Lucide icon at 1.75 stroke.
- **Primary:** ink fill, ground text; hover drops fill to 85%.
- **Secondary:** transparent with a 1.5px inset ink ring; hover adds an 8% ink wash.
- **Danger:** danger fill, ground text. **Ghost:** muted text, 8% ink wash on hover, used for back links.
- **Loading:** a spinning loader replaces the icon and the cursor becomes "wait"; busy buttons do not dim. Only a plainly disabled button drops to 45% opacity.

### Chips and Segments
- **Toggle chip (genres):** 36px pill, 1.5px inset line ring, ring turns ink on hover; selected fills ink with a check icon.
- **Removable chip (authors):** surface fill with a round dismiss button.
- **Sort segment:** pill track in surface; the selected segment's ink pill slides between options on the shared spring.
- **Option tile (reading level):** 4px corner, line ring, selected fills ink; focus ring drawn on the tile.

### Inputs / Fields
- **Style:** 44px, raised fill, 1px line border, 4px corner, 15px text, label 14px semibold above, 13px muted hint below.
- **Focus:** border turns ink plus the global 2px focus outline. Hover darkens the border to muted ink.
- Checkboxes are native, tinted to ink.

### Rows (structural "cards")
LibreScan does not box content. Pipeline steps, recommendations, preference groups, the account CTA and the saved-list header open with a 1.5px ink top rule; inactive or skeleton rows use the line colour. Saved sets are 1px-line rows with a small spectrum thumbnail.

### Book Cover
2:3, 4px corner, never tinted. Fades in over 500ms when loaded; before that, and when no cover exists, it shows the generated spine colour with the title in display lettering and the author as a label, in luminance-picked ink.

### Notices and Status Views
- **Notice:** 4px corner, 12% danger or success tint, solid icon, ink text, optional dismiss; drops in 6px on ease-out.
- **Status view:** left-aligned block for empty, error and login-gated states: a 32px Lucide icon (muted, or danger for errors), display title, lede, actions.

### Dialog
Native modal `<dialog>`, raised fill, 8px corner, 24px padding, max 28rem; springs in from 96% scale. Actions stack on phones, right-align from `sm`.

### Navigation
Wordmark left in mixed-case display lettering; links 14px, muted at medium weight, active at bold ink with a 2px ink underline that slides between links on the spring. Account actions are small pills (outlined Log in, filled Sign up; outlined Log out with the email beside it on `md`+).

### Spectrum Band (signature)
Full-width stripes under the nav, flex-grown 0.5–1.8× per stripe so they read as books of different thickness. Pages set what it shows: the house band, the photo spectrum, or title colours. Stripes grow up from the baseline (400ms ease-out, 12ms stagger) when the colours change.

### Read Sweep (signature)
While a photo is being read, a veil of the ground at 70% slides off the photo and the band as a 2px white line with a 1px dark edge travels with it: 2.6s travel plus 0.35s hold, sinusoidal ease, looping. Every sweep is phase-locked to the wall clock so the band and the photo move in step. Hidden entirely under reduced motion; the step labels and button state carry progress instead.

### Motion grammar
Exponential ease-out `cubic-bezier(0.16, 1, 0.3, 1)` for entrances. Page change: 8px rise and fade over 350ms, exit fade 140ms. Lists: children rise 14px over 500ms with 60–70ms staggers. Layout moves (nav underline, sort pill, dialog) use one spring (stiffness 420, damping 36, mass 0.8). Transform and opacity only. `MotionConfig reducedMotion="user"` removes travel app-wide.

## Do's and Don'ts

### Do:
- **Do** put every new route under the shell band and declare what it shows (house band, photo spectrum, or title colours).
- **Do** keep chrome to ground, surface, raised, line, ink and ink-muted; take hue only from the spectrum, covers, or functional states.
- **Do** set page h1s in display lettering (62% width, 800, uppercase) with a 17px muted lede beneath.
- **Do** separate list content with 1.5px ink top rules instead of boxing it.
- **Do** use pills for controls and the 4px corner for photos, covers and fields.
- **Do** use Lucide icons at 1.75 stroke (1.5 for large status icons).
- **Do** animate only transform and opacity, with the shared ease-out and spring, and give every looping effect a reduced-motion fallback.
- **Do** check every new colour pair in both light and dark mode.

### Don't:
- **Don't** tint, overlay or filter book covers.
- **Don't** introduce a chromatic brand or accent colour; the accent is ink.
- **Don't** add drop shadows, gradients, glass or backdrop blur.
- **Don't** wrap rows in rounded cards or grids of boxed tiles.
- **Don't** set body or labels in condensed caps, or add tracked-out uppercase labels above headings.
- **Don't** order the house hues as a spectral rainbow; keep neutral spines mixed in.
- **Don't** return to the retired cream, serif and brown look.

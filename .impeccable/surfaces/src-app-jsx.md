---
version: 1
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: ["src/pages/Home.jsx","src/pages/Results.jsx","src/pages/Recommendations.jsx","src/pages/Saved.jsx","src/pages/Preferences.jsx","src/pages/Login.jsx","src/pages/Signup.jsx"]
---

Scope: the whole LibreScan SPA (Home/scan, Results, Recommendations, Saved, Preferences, Login, Signup). Visitor mode: **Operate**. Code-led build.

Audience and job: portfolio reviewers first, readers second; photo of a shelf → recognised books → recommendations in one sitting, anonymously. Flows, routes, API calls, anon `?device_id=` and claim redirect are unchanged.

Constraints: light + dark from `prefers-color-scheme`; motion via `motion/react` with `reducedMotion="user"`; icons via `lucide-react`; no backend changes. The vision model returns titles, not spine coordinates, so nothing may claim to point at a specific spine.

Memorable moment: the user's own photo being read, then its colours carrying into Results.

Unresolved: none.

## Direction contract

THESIS: The shelf's own colours run the interface. LibreScan samples the uploaded photo into a band of spine stripes, and that band is the app's colour. Refuses the category default (centred hero over a dashed drop card, indigo accent, rounded card grid) and the incumbent cream, serif and brown.

OWN-WORLD: Neutral ground (light #f4f4f2, dark #111214) with ink type; colour arrives only as the spine spectrum (stripes sampled from the photo, otherwise a fixed house spectrum of bookcloth hues) and as covers, which are never tinted. Archivo variable: 62% width, 800 weight, uppercase for display (spine lettering); normal width for UI; tabular figures. Ink-filled and ink-outlined pill buttons, 1.5px ink rules between rows, 4px radius on photos and covers, Lucide icons at 1.75 stroke. No shadows at rest, no gradients or glass.

STORY: Within one viewport a reviewer sees that a shelf photo becomes books and then recommendations, watches each step happen honestly (confidence, timings, model), and does it without signing up; an account is offered only where there is something to keep.

FIRST VIEWPORT: Nav row on ground (wordmark left; Scan, Saved, Preferences; Log in and Sign up pills right). Beneath it a full-width 28px spectrum band. Left two-thirds: condensed uppercase h1 "Scan your shelf" at about 76px, one-line lede, then the photo frame (drop or choose; the preview fills it). Right column: the four-step pipeline (Photo, Reading spines, Matching covers, Recommendations) in ink-ruled rows with states; the primary pill sits at its foot. Signature interaction: on upload a white read-line sweeps the photo, the unread side veiled, spectrum stripes lighting as it passes; on response the band carries into Results and covers land in a stagger. Motion: transform and opacity only, 60–90 ms staggers, layout springs for reorder and removal; reduced motion drops travel and keeps a static progress label.

FORM: Spine Spectrum, #3 of the grounded list (re-roll round 1). seed:b7f2bf99584f9e42

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

---
version: 2
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: ["src/pages/Home.jsx","src/pages/Results.jsx","src/pages/Recommendations.jsx","src/pages/Saved.jsx","src/pages/Preferences.jsx","src/pages/Login.jsx","src/pages/Signup.jsx"]
---

Scope: the whole LibreScan SPA (Home/scan, Results, Recommendations, Saved, Preferences, Login, Signup). Visitor mode: **Operate**. Code-led build.

Audience and job: portfolio reviewers first, readers second. A photo of a shelf becomes recognised books, then recommendations, in one sitting, anonymously. Flows, routes, API calls, the anon `?device_id=` and the claim redirect are unchanged.

Constraints: light and dark from `prefers-color-scheme`; motion via `motion/react` with `reducedMotion="user"`; icons via `lucide-react`; no backend changes. The vision model returns titles, not spine coordinates, so nothing may claim to point at a specific spine.

History: "Spine Spectrum" (grey, condensed caps, photo-sampled stripe band) was rejected as unusable. A "playful brights" round (six brights, chunky outlines, a toy-shelf header, a plum dark mode) was rejected as garish. Four cream directions were mocked; the user chose D, "Ink blue on paper", with the progress-rule header.

Unresolved: none.

## Direction contract

THESIS: A calm, well-made paperback. Cream paper, navy ink, one peach highlight and one coral detail, so the books carry the colour. Friendliness comes from pill shapes, soft cards and a few tilted stickers, not from extra hues.

OWN-WORLD: Ground #f5f0e6 (dark #151821), ink #1e2433, accent navy #23395d (dark #9db4e0), highlight peach #f3c9b5, coral #d2603f for large display words and the read line only. Young Serif display and Outfit UI; tabular figures. Pill buttons with soft lift shadows; 16–20px raised cards with hairline borders; covers untinted, with coverless books bound in seven muted bookcloth tones. No hard offset shadows, no ink outlines, no rainbow.

STORY: Within one viewport a reviewer sees that a shelf photo becomes books and then recommendations, watches each step happen honestly (confidence, timings, model), and does it without signing up. An account is offered only where there is something to keep.

FIRST VIEWPORT: Nav row on cream (Young Serif wordmark; a peach pill on the active link; Log in and Sign up pills on the right) over a 4px hairline. On the left, the h1 "Scan your *shelf*" with "shelf" in coral, a lede, then a dashed raised photo frame with a tilted peach upload sticker. On the right, the four-step pipeline (numbered chips, the active step as a raised card) with the navy primary pill beneath it. Signature: while reading, the hairline becomes a navy-to-coral progress rule, and a coral scan line crosses the photo over a fading veil. Motion is transform and opacity only, with pop-in card staggers and springs for layout. Reduced motion drops the sweep and the progress animation.

FORM: Ink blue on paper (direction D of four cream mocks, user-picked).

FINISH: unreviewed and undocumented is unfinished; DESIGN.md documents the shipped system. The `.impeccable/design.json` sidecar still describes Spine Spectrum and needs regenerating.

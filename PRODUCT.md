# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primarily a portfolio/showcase project: the live demo at librescan.shadyels.com is judged by reviewers (recruiters, engineers, designers) on craft and on whether the AI pipeline visibly works. Real readers who want a next book are the secondary audience. Both reach the app on desktop and phone; neither is assumed dominant.

## Product Purpose

The user photographs a bookshelf. A vision model reads the spines, Google Books enriches each recognised title with cover and metadata, and a second LLM recommends books the user doesn't own yet, each with a personal reason. Success is a first-time visitor going photo → recognised books → recommendations in one sitting, without being asked to sign up first.

## Positioning

Two claims together, which neighbouring book apps (Goodreads, StoryGraph) can't truthfully make:

1. **The shelf is the input.** No manual logging and no rating history: one photo of the books you own is enough.
2. **No account needed to try it.** Anonymous visitors can scan, see recognised books, and generate and view recommendations. An account is optional and exists only to keep things (save scans/recommendations, set preferences).

## Operating Context

- Upload: JPEG/PNG/HEIC, max 10 MB, via camera capture on phones or file picker on desktop.
- Vision recognition (`qwen/qwen3.6-27b` on Groq) takes several seconds; recommendation generation (`openai/gpt-oss-120b`) takes 10–30 s on first request and is cached afterwards.
- Anonymous scope is a device id in IndexedDB, passed as `?device_id=` on Results/Recommendations URLs.
- Claim flow: signing up or logging in moves the device's most recent anon scan and its recommendation into the account and redirects to that scan's Results.
- Daily API ceilings can block all operations (`daily_limit_hit`).

## Capabilities and Constraints

- Routes: Home (scan), Results `/results/:scanId`, Recommendations `/recommendations/:scanId`, Saved, Preferences, Login, Signup.
- Results: recognised books with confidence, cover, categories; sortable by confidence/title/author.
- Recommendations: about 8 books, each with a reason and description; save/remove is login-only.
- Saved: list of saved sets with multi-select bulk delete (permanent).
- Preferences (login-only): genres, favourite authors (max 20), language, reading level. Injected into the LLM prompt as natural language, not hard filters.
- Stack: React 19 SPA, Vite 6, Tailwind CSS v4, React Router v7; Vercel serverless API; Neon Postgres.

## Brand Commitments

- The name **LibreScan** (spelling and casing) is fixed. No other binding brand, voice, or asset commitments.

## Evidence on Hand

- Live demo: librescan.shadyels.com.
- `test-image.jpg` in the repo root: a real shelf photo for demos/tests.
- No testimonials, user counts, or benchmarks exist; do not invent any.

## Product Principles

1. **Show the mechanism.** The pipeline (photo → spines read → books → recommendations) is the product's proof; make each step visible, not hidden behind spinners.
2. **Value before identity.** Never gate the core loop behind an account; ask for signup only at the moment there is something worth keeping.
3. **Real data, honest uncertainty.** Confidence scores, missing covers, and failed recognitions are shown truthfully.
4. **Craft is the pitch.** As a portfolio piece, consistency and finish across every state (loading, empty, error) matter as much as the happy path.

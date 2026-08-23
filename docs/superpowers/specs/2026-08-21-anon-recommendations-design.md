# Anonymous Recommendations — Design

Date: 2026-08-21

## Problem

`POST /api/generate-recommendations` and `GET /api/recommendations/:scanId`
currently require a logged-in session (`requireUser`), and the frontend
(`Recommendations.jsx`) shows a `LoginGate` for anonymous visitors instead of
ever calling the API. Recommendations should be available to anonymous
(`device_id`-scoped) users too, the same way scans already are.

## Non-goals

- Preferences remain login-only. Anon recommendation generation runs without
  preferences (already handled gracefully — `preferences = null` is a
  supported path in `recommendationAI.js`).
- Saved scans (`/api/saved`) remain login-only.
- No new discard mechanism — anon recommendations reuse the existing 24h
  unsaved-recommendation cleanup.

## Data model

`recommendations` table changes (in `scripts/setup-database.js`):

- `user_id UUID NOT NULL REFERENCES users(id)` → `user_id UUID REFERENCES users(id) ON DELETE CASCADE`
  (drop `NOT NULL`)
- Add `device_id UUID REFERENCES anon_sessions(device_id) ON DELETE CASCADE`
- Add `CHECK ((user_id IS NOT NULL AND device_id IS NULL) OR (user_id IS NULL AND device_id IS NOT NULL))`
  — same shape as the existing `scans` table CHECK constraint.

No production data exists to preserve, so this is applied by editing
`scripts/setup-database.js` directly (full drop/recreate via `npm run db:setup`),
not a non-destructive migration.

## Backend

Dual-identity resolution follows the existing pattern in
`api/scan/[scanId].js` and `api/upload-image.js`: try `getCurrentUser(req)`
first; if null, fall back to a `device_id` supplied by the client
(body field for POST, query param for GET).

### `api/generate-recommendations.js`

- Replace `requireUser(req, res)` with `getCurrentUser(req)`. If no user,
  read `device_id` from `req.body` and validate it as a UUID (400 if missing
  or malformed for the anon path).
- **Existing-recommendation check (current Step 2)**: currently
  `SELECT ... FROM recommendations WHERE scan_id = $1` with no ownership
  filter — anyone who knows a `scan_id` can retrieve another user's stored
  recommendations via this POST. Fix while touching this code: filter by
  `(user_id = $2 OR device_id = $3)`, passing `user.id`/`null` or
  `null`/`device_id` depending on identity.
- **Scan ownership fetch (current Step 3)**: same ownership filter,
  `WHERE scan_id = $1 AND (user_id = $2 OR device_id = $3)`.
- **Preferences fetch (Step 4.5)**: only runs when `user` is present; anon
  requests skip straight to `preferences = null`.
- **Insert (Step 8)**: populate `user_id` or `device_id` depending on which
  identity resolved, leaving the other NULL.

### `api/recommendations/[scanId].js` (GET)

- Same swap: `getCurrentUser(req)`, `device_id` from `req.query` when
  anonymous.
- Ownership filter on the `SELECT`: `WHERE scan_id = $1 AND (user_id = $2 OR device_id = $3)`.

### Claim flow — `api/auth/signup.js` and `api/auth/login.js`

After the existing scan-claim query, if `claimed_scan_id` is non-null, run:

```sql
UPDATE recommendations
SET user_id = $1, device_id = NULL
WHERE scan_id = $2 AND device_id IS NOT NULL
```

using `user.id` and `claimed_scan_id`. This only touches the recommendation
tied to the one scan that was just claimed — no new race condition, since
it's scoped to a specific `scan_id` rather than a `LIMIT 1` subquery.

### Discard if abandoned

No new code. `cleanupOldRecommendations()` in `generate-recommendations.js`
(plus the standalone `scripts/cleanup-recommendations.js`) already deletes
any row where `saved = FALSE AND created_at < NOW() - INTERVAL '24 hours'`,
regardless of `user_id` vs `device_id`. Anon rows are covered automatically
once they can exist.

## Frontend

### `src/pages/Recommendations.jsx`

- Import `useSession` for `deviceId`.
- Remove the `if (!user) return <LoginGate .../>` early return.
- Fetch effect gates on `authLoading || sessionLoading` instead of
  `authLoading || !user`, and proceeds if either `user` or `deviceId` is
  available.
- GET request: append `?device_id=` when anonymous.
- POST body: include `device_id` when anonymous.
- Save button: only rendered when `user` is present. When anonymous, show a
  prompt to create an account to save the recommendations (same visual
  pattern as the anon banner in `Results.jsx`), instead of the Save button.
- Delete/saved-dialog logic is unaffected (already login-only, anon never
  reaches `saved === true`).

### `src/pages/Results.jsx`

- The `user ? <ViewRecommendationsLink/> : <AnonBanner/>` branch changes:
  anonymous users now also get the "View Recommendations" link (not the
  banner-only treatment), with `?device_id=` appended, matching how the
  `/results/:scanId` link already carries `device_id` from `Home.jsx`.
- Keep a lighter "create an account to save your results" hint for anon
  users somewhere on this page (exact placement decided during
  implementation) since saved scans still require login.

## Testing

No automated test suite exists in this repo (per `CLAUDE.md`). Validation is
manual:

1. Anonymous: upload a scan, navigate to `/results/:scanId`, click "View
   Recommendations", confirm generation works and results render without a
   login gate.
2. Reload the recommendations page anonymously — confirm the GET path
   returns the already-generated set instead of regenerating.
3. From the anon recommendations page, sign up — confirm redirect lands on
   the claimed scan's results, and the recommendation row now has
   `user_id` set / `device_id` NULL in the DB.
4. Repeat step 3 with login (existing anon user with an existing account)
   instead of signup.
5. Confirm an anon recommendation older than 24h and unclaimed is deleted
   by `npm run db:cleanup-recommendations`.
6. Confirm a logged-in user's own recommendations flow is unaffected
   (regression check on the existing behavior).

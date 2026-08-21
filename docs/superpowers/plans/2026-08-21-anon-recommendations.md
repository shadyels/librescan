# Anonymous Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anonymous (device_id-scoped) users generate and view book recommendations, the same way they can already view scan results — with the recommendation transferring into a new/existing account on signup or login, and expiring automatically if never claimed.

**Architecture:** Extend the existing dual-identity pattern (already used by `scans` via `user_id`/`device_id`) to the `recommendations` table and its two endpoints. Reuse the existing 24h unsaved-recommendation cleanup job for discard-if-abandoned — no new cleanup mechanism needed.

**Tech Stack:** Vercel serverless functions (Node, ESM), PostgreSQL (Neon) via `pg`, React 19 + React Router v7.

**Spec:** `docs/superpowers/specs/2026-08-21-anon-recommendations-design.md`

## Global Constraints

- No automated test suite exists in this repo — verification is manual, via `npm run dev` + `curl`/browser, matching the project's existing `scripts/`-based validation approach (see `CLAUDE.md`).
- Preferences stay login-only. Anonymous recommendation generation always passes `preferences = null` to the LLM (already a supported path).
- Saved scans (`/api/saved`) stay login-only — unaffected by this plan.
- UUID validation regex used throughout this codebase for `device_id`/`scan_id` (non-v4-strict form used in `generate-recommendations.js` and `recommendations/[scanId].js`): `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`. The v4-strict form used in `auth/signup.js`/`auth/login.js`/`scan/[scanId].js`: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`. Match whichever form the file you're editing already uses — don't unify them, that's out of scope.
- The known test device_id used elsewhere in this repo's scripts (`scripts/test-upload.js`) is `361ae423-0fc4-41e4-8bc9-465552e7abf0` — reuse it for manual verification so results are easy to distinguish from real traffic.

---

### Task 1: Database schema — dual identity on `recommendations`

**Files:**
- Modify: `scripts/setup-database.js:92-99`

**Interfaces:**
- Produces: `recommendations` table with nullable `user_id`, new nullable `device_id UUID REFERENCES anon_sessions(device_id)`, and a CHECK constraint requiring exactly one of the two to be set. All later tasks that INSERT/SELECT/UPDATE this table depend on this shape.

- [ ] **Step 1: Edit the `recommendations` table definition**

Replace lines 91-99 of `scripts/setup-database.js`:

```js
    await client.query(`
      CREATE TABLE recommendations (
        recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scan_id UUID NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        book_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        saved BOOLEAN DEFAULT FALSE
      );
    `);
```

with:

```js
    await client.query(`
      CREATE TABLE recommendations (
        recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scan_id UUID NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        device_id UUID REFERENCES anon_sessions(device_id) ON DELETE CASCADE,
        book_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        saved BOOLEAN DEFAULT FALSE,
        CHECK (
          (user_id IS NOT NULL AND device_id IS NULL) OR
          (user_id IS NULL AND device_id IS NOT NULL)
        )
      );
    `);
```

- [ ] **Step 2: Apply the schema**

Run: `npm run db:setup`
Expected: console output ends with `Created tables:` listing `recommendations` among others, no errors.

- [ ] **Step 3: Verify the new column and constraint**

Run:

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query(\"SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'recommendations' ORDER BY ordinal_position\")
  .then(r => { console.log(r.rows); return pool.end(); });
"
```

Expected: rows include `{ column_name: 'user_id', is_nullable: 'YES' }` and `{ column_name: 'device_id', is_nullable: 'YES' }`.

- [ ] **Step 4: Commit**

```bash
git add scripts/setup-database.js
git commit -m "Add device_id to recommendations table for anon support"
```

---

### Task 2: `api/generate-recommendations.js` — dual identity

**Files:**
- Modify: `api/generate-recommendations.js` (full-file replacement)

**Interfaces:**
- Consumes: `getCurrentUser(req)` from `lib/auth.js` (returns `{ id, email } | null`), `recommendations` table shape from Task 1.
- Produces: `POST /api/generate-recommendations` accepts `{ scan_id, device_id? }`. `device_id` is required in the body when there is no session cookie; ignored when there is one. Response shape unchanged from before.

- [ ] **Step 1: Replace the file**

Replace the entire contents of `api/generate-recommendations.js` with:

```js
/**
 * generate-recommendations.js
 *
 * POST /api/generate-recommendations
 *
 * Purpose:
 * Generates personalized book recommendations for a given scan. This is called
 * from the frontend when the user navigates to the recommendations page.
 *
 * Full pipeline:
 * 1. Resolve identity: logged-in user (cookie) or anonymous device_id (body)
 * 2. Check if recommendations already exist for this scan, owned by this identity
 * 3. Fetch the scan data from the database (recognized books), owned by this identity
 * 4. Enrich recognized books with cached metadata (covers, categories, descriptions)
 *    — needed because the LLM uses descriptions + categories for better recommendations
 * 4.5. Fetch user preferences from the preferences table (logged-in users only)
 *    — genres, authors, language, reading level are injected into the LLM prompt
 * 5. Call the recommendation LLM (Groq) with the enriched book list + preferences
 * 6. Enrich the RECOMMENDED books with Google Books (covers, ISBN, etc.)
 *    — so the frontend can display real covers for recommendations too
 * 7. Store everything in the recommendations table (one row per scan)
 * 8. Return the recommendations to the frontend
 *
 * Side effects:
 * - Populates book_cache with metadata for recommended books (via enrichBooks)
 * - Cleans up unsaved recommendations older than 24 hours (via cleanupOldRecommendations)
 *   — this is what discards anonymous recommendations that are never claimed by
 *   signing up or logging in.
 *
 * Dependencies:
 * - database.js: PostgreSQL queries
 * - recommendationAI.js: LLM call
 * - googleBooks.js: Cover/metadata enrichment + cache
 * - uuid: Generating recommendation_id
 */

import { query } from "../lib/database.js";
import { generateRecommendations } from "../lib/recommendationAI.js";
import { enrichBooks } from "../lib/googleBooks.js";
import { v4 as uuidv4 } from "uuid";
import { checkLimit, incrementUsage } from "../lib/usageTracking.js";
import { getCurrentUser } from "../lib/auth.js";

const deviceIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Why export default: Vercel requires default exports to detect handlers.
 * @param {Object} req - HTTP request object (Vercel)
 * @param {Object} res - HTTP response object (Vercel)
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use POST.",
    });
  }

  try {
    // ---- Step 1: Resolve identity ----
    // Logged-in user via session cookie takes priority. If there's no session,
    // fall back to the anonymous device_id supplied in the body (same dual-identity
    // pattern used by api/scan/[scanId].js and api/upload-image.js).
    const user = await getCurrentUser(req);
    const { scan_id, device_id } = req.body;

    if (!user && (!device_id || !deviceIdRegex.test(device_id))) {
      return res.status(400).json({
        success: false,
        error: "device_id is required when not logged in",
      });
    }

    const ownerUserId = user ? user.id : null;
    const ownerDeviceId = user ? null : device_id;

    if (!scan_id) {
      return res.status(400).json({ success: false, error: "scan_id is required" });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(scan_id)) {
      return res.status(400).json({ success: false, error: "Invalid scan_id format (must be UUID)" });
    }

    console.log(`[generate-recommendations] Starting for scan ${scan_id}`);

    // ---- Step 2: Check if recommendations already exist for this scan ----
    // Prevents duplicate generation if the user refreshes or navigates back.
    // Filtered by identity so a scan_id alone can't be used to read someone
    // else's stored recommendations.
    const existingResult = await query(
      `SELECT recommendation_id, book_data FROM recommendations
       WHERE scan_id = $1 AND (user_id = $2 OR device_id = $3)`,
      [scan_id, ownerUserId, ownerDeviceId],
    );

    if (existingResult.rows.length > 0) {
      console.log(
        `[generate-recommendations] Recommendations already exist for scan ${scan_id}`,
      );
      return res.status(200).json({
        success: true,
        already_existed: true,
        recommendations: existingResult.rows[0].book_data,
      });
    }

    // ---- Step 3: Fetch the scan data ----
    const scanResult = await query(
      "SELECT recognized_books FROM scans WHERE scan_id = $1 AND (user_id = $2 OR device_id = $3)",
      [scan_id, ownerUserId, ownerDeviceId],
    );

    if (scanResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Scan not found" });
    }

    const scan = scanResult.rows[0];

    // Extract the books array from the JSONB column.
    // The scans table stores raw AI output as: { books: [...], metadata: {...} }
    const recognizedBooks = scan.recognized_books?.books || [];

    if (recognizedBooks.length === 0) {
      return res.status(400).json({
        success: false,
        error:
          "No recognized books in this scan. Cannot generate recommendations.",
      });
    }

    // ---- Step 4: Enrich recognized books with cached metadata ----
    // The LLM needs descriptions and categories to make good recommendations.
    // These are stored in book_cache (populated during upload).
    // We join them here the same way the scan endpoint does.
    const enrichedRecognizedBooks = await enrichBooksFromCache(recognizedBooks);

    console.log(
      "[generate-recommendations] Enriched recognized books with cache data",
    );

    console.log(
      `[generate-recommendations] Found ${recognizedBooks.length} recognized books`,
    );

    // ---- Step 4.5: Fetch user preferences (logged-in users only) ----
    // Preferences are keyed by user_id — anonymous requests have none, so we
    // skip straight to preferences = null and the LLM works with just the
    // bookshelf (same behavior as before preferences existed).
    let preferences = null;

    if (user) {
      try {
        const prefResult = await query(
          "SELECT genres, authors, language, reading_level FROM preferences WHERE user_id = $1",
          [user.id],
        );

        if (prefResult.rows.length > 0) {
          // User has saved preferences — pass them to the LLM
          preferences = {
            genres: prefResult.rows[0].genres || [],
            authors: prefResult.rows[0].authors || [],
            language: prefResult.rows[0].language || "",
            reading_level: prefResult.rows[0].reading_level || "",
          };
          console.log(
            `[generate-recommendations] Found user preferences: ` +
              `${preferences.genres.length} genres, ` +
              `${preferences.authors.length} authors, ` +
              `language="${preferences.language}", ` +
              `level="${preferences.reading_level}"`,
          );
        } else {
          console.log(
            "[generate-recommendations] No user preferences found (using bookshelf only)",
          );
        }
      } catch (prefError) {
        // If preferences fetch fails, continue without them.
        // The LLM can still generate good recommendations from just the bookshelf.
        // This is a graceful degradation — preferences are an enhancement, not a requirement.
        console.error(
          `[generate-recommendations] Failed to fetch preferences (non-blocking): ${prefError.message}`,
        );
      }
    } else {
      console.log(
        "[generate-recommendations] Anonymous request — skipping preferences",
      );
    }

    // ---- Step 5: Call the recommendation LLM ----
    console.log(
      "[generate-recommendations] Calling LLM for recommendations...",
    );

    // Check Groq text daily limit before calling LLM.
    const textLimit = await checkLimit("groq_text");
    if (textLimit.limited) {
      console.log(
        `[generate-recommendations] Groq text daily limit reached (${textLimit.count}). Blocking.`,
      );
      return res.status(429).json({
        success: false,
        error: textLimit.reason,
      });
    }

    const llmResult = await generateRecommendations(
      enrichedRecognizedBooks,
      preferences,
    );

    if (llmResult.recommendations.length === 0) {
      return res.status(500).json({
        success: false,
        error:
          "Failed to generate recommendations. The AI did not return valid results.",
      });
    }

    console.log(
      `[generate-recommendations] LLM returned ${llmResult.recommendations.length} recommendations`,
    );

    // Increment Groq text usage counter on success.
    await incrementUsage("groq_text");

    // ---- Step 6: Enrich recommended books with Google Books ----
    // This populates book_cache with covers, ISBNs, descriptions for the
    // recommended books, so the frontend can display real covers.
    // enrichBooks() is the same function used during upload.
    // It handles cache hits/misses internally.
    console.log(
      "[generate-recommendations] Enriching recommendations with Google Books...",
    );
    const enrichedRecommendations = await enrichBooks(
      llmResult.recommendations,
    );

    console.log(`[generate-recommendations] Enrichment complete`);

    // ---- Step 7: Build the final data object to store ----
    // We store everything needed to render the recommendations page in one JSONB column.
    // This means the GET endpoint can return it directly without joins.
    const bookData = {
      recommendations: enrichedRecommendations,
      metadata: llmResult.metadata,
    };

    // ---- Step 8: Insert into the recommendations table ----
    // Uses a UUID primary key generated here (not auto-increment).
    // ON CONFLICT is not needed because we already checked for existing recommendations
    // in Step 2, but we add it for safety against race conditions (two concurrent requests for the same scan).
    const recommendationId = uuidv4();

    await query(
      `INSERT INTO recommendations (recommendation_id, user_id, device_id, scan_id, book_data, saved)
        VALUES ($1, $2, $3, $4, $5, FALSE)
        ON CONFLICT (scan_id) DO UPDATE SET book_data = $5`,
      [recommendationId, ownerUserId, ownerDeviceId, scan_id, JSON.stringify(bookData)],
    );

    console.log(
      `[generate-recommendations] Stored recommendations with ID ${recommendationId}`,
    );

    // ---- Step 9: Trigger cleanup of old unsaved recommendations ----
    // This runs as a fire-and-forget side effect. We don't await it because
    // we don't want cleanup failures to block the response to the user.
    // The .catch() ensures any errors are logged but don't crash the handler.
    // This same cleanup is what discards anonymous recommendations that are
    // never claimed within 24 hours.
    cleanupOldRecommendations().catch((err) => {
      console.error(
        `[generate-recommendations] Cleanup error (non-blocking): ${err.message}`,
      );
    });

    // ---- Step 10: Return the recommendations ----
    return res.status(200).json({
      success: true,
      already_existed: false,
      recommendations: bookData,
    });
  } catch (error) {
    console.error(`[generate-recommendations] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: "Failed to generate recommendations. Please try again.",
    });
  }
}

// ============================================================================
// HELPER: Enrich books from cache (same pattern as [scanId].js)
// ============================================================================

/**
 * Joins book_cache metadata into recognized books for LLM context.
 *
 * This is the same logic used by api/scan/[scanId].js to enrich scan results.
 * We duplicate it here rather than importing from [scanId].js because:
 * - [scanId].js is an API handler, not a library (export default function)
 * - Extracting shared logic into a library would be a refactor for later
 *
 * @param {Array<Object>} books - Raw recognized books from scans table
 * @returns {Array<Object>} Books enriched with cache data (categories, description, etc.)
 */
async function enrichBooksFromCache(books) {
  // Process each book sequentially (simple, and we're only doing ~5-15 books)
  for (const book of books) {
    // Lowercase for case-insensitive cache lookup.
    // This matches the book_cache table's title_lower + author_lower index.
    const titleLower = (book.title || "").toLowerCase().trim();
    const authorLower = (book.author || "").toLowerCase().trim();

    try {
      const cacheResult = await query(
        `SELECT isbn, cover_url, description, categories
         FROM book_cache
         WHERE title_lower = $1 AND COALESCE(author_lower, '') = $2`,
        [titleLower, authorLower],
      );

      if (cacheResult.rows.length > 0) {
        // Cache hit: merge the cached fields into the book object
        const cached = cacheResult.rows[0];
        book.isbn = cached.isbn || null;
        book.cover_url = cached.cover_url || null;
        book.description = cached.description || null;
        book.categories = cached.categories || [];
        book.enriched = true;
      } else {
        // Cache miss: mark as not enriched so the LLM knows this book
        // has less context available
        book.enriched = false;
      }
    } catch (error) {
      // If cache lookup fails for one book, continue with the rest.
      // The LLM can still work with title + author alone.
      console.error(
        `[generate-recommendations] Cache lookup failed for "${book.title}": ${error.message}`,
      );
      book.enriched = false;
    }
  }

  return books;
}

// ============================================================================
// HELPER: Cleanup old unsaved recommendations
// ============================================================================

/**
 * Deletes recommendations that are:
 * - NOT saved by the user (saved = FALSE)
 * - Older than 24 hours (created_at < NOW() - INTERVAL '24 hours')
 *
 * Why this approach:
 * - Runs as a side effect on each POST, not a cron job (serverless-friendly)
 * - Only deletes unsaved recommendations (saved ones persist forever)
 * - 24-hour window gives users time to come back and save
 * - The column is named created_at (not created_at) — matching the existing schema
 * - Applies regardless of user_id vs device_id ownership, so this is also
 *   what discards anonymous recommendations nobody ever claimed.
 *
 * Note: A separate npm script (cleanup-recommendations.js) also exists
 * for manual cleanup if needed.
 *
 * @returns {number} Number of rows deleted
 */
async function cleanupOldRecommendations() {
  const result = await query(
    `DELETE FROM recommendations
     WHERE saved = FALSE
     AND created_at < NOW() - INTERVAL '24 hours'`,
  );

  const deletedCount = result.rowCount || 0;
  if (deletedCount > 0) {
    console.log(
      `[generate-recommendations] Cleaned up ${deletedCount} old unsaved recommendations`,
    );
  }

  return deletedCount;
}
```

- [ ] **Step 2: Verify anonymous generation end-to-end**

Prerequisite: `npm run dev` is running in another terminal, and `USE_MOCK_AI=true` is set in `.env.local` (avoids a real vision-API call; the recommendation LLM call itself has no mock and will always be real).

Create an anonymous scan:

```bash
curl -s -X POST http://localhost:3000/api/upload-image \
  -F "image=@test-image.jpg" \
  -F "device_id=361ae423-0fc4-41e4-8bc9-465552e7abf0" | node -e "
let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ const j=JSON.parse(d); console.log('scan_id:', j.scan_id); });
"
```

Note the printed `scan_id`, then generate recommendations for it anonymously:

```bash
curl -s -X POST http://localhost:3000/api/generate-recommendations \
  -H "Content-Type: application/json" \
  -d '{"scan_id":"<scan_id from above>","device_id":"361ae423-0fc4-41e4-8bc9-465552e7abf0"}'
```

Expected: HTTP 200, `"success": true`, a non-empty `recommendations.recommendations` array.

Run the same command with no `device_id` and no cookie:

```bash
curl -s -X POST http://localhost:3000/api/generate-recommendations \
  -H "Content-Type: application/json" \
  -d '{"scan_id":"<scan_id from above>"}'
```

Expected: HTTP 400, `{"success":false,"error":"device_id is required when not logged in"}`.

- [ ] **Step 3: Verify the stored row has device_id set, not user_id**

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query(\"SELECT user_id, device_id FROM recommendations WHERE scan_id = \$1\", ['<scan_id from above>'])
  .then(r => { console.log(r.rows); return pool.end(); });
"
```

Expected: one row with `user_id: null` and `device_id: '361ae423-0fc4-41e4-8bc9-465552e7abf0'`.

- [ ] **Step 4: Verify the 24h cleanup job discards abandoned anon recommendations**

The cleanup logic itself is unchanged (`cleanupOldRecommendations()` already ignores which of `user_id`/`device_id` is set) — this step just confirms it actually reaches anon rows now that they can exist. Backdate the row created in Step 2/3 so it looks older than 24 hours, then run the cleanup script:

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query(\"UPDATE recommendations SET created_at = NOW() - INTERVAL '25 hours' WHERE scan_id = \$1\", ['<scan_id from Step 2>'])
  .then(() => pool.end());
"
npm run db:cleanup-recommendations
```

Expected: the cleanup script output reports at least 1 deleted row. Confirm the row is gone:

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query('SELECT * FROM recommendations WHERE scan_id = \$1', ['<scan_id from Step 2>'])
  .then(r => { console.log('rows remaining:', r.rows.length); return pool.end(); });
"
```

Expected: `rows remaining: 0`.

- [ ] **Step 5: Commit**

```bash
git add api/generate-recommendations.js
git commit -m "Allow anonymous recommendation generation, scoped by device_id"
```

---

### Task 3: `api/recommendations/[scanId].js` — dual identity GET

**Files:**
- Modify: `api/recommendations/[scanId].js` (full-file replacement)

**Interfaces:**
- Consumes: `getCurrentUser(req)` from `lib/auth.js`; `recommendations` table shape from Task 1.
- Produces: `GET /api/recommendations/:scanId` accepts an optional `?device_id=` query param, required when there is no session cookie.

- [ ] **Step 1: Replace the file**

Replace the entire contents of `api/recommendations/[scanId].js` with:

```js
/**
 * [scanId].js
 *
 * GET /api/recommendations/:scanId
 *
 * Purpose:
 * Fetches existing recommendations for a given scan. This is called by the
 * frontend BEFORE triggering generation — if recommendations already exist,
 * there's no need to call the LLM again.
 *
 * Flow:
 * 1. Resolve identity: logged-in user (cookie) or anonymous device_id (query param)
 * 2. Validate the scanId parameter
 * 3. Query the recommendations table for this scan_id, owned by this identity
 * 4. If found, return the stored book_data (enriched recommendations + metadata)
 * 5. If not found, return a 404 so the frontend knows to trigger generation
 *
 * Why this is separate from generate-recommendations.js:
 * - GET vs POST: Fetching is a read operation, generating is a write operation
 * - The frontend first does GET (fast, no LLM call) to check for existing data
 * - Only if GET returns 404 does the frontend POST to generate new recommendations
 * - This prevents redundant LLM calls on page revisits
 *
 * File naming:
 * Uses Vercel's bracket notation [scanId].js for dynamic routing.
 * The parameter is accessed via req.query.scanId.
 *
 * Dependencies:
 * - database.js: PostgreSQL queries
 */

import { query } from "../../lib/database.js";
import { getCurrentUser } from "../../lib/auth.js";

const deviceIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use GET.",
    });
  }

  try {
    // ---- Step 1: Resolve identity ----
    const user = await getCurrentUser(req);
    const { scanId, device_id } = req.query;

    if (!user && (!device_id || !deviceIdRegex.test(device_id))) {
      return res.status(400).json({
        success: false,
        error: "device_id is required when not logged in",
      });
    }

    const ownerUserId = user ? user.id : null;
    const ownerDeviceId = user ? null : device_id;

    // ---- Step 2: Extract and validate the scanId parameter ----
    if (!scanId) {
      return res.status(400).json({
        success: false,
        error: "scanId parameter is required",
      });
    }

    // Validate UUID format to prevent malformed queries.
    // Same regex pattern used across all API endpoints in this project.
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(scanId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid scanId format (must be UUID v4)",
      });
    }

    console.log(
      `[recommendations] Fetching recommendations for scan ${scanId}`,
    );

    // ---- Step 3: Query the recommendations table ----
    // We select book_data (JSONB with recommendations + metadata),
    // saved status (for future use), and creation timestamp.
    // Filtered by identity so a scanId alone can't be used to read
    // someone else's stored recommendations.
    const result = await query(
      `SELECT recommendation_id, book_data, saved, created_at
        FROM recommendations
        WHERE scan_id = $1 AND (user_id = $2 OR device_id = $3)`,
      [scanId, ownerUserId, ownerDeviceId],
    );

    // ---- Step 4: Handle not found ----
    // 404 tells the frontend "no recommendations exist yet, you need to generate them"
    if (result.rows.length === 0) {
      console.log(
        `[recommendations] No recommendations found for scan ${scanId}`,
      );
      return res.status(404).json({
        success: false,
        error: "No recommendations found for this scan",
      });
    }

    // ---- Step 5: Return the existing recommendations ----
    const row = result.rows[0];

    // Enrich each recommendation with fresh cache data (covers, descriptions).
    // This ensures that if the cache was populated AFTER the recommendation was stored,
    // the user still sees covers.
    const bookData = row.book_data;
    if (bookData?.recommendations) {
      await enrichRecommendationsFromCache(bookData.recommendations);
    }
    console.log(`[recommendations] Found recommendations for scan ${scanId}`);

    return res.status(200).json({
      success: true,
      recommendations: bookData,
      saved: row.saved,
      created_at: row.created_at,
    });
  } catch (error) {
    console.error(`[recommendations] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch recommendations",
    });
  }
}

/**
 * Enriches recommendation books with data from book_cache.
 * 
 * This is called at read time (same architecture as the scan endpoint).
 * The recommendations table stores the raw LLM output + whatever enrichment
 * was available at generation time. But if a book's cache entry was updated
 * later (e.g., by another scan), this ensures we always show the latest.
 * 
 * Mutates the books array in place (adds cover_url, isbn, description,
 * categories, enriched fields).
 * 
 * @param {Array<Object>} recommendations - Array of recommendation objects
 */
async function enrichRecommendationsFromCache(recommendations) {
  for (const rec of recommendations) {
    const titleLower = (rec.title || '').toLowerCase().trim()
    const authorLower = (rec.author || '').toLowerCase().trim()

    try {
      const cacheResult = await query(
        `SELECT isbn, cover_url, description, categories
         FROM book_cache
         WHERE title_lower = $1 AND COALESCE(author_lower, '') = $2`,
        [titleLower, authorLower]
      )

      if (cacheResult.rows.length > 0) {
        const cached = cacheResult.rows[0]
        rec.isbn = cached.isbn || null
        rec.cover_url = cached.cover_url || null
        rec.description = cached.description || null
        rec.categories = cached.categories || []
        rec.enriched = true
      } else {
        // No cache entry exists for this recommended book.
        // This can happen if Google Books didn't have data for it,
        // or if the enrichment step failed during generation.
        rec.enriched = false
      }
    } catch (error) {
      console.error(`[recommendations] Cache enrichment failed for "${rec.title}": ${error.message}`)
      rec.enriched = false
    }
  }
}
```

- [ ] **Step 2: Verify anonymous GET end-to-end**

Prerequisite: `npm run dev` running, `USE_MOCK_AI=true`.

Create an anonymous scan and generate recommendations for it (self-contained repeat of Task 2's verification, so this task is independently testable):

```bash
SCAN_ID=$(curl -s -X POST http://localhost:3000/api/upload-image \
  -F "image=@test-image.jpg" \
  -F "device_id=361ae423-0fc4-41e4-8bc9-465552e7abf0" | node -e "
let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ console.log(JSON.parse(d).scan_id); });
")
echo "scan_id: $SCAN_ID"

curl -s -X POST http://localhost:3000/api/generate-recommendations \
  -H "Content-Type: application/json" \
  -d "{\"scan_id\":\"$SCAN_ID\",\"device_id\":\"361ae423-0fc4-41e4-8bc9-465552e7abf0\"}" > /dev/null
```

Then GET it back:

```bash
curl -s "http://localhost:3000/api/recommendations/$SCAN_ID?device_id=361ae423-0fc4-41e4-8bc9-465552e7abf0"
```

Expected: HTTP 200, `"success": true`, the same recommendations from generation.

Then GET it with a different (wrong) device_id:

```bash
curl -s "http://localhost:3000/api/recommendations/$SCAN_ID?device_id=00000000-0000-0000-0000-000000000000"
```

Expected: HTTP 404, `{"success":false,"error":"No recommendations found for this scan"}` (ownership filter correctly excludes it).

- [ ] **Step 3: Commit**

```bash
git add api/recommendations/\[scanId\].js
git commit -m "Allow anonymous recommendation lookup via device_id query param"
```

---

### Task 4: Claim recommendations alongside scans on signup/login

**Files:**
- Modify: `api/auth/signup.js`
- Modify: `api/auth/login.js`

**Interfaces:**
- Consumes: `recommendations` table shape from Task 1 (`scan_id`, `user_id`, `device_id`).
- Produces: after a successful claim, the recommendation row for `claimed_scan_id` (if any) has `user_id` set and `device_id` NULL — same shape the frontend already expects for logged-in recommendations.

- [ ] **Step 1: Update the claim block in `api/auth/signup.js`**

Find this block (inside the `try`, after `createSession`):

```js
    let claimed_scan_id = null
    if (device_id && UUID_REGEX.test(device_id)) {
      const claimResult = await query(
        `UPDATE scans SET user_id = $1, device_id = NULL
         WHERE scan_id = (
           SELECT scan_id FROM scans
           WHERE device_id = $2 AND user_id IS NULL
           ORDER BY scan_date DESC
           LIMIT 1
         )
         RETURNING scan_id`,
        [user.id, device_id]
      )
      if (claimResult.rows.length > 0) {
        claimed_scan_id = claimResult.rows[0].scan_id
      }
    }
```

Replace it with:

```js
    let claimed_scan_id = null
    if (device_id && UUID_REGEX.test(device_id)) {
      const claimResult = await query(
        `UPDATE scans SET user_id = $1, device_id = NULL
         WHERE scan_id = (
           SELECT scan_id FROM scans
           WHERE device_id = $2 AND user_id IS NULL
           ORDER BY scan_date DESC
           LIMIT 1
         )
         RETURNING scan_id`,
        [user.id, device_id]
      )
      if (claimResult.rows.length > 0) {
        claimed_scan_id = claimResult.rows[0].scan_id
        // The claimed scan may have an anonymous recommendation attached to it.
        // Move it into the new account too, so recommendations generated before
        // signing up aren't lost.
        await query(
          `UPDATE recommendations SET user_id = $1, device_id = NULL
           WHERE scan_id = $2 AND device_id IS NOT NULL`,
          [user.id, claimed_scan_id]
        )
      }
    }
```

- [ ] **Step 2: Update the identical claim block in `api/auth/login.js`**

`api/auth/login.js` has the exact same claim block. Find:

```js
    let claimed_scan_id = null
    if (device_id && UUID_REGEX.test(device_id)) {
      const claimResult = await query(
        `UPDATE scans SET user_id = $1, device_id = NULL
         WHERE scan_id = (
           SELECT scan_id FROM scans
           WHERE device_id = $2 AND user_id IS NULL
           ORDER BY scan_date DESC
           LIMIT 1
         )
         RETURNING scan_id`,
        [user.id, device_id]
      )
      if (claimResult.rows.length > 0) {
        claimed_scan_id = claimResult.rows[0].scan_id
      }
    }
```

Replace it with:

```js
    let claimed_scan_id = null
    if (device_id && UUID_REGEX.test(device_id)) {
      const claimResult = await query(
        `UPDATE scans SET user_id = $1, device_id = NULL
         WHERE scan_id = (
           SELECT scan_id FROM scans
           WHERE device_id = $2 AND user_id IS NULL
           ORDER BY scan_date DESC
           LIMIT 1
         )
         RETURNING scan_id`,
        [user.id, device_id]
      )
      if (claimResult.rows.length > 0) {
        claimed_scan_id = claimResult.rows[0].scan_id
        // The claimed scan may have an anonymous recommendation attached to it.
        // Move it into the account too, so recommendations generated before
        // logging in aren't lost.
        await query(
          `UPDATE recommendations SET user_id = $1, device_id = NULL
           WHERE scan_id = $2 AND device_id IS NOT NULL`,
          [user.id, claimed_scan_id]
        )
      }
    }
```

- [ ] **Step 3: Verify claim-on-signup end-to-end**

Prerequisite: `npm run dev` running, `USE_MOCK_AI=true`.

Create an anonymous scan + recommendation with a fresh device_id (use a throwaway UUID so this doesn't collide with earlier verification runs):

```bash
DEVICE_ID="$(node -e "console.log(require('crypto').randomUUID())")"
SCAN_ID=$(curl -s -X POST http://localhost:3000/api/upload-image \
  -F "image=@test-image.jpg" \
  -F "device_id=$DEVICE_ID" | node -e "
let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ console.log(JSON.parse(d).scan_id); });
")
curl -s -X POST http://localhost:3000/api/generate-recommendations \
  -H "Content-Type: application/json" \
  -d "{\"scan_id\":\"$SCAN_ID\",\"device_id\":\"$DEVICE_ID\"}" > /dev/null
echo "scan_id=$SCAN_ID device_id=$DEVICE_ID"
```

Sign up with that device_id:

```bash
EMAIL="anon-claim-test-$(date +%s 2>/dev/null || echo 1)@example.com"
curl -s -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"testpassword123\",\"device_id\":\"$DEVICE_ID\"}"
```

Expected: HTTP 201, `"claimed_scan_id"` equals `$SCAN_ID`.

Verify the recommendation row was claimed too:

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query('SELECT user_id, device_id FROM recommendations WHERE scan_id = \$1', ['$SCAN_ID'])
  .then(r => { console.log(r.rows); return pool.end(); });
"
```

Expected: one row with `device_id: null` and `user_id` set to a non-null UUID.

- [ ] **Step 4: Verify claim-on-login end-to-end**

Repeat Step 3's scan+recommendation setup with a new throwaway device_id, but this time log in as an *existing* user (e.g. the one just created in Step 3) instead of signing up:

```bash
DEVICE_ID2="$(node -e "console.log(require('crypto').randomUUID())")"
SCAN_ID2=$(curl -s -X POST http://localhost:3000/api/upload-image \
  -F "image=@test-image.jpg" \
  -F "device_id=$DEVICE_ID2" | node -e "
let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ console.log(JSON.parse(d).scan_id); });
")
curl -s -X POST http://localhost:3000/api/generate-recommendations \
  -H "Content-Type: application/json" \
  -d "{\"scan_id\":\"$SCAN_ID2\",\"device_id\":\"$DEVICE_ID2\"}" > /dev/null

curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"testpassword123\",\"device_id\":\"$DEVICE_ID2\"}"
```

Expected: HTTP 200, `"claimed_scan_id"` equals `$SCAN_ID2`. Then re-run the same DB check as Step 3 against `$SCAN_ID2` — expect the same result (`device_id: null`, `user_id` set).

- [ ] **Step 5: Commit**

```bash
git add api/auth/signup.js api/auth/login.js
git commit -m "Claim anonymous recommendations alongside their scan on signup/login"
```

---

### Task 5: `src/pages/Recommendations.jsx` — anonymous access

**Files:**
- Modify: `src/pages/Recommendations.jsx` (full-file replacement)

**Interfaces:**
- Consumes: `useAuth()` from `src/contexts/AuthContext` (`{ user, loading }`); `useSearchParams()` from `react-router-dom` for the `device_id` query param (matches the pattern `src/pages/Results.jsx` already uses for scan ownership); the `device_id` query param is supplied by the link built in Task 6.
- Produces: page renders and fetches for anonymous visitors when a valid `?device_id=` is present in the URL; no longer imports or renders `LoginGate`.

- [ ] **Step 1: Replace the file**

Replace the entire contents of `src/pages/Recommendations.jsx` with:

```jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import RecommendationCard from "../components/RecommendationCard";
import SkeletonCard from "../components/SkeletonCard";

export default function Recommendations() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const deviceId = searchParams.get("device_id");

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRecommendations(null);
    setSaved(null);
    setRetryCount((prev) => prev + 1);
  };

  useEffect(() => {
    if (authLoading) return;

    async function loadRecommendations() {
      try {
        setLoading(true);
        setError(null);

        const anon = !user && deviceId;

        const getUrl = anon
          ? `/api/recommendations/${scanId}?device_id=${deviceId}`
          : `/api/recommendations/${scanId}`;

        const getResponse = await fetch(getUrl, {
          credentials: "include",
        });

        if (getResponse.ok) {
          const getData = await getResponse.json();
          setRecommendations(getData.recommendations);
          setSaved(getData.saved || false);
          setLoading(false);
          return;
        }

        if (getResponse.status !== 404) {
          const errorData = await getResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `Server error: ${getResponse.status}`);
        }

        setLoading(false);
        setGenerating(true);

        const postResponse = await fetch("/api/generate-recommendations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            anon ? { scan_id: scanId, device_id: deviceId } : { scan_id: scanId },
          ),
        });

        if (!postResponse.ok) {
          const errorData = await postResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `Generation failed: ${postResponse.status}`);
        }

        const postData = await postResponse.json();
        setRecommendations(postData.recommendations);
        setGenerating(false);
        setSaved(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
        setGenerating(false);
      }
    }

    loadRecommendations();
  }, [scanId, deviceId, user, authLoading, retryCount]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/saved", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan_id: scanId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Save failed: ${response.status}`);
      }

      setSaved(true);
    } catch {
      // save failed silently — recommendations still visible
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch("/api/saved", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan_ids: [scanId] }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Delete failed: ${response.status}`);
      }

      navigate("/saved");
    } catch {
      setShowDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-bg-surface border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const books = recommendations?.recommendations || [];
  const metadata = recommendations?.metadata || {};

  return (
    <div>
      {/* Header */}
      <div className="glass-card px-6 py-5 mb-8">
        <button
          onClick={() => navigate(`/results/${scanId}`)}
          className="flex items-center text-text-muted hover:text-accent transition-colors mb-3 text-sm"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Scan Results
        </button>
        <h1 className="font-display text-3xl font-semibold text-text-primary">Your Recommendations</h1>
        <p className="text-text-secondary text-sm mt-1">Personalized picks based on your bookshelf</p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full border-4 border-bg-surface border-t-accent animate-spin" />
          <h2 className="text-xl font-semibold text-text-primary mt-6">Generating Recommendations...</h2>
          <p className="text-text-secondary mt-2 text-center max-w-md text-sm">
            Our AI is analyzing your bookshelf and finding personalized picks.
            This usually takes 10–30 seconds.
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-danger-muted rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text-primary">Something went wrong</h2>
          <p className="text-text-secondary mt-2 text-center max-w-md text-sm">{error}</p>
          <div className="flex gap-4 mt-6">
            <button
              onClick={handleRetry}
              className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate(`/results/${scanId}`)}
              className="px-6 py-2 bg-bg-surface text-text-secondary border border-border hover:border-border-accent rounded-lg transition-all"
            >
              Back to Results
            </button>
          </div>
        </div>
      )}

      {/* Success state */}
      {!loading && !generating && !error && books.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className="text-text-secondary text-sm">
              {books.length} recommendation{books.length !== 1 ? "s" : ""}{" "}
              based on {metadata.prompt_books_count || "your"} book
              {(metadata.prompt_books_count || 0) !== 1 ? "s" : ""}
            </p>
            {metadata.processing_time_ms && (
              <p className="text-text-muted text-xs">
                Generated in {(metadata.processing_time_ms / 1000).toFixed(1)}s
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {books.map((book, index) => (
              <div key={`${book.title}-${index}`} style={{ animationDelay: `${index * 80}ms` }}>
                <RecommendationCard book={book} />
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {user && saved === false && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    Save Recommendations
                  </>
                )}
              </button>
            )}
            {user && saved === true && (
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="flex items-center gap-2 px-6 py-2 bg-danger text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Remove from Saved
              </button>
            )}
            <button
              onClick={() => navigate(`/results/${scanId}`)}
              className="px-6 py-2 bg-bg-surface text-text-secondary border border-border hover:border-border-accent hover:text-text-primary rounded-lg transition-all"
            >
              Back to Scan Results
            </button>
          </div>

          {!user && (
            <div className="mt-8 glass-card p-6 border border-accent/20 text-center max-w-xl mx-auto">
              <p className="text-xs tracking-widest uppercase text-accent mb-2">Save your results</p>
              <h2 className="font-display text-xl font-semibold text-text-primary mb-2">
                Create an account to save these recommendations
              </h2>
              <p className="text-text-secondary text-sm mb-5">
                Sign up now and this scan plus its recommendations move straight into your new account.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => navigate("/signup")}
                  className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium text-sm"
                >
                  Create account
                </button>
                <button
                  onClick={() => navigate("/login")}
                  className="px-6 py-2 bg-bg-surface text-text-secondary border border-border hover:border-border-accent hover:text-text-primary rounded-lg transition-all text-sm"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !generating && !error && books.length === 0 && recommendations !== null && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-bg-surface rounded-full flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text-primary">No Recommendations Generated</h2>
          <p className="text-text-secondary mt-2 text-center max-w-md text-sm">
            The AI wasn't able to generate recommendations from your scan.
            Try scanning a clearer photo with more visible book spines.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-6 px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
          >
            Scan Another Bookshelf
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !deleting && setShowDeleteDialog(false)}
          />
          <div className="relative glass-card max-w-md w-full mx-4 p-6">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-danger-muted rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <h3 className="font-display text-lg font-semibold text-text-primary text-center">
              Permanently Delete This Scan?
            </h3>
            <p className="text-text-secondary text-sm text-center mt-3">
              This will permanently delete your scan data and all {books.length}{" "}
              recommendation{books.length !== 1 ? "s" : ""} associated with it.
              This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-bg-surface text-text-secondary border border-border rounded-lg hover:border-border-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-danger text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  "Yes, Delete Permanently"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: `LoginGate` is no longer imported or used by this file. Do **not** delete `src/components/LoginGate.jsx` itself — check other usages first (it's also used by `src/pages/Preferences.jsx` and `src/pages/Saved.jsx`, which stay login-gated and are out of scope for this plan).

- [ ] **Step 2: Verify in the browser**

Prerequisite: `npm run dev` running, `USE_MOCK_AI=true`, browser automation available via the `agent-browser` skill.

```bash
agent-browser open http://localhost:3000
```

Use the UI to upload `test-image.jpg` as an anonymous visitor (don't log in), then note the resulting `/results/:scanId?device_id=...` URL. Manually navigate to `/recommendations/:scanId?device_id=...` using that same scanId/device_id (Task 6 wires up the actual "View Recommendations" link — until that task is done, this task's UI is reachable only by typing the URL directly, which is enough to verify this task in isolation):

```bash
agent-browser open "http://localhost:3000/recommendations/<scanId>?device_id=<device_id>"
agent-browser snapshot -i
```

Expected: no login gate; a generating spinner, then a grid of recommendation cards; a "Create an account to save these recommendations" panel instead of a Save button.

Reload the same URL:

```bash
agent-browser open "http://localhost:3000/recommendations/<scanId>?device_id=<device_id>"
agent-browser snapshot -i
```

Expected: recommendations load immediately (GET hit, no regeneration spinner).

Now visit the page with no `device_id` and not logged in:

```bash
agent-browser open "http://localhost:3000/recommendations/<scanId>"
agent-browser snapshot -i
```

Expected: the error state ("Something went wrong" / `device_id is required when not logged in`) — not an infinite spinner.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Recommendations.jsx
git commit -m "Allow anonymous users to view/generate recommendations"
```

---

### Task 6: `src/pages/Results.jsx` — link to recommendations for anon users

**Files:**
- Modify: `src/pages/Results.jsx` (full-file replacement)

**Interfaces:**
- Consumes: `device_id` query param already read via `useSearchParams()`; the `/recommendations/:scanId?device_id=` route consumed by Task 5.
- Produces: anonymous visitors get a working "View Recommendations" link (previously only logged-in users did).

- [ ] **Step 1: Replace the file**

Replace the entire contents of `src/pages/Results.jsx` with:

```jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import BookCard from "../components/BookCard";
import SkeletonCard from "../components/SkeletonCard";
import { useAuth } from "../contexts/AuthContext";

function Results() {
  const { scanId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const deviceId = searchParams.get("device_id");

  const [scan, setScan] = useState(null);
  const [books, setBooks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("confidence");

  useEffect(() => {
    async function fetchScan() {
      try {
        setLoading(true);
        setError(null);

        const url = deviceId
          ? `/api/scan/${scanId}?device_id=${encodeURIComponent(deviceId)}`
          : `/api/scan/${scanId}`;

        const response = await fetch(url, { credentials: "include" });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.scan) {
          throw new Error("Invalid response format");
        }

        const scanData = data.scan;
        const booksData = scanData.recognized_books?.books || [];

        setScan(scanData);
        setBooks(booksData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchScan();
  }, [scanId, searchParams]);

  useEffect(() => {
    if (!books || books.length === 0) return;

    const sortedBooks = [...books];

    switch (sortBy) {
      case "confidence":
        sortedBooks.sort((a, b) => b.confidence - a.confidence);
        break;
      case "title":
        sortedBooks.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "author":
        sortedBooks.sort((a, b) => a.author.localeCompare(b.author));
        break;
      default:
        break;
    }

    setBooks(sortedBooks);
  }, [sortBy]);

  function handleSortChange(e) {
    setSortBy(e.target.value);
  }

  const handleScanAnother = () => navigate("/");
  const handleGoHome = () => navigate("/");

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="h-10 animate-shimmer rounded w-64 mb-4" />
          <div className="h-5 animate-shimmer rounded w-96" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="glass-card p-10 text-center">
          <div className="w-16 h-16 bg-danger-muted rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-text-primary mb-3">
            Something went wrong
          </h2>
          <p className="text-text-secondary text-sm mb-6">{error}</p>
          <button
            onClick={handleGoHome}
            className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover font-medium transition-colors"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  if (!books || books.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="glass-card p-10 text-center">
          <div className="w-16 h-16 bg-accent-muted rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-text-primary mb-3">
            No Books Detected
          </h2>
          <p className="text-text-secondary mb-4">This could mean:</p>
          <ul className="text-left max-w-xs mx-auto mb-8 space-y-2 text-text-secondary text-sm">
            <li>· Image was too blurry</li>
            <li>· Books were at an angle</li>
            <li>· Low lighting conditions</li>
            <li>· Book spines not clearly visible</li>
          </ul>
          <button
            onClick={handleScanAnother}
            className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover font-medium transition-colors"
          >
            Scan Another Bookshelf
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-text-primary mb-4">
          Books Recognized
        </h1>
        <div className="flex flex-wrap gap-4 text-sm text-text-secondary mb-4">
          <div className="flex items-center">
            <span className="font-medium mr-2 text-text-primary">Books Found:</span>
            <span>{scan?.total_books || books.length}</span>
          </div>
          {scan?.processing_time_ms && (
            <div className="flex items-center">
              <span className="font-medium mr-2 text-text-primary">Processed in:</span>
              <span>{(scan.processing_time_ms / 1000).toFixed(1)}s</span>
            </div>
          )}
          {scan?.model_used && (
            <div className="flex items-center">
              <span className="font-medium mr-2 text-text-primary">Model:</span>
              <span className="capitalize">{scan.model_used}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="sort" className="text-sm font-medium text-text-secondary">
            Sort by:
          </label>
          <select
            id="sort"
            value={sortBy}
            onChange={handleSortChange}
            className="px-4 py-2 border border-border rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent cursor-pointer"
          >
            <option value="confidence">Confidence (High → Low)</option>
            <option value="title">Title (A → Z)</option>
            <option value="author">Author (A → Z)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
        {books.map((book, index) => (
          <div key={`${book.title}-${index}`} style={{ animationDelay: `${index * 60}ms` }}>
            <BookCard book={book} />
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-bg-primary px-4 text-sm text-text-muted">
              Want to discover more?
            </span>
          </div>
        </div>

        <Link
          to={
            user
              ? `/recommendations/${scanId}`
              : `/recommendations/${scanId}?device_id=${deviceId || ""}`
          }
          className="inline-flex items-center gap-2 px-8 py-3 bg-accent text-white rounded-xl hover:bg-accent-hover transition-colors shadow-md hover:shadow-lg text-lg font-semibold"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
          </svg>
          <span>View Recommendations</span>
        </Link>

        <p className="text-text-muted text-sm mt-3">
          Get personalized book suggestions based on your shelf
        </p>
      </div>

      {!user && (
        <div className="mt-8 glass-card p-6 border border-accent/20">
          <p className="text-xs tracking-widest uppercase text-accent mb-2">Save your results</p>
          <h2 className="font-display text-xl font-semibold text-text-primary mb-2">
            Log in to save this scan
          </h2>
          <p className="text-text-secondary text-sm mb-5">
            Create a free account and this scan plus its recommendations move straight into it — access everything from any device.
          </p>
          <div className="flex items-center gap-3">
            <Link
              to="/signup"
              className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium text-sm"
            >
              Create account
            </Link>
            <Link
              to="/login"
              className="px-6 py-2 bg-bg-surface text-text-secondary border border-border hover:border-border-accent hover:text-text-primary rounded-lg transition-all text-sm"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}

      <div className="flex justify-center gap-4 mt-6">
        <button
          onClick={handleScanAnother}
          className="px-6 py-3 bg-bg-surface text-text-secondary border border-border hover:border-border-accent hover:text-text-primary rounded-lg font-medium transition-all duration-150"
        >
          Scan Another Bookshelf
        </button>
      </div>
    </div>
  );
}

export default Results;
```

- [ ] **Step 2: Verify in the browser**

Prerequisite: `npm run dev` running, `USE_MOCK_AI=true`, browser automation available via the `agent-browser` skill.

```bash
agent-browser open http://localhost:3000
agent-browser snapshot -i
```

Upload `test-image.jpg` as an anonymous visitor (no login). On the resulting Results page:

```bash
agent-browser snapshot -i
```

Expected: a "View Recommendations" button is present (previously only the login/signup banner showed). Click it:

```bash
agent-browser click @<view-recommendations-ref>
agent-browser snapshot -i
```

Expected: navigates to `/recommendations/:scanId?device_id=...` and the page from Task 5 loads recommendations without a login gate.

- [ ] **Step 3: Full end-to-end regression check**

Still in the browser, from the anonymous recommendations page, click "Create account", sign up with a throwaway email, and confirm:
1. Redirect lands on `/results/:scanId` for the same scan.
2. Navigating to "View Recommendations" from there now shows the same recommendations without regenerating (claimed row was found by the logged-in GET path).

Then, separately, confirm the pre-existing logged-in flow still works: log in as an existing user with a prior scan, generate/view recommendations, and confirm Save/Remove-from-Saved still function (regression check — this plan should not have changed behavior for logged-in users).

- [ ] **Step 4: Commit**

```bash
git add src/pages/Results.jsx
git commit -m "Show View Recommendations link to anonymous users too"
```

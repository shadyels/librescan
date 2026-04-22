/**
 * Saved Recommendations API
 * Location: api/saved.js
 * Route: /api/saved
 *
 * Handles three HTTP methods for managing saved recommendation sets:
 *   GET    /api/saved?device_id=uuid  — Fetch all saved sets for a device
 *   PATCH  /api/saved                 — Mark a recommendation set as saved (saved=TRUE)
 *   DELETE /api/saved                 — Permanently delete scans (cascade-deletes recommendations)
 *
 * Design decisions:
 *   - Single file with method routing (same pattern as api/preferences.js).
 *     All three methods operate on the same resource concept ("saved recommendations"),
 *     share UUID validation logic, and share the database import.
 *   - GET uses query parameter (?device_id=uuid) because device_id is authentication
 *     context ("who is asking?"), not a resource identifier. Same rationale as preferences.js.
 *   - PATCH (not PUT) for the save action because we're partially updating a single field
 *     (saved=TRUE) on an existing row, not replacing the entire resource.
 *   - DELETE removes from the scans table, not the recommendations table directly.
 *     The FK constraint (recommendations.scan_id REFERENCES scans(scan_id) ON DELETE CASCADE)
 *     automatically cascade-deletes the recommendation row. One query, both tables cleaned.
 *   - DELETE accepts an array of scan_ids to support bulk deletion from the Saved page.
 *     The Recommendations page sends a single-element array.
 */

import { query } from "./lib/database.js";
import { requireUser } from "./lib/auth.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ─── Main Handler ───────────────────────────────────────────────────────────────
/**
 * Main request handler. Routes to the appropriate sub-handler based on HTTP method.
 *
 * Vercel serverless functions require a default export. The function receives
 * standard Node.js-style (req, res) arguments from Vercel's runtime.
 *
 * @param {object} req - Vercel request object (extends Node.js IncomingMessage)
 * @param {object} res - Vercel response object (extends Node.js ServerResponse)
 * @returns {Promise<void>} Sends JSON response via res.status().json()
 */
export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === "GET") {
    return handleGet(req, res, user);
  } else if (req.method === "PATCH") {
    return handlePatch(req, res, user);
  } else if (req.method === "DELETE") {
    return handleDelete(req, res, user);
  } else {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
}

/**
 * Fetches all saved recommendation sets for a device.
 *
 * Joins the recommendations table with the scans table to assemble a summary
 * for each saved set: scan date, recognized book title preview, and recommendation count.
 *
 * Returns an empty array (not 404) when no saved sets exist — having nothing saved
 * is a normal state, not an error. This is the same pattern as GET /api/preferences.
 *
 * @param {object} req - Request with query param: ?device_id=uuid
 * @param {object} res - Response with JSON body
 * @returns {Promise<void>}
 */
async function handleGet(req, res, user) {
  try {
    const result = await query(
      `SELECT
            r.scan_id,
            r.created_at,
            s.scan_date,
            s.recognized_books,
            r.book_data
        FROM recommendations r
        JOIN scans s ON r.scan_id = s.scan_id
        WHERE r.user_id = $1 AND r.saved = TRUE
        ORDER by r.created_at DESC`,
      [user.id],
    );
    // Transform database rows into frontend-friendly format ──
    // The frontend doesn't need the full JSONB blobs. Extract only what the
    // Saved page needs to render each card: dates, title preview, counts.
    const savedSets = result.rows.map((row) => {
      // recognized_books is JSONB: { books: [{ title, author, confidence }, ...] }
      // Guard with ?. and || [] in case the structure is missing or malformed.
      const books = row.recognized_books?.books || [];

      // Extract just the title strings for the preview display.
      // The Saved page shows "The Kite Runner, 1984, Sapiens, +5 more".
      const bookTitles = books.map((b) => b.title);

      // book_data is JSONB: { recommendations: [...], metadata: {...} }
      // Count recommendations for the "8 recommendations" display text.
      const recommendationCount = row.book_data?.recommendations?.length || 0;

      return {
        scan_id: row.scan_id,
        scan_date: row.scan_date,
        saved_at: row.created_at,
        recognized_books_count: books.length,
        // First 4 titles for preview. The frontend shows these + "+N more" for the rest.
        recognized_books_preview: bookTitles.slice(0, 4),
        recommendation_count: recommendationCount,
      };
    });

    return res.status(200).json({ success: true, saved: savedSets });
  } catch (error) {
    console.error("[saved] GET error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch saved recommendations" });
  }
}

// ─── PATCH Handler ──────────────────────────────────────────────────────────────
/**
 * Marks a recommendation set as saved by setting saved=TRUE.
 *
 * Ownership check: The WHERE clause includes both scan_id AND device_id.
 * If the recommendation doesn't exist or belongs to a different device,
 * the UPDATE affects 0 rows and we return 404. This prevents a user from
 * saving another user's recommendations.
 *
 * Why not INSERT a new row: The recommendations row already exists (created
 * during generation in Phase 3). We're only flipping the saved boolean.
 *
 * @param {object} req - Request with JSON body: { scan_id: "uuid", device_id: "uuid" }
 * @param {object} res - Response with JSON body
 * @returns {Promise<void>}
 */
async function handlePatch(req, res, user) {
  const { scan_id } = req.body;

  if (!scan_id || !UUID_REGEX.test(scan_id)) {
    return res.status(400).json({ success: false, error: "Valid scan_id is required" });
  }

  try {
    const result = await query(
      `UPDATE recommendations
        SET saved = TRUE
        WHERE scan_id = $1 AND user_id = $2
        RETURNING scan_id, saved`,
      [scan_id, user.id],
    );

    // ── Step 3: Handle "not found" case ──
    // If no rows were returned, either:
    //   a) The scan_id doesn't have a recommendations row yet (user hasn't generated recs)
    //   b) The recommendation belongs to a different device (ownership mismatch)
    // We return the same 404 for both — don't leak information about other devices' data.
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Recommendation not found or access denied",
      });
    }

    console.log(`[saved] Saved recommendation set for scan ${scan_id}`);

    return res.status(200).json({
      success: true,
      message: "Recommendation saved",
      scan_id: result.rows[0].scan_id,
      saved: result.rows[0].saved,
    });
  } catch (error) {
    console.error("[saved] PATCH error: ", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to save recommendation" });
  }
}

// ─── DELETE Handler ─────────────────────────────────────────────────────────────
/**
 * Permanently deletes scans and their associated recommendations.
 *
 * Accepts an array of scan_ids to support both:
 *   - Single deletion from the Recommendations page (array with 1 element)
 *   - Bulk deletion from the Saved page (array with multiple elements)
 *
 * Deletion strategy:
 *   We DELETE FROM scans (not recommendations). The foreign key constraint
 *   on recommendations.scan_id has ON DELETE CASCADE, so deleting a scan row
 *   automatically deletes its matching recommendations row. One query, both tables.
 *
 * Ownership check:
 *   The WHERE clause includes AND device_id = $2. This ensures we only delete
 *   scans belonging to the requesting device. If a scan_id belongs to another
 *   device, the DELETE silently skips it (no error, just not deleted).
 *   The response reports deleted_count vs requested_count so the frontend
 *   can detect any mismatch.
 *
 * @param {object} req - Request with JSON body: { scan_ids: ["uuid", ...], device_id: "uuid" }
 * @param {object} res - Response with JSON body
 * @returns {Promise<void>}
 */
async function handleDelete(req, res, user) {
  const { scan_ids } = req.body;

  if (!Array.isArray(scan_ids) || scan_ids.length === 0) {
    return res.status(400).json({ success: false, error: "scan_ids must be a non-empty array" });
  }

  const invalidIds = scan_ids.filter((id) => !UUID_REGEX.test(id));
  if (invalidIds.length > 0) {
    return res.status(400).json({ success: false, error: "All scan_ids must be valid UUIDs" });
  }

  try {
    const result = await query(
      `DELETE FROM scans
        WHERE scan_id = ANY($1::uuid[]) AND user_id = $2
        RETURNING scan_id`,
      [scan_ids, user.id],
    );

    // Extract the UUIDs of successfully deleted scans from the RETURNING rows.
    const deletedIds = result.rows.map((row) => row.scan_id);

    console.log(
      `[saved] Deleted ${deletedIds.length}/${scan_ids.length} scan(s)${
        deletedIds.length > 0 ? ": " + deletedIds.join(", ") : ""
      }`,
    );

    return res.status(200).json({
      success: true,
      message: `Deleted ${deletedIds.length} scan(s) and their recommendations`,
      deleted_scan_ids: deletedIds,
      requested_count: scan_ids.length,
      deleted_count: deletedIds.length,
    });
  } catch (error) {
    console.error("[saved] DELETE error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to delete scans" });
  }
}

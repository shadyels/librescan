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
 * 1. Receive scan_id and device_id from the request body
 * 2. Fetch the scan data from the database (recognized books)
 * 3. Enrich recognized books with cached metadata (covers, categories, descriptions)
 *    — needed because the LLM uses descriptions + categories for better recommendations
 * 4. Call the recommendation LLM (Llama 3.1 8B) with the enriched book list
 * 5. Enrich the RECOMMENDED books with Google Books (covers, ISBN, etc.)
 *    — so the frontend can display real covers for recommendations too
 * 6. Store everything in the recommendations table (one row per scan)
 * 7. Return the recommendations to the frontend
 *
 * Side effects:
 * - Populates book_cache with metadata for recommended books (via enrichBooks)
 * - Cleans up unsaved recommendations older than 24 hours (via cleanupOldRecommendations)
 *
 * Dependencies:
 * - database.js: PostgreSQL queries
 * - recommendationAI.js: LLM call
 * - googleBooks.js: Cover/metadata enrichment + cache
 * - uuid: Generating recommendation_id
 */

import { query } from "./lib/database.js";
import { generateRecommendations } from "./lib/recommendationAI.js";
import { enrichBooks } from "./lib/googleBooks.js";
import { v4 as uuidv4 } from "uuid";

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
    const { scan_id, device_id } = req.body;

    if (!scan_id) {
      return res.status(400).json({
        success: false,
        error: "scan_id is required",
      });
    }

    if (!device_id) {
      return res.status(400).json({
        success: false,
        error: "device_id is required",
      });
    }

    // Validate UUID format for both IDs.
    // This prevents SQL injection via malformed IDs and catches client bugs early.
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(scan_id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid scan_id format (must be UUID v4)",
      });
    }
    if (!uuidRegex.test(device_id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid device_id format (must be UUID v4)",
      });
    }

    console.log(`[generate-recommendations] Starting for scan ${scan_id}`);

    // ---- Step 2: Check if recommendations already exist for this scan ----
    // Prevents duplicate generation if the user refreshes or navigates back.
    const existingResult = await query(
      `SELECT recommendation_id, book_data FROM recommendations WHERE scan_id = $1`,
      [scan_id],
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
    // We need the recognized books to send to the LLM as context.
    const scanResult = await query(
      "SELECT recognized_books, device_id FROM scans WHERE scan_id = $1",
      [scan_id],
    );

    // Scan not found — either invalid ID or scan was deleted
    if (scanResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Scan not found",
      });
    }

    // Security check: verify the scan belongs to this device.
    // Prevents users from generating recommendations for other people's scans.
    const scan = scanResult.rows[0];
    if (scan.device_id !== device_id) {
      return res.status(403).json({
        succes: false,
        error: "This scan does not belong to your device",
      });
    }

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
    // These are stored in book_cache (populated during Phase 2D upload).
    // We join them here the same way the scan endpoint does.
    const enrichedRecognizedBooks = await enrichBooksFromCache(recognizedBooks)

    console.log('[generate-recommendations] Enriched recognized books with cache data')

    console.log(
      `[generate-recommendations] Found ${recognizedBooks.length} recognized books`,
    );

    // ---- Step 5: Call the recommendation LLM ----
    console.log(
      "[generate-recommendations] Calling LLM for recommendations...",
    );
    const llmResult = await generateRecommendations(enrichedRecognizedBooks);

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

    // ---- Step 6: Enrich recommended books with Google Books ----
    // This populates book_cache with covers, ISBNs, descriptions for the
    // recommended books, so the frontend can display real covers.
    // enrichBooks() is the same function used during upload (Phase 2D).
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
      `INSERT INTO recommendations (recommendation_id, device_id, scan_id, book_data, saved)
        VALUES ($1, $2, $3, $4, FALSE)
        ON CONFLICT (scan_id) DO UPDATE SET book_data = $4`,
      [recommendationId, device_id, scan_id, JSON.stringify(bookData)],
    );

    console.log(
      `[generate-recommendations] Stored recommendations with ID ${recommendationId}`,
    );

    // ---- Step 9: Trigger cleanup of old unsaved recommendations ----
    // This runs as a fire-and-forget side effect. We don't await it because
    // we don't want cleanup failures to block the response to the user.
    // The .catch() ensures any errors are logged but don't crash the handler.
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
    const titleLower = (book.title || '').toLowerCase().trim()
    const authorLower = (book.author || '').toLowerCase().trim()

    try {
      const cacheResult = await query(
        `SELECT isbn, cover_url, description, categories
         FROM book_cache
         WHERE title_lower = $1 AND COALESCE(author_lower, '') = $2`,
        [titleLower, authorLower]
      )

      if (cacheResult.rows.length > 0) {
        // Cache hit: merge the cached fields into the book object
        const cached = cacheResult.rows[0]
        book.isbn = cached.isbn || null
        book.cover_url = cached.cover_url || null
        book.description = cached.description || null
        book.categories = cached.categories || []
        book.enriched = true
      } else {
        // Cache miss: mark as not enriched so the LLM knows this book
        // has less context available
        book.enriched = false
      }
    } catch (error) {
      // If cache lookup fails for one book, continue with the rest.
      // The LLM can still work with title + author alone.
      console.error(`[generate-recommendations] Cache lookup failed for "${book.title}": ${error.message}`)
      book.enriched = false
    }
  }

  return books
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
     AND created_at < NOW() - INTERVAL '24 hours'`
  )

  const deletedCount = result.rowCount || 0
  if (deletedCount > 0) {
    console.log(`[generate-recommendations] Cleaned up ${deletedCount} old unsaved recommendations`)
  }

  return deletedCount
}
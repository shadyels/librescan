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
 * 1. Validate the scanId parameter
 * 2. Query the recommendations table for this scan_id
 * 3. If found, return the stored book_data (enriched recommendations + metadata)
 * 4. If not found, return a 404 so the frontend knows to trigger generation
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

import { query } from "../lib/database.js";

export default async function handler(req, res) {
  if (req.method != "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use GET.",
    });
  }

  try {
    // ---- Step 1: Extract and validate the scanId parameter ----
    // Vercel dynamic routes put the parameter in req.query.
    // The filename [scanId].js means the param is named "scanId".
    const { scanId } = req.query;

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

    // ---- Step 2: Query the recommendations table ----
    // We select book_data (JSONB with recommendations + metadata),
    // saved status (for future use), and creation timestamp.
    const result = await query(
      `SELECT recommendation_id, book_data, saved, created_at
        FROM recommendations
        WHERE scan_id = $1`,
      [scanId],
    );

    // ---- Step 3: Handle not found ----
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

    // ---- Step 4: Return the existing recommendations ----
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

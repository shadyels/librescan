// =============================================================================
// api/scan/[scanId].js
// Purpose: Fetch scan data and join enriched metadata from book_cache.
//
// ENDPOINT: GET /api/scan/:scanId
//
// FILENAME NOTE: The square brackets [scanId] are REQUIRED by Vercel.
//   Vercel uses filesystem-based routing. Square brackets indicate a dynamic
//   URL segment. Without brackets, Vercel treats this as a static file and
//   returns 404 for URLs like /api/scan/abc-123.
//   See project context: Critical Setup Issues #4.
//
// URL PATTERN:
//   GET /api/scan/5a3c8d9e-b2f1-4c8a-9e7a-1234567890ab
//   -> Vercel routes to this file
//   -> req.query.scanId = "5a3c8d9e-b2f1-4c8a-9e7a-1234567890ab"
//
// DATA FLOW (Phase 2D):
//   1. Fetch scan row from scans table (contains raw AI output only)
//   2. For each book in recognized_books.books, look up book_cache by title+author
//   3. Merge cached metadata (cover_url, isbn, description, categories) into each book
//   4. Return the fully assembled response to the frontend
//
//   This keeps the scans table lean (raw AI data only) while book_cache holds
//   the Google Books metadata. No duplication across scans.
// =============================================================================

import { query } from "../lib/database.js";

/**
 * Main handler function for the scan endpoint
 *
 * @param {Object} req - Vercel request object
 * @param {Object} res - Vercel response object
 *
 * Flow:
 * 1. Validate HTTP method (only GET allowed)
 * 2. Extract scanId from URL path
 * 3. Validate scanId format (must be UUID v4)
 * 4. Query database for scan record
 * 5. Return scan data or 404 if not found
 */

// =============================================================================
// enrichBooksFromCache(books)
//
// Purpose: Takes the raw books array from the scan's JSONB and joins each book
//          with its cached metadata from book_cache.
//
// Args:
//   books (Array): Array of raw AI output objects, each with:
//     - title (string)
//     - author (string)
//     - confidence (number)
//
// Returns:
//   Array of enriched book objects. Each has the original AI fields plus:
//     - isbn (string|null)
//     - cover_url (string|null)
//     - description (string|null)
//     - categories (string[])
//     - enriched (boolean): true if cache had data, false if cache miss
//
// HOW IT WORKS:
//   For each book, we query book_cache using the same lowercase title+author
//   lookup that googleBooks.js uses when writing to the cache. This ensures
//   consistency: what was cached at scan time is found at read time.
//
// PERFORMANCE:
//   Each book requires one SELECT query hitting the unique index
//   idx_book_cache_lookup(title_lower, author_lower). These are indexed
//   lookups, so each takes <1ms. Even 20 books = ~20ms total.
//
// WHY NOT A SINGLE JOIN QUERY:
//   The books are inside a JSONB column, not in a separate table with rows.
//   To do a SQL join, we'd need to unnest the JSONB array into rows first
//   (jsonb_array_elements), then join with book_cache, then re-aggregate.
//   That SQL would be complex and hard to maintain. The loop approach is
//   simpler, readable, and fast enough (indexed lookups are cheap).
// =============================================================================
async function enrichBooksFromCache(books) {
  // Guard: if books is empty or missing, return empty array
  if (!books || books.length === 0) {
    return [];
  }

  const enrichedBooks = [];

  for (const book of books) {
    // -------------------------------------------------------------------------
    // Normalize title and author to lowercase for cache lookup.
    // Must match exactly how googleBooks.js stores them:
    //   title_lower = title.toLowerCase().trim()
    //   author_lower = (author || '').toLowerCase().trim()
    // -------------------------------------------------------------------------
    const titleLower = (book.title || "").toLowerCase().trim();
    const authorLower = (book.author || "").toLowerCase().trim();

    try {
      // -----------------------------------------------------------------------
      // Query book_cache by the composite unique index (title_lower, author_lower).
      // COALESCE(author_lower, '') handles NULL author_lower values in the DB.
      // This is the same query pattern used in googleBooks.js checkCache().
      // -----------------------------------------------------------------------
      const cacheResult = await query(
        `SELECT isbn, cover_url, description, categories
         FROM book_cache
         WHERE title_lower = $1 AND COALESCE(author_lower, '') = $2`,
        [titleLower, authorLower],
      );

      if (cacheResult.rows.length > 0) {
        // Cache hit, merged cached metadata into the book object
        const cached = cacheResult.rows[0];
        enrichedBooks.push({
          ...book,
          isbn: cached.isbn,
          cover_url: cached.cover_url,
          description: cached.description,
          categories: cached.categories || [],
          enriched: true,
        });
      } else {
        // Cache miss: return the book with null metadata fields
        // This can happen if:
        //   - The cache was cleared after the scan was created
        //   - The enrichment step failed for this book during upload
        //   - The Google Books API key was not set when the scan was uploaded
        enrichedBooks.push({
          ...book,
          isbn: null,
          cover_url: null,
          description: null,
          categories: [],
          enriched: false,
        });
      }
    } catch (error) {
      // If the cache query fails for one book, don't break the whole response.
      // Return the book without metadata.
      console.error(
        `[scan] Cache lookup failed for "${book.title}":`,
        error.message,
      );
      enrichedBooks.push({
        ...book,
        isbn: null,
        cover_url: null,
        description: null,
        categories: [],
        enriched: false,
      });
    }
  }
  return enrichedBooks;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
      allowedMethods: ["GET"],
    });
  }

  try {
    // Extract scanId from query parameters
    // Vercel serverless functions receive URL params in req.query
    // Example URL: /api/scan?scanId=abc123... OR /api/scan/abc123...
    const scanId = req.query.scanId || req.query.id;
    if (!scanId) {
      return res.status(400).json({
        success: false,
        error: "scanId is required as a query parameter",
      });
    }

    // scanid must be a valid UUID
    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidV4Regex.test(scanId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid scanId format. Must be a UUID v4.",
      });
    }

    // Step 5: Query database for scan record
    // Using parameterized query ($1) to prevent SQL injection
    console.log(`Fetching scan data for scanId: ${scanId}`);
    console.log(``)

    const result = await query(
      "SELECT scan_id, device_id, scan_date, recognized_books FROM scans WHERE scan_id = $1",
      [scanId],
    );

    if (result.rows.length === 0) {
      console.log(`Scan not found: ${scanId}`);

      return res.status(404).json({
        success: false,
        error: "Scan not found",
        scan_id: scanId,
        hint: "This scan may have been deleted or the ID is incorrect",
      });
    }

    // Extract scan data from query result
    const scan = result.rows[0];

    // -------------------------------------------------------------------------
    // Join enriched metadata from book_cache.
    //
    // scan.recognized_books is the JSONB column parsed into a JS object by pg.
    // It has the structure: { books: [...], metadata: {...} }
    //
    // We take the raw books array, look up each one in book_cache, and merge
    // the cached metadata (cover_url, isbn, description, categories) into
    // each book object.
    //
    // The result is a fully assembled array that the frontend can render
    // directly - covers, categories, and all.
    // -------------------------------------------------------------------------
    const rawBooks = scan.recognized_books?.books || []
    const enrichedBooks = await enrichBooksFromCache(rawBooks)

    // -------------------------------------------------------------------------
    // Build and return the response.
    //
    // We construct a new recognized_books object with:
    //   - books: the enriched array (raw AI + cached Google Books metadata)
    //   - metadata: the original AI metadata (model, timing, etc.) unchanged
    //
    // Convenience fields (total_books, processing_time_ms, model_used) are
    // computed from the data so the frontend doesn't have to dig into nested
    // objects for common values.
    // -------------------------------------------------------------------------
    return res.status(200).json({
      success: true,
      scan: {
        scan_id: scan.scan_id,
        device_id: scan.device_id,
        scan_date: scan.scan_date,
        recognized_books: {
          books: enrichedBooks,
          metada: scan.recognized_books?.metadata || {}
        },
        // computed fields for convenience
        total_books: enrichedBooks.length,
        processing_time: scan.recognized_books?.metadata?.processing_time_ms || null,
        model_used: scan.recognized_books?.metadata?.model_used || "unknown",
      },
    });
  } catch (error) {
    console.error("Scan API error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      // In production, remove error.message to avoid leaking info
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

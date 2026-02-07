/**
 * GET /api/scan/:scanId
 *
 * Fetches scan data including recognized books from the database.
 * Returns the scan record with all book recognition results.
 *
 * CRITICAL: Must use `export default` for Vercel serverless functions
 */

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

    //Parse the JSONB recognized_books field
    // PostgreSQL stores JSONB as native type, but it comes out as JavaScript object already
    const recognizedBooks = scan.recognized_books;
    console.log(
      `Scan found: ${scanId} with ${recognizedBooks?.books?.length || 0} recognized books`,
    );

    return res.status(200).json({
      success: true,
      scan: {
        scan_id: scan.scan_id,
        device_id: scan.device_id,
        scan_date: scan.scan_date,
        recognized_books: recognizedBooks,
        // computed fields for convenience
        total_books: recognizedBooks?.books?.length || 0,
        processing_time: recognizedBooks?.metadata?.processing_time_ms || null,
        model_used: recognizedBooks?.metadata?.model_used || "unknown",
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

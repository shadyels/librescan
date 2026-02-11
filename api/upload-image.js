// =============================================================================
// api/upload-image.js
// Purpose: Accept image upload, process with AI, enrich with Google Books, store.
//
// ENDPOINT: POST /api/upload-image
// CONTENT-TYPE: multipart/form-data
//
// FORM FIELDS:
//   image     (File)   - The bookshelf photo (JPEG, PNG, or HEIC, max 10MB)
//   device_id (String) - UUID v4 identifying the device/session
// =============================================================================

// -----------------------------------------------------------------------------
// IMPORT: IncomingForm from formidable
// WHY: Formidable parses multipart/form-data requests (file uploads).
//      We use Formidable instead of Multer because Multer has stream handling
//      issues in Vercel's serverless environment (see project context: Critical
//      Setup Issues #6). Formidable works reliably with serverless.
// WHY IncomingForm specifically: It's the class that creates a form parser
//      instance. We configure it with options like uploadDir and maxFileSize.
// -----------------------------------------------------------------------------
import { IncomingForm } from "formidable";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { query } from "./lib/database.js";
import { recognizeBooks as recognizeBooksMock } from "./lib/mockAI.js";
import { recognizeBooks as recognizeBooksReal } from "./lib/qwenAI.js";
import { enrichBooks } from "./lib/googleBooks.js";

// =============================================================================
// VERCEL CONFIG: Disable body parsing.
// WHY: Vercel's default body parser reads the request body as JSON or text.
//      But file uploads use multipart/form-data, which is a binary stream.
//      If Vercel's parser reads it first, Formidable gets an empty/corrupted
//      stream and throws "Unexpected end of form" errors.
//      Setting bodyParser: false tells Vercel to leave the raw stream untouched
//      so Formidable can parse it correctly.
// CRITICAL: Without this config, file uploads WILL fail silently or with
//           confusing error messages.
// =============================================================================
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Main request handler
 * Processes image upload and book recognition
 */
export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
      allowedMethods: ["POST"],
    });
  }

  /**
   * Configure Formidable for file parsing
   * - uploadDir: Platform-specific temp directory
   * - keepExtensions: Preserves .jpg, .png file extensions
   * - maxFileSize: 10MB limit (prevents abuse)
   */
  const form = new IncomingForm({
    uploadDir: "/tmp",
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB in bytes
  });

  /**
   * Wrap Formidable parsing in Promise for async/await
   * Formidable uses callbacks, we convert to Promise for cleaner code
   */
  return new Promise((resolve) => {
    form.parse(req, async (err, fields, files) => {
      // Handle parsing errors (corrupted upload, size exceeded, etc.)
      if (err) {
        console.error("Form parse error:", err);
        console.error("Error stack:", err.stack);
        res.status(400).json({
          success: false,
          error: err.message,
        });
        return resolve();
      }

      /**
       * Extract uploaded file from parsed form data
       * Formidable v3 returns files as array or single object
       * We handle both cases for compatibility
       */
      const uploadedFile = files.image?.[0] || files.image;

      console.log(
        "Uploaded file:",
        uploadedFile ? uploadedFile.originalFilename : "none",
      );

      // Validate that a file was actually uploaded
      if (!uploadedFile) {
        console.error("No file in upload");
        res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
        return resolve();
      }

      /**
       * Extract device_id from form fields
       * This links the scan to a specific user session
       * Format: UUID v4 (validated on client side)
       */
      const deviceId = fields.device_id?.[0] || fields.device_id;

      console.log("Device ID:", deviceId);

      // Validate device_id is present
      if (!deviceId) {
        console.error("Missing device_id");
        res.status(400).json({
          success: false,
          error: "device_id is required",
        });
        return resolve();
      }

      try {
        /**
         * Generate unique scan ID
         * This ID will be used to:
         * - Store scan in database
         * - Navigate to results page (/results/:scanId)
         * - Link recommendations to this specific scan
         */
        const scanId = uuidv4();

        console.log(`Processing upload for device ${deviceId}`);
        console.log(`Scan ID: ${scanId}`);
        console.log(
          `File: ${uploadedFile.originalFilename} (${uploadedFile.size} bytes)`,
        );
        console.log(`File path: ${uploadedFile.filepath}`);

        /**
         * AI Book Recognition
         *
         * Check environment variable to determine mode:
         * - USE_MOCK_AI=true: Use fake data (development/testing)
         * - USE_MOCK_AI=false: Call real HuggingFace API (production)
         *
         * Default to mock if not set (safer for development)
         */
        const useMockAI = process.env.USE_MOCK_AI === "true";

        console.log(`AI Mode: ${useMockAI ? "MOCK" : "REAL"}`);

        let recognizedBooks;

        if (useMockAI) {
          /**
           * Mock AI Processing
           * - No API costs
           * - 3 second simulated delay
           * - Returns 8 fake classic books
           */
          console.log("[upload] Using MOCK AI (USE_MOCK_AI=true)");
          recognizedBooks = await recognizeBooksMock(uploadedFile.filepath);
        } else {
          // REAL PATH: Use Qwen2.5-VL to actually analyze the bookshelf image.
          // This calls the HuggingFace Inference API which:
          //   - Takes 5-60 seconds depending on cold start
          //   - Requires HUGGINGFACE_API_KEY to be set
          //   - Uses free-tier API credits
          //   - Returns real book identifications from the uploaded photo
          console.log(
            "[upload] Using REAL AI - Qwen2.5-VL (USE_MOCK_AI=false)",
          );
          recognizedBooks = await recognizeBooksReal(uploadedFile.filepath);
        }

        console.log(`AI recognized ${recognizedBooks.books.length} books`);

        // -------------------------------------------------------------------------
        // STEP 6 (Phase 2D): Populate the book_cache with Google Books metadata.
        //
        // WHY we call enrichBooks here:
        //   This is the moment we have book titles and authors fresh from the AI.
        //   enrichBooks() checks the cache for each book, and for cache misses,
        //   calls Google Books API and stores the result in book_cache.
        //
        // WHY we do NOT save the enriched data in the scans table:
        //   The scans table stores only the raw AI output (title, author, confidence).
        //   The enriched metadata (covers, ISBN, description, categories) lives
        //   exclusively in book_cache. When the frontend requests scan results,
        //   the GET /api/scan/:scanId endpoint joins the two at read time.
        //
        //   This avoids duplicating the same metadata across every scan that
        //   detects the same book. 50 users scanning "The Great Gatsby" means
        //   1 row in book_cache, not 50 copies of the same cover URL in scans.
        //
        // We discard the return value because we only care about the side effect
        // (populating the cache). The enriched data is not stored in scans.
        // -------------------------------------------------------------------------
        console.log(
          "[upload] Populating book cache with Google Books metadata...",
        );
        await enrichBooks(recognizedBooks.books);
        console.log("[upload] Cache population complete.");

        /**
         * Store scan results in database
         *
         * Table: scans
         * Columns:
         * - scan_id: UUID primary key
         * - device_id: Links to sessions table (foreign key)
         * - image_url: NULL (we don't store images, only results)
         * - scan_date: Auto-set to CURRENT_TIMESTAMP
         * - recognized_books: JSONB with AI results
         *
         * JSONB allows flexible querying:
         * - SELECT recognized_books->'books' to get book array
         * - WHERE recognized_books->'metadata'->>'model_used' = 'florence-2'
         */
        await query(
          `INSERT INTO scans (scan_id, device_id, recognized_books)
           VALUES ($1, $2, $3)`,
          [
            scanId, // $1: Unique scan identifier
            deviceId, // $2: User's device ID
            JSON.stringify(recognizedBooks), // $3: AI results as JSONB
          ],
        );

        console.log(`Scan ${scanId} saved to database`);

        /**
         * Success Response
         *
         * Returns:
         * - scan_id: Frontend uses this to navigate to /results/:scanId
         * - recognized_books: Immediate display without additional API call
         * - file metadata: For debugging and logging
         */
        res.status(200).json({
          success: true,
          message: "Image processed successfully",
          scan_id: scanId,
          recognized_books: recognizedBooks,
          file: {
            filename: path.basename(uploadedFile.filepath),
            size: uploadedFile.size,
            mimetype: uploadedFile.mimetype,
          },
        });

        resolve();
      } catch (error) {
        /**
         * Error Handling
         * Possible errors:
         * - Database connection failure
         * - AI API timeout
         * - Invalid image format
         * - Disk space issues in /tmp
         */
        console.error("Upload processing error:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({
          success: false,
          error: "Failed to process image",
          details: error.message,
        });
        resolve();
      }
    });
  });
}

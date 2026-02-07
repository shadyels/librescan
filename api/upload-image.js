/**
 * Image Upload API Endpoint
 * POST /api/upload-image
 *
 * Accepts multipart/form-data image uploads, processes with AI book recognition,
 * and stores results in the database.
 *
 * Flow:
 * 1. Parse multipart form data with Formidable
 * 2. Validate uploaded file
 * 3. Process image with AI (mock or real based on env var)
 * 4. Store scan results in database
 * 5. Return scan_id and recognized books
 */

import { IncomingForm } from "formidable";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { query } from "./lib/database.js";
import { recognizeBooks as recognizeBooksMock } from "./lib/mockAI.js";
import { recognizeBooks as recognizeBooksReal } from "./lib/qwenAI.js";

/**
 * Critical: Disable Vercel's built-in body parser
 * Formidable needs access to the raw request stream
 * Without this, multipart parsing fails with "Unexpected end of form"
 */
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
          `INSERT INTO scans (scan_id, device_id, image_url, recognized_books)
           VALUES ($1, $2, $3, $4)`,
          [
            scanId, // $1: Unique scan identifier
            deviceId, // $2: User's device ID
            "", // $3: No image storage (privacy + cost)
            JSON.stringify(recognizedBooks), // $4: AI results as JSONB
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

/**
 * preferences.js
 *
 * GET  /api/preferences?device_id=uuid  — Fetch user preferences
 * PUT  /api/preferences                 — Create or update user preferences
 *
 * Purpose:
 * Manages the user's reading preferences (genres, authors, language, reading level).
 * These preferences are injected into the LLM prompt when generating recommendations,
 * so the AI can tailor its suggestions to the user's stated tastes — not just what's
 * on their bookshelf.
 *
 * The preferences table already exists in the DB schema (created in Phase 1):
 *   device_id UUID PRIMARY KEY references sessions(device_id) ON DELETE CASCADE,
 *   genres TEXT[] DEFAULT '{}',
 *   authors TEXT[] DEFAULT '{}',
 *   language VARCHAR(50),
 *   reading_level VARCHAR(50)
 *
 * Dependencies:
 * - database.js: PostgreSQL queries
 */

import { query } from "./lib/database.js";

const VALID_GENRES = [
  "Fiction",
  "Non-Fiction",
  "Science Fiction",
  "Fantasy",
  "Mystery / Thriller",
  "Romance",
  "Horror",
  "Historical Fiction",
  "Biography / Memoir",
  "Self-Help",
  "Science / Technology",
  "Philosophy",
  "Poetry",
  "Business / Economics",
  "Young Adult (YA)",
];

const VALID_LANGUAGES = [
  "English",
  "Chinese (Mandarin)",
  "German",
  "French",
  "Spanish",
  "Japanese",
  "Russian",
  "Portuguese",
  "Korean",
  "Italian",
  "Dutch",
  "Swedish",
  "Arabic",
  "Hindi",
  "Turkish",
];

const VALID_READING_LEVELS = ["Beginner", "Intermediate", "Advanced"];

// ============================================================================
// MAIN HANDLER
// ============================================================================
/**
 * Routes GET and PUT requests to their respective handlers.
 * All other methods return 405 Method Not Allowed.
 *
 * Why export default: Vercel requires default exports to detect handlers.
 *
 * @param {Object} req - HTTP request object (Vercel)
 * @param {Object} res - HTTP response object (Vercel)
 */
export default async function handler(req, res) {
  if (req.method == "GET") {
    return handleGet(req, res);
  }

  if (req.method == "PUT") {
    return handlePut(req, res);
  }

  return res.status(405).json({
    success: false,
    error: "Method not allowed. Use GET or PUT",
  });
}

//Fetches preferences for a device
async function handleGet(req, res) {
  try {
    // Extract device_id from query string: /api/preferences?device_id=xxx
    const { device_id } = req.query;

    if (!device_id) {
      return res.status(400).json({
        success: false,
        error: "device_id query parameter is required",
      });
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(device_id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid device_id format (must be UUID v4)",
      });
    }

    // ---- Query ----
    // Select all preference columns for this device.
    // Parameterized query ($1) prevents SQL injection.
    const result = await query(
      "SELECT genres, authors, language, reading_level FROM preferences WHERE device_id = $1",
      [device_id],
    );

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        preferences: null,
      });
    }
    // Row found — return the preferences
    const row = result.rows[0];

    return res.status(200).json({
      success: true,
      preferences: {
        genres: row.genres || [],
        authors: row.authors || [],
        language: row.language || "",
        reading_level: row.reading_level || "",
      },
    });
  } catch (error) {
    console.error(`[preferences] GET error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch preferences",
    });
  }
}

// ============================================================================
// PUT HANDLER
// ============================================================================

/**
 * Creates or updates preferences for a device.
 *
 * Body (JSON):
 *   device_id     (required) — UUID v4
 *   genres        (optional) — Array of strings from VALID_GENRES
 *   authors       (optional) — Array of strings (free text, user-typed)
 *   language      (optional) — Single string from VALID_LANGUAGES
 *   reading_level (optional) — Single string from VALID_READING_LEVELS
 *
 * Upsert strategy:
 *   INSERT ... ON CONFLICT (device_id) DO UPDATE SET ...
 *   This handles both first-time save and subsequent updates in one query.
 *   The preferences table has device_id as PRIMARY KEY, so ON CONFLICT works.
 *
 * Validation:
 *   - Genres must be from the fixed list (rejects unknown genres)
 *   - Language must be from the fixed list (rejects unknown languages)
 *   - Reading level must be from the fixed list (rejects unknown levels)
 *   - Authors are free-text but sanitized (trimmed, empty strings removed)
 *   - All arrays are capped at reasonable limits to prevent abuse
 *
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
async function handlePut(req, res) {
  try {
    const { device_id, genres, authors, language, reading_level } = req.body;

    if (!device_id) {
      return res.status(400).json({
        success: false,
        error: "device_id query parameter is required",
      });
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(device_id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid device_id format (must be UUID v4)",
      });
    }

    // ---- Validate and sanitize genres ----
    // Must be an array. Each entry must be a string from VALID_GENRES.
    // Unknown genres are silently filtered out (not rejected) — this is forgiving
    // if the frontend list ever gets slightly out of sync with the backend.
    let cleanGenres = [];
    if (Array.isArray(genres)) {
      cleanGenres = genres
        .filter((g) => typeof g === "string" && VALID_GENRES.includes(g))
        .slice(0, 15); // Cap at 15 (can't exceed the total list anyway)
    }

    // ---- Validate and sanitize genres ----
    // Must be an array. Each entry must be a string from VALID_GENRES.
    // Unknown genres are silently filtered out (not rejected) — this is forgiving
    // if the frontend list ever gets slightly out of sync with the backend.
    let cleanAuthors = [];
    if (Array.isArray(authors)) {
      cleanAuthors = authors
        .filter((a) => typeof a === "string" && a.trim().length > 0)
        .map((a) => a.trim())
        .slice(0, 20);
    }

    // ---- Validate language ----
    // Must be a string from VALID_LANGUAGES, or empty string (meaning "no preference").
    let cleanLanguage = "";
    if (typeof language === "string" && language.trim().length > 0) {
      if (VALID_LANGUAGES.includes(language.trim())) {
        cleanLanguage = language.trim();
      }
      // If invalid language string, silently ignore (keep empty = no preference)
    }

    // ---- Validate reading_level ----
    // Must be a string from VALID_READING_LEVELS, or empty string (meaning "no preference").
    let cleanReadingLevel = "";
    if (typeof reading_level === "string" && reading_level.trim().length > 0) {
      if (VALID_READING_LEVELS.includes(reading_level.trim())) {
        cleanReadingLevel = reading_level.trim();
      }
      // If invalid reading_level string, silently ignore
    }

    // ---- Verify the session exists ----
    // The preferences table has a foreign key to sessions(device_id).
    // If the session doesn't exist, the INSERT will fail with a FK violation.
    // We check first to give a better error message.
    const sessionCheck = await query(
      "SELECT device_id FROM sessions WHERE device_id = $1",
      [device_id],
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Session not found. Please refresh the page.",
      });
    }

    // ---- Upsert preferences ----
    // INSERT if this device has no preferences row yet.
    // UPDATE if a row already exists (ON CONFLICT on the PRIMARY KEY).
    // PostgreSQL TEXT[] columns accept JavaScript arrays when passed via parameterized queries.
    await query(
      `INSERT INTO preferences (device_id, genres, authors, language, reading_level)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (device_id) DO UPDATE SET
        genres = $2,
        authors = $3,
        language = $4,
        reading_level = $5`,
      [device_id, genres, cleanAuthors, cleanLanguage, cleanReadingLevel],
    );

    console.log(
      `[preferences] Saved preferences for device ${device_id}: ` +
        `${cleanGenres.length} genres, ${cleanAuthors.length} authors, ` +
        `language="${cleanLanguage}", level="${cleanReadingLevel}"`,
    );

    return res.status(200).json({
      success: true,
      preferences: {
        genres: cleanGenres,
        authors: cleanAuthors,
        language: cleanLanguage,
        reading_level: cleanReadingLevel,
      },
    });
  } catch (error) {
    console.error(`[preferences] PUT error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: "Failed to save preferences",
    });
  }
}

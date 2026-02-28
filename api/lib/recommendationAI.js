/**
 * recommendationAI.js
 *
 * Generates personalized book recommendations using Meta's Llama 3.1 8B Instruct
 * model via HuggingFace Inference Providers.
 *
 * Architecture:
 * - Receives an array of recognized books (title, author, confidence, categories, description)
 * - Optionally receives user preferences (genres, authors, language, reading level) [Phase 4]
 * - Builds a structured prompt that asks the LLM to:
 *     1. Detect reading patterns from the user's bookshelf
 *     2. Consider the user's stated preferences (if any)
 *     3. Generate 8 similar book recommendations
 *     4. Provide a short personalized reason for each recommendation
 * - Sends the prompt to the HuggingFace router (OpenAI-compatible chat completions API)
 * - Parses the JSON response with multiple fallback strategies
 * - Returns an array of 8 recommended books with title, author, and reason
 *
 * Phase 4 changes:
 * - generateRecommendations() now accepts an optional `preferences` parameter
 * - buildPrompt() now accepts an optional `preferences` parameter
 * - New helper: buildPreferencesSection() formats preferences into natural language
 * - Preferences are injected into the USER message (not system message) because
 *   they are per-request context, not role definition
 */

import { validate } from "uuid";

const HUGGINGFACE_ROUTER_URL =
  "https://router.huggingface.co/v1/chat/completions";
const MODEL_ID = "meta-llama/Llama-3.1-8B-Instruct";
/**
 * Maximum time to wait for the LLM response in milliseconds.
 * 60 seconds is generous for an 8B model generating ~500 tokens.
 * Free tier providers may have cold starts, so we allow extra time.
 */
const REQUEST_TIMEOUT_MS = 60000;
const NUM_RECOMMENDATIONS = 8;
/**
 * Maximum tokens for the LLM response.
 * 8 recommendations with title + author + reason ≈ 400-600 tokens.
 * We set 1024 to give the model breathing room for JSON formatting.
 */
const MAX_TOKENS = 1024;

// ============================================================================
// MAIN EXPORT: generateRecommendations
// ============================================================================
/**
 * Generates personalized book recommendations based on recognized books
 * and optional user preferences.
 *
 * @param {Array<Object>} books - Array of recognized book objects. Each should have:
 *   - title {string}: Book title (e.g., "The Kite Runner")
 *   - author {string}: Author name (e.g., "Khaled Hosseini")
 *   - confidence {number}: AI confidence score 0.0-1.0 (used to weight importance)
 *   - categories {Array<string>}: Genre categories from Google Books (optional)
 *   - description {string}: Book synopsis from Google Books (optional)
 *
 * @param {Object|null} preferences - Optional user preferences from the preferences table.
 *   If null or empty, recommendations are based solely on the bookshelf.
 *   - genres {Array<string>}: Preferred genres (e.g., ["Science Fiction", "Fantasy"])
 *   - authors {Array<string>}: Preferred authors (e.g., ["Isaac Asimov"])
 *   - language {string}: Preferred language (e.g., "English")
 *   - reading_level {string}: Preferred level (e.g., "Intermediate")
 *
 * @returns {Object} Result object with:
 *   - recommendations {Array<Object>}: Array of recommended books, each with:
 *       - title {string}: Recommended book title
 *       - author {string}: Recommended book author
 *       - reason {string}: Short personalized explanation (1-2 sentences)
 *   - metadata {Object}: Processing info:
 *       - model_used {string}: The model ID that was called
 *       - processing_time_ms {number}: Total time for the LLM call
 *       - prompt_books_count {number}: How many books were sent to the LLM
 *       - preferences_used {boolean}: Whether user preferences were included in the prompt
 *
 * @throws {Error} If the API call fails or response cannot be parsed
 */
export async function generateRecommendations(books, preferences = null) {
  const startTime = Date.now();

  if (!books || books.length === 0) {
    console.log(
      "[recommendationAI] No books provided, skipping recommendation generation",
    );
    return {
      recommendations: [],
      metadata: {
        model_used: MODEL_ID,
        processing_time_ms: 0,
        prompt_book_count: 0,
      },
    };
  }

  // ---- Step 2: Build the prompt ----
  // This is the most critical part. The prompt structure directly determines
  // the quality of recommendations.
  // Phase 4: preferences are now passed to buildPrompt for injection into the user message.
  const prompt = buildPrompt(books, preferences);
  console.log(
    `[recommendationAI] Generating recommendations from ${books.length} books using ${MODEL_ID}`,
  );

  // Determine if preferences were actually included (non-null and non-empty).
  // This is tracked in metadata so the frontend or logs can distinguish
  // preference-influenced recommendations from bookshelf-only ones.
  const preferencesUsed = hasAnyPreferences(preferences);

  console.log(
    `[recommendationAI] Generating recommendations from ${books.length} books using ${MODEL_ID}` +
      (preferencesUsed ? " (with user preferences)" : " (no preferences)"),
  );

  // ---- Step 3: Call the HuggingFace router ----
  // Use the OpenAI-compatible chat completions format.
  // AbortController provides a clean timeout mechanism.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(HUGGINGFACE_ROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          {
            role: "system",
            content: buildSystemMessage(),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: MAX_TOKENS,
        // Temperature 0.7: Allows some creativity in recommendations while
        // keeping output focused. Lower (0.3) = more predictable/obvious picks.
        // Higher (1.0) = more surprising but potentially irrelevant picks.
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    // Clear the timeout since the request completed (success or error)
    clearTimeout(timeoutId);

    // ---- Step 4: Handle HTTP errors ----
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `[recommendationAI] API error: ${response.status} - ${errorBody}`,
      );
      throw new Error(
        `HuggingFace API returned ${response.status}: ${errorBody}`,
      );
    }

    // ---- Step 5: Extract the response text ----
    const data = await response.json();

    // The OpenAI-compatible format puts the model's text in:
    // data.choices[0].message.content
    const rawResponse = data.choices?.[0]?.message?.content || "";

    console.log(
      `[recommendationAI] Raw response length: ${rawResponse.length} chars`,
    );
    console.log(
      `[recommendationAI] Raw response preview: ${rawResponse.substring(0, 200)}...`,
    );

    // ---- Step 6: Parse the JSON from the response ----
    const recommendations = parseRecommendations(rawResponse);

    const processingTime = Date.now() - startTime;
    console.log(
      `[recommendationAI] Generated ${recommendations.length} recommendations in ${processingTime}ms`,
    );

    return {
      recommendations,
      metadata: {
        model_used: MODEL_ID,
        processing_time_ms: processingTime,
        prompt_book_count: books.length,
      },
    };
  } catch (error) {
    // Clear timeout in case of error (prevents memory leak)
    clearTimeout();

    // AbortError means our timeout fired before the response arrived
    if (error.name === "AbortError") {
      const elapsed = Date.now() - startTime;
      console.error(`[recommendationAI] Request timed out after ${elapsed}ms`);
      throw new Error(
        `Recommendation generation timed out after ${REQUEST_TIMEOUT_MS}ms`,
      );
    }

    // Re-throw other errors (network failures, JSON parse errors, etc.)
    console.error(`[recommendationAI] Error: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// PROMPT CONSTRUCTION
// ============================================================================
/**
 * Builds the system message that defines the LLM's role and output format.
 *
 * Why a separate system message:
 * - Llama 3.1 Instruct models are trained to follow system instructions carefully
 * - Separating "who you are" from "what to do" improves JSON compliance
 * - The system message stays constant; the user message changes per scan
 *
 * Phase 4 note: Preferences are NOT in the system message. They belong in the
 * user message because they are per-request context (different for each user),
 * not role definition (same for all users). The system message defines the LLM's
 * behavior; the user message provides the data to act on.
 */
function buildSystemMessage() {
  return `You are a knowledgeable book recommendation assistant. Your job is to analyze a user's bookshelf and recommend similar books they would enjoy.
  
RULES:
1. Recommend exactly ${NUM_RECOMMENDATIONS} books.
2. NEVER recommend a book that is already on the user's shelf.
3. Each recommendation must include title, author, and a short reason (1-2 sentences max).
4. The reason should explain WHY this book fits the user's taste based on their shelf.
5. Focus on books that match the detected reading patterns (genre, themes, writing style).
6. Prefer well-known, highly-regarded books that are easy to find.
7. Respond ONLY with a valid JSON array. No extra text, no markdown, no explanations outside the JSON.

OOUTPUT FORMAT (strict JSON array):
[
  {
    "title": "Book Title",
    "author": "Author Name",
    "reason": "Short reason connecting this to the user's shelf."
  }
]`;
}

/**
 * Builds the user-facing prompt that describes the bookshelf and preferences.
 *
 * Strategy:
 * - Sort books by confidence score (highest first) so the LLM treats
 *   high-confidence books as stronger signals of the user's taste
 * - Include categories and descriptions when available (richer context = better recs)
 * - Keep descriptions short (first 150 chars) to avoid blowing up token count
 * - Mark which books have low confidence so the LLM doesn't over-index on them
 * - Phase 4: Append preferences section after the bookshelf if preferences exist
 *
 * Why preferences go in the user message (not system message):
 * - The system message defines the LLM's role and rules (constant across all users)
 * - The user message provides the data for this specific request (varies per user)
 * - Preferences are user-specific data, so they belong alongside the bookshelf listing
 * - This also keeps the system message stable and testable
 *
 * @param {Array<Object>} books - Recognized books array
 * @param {Object|null} preferences - Optional user preferences (Phase 4)
 * @returns {string} The formatted user prompt
 */
function buildPrompt(books, preferences = null) {
  // Array.sort mutates in place, so we spread into a new array to avoid modifying the caller's data.
  const sortedBooks = [...books].sort(
    (a, b) => (b.confidence || 0) - (a.confidence || 0),
  );

  // Build a text description of each book on the shelf
  const bookDescriptions = sortedBooks.map((book, index) => {
    // Start with the basics: number, title, author
    let entry = `${index + 1}. "${book.title} by ${book.author || "Unknown"}`;

    //Add confidence
    const confidencePercent = Math.round((book.confidence || 0) * 100);
    entry += ` [confidence: ${confidencePercent}%]`;

    // Add categories if available (from Google Books enrichment)
    // These help the LLM understand genre patterns
    if (book.categories && book.categories.length > 0) {
      entry += `\n   Categories: ${book.categories.join(", ")}`;
    }

    // Add a truncated description if available (from Google Books enrichment), max 150 chars to control budget
    if (book.description) {
      const truncated =
        book.description.length > 150
          ? book.description.substring(0, 150) + "..."
          : book.description;
      entry += `\n Description: ${truncated}`;
    }
    return entry;
  });

  // ---- Build the full prompt ----
  // Start with the bookshelf listing
  let prompt = `Here are the books on my shelf:
            ${bookDescriptions.join("\n\n")}`;

  // Phase 4: Append preferences section if the user has set any.
  // The preferences section is phrased as natural language so the LLM
  // can interpret it conversationally (not as rigid filter rules).
  const preferencesSection = buildPreferencesSection(preferences);
  if (preferencesSection) {
    prompt += `\n\n${preferencesSection}`;
  }

  // Final instruction
  prompt += `\n\nBased on these ${books.length} books${hasAnyPreferences(preferences) ? " and my reading preferences" : ""}, recommend ${NUM_RECOMMENDATIONS} similar books I would enjoy. Remember: respond ONLY with a JSON array, no other text.`;

  return prompt;
}

// ============================================================================
// PREFERENCES HELPERS (Phase 4)
// ============================================================================

/**
 * Checks whether the preferences object contains any non-empty values.
 *
 * Used to decide whether to include the preferences section in the prompt
 * and to set the `preferences_used` flag in metadata.
 *
 * @param {Object|null} preferences - The preferences object from the DB
 * @returns {boolean} True if at least one preference field has content
 */
function hasAnyPreferences(preferences) {
  if (!preferences) return false;

  // Check each field: arrays must have length > 0, strings must be non-empty
  const hasGenres =
    Array.isArray(preferences.genres) && preferences.genres.length > 0;
  const hasAuthors =
    Array.isArray(preferences.authors) && preferences.authors.length > 0;
  const hasLanguage =
    typeof preferences.language === "string" &&
    preferences.language.trim().length > 0;
  const hasReadingLevel =
    typeof preferences.reading_level === "string" &&
    preferences.reading_level.trim().length > 0;

  return hasGenres || hasAuthors || hasLanguage || hasReadingLevel;
}

/**
 * Formats user preferences into a natural-language section for the prompt.
 *
 * Why natural language instead of structured data:
 * - LLMs interpret conversational context better than key-value pairs
 * - "I enjoy science fiction and fantasy" is clearer to the model than
 *   "genres: [Science Fiction, Fantasy]"
 * - Natural phrasing allows the model to weigh preferences flexibly
 *   (e.g., it might recommend a sci-fi book by a non-preferred author
 *   if it strongly matches the shelf)
 *
 * Phrasing choices:
 * - "I enjoy..." (genres) — soft preference, not a hard filter
 * - "Some of my favorite authors include..." — hints, not requirements
 * - "I prefer books in..." (language) — guides but doesn't exclude
 * - "My reading level is..." — adjusts complexity, not genre
 *
 * @param {Object|null} preferences - The preferences object from the DB
 * @returns {string|null} Formatted preferences text, or null if no preferences
 */
function buildPreferencesSection(preferences) {
  // Return null if no preferences at all — prompt will not include the section
  if (!hasAnyPreferences(preferences)) return null;

  // Build individual sentences for each non-empty preference field.
  // We collect them in an array and join at the end.
  const parts = [];

  // ---- Genres ----
  if (Array.isArray(preferences.genres) && preferences.genres.length > 0) {
    parts.push(
      `I enjoy reading these genres: ${preferences.genres.join(", ")}.`,
    );
  }

  // ---- Authors ----
  if (Array.isArray(preferences.authors) && preferences.authors.length > 0) {
    parts.push(
      `Some of my favorite authors include: ${preferences.authors.join(", ")}.`,
    );
  }

  // ---- Language ----
  if (
    typeof preferences.language === "string" &&
    preferences.language.trim().length > 0
  ) {
    parts.push(`I prefer books in ${preferences.language.trim()}.`);
  }

  // ---- Reading Level ----
  if (
    typeof preferences.reading_level === "string" &&
    preferences.reading_level.trim().length > 0
  ) {
    parts.push(`My reading level is ${preferences.reading_level.trim()}.`);
  }

  // If somehow all fields were empty after trimming, return null
  if (parts.length === 0) return null;

  // Join with a header line. The header signals to the LLM that this section
  // is distinct from the bookshelf listing.
  return `My reading preferences:\n${parts.join("\n")}`;
}

/**
 * Parse the LLM's response text to extract a JSON array of recommendations.
 * @param {string} rawResponse - The raw text from the LLM
 * @returns {Array<Object>} Parsed array of {title, author, reason} objects
 */
function parseRecommendations(rawResponse) {
  // Strategy 1: Direct JSON.parse
  // Best case: the model returned clean JSON with no wrapper tex
  try {
    const parsed = JSON.parse(rawResponse.trim());
    if (Array.isArray(parsed) && parsed.length > 0) {
      console.log(
        "[recommendationAI] Parsed via Strategy 1: direct JSON.parse",
      );
      return validateAndClean(parsed);
    }
  } catch {
    // try next strategy
  }

  // Strategy 2: Extract JSON array using regex
  // Common case: model adds text before/after the JSON, like "Here are my recommendations: [...]"
  // We look for the first '[' and last ']' to extract just the array.
  try {
    const arrayMatch = rawResponse.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(
          "[recommendationAI] Parsed via Strategy 2: regex array extraction",
        );
        return validateAndClean(parsed);
      }
    }
  } catch {
    // Regex found something but it wasn't valid JSON, try next
  }

  // Strategy 3: Extract from markdown code fences
  // Some models wrap JSON in ```json ... ``` blocks
  try {
    const fenceMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(
          "[recommendationAI] Parsed via Strategy 3: markdown fence extraction",
        );
        return validateAndClean(parsed);
      }
    }
  } catch {
    // Code fence content wasn't valid JSON
  }

  // Strategy 4: Try parsing as an object with a nested array
  // Some models return {"recommendations": [...]} instead of just [...]
  try {
    const objectMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      const parsed = JSON.parse(objectMatch[0]);
      // Look for any property that contains an array
      const arrayProp = Object.values(parsed).find((v) => Array.isArray(v));
      if (arrayProp && arrayProp.length > 0) {
        console.log(
          "[recommendationAI] Parsed via Strategy 4: nested object extraction",
        );
        return validateAndClean(arrayProp);
      }
    }
  } catch {
    // Object extraction failed
  }

  // All strategies failed — log the raw response for debugging and return empty
  console.error("[recommendationAI] All parsing strategies failed");
  console.error(`[recommendationAI] Raw response was: ${rawResponse}`);
  return [];
}

/**
 * Validates and cleans the parsed recommendation array.
 *
 * Why this step:
 * - LLM may include extra fields we don't need (or misspell field names)
 * - Some entries might be missing required fields (title)
 * - Reason text might be too long (we want 1-2 sentences for UI)
 * - We cap at NUM_RECOMMENDATIONS to enforce the limit even if the LLM over-generates
 *
 * @param {Array<Object>} recommendations - Raw parsed array from LLM
 * @returns {Array<Object>} Cleaned array with only valid entries
 */
function validateAndClean(recommendations) {
  const cleaned = recommendations
    // filter out entries without a title
    .filter(
      (rec) =>
        rec.title &&
        typeof rec.title === "string" &&
        rec.title.trim().length > 0,
    )
    // map to response fields
    .map((rec) => {
      let title = rec.title.trim();
      const author = (rec.author || "Unknown").trim();

      // LLM sometimes includes "by Author" in the title field.
      // Strip it if the title ends with " by <author>" (case-insensitive).
      if (author !== "Unknown") {
        const suffix = ` by ${author}`;
        if (title.toLowerCase().endsWith(suffix.toLocaleLowerCase())) {
          title = title.slice(0, -suffix.length).trim();
        }
      }

      return {
        title,
        author,
        // Truncat reason to 200 character
        reason: truncateReason(rec.reason || ""),
      };
    })
    // cap the number of recommendations to NUM_RECOMMENDATIONS
    .slice(0, NUM_RECOMMENDATIONS);

  console.log(
    `[recommendationAI] Validated ${cleaned.length} recommendations after cleaning`,
  );
  return cleaned;
}

/**
 * Truncates a recommendation reason to keep it short for the UI.
 *
 * Strategy:
 * - If under 200 characters, keep as-is
 * - If over 200, find the last sentence boundary before 200 chars
 * - If no sentence boundary found, hard-truncate at 200 with "..."
 *
 * @param {string} reason - The raw reason text from the LLM
 * @returns {string} Truncated reason
 */
function truncateReason(reason) {
  const trimmed = reason.trim();

  // Try to find the last sentence-ending punctuation before the 200-char mark.
  // This gives a cleaner cut than chopping mid-sentence.
  const cutoff = trimmed.substring(0, 200);
  const lastSentenceEnd = Math.max(
    cutoff.lastIndexOf("."),
    cutoff.lastIndexOf("!"),
    cutoff.lastIndexOf("?"),
  );

  // If we found a sentence boundary after at least 80 chars (not too short),
  // cut there. Otherwise hard-truncate with ellipsis.
  if (lastSentenceEnd > 80) {
    return trimmed.substring(0, lastSentenceEnd + 1);
  }

  return cutoff.trim() + "...";
}

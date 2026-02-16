/**
 * recommendationAI.js
 *
 * Generates personalized book recommendations using Meta's Llama 3.1 8B Instruct
 * model via HuggingFace Inference Providers.
 *
 * Architecture:
 * - Receives an array of recognized books (title, author, confidence, categories, description)
 * - Builds a structured prompt that asks the LLM to:
 *     1. Detect reading patterns from the user's bookshelf
 *     2. Generate 5 similar book recommendations
 *     3. Provide a short personalized reason for each recommendation
 * - Sends the prompt to the HuggingFace router (OpenAI-compatible chat completions API)
 * - Parses the JSON response with multiple fallback strategies
 * - Returns an array of 5 recommended books with title, author, and reason
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
const NUM_RECOMMENDATIONS = 5;
/**
 * Maximum tokens for the LLM response.
 * 5 recommendations with title + author + reason ≈ 400-600 tokens.
 * We set 1024 to give the model breathing room for JSON formatting.
 */
const MAX_TOKENS = 1024;

// ============================================================================
// MAIN EXPORT: generateRecommendations
// ============================================================================
/**
 * Generates personalized book recommendations based on recognized books.
 *
 * @param {Array<Object>} books - Array of recognized book objects. Each should have:
 *   - title {string}: Book title (e.g., "The Kite Runner")
 *   - author {string}: Author name (e.g., "Khaled Hosseini")
 *   - confidence {number}: AI confidence score 0.0-1.0 (used to weight importance)
 *   - categories {Array<string>}: Genre categories from Google Books (optional)
 *   - description {string}: Book synopsis from Google Books (optional)
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
 *
 * @throws {Error} If the API call fails or response cannot be parsed
 */
export async function generateRecommendations(books) {
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
  const prompt = buildPrompt(books);
  console.log(
    `[recommendationAI] Generating recommendations from ${books.length} books using ${MODEL_ID}`,
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
 * Builds the user-facing prompt that describes the bookshelf.
 *
 * Strategy:
 * - Sort books by confidence score (highest first) so the LLM treats high-confidence books as stronger signals of the user's taste
 * - Include categories and descriptions when available (richer context = better recs)
 * - Keep descriptions short (first 150 chars) to avoid blowing up token count
 * - Mark which books have low confidence so the LLM doesn't over-index on them
 *
 * @param {Array<Object>} books - Recognized books array
 * @returns {string} The formatted user prompt
 */
function buildPrompt(books) {
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

  return `Here are the books on my shelf:
            ${bookDescriptions.join("\n\n")}
        Based on these ${books.length} books, recommend ${NUM_RECOMMENDATIONS} similar books I would enjoy. Remember: respond ONLY with a JSON array, no other text.`;
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
    .map((rec) => ({
      title: rec.title.trim(),
      author: (rec.author || "Unknown").trim(),
      // Truncat reason to 200 character
      reason: truncateReason(rec.reason || ""),
    }))
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

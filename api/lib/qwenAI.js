// =============================================================================
// qwenAI.js - Real AI Book Recognition via Qwen2.5-VL-7B-Instruct
// =============================================================================
//
// PURPOSE:
//   This module sends a bookshelf image to Qwen2.5-VL-7B-Instruct (a vision-
//   language model hosted on HuggingFace Inference Providers) and asks it to
//   identify all visible book titles and authors. The model returns structured
//
// WHY QWEN2.5-VL:
//   - Qwen2.5-VL excels at reading text from images (OCR capability built-in)
//   - It supports structured JSON output natively
//   - The 7B variant balances accuracy with speed on free tier
//   - Uses OpenAI-compatible chat completions API (standard format)
//
// HOW IT WORKS:
//   1. Read the uploaded image file from /tmp as raw bytes
//   2. Convert those bytes to a base64-encoded string
//   3. Send to HuggingFace's router endpoint as an OpenAI-compatible request
//   4. The model "sees" the image and reads book spines/covers
//   5. It returns JSON with title, author, and confidence for each book
//   6. Parse and validate that JSON
//   7. Compute confidence scores using text quality heuristics
//   8. Return the same { books, metadata } format as mockAI.js
//
// ARCHITECTURE:
//   - Uses the HuggingFace Inference Providers "router" endpoint
//   - Router URL: https://router.huggingface.co/v1/chat/completions
//   - This is OpenAI-compatible, so the request format matches OpenAI's API
//   - Authentication: HuggingFace API token in the Authorization header
//   - Image is sent as a base64 data URL inside the message content array
//
// EXPORTS:
//   - recognizeBooks(imagePath) - main function, matches mockAI.js signature
//
// =============================================================================

// -----------------------------------------------------------------------------
// IMPORT: fs (Node.js built-in file system module)
// WHY: We need to read the uploaded image file from disk (/tmp directory)
//      so we can convert it to base64 for the API request.
//      We use the promises version (fs/promises) because our function is async
//      and we want to use await instead of callbacks.
// -----------------------------------------------------------------------------
import { clear } from "console";
import fs from "fs/promises";
import { type } from "os";

// -----------------------------------------------------------------------------
// IMPORT: path (Node.js built-in path module)
// WHY: We need to extract the file extension from the image path to determine
//      the correct MIME type (image/jpeg vs image/png vs image/heic).
//      path.extname() does this reliably across operating systems.
// -----------------------------------------------------------------------------
import path from "path";

// -----------------------------------------------------------------------------
// CONSTANT: HUGGINGFACE_ROUTER_URL
// WHY: This is HuggingFace's unified inference router endpoint. It follows
//      the OpenAI chat completions API format. The router automatically
//      routes our request to whichever inference provider is serving the
//      model we specify (e.g., Novita, Together, Hyperbolic, etc.).
//      We do NOT need to pick a specific provider - the router handles it.
// -----------------------------------------------------------------------------
const HUGGINGFACE_ROUTER_URL =
  "https://router.huggingface.co/v1/chat/completions";

// -----------------------------------------------------------------------------
// CONSTANT: MODEL_ID
// WHY: This is the HuggingFace model identifier for Qwen2.5-VL-7B-Instruct.
//      The 7B variant was chosen as the starting point because:
//      - It is available on multiple free-tier inference providers
//      - 7B parameters is a good balance of accuracy and speed
//      - We can upgrade to 72B later if accuracy is insufficient
//      The model ID must match exactly what HuggingFace expects.
// -----------------------------------------------------------------------------
const MODEL_ID = "Qwen/Qwen2.5-VL-7B-Instruct";

// -----------------------------------------------------------------------------
// CONSTANT: REQUEST_TIMEOUT_MS
// WHY: HuggingFace free tier can have cold starts where the model needs to
//      load into memory before processing. This can take 20-60 seconds.
//      We set a generous 120-second timeout to handle cold starts.
//      If the model is already warm (loaded), responses come in 5-15 seconds.
//      Without a timeout, the request could hang indefinitely.
// -----------------------------------------------------------------------------
const REQUEST_TIMEOUT_MS = 120000;

// -----------------------------------------------------------------------------
// CONSTANT: BOOK_RECOGNITION_PROMPT
// WHY: This is the text instruction we send alongside the image. The prompt
//      is carefully crafted to:
//      1. Tell the model exactly what to look for (book titles and authors)
//      2. Request JSON output format (so we can parse it programmatically)
//      3. Ask for a certainty indicator per book (to compute confidence)
//      4. Handle edge cases (unknown authors, partially visible titles)
//      5. Set clear boundaries (only return what you can actually read)
//
// PROMPT ENGINEERING NOTES:
//   - We ask for "certainty" as "high", "medium", or "low" instead of a
//     number because LLMs are better at categorical judgments than precise
//     numerical estimates. We convert these to numbers in our code.
//   - We explicitly say "Do NOT guess" to reduce hallucinations.
//   - We ask for ONLY the JSON array with no extra text, which makes
//     parsing more reliable.
//   - We include the example format so the model follows the structure.
// -----------------------------------------------------------------------------
const BOOK_RECOGNITION_PROMPT = `You are a book recognition expert. Look at this bookshelf image carefully.
Identify every book you can see. For each book, extract:
1. The title (as accurately as you can read it)
2. The author (if visible, otherwise use "Unknown")
3. Your certainty level: "high" if you can clearly read the title, "medium" if partially readable, "low" if you are guessing

Return ONLY a valid JSON array with no additional text, no markdown fences, no explanation. Example format:
[
  {"title": "The Great Gatsby", "author": "F. Scott Fitzgerald", "certainty": "high"},
  {"title": "1984", "author": "George Orwell", "certainty": "medium"}
]

Rules:
- Do NOT guess or hallucinate book titles. Only list books you can actually see.
- If you cannot read any text at all, return an empty array: []
- If the author is not visible, use "Unknown" as the author value.
- Include ALL books you can identify, even if only partially readable.
- Return ONLY the JSON array. No other text before or after it.`;

// =============================================================================
// FUNCTION: getMimeType(filePath)
// =============================================================================
// PURPOSE:
//   Determines the MIME type of an image file based on its file extension.
//   The MIME type is needed for the base64 data URL format that the API expects.
//
// HOW IT WORKS:
//   1. Extract the file extension using path.extname() (e.g., ".jpg")
//   2. Convert to lowercase for case-insensitive matching
//   3. Look up the extension in a mapping object
//   4. Return the corresponding MIME type string
//   5. Default to 'image/jpeg' if extension is unrecognized
//
// WHY WE NEED THIS:
//   The base64 data URL format requires the MIME type prefix:
//   "data:image/jpeg;base64,/9j/4AAQ..." - note the "image/jpeg" part.
//   If we send the wrong MIME type, the model may fail to decode the image.
//
// PARAMETERS:
//   filePath (string) - Full path to the image file (e.g., "/tmp/abc123.jpg")
//
// RETURNS:
//   string - MIME type (e.g., "image/jpeg", "image/png", "image/heic")
// -----------------------------------------------------------------------------
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".heic": "image/heic",
    ".heif": "image/heif",
  };
  // Return the matched MIME type, or default to JPEG if unrecognized.
  // We default to JPEG because it is the most common photo format and
  // most APIs handle it gracefully even if the actual format differs slightly.
  // If it throws errors for unsupported formats, we can add more specific handling later.
  return mimeTypes[ext] || "image/jpeg"; // Default to JPEG if unknown
}

// =============================================================================
// FUNCTION: convertImageToBase64(imagePath)
// =============================================================================
// PURPOSE:
//   Reads an image file from disk and converts it to a base64-encoded data URL.
//   This is how we embed the image directly in the API request body.
//
// HOW IT WORKS:
//   1. Read the entire file into a Node.js Buffer using fs.readFile()
//   2. Convert that Buffer to a base64 string using .toString('base64')
//   3. Determine the MIME type from the file extension
//   4. Combine into a data URL: "data:{mimeType};base64,{base64String}"
//
// WHY BASE64 INSTEAD OF A URL:
//   Our images are uploaded to /tmp on the Vercel serverless function.
//   They do NOT have a public URL - they only exist on the local filesystem.
//   The HuggingFace API accepts images either as:
//     a) A public URL (we don't have one)
//     b) A base64 data URL (we use this)
//   Base64 embeds the entire image data in the request, so no URL is needed.
//
// SIZE CONSIDERATION:
//   Base64 encoding increases file size by approximately 33%.
//   A 10MB image becomes ~13.3MB in base64. Our frontend limits uploads to
//   10MB, so the base64 version will be at most ~13.3MB. This is within
//   the HuggingFace API request size limits.
//
// PARAMETERS:
//   imagePath (string) - Full path to the image file (e.g., "/tmp/abc123.jpg")
//
// RETURNS:
//   string - Complete data URL (e.g., "data:image/jpeg;base64,/9j/4AAQ...")
//
// THROWS:
//   Error - If the file cannot be read (e.g., file not found, permission denied)
// -----------------------------------------------------------------------------
async function convertImageToBase64(imagePath) {
  // fs.readFile reads the entire file into memory as a Buffer (binary data)
  // no encoding specified, so we get raw bytes
  const imageBuffer = await fs.readFile(imagePath);

  // Convert the Buffer to a base64 string
  // Base64 uses only ASCII characters to represent binary data, which is safe to include in JSON
  const base64String = imageBuffer.toString("base64");

  // Get the MIME type based on the file extension
  const mimeType = getMimeType(imagePath);

  // Combine into a data URL format that the API expects
  // Construct the data URL. This is a standard format defined in RFC 2397.
  // Format: "data:[mediatype];base64,[data]"
  return `data:${mimeType};base64,${base64String}`;
}

// =============================================================================
// FUNCTION: computeConfidence(book)
// =============================================================================
// PURPOSE:
//   Computes a numerical confidence score (0.0 to 1.0) for a recognized book
//   based on text quality heuristics.
//
// WHY HEURISTICS INSTEAD OF MODEL-PROVIDED SCORES:
//   Vision-language models like Qwen2.5-VL do not return numerical confidence
//   scores with their text output. Instead, we asked the model to provide a
//   categorical "certainty" field ("high", "medium", "low") which we combine
//   with other text quality signals to compute a score.
//
// HOW THE SCORING WORKS:
//   We start with a base score from the model's self-reported certainty:
//     - "high"   -> 0.92 base (model is confident it read the title correctly)
//     - "medium" -> 0.78 base (model is somewhat sure)
//     - "low"    -> 0.60 base (model is guessing)
//
//   Then we apply adjustments based on text quality signals:
//     - Has both title AND author:  +0.05 (more data = more confidence)
//     - Title is very short (<3 chars): -0.05 (probably a partial read)
//     - Title is very long (>80 chars): -0.03 (likely includes extra text)
//     - Author is "Unknown":          -0.03 (less complete identification)
//
//   Final score is clamped between 0.0 and 1.0.
//
// PARAMETERS:
//   book (object) - A book object with { title, author, certainty } fields
//
// RETURNS:
//   number - Confidence score between 0.0 and 1.0
// -----------------------------------------------------------------------------
function computeConfidence(book) {
  // --- STEP 1: Base score from model's self-reported certainty ---
  // The model assigned one of three categories. We map these to numbers.
  // These base values were chosen to align with the BookCard.jsx thresholds:
  //   95%+ = green, 85-94% = blue, 75-84% = yellow, <75% = gray
  // So "high" starts in blue range, with bonuses pushing to green.
  // "medium" starts in yellow range, "low" starts in gray range.
  let score;

  // Normalize the certainty string: trim whitespace and convert to lowercase
  const certainty = (book.certainty || "medium")
    .toString()
    .trim()
    .toLowerCase();

  if (certainty === "high") {
    score = 0.92; // Model is confident, but we leave room for adjustments
  } else if (certainty === "medium") {
    score = 0.78; // Somewhat sure, but likely has some errors
  } else if (certainty === "low") {
    score = 0.6; // Guessing, high chance of being wrong
  } else {
    score = 0.5; // Unrecognized certainty value, assign a neutral score
  }

  // --- STEP 2: Bonus for having both title and author ---
  // If the model identified both fields, it likely got a good look at the book.
  // "Unknown" means the model could not read the author, so we don't give bonus.
  const hasAuthor =
    book.author &&
    book.author.trim() !== "" &&
    book.author.trim().toLowerCase() !== "unknown";
  if (hasAuthor) {
    score += 0.05; // Add a small boost for having more complete information
  }

  // --- STEP 3: Penalty for very short titles ---
  // A title under 3 characters is suspicious - probably a partial read.
  // Examples: "It" is a real book (2 chars) but most are longer.
  const titleLength = (book.title || "").trim().length;
  if (titleLength < 3) {
    score -= 0.05;
  }

  // --- STEP 4: Penalty for very long titles ---
  // If the "title" is over 80 characters, the model may have included
  // extra text (subtitle, description, neighboring book text, etc.)
  if (titleLength > 80) {
    score -= 0.03;
  }

  // --- STEP 5: Penalty for unknown author ---
  if (!hasAuthor) {
    score -= 0.03; // Less complete identification, so reduce confidence
  }

  // --- STEP 6: Clamp the score between 0.0 and 1.0 ---
  // Math.max ensures we never go below 0.
  // Math.min ensures we never go above 1.
  // Rounding to 2 decimal places avoids floating point artifacts like 0.9200000001
  return Math.round(Math.min(1, Math.max(0, score)) * 100) / 100; // Round to 2 decimal places
}

// =============================================================================
// FUNCTION: parseAIResponse(responseText)
// =============================================================================
// PURPOSE:
//   Parses the raw text response from Qwen2.5-VL into a structured array of
//   book objects. LLMs can be unpredictable in their output format, so this
//   function handles several edge cases and fallback strategies.
//
// WHY THIS IS COMPLEX:
//   Even though we ask the model to return "ONLY a valid JSON array", LLMs
//   sometimes add extra text around the JSON. Common issues:
//     - Markdown code fences: ```json [...] ```
//     - Leading/trailing explanation text: "Here are the books: [...]"
//     - Empty responses or "I cannot identify any books"
//     - Malformed JSON (missing commas, trailing commas, etc.)
//
// PARSING STRATEGY:
//   1. First, try to parse the raw response directly as JSON
//   2. If that fails, look for JSON array pattern [...] in the text
//   3. If that fails, try to extract from markdown code fences
//   4. If everything fails, return an empty array (no books found)
//
// PARAMETERS:
//   responseText (string) - Raw text output from the Qwen2.5-VL model
//
// RETURNS:
//   Array<object> - Array of book objects, each with { title, author, certainty }
//                   Returns empty array if parsing fails entirely
// -----------------------------------------------------------------------------
function parseAIResponse(responseText) {
  // check null or undefined or empty input
  if (
    !responseText ||
    typeof responseText !== "string" ||
    responseText.trim() === ""
  ) {
    console.warn("[qwenAI] Empty or invalid response text received");
    return [];
  }

  // remove leding/trailing whitespace
  const trimmed = responseText.trim();

  // Log the first 500 characters of the response for debugging.
  // In production, this helps diagnose parsing issues without logging
  // the entire response (which could be very long).
  console.log(
    "[qwenAI] Raw AI response (first 500 chars):",
    trimmed.substring(0, 500),
  );

  // =========================================================================
  // STRATEGY 1: Try direct JSON.parse on the entire response
  // =========================================================================
  // This is the ideal case - the model returned nothing but a JSON array.
  try {
    const parsed = JSON.parse(trimmed);

    // Verify it's actually an array (
    if (Array.isArray(parsed)) {
      console.log(
        `[qwenAI] Strategy 1 success: parsed ${parsed.length} books directly`,
      );
      return parsed;
    }

    // If the model returned an object with a "books" key, extract the array.
    // This handles cases like: {"books": [{...}, {...}]}
    if (parsed && Array.isArray(parsed.books)) {
      console.log(
        `[qwenAI] Strategy 1 success: parsed ${parsed.books.length} books from object`,
      );
      return parsed.books;
    }
  } catch (err) {
    // JSON.parse failed - the response contains non-JSON text.
    // This is expected; move to Strategy 2.
    console.log(
      "[qwenAI] Strategy 1 failed (direct parse), trying Strategy 2...",
    );
  }

  // =========================================================================
  // STRATEGY 2: Extract JSON array from within surrounding text
  // =========================================================================
  // The model may have included explanation text around the JSON, like:
  //   "Here are the books I found:\n[{...}, {...}]\nI hope this helps!"
  // We use a regex to find the outermost [...] pattern.
  //
  // REGEX EXPLANATION:
  //   \[        - Match a literal opening bracket
  //   ([\s\S]*) - Capture everything between brackets (including newlines)
  //              [\s\S] matches any character including newlines (unlike '.')
  //   \]        - Match a literal closing bracket
  //
  // WHY [\s\S]* INSTEAD OF .*:
  //   The dot (.) does not match newline characters by default in JavaScript.
  //   [\s\S] matches both whitespace (\s) and non-whitespace (\S) - everything.
  //   JSON arrays often span multiple lines, so we need to cross newlines.

  try {
    const jsonMatch = trimmed.match(/\[([\s\S]*)\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]); // jsonMatch[0] includes the brackets
      if (Array.isArray(parsed)) {
        console.log(
          `[qwenAI] Strategy 2 success: extracted and parsed ${parsed.length} books from text`,
        );
        return parsed;
      }
    }
  } catch (err) {
    // Parsing failed - the extracted text was not valid JSON.
    // This can happen if the model's output is malformed.
    console.log("[qwenAI] Strategy 2 failed, trying Strategy 3...");
  }

  // =========================================================================
  // STRATEGY 3: Extract from markdown code fences
  // =========================================================================
  // The model may have wrapped the JSON in markdown code fences:
  //   ```json
  //   [{...}, {...}]
  //   ```
  //
  // REGEX EXPLANATION:
  //   ```            - Match three backticks (start of code fence)
  //   (?:json)?      - Optionally match "json" (non-capturing group)
  //                    The ?: makes it non-capturing (we don't need this in results)
  //   \s*            - Match any whitespace (newlines between ``` and content)
  //   (\[[\s\S]*?\]) - Capture the JSON array (non-greedy with *?)
  //                    Non-greedy (*? instead of *) stops at the FIRST ]
  //                    that could close the array, preventing over-matching
  //   \s*            - Match trailing whitespace
  //   ```            - Match three closing backticks

  try {
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);

    if (codeBlockMatch && codeBlockMatch[1]) {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (Array.isArray(parsed)) {
        console.log(
          `[qwenAI] Strategy 3 success: extracted and parsed ${parsed.length} books from code block`,
        );
        return parsed;
      }
    }
  } catch (err) {
    // Parsing failed - the code block content was not valid JSON.
    // This can happen if the model's output is malformed or if it didn't follow instructions.
    console.log("[qwenAI] Strategy 3 failed, returning empty array...");
  }

  // =========================================================================
  // FALLBACK: All strategies failed - return empty array
  // =========================================================================
  // If we reach here, the model either:
  //   - Returned a text response like "I cannot identify any books"
  //   - Returned severely malformed JSON that no strategy could parse
  //   - Returned something completely unexpected
  // We log the full response for debugging and return an empty array.
  // The Results page will show the "No books detected" empty state.
  console.warn(
    "[qwenAI] All parsing strategies failed. Full response:",
    trimmed,
  );
  return [];
}

// =============================================================================
// FUNCTION: recognizeBooks(imagePath)
// =============================================================================
// PURPOSE:
//   Main exported function. Takes an image file path, sends it to Qwen2.5-VL
//   for analysis, and returns recognized books in the same format as mockAI.js.
//   This is the function called by upload-image.js.
//
// HOW IT WORKS (step by step):
//   1. Record the start time (for processing_time_ms in metadata)
//   2. Convert the image file to a base64 data URL
//   3. Build the OpenAI-compatible chat completions request
//   4. Send the request to HuggingFace's router endpoint
//   5. Handle HTTP errors (401, 429, 500, etc.)
//   6. Extract the model's text response
//   7. Parse the text into an array of book objects
//   8. Validate and clean each book object
//   9. Compute confidence scores using heuristics
//   10. Build and return the final response in mockAI-compatible format
//
// PARAMETERS:
//   imagePath (string) - Full path to the uploaded image (e.g., "/tmp/abc.jpg")
//
// RETURNS:
//   object - Same shape as mockAI.js returns:
//   {
//     books: [{ title, author, confidence }, ...],
//     metadata: { total_books_detected, processing_time_ms, model_used, mock }
//   }
//
// THROWS:
//   Error - On API failures, network errors, or timeout
//           The caller (upload-image.js) should catch and return 500 to frontend
// -----------------------------------------------------------------------------
export async function recognizeBooks(imagePath) {
  // --- STEP 1: Record start time ---
  // We use Date.now() which returns milliseconds since Unix epoch.
  // We subtract this from the end time to get processing duration.
  const startTime = Date.now();
  console.log(`[qwenAI] Starting book recognition for: ${imagePath}`);

  // --- STEP 2: Get the HuggingFace API key from environment variables ---
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "HUGGINGFACE_API_KEY is not set in environment variables. " +
        "Add it to .env.local or Vercel dashboard.",
    );
  }

  // --- STEP 3: Convert the image to base64 data URL ---
  // This reads the file from /tmp, encodes it, and returns the data URL string.
  // The data URL is what we embed in the API request message content.
  console.log("[qwenAI] Converting image to base64...");
  const imageDataUrl = await convertImageToBase64(imagePath);
  console.log(
    `[qwenAI] Base64 conversion complete (data URL length: ${imageDataUrl.length} chars)`,
  );

  // --- STEP 4: Build the request body ---
  // This follows the OpenAI chat completions format exactly.
  // The "messages" array contains one user message with two content items:
  //   1. An image_url item (the bookshelf photo as base64)
  //   2. A text item (our prompt asking to identify books)
  //
  // WHY THIS ORDER (image first, then text):
  //   Vision-language models process the image to build visual context first,
  //   then use the text prompt to know what to look for. Putting the image
  //   first is the conventional order in most VLM APIs.
  //
  // max_tokens: 4096 is generous enough for even large bookshelves.
  //   Each book entry is roughly 80-100 tokens in JSON format.
  //   4096 tokens can handle approximately 40-50 books.
  //
  // temperature: 0.1 is very low, making the model's output more deterministic
  //   and less creative. For OCR/extraction tasks, we want consistency and
  //   accuracy, not creative writing. 0.0 would be fully deterministic but
  //   0.1 adds a tiny bit of flexibility for edge cases.

  const requestBody = {
    model: MODEL_ID,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: imageDataUrl,
            },
          },
          {
            type: "text",
            text: BOOK_RECOGNITION_PROMPT,
          },
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0.1,
  };

  // --- STEP 5: Send the API request ---
  // We use the native fetch() API (available in Node.js 18+).
  // AbortController provides timeout functionality - if the request takes
  // longer than REQUEST_TIMEOUT_MS, the AbortSignal cancels it.
  console.log(
    `[qwenAI] Sending request to HuggingFace router (model: ${MODEL_ID})...`,
  );

  // Create an AbortController for timeout management.
  // AbortController is a web standard API that lets you cancel fetch requests.
  // When we call controller.abort(), the fetch promise rejects with an AbortError.
  const controller = new AbortController();

  // setTimeout returns a timer ID. After REQUEST_TIMEOUT_MS milliseconds,
  // it calls controller.abort() which cancels the fetch request.
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(HUGGINGFACE_ROUTER_URL, {
      method: "POST",
      headers: {
        // Authorization header with Bearer token - standard OAuth2 format.
        // HuggingFace uses this to identify our account and check permissions.
        Authorization: `Bearer ${apiKey}`,

        // Content-Type tells the server we are sending JSON in the request body.
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),

      // signal connects the fetch request to our AbortController.
      // If controller.abort() is called (by the timeout), this fetch is cancelled.
      signal: controller.signal,
    });
  } catch (fetchError) {
    // Clear the timeout timer since the request already completed (with error).
    // If we don't clear it, the timer would fire later and log a confusing error.
    clearTimeout(timeoutId);

    // Check if the error was caused by our timeout (AbortError)
    if (fetchError.name === "AbortError") {
      throw new Error(
        `HuggingFace API request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds. ` +
          "The model may be cold-starting. Please try again in 30-60 seconds.",
      );
    }

    // For any other fetch error (network failure, DNS error, etc.)
    throw new Error(`HuggingFace API request failed: ${fetchError.message}`);
  }

  // Clear the timeout since the response arrived successfully.
  clearTimeout(timeoutId);

  // --- STEP 6: Handle HTTP error responses ---
  // The fetch() API does NOT throw on HTTP errors (4xx, 5xx).
  // We must check response.ok (true for 200-299 status codes).

  if (!response.ok) {
    // Try to read the error body for more details.
    // Some HuggingFace errors return JSON with an "error" field.
    let errorBody = "";
    try {
      errorBody = await response.text();
    } catch {
      errorBody = "(could not read error body)";
    }

    // Provide specific error messages for common HTTP status codes.
    // This helps with debugging - instead of just "500 error" the user
    // sees a message that tells them what to do about it.
    const status = response.status;

    if (status === 401) {
      throw new Error(
        "HuggingFace API authentication failed (401). " +
          "Check that HUGGINGFACE_API_KEY is valid and has Inference permissions.",
      );
    }

    if (status === 429) {
      throw new Error(
        "HuggingFace API rate limit exceeded (429). " +
          "Free tier has limited requests. Wait a minute and try again.",
      );
    }

    if (status === 503) {
      throw new Error(
        "HuggingFace model is loading (503). " +
          "This is a cold start - the model needs to load into memory. " +
          "Please try again in 30-60 seconds.",
      );
    }

    // Generic error for any other status code (400, 500, etc.)
    throw new Error(
      `HuggingFace API returned status ${status}: ${errorBody.substring(0, 300)}`,
    );
  }

  // --- STEP 7: Parse the API response ---
  // The response follows OpenAI's chat completions format:
  // {
  //   "choices": [
  //     {
  //       "message": {
  //         "role": "assistant",
  //         "content": "[{\"title\": \"...\", ...}]"
  //       }
  //     }
  //   ]
  // }
  const data = await response.json();

  console.log("[qwenAI] API response received successfully");

  // Extract the text content from the model's response.
  // The ?. (optional chaining) prevents crashes if the response
  // structure is missing expected fields (defensive programming).
  const aiResponseText = data.choices?.[0]?.message?.content;

  if (!aiResponseText) {
    console.error(
      "[qwenAI] No content in API response. Full response:",
      JSON.stringify(data).substring(0, 500),
    );
    throw new Error(
      "HuggingFace API returned an empty response. The model may have failed to process the image.",
    );
  }

  // --- STEP 8: Parse the model's text into book objects ---
  const rawBooks = parseAIResponse(aiResponseText);

  // --- STEP 9: Validate, clean, and compute confidence for each book ---
  // The model might return objects with missing fields, extra fields,
  // or slightly wrong data types. We normalize everything here.
  const books = rawBooks
    // Filter out entries that do not have a title.
    // A book without a title is useless - we cannot display it.
    .filter(
      (book) =>
        book.title &&
        typeof book.title === "string" &&
        book.title.trim().length > 0,
    )
    // Transform each book into our standard format with computed confidence.
    .map((book) => ({
      // Trim whitespace from title (model sometimes adds leading/trailing spaces)
      title: book.title.trim(),

      // Author: use the model's value if present, otherwise "Unknown"
      // Also trim whitespace for clean display
      author:
        book.author &&
        typeof book.author === "string" &&
        book.author.trim().length > 0
          ? book.author.trim()
          : "Unknown",

      // Compute numerical confidence from the model's certainty + heuristics.
      // This replaces the raw "certainty" string with a number 0.0-1.0.
      confidence: computeConfidence(book),
    }));

  // --- STEP 10: Calculate processing time ---
  // Subtract start time from current time to get total milliseconds.
  const processingTimeMs = Date.now() - startTime;

  console.log(
    `[qwenAI] Recognition complete: ${books.length} books found in ${processingTimeMs}ms`,
  );
  // --- STEP 11: Build and return the response ---
  // This matches the EXACT format of mockAI.js so the rest of the app
  // (upload-image.js, database storage, Results page) works without changes.

  return {
    // Array of book objects, each with { title, author, confidence }
    books,

    // Metadata about the scan - displayed on Results page and stored in DB
    metadata: {
      total_books_detected: books.length, // Count of successfully parsed books
      processing_time_ms: processingTimeMs, // Total time including network + parsing
      model_used: "qwen2.5-vl-7b-instruct", // Identifies which model was used
      mock: false, // false = real AI, not mock data
    },
  };
}

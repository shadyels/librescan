import fs from "fs/promises";
import sharp from "sharp";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// qwen3.6-27b is the only image-capable model on Groq since llama-4-scout was
// shut down (2026-07-17). It is Preview tier, so treat availability as fragile.
const MODEL_ID = "qwen/qwen3.6-27b";
// Friendly label stored in metadata.model_used and rendered on the Results page,
// which applies a `capitalize` class — a raw ID renders as "Qwen/qwen3.6-27b".
const MODEL_LABEL = "Qwen 3.6 27B";
const REQUEST_TIMEOUT_MS = 45000;

/**
 * max_tokens is RESERVED against the tokens-per-minute quota, not merely billed:
 * Groq rejects a request whose (prompt + max_tokens) would exceed the remaining
 * TPM window. An image costs ~2,050 prompt tokens, and the free tier allows
 * 8,000 TPM — so every 1,000 tokens here directly costs throughput. 1,536 leaves
 * room for ~40 books (~1,500 tokens) while keeping each scan near ~3,600 tokens,
 * i.e. two scans per minute rather than one.
 */
const MAX_TOKENS = 1536;

// Hard ceiling on returned books. The model will pad a list toward max_tokens on
// dense library photos if left uncapped; this bounds both that and the number of
// downstream Google Books lookups a single scan can trigger.
const MAX_BOOKS = 40;

// Titles the model emits when it cannot actually read a spine. These must never
// reach enrichBooks() — they are not books, and each one burns a Google Books call.
const PLACEHOLDER_TITLES = new Set([
  "unknown", "untitled", "n/a", "na", "none", "book", "title", "book title",
  "unreadable", "illegible", "unknown title", "no title", "-", "?",
]);

const BOOK_RECOGNITION_PROMPT = `You are a book recognition expert examining a photo of a bookshelf.

Read the text printed on the book spines and covers, and list only the books whose text
you can actually read in this specific image.

Respond with a JSON object in exactly this shape, and nothing else:
{"books": [{"title": "The Great Gatsby", "author": "F. Scott Fitzgerald", "certainty": "high"}]}

Rules:
- CRITICAL: Only list a book if you can literally read its text in the image. Do NOT list
  famous or commonly-owned books from memory. An empty list is far better than a guessed one.
- Every "title" must be text visible in the image. Never output a placeholder like "Unknown".
- Never list the same book twice.
- certainty: "high" = clearly readable, "medium" = partially readable, "low" = barely legible.
- If the author is not readable, use "Unknown" for the author only (never for the title).
- List at most ${MAX_BOOKS} books. Prefer the most clearly readable ones.
- If the image is too low-resolution or distant to read spine text, return {"books": []}.
- Return ONLY the JSON object.`;

// Resize to longest edge ≤1568px and re-encode as JPEG. qwen3.6-27b accepts up to
// 20MB and 3 images, so this is well inside the limit; the resize exists to bound
// upload-to-API latency. Note it does NOT reduce token cost — measured prompt_tokens
// were ~2,050 at 1024px, 1200px and 1568px alike, so shrinking further buys no TPM
// headroom, only lost legibility.
// Always outputs image/jpeg regardless of input format (handles HEIC, PNG, JPEG).
async function convertImageToBase64(imagePath) {
  const imageBuffer = await fs.readFile(imagePath);
  const resized = await sharp(imageBuffer)
    .rotate() // honour EXIF orientation
    .resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return `data:image/jpeg;base64,${resized.toString("base64")}`;
}

function computeConfidence(book) {
  const certainty = (book.certainty || "medium").toString().trim().toLowerCase();
  let score;
  if (certainty === "high") score = 0.92;
  else if (certainty === "medium") score = 0.78;
  else if (certainty === "low") score = 0.6;
  else score = 0.5;

  const hasAuthor =
    book.author &&
    book.author.trim() !== "" &&
    book.author.trim().toLowerCase() !== "unknown";
  if (hasAuthor) score += 0.05;

  const titleLength = (book.title || "").trim().length;
  if (titleLength < 3) score -= 0.05;
  if (titleLength > 80) score -= 0.03;
  if (!hasAuthor) score -= 0.03;

  return Math.round(Math.min(1, Math.max(0, score)) * 100) / 100;
}

/**
 * Turns the model's raw array into the shape the rest of the app consumes,
 * dropping entries that are not really books.
 *
 * Why this is not just a title-is-non-empty check (which is what it replaced):
 * qwen3.6-27b has two observed failure modes on hard images, and the old filter
 * let both through because their titles are non-empty strings:
 *   1. Placeholder padding — dozens of entries all titled "Unknown".
 *   2. Repetition loops — the same title emitted 20+ times in a row.
 * Either one reaches enrichBooks() and spends a Google Books lookup per entry
 * against a 1,000/day counter, then renders as a wall of empty cards.
 *
 * Dedup is case-insensitive on title+author so "1984"/"1984 " collapse, but two
 * genuinely different editions by different authors both survive.
 */
function sanitizeBooks(rawBooks) {
  const seen = new Set();
  const kept = [];
  let droppedPlaceholder = 0;
  let droppedDuplicate = 0;

  for (const book of rawBooks) {
    if (!book || typeof book.title !== "string") continue;

    const title = book.title.trim();
    if (title.length === 0) continue;

    if (PLACEHOLDER_TITLES.has(title.toLowerCase())) {
      droppedPlaceholder++;
      continue;
    }

    const author =
      book.author && typeof book.author === "string" && book.author.trim().length > 0
        ? book.author.trim()
        : "Unknown";

    const key = `${title.toLowerCase()}::${author.toLowerCase()}`;
    if (seen.has(key)) {
      droppedDuplicate++;
      continue;
    }
    seen.add(key);

    kept.push({ title, author, confidence: computeConfidence(book) });
    if (kept.length >= MAX_BOOKS) break;
  }

  if (droppedPlaceholder > 0 || droppedDuplicate > 0) {
    console.warn(
      `[groqVisionAI] Dropped ${droppedPlaceholder} placeholder and ${droppedDuplicate} duplicate entries ` +
        `from ${rawBooks.length} raw results`,
    );
  }

  return kept;
}

function parseAIResponse(responseText) {
  if (!responseText || typeof responseText !== "string" || responseText.trim() === "") {
    console.warn("[groqVisionAI] Empty or invalid response text received");
    return [];
  }

  const trimmed = responseText.trim();
  console.log("[groqVisionAI] Raw AI response (first 500 chars):", trimmed.substring(0, 500));

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.books)) return parsed.books;
  } catch {
    console.log("[groqVisionAI] Strategy 1 failed, trying Strategy 2...");
  }

  try {
    const jsonMatch = trimmed.match(/\[([\s\S]*)\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    console.log("[groqVisionAI] Strategy 2 failed, trying Strategy 3...");
  }

  try {
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    console.log("[groqVisionAI] Strategy 3 failed, returning empty array...");
  }

  console.warn("[groqVisionAI] All parsing strategies failed. Full response:", trimmed);
  return [];
}

export async function recognizeBooks(imagePath) {
  const startTime = Date.now();
  console.log(`[groqVisionAI] Starting book recognition for: ${imagePath}`);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set in environment variables.");
  }

  console.log("[groqVisionAI] Resizing image...");
  const imageDataUrl = await convertImageToBase64(imagePath);
  console.log(`[groqVisionAI] Image ready (data URL length: ${imageDataUrl.length} chars)`);

  const requestBody = {
    model: MODEL_ID,
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageDataUrl } },
          { type: "text", text: BOOK_RECOGNITION_PROMPT },
        ],
      },
    ],
    max_tokens: MAX_TOKENS,
    temperature: 0.1,
    // json_object mode guarantees syntactically valid JSON. It cannot emit a
    // root-level array, which is why the prompt asks for {"books": [...]}.
    response_format: { type: "json_object" },
    /**
     * reasoning_effort MUST stay "none" (qwen accepts only "none" | "default").
     * This is load-bearing for correctness, not a latency tweak — measured:
     *   - "default" + json_object → HTTP 400 json_validate_failed, empty generation
     *   - "default" without json_object → all 4,096 tokens spent on reasoning,
     *     finish_reason "length", empty content
     * Thinking mode simply does not converge on a dense bookshelf image.
     */
    reasoning_effort: "none",
    // Belt-and-braces: keeps any <think> block out of message.content, which
    // would otherwise corrupt the regex fallbacks in parseAIResponse().
    reasoning_format: "hidden",
  };

  console.log(`[groqVisionAI] Sending request (model: ${MODEL_ID})...`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (fetchError) {
    clearTimeout(timeoutId);
    if (fetchError.name === "AbortError") {
      throw new Error(
        `Groq API request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`
      );
    }
    throw new Error(`Groq API request failed: ${fetchError.message}`);
  }

  clearTimeout(timeoutId);

  if (!response.ok) {
    let errorBody = "";
    try { errorBody = await response.text(); } catch { errorBody = "(could not read error body)"; }

    const status = response.status;
    if (status === 401) throw new Error("Groq API authentication failed (401). Check GROQ_API_KEY.");
    if (status === 429) throw new Error("Groq API rate limit exceeded (429). Wait and retry.");
    throw new Error(`Groq API returned status ${status}: ${errorBody.substring(0, 300)}`);
  }

  const data = await response.json();
  console.log("[groqVisionAI] API response received");

  const aiResponseText = data.choices?.[0]?.message?.content;
  if (!aiResponseText) {
    throw new Error("Groq API returned an empty response.");
  }

  const rawBooks = parseAIResponse(aiResponseText);
  const books = sanitizeBooks(rawBooks);

  const processingTimeMs = Date.now() - startTime;
  console.log(`[groqVisionAI] Recognition complete: ${books.length} books found in ${processingTimeMs}ms`);

  return {
    books,
    metadata: {
      total_books_detected: books.length,
      processing_time_ms: processingTimeMs,
      model_used: MODEL_LABEL,
      mock: false,
    },
  };
}

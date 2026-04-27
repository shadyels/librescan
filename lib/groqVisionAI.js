import fs from "fs/promises";
import sharp from "sharp";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL_ID = "meta-llama/llama-4-scout-17b-16e-instruct";
const REQUEST_TIMEOUT_MS = 30000;

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

// Resize to longest edge ≤1568px and re-encode as JPEG to stay under Groq's 4MB base64 limit.
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
    max_tokens: 4096,
    temperature: 0.1,
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

  const books = rawBooks
    .filter((book) => book.title && typeof book.title === "string" && book.title.trim().length > 0)
    .map((book) => ({
      title: book.title.trim(),
      author:
        book.author && typeof book.author === "string" && book.author.trim().length > 0
          ? book.author.trim()
          : "Unknown",
      confidence: computeConfidence(book),
    }));

  const processingTimeMs = Date.now() - startTime;
  console.log(`[groqVisionAI] Recognition complete: ${books.length} books found in ${processingTimeMs}ms`);

  return {
    books,
    metadata: {
      total_books_detected: books.length,
      processing_time_ms: processingTimeMs,
      model_used: "llama-4-scout-17b",
      mock: false,
    },
  };
}

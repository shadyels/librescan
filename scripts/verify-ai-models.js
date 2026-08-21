/**
 * End-to-end verification of the migrated AI modules against the live Groq API.
 * Exercises the real exported functions, not a reimplementation of them.
 * Run: npm run verify:ai
 *
 * Requires GROQ_API_KEY and test-image.jpg in the project root. Makes two live
 * Groq calls with a 65s pause between them, because the free tier's 8,000 TPM
 * ceiling cannot fit a vision call and a recommendation call in one window.
 */
import { recognizeBooks } from "../lib/groqVisionAI.js";
import { generateRecommendations } from "../lib/recommendationAI.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_IMAGE = path.join(__dirname, "..", "test-image.jpg");

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

// ---------------------------------------------------------------------------
console.log("\n=== 1. VISION: recognizeBooks(test-image.jpg) ===");
const vision = await recognizeBooks(TEST_IMAGE);
console.log(JSON.stringify(vision.metadata, null, 2));
console.log("books:", JSON.stringify(vision.books, null, 2).substring(0, 1200));

check("returns a books array", Array.isArray(vision.books));
check("model_used is the friendly label", vision.metadata.model_used === "Qwen 3.6 27B",
  `got "${vision.metadata.model_used}"`);
check("no placeholder titles survived",
  !vision.books.some((b) => /^(unknown|untitled|book|n\/a)$/i.test(b.title)));
check("no duplicate title+author pairs",
  new Set(vision.books.map((b) => `${b.title.toLowerCase()}::${b.author.toLowerCase()}`)).size
    === vision.books.length);
check("respects the 40-book cap", vision.books.length <= 40, `got ${vision.books.length}`);
check("every book has a numeric confidence",
  vision.books.every((b) => typeof b.confidence === "number" && b.confidence >= 0 && b.confidence <= 1));
check("every author field is a non-empty string",
  vision.books.every((b) => typeof b.author === "string" && b.author.length > 0));

console.log("\n--- waiting 65s for the TPM window ---");
await new Promise((r) => setTimeout(r, 65000));

// ---------------------------------------------------------------------------
console.log("\n=== 2. TEXT: generateRecommendations(books, preferences) ===");
const shelf = [
  { title: "Dune", author: "Frank Herbert", confidence: 0.92,
    categories: ["Science Fiction"], description: "Paul Atreides on the desert planet Arrakis." },
  { title: "Neuromancer", author: "William Gibson", confidence: 0.88,
    categories: ["Science Fiction", "Cyberpunk"], description: "A washed-up console cowboy takes one last job." },
  { title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", confidence: 0.85,
    categories: ["Science Fiction"], description: "An envoy on a planet of ambisexual humans." },
];
const prefs = { genres: ["Science Fiction", "Literary Fiction"], authors: ["Isaac Asimov"], language: "English" };

const recs = await generateRecommendations(shelf, prefs);
console.log(JSON.stringify(recs.metadata, null, 2));
console.log(recs.recommendations.map((r) => `  - "${r.title}" / ${r.author}\n      ${r.reason}`).join("\n"));

check("returns exactly 8 recommendations", recs.recommendations.length === 8,
  `got ${recs.recommendations.length}`);
check("model_used is the friendly label", recs.metadata.model_used === "GPT-OSS 120B",
  `got "${recs.metadata.model_used}"`);
check("every rec has title, author and reason",
  recs.recommendations.every((r) => r.title && r.author && r.reason));
check("no reason exceeds 210 chars (truncateReason)",
  recs.recommendations.every((r) => r.reason.length <= 210));
check("no shelf book was recommended back",
  !recs.recommendations.some((r) =>
    shelf.some((b) => b.title.toLowerCase() === r.title.toLowerCase())));
check("no 'by Author' suffix leaked into titles",
  !recs.recommendations.some((r) => / by /i.test(r.title)));

// ---------------------------------------------------------------------------
console.log("\n=== 3. TEXT: empty-shelf short circuit (no API call) ===");
const empty = await generateRecommendations([], null);
check("returns no recommendations", empty.recommendations.length === 0);
check("reports 0ms processing time", empty.metadata.processing_time_ms === 0);
check("still reports the friendly label", empty.metadata.model_used === "GPT-OSS 120B");

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

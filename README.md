# LibreScan

**Scan your bookshelf. Discover your next read.**

LibreScan is a full-stack web app that uses AI vision to recognize books from a photo of your bookshelf, then generates personalized reading recommendations based on what you already own and your reading preferences.

**Live Demo:** [librescan.shadyels.com](https://librescan.shadyels.com/)

---

## How It Works

1. **Snap a photo** of your bookshelf from your phone or upload an image from your desktop.
2. **AI vision** reads the spines and covers, identifying titles and authors with confidence scoring.
3. **Book metadata** is enriched automatically — real covers, descriptions, genres, and ISBNs from Google Books.
4. **Set your preferences** — favorite genres, authors, preferred language, and reading level.
5. **Get recommendations** — a second AI model analyzes your shelf and preferences to suggest 8 books you'd enjoy, each with a personalized reason.
6. **Save and revisit** — bookmark recommendation sets to come back to later.

---

## Tech Stack

**Frontend**
- React 19 with Vite 6
- Tailwind CSS v4
- React Router DOM v7
- IndexedDB for client-side session persistence

**Backend**
- Node.js serverless functions on Vercel
- PostgreSQL via Neon (serverless)
- Formidable for multipart file uploads

**AI & APIs**
- Llama 4 Scout 17B (Groq) — vision model for book recognition and language model for personalized recommendations
- Google Books API — metadata enrichment (covers, ISBNs, descriptions, categories)

---

## Architecture Highlights

- **Write-time cache, read-time join** — Book metadata is fetched from Google Books once and cached in a dedicated `book_cache` table. Scan results join from cache at read time, so 50 users scanning the same book don't create 50 copies of the same cover URL.

- **Two-phase recommendation loading** — The recommendations page first checks the database for existing results (instant). Only if none exist does it trigger the LLM (10–30 seconds). Revisits are always fast.

- **Preferences as natural language prompt injection** — User reading preferences are formatted as conversational sentences and injected into the LLM's user message, letting the model weigh them flexibly alongside bookshelf analysis rather than treating them as hard filters.

- **Daily usage tracking with per-API counters** — Each external API (Groq, Google Books) has its own daily request counter with a configurable limit. When any API hits its ceiling, all operations are blocked to prevent unexpected costs.

- **Serverless function budgeting** — Shared libraries live outside the `api/` directory to avoid Vercel's per-file serverless function count. Imported files are bundled automatically at deploy time.

---

## Project Structure

```
librescan/
├── src/                          # React frontend
│   ├── components/               # BookCard, RecommendationCard, CameraCapture, etc.
│   ├── pages/                    # Home, Results, Recommendations, Preferences, Saved
│   ├── contexts/                 # Session management (React Context + IndexedDB)
│   └── styles/                   # Tailwind entry point
├── api/                          # Vercel serverless functions
│   ├── lib/                      # Database, AI clients, Google Books wrapper
│   ├── scan/[scanId].js          # Dynamic route for scan results
│   └── recommendations/[scanId].js
├── lib/                          # Shared libraries (outside api/ for function budgeting)
└── scripts/                      # Database setup and maintenance
```

---

## Key Technical Decisions

| Decision | Why |
|---|---|
| Llama 4 Scout over HuggingFace models | HuggingFace has cold starts (up to 60s) and unstable provider routing. Groq offers consistent low-latency inference on an OpenAI-compatible endpoint. |
| Single model for vision + recommendations | Llama 4 Scout handles both multimodal book recognition and text-only recommendation generation, reducing API surface and provider dependencies. |
| Formidable over Multer | Multer caused "Unexpected end of form" errors in Vercel's serverless environment. Formidable is built for it. |
| JSONB for recommendations | All 8 recommendations stored as one blob per scan. Users save/delete entire sets, not individual books — one row, one operation. |
| Raw AI output in scans, metadata in cache | Avoids duplicating cover URLs and descriptions across every scan that detects the same book. |

---

## Status

The core feature set is complete: scan → recognize → enrich → recommend → save. The app is deployed and functional at the demo link above.

---

## Author

**Shadi El Sangedy**

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

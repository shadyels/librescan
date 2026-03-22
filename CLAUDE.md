# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs Vite on :3000 and Vercel dev emulator on :3001 in parallel)
npm run dev

# Production build (frontend only; backend deploys via Vercel)
npm run build

# Database setup (creates all tables and triggers)
npm run db:setup

# Test image upload endpoint
npm run test:upload

# Database maintenance
npm run db:check                        # Check sessions table
npm run db:clear-cache                  # Flush book_cache table
npm run db:cleanup-recommendations      # Delete old unsaved recommendations
```

There are no automated tests. Validation is done via manual scripts in `scripts/`.

## Architecture

LibreScan is a full-stack AI bookshelf scanner: users upload a photo of their bookshelf, the app identifies books using a vision model, enriches them with Google Books metadata, and generates personalized recommendations via an LLM.

**Frontend**: React 19 SPA (Vite 6 + Tailwind CSS v4) with React Router v7. Entry: `index.html` → `src/main.jsx` → `SessionContext` → `App.jsx`.

**Backend**: Vercel serverless functions under `api/`. Each file is a standalone function — no shared Express app. Shared utilities live in `api/lib/`.

**Database**: PostgreSQL (Neon serverless) accessed via `pg` connection pool in `api/lib/database.js`.

### Core Data Flow

1. **Upload** (`POST /api/upload-image`): Formidable parses multipart, Qwen2.5-VL-7B (HuggingFace) recognizes books from the image, `enrichBooks()` fetches Google Books metadata and caches it in `book_cache`, scan stored in `scans` table.

2. **Results** (`GET /api/scan/:scanId`): JOINs `scans` (raw AI JSONB) with `book_cache` (enriched metadata) using case-insensitive title+author lookup.

3. **Recommendations** (`POST /api/generate-recommendations`): Fetches scan + user preferences, calls Llama 3.1 8B, enriches results, stores one JSONB blob per scan in `recommendations` table.

### Key Design Decisions

- **Formidable, not Multer**: Multer fails in Vercel serverless; Formidable handles multipart reliably.
- **Write-time caching**: `book_cache` is populated on every scan/recommendation. Reads JOIN against it — no duplicate metadata per book across users.
- **JSONB blobs**: Recommendations stored as a single JSONB array (users save/delete full sets, not individual books).
- **Preferences as prompt injection**: User preferences are formatted as natural language and injected into the Llama prompt — allows model flexibility rather than hard filters.
- **Idempotent recommendations**: `generate-recommendations.js` checks for existing cached recommendations before calling the LLM to prevent duplicate API usage.
- **Usage tracking**: `lib/usageTracking.js` enforces daily API limits. A `daily_limit_hit` flag blocks all operations if any API hits its ceiling.

### Session Management

Client stores a `device_id` (UUID v4) in IndexedDB via `src/utils/sessionManager.js`. This ID is sent with every request to scope scans, preferences, and recommendations per device.

## Environment Variables

Required in `.env.local`:

```
DATABASE_URL=           # PostgreSQL connection string (Neon)
HUGGINGFACE_API_KEY=    # For Qwen2.5-VL (vision) and Llama 3.1 8B (recommendations)
GOOGLE_BOOKS_API_KEY=   # Book metadata and cover images
USE_MOCK_AI=false       # Set to "true" to skip real AI calls during development
```

## Deployment

Deployed to Vercel. `vercel.json` rewrites all non-`/api` routes to `index.html` for SPA routing. The `lib/` directory at project root (not inside `api/`) is for shared modules that need to be bundled outside the `api/` tree by Vercel.

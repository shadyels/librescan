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

**Frontend**: React 19 SPA (Vite 6 + Tailwind CSS v4) with React Router v7. Entry: `index.html` → `src/main.jsx` → `SessionProvider` → `AuthProvider` → `App.jsx`.

**Backend**: Vercel serverless functions under `api/`. Each file is a standalone function — no shared Express app. Shared utilities live in `api/lib/`.

**Database**: PostgreSQL (Neon serverless) accessed via `pg` connection pool in `api/lib/database.js`.

### Identity Model

Two identity primitives coexist:

1. **`users`** — permanent accounts (email + password). Created via `/api/auth/signup`. Identified by `user_id` (UUID).
2. **`device_id`** — ephemeral anonymous identifier stored in IndexedDB via `src/utils/sessionManager.js`. Used only to scope an anon scan for temporary preview, and to enable the claim flow on login/signup.

**Session auth**: opaque random token (32 bytes, base64url) set as `librescan_session` httpOnly cookie. The server stores only the SHA-256 hash in `user_sessions` — a DB leak does not grant live sessions. Sessions expire after 30 days.

**Anon scope**: anonymous users can upload and view recognized books (scan preview). Preferences, recommendations, and saved scans require a logged-in account.

**Claim flow**: on login/signup, the most recent anon scan for the provided `device_id` is automatically transferred to the new user (`user_id` set, `device_id` nulled).

### Database Schema

- **`users`**: `id UUID PK, email CITEXT UNIQUE NOT NULL, password_hash TEXT, created_at`
- **`user_sessions`**: `token_hash CHAR(64) PK, user_id UUID FK, created_at, expires_at`
- **`anon_sessions`**: `device_id UUID PK, created_at, last_active` — ephemeral, for anon scan scoping
- **`scans`**: `scan_id UUID PK, user_id UUID NULL FK, device_id UUID NULL FK, scan_date, recognized_books JSONB` — CHECK ensures one of user_id or device_id is non-null
- **`preferences`**: `user_id UUID PK FK` — logged-in users only
- **`recommendations`**: `recommendation_id UUID PK, scan_id UUID UNIQUE FK, user_id UUID FK, book_data JSONB, saved BOOL`
- **`book_cache`**, **`api_usage_tracking`**: unchanged

### Auth Endpoints

- `POST /api/auth/signup` — create account, set session cookie, optional claim anon scan
- `POST /api/auth/login` — verify password, set session cookie, optional claim anon scan
- `POST /api/auth/logout` — delete session, clear cookie
- `GET /api/auth/me` — return current user or 401

Auth helper: `api/lib/auth.js` — exports `hashPassword`, `verifyPassword`, `generateSessionToken`, `hashToken`, `createSession`, `getCurrentUser`, `requireUser`, `serializeSessionCookie`, `clearSessionCookie`.

### Core Data Flow

1. **Upload** (`POST /api/upload-image`): Formidable parses multipart, `sharp` downsizes image to ≤1568px JPEG, `llama-4-scout-17b` (Groq) recognizes books via vision, `enrichBooks()` fetches Google Books metadata and caches it in `book_cache`, scan stored in `scans` table. If cookie present → `user_id`; else → `device_id`.

2. **Results** (`GET /api/scan/:scanId`): JOINs `scans` with `book_cache`. Ownership check: user session cookie OR `?device_id=` query param for anon access.

3. **Recommendations** (`POST /api/generate-recommendations`): Requires login. Fetches scan + user preferences, calls `llama-4-scout-17b` (Groq), enriches results, stores one JSONB blob per scan in `recommendations` table.

### Key Design Decisions

- **Formidable, not Multer**: Multer fails in Vercel serverless; Formidable handles multipart reliably.
- **Write-time caching**: `book_cache` is populated on every scan/recommendation. Reads JOIN against it — no duplicate metadata per book across users.
- **JSONB blobs**: Recommendations stored as a single JSONB array (users save/delete full sets, not individual books).
- **Preferences as prompt injection**: User preferences are formatted as natural language and injected into the llama-4-scout prompt — allows model flexibility rather than hard filters.
- **Image downscaling**: `sharp` resizes uploads to ≤1568px JPEG before base64 encoding to stay within Groq's 4MB base64 per-request limit. Preserves 10MB upload cap for users.
- **Idempotent recommendations**: `generate-recommendations.js` checks for existing cached recommendations before calling the LLM to prevent duplicate API usage.
- **Usage tracking**: `lib/usageTracking.js` enforces daily API limits. A `daily_limit_hit` flag blocks all operations if any API hits its ceiling.
- **Token security**: session tokens stored as SHA-256 hash only in DB. Raw token lives only in the cookie and is never persisted.
- **Claim SQL pattern**: PostgreSQL UPDATE with subquery (`WHERE scan_id = (SELECT ... ORDER BY scan_date DESC LIMIT 1)`) — direct UPDATE with ORDER BY/LIMIT is not supported.
- **Anon Results URL**: `Home.jsx` passes `?device_id=xxx` when navigating to `/results/:scanId` after an anon upload, so the backend ownership check can verify access without a session cookie.

## Environment Variables

Required in `.env.local`:

```
DATABASE_URL=           # PostgreSQL connection string (Neon)
GROQ_API_KEY=           # For llama-4-scout-17b (vision + recommendations)
GOOGLE_BOOKS_API_KEY=   # Book metadata and cover images
USE_MOCK_AI=false       # Set to "true" to skip real AI calls during development
```

## Deployment

Deployed to Vercel. `vercel.json` rewrites all non-`/api` routes to `index.html` for SPA routing. The `lib/` directory at project root (not inside `api/`) is for shared modules that need to be bundled outside the `api/` tree by Vercel.

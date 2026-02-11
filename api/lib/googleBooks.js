// =============================================================================
// api/lib/googleBooks.js
// Purpose: Google Books API wrapper with database caching.
//
// WHAT THIS MODULE DOES:
//   Takes a list of books (title + author from AI recognition) and enriches
//   each one with metadata from Google Books API: cover image, ISBN, description,
//   and categories/genres.
//
// CACHING STRATEGY:
//   Before calling Google Books API for any book, we check the book_cache table
//   using a case-insensitive title+author lookup. If the book is already cached,
//   we return the cached data and skip the API call entirely. This saves our
//   daily API quota (1,000 requests/day on the free tier).
//
//   Cache entries are stored indefinitely (no TTL). The cache can be manually
//   cleared by running: npm run db:clear-cache
//
// EXPORTS:
//   enrichBooks(books) - Main function. Takes array of { title, author, confidence }
//                        and returns the same array with added metadata fields.
//
// DEPENDENCIES:
//   - Node.js built-in: fetch (available in Node 18+)
//   - Internal: ./database.js (for cache reads/writes)
//   - External: uuid (for generating cache_id)
// =============================================================================

// -----------------------------------------------------------------------------
// IMPORT: query function from our database module.
// WHY: We need to read from and write to the book_cache table.
//      The query function handles connection pooling, SSL, and parameterized
//      queries for us. We don't create our own Pool here to avoid duplicate
//      connections.
// -----------------------------------------------------------------------------
import { query } from './database.js'

// -----------------------------------------------------------------------------
// IMPORT: v4 as uuidv4 from the uuid package.
// WHY: We need to generate unique UUIDs for the cache_id primary key when
//      inserting new entries into book_cache. We use v4 (random) UUIDs
//      consistently across the project (session IDs, scan IDs, etc.).
// -----------------------------------------------------------------------------
import { v4 as uuidv4 } from 'uuid'

// =============================================================================
// CONSTANTS
// =============================================================================

// -----------------------------------------------------------------------------
// GOOGLE_BOOKS_API_URL
// WHY: This is the Google Books API volumes endpoint. We use the "volumes" resource
//      because we're searching for books by title and author.
//      Docs: https://developers.google.com/books/docs/v1/using#PerformingSearch
// -----------------------------------------------------------------------------
const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes'

// -----------------------------------------------------------------------------
// REQUEST_TIMEOUT_MS
// WHY: Google Books API is generally fast (200-500ms), but we add a timeout
//      to prevent a single slow request from blocking the entire scan.
//      5 seconds is generous - if it takes longer, something is wrong.
// -----------------------------------------------------------------------------
const REQUEST_TIMEOUT_MS = 5000

// -----------------------------------------------------------------------------
// DELAY_BETWEEN_REQUESTS_MS
// WHY: Rate limiting courtesy. Google Books free tier allows 1,000 requests/day.
//      Adding a small delay between requests prevents us from hitting any
//      per-second rate limits and is polite to the API.
//      100ms means 10 books take about 1 second of delay (plus actual API time).
// -----------------------------------------------------------------------------
const DELAY_BETWEEN_REQUESTS_MS = 100

// =============================================================================
// enrichBooks(books)
//
// Purpose: Takes an array of AI-recognized books and enriches each one with
//          metadata from Google Books API. Uses database caching to minimize
//          API calls.
//
// Args:
//   books (Array): Array of objects, each with at minimum:
//     - title (string): Book title from AI recognition
//     - author (string): Author name from AI recognition
//     - confidence (number): AI confidence score (0.0 - 1.0)
//
// Returns:
//   Array of enriched book objects. Each object has the original fields plus:
//     - isbn (string|null): ISBN from Google Books, or null if not found
//     - cover_url (string|null): URL to cover image, or null if not found
//     - description (string|null): Book synopsis, or null if not found
//     - categories (string[]): Array of genre/category strings, empty if none
//     - enriched (boolean): true if Google Books data was found, false otherwise
//
// Error Handling:
//   - If the Google Books API key is missing, logs a warning and returns books
//     unchanged (with enriched: false). This allows the app to work without
//     the API key - you just don't get covers and metadata.
//   - If an individual book lookup fails, that book gets enriched: false but
//     the rest of the books still get processed. One failure doesn't break all.
// =============================================================================
export async function enrichBooks(books) {
  // ---------------------------------------------------------------------------
  // Guard: Check for API key before doing anything.
  // WHY: Rather than crashing, we gracefully degrade. The scan still works,
  //      you just get the AI-recognized titles without covers. This is important
  //      for development - you might not have the API key set up yet.
  // ---------------------------------------------------------------------------
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY

  if (!apiKey) {
    console.warn('[googleBooks] GOOGLE_BOOKS_API_KEY is not set. Skipping enrichment.')
    return books.map(book => ({
      ...book,
      isbn: null,
      cover_url: null,
      description: null,
      categories: [],
      enriched: false,
    }))
  }

  // ---------------------------------------------------------------------------
  // Guard: If no books to enrich, return immediately.
  // WHY: Avoids unnecessary work and potential edge cases with empty arrays.
  // ---------------------------------------------------------------------------
  if (!books || books.length === 0) {
    console.log('[googleBooks] No books to enrich.')
    return []
  }

  console.log(`[googleBooks] Enriching ${books.length} books...`)

  // ---------------------------------------------------------------------------
  // Process each book sequentially (not in parallel).
  // WHY SEQUENTIAL vs PARALLEL:
  //   - Parallel (Promise.all) would be faster but risks hitting rate limits
  //     if there are many books (e.g., 15+ books on a shelf).
  //   - Sequential with a small delay is safer for the free tier.
  //   - The total extra time is small: 10 books * 100ms delay = 1 second.
  //   - The user is already waiting for AI processing (5-60s), so an extra
  //     1-3 seconds for enrichment is barely noticeable.
  // ---------------------------------------------------------------------------
  const enrichedBooks = []

  for (let i = 0; i < books.length; i++) {
    const book = books[i]

    try {
      // -----------------------------------------------------------------------
      // Step 1: Check the cache first.
      // WHY: If we already have metadata for this book from a previous scan,
      //      we skip the Google Books API call entirely. This saves quota and
      //      makes the response faster.
      // -----------------------------------------------------------------------
      const cached = await checkCache(book.title, book.author)

      if (cached) {
        console.log(`[googleBooks] Cache HIT: "${book.title}"`)
        enrichedBooks.push({
          ...book,
          isbn: cached.isbn,
          cover_url: cached.cover_url,
          description: cached.description,
          categories: cached.categories || [],
          enriched: true,
        })
        // No delay needed for cache hits - we didn't call the API
        continue
      }

      // -----------------------------------------------------------------------
      // Step 2: Cache miss - call Google Books API.
      // -----------------------------------------------------------------------
      console.log(`[googleBooks] Cache MISS: "${book.title}" - calling API...`)
      const metadata = await fetchFromGoogleBooks(book.title, book.author, apiKey)

      if (metadata) {
        // ---------------------------------------------------------------------
        // Step 3: Store the result in the cache for future lookups.
        // WHY: Next time any user scans a shelf with this book, we skip the API.
        // ---------------------------------------------------------------------
        await storeInCache(book.title, book.author, metadata)

        enrichedBooks.push({
          ...book,
          isbn: metadata.isbn,
          cover_url: metadata.cover_url,
          description: metadata.description,
          categories: metadata.categories || [],
          enriched: true,
        })
      } else {
        // ---------------------------------------------------------------------
        // Google Books had no results for this book.
        // WHY we still cache "no result": To avoid calling the API again for
        // the same book that Google doesn't have. We store it with null fields.
        // ---------------------------------------------------------------------
        console.log(`[googleBooks] No results found for: "${book.title}"`)
        await storeInCache(book.title, book.author, {
          isbn: null,
          cover_url: null,
          description: null,
          categories: [],
        })

        enrichedBooks.push({
          ...book,
          isbn: null,
          cover_url: null,
          description: null,
          categories: [],
          enriched: false,
        })
      }
    } catch (error) {
      // -----------------------------------------------------------------------
      // If enrichment fails for ONE book, we don't let it break the rest.
      // WHY: The user should still see their scan results even if Google Books
      //      is down or returns an error for one specific book.
      // We do NOT cache errors - the next scan might succeed.
      // -----------------------------------------------------------------------
      console.error(`[googleBooks] Error enriching "${book.title}":`, error.message)
      enrichedBooks.push({
        ...book,
        isbn: null,
        cover_url: null,
        description: null,
        categories: [],
        enriched: false,
      })
    }

    // -------------------------------------------------------------------------
    // Add delay between API calls (only if we actually called the API).
    // WHY: Rate limiting courtesy. We check if the book was from cache - if so,
    //      no delay needed. The delay only applies to actual API calls.
    // We skip the delay after the last book (no point waiting after we're done).
    // -------------------------------------------------------------------------
    if (i < books.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS))
    }
  }

  // ---------------------------------------------------------------------------
  // Count how many books were successfully enriched for logging.
  // WHY: Gives us a quick summary in the server logs for debugging.
  // ---------------------------------------------------------------------------
  const enrichedCount = enrichedBooks.filter(b => b.enriched).length
  console.log(`[googleBooks] Enrichment complete: ${enrichedCount}/${books.length} books enriched.`)

  return enrichedBooks
}

// =============================================================================
// checkCache(title, author)
//
// Purpose: Looks up a book in the book_cache table by title and author.
//          Uses case-insensitive matching via pre-computed lowercase columns.
//
// Args:
//   title (string): Book title from AI recognition.
//   author (string): Author name from AI recognition. Can be null/undefined.
//
// Returns:
//   Object with { isbn, cover_url, description, categories } if found.
//   null if not found in cache.
//
// WHY LOWERCASE MATCHING:
//   The AI might return "The Great Gatsby" in one scan and "the great gatsby"
//   in another. By comparing lowercase versions, we treat these as the same
//   book and avoid duplicate cache entries and duplicate API calls.
//
// WHY COALESCE for author:
//   Some books might be recognized without an author (author is null or empty).
//   We normalize these to empty string ('') so the unique index works correctly.
//   Without this, NULL != NULL in SQL, so two entries for the same book with
//   NULL author would both be inserted (violating our uniqueness intent).
// =============================================================================
async function checkCache(title, author) {
  // ---------------------------------------------------------------------------
  // Normalize inputs to lowercase for case-insensitive matching.
  // trim() removes leading/trailing whitespace that could cause mismatches.
  // If author is falsy (null, undefined, empty string), we normalize to ''.
  // ---------------------------------------------------------------------------
  const titleLower = title.toLowerCase().trim()
  const authorLower = (author || '').toLowerCase().trim()

  // ---------------------------------------------------------------------------
  // Query the cache using the composite unique index (title_lower, author_lower).
  // WHY parameterized query ($1, $2): Prevents SQL injection attacks.
  //   Even though title and author come from our own AI, it's a good habit
  //   and protects against edge cases (book titles with quotes, etc.).
  // COALESCE(author_lower, ''): Handles the case where author_lower in the DB
  //   is NULL. COALESCE returns the first non-null argument, so NULL becomes ''.
  // ---------------------------------------------------------------------------
  const result = await query(
    `SELECT isbn, cover_url, description, categories
     FROM book_cache
     WHERE title_lower = $1 AND COALESCE(author_lower, '') = $2`,
    [titleLower, authorLower]
  )

  // ---------------------------------------------------------------------------
  // result.rows is an array. If empty, the book is not in the cache.
  // If found, return the first (and only, due to unique index) row.
  // ---------------------------------------------------------------------------
  if (result.rows.length === 0) {
    return null
  }

  return result.rows[0]
}

// =============================================================================
// storeInCache(title, author, metadata)
//
// Purpose: Inserts a book's Google Books metadata into the cache table.
//
// Args:
//   title (string): Original title from AI (preserves casing for display).
//   author (string): Original author from AI (preserves casing for display).
//   metadata (Object): { isbn, cover_url, description, categories }
//
// Returns: Nothing.
//
// ON CONFLICT: If a row with the same (title_lower, author_lower) already exists,
//   we UPDATE the existing row instead of throwing an error. This handles the
//   race condition where two concurrent scans detect the same book and both
//   try to insert at the same time. The second insert becomes an update.
//
// WHY STORE BOTH original AND lowercase:
//   - Original (title, author): For display purposes. "The Great Gatsby" looks
//     better than "the great gatsby" on the results page.
//   - Lowercase (title_lower, author_lower): For lookups and uniqueness.
//     The unique index is on the lowercase columns.
// =============================================================================
async function storeInCache(title, author, metadata) {
  const cacheId = uuidv4()
  const titleLower = title.toLowerCase().trim()
  const authorLower = (author || '').toLowerCase().trim()

  // ---------------------------------------------------------------------------
  // INSERT with ON CONFLICT (upsert pattern).
  //
  // The SQL reads as: "Try to insert this row. If a row with the same
  // (title_lower, author_lower) already exists, update that row's metadata
  // fields instead."
  //
  // $1 = cache_id (UUID)
  // $2 = title (original casing)
  // $3 = author (original casing, or empty string if null)
  // $4 = title_lower (for index)
  // $5 = author_lower (for index)
  // $6 = isbn (from Google Books, may be null)
  // $7 = cover_url (from Google Books, may be null)
  // $8 = description (from Google Books, may be null)
  // $9 = categories (TEXT array, may be empty array)
  //
  // ON CONFLICT target: idx_book_cache_lookup is our unique index on
  // (title_lower, author_lower). When there's a conflict on these columns,
  // PostgreSQL executes the DO UPDATE SET clause instead of INSERT.
  //
  // EXCLUDED refers to the row that was proposed for insertion (the conflicting
  // row). So EXCLUDED.isbn is the isbn value from the new INSERT attempt.
  // ---------------------------------------------------------------------------
  await query(
    `INSERT INTO book_cache (cache_id, title, author, title_lower, author_lower, isbn, cover_url, description, categories)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (title_lower, author_lower)
     DO UPDATE SET
       isbn = EXCLUDED.isbn,
       cover_url = EXCLUDED.cover_url,
       description = EXCLUDED.description,
       categories = EXCLUDED.categories`,
    [
      cacheId,
      title,
      author || '',
      titleLower,
      authorLower,
      metadata.isbn || null,
      metadata.cover_url || null,
      metadata.description || null,
      metadata.categories || [],
    ]
  )
}

// =============================================================================
// fetchFromGoogleBooks(title, author, apiKey)
//
// Purpose: Calls the Google Books API to search for a book by title and author.
//          Extracts and returns the most relevant metadata from the first result.
//
// Args:
//   title (string): Book title to search for.
//   author (string): Author name to search for. Can be empty.
//   apiKey (string): Google Books API key.
//
// Returns:
//   Object with { isbn, cover_url, description, categories } if a result is found.
//   null if no results were returned by Google Books.
//
// HOW THE SEARCH WORKS:
//   Google Books API accepts a "q" parameter with a search query.
//   We use special field prefixes:
//     intitle:  - Restricts the search to the title field
//     inauthor: - Restricts the search to the author field
//   Example query: "intitle:The Great Gatsby+inauthor:F. Scott Fitzgerald"
//
//   We request maxResults=1 because we only need the best match.
//   Google Books returns results ranked by relevance, so the first result
//   is almost always the correct book.
//
// COVER IMAGE:
//   Google Books returns imageLinks with "thumbnail" and "smallThumbnail".
//   We use "thumbnail" for better quality. We also replace "http://" with
//   "https://" because Google sometimes returns HTTP URLs, and modern browsers
//   may block mixed content (HTTP images on HTTPS pages).
// =============================================================================
async function fetchFromGoogleBooks(title, author, apiKey) {
  // ---------------------------------------------------------------------------
  // Build the search query.
  // WHY encodeURIComponent: The title and author may contain special characters
  //   (spaces, apostrophes, accented characters) that need to be URL-encoded.
  //   Without encoding, "O'Brien" would break the URL.
  // WHY intitle/inauthor prefixes: More precise than a general search. Without
  //   these, searching "Gatsby Fitzgerald" might return books ABOUT Fitzgerald
  //   rather than the novel itself.
  // ---------------------------------------------------------------------------
  let searchQuery = `intitle:${encodeURIComponent(title)}`

  if (author && author.trim() !== '' && author.toLowerCase() !== 'unknown') {
    searchQuery += `+inauthor:${encodeURIComponent(author)}`
  }

  const url = `${GOOGLE_BOOKS_API_URL}?q=${searchQuery}&maxResults=1&key=${apiKey}`

  // ---------------------------------------------------------------------------
  // Create an AbortController for request timeout.
  // WHY: fetch() has no built-in timeout. Without this, a slow/hanging request
  //      would block the entire scan indefinitely. AbortController lets us
  //      cancel the request after REQUEST_TIMEOUT_MS (5 seconds).
  // HOW: We pass controller.signal to fetch(). When setTimeout fires,
  //      controller.abort() cancels the fetch, which throws an AbortError.
  // ---------------------------------------------------------------------------
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    // -------------------------------------------------------------------------
    // Make the HTTP request to Google Books API.
    // WHY signal: Connects the AbortController so we can cancel on timeout.
    // -------------------------------------------------------------------------
    const response = await fetch(url, { signal: controller.signal })

    // -------------------------------------------------------------------------
    // Check for HTTP errors.
    // WHY: fetch() does NOT throw on 4xx/5xx responses. It only throws on
    //      network errors. We need to check response.ok manually.
    // Common errors:
    //   400 = Bad request (malformed query)
    //   403 = API key invalid or quota exceeded
    //   429 = Rate limited
    //   500 = Google server error
    // -------------------------------------------------------------------------
    if (!response.ok) {
      console.error(
        `[googleBooks] API error: ${response.status} ${response.statusText}`
      )
      return null
    }

    // -------------------------------------------------------------------------
    // Parse the JSON response body.
    // -------------------------------------------------------------------------
    const data = await response.json()

    // -------------------------------------------------------------------------
    // Check if Google Books returned any results.
    // WHY: The API returns { totalItems: 0 } with no "items" array when there
    //      are no matches. We check both totalItems and items existence.
    // -------------------------------------------------------------------------
    if (!data.items || data.items.length === 0 || data.totalItems === 0) {
      return null
    }

    // -------------------------------------------------------------------------
    // Extract metadata from the first (best match) result.
    // WHY first result: Google ranks by relevance. The first result for
    //   "intitle:The Great Gatsby+inauthor:Fitzgerald" is almost always the
    //   correct edition.
    // -------------------------------------------------------------------------
    const volumeInfo = data.items[0].volumeInfo

    // -------------------------------------------------------------------------
    // Extract ISBN.
    // WHY: volumeInfo.industryIdentifiers is an array of { type, identifier }
    //   objects. There can be multiple ISBNs:
    //     - ISBN_13 (preferred, 13 digits, modern standard)
    //     - ISBN_10 (older 10-digit format)
    //   We prefer ISBN_13 but fall back to ISBN_10.
    //   Some books (very old or obscure) may have no ISBN at all.
    // ---------------------------------------------------------------------------
    let isbn = null
    if (volumeInfo.industryIdentifiers) {
      // First, try to find ISBN_13 (preferred)
      const isbn13 = volumeInfo.industryIdentifiers.find(
        id => id.type === 'ISBN_13'
      )
      // If no ISBN_13, try ISBN_10
      const isbn10 = volumeInfo.industryIdentifiers.find(
        id => id.type === 'ISBN_10'
      )
      // Use ISBN_13 if available, otherwise ISBN_10, otherwise null
      isbn = isbn13?.identifier || isbn10?.identifier || null
    }

    // -------------------------------------------------------------------------
    // Extract cover image URL.
    // WHY: volumeInfo.imageLinks contains URLs at different sizes.
    //   "thumbnail" is about 128x196px - good enough for our card layout.
    //   "smallThumbnail" is about 80x128px - too small.
    //   We fall back to smallThumbnail if thumbnail isn't available.
    //
    // WHY replace http with https: Google Books sometimes returns HTTP URLs.
    //   Modern browsers block "mixed content" (HTTP resources on HTTPS pages).
    //   Our app will be served over HTTPS in production, so we need HTTPS URLs
    //   for the cover images to load correctly.
    // -------------------------------------------------------------------------
    let coverUrl = null
    if (volumeInfo.imageLinks) {
      coverUrl = volumeInfo.imageLinks.thumbnail
        || volumeInfo.imageLinks.smallThumbnail
        || null
      // Force HTTPS
      if (coverUrl) {
        coverUrl = coverUrl.replace('http://', 'https://')
      }
    }

    // -------------------------------------------------------------------------
    // Extract description.
    // WHY: volumeInfo.description is a string with the book's synopsis.
    //   It can be quite long (1000+ characters). We store the full text and
    //   let the frontend decide how much to show (e.g., truncate with "...").
    //   Some books don't have descriptions - we return null in that case.
    // -------------------------------------------------------------------------
    const description = volumeInfo.description || null

    // -------------------------------------------------------------------------
    // Extract categories.
    // WHY: volumeInfo.categories is an array of strings like
    //   ["Fiction", "Literary Criticism / American / General"].
    //   Google Books sometimes uses very specific nested categories.
    //   We store the full array and let the frontend display them as needed.
    //   Some books don't have categories - we return an empty array.
    // -------------------------------------------------------------------------
    const categories = volumeInfo.categories || []

    return { isbn, cover_url: coverUrl, description, categories }
  } catch (error) {
    // -------------------------------------------------------------------------
    // Handle specific error types.
    // AbortError: Our timeout triggered (request took > 5 seconds).
    // Other errors: Network issues, DNS failures, etc.
    // In all cases, we return null (no metadata) rather than crashing.
    // -------------------------------------------------------------------------
    if (error.name === 'AbortError') {
      console.error(`[googleBooks] Request timed out for: "${title}"`)
    } else {
      console.error(`[googleBooks] Fetch error for "${title}":`, error.message)
    }
    return null
  } finally {
    // -------------------------------------------------------------------------
    // Always clear the timeout to prevent memory leaks.
    // WHY: If the request completes before the timeout fires, the setTimeout
    //      callback is still scheduled. clearTimeout cancels it.
    // -------------------------------------------------------------------------
    clearTimeout(timeout)
  }
}
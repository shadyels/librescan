/**
 * usageTracking.js
 *
 * Phase 6: Usage Tracking & Limits
 *
 * Provides functions to track and enforce daily API usage limits for
 * three external APIs:
 *   - Qwen2.5-VL-7B (book recognition)      → column: qwen_requests
 *   - Llama 3.1 8B (recommendations)         → column: llama_requests
 *   - Google Books (metadata enrichment)      → column: google_books_requests
 *
 * Each API is limited to 1,000 requests per calendar day. When ANY API
 * hits its limit, the daily_limit_hit flag is set to TRUE, which blocks
 * ALL scan and recommendation operations for the rest of the day.
 *
 * CONCURRENCY NOTE: Two concurrent requests could both read the counter
 * as 999, then both increment to 1000 and 1001. This minor overshoot
 * (at most +N for N concurrent requests) is acceptable for a free-tier
 * app. A fully atomic approach would use SELECT ... FOR UPDATE, which
 * adds lock contention and complexity disproportionate to the risk.
 */

// --------------------------------------------------------------------------
// IMPORTS
// --------------------------------------------------------------------------

// query: The shared PostgreSQL query function from api/lib/database.js.
// This file lives at lib/usageTracking.js (project root), so the relative
// path goes up one level (../) then into api/lib/.
// At runtime, Vercel's bundler resolves this import and includes
// database.js in the same serverless function bundle.
import { query } from '../api/lib/database.js'

// --------------------------------------------------------------------------
// CONSTANTS
// --------------------------------------------------------------------------

// DAILY_LIMIT: Maximum requests per API per calendar day.
// Set to 1,000 based on:
//   - Google Books free tier: 1,000 requests/day
//   - HuggingFace free tier: variable, but 1,000 is a safe ceiling
// All three APIs share the same limit for simplicity.
const DAILY_LIMIT = 1000

// VALID_API_NAMES: The three API identifiers that correspond to column
// names in the api_usage_tracking table. This set is used to validate
// the apiName parameter in checkLimit() and incrementUsage(), preventing
// SQL injection via dynamic column names.
//
// Why a Set (not an array): Set.has() is O(1) lookup vs Array.includes()
// which is O(n). With only 3 elements the difference is negligible, but
// Set communicates intent better — these are unique identifiers to check
// membership against.
const VALID_API_NAMES = new Set(['qwen', 'llama', 'google_books'])

// --------------------------------------------------------------------------
// HELPER: Ensure today's row exists
// --------------------------------------------------------------------------

/**
 * Creates a row for today's date in api_usage_tracking if one doesn't
 * already exist. Uses INSERT ... ON CONFLICT DO NOTHING to handle the
 * race condition where two concurrent requests both try to create today's
 * row at the same time — one succeeds, the other silently does nothing.
 *
 * This is called at the start of both checkLimit() and incrementUsage()
 * to guarantee the row exists before we try to read or update it.
 *
 * Why not create the row only in incrementUsage()?
 *   checkLimit() needs to read the row too. If it's the first request
 *   of the day, the row doesn't exist yet, and the SELECT in checkLimit()
 *   would return no rows. We'd need special handling for "no row = not
 *   limited." By ensuring the row exists first, both functions can assume
 *   the row is always there.
 *
 * Returns:
 *   void — This function is called for its side effect (inserting a row).
 *
 * Throws:
 *   Error — If the database query fails (connection error, etc.)
 */
async function ensureTodayRow() {
  // CURRENT_DATE: PostgreSQL function that returns today's date in the
  // server's timezone. Since Neon servers are typically in UTC, this
  // means the "day" boundary is midnight UTC.
  //
  // ON CONFLICT (date) DO NOTHING: If a row for today already exists
  // (date is the PRIMARY KEY), skip the insert silently. No error,
  // no update. This is idempotent — safe to call multiple times.
  await query(
    `INSERT INTO api_usage_tracking (date)
     VALUES (CURRENT_DATE)
     ON CONFLICT (date) DO NOTHING`
  )
}

// --------------------------------------------------------------------------
// PUBLIC: Check if an API's daily limit has been reached
// --------------------------------------------------------------------------

/**
 * Checks whether the daily usage limit has been reached for a specific API,
 * or whether the global daily_limit_hit flag is already set.
 *
 * Call this BEFORE making an external API call. If the limit is reached,
 * the caller should return an error to the user instead of proceeding.
 *
 * Args:
 *   apiName (string): One of 'qwen', 'llama', or 'google_books'.
 *     Must exactly match a column name prefix in api_usage_tracking.
 *
 * Returns:
 *   object: {
 *     limited (boolean): true if the request should be blocked,
 *     reason (string):   Human-readable explanation (only meaningful when limited=true),
 *     count (number):    Current request count for this API today
 *   }
 *
 * Throws:
 *   Error: If apiName is not one of the three valid names (programming error).
 *   Error: If the database query fails (connection error, etc.)
 */
export async function checkLimit(apiName) {
  // ---- Validate apiName ----
  // This prevents SQL injection. If we blindly interpolated apiName into
  // the SQL query string, a malicious caller could pass something like
  // "qwen_requests; DROP TABLE sessions; --" and execute arbitrary SQL.
  // By checking against a fixed Set of valid names, we guarantee the
  // column name in the query is always one of our three known columns.
  //
  // Why throw instead of returning { limited: true }?
  // An invalid apiName is a programming error (wrong constant passed in
  // our own code), not a user-facing condition. Throwing makes the bug
  // visible immediately during development.
  if (!VALID_API_NAMES.has(apiName)) {
    throw new Error(
      `[usageTracking] Invalid API name: "${apiName}". Must be one of: ${[...VALID_API_NAMES].join(', ')}`
    )
  }

  // ---- Ensure today's row exists ----
  await ensureTodayRow()

  // ---- Build column name ----
  // We construct the column name by appending "_requests" to the apiName.
  // Example: apiName='qwen' → column='qwen_requests'
  //
  // This is safe because we validated apiName against VALID_API_NAMES above.
  // The resulting column name is always one of:
  //   'qwen_requests', 'llama_requests', 'google_books_requests'
  const column = `${apiName}_requests`

  // ---- Query today's usage ----
  // We fetch both the specific API counter AND the global daily_limit_hit
  // flag. The global flag lets us short-circuit: if ANY API already hit
  // its limit earlier today, we block everything immediately without
  // checking individual counters.
  //
  // Why not just check daily_limit_hit?
  // The flag might not have been set yet for this specific API. The flag
  // is set in incrementUsage() when a counter reaches 1,000. But if the
  // counter is at 999 and two concurrent requests both pass checkLimit()
  // before either calls incrementUsage(), both would proceed. Checking
  // the counter directly is a more accurate (though still not perfectly
  // atomic) check.
  const result = await query(
    `SELECT ${column} AS count, daily_limit_hit
     FROM api_usage_tracking
     WHERE date = CURRENT_DATE`
  )

  // ---- Handle missing row (shouldn't happen after ensureTodayRow) ----
  // Defensive check. If ensureTodayRow() succeeded, this row must exist.
  // But if something went wrong (e.g., concurrent DELETE), we treat
  // "no row" as "not limited" with count 0, rather than crashing.
  if (result.rows.length === 0) {
    console.warn('[usageTracking] No row found for today after ensureTodayRow(). Allowing request.')
    return { limited: false, reason: '', count: 0 }
  }

  const row = result.rows[0]
  // row.count: the integer value of the specific API's counter column
  // row.daily_limit_hit: boolean, TRUE if any API already hit 1,000 today

  // ---- Check global flag first ----
  // If daily_limit_hit is already TRUE, block immediately.
  // This happens when a DIFFERENT API hit its limit earlier today.
  // For example, if Google Books hit 1,000 at 2pm, this flag was set.
  // Now at 3pm, a Qwen request comes in — even though Qwen is at 50,
  // we block it because the user asked for "block both" behavior.
  if (row.daily_limit_hit) {
    return {
      limited: true,
      reason: 'Daily usage limit reached. Please try again tomorrow.',
      count: row.count,
    }
  }

  // ---- Check specific API counter ----
  // If this particular API's counter has reached or exceeded the limit,
  // block the request. The >= comparison (not just ===) handles the
  // unlikely case where a minor overshoot pushed the counter past 1,000.
  if (row.count >= DAILY_LIMIT) {
    return {
      limited: true,
      reason: 'Daily usage limit reached. Please try again tomorrow.',
      count: row.count,
    }
  }

  // ---- Not limited ----
  return { limited: false, reason: '', count: row.count }
}

// --------------------------------------------------------------------------
// PUBLIC: Increment an API's daily usage counter
// --------------------------------------------------------------------------

/**
 * Increments the daily request counter for a specific API by 1.
 * If the new count reaches the daily limit (1,000), sets the global
 * daily_limit_hit flag to TRUE, which blocks ALL API operations for
 * the rest of the day.
 *
 * Call this AFTER a successful external API call. Only count requests
 * that actually reached the external API — don't count cache hits or
 * requests that failed before reaching the API.
 *
 * Args:
 *   apiName (string): One of 'qwen', 'llama', or 'google_books'.
 *
 * Returns:
 *   object: {
 *     newCount (number):    The counter value after incrementing,
 *     limitHit (boolean):   true if this increment caused the limit to be reached
 *   }
 *
 * Throws:
 *   Error: If apiName is not one of the three valid names.
 *   Error: If the database query fails.
 */
export async function incrementUsage(apiName) {
  // ---- Validate apiName (same check as checkLimit) ----
  if (!VALID_API_NAMES.has(apiName)) {
    throw new Error(
      `[usageTracking] Invalid API name: "${apiName}". Must be one of: ${[...VALID_API_NAMES].join(', ')}`
    )
  }

  // ---- Ensure today's row exists ----
  await ensureTodayRow()

  const column = `${apiName}_requests`

  // ---- Atomic increment + return new value ----
  // SET ${column} = ${column} + 1: Increments the counter by 1.
  //   This is atomic at the SQL level — PostgreSQL guarantees that
  //   concurrent UPDATEs on the same row are serialized. Two requests
  //   incrementing simultaneously will produce 1000 and 1001, not
  //   both producing 1000.
  //
  // RETURNING ${column}: Returns the new value after the increment,
  //   in a single round trip. Without RETURNING, we'd need a separate
  //   SELECT query to read the new value.
  //
  // WHERE date = CURRENT_DATE: Targets only today's row.
  const result = await query(
    `UPDATE api_usage_tracking
     SET ${column} = ${column} + 1
     WHERE date = CURRENT_DATE
     RETURNING ${column} AS new_count`
  )

  // ---- Handle missing row (shouldn't happen after ensureTodayRow) ----
  if (result.rows.length === 0) {
    console.warn('[usageTracking] No row to update for today. Increment lost.')
    return { newCount: 0, limitHit: false }
  }

  const newCount = result.rows[0].new_count

  // ---- Check if we just hit the limit ----
  // If the new count equals or exceeds the daily limit, set the global
  // daily_limit_hit flag to TRUE. This flag persists for the rest of
  // the day and causes checkLimit() to block ALL APIs, not just this one.
  //
  // Why >= instead of ===?
  // Two concurrent increments could both land on 1000 and 1001.
  // Using >= catches both. Using === would miss 1001.
  //
  // Why a separate UPDATE (not combined with the increment)?
  // The increment query already uses RETURNING for the new count.
  // Adding a conditional SET daily_limit_hit in the same query would
  // require a CASE expression, making the SQL harder to read for
  // minimal performance gain (one extra query only happens once per
  // day per API, when the limit is first hit).
  const limitHit = newCount >= DAILY_LIMIT

  if (limitHit) {
    console.warn(
      `[usageTracking] Daily limit reached for ${apiName}: ${newCount}/${DAILY_LIMIT}. Blocking all APIs.`
    )

    // Set the global flag. This is a separate query, but it only runs
    // once per day per API (when the limit is first hit), so the extra
    // round trip is negligible.
    await query(
      `UPDATE api_usage_tracking
       SET daily_limit_hit = TRUE
       WHERE date = CURRENT_DATE`
    )
  } else {
    // Log every 100 requests for visibility (not every request, to
    // avoid log spam). The modulo check lets us see usage milestones
    // without drowning the logs.
    if (newCount % 100 === 0) {
      console.log(
        `[usageTracking] ${apiName}: ${newCount}/${DAILY_LIMIT} requests today`
      )
    }
  }

  return { newCount, limitHit }
}

// --------------------------------------------------------------------------
// PUBLIC: Get today's full usage stats (for debugging / logging)
// --------------------------------------------------------------------------

/**
 * Returns the complete usage row for today, including all three API
 * counters, total cost, and the daily_limit_hit flag.
 *
 * This is not used in the main request flow — it's a utility function
 * for debugging, logging, and future admin dashboards.
 *
 * Returns:
 *   object | null: The full row object if it exists, or null if no
 *     requests have been made today (no row created yet).
 *     Shape: { date, qwen_requests, llama_requests, google_books_requests,
 *              total_cost, daily_limit_hit }
 */
export async function getUsageToday() {
  const result = await query(
    `SELECT * FROM api_usage_tracking WHERE date = CURRENT_DATE`
  )

  // If no row exists, no requests have been made today.
  // Return null rather than throwing — the caller can decide what to do.
  if (result.rows.length === 0) {
    return null
  }

  return result.rows[0]
}
// =============================================================================
// scripts/clear-cache.js
// Purpose: Clears all entries from the book_cache table.
// Run with: npm run db:clear-cache (or: node scripts/clear-cache.js)
//
// WHY THIS EXISTS:
//   The book_cache stores Google Books API responses indefinitely (no TTL).
//   This script provides a manual way to clear stale or incorrect cached data.
//   Use cases:
//     - Google Books returned wrong metadata for a book (e.g., wrong cover)
//     - You want to re-fetch all metadata with updated code/logic
//     - Testing: start fresh without dropping/recreating all tables
//
// WHAT IT DOES:
//   1. Counts current cache entries (so you know what you're deleting)
//   2. Deletes ALL rows from book_cache using TRUNCATE
//   3. Reports how many entries were removed
//
// SAFETY:
//   - Only affects book_cache table. No other tables are touched.
//   - TRUNCATE is used instead of DELETE because it's faster for clearing
//     an entire table (it doesn't scan rows one by one, it just resets the table).
//   - TRUNCATE also resets any sequences (not applicable here since we use UUIDs,
//     but it's still the better choice for full table clears).
// =============================================================================

// -----------------------------------------------------------------------------
// IMPORT: dotenv
// WHY: Loads DATABASE_URL from .env.local so we can connect to Neon PostgreSQL.
// -----------------------------------------------------------------------------
import dotenv from 'dotenv'

// -----------------------------------------------------------------------------
// IMPORT: pg (node-postgres)
// WHY: We need Pool to connect to the database and run SQL queries.
// -----------------------------------------------------------------------------
import pg from 'pg'
const { Pool } = pg

// -----------------------------------------------------------------------------
// Load environment variables from .env.local (Vercel convention).
// -----------------------------------------------------------------------------
dotenv.config({ path: '.env.local' })

// -----------------------------------------------------------------------------
// Create connection pool with SSL for Neon.
// Same configuration as setup-database.js and database.js for consistency.
// -----------------------------------------------------------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// =============================================================================
// clearCache()
// Purpose: Counts and then removes all rows from the book_cache table.
// Returns: Nothing (logs results to console).
// Throws: If the table doesn't exist or the connection fails.
// =============================================================================
async function clearCache() {
  console.log('LibreScan - Clear Book Cache\n')

  // ---------------------------------------------------------------------------
  // Step 1: Count existing entries before clearing.
  // WHY: So the user knows how many entries they're about to delete.
  //      This is a safety measure - if the count is 0, the user knows the cache
  //      was already empty and this was a no-op.
  // NOTE: We use COUNT(*) which counts all rows. This is a lightweight operation
  //       because PostgreSQL stores row count metadata.
  // ---------------------------------------------------------------------------
  const countResult = await pool.query('SELECT COUNT(*) FROM book_cache')

  // ---------------------------------------------------------------------------
  // countResult.rows is an array of row objects. COUNT(*) always returns exactly
  // one row with one column named "count". The value is a string (pg returns
  // big integers as strings to avoid JavaScript number precision issues), so we
  // parse it to an integer for display.
  // ---------------------------------------------------------------------------
  const entryCount = parseInt(countResult.rows[0].count, 10)

  console.log(`Current cache entries: ${entryCount}`)

  // ---------------------------------------------------------------------------
  // Step 2: If cache is already empty, report and exit early.
  // WHY: No point running TRUNCATE on an empty table. Plus the user gets a
  //      clear message that there was nothing to clear.
  // ---------------------------------------------------------------------------
  if (entryCount === 0) {
    console.log('Cache is already empty. Nothing to clear.')
    return
  }

  // ---------------------------------------------------------------------------
  // Step 3: Clear all entries using TRUNCATE.
  // WHY TRUNCATE vs DELETE:
  //   DELETE FROM book_cache  - Scans every row, fires triggers, logs each deletion.
  //                             Slower for large tables. Returns deleted row count.
  //   TRUNCATE book_cache     - Instantly resets the table. Does NOT fire row-level
  //                             triggers. Does NOT log individual deletions. Much
  //                             faster for clearing entire tables.
  // RESTART IDENTITY: Resets any auto-increment sequences. Not strictly needed here
  //                   (we use UUIDs), but it's good practice with TRUNCATE.
  // ---------------------------------------------------------------------------
  await pool.query('TRUNCATE book_cache RESTART IDENTITY')

  console.log(`Cleared ${entryCount} cache entries.`)
  console.log('Book cache is now empty.')
}

// =============================================================================
// Main execution block.
// Same pattern as setup-database.js: try/catch/finally with pool.end().
// =============================================================================
;(async () => {
  try {
    await clearCache()
  } catch (error) {
    console.error('Failed to clear cache:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await pool.end()
    console.log('\nDatabase connection closed.')
  }
})()
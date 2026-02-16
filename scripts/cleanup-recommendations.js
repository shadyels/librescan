/**
 * cleanup-recommendations.js
 * 
 * Manual cleanup script for removing old unsaved recommendations.
 * 
 * Usage:
 *   npm run db:cleanup-recommendations
 *   (or: node scripts/cleanup-recommendations.js)
 * 
 * What it does:
 * - Connects to the database using DATABASE_URL from .env.local
 * - Deletes all rows in the recommendations table where:
 *     - saved = FALSE (user did not save them)
 *     - created_at < NOW() - INTERVAL '24 hours' (older than 24 hours)
 * - Reports how many rows were deleted
 * 
 * When to use:
 * - The automatic cleanup runs as a side effect in generate-recommendations.js,
 *   so most old recommendations are cleaned up naturally.
 * - This script is for manual cleanup: debugging, maintenance, or if you want
 *   to force a cleanup without waiting for the next POST request.
 * 
 * Why it exists alongside automatic cleanup:
 * - Automatic cleanup only runs when someone generates new recommendations.
 *   If no one uses the app for days, old data accumulates.
 * - This script can be run manually or via a cron job in production.
 * - Having both gives maximum flexibility (user's requirement).
 * 
 * Dependencies:
 * - dotenv: Loads .env.local for DATABASE_URL
 * - pg: PostgreSQL client (via database.js connection pool)
 * 
 * Note: This script imports database.js which uses a connection pool.
 * After the query completes, we call process.exit() to close the pool
 * and terminate the script cleanly.
 */

// Load environment variables from .env.local
// This is necessary because this script runs directly via Node.js,
// not through Vercel dev (which loads .env.local automatically).
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

// Import the shared database query function
import { query } from '../api/lib/database.js'

/**
 * Main function: deletes old unsaved recommendations.
 */
async function cleanup() {
  console.log('--- Recommendation Cleanup Script ---')
  console.log(`Time: ${new Date().toISOString()}`)
  console.log('')

  try {
    // ---- Step 1: Count how many old unsaved recommendations exist ----
    // We count first to give informative output even if there's nothing to delete.
    const countResult = await query(
      `SELECT COUNT(*) as count
       FROM recommendations
       WHERE saved = FALSE
       AND created_at < NOW() - INTERVAL '24 hours'`
    )

    const staleCount = parseInt(countResult.rows[0].count, 10)
    console.log(`Found ${staleCount} unsaved recommendations older than 24 hours`)

    if (staleCount === 0) {
      console.log('Nothing to clean up.')
      process.exit(0)
    }

    // ---- Step 2: Delete them ----
    const deleteResult = await query(
      `DELETE FROM recommendations
       WHERE saved = FALSE
       AND created_at < NOW() - INTERVAL '24 hours'`
    )

    const deletedCount = deleteResult.rowCount || 0
    console.log(`Deleted ${deletedCount} recommendation(s)`)

    // ---- Step 3: Report remaining recommendations ----
    // Useful for understanding how much data is left in the table.
    const remainingResult = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE saved = TRUE) as saved,
         COUNT(*) FILTER (WHERE saved = FALSE) as unsaved
       FROM recommendations`
    )

    const remaining = remainingResult.rows[0]
    console.log('')
    console.log('Remaining recommendations:')
    console.log(`  Total: ${remaining.total}`)
    console.log(`  Saved: ${remaining.saved}`)
    console.log(`  Unsaved: ${remaining.unsaved}`)

    console.log('')
    console.log('Cleanup complete.')
    process.exit(0)

  } catch (error) {
    console.error(`Cleanup failed: ${error.message}`)
    process.exit(1)
  }
}

// Run the cleanup function
cleanup()
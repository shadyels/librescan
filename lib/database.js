import pg from 'pg'

const { Pool } = pg

/**
 * Create PostgreSQL connection pool
 * Reuses connections for better performance
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

/**
 * Execute a database query
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
export async function query(text, params) {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    console.log('Executed query', { text, duration, rows: res.rowCount })
    return res
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  }
}

/**
 * Get a client from the pool for transactions
 * Remember to call client.release() when done
 */
export async function getClient() {
  const client = await pool.connect()
  return client
}
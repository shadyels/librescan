import { query } from './lib/database.js'

/**
 * Session API endpoint
 * POST /api/session - Create or validate device session
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      allowedMethods: ['POST'] 
    })
  }
  
  try {
    const { device_id } = req.body
    
    // Validate device_id is provided
    if (!device_id) {
      return res.status(400).json({
        success: false,
        error: 'device_id is required'
      })
    }
    
    // Validate device_id is valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(device_id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid device_id format'
      })
    }
    
    // Upsert: create new session or update last_active if it already exists.
    // xmax = 0 is a PostgreSQL trick to detect whether the row was inserted
    // (xmax is 0 for a fresh insert, non-zero for an update).
    const result = await query(
      `INSERT INTO anon_sessions (device_id, created_at, last_active)
       VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (device_id) DO UPDATE SET last_active = CURRENT_TIMESTAMP
       RETURNING device_id, created_at, last_active, (xmax = 0) AS is_new`,
      [device_id]
    )

    const session = result.rows[0]
    const statusCode = session.is_new ? 201 : 200

    return res.status(statusCode).json({
      success: true,
      message: session.is_new ? 'Session created' : 'Session updated',
      session: {
        device_id: session.device_id,
        created_at: session.created_at,
        last_active: session.last_active,
        is_new: session.is_new,
      }
    })
  } catch (error) {
    console.error('Session API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    })
  }
}
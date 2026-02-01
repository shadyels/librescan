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
      error: 'Method not allowed' 
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
    
    // Check if session already exists
    const existingSession = await query(
      'SELECT device_id, created_at, last_active FROM sessions WHERE device_id = $1',
      [device_id]
    )
    
    if (existingSession.rows.length > 0) {
      // Update last_active timestamp for existing session
      await query(
        'UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE device_id = $1',
        [device_id]
      )
      
      return res.status(200).json({
        success: true,
        message: 'Session updated',
        session: {
          device_id: device_id,
          created_at: existingSession.rows[0].created_at,
          last_active: new Date().toISOString(),
          is_new: false
        }
      })
    } else {
      // Create new session
      const result = await query(
        'INSERT INTO sessions (device_id, created_at, last_active) VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
        [device_id]
      )
      
      return res.status(201).json({
        success: true,
        message: 'Session created',
        session: {
          device_id: device_id,
          created_at: result.rows[0].created_at,
          last_active: result.rows[0].last_active,
          is_new: true
        }
      })
    }
  } catch (error) {
    console.error('Session API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    })
  }
}
import { query } from '../lib/database.js'
import {
  verifyPassword,
  createSession,
  serializeSessionCookie,
} from '../lib/auth.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      allowedMethods: ['POST'],
    })
  }

  try {
    const { email: rawEmail, password, device_id } = req.body || {}

    if (!rawEmail || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' })
    }

    const email = rawEmail.trim().toLowerCase()

    // Look up user — use generic error to prevent email enumeration
    const result = await query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    )
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' })
    }

    const user = result.rows[0]
    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' })
    }

    // Create session
    const { token, expiresAt } = await createSession(user.id)

    // Claim anonymous scans if a valid device_id was provided
    let claimed_scan_id = null
    if (device_id && UUID_REGEX.test(device_id)) {
      const claimResult = await query(
        `UPDATE scans
         SET user_id = $1, device_id = NULL
         WHERE device_id = $2 AND user_id IS NULL
         ORDER BY scan_date DESC
         LIMIT 1
         RETURNING scan_id`,
        [user.id, device_id]
      )
      if (claimResult.rows.length > 0) {
        claimed_scan_id = claimResult.rows[0].scan_id
      }
    }

    res.setHeader('Set-Cookie', serializeSessionCookie(token, expiresAt))
    return res.status(200).json({
      success: true,
      user: { id: user.id, email: user.email },
      claimed_scan_id,
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error', details: error.message })
  }
}

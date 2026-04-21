import { query } from '../lib/database.js'
import {
  hashPassword,
  createSession,
  serializeSessionCookie,
} from '../lib/auth.js'

const EMAIL_REGEX = /.+@.+\..+/
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

    // Validate inputs
    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' })
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' })
    }

    const email = rawEmail.trim().toLowerCase()

    // Check for existing user
    const existing = await query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Email already in use' })
    }

    // Create user
    const passwordHash = await hashPassword(password)
    const insertResult = await query(
      'INSERT INTO users (id, email, password_hash) VALUES (gen_random_uuid(), $1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    )
    const user = insertResult.rows[0]

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
    return res.status(201).json({
      success: true,
      user: { id: user.id, email: user.email },
      claimed_scan_id,
    })
  } catch (error) {
    console.error('Signup error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error', details: error.message })
  }
}

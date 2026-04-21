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

    const email = rawEmail ? rawEmail.trim().toLowerCase() : ''
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' })
    }
    if (!password || password.length < 8 || password.length > 128) {
      return res.status(400).json({ success: false, error: 'Password must be 8–128 characters' })
    }

    const passwordHash = await hashPassword(password)
    let user
    try {
      const insertResult = await query(
        'INSERT INTO users (id, email, password_hash) VALUES (gen_random_uuid(), $1, $2) RETURNING id, email, created_at',
        [email, passwordHash]
      )
      user = insertResult.rows[0]
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ success: false, error: 'Email already in use' })
      }
      throw err
    }

    const { token, expiresAt } = await createSession(user.id)

    let claimed_scan_id = null
    if (device_id && UUID_REGEX.test(device_id)) {
      const claimResult = await query(
        `UPDATE scans SET user_id = $1, device_id = NULL
         WHERE scan_id = (
           SELECT scan_id FROM scans
           WHERE device_id = $2 AND user_id IS NULL
           ORDER BY scan_date DESC
           LIMIT 1
         )
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
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

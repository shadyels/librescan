import { parse } from 'cookie'
import { query } from '../lib/database.js'
import { getCurrentUser, hashToken, clearSessionCookie } from '../lib/auth.js'

const COOKIE_NAME = 'librescan_session'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      allowedMethods: ['POST'],
    })
  }

  try {
    const user = await getCurrentUser(req)

    if (user) {
      // Extract raw token from cookie and delete the session row
      const cookieHeader = req.headers.cookie
      if (cookieHeader) {
        const cookies = parse(cookieHeader)
        const rawToken = cookies[COOKIE_NAME]
        if (rawToken) {
          const tokenHash = hashToken(rawToken)
          await query('DELETE FROM user_sessions WHERE token_hash = $1', [tokenHash])
        }
      }
    }

    res.setHeader('Set-Cookie', clearSessionCookie())
    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error', details: error.message })
  }
}

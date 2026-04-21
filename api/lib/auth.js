import bcrypt from 'bcryptjs'
import { parse, serialize } from 'cookie'
import { randomBytes, createHash } from 'crypto'
import { query } from './database.js'

const COOKIE_NAME = 'librescan_session'
const SESSION_DAYS = 30
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 12)
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

export function generateSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId) {
  if (!userId) throw new Error('createSession requires a valid userId')
  const token = generateSessionToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_MS)
  await query(
    'INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, NOW(), $3)',
    [tokenHash, userId, expiresAt]
  )
  return { token, expiresAt }
}

export async function getCurrentUser(req) {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return null
  const cookies = parse(cookieHeader)
  const rawToken = cookies[COOKIE_NAME]
  if (!rawToken) return null
  const tokenHash = hashToken(rawToken)
  const result = await query(
    'SELECT u.id, u.email FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > NOW()',
    [tokenHash]
  )
  if (result.rows.length === 0) return null
  const row = result.rows[0]
  return { id: row.id, email: row.email }
}

// Writes 401 and returns null when unauthenticated. Callers MUST check: if (!user) return
// Uses res.writeHead/end (raw Node.js) because Vercel serverless doesn't have Express helpers.
export async function requireUser(req, res) {
  const user = await getCurrentUser(req)
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Authentication required' }))
    return null
  }
  return user
}

export function serializeSessionCookie(token, expiresAt) {
  return serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export function clearSessionCookie() {
  return serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

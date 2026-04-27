import { requireUser } from '../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      allowedMethods: ['GET'],
    })
  }

  try {
    const user = await requireUser(req, res)
    if (!user) return

    return res.status(200).json({
      success: true,
      user: { id: user.id, email: user.email },
    })
  } catch (error) {
    console.error('Me error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

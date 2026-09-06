import { one } from '../db/pool.js';
import { verifyToken } from '../utils/jwt.js';

/* Real auth for the two web consoles: verifies a JWT from
   `Authorization: Bearer <token>`, then re-reads the account so a
   deactivated or since-changed-role user can't keep using an old token
   until it expires. Replaces the old x-demo-user trust-the-header approach —
   the mobile apps' phone+OTP session (middleware/appUser.js) is untouched. */
export async function webAuth(req, _res, next) {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) return next();

  const payload = verifyToken(header.slice(7));
  if (!payload?.sub) return next();

  try {
    const user = await one(
      `SELECT id, code, name, email, role, shift, active FROM staff_users WHERE id = $1`,
      [payload.sub]
    );
    if (user?.active) req.user = user;
  } catch (err) {
    return next(err);
  }
  next();
}

/* Guards a route to one or more roles. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not signed in.' });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Your role cannot do that.' });
    }
    next();
  };
}

export const requireAdmin = requireRole('super_admin');

import jwt from 'jsonwebtoken';

/* A missing secret in production would mean anyone can forge a token, so this
   fails loudly there. In development it falls back to a fixed string and
   says so — convenient for a demo, never silent about the trade-off. */
const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production.');
  }
  console.warn(
    '[auth] JWT_SECRET is not set — using an insecure development default. ' +
    'Set JWT_SECRET in backend/.env before deploying anywhere real.'
  );
}
const key = SECRET || 'dev-only-insecure-secret-change-me';

const EXPIRES_IN = '7d';

export function signToken(payload) {
  return jwt.sign(payload, key, { expiresIn: EXPIRES_IN });
}

/* Returns the decoded payload, or null if the token is missing, malformed,
   expired, or signed with a different secret — callers don't need to know
   which, they just treat null as "not signed in". */
export function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, key);
  } catch {
    return null;
  }
}

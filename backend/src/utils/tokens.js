/* Refresh-token issue / rotate / revoke.

   A refresh token is opaque: 32 random bytes, handed to the client as hex and
   kept here only as a SHA-256 hash. Nothing about the user is encoded in it,
   so it cannot be read or forged the way a JWT payload can be — the only way
   to use one is to present the exact string back.

   Rotation is single-use. Every refresh consumes the presented token and mints
   its successor in the same family. If a token that has already been used comes
   back, the legitimate client cannot be the one holding it, so the entire
   family is revoked and the session ends everywhere. */
import crypto from 'node:crypto';
import { one, many } from '../db/pool.js';

const REFRESH_DAYS = 30;

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

/* Mints a token in a new family (a fresh sign-in) or an existing one (a
   rotation), and returns the raw string — the only moment it exists. */
async function mint({ family, subjectType, subjectId, userAgent }) {
  const token = crypto.randomBytes(32).toString('hex');
  await one(
    `INSERT INTO refresh_tokens (family, subject_type, subject_id, token_hash, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + ($6 || ' days')::interval)
     RETURNING id`,
    [family, subjectType, subjectId, hash(token), userAgent ?? null, String(REFRESH_DAYS)]
  );
  return token;
}

export async function issueRefreshToken({ subjectType, subjectId, userAgent }) {
  return mint({
    family: crypto.randomUUID(),
    subjectType,
    subjectId: String(subjectId),
    userAgent
  });
}

export class RefreshError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RefreshError';
  }
}

/* Consumes a refresh token and returns { subjectType, subjectId, token } with
   its replacement. Throws RefreshError on anything the client should treat as
   "sign in again". */
export async function rotateRefreshToken(raw, { userAgent } = {}) {
  if (!raw || typeof raw !== 'string') throw new RefreshError('Sign in again.');

  const row = await one(
    `SELECT id, family, subject_type, subject_id, expires_at, used_at, revoked_at
     FROM refresh_tokens WHERE token_hash = $1`,
    [hash(raw)]
  );
  if (!row) throw new RefreshError('Sign in again.');

  /* Reuse detection: this token was already exchanged, so the copy presented
     here is not the one the real client holds. Kill the whole family. */
  if (row.used_at) {
    await revokeFamily(row.family);
    throw new RefreshError('Your session was ended for security. Sign in again.');
  }
  if (row.revoked_at) throw new RefreshError('Sign in again.');
  if (new Date(row.expires_at) <= new Date()) throw new RefreshError('Your session expired. Sign in again.');

  await one('UPDATE refresh_tokens SET used_at = now() WHERE id = $1 RETURNING id', [row.id]);

  const token = await mint({
    family: row.family,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    userAgent
  });

  return { subjectType: row.subject_type, subjectId: row.subject_id, token };
}

/* Sign-out: revokes the presented token's whole family, so every device that
   shared that sign-in is logged out. Silent on an unknown token — a caller
   signing out should never be told whether their token was real. */
export async function revokeRefreshToken(raw) {
  if (!raw || typeof raw !== 'string') return;
  const row = await one('SELECT family FROM refresh_tokens WHERE token_hash = $1', [hash(raw)]);
  if (row) await revokeFamily(row.family);
}

export async function revokeFamily(family) {
  await many(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE family = $1 AND revoked_at IS NULL RETURNING id`,
    [family]
  );
}

/* Used when an account is deactivated: nothing it holds should keep working. */
export async function revokeAllForSubject(subjectType, subjectId) {
  await many(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE subject_type = $1 AND subject_id = $2 AND revoked_at IS NULL RETURNING id`,
    [subjectType, String(subjectId)]
  );
}

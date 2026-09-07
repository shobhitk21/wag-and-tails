/* Refresh-token rotation.

   Before this, every surface got a single 7-day access token: nothing could be
   revoked before it expired, and a leaked token stayed valid for a week. Now
   the access token is short-lived and a long-lived refresh token is exchanged
   for a new pair, one use each.

   The token itself is never stored — only its SHA-256 hash — so a dump of this
   table cannot be replayed against the API.

   `family` groups every token descended from one sign-in. Presenting a refresh
   token that has already been used means it leaked (the legitimate client
   would hold the newer one), so the whole family is revoked rather than just
   that row. That is the standard reuse-detection response. */
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           BIGSERIAL PRIMARY KEY,
  family       TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('staff', 'customer', 'partner')),
  subject_id   TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  user_agent   TEXT,
  issued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS refresh_tokens_subject_idx
  ON refresh_tokens (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_family_idx
  ON refresh_tokens (family);
CREATE INDEX IF NOT EXISTS refresh_tokens_expiry_idx
  ON refresh_tokens (expires_at);

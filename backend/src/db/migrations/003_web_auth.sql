/* ============================================================
   Real password auth for the two web consoles.
   The mobile apps keep phone + OTP (otp_codes, from 002) — this is only for
   staff_users, which backs the staff portal and admin console.
   ============================================================ */

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

/* Tracks failed attempts so a script can't hammer the login endpoint forever.
   Reset on a successful login. */
ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS failed_logins INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

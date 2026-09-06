import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { many, one } from '../../db/pool.js';
import { asyncHandler, httpError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';
import { signToken } from '../../utils/jwt.js';

const router = Router();

/* Which accounts each console offers on its sign-in screen. */
const ROLES_FOR = {
  staff: ['bookings_staff', 'support'],
  admin: ['super_admin']
};

/* Every seeded account shares this so the demo is usable without a password
   manager. Real accounts created later get a real, unique password — nothing
   about the hashing or verification below treats this one specially. */
const DEMO_PASSWORD = 'Wagtails@123';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/* GET /api/auth/demo-users?surface=staff|admin
   Powers the "or continue as" shortcuts on the sign-in screen. */
router.get(
  '/demo-users',
  asyncHandler(async (req, res) => {
    const surface = req.query.surface || 'staff';
    const roles = ROLES_FOR[surface];
    if (!roles) throw httpError(400, 'surface must be "staff" or "admin".');

    const users = await many(
      `SELECT code, name, email, role, shift, active, art_from, art_to
       FROM staff_users WHERE role = ANY($1) ORDER BY id`,
      [roles]
    );
    res.json({ users, demoPassword: DEMO_PASSWORD });
  })
);

/* POST /api/auth/login
   Real password verification against a bcrypt hash, with a lockout after
   repeated failures. Issues a JWT the client sends back as
   `Authorization: Bearer <token>` on every subsequent request. */
router.post(
  '/login',
  validate(z.object({
    email: z.string().trim().min(1, 'Enter your work email'),
    password: z.string().min(1, 'Enter your password'),
    surface: z.enum(['staff', 'admin'])
  })),
  asyncHandler(async (req, res) => {
    const { email, password, surface } = req.body;

    const user = await one(
      `SELECT id, code, name, email, role, shift, active, art_from, art_to,
              password_hash, failed_logins, locked_until
       FROM staff_users WHERE lower(email) = lower($1)`,
      [email]
    );
    /* Same message whether the email doesn't exist or the password is wrong —
       telling them apart would let someone enumerate valid staff emails. */
    const invalid = () => httpError(401, 'Incorrect email or password.');

    if (!user) throw invalid();
    if (!user.active) throw httpError(403, 'That account is inactive.');
    if (!ROLES_FOR[surface].includes(user.role)) {
      throw httpError(403, `That account cannot sign in to the ${surface} console.`);
    }
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      throw httpError(423, `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
    }

    const ok = user.password_hash && await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      const attempts = user.failed_logins + 1;
      const lockNow = attempts >= MAX_ATTEMPTS;
      await one(
        `UPDATE staff_users SET failed_logins = $2,
                locked_until = CASE WHEN $3 THEN now() + interval '${LOCK_MINUTES} minutes' ELSE locked_until END
         WHERE id = $1 RETURNING id`,
        [user.id, lockNow ? 0 : attempts, lockNow]
      );
      if (lockNow) {
        throw httpError(423, `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`);
      }
      throw invalid();
    }

    await one(
      `UPDATE staff_users SET failed_logins = 0, locked_until = NULL WHERE id = $1 RETURNING id`,
      [user.id]
    );

    const token = signToken({ sub: user.id, role: user.role, code: user.code });
    const { password_hash, failed_logins, locked_until, ...safe } = user;
    res.json({ user: safe, token });
  })
);

/* GET /api/auth/me — resolves the Bearer token webAuth already verified. */
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.user) throw httpError(401, 'Not signed in.');
    const permissions = await many(
      `SELECT capability,
              CASE $1
                WHEN 'bookings_staff' THEN bookings_staff
                WHEN 'support' THEN support
                ELSE super_admin
              END AS allowed
       FROM staff_permissions ORDER BY sort`,
      [req.user.role]
    );
    res.json({ user: req.user, permissions });
  })
);

export default router;

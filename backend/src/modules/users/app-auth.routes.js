import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../../db/pool.js';
import { asyncHandler, httpError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';

const router = Router();

/* Phone + OTP sign-in for the two apps.
   The code is fixed at 4321 and returned in the response so the app can be
   used without an SMS provider. Everything else is real: the OTP row is
   written, checked, expired and marked used, so wiring a provider means
   sending `code` instead of returning it. */
const DEMO_CODE = '4321';

router.post(
  '/request-otp',
  validate(z.object({
    phone: z.string().trim().min(6, 'Enter your phone number'),
    role: z.enum(['customer', 'partner'])
  })),
  asyncHandler(async (req, res) => {
    const { phone, role } = req.body;

    const account = role === 'customer'
      ? await one('SELECT id, name FROM customers WHERE phone = $1', [phone])
      : await one('SELECT id, name FROM partners WHERE phone = $1', [phone]);

    if (!account) {
      throw httpError(404, `No ${role} account with that number. Check it and try again.`);
    }

    await one(
      `INSERT INTO otp_codes (phone, code, role, expires_at)
       VALUES ($1, $2, $3, now() + interval '10 minutes') RETURNING id`,
      [phone, DEMO_CODE, role]
    );

    res.json({
      sent: true,
      to: phone,
      name: account.name,
      /* Demo build: the code is shown in the app instead of being texted. */
      demoCode: DEMO_CODE
    });
  })
);

router.post(
  '/verify-otp',
  validate(z.object({
    phone: z.string().trim().min(6),
    code: z.string().trim().length(4, 'Enter the 4-digit code'),
    role: z.enum(['customer', 'partner'])
  })),
  asyncHandler(async (req, res) => {
    const { phone, code, role } = req.body;

    const row = await one(
      `SELECT id FROM otp_codes
       WHERE phone = $1 AND code = $2 AND role = $3 AND used = FALSE AND expires_at > now()
       ORDER BY id DESC LIMIT 1`,
      [phone, code, role]
    );
    if (!row) throw httpError(401, 'That code is wrong or has expired.');

    await one('UPDATE otp_codes SET used = TRUE WHERE id = $1 RETURNING id', [row.id]);

    const account = role === 'customer'
      ? await one(
          `SELECT id, name, first_name, phone, email, area, wallet_balance, since_label
           FROM customers WHERE phone = $1`, [phone]
        )
      : await one(
          `SELECT id, name, kind, phone, area, rating, jobs, status
           FROM partners WHERE phone = $1`, [phone]
        );

    if (role === 'partner' && account.status !== 'Active') {
      throw httpError(403, 'Your application is still being reviewed.');
    }

    res.json({ user: { ...account, role } });
  })
);

/* Which accounts this build can sign in as, so the apps can offer a shortcut
   instead of asking someone to remember a seeded phone number. */
router.get(
  '/demo-accounts',
  asyncHandler(async (req, res) => {
    const role = req.query.role === 'partner' ? 'partner' : 'customer';
    const accounts = role === 'customer'
      ? await many(
          `SELECT id, name, phone, area FROM customers
           WHERE phone IS NOT NULL ORDER BY bookings_count DESC, id LIMIT 4`
        )
      : await many(
          `SELECT id, name, phone, kind, area FROM partners
           WHERE status = 'Active' ORDER BY id`
        );
    res.json({ accounts, code: DEMO_CODE });
  })
);

export default router;

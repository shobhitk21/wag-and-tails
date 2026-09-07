import { one } from '../db/pool.js';
import { httpError } from './error.js';
import { verifyToken } from '../utils/jwt.js';

/* Resolves the app's signed-in account from a real JWT:
   `Authorization: Bearer <token>`, issued by POST /api/app/auth/verify-otp.

   This used to read `x-app-user: customer:C1041` and trust it. That was an
   authentication bypass, not a shortcut — any caller could name any account
   and the API would serve that account's pets, bookings, addresses and
   payouts. The token is now signed and verified, and the row is re-read on
   every request so a deactivated partner or a deleted customer stops working
   immediately rather than when some cached claim expires. */
export async function appUser(req, _res, next) {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) return next();

  const payload = verifyToken(header.slice(7));
  if (!payload?.sub) return next();

  const { sub, role } = payload;
  if (role !== 'customer' && role !== 'partner') return next();

  try {
    if (role === 'customer') {
      const row = await one(
        `SELECT id, name, first_name, phone, email, area, wallet_balance, since_label
         FROM customers WHERE id = $1`, [sub]
      );
      if (row) req.app_user = { ...row, role: 'customer' };
    } else {
      const row = await one(
        `SELECT id, name, kind, phone, area, rating, jobs, status, pending_payout
         FROM partners WHERE id = $1`, [sub]
      );
      if (row) req.app_user = { ...row, role: 'partner' };
    }
  } catch (err) {
    return next(err);
  }
  next();
}

export function requireCustomer(req, _res, next) {
  if (req.app_user?.role !== 'customer') {
    return next(httpError(401, 'Sign in to continue.'));
  }
  next();
}

export function requirePartner(req, _res, next) {
  if (req.app_user?.role !== 'partner') {
    return next(httpError(401, 'Sign in to continue.'));
  }
  if (req.app_user.status !== 'Active') {
    return next(httpError(403, 'Your account is not active.'));
  }
  next();
}

/* Any signed-in app account. Mounted on every /api/app router except auth, so
   an endpoint added later is guarded by default rather than by remembering. */
export function requireAppUser(req, _res, next) {
  if (!req.app_user) return next(httpError(401, 'Sign in to continue.'));
  next();
}

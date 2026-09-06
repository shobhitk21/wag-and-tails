import { one } from '../db/pool.js';
import { httpError } from './error.js';

/* Resolves the app's signed-in account from `x-app-user: customer:C1041` or
   `x-app-user: partner:P21`. Same shape as the consoles' demoUser: a real row
   is looked up, and swapping in JWT later means verifying a token here. */
export async function appUser(req, _res, next) {
  const header = req.get('x-app-user');
  if (!header) return next();

  const [role, id] = header.split(':');
  if (!role || !id) return next();

  try {
    if (role === 'customer') {
      const row = await one(
        `SELECT id, name, first_name, phone, email, area, wallet_balance, since_label
         FROM customers WHERE id = $1`, [id]
      );
      if (row) req.app_user = { ...row, role: 'customer' };
    } else if (role === 'partner') {
      const row = await one(
        `SELECT id, name, kind, phone, area, rating, jobs, status, pending_payout
         FROM partners WHERE id = $1`, [id]
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

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { pool } from './db/pool.js';
import { webAuth } from './middleware/webAuth.js';
import { appUser } from './middleware/appUser.js';
import { errorHandler, notFound, asyncHandler } from './middleware/error.js';

import authRoutes from './modules/users/auth.routes.js';
import { customers, partners } from './modules/users/directory.routes.js';
import staffRoutes from './modules/staff/staff.routes.js';
import bookingRoutes from './modules/bookings/bookings.routes.js';
import storeRoutes from './modules/store/store.routes.js';
import catalogueRoutes from './modules/catalogue/catalogue.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';

/* the two mobile apps */
import appAuthRoutes from './modules/users/app-auth.routes.js';
import { customerRoutes, partnerRoutes } from './modules/users/app-me.routes.js';
import petRoutes from './modules/pets/pets.routes.js';
import appBookingRoutes from './modules/bookings/app-bookings.routes.js';
import jobRoutes from './modules/jobs/jobs.routes.js';
import walkRoutes from './modules/walks/walks.routes.js';
import appStoreRoutes from './modules/store/app-store.routes.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

const origins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const isProduction = process.env.NODE_ENV === 'production';

/* Any loopback or private-LAN address, on any port:
     http://localhost:5173      the staff portal
     http://localhost:5174      the admin console
     http://localhost:8081+     Expo web — it takes whichever port is free,
                                so pinning exact ones just breaks on 8083
     http://10.0.0.5:8081       the same, reached over the LAN from a phone */
const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

function allowOrigin(origin) {
  /* Expo Go on a device and the native builds send no Origin at all. */
  if (!origin) return true;
  if (origins.includes(origin)) return true;
  /* Development only. In production the allowlist is the whole story, so a
     misconfigured deploy fails closed rather than trusting a LAN range. */
  return !isProduction && DEV_ORIGIN.test(origin);
}

app.use(cors({
  origin: (origin, cb) => cb(null, allowOrigin(origin)),
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(webAuth);    /* Authorization: Bearer <jwt> → the two web consoles */
app.use(appUser);    /* x-app-user                  → the two mobile apps */

app.get(
  '/api/health',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query('SELECT now() AS at');
    res.json({ ok: true, db: 'up', at: rows[0].at });
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/orders', storeRoutes);
app.use('/api/customers', customers);
app.use('/api/partners', partners);
app.use('/api/catalogue', catalogueRoutes);
app.use('/api/admin', adminRoutes);

/* ---- the apps ---- */
app.use('/api/app/auth', appAuthRoutes);
app.use('/api/app/customer', customerRoutes);
app.use('/api/app/partner', partnerRoutes);
app.use('/api/app/pets', petRoutes);
app.use('/api/app/bookings', appBookingRoutes);
app.use('/api/app/jobs', jobRoutes);
app.use('/api/app/walks', walkRoutes);
app.use('/api/app/store', appStoreRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[api] Wag & Tails API on http://localhost:${PORT}`);
  console.log(
    isProduction
      ? `[api] CORS: ${origins.join(', ') || '(nothing allowed — set CORS_ORIGIN)'}`
      : `[api] CORS: any localhost / private-LAN origin${origins.length ? `, plus ${origins.join(', ')}` : ''}`
  );
});

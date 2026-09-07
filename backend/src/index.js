import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { pool } from './db/pool.js';
import { webAuth, requireStaff } from './middleware/webAuth.js';
import { appUser, requireAppUser } from './middleware/appUser.js';
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
app.use(appUser);    /* Authorization: Bearer <jwt> → the two mobile apps */

app.get(
  '/api/health',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query('SELECT now() AS at');
    res.json({ ok: true, db: 'up', at: rows[0].at });
  })
);

/* ---- the consoles ----

   Everything below /api except auth is staff-only. This is enforced here, at
   the mount, rather than route by route: these routers serve customer names,
   phone numbers, addresses, booking history and order totals, and until this
   guard existed every one of them answered an unauthenticated request. A
   per-route guard is one forgotten line away from leaking again; a mount-level
   one cannot be forgotten when a route is added.

   /api/auth stays open because login, refresh and the demo-account list are
   how you get a token in the first place. */
app.use('/api/auth', authRoutes);
app.use('/api/staff', requireStaff, staffRoutes);
app.use('/api/bookings', requireStaff, bookingRoutes);
app.use('/api/orders', requireStaff, storeRoutes);
app.use('/api/customers', requireStaff, customers);
app.use('/api/partners', requireStaff, partners);
app.use('/api/catalogue', requireStaff, catalogueRoutes);
app.use('/api/admin', requireStaff, adminRoutes);

/* ---- the apps ----

   Same reasoning: /api/app/auth is the way in, everything after it needs a
   signed-in customer or partner. The routers still apply requireCustomer /
   requirePartner where a route is specific to one of the two. */
app.use('/api/app/auth', appAuthRoutes);
app.use('/api/app/customer', requireAppUser, customerRoutes);
app.use('/api/app/partner', requireAppUser, partnerRoutes);
app.use('/api/app/pets', requireAppUser, petRoutes);
app.use('/api/app/bookings', requireAppUser, appBookingRoutes);
app.use('/api/app/jobs', requireAppUser, jobRoutes);
app.use('/api/app/walks', requireAppUser, walkRoutes);
app.use('/api/app/store', requireAppUser, appStoreRoutes);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`[api] Wag & Tails API on http://localhost:${PORT}`);
  console.log(
    isProduction
      ? `[api] CORS: ${origins.join(', ') || '(nothing allowed — set CORS_ORIGIN)'}`
      : `[api] CORS: any localhost / private-LAN origin${origins.length ? `, plus ${origins.join(', ')}` : ''}`
  );
});

/* A busy port is the most common way to fail to start this, and without a
   listener Node reports it as an unhandled 'error' event: fifteen lines of
   stack trace about net.js internals that say nothing about what to do. It is
   almost always a previous instance still running — often one `node --watch`
   left behind, since a crashed watch process keeps the terminal open and looks
   idle rather than dead. Say that, and say how to clear it. */
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n[api] Port ${PORT} is already in use — another copy of this API is `
      + 'probably still running.\n\n'
      + '  Windows:  npm run kill-port -w backend\n'
      + `            (or: netstat -ano | findstr :${PORT}  →  taskkill /PID <pid> /F)\n`
      + `  macOS/Linux:  lsof -ti:${PORT} | xargs kill -9\n\n`
      + `  Or set a different port:  PORT=4001 npm run dev -w backend\n`
    );
  } else if (err.code === 'EACCES') {
    console.error(`\n[api] Not allowed to listen on port ${PORT}. Ports below 1024 need elevated rights.\n`);
  } else {
    console.error(`\n[api] Could not start: ${err.message}\n`);
  }
  process.exit(1);
});

/* Ctrl-C and the restart signal `node --watch` sends both land here. Closing
   the listener explicitly is what frees the port promptly; without it a fast
   restart can race the old socket and hit the EADDRINUSE above. */
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    /* If a connection is still open, do not hang the terminal waiting on it. */
    setTimeout(() => process.exit(0), 2000).unref();
  });
}

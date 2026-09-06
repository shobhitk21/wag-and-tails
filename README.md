# Wag & Tails

Express + PostgreSQL backend, the two web consoles, and the two React Native
apps — built from the [prototype](https://github.com/sarthackk/wag-and-tails)
and its Build Book.

```
backend/     Express API + Neon PostgreSQL
web/         staff-portal · admin-portal          (React + Vite)
apps/        customer-app · partner-app           (React Native / Expo)
packages/    ui-web · ui-native · theme · api-client · features-store
wag-and-tails/  the original prototype, kept as reference
```

## Run it

```bash
npm install
npm run db:migrate        # creates 45 tables
npm run db:seed           # loads the prototype's data verbatim
npm run dev:api           # http://localhost:4000
npm run dev:staff         # http://localhost:5173
npm run dev:admin         # http://localhost:5174
npm run dev:customer      # Expo — press w for web, or scan the QR code
npm run dev:partner       # Expo — same
```

`backend/.env` holds the Neon connection string. It is gitignored; see
`.env.example` at the root and inside `backend/`, `web/*` and `apps/*` — every
package that reads one has its own example alongside it.

**Web consoles**: real password auth, JWT-backed. Every seeded account shares
one demo password (`Wagtails@123`, also shown on the sign-in screen) —
`nikhil@wagandtails.in` for staff, `admin@wagandtails.in` for admin.

**Apps**: phone + OTP with a fixed demo code (`4321`, shown on screen — no SMS
provider is wired).

**Running an app on a real device**: `localhost` on the phone means the phone
itself. Set `EXPO_PUBLIC_API_URL` in `apps/*/​.env` to your computer's LAN IP
(e.g. `http://192.168.1.20:4000`) and add that origin to `backend/.env`'s
`CORS_ORIGIN` if you're using the Expo web preview rather than a device.

## Tests

```bash
npm run test:api          # 41 console-side endpoint checks
node backend/tests/smoke-apps.js   # 39 app-side endpoint checks
node backend/tests/appcheck.js     # drives real Chrome over both apps (Expo web)
npm run test:ui            # drives real Chrome over both web consoles
```

Every check renders the real thing and hit-tests each screen's primary control
with `elementFromPoint` — the check the Build Book says would have caught the
prototype's "nothing was clickable" bug, which handler-level testing missed
entirely. `appcheck.js` and `test:ui` need their dev servers and the API
running first.

The app and console smoke tests write real rows (a test booking, an order);
`npm run db:seed` clears them back to the seed state.

## What was built

**Backend** — 45 tables, 14 route modules, ~65 endpoints. Prices, payouts,
margins and commission are always computed server-side from the catalogue and
`settings`, never trusted from a client.

**Staff portal** (11 screens) and **admin console** (19 screens) — see below.
Six screens (bookings, orders, customers — list and detail) are one component
rendered in both, living in `packages/ui-web/src/screens/`.

**Customer app** (Expo/React Native) — splash, onboarding, phone+OTP, home,
pets (profile, health record, vaccinations, grooming history, add/edit),
booking a groom (4 steps) and a walk (3 steps), partner matching, live
tracking, the store, bookings, reschedule, cancel, pay, rate and tip, account,
addresses, payment methods, wallet, offers, notifications, help.

**Partner app** (Expo/React Native) — one app, two roles via the
Grooming/Walking switch on Jobs: the open-job feed with claim, the groomer's
job sheet with a namespaced completion checklist and before/after photos, the
walker's incoming request → pickup → live walk → drag-to-end, schedule,
earnings and payouts, reviews, documents, the store at trade pricing, account.

## Matching the prototype's UI

The two apps were built screen-by-screen against the live prototype
(`node wag-and-tails/serve.js`, `/customer` and `/partner`) and its source, not
guessed from the Build Book's prose alone. Concretely:

- **Tab order is exact.** Customer: Home, Store, Bookings, Pets, Account.
  Partner: Jobs, Schedule, Store, Earnings, Account — taken from `C_TABS` /
  `P_TABS` in `js/screens-customer.js` / `js/screens-partner.js`, not guessed.
- **Customer home** matches `scHome()`: the pet switcher lives inside the
  brand-coloured hero (not below it), an overlapping card shows whatever's
  live or an idle prompt for the switched pet, two service cards (dark
  grooming / biscuit walking), a health nudge scoped to the switched pet
  ("Time for Simba's next groom — last groomed 12 weeks ago"), the FIRST20
  promo, a "Book again" rail, and the static trust card — same copy, same
  order.
- **Partner jobs** matches `sgJobs()` / `gJobCard()`: the mode switch carries
  its own icon and open-job badge, an Online/Offline toggle that actually
  hides the open-jobs list while off (session-local, exactly as ephemeral as
  the prototype's own `S.g.online`), three stat tiles (today's earnings —
  computed from real completed bookings at the real commission rate, not
  fabricated), and job cards with the pill row (time, distance, duration,
  add-on count), a claim countdown bar, and Details/Claim buttons.
- **A real bug got fixed along the way**: the scissors icon was missing its
  two handle circles (defined as a bare crossing-lines path) and rendered as
  an X. Caught by screenshot comparison, not by a test — which is exactly the
  Build Book's own lesson about this class of bug.
- **Distance and the claim countdown are cosmetic**, matching the prototype's
  own `OPEN_JOBS[].km` / `.expires` — seed data that was never computed from
  anything real there either. They're derived deterministically from the
  booking id so a screen doesn't re-roll them, and never touch money.

What's a deliberate departure, not a gap: the prototype's `CUSTOMER` fixture
owned all three seed pets under one account; here the three pets are split
across three real customer rows (each with their own login), which is more
correct for a real backend and is why Aarav's pet switcher shows one ring, not
three — a data-distribution difference, not a missing feature.

## The care note is a real column

The Build Book calls care notes the spine of the product — the owner writes
"Hates having his ears touched, go slow" and the same sentence has to reach the
groomer's job sheet, the walker's incoming request and the staff booking form.

Here it is `pets.care_note`. Editing it in the customer app updates the pet row
and every one of that pet's upcoming bookings; the partner app's job sheet and
walk request render it in the "loud"/"onbrand" variants; the staff booking form
writes it on creation; all three read the same `CareNote` component logic
ported to each platform. One row, one sentence, every surface — verified
end-to-end in `smoke-apps.js`.

## Computed vs. carried over

Anything the tables can answer is computed, so two screens can never disagree:

| Computed live | From |
|---|---|
| Today / unassigned / staff-entered counts | `bookings` |
| Product margin | `1 − trade/price` |
| Partner payout, fee, net (both consoles and the app) | `partners.pending_payout` × the rate in `settings` |
| Service-area coverage | `partners` grouped by area |
| Customer pets, bookings, lifetime value | `pets`, `bookings` |
| A pet's "last groomed N weeks ago" | `pet_visits`, most recent row |
| Bookings by status / channel / partner / product | the operational tables |
| Live walk elapsed time and distance | `walks.started_at`, read by both apps |

Carried over as a **reporting snapshot** in the `metrics`, `monthly_revenue`,
`channel_split` and `revenue_lines` tables: the admin dashboard's headline KPIs
(₹8,42,300, 612 bookings), the six-month revenue bars, the channel donut and
the Reports Revenue tab. The prototype showed these with no rows behind them,
and deriving them from nine seed bookings would be worse than labelling them.
The Reports screen says so on the page.

One deliberate correction: the prototype's `ALL_CUSTOMERS` carried decorative
pet and booking counts — Aarav Mehta showed 3 pets against 1 real pet row. Those
columns still exist but nothing reads them; the counts come from the rows.

## Deliberate limits, kept

From the Build Book's "Known limits", these are still true and the UI says so
rather than pretending otherwise:

- **No WhatsApp integration.** Staff record which channel a message arrived on,
  enter the booking, and copy a generated confirmation to send by hand. The
  channel field is what the admin console's reporting turns on. WhatsApp is a
  business number in Settings, not a live integration.
- **Walk pricing is provisional** (₹249 / ₹349 / ₹449), flagged in both apps'
  booking flows and in the admin catalogue.
- **Scripted AI chat stays unscripted.** The customer home screen's "Ask about
  {pet}" row is there, and says plainly that it isn't wired, rather than
  half-building a fake model behind it.
- **Distance and the partner claim countdown are cosmetic** — see above.
- **Real password auth on both web consoles.** `POST /api/auth/login` checks a
  bcrypt hash and issues a JWT (`backend/src/utils/jwt.js`), sent back as
  `Authorization: Bearer <token>` on every request and verified by
  `backend/src/middleware/webAuth.js` — not trusted from a header. Five wrong
  attempts locks the account for 15 minutes. Every seeded account shares one
  demo password, shown on the sign-in screen itself: `Wagtails@123`.
  Set `JWT_SECRET` in `backend/.env` (falls back to an insecure fixed string
  in development, with a console warning — never in production).
- **The two apps still use demo phone + OTP** (fixed code `4321`, shown on
  screen — no SMS provider wired). A customer gets 401 on partner/staff/admin
  routes, a partner gets 403 while pending, exactly as the web consoles'
  role guard works. Replacing the apps' auth touches
  `backend/src/middleware/appUser.js` and `packages/ui-native/src/auth.jsx`;
  no route handler changes.
- **Per-variant stock is not tracked.** A product carries one stock state.

## Design system

`packages/ui-web/src/styles.css` is the prototype's stylesheet, copied
unchanged for the two web consoles — all 1050 lines, including the documented
contrast decisions (brand brown CTAs at 12:1; white on marigold at 2.77:1
never used for buttons or small text). `packages/theme/src/index.js` carries
the same token values as plain JS objects for the two React Native apps, which
have no CSS — one source of truth, two consumers. `packages/ui-native` ports
the ring, the map, the care note and the rest of the component vocabulary onto
`react-native-svg` and `Animated` so a screen reads the same on either
platform.

## Not built here

Nothing. Every surface in the Build Book's route table — `/customer`,
`/partner`, `/staff`, `/admin` — has a working implementation against the one
shared Neon database.
#   w a g - a n d - t a i l s  
 
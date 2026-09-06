/* ============================================================
   Wag & Tails — schema for the customer and partner apps
   The consoles in 001 only needed a pet's name and care note. The apps need
   the whole record: health, history, addresses, payment, live walks, the
   groomer checklist and partner earnings.
   ============================================================ */

/* ---------- customer account ---------- */

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS email          TEXT,
  ADD COLUMN IF NOT EXISTS first_name     TEXT,
  ADD COLUMN IF NOT EXISTS wallet_balance INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS customer_addresses (
  id          SERIAL PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  label       TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'home',
  line1       TEXT NOT NULL,
  line2       TEXT,
  landmark    TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (customer_id, code)
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id          SERIAL PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  label       TEXT NOT NULL,
  subtitle    TEXT,
  kind        TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (customer_id, code)
);

/* ---------- the pet record ---------- */

ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS age          TEXT,
  ADD COLUMN IF NOT EXISTS dob          TEXT,
  ADD COLUMN IF NOT EXISTS sex          TEXT,
  ADD COLUMN IF NOT EXISTS size         TEXT,
  ADD COLUMN IF NOT EXISTS neutered     TEXT,
  ADD COLUMN IF NOT EXISTS coat         TEXT,
  ADD COLUMN IF NOT EXISTS temperament  TEXT,
  ADD COLUMN IF NOT EXISTS allergies    TEXT,
  ADD COLUMN IF NOT EXISTS vaccinated   TEXT,
  ADD COLUMN IF NOT EXISTS next_vaccine TEXT,
  ADD COLUMN IF NOT EXISTS microchip    TEXT,
  ADD COLUMN IF NOT EXISTS vet          TEXT,
  ADD COLUMN IF NOT EXISTS vet_clinic   TEXT,
  ADD COLUMN IF NOT EXISTS vet_phone    TEXT,
  /* Portrait colours — the pet avatar ring is the product's signature element
     and every surface draws it from these. */
  ADD COLUMN IF NOT EXISTS art          JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS pet_vaccines (
  id        SERIAL PRIMARY KEY,
  pet_id    INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  given_on  TEXT,
  due_on    TEXT,
  up_to_date BOOLEAN NOT NULL DEFAULT TRUE,
  sort      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pet_visits (
  id         SERIAL PRIMARY KEY,
  code       TEXT UNIQUE,
  pet_id     INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  visited_on TEXT NOT NULL,
  package_id TEXT REFERENCES packages(id),
  partner_id TEXT REFERENCES partners(id),
  rating     INTEGER,
  mins       INTEGER,
  note       TEXT,
  sort       INTEGER NOT NULL DEFAULT 0
);

/* ---------- bookings the apps create ---------- */

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS address_id  INTEGER REFERENCES customer_addresses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_label  TEXT,
  ADD COLUMN IF NOT EXISTS slot_label  TEXT,
  ADD COLUMN IF NOT EXISTS paid        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rating      INTEGER,
  ADD COLUMN IF NOT EXISTS tip         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS discount    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eta         TEXT,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(4,1);

CREATE TABLE IF NOT EXISTS booking_addons (
  id         SERIAL PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  addon_id   TEXT NOT NULL REFERENCES addons(id),
  price      INTEGER NOT NULL,
  UNIQUE (booking_id, addon_id)
);

/* The customer's tracking timeline. Coarser than booking_activity, which is
   the operational trail the consoles show. */
CREATE TABLE IF NOT EXISTS booking_steps (
  id         SERIAL PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  detail     TEXT,
  state      TEXT NOT NULL DEFAULT 'todo' CHECK (state IN ('done','now','todo')),
  sort       INTEGER NOT NULL DEFAULT 0
);

/* ---------- the groomer's job sheet ----------
   Rows are keyed p:<name> for package inclusions and a:<name> for add-ons.
   The Build Book records a bug where an add-on called "De-matting" unticked
   the identically named Luxury inclusion; the namespace is what prevents it. */
CREATE TABLE IF NOT EXISTS job_checklist (
  id           SERIAL PRIMARY KEY,
  booking_id   TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  item_key     TEXT NOT NULL,
  label        TEXT NOT NULL,
  group_name   TEXT NOT NULL,
  done         BOOLEAN NOT NULL DEFAULT FALSE,
  sort         INTEGER NOT NULL DEFAULT 0,
  UNIQUE (booking_id, item_key)
);

CREATE TABLE IF NOT EXISTS job_photos (
  id         SERIAL PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  phase      TEXT NOT NULL CHECK (phase IN ('before','after')),
  seed       TEXT NOT NULL,
  taken_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* ---------- live walks ----------
   The customer's live screen and the walker's live screen read this same row,
   so ending a walk in the partner app updates the customer app. */
CREATE TABLE IF NOT EXISTS walks (
  id           SERIAL PRIMARY KEY,
  booking_id   TEXT UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  state        TEXT NOT NULL DEFAULT 'requested'
               CHECK (state IN ('requested','accepted','pickup','walking','done')),
  planned_mins INTEGER NOT NULL,
  started_at   TIMESTAMPTZ,
  ended_at     TIMESTAMPTZ,
  elapsed_secs INTEGER NOT NULL DEFAULT 0,
  distance_km  NUMERIC(4,1) NOT NULL DEFAULT 0,
  payout       INTEGER NOT NULL DEFAULT 0
);

/* ---------- partner earnings ---------- */
CREATE TABLE IF NOT EXISTS partner_earnings (
  id         SERIAL PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  label      TEXT NOT NULL,
  earned_on  TEXT NOT NULL,
  weekday    TEXT,
  amount     INTEGER NOT NULL,
  paid_out   BOOLEAN NOT NULL DEFAULT FALSE,
  sort       INTEGER NOT NULL DEFAULT 0
);

/* ---------- store ---------- */
ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS partner_id  TEXT REFERENCES partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pricing     TEXT NOT NULL DEFAULT 'retail'
                                       CHECK (pricing IN ('retail', 'trade')),
  ADD COLUMN IF NOT EXISTS address     TEXT;

/* One catalogue, two price ladders — retail in the customer app, trade in the
   partner app. The cart records which ladder it was priced on. */
CREATE TABLE IF NOT EXISTS carts (
  id          SERIAL PRIMARY KEY,
  owner_kind  TEXT NOT NULL CHECK (owner_kind IN ('customer','partner')),
  owner_id    TEXT NOT NULL,
  pricing     TEXT NOT NULL CHECK (pricing IN ('retail','trade')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_kind, owner_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id         SERIAL PRIMARY KEY,
  cart_id    INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_index INTEGER NOT NULL DEFAULT 0,
  qty        INTEGER NOT NULL DEFAULT 1,
  UNIQUE (cart_id, product_id, size_index)
);

CREATE TABLE IF NOT EXISTS store_order_steps (
  id       SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  title    TEXT NOT NULL,
  detail   TEXT,
  done     BOOLEAN NOT NULL DEFAULT FALSE,
  sort     INTEGER NOT NULL DEFAULT 0
);

/* ---------- app content ---------- */

CREATE TABLE IF NOT EXISTS reviews (
  id         SERIAL PRIMARY KEY,
  partner_id TEXT REFERENCES partners(id) ON DELETE CASCADE,
  author     TEXT NOT NULL,
  pet_name   TEXT,
  rating     INTEGER NOT NULL,
  when_label TEXT,
  body       TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  partner_id  TEXT REFERENCES partners(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  when_label  TEXT,
  unread      BOOLEAN NOT NULL DEFAULT TRUE,
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS faqs (
  id       SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer   TEXT NOT NULL,
  sort     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS breeds (
  name TEXT PRIMARY KEY,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cancel_reasons (
  id     SERIAL PRIMARY KEY,
  reason TEXT NOT NULL,
  sort   INTEGER NOT NULL DEFAULT 0
);

/* Phone + OTP sign-in for the apps. The code is fixed in this build; the table
   exists so swapping in a real SMS provider is a change of one insert. */
CREATE TABLE IF NOT EXISTS otp_codes (
  id         SERIAL PRIMARY KEY,
  phone      TEXT NOT NULL,
  code       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('customer','partner')),
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS otp_phone_idx ON otp_codes(phone);
CREATE INDEX IF NOT EXISTS pets_customer_idx ON pets(customer_id);
CREATE INDEX IF NOT EXISTS earnings_partner_idx ON partner_earnings(partner_id);

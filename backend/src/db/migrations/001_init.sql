/* ============================================================
   Wag & Tails — initial schema
   Modelled on the prototype's data model (Build Book, "Data model").
   Money is whole rupees, matching the client pricing verbatim.
   ============================================================ */

/* ---------- people ---------- */

CREATE TABLE IF NOT EXISTS staff_users (
  id            SERIAL PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('bookings_staff','support','super_admin')),
  shift         TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  handled_today INTEGER NOT NULL DEFAULT 0,
  art_from      TEXT,
  art_to        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  phone          TEXT,
  area           TEXT,
  address        TEXT,
  pets_count     INTEGER NOT NULL DEFAULT 0,
  bookings_count INTEGER NOT NULL DEFAULT 0,
  lifetime_spend INTEGER NOT NULL DEFAULT 0,
  since_label    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partners (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('Groomer','Walker')),
  rating         NUMERIC(2,1) NOT NULL DEFAULT 0,
  jobs           INTEGER NOT NULL DEFAULT 0,
  area           TEXT,
  phone          TEXT,
  status         TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Active','Pending','Suspended')),
  docs_status    TEXT NOT NULL DEFAULT 'Under review',
  pending_payout INTEGER NOT NULL DEFAULT 0,
  payout_account TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partner_documents (
  id         SERIAL PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  detail     TEXT,
  verified   BOOLEAN NOT NULL DEFAULT FALSE,
  sort       INTEGER NOT NULL DEFAULT 0
);

/* The care note lives here. One row, read by the groomer job sheet, the
   walker request and the staff booking form. */
CREATE TABLE IF NOT EXISTS pets (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  breed       TEXT,
  weight      TEXT,
  care_note   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* ---------- catalogue ---------- */

CREATE TABLE IF NOT EXISTS packages (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  blurb   TEXT,
  mrp     INTEGER NOT NULL,
  price   INTEGER NOT NULL,
  mins    INTEGER NOT NULL,
  popular BOOLEAN NOT NULL DEFAULT FALSE,
  active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS package_inclusions (
  id         SERIAL PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  item       TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS addons (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  price       INTEGER NOT NULL,
  note        TEXT,
  attach_rate INTEGER,
  sort        INTEGER NOT NULL DEFAULT 0
);

/* Pricing here is provisional — flagged in both apps and the admin catalogue. */
CREATE TABLE IF NOT EXISTS walk_durations (
  id          TEXT PRIMARY KEY,
  mins        INTEGER NOT NULL,
  price       INTEGER NOT NULL,
  note        TEXT,
  km          TEXT,
  provisional BOOLEAN NOT NULL DEFAULT TRUE,
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_categories (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  category_id  TEXT REFERENCES product_categories(id),
  art          TEXT,
  tone         INTEGER NOT NULL DEFAULT 0,
  mrp          INTEGER NOT NULL,
  price        INTEGER NOT NULL,
  trade        INTEGER NOT NULL,
  rating       NUMERIC(2,1),
  reviews      INTEGER NOT NULL DEFAULT 0,
  sizes        TEXT[] NOT NULL DEFAULT '{}',
  default_size INTEGER NOT NULL DEFAULT 0,
  tag          TEXT,
  stock        TEXT NOT NULL DEFAULT 'In stock',
  description  TEXT,
  bullets      TEXT[] NOT NULL DEFAULT '{}',
  ingredients  TEXT,
  contains     TEXT[] NOT NULL DEFAULT '{}',
  sort         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS coupons (
  id         SERIAL PRIMARY KEY,
  code       TEXT UNIQUE NOT NULL,
  title      TEXT NOT NULL,
  subtitle   TEXT,
  applies_to TEXT,
  expires_on TEXT,
  redeemed   INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT FALSE,
  sort       INTEGER NOT NULL DEFAULT 0
);

/* ---------- operations ---------- */

/* channel is the field the admin console's reporting turns on: it is the only
   record that an order arrived on WhatsApp rather than in the app. */
CREATE TABLE IF NOT EXISTS bookings (
  id              TEXT PRIMARY KEY,
  customer_id     TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name   TEXT NOT NULL,
  pet_id          INTEGER REFERENCES pets(id) ON DELETE SET NULL,
  pet_name        TEXT NOT NULL,
  service_kind    TEXT NOT NULL CHECK (service_kind IN ('groom','walk')),
  service_label   TEXT NOT NULL,
  package_id      TEXT REFERENCES packages(id),
  walk_id         TEXT REFERENCES walk_durations(id),
  scheduled_label TEXT NOT NULL,
  scheduled_at    TIMESTAMPTZ,
  is_today        BOOLEAN NOT NULL DEFAULT FALSE,
  partner_id      TEXT REFERENCES partners(id) ON DELETE SET NULL,
  partner_name    TEXT NOT NULL DEFAULT 'Unassigned',
  status          TEXT NOT NULL DEFAULT 'Confirmed',
  total           INTEGER NOT NULL DEFAULT 0,
  channel         TEXT NOT NULL DEFAULT 'App'
                  CHECK (channel IN ('App','WhatsApp','Phone call','Instagram','Walk-in','Referral')),
  care_note       TEXT,
  address         TEXT,
  created_by      INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_partner_idx  ON bookings(partner_name);
CREATE INDEX IF NOT EXISTS bookings_channel_idx  ON bookings(channel);
CREATE INDEX IF NOT EXISTS bookings_customer_idx ON bookings(customer_id);

CREATE TABLE IF NOT EXISTS booking_activity (
  id          SERIAL PRIMARY KEY,
  booking_id  TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  detail      TEXT,
  state       TEXT NOT NULL DEFAULT 'done' CHECK (state IN ('done','now','todo')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_orders (
  id            TEXT PRIMARY KEY,
  customer_id   TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  placed_label  TEXT NOT NULL,
  item_count    INTEGER NOT NULL DEFAULT 0,
  total         INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'Packed',
  channel       TEXT NOT NULL DEFAULT 'App',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_order_items (
  id         SERIAL PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  qty        INTEGER NOT NULL DEFAULT 1,
  size_label TEXT,
  unit_price INTEGER NOT NULL DEFAULT 0
);

/* ---------- configuration ---------- */

CREATE TABLE IF NOT EXISTS service_areas (
  id       SERIAL PRIMARY KEY,
  name     TEXT UNIQUE NOT NULL,
  groomers INTEGER NOT NULL DEFAULT 0,
  walkers  INTEGER NOT NULL DEFAULT 0,
  status   TEXT NOT NULL DEFAULT 'Pending',
  sort     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS booking_slots (
  id      SERIAL PRIMARY KEY,
  label   TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  tag     TEXT,
  sort    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  label      TEXT NOT NULL,
  group_name TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS integrations (
  id     SERIAL PRIMARY KEY,
  name   TEXT NOT NULL,
  detail TEXT,
  icon   TEXT,
  status TEXT NOT NULL DEFAULT 'Not connected',
  sort   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS staff_permissions (
  id             SERIAL PRIMARY KEY,
  capability     TEXT NOT NULL,
  bookings_staff BOOLEAN NOT NULL DEFAULT FALSE,
  support        BOOLEAN NOT NULL DEFAULT FALSE,
  super_admin    BOOLEAN NOT NULL DEFAULT TRUE,
  sort           INTEGER NOT NULL DEFAULT 0
);

/* ---------- reporting ----------
   Operational figures are computed from the tables above. These hold the
   headline numbers the prototype showed with no underlying rows — a snapshot,
   to be replaced by real aggregates once there is history to aggregate. */

CREATE TABLE IF NOT EXISTS monthly_revenue (
  id              SERIAL PRIMARY KEY,
  month_label     TEXT NOT NULL,
  value_thousands INTEGER NOT NULL,
  is_current      BOOLEAN NOT NULL DEFAULT FALSE,
  sort            INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS metrics (
  key        TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  value      TEXT NOT NULL,
  delta      TEXT,
  positive   BOOLEAN,
  group_name TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS channel_split (
  id         SERIAL PRIMARY KEY,
  label      TEXT NOT NULL,
  percentage INTEGER NOT NULL,
  colour     TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS revenue_lines (
  id      SERIAL PRIMARY KEY,
  line    TEXT NOT NULL,
  revenue TEXT NOT NULL,
  share   TEXT NOT NULL,
  growth  TEXT NOT NULL,
  sort    INTEGER NOT NULL DEFAULT 0
);

/* ============================================================
   Wag & Tails design tokens — one source, two consumers.

   These are the values in packages/ui-web/src/styles.css, lifted out so the
   React Native apps can read them too. React Native has no CSS, so the web
   keeps the stylesheet and the apps consume these objects; the values are the
   same either way.

   The contrast decisions the Build Book records are load-bearing:
     white on brand.700   12:1    passes AA — every primary CTA
     ink.3 on canvas      5.6:1   passes AA — secondary text
     accent.600 on canvas 4.9:1   passes AA — accent text and links
     white on accent.400  2.77:1  FAILS     — never a button or small text
   ============================================================ */

export const colors = {
  brand: {
    900: '#1B0A03',
    800: '#2B1206',
    700: '#4A1E0B', // the logo brown. Primary surfaces and every primary CTA.
    600: '#5E2A11',
    500: '#6E3A1C',
    300: '#C7A88A',
    200: '#DCC3A9', // biscuit. Idle rings, on-brand secondary text.
    100: '#EADBC8',
    50:  '#F6EDE3'
  },
  accent: {
    700: '#A8480C',
    600: '#C25A12', // accessible tint for accent-coloured type
    500: '#E86A1C',
    400: '#F07B2C', // the hot accent. Only where an action or live state exists.
    100: '#FBDCC2',
    50:  '#FDF0E4'
  },
  ink: {
    1: '#241309',
    2: '#4A3A2E',
    3: '#6E5B4B', // 5.6:1 on canvas
    4: '#9B8A7A',
    5: '#C4B6A8'
  },
  canvas:  '#FBF7F2',
  surface: '#FFFFFF',
  sunken:  '#F4EDE5',
  line:    '#EBE0D4',
  line2:   '#DDCEBE',
  ok:     { 600: '#1F7A4D', 50: '#E8F5EE' },
  warn:   { 600: '#B57209', 50: '#FCF2E0' },
  danger: { 600: '#C0392B', 50: '#FBEAE7' },
  info:   { 600: '#1F5F8B', 50: '#E7F1F8' },
  white:  '#FFFFFF'
};

/* Plus Jakarta Sans for display, Inter for UI — the same pairing the web uses.
   The apps load these through expo-font; the keys here are the family names
   the loaded fonts register under. */
export const fonts = {
  display: 'PlusJakartaSans_800ExtraBold',
  displaySemi: 'PlusJakartaSans_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold'
};

/* Type scale, matching the web's .t-* classes. */
export const type = {
  hero:  { fontFamily: fonts.display, fontSize: 30, letterSpacing: -0.8, lineHeight: 36 },
  h1:    { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.5, lineHeight: 28 },
  h2:    { fontFamily: fonts.display, fontSize: 18, letterSpacing: -0.3, lineHeight: 24 },
  h3:    { fontFamily: fonts.displaySemi, fontSize: 15, letterSpacing: -0.2, lineHeight: 20 },
  body:  { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  sm:    { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  xs:    { fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  xxs:   { fontFamily: fonts.body, fontSize: 10.5, lineHeight: 15 },
  eyebrow: {
    fontFamily: fonts.bodyBold, fontSize: 10.5,
    letterSpacing: 1.4, textTransform: 'uppercase'
  }
};

/* Radii: 8 / 12 / 14 / 18 / 24, full pill for chips only.
   Buttons are 14 — rounded rectangles read more premium than pills and match
   the reference apps. */
export const radii = { sm: 8, md: 12, btn: 14, lg: 18, xl: 24, pill: 999 };

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40 };

/* Airbnb's soft elevation rather than Material's hard shadow. */
export const shadow = {
  card: {
    shadowColor: '#2B1206',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  raised: {
    shadowColor: '#2B1206',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6
  }
};

/* The pet avatar ring is the product's signature element, carried across every
   surface. Its states are the same in the apps as on the web. */
export const ringStates = {
  idle:      { stroke: colors.brand[200], width: 3 },
  active:    { stroke: colors.accent[400], width: 3.5 },
  progress:  { stroke: colors.accent[400], width: 3.5 },
  searching: { stroke: colors.brand[300], width: 3 },
  done:      { stroke: colors.ok[600], width: 3.5 }
};

export const statusTone = {
  'On the way': 'accent', 'In progress': 'accent', 'Walking now': 'accent',
  Confirmed: 'brand', Scheduled: 'brand', 'Needs partner': 'danger',
  Completed: 'ok', Delivered: 'ok', Cancelled: 'muted',
  Packed: 'info', 'Out for delivery': 'accent', Active: 'ok', Pending: 'warn',
  Verified: 'ok', 'Renewal due': 'warn', Due: 'warn', Paid: 'ok'
};

export const toneColor = {
  brand:  { bg: colors.brand[50],  fg: colors.brand[700] },
  accent: { bg: colors.accent[50], fg: colors.accent[600] },
  ok:     { bg: colors.ok[50],     fg: colors.ok[600] },
  warn:   { bg: colors.warn[50],   fg: colors.warn[600] },
  danger: { bg: colors.danger[50], fg: colors.danger[600] },
  info:   { bg: colors.info[50],   fg: colors.info[600] },
  muted:  { bg: colors.sunken,     fg: colors.ink[3] }
};

/* Indian number formatting, matching inr() everywhere else. */
export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

export default { colors, fonts, type, radii, space, shadow, ringStates, statusTone, toneColor, inr };

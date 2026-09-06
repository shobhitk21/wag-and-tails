/* The groomer's job sheet.

   Rows are keyed `p:<name>` for package inclusions and `a:<name>` for add-ons.
   The Build Book records a real bug here: a "De-matting" add-on shared a name
   with a Luxury package inclusion, so ticking one unticked the other. The
   namespace is what stops two sources producing the same key. */

export function inclGroup(item) {
  const s = item.toLowerCase();
  if (/tick/.test(s)) return 'Tick care';
  if (/bath|blow dry|shampoo|conditioner/.test(s)) return 'Bath & dry';
  if (/nail|ear|eye|teeth|mouth/.test(s)) return 'Nails, ears & teeth';
  if (/trim|styl|haircut|de-mat|sanitary|clipping/.test(s)) return 'Trim & style';
  return 'Finishing';
}

export const GROUP_ORDER = [
  'Bath & dry', 'Trim & style', 'Nails, ears & teeth', 'Tick care', 'Finishing'
];

/* Builds the checklist for a booking from its package and add-ons.
   `c` is a pg client so this can join a caller's transaction. */
export async function buildChecklist(c, bookingId, packageId) {
  const incl = await c.query(
    'SELECT item FROM package_inclusions WHERE package_id = $1 ORDER BY sort',
    [packageId]
  );
  const rows = incl.rows.map((r) => ({
    key: `p:${r.item}`, label: r.item, group: inclGroup(r.item)
  }));

  const addons = await c.query(
    `SELECT a.name FROM booking_addons ba JOIN addons a ON a.id = ba.addon_id
     WHERE ba.booking_id = $1`,
    [bookingId]
  );
  for (const a of addons.rows) {
    rows.push({ key: `a:${a.name}`, label: `${a.name} (add-on)`, group: inclGroup(a.name) });
  }

  rows.sort((x, y) => GROUP_ORDER.indexOf(x.group) - GROUP_ORDER.indexOf(y.group));

  let i = 0;
  for (const r of rows) {
    await c.query(
      `INSERT INTO job_checklist (booking_id, item_key, label, group_name, done, sort)
       VALUES ($1,$2,$3,$4,FALSE,$5) ON CONFLICT (booking_id, item_key) DO NOTHING`,
      [bookingId, r.key, r.label, r.group, i++]
    );
  }
  return rows.length;
}

/* Groups flat checklist rows for display, in the fixed group order. */
export function groupChecklist(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.group_name)) map.set(r.group_name, []);
    map.get(r.group_name).push(r);
  }
  return GROUP_ORDER
    .filter((g) => map.has(g))
    .map((g) => ({ group: g, items: map.get(g) }));
}

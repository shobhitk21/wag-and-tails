/* Console primitives, ported from webPage()'s helpers in js/screens-staff.js
   and the shared components in js/ui.js. They render into the same class names
   styles.css already defines, so the look is the prototype's, unchanged. */
import { Ico, IcoFill } from './Icon.jsx';

export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

export function Pill({ children, tone = 'muted', lg = false, live = false }) {
  return (
    <span className={`pill pill--${tone}${lg ? ' pill--lg' : ''}`}>
      {live && <i className="dot dot--live" />}
      {children}
    </span>
  );
}

/* The status vocabulary of both consoles, mapped to the pill tones in
   styles.css. Anything unknown falls back to muted rather than going bare. */
const STATUS_TONE = {
  'On the way': 'solid', 'In progress': 'solid', Confirmed: 'accent',
  Completed: 'ok', Delivered: 'ok', Cancelled: 'muted', 'Needs partner': 'danger',
  Packed: 'info', 'Out for delivery': 'accent', Active: 'ok', Pending: 'warn',
  New: 'danger', Booked: 'ok', 'Needs follow-up': 'warn', Verified: 'ok',
  'Renewal due': 'warn', 'Under review': 'info', Paid: 'ok', Due: 'warn',
  Live: 'ok', 'Not connected': 'muted', Suspended: 'danger'
};

export function StatusDot({ status }) {
  return <Pill tone={STATUS_TONE[status] ?? 'muted'}>{status}</Pill>;
}

export function KpiCard({ label, value, delta, up }) {
  return (
    <div className="wcard">
      <div className="kpi__k">{label}</div>
      <div className="kpi__v">{value}</div>
      {delta && (
        <div className={`kpi__d kpi__d--${up ? 'up' : 'down'}`}>
          <Ico name={up ? 'chevU' : 'chevD'} size={13} />
          {delta} vs last month
        </div>
      )}
    </div>
  );
}

export function WTable({ cols, children }) {
  return (
    <div className="tablewrap">
      <table className="table">
        <thead>
          <tr>{cols.map((c, i) => <th key={i}>{c}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function WCard({ title, right, children, className = '', style }) {
  return (
    <div className={`wcard ${className}`} style={style}>
      {(title || right) && (
        <div className="wcard__head">
          {typeof title === 'string' ? <div className="wcard__t">{title}</div> : title}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Kv({ k, children }) {
  return (
    <div className="between g3" style={{ padding: '8px 0' }}>
      <span className="t-sm dim">{k}</span>
      <span className="t-sm" style={{ fontWeight: 600, textAlign: 'right' }}>{children}</span>
    </div>
  );
}

export function RatingChip({ value }) {
  if (!value || Number(value) === 0) return <span className="dim">—</span>;
  return (
    <span className="rating">
      <IcoFill name="star" size={13} />
      <span>{value}</span>
    </span>
  );
}

/* Live price in the display face with the struck MRP beside it. */
export function Price({ now, mrp, size = '' }) {
  return (
    <span className={`price ${size}`}>
      <span className="price__now">{inr(now)}</span>
      {mrp ? <s className="price__mrp">{inr(mrp)}</s> : null}
    </span>
  );
}

const BANNER_TONES = new Set(['info', 'warn', 'ok', 'accent']);

export function Banner({ tone = 'info', icon = 'info', children, className = '' }) {
  /* styles.css defines four banner tones; danger borrows warn's box and keeps
     its own icon colour rather than rendering an unstyled div. */
  const box = BANNER_TONES.has(tone) ? tone : 'warn';
  return (
    <div className={`banner banner--${box} ${className}`}>
      <span className="banner__ico" style={{ color: `var(--${tone}-600)` }}>
        <Ico name={icon} size={17} />
      </span>
      <div className="grow t-xs">{children}</div>
    </div>
  );
}

/* className is merged, not overwritten — spreading rest last would otherwise
   drop the wbtn classes whenever a caller passes a spacing utility. */
export function WButton({ variant = 'ghost', sm = false, className = '', children, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      className={`wbtn wbtn--${variant}${sm ? ' wbtn--sm' : ''}${className ? ` ${className}` : ''}`}
    >
      {children}
    </button>
  );
}

export function FilterChip({ on, className = '', children, ...rest }) {
  return (
    <button type="button" {...rest} className={`filterchip${on ? ' is-on' : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </button>
  );
}

export function Field({ label, ...rest }) {
  return (
    <div>
      {label && <div className="formlabel">{label}</div>}
      <div className="field"><input className="field__input" {...rest} /></div>
    </div>
  );
}

export function TextArea({ label, ...rest }) {
  return (
    <div>
      {label && <div className="formlabel">{label}</div>}
      <div className="field"><textarea className="field__input" {...rest} /></div>
    </div>
  );
}

/* Bar chart, ₹ thousands, matching the admin dashboard and reports screens. */
export function Chart({ data }) {
  const max = Math.max(...data.map((m) => m.value_thousands), 1);
  return (
    <div className="chart">
      {data.map((m) => (
        <div key={m.month_label} className={`chart__col${m.is_current ? ' is-on' : ''}`}>
          <div className="t-2xs dim" style={{ fontWeight: 700 }}>{m.value_thousands}</div>
          <div className="chart__bar" style={{ height: (m.value_thousands / max) * 130 }} />
          <div className="chart__lab">{m.month_label}</div>
        </div>
      ))}
    </div>
  );
}

/* Channel split, drawn with conic-gradient exactly as the prototype did. */
export function Donut({ items, total, caption = 'bookings' }) {
  let acc = 0;
  const segs = items
    .map((i) => {
      const from = acc;
      acc += i.percentage;
      return `${i.colour} ${from}% ${acc}%`;
    })
    .join(', ');

  return (
    <div className="donut">
      <div style={{
        width: 132, height: 132, borderRadius: '50%', flex: '0 0 auto',
        background: `conic-gradient(${segs})`, position: 'relative'
      }}>
        <div style={{
          position: 'absolute', inset: 26, background: 'var(--surface)', borderRadius: '50%',
          display: 'grid', placeItems: 'center', textAlign: 'center'
        }}>
          <div>
            <div className="t-h2">{total}</div>
            <div className="t-2xs dim">{caption}</div>
          </div>
        </div>
      </div>
      <div className="legend">
        {items.map((i) => (
          <div className="legend__i" key={i.label}>
            <span className="legend__s" style={{ background: i.colour }} />
            <span className="grow">{i.label}</span>
            <span style={{ fontWeight: 700 }}>{i.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'search', title, sub }) {
  return (
    <div className="empty">
      <div className="empty__art"><Ico name={icon} size={30} /></div>
      <div className="empty__t">{title}</div>
      {sub && <div className="empty__s">{sub}</div>}
    </div>
  );
}

/* The care note, rendered exactly as careNote() renders it in the apps. This is
   the through-line: the same sentence, from the same pets row, on every
   surface. Variants: default (light), `loud` for the groomer's job sheet,
   `onbrand` for the walker's request. */
export function CareNote({ note, petName, by, variant }) {
  if (!note) return null;
  return (
    <div className={`carenote${variant ? ` carenote--${variant}` : ''}`}>
      <div className="row start g2 mb2" style={{ opacity: 0.85 }}>
        <Ico name="alert" size={15} />
        <span className="t-eyebrow" style={{ color: 'inherit' }}>
          Care note{by ? ` from ${by}` : ''}
        </span>
      </div>
      <div className="carenote__q">“{note}”</div>
      {petName && (
        <div className="carenote__by">Written on {petName}’s profile by the owner.</div>
      )}
    </div>
  );
}

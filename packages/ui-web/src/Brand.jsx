/* Brand marks, ported from the prototype's js/brand.js.
   Inline SVG so the consoles stay free of external image assets. */

/* Dog standing behind, cat sitting in front, ground arc. The cat carries a
   brown halo (paint-order: stroke) so it separates from the dog — built from
   composite shapes because one clever path did not hold at 22px. */
export function LogoMark({ size = 30, ink = '#FFFFFF', ground = '#4A1E0B' }) {
  return (
    <svg viewBox="0 0 240 240" width={size} height={size} role="img" aria-label="Wag and Tails">
      <g fill={ink}>
        <path d="M176 92c22 0 32 24 30 54-2 24-4 42-4 60h-42c0-20-2-38-6-58-5-26-2-56 22-56Z" />
        <path d="M161 54h32l5 54c0 9-34 11-35 3Z" />
        <ellipse cx="176" cy="54" rx="30" ry="27" />
        <ellipse cx="206" cy="64" rx="17" ry="12.5" />
        <path d="M152 32c-15 9-22 30-18 50 3 14 12 21 18 16-7-22-7-46 4-62 2-4-1-6-4-4Z" />
        <path fill="none" stroke={ink} strokeWidth="17" strokeLinecap="round"
          d="M162 150c-36-6-74 10-88 44" />
      </g>
      <circle fill={ground} cx="183" cy="49" r="6.5" />
      <circle fill={ground} cx="220" cy="62" r="4.5" />
      <g transform="translate(-12,4)">
        <path fill={ink} stroke={ground} strokeWidth="11" paintOrder="stroke" strokeLinejoin="round"
          d="M110 130l-6-26c-1-5 3-8 7-5l18 14c8-3 17-3 25 0l18-14c4-3 8 0 7 5l-6 26c9 10 13 24 9 37-3 10-7 19-7 29 0 5 1 10 2 15h-64c2-9 3-19 2-28-1-8-4-15-5-23-2-12 2-24 10-33Z" />
        <path fill="none" stroke={ink} strokeWidth="12" strokeLinecap="round"
          d="M170 194c15-3 24-15 21-29" />
        <circle fill={ground} cx="129" cy="146" r="4.5" />
        <circle fill={ground} cx="153" cy="146" r="4.5" />
      </g>
      <path fill={ink} d="M16 210c50-14 158-14 208 0-50 9-158 9-208 0Z" />
    </svg>
  );
}

export function LogoLockup({ width = 200, ink = '#FFFFFF', ground = '#4A1E0B' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <LogoMark size={Math.round(width * 0.6)} ink={ink} ground={ground} />
      <div style={{ textAlign: 'center', lineHeight: 1 }}>
        <div style={{
          fontFamily: 'var(--display)', fontWeight: 800, whiteSpace: 'nowrap',
          letterSpacing: '.01em', fontSize: Math.round(width * 0.132), color: ink
        }}>
          WAG &amp; TAILS
        </div>
        <div style={{
          fontSize: Math.round(width * 0.048), letterSpacing: '.36em', whiteSpace: 'nowrap',
          color: ink, opacity: 0.6, marginTop: 9
        }}>
          EST. 2022
        </div>
      </div>
    </div>
  );
}

/* Partner and staff avatar. */
export function PersonSvg({ name, from = '#F07B2C', to = '#A8480C' }) {
  const id = 'p' + String(name).replace(/\W/g, '');
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={name}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id})`} />
      <circle cx="50" cy="39" r="17" fill="rgba(255,255,255,.9)" />
      <path d="M17 93c3-19 16-29 33-29s30 10 33 29Z" fill="rgba(255,255,255,.9)" />
    </svg>
  );
}

/* Groomers read warm, walkers green — the same split the prototype used. */
export const partnerArt = (kind) =>
  kind === 'Walker' ? ['#1F7A4D', '#0E4229'] : ['#F07B2C', '#A8480C'];

export function Avatar({ name, art, size = 44 }) {
  const [from, to] = art ?? ['#F07B2C', '#A8480C'];
  return (
    <div className="avatar" style={{ width: size, height: size }}>
      <PersonSvg name={name} from={from} to={to} />
    </div>
  );
}

const PROD_TONES = [
  { bg: '#F6EDE3', a: '#4A1E0B', b: '#E86A1C' },
  { bg: '#EAF1EC', a: '#1F5C3D', b: '#4C9B72' },
  { bg: '#F4EAF1', a: '#5B2545', b: '#B0648E' },
  { bg: '#EAEFF5', a: '#1F3F5C', b: '#5B8CB8' }
];

/* 15 product illustration types, keyed off the product's `art` field. */
export function ProductSvg({ art = 'bottle', tone = 0 }) {
  const t = PROD_TONES[tone % PROD_TONES.length];
  const shapes = {
    bottle: (
      <>
        <rect x="46" y="34" width="28" height="60" rx="9" fill={t.a} />
        <rect x="52" y="22" width="16" height="14" rx="4" fill={t.b} />
        <rect x="50" y="52" width="20" height="24" rx="4" fill={t.bg} opacity=".85" />
      </>
    ),
    spray: (
      <>
        <rect x="48" y="46" width="26" height="48" rx="8" fill={t.a} />
        <rect x="54" y="30" width="12" height="18" rx="3" fill={t.b} />
        <path d="M54 30h-14l-4-8h18Z" fill={t.b} />
        <rect x="52" y="60" width="18" height="20" rx="3" fill={t.bg} opacity=".85" />
      </>
    ),
    tub: (
      <>
        <rect x="36" y="48" width="48" height="38" rx="8" fill={t.a} />
        <rect x="32" y="38" width="56" height="14" rx="6" fill={t.b} />
        <circle cx="60" cy="68" r="10" fill={t.bg} opacity=".85" />
      </>
    ),
    brush: (
      <>
        <rect x="40" y="30" width="40" height="34" rx="8" fill={t.a} />
        <rect x="52" y="62" width="16" height="30" rx="7" fill={t.b} />
        {Array.from({ length: 6 }, (_, i) => (
          <line key={i} x1={46 + i * 6} y1="36" x2={46 + i * 6} y2="58"
            stroke={t.bg} strokeWidth="2.4" strokeLinecap="round" />
        ))}
      </>
    ),
    comb: (
      <>
        <rect x="34" y="40" width="52" height="14" rx="6" fill={t.a} />
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={37 + i * 6} y="54" width="3" height="20" rx="1.5" fill={t.a} />
        ))}
        <rect x="48" y="78" width="24" height="12" rx="6" fill={t.b} />
      </>
    ),
    clipper: (
      <>
        <path d="M42 34c-6 8-6 22 2 32l16 20 16-20c8-10 8-24 2-32"
          fill="none" stroke={t.a} strokeWidth="9" strokeLinecap="round" />
        <circle cx="60" cy="86" r="8" fill={t.b} />
      </>
    ),
    kit: (
      <>
        <rect x="30" y="52" width="34" height="14" rx="7" fill={t.a} />
        <rect x="60" y="54" width="30" height="10" rx="5" fill={t.b} />
        <rect x="26" y="46" width="14" height="26" rx="6" fill={t.b} />
        <path d="M64 74c8-4 18-4 26 0" stroke={t.a} strokeWidth="5" strokeLinecap="round" fill="none" />
      </>
    ),
    harness: (
      <>
        <rect x="34" y="42" width="52" height="26" rx="10" fill={t.a} />
        <path d="M34 55H22M86 55h12" stroke={t.b} strokeWidth="7" strokeLinecap="round" />
        <circle cx="60" cy="55" r="8" fill={t.bg} />
        <path d="M46 68v14M74 68v14" stroke={t.a} strokeWidth="6" strokeLinecap="round" />
      </>
    ),
    leash: (
      <>
        <path d="M34 84c14-30 38-30 52 0" stroke={t.a} strokeWidth="8" fill="none" strokeLinecap="round" />
        <circle cx="34" cy="84" r="10" fill="none" stroke={t.b} strokeWidth="7" />
        <rect x="80" y="78" width="12" height="16" rx="4" fill={t.b} />
      </>
    ),
    bag: (
      <>
        <path d="M38 40h44l6 52H32Z" fill={t.a} />
        <path d="M38 40c4-8 8-12 22-12s18 4 22 12" fill={t.b} />
        <rect x="44" y="58" width="32" height="22" rx="4" fill={t.bg} opacity=".85" />
      </>
    ),
    chew: (
      <>
        {[0, 1, 2].map((i) => (
          <rect key={i} x={34 + i * 8} y={34 + i * 6} width="14" height="52" rx="7"
            fill={i === 1 ? t.b : t.a}
            transform={`rotate(${-14 + i * 14} ${41 + i * 8} 60)`} />
        ))}
      </>
    ),
    rope: (
      <>
        <path d="M32 60c10-14 24-14 28 0s18 14 28 0"
          stroke={t.a} strokeWidth="13" fill="none" strokeLinecap="round" />
        <circle cx="32" cy="60" r="9" fill={t.b} />
        <circle cx="88" cy="60" r="9" fill={t.b} />
      </>
    ),
    ball: (
      <>
        <circle cx="48" cy="66" r="20" fill={t.a} />
        <circle cx="76" cy="48" r="14" fill={t.b} />
        <circle cx="82" cy="76" r="11" fill={t.a} opacity=".6" />
      </>
    ),
    mat: (
      <>
        <rect x="26" y="44" width="68" height="42" rx="10" fill={t.a} />
        <rect x="34" y="52" width="52" height="26" rx="6" fill={t.b} opacity=".5" />
      </>
    ),
    flask: (
      <>
        <rect x="48" y="30" width="24" height="46" rx="8" fill={t.a} />
        <path d="M40 78h40l-4 16H44Z" fill={t.b} />
        <rect x="54" y="20" width="12" height="12" rx="4" fill={t.b} />
      </>
    )
  };

  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <rect width="120" height="120" fill={t.bg} />
      {shapes[art] ?? shapes.bottle}
    </svg>
  );
}

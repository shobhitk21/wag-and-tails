/* The 24px-grid stroke icon set from js/ui.js. Only the glyphs the two web
   consoles actually reach for are carried over; the mobile-only ones stay in
   the apps' own set. */
const ICON = {
  home: 'M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1Z',
  paw: null,
  cal: 'M3.2 5h17.6v16H3.2Z',
  chev: 'm9 5 7 7-7 7',
  chevD: 'm5 9 7 7 7-7',
  chevU: 'm5 15 7-7 7 7',
  back: 'm15 5-7 7 7 7',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'm5 12.6 4.4 4.4L19 7.4',
  plus: 'M12 5v14M5 12h14',
  filter: 'M4 6.6h16M7 12h10M10 17.4h4',
  logout: 'M15 4.6H6.6v14.8H15M12.6 12h8.2m0 0-3-3m3 3-3 3'
};

/* Glyphs that need more than one element are written out in full. */
const COMPLEX = {
  paw: (
    <>
      <ellipse cx="6.6" cy="9.2" rx="2" ry="2.6" />
      <ellipse cx="11.4" cy="7.4" rx="2.1" ry="2.8" />
      <ellipse cx="16.6" cy="9.2" rx="2" ry="2.6" />
      <path d="M11.6 12.6c2.9 0 5.2 2.2 5.2 4.6s-2.3 4.8-5.2 4.8-5.2-2.4-5.2-4.8 2.3-4.6 5.2-4.6Z" />
    </>
  ),
  cal: (
    <>
      <rect x="3.2" y="5" width="17.6" height="16" rx="3.4" />
      <path d="M8 3v4M16 3v4M3.2 10h17.6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.6 20.4c.6-4.1 3.8-6.6 7.4-6.6s6.8 2.5 7.4 6.6" />
    </>
  ),
  brief: (
    <>
      <rect x="2.8" y="7.2" width="18.4" height="13" rx="3.2" />
      <path d="M8.6 7.2V5.8A2.4 2.4 0 0 1 11 3.4h2a2.4 2.4 0 0 1 2.4 2.4v1.4" />
    </>
  ),
  wallet: (
    <>
      <rect x="2.8" y="5.8" width="18.4" height="13.4" rx="3.4" />
      <path d="M2.8 10h18.4" />
      <circle cx="17" cy="14.8" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2.6" />
      <circle cx="18" cy="6" r="2.6" />
      <path d="M8.6 18h5.6a3.8 3.8 0 0 0 0-7.6h-4.4a3.8 3.8 0 0 1 0-7.6" strokeDasharray="3 3" />
    </>
  ),
  phone: <path d="M6.2 3.4h3l2 4.9-2.2 1.6a12.4 12.4 0 0 0 5.4 5.4l1.6-2.2 4.9 2v3a2 2 0 0 1-2.2 2A17.4 17.4 0 0 1 4.2 5.6a2 2 0 0 1 2-2.2Z" />,
  chat: <path d="M20.6 11.8c0 4.2-3.8 7.6-8.6 7.6a10 10 0 0 1-2.8-.4L4 20.6l1.5-4a7.2 7.2 0 0 1-1.5-4.4c0-4.2 3.8-7.6 8.6-7.6s8 3.4 8 7.2Z" />,
  nav: <path d="M20.6 3.4 3.6 10.6l7.2 2.6 2.6 7.2Z" />,
  cam: (
    <>
      <rect x="2.8" y="7" width="18.4" height="13.4" rx="3.4" />
      <circle cx="12" cy="13.8" r="3.6" />
      <path d="M8.6 7 10 4h4l1.4 3" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21.4s6.8-6.2 6.8-11.4A6.8 6.8 0 0 0 5.2 10c0 5.2 6.8 11.4 6.8 11.4Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  star: <path d="m12 3.4 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 7v5.4l3.4 2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.6 21.4 20H2.6Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 11v5.4" />
      <circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  card: (
    <>
      <rect x="2.8" y="5.4" width="18.4" height="13.2" rx="3.2" />
      <path d="M2.8 10h18.4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.2 20 6v6c0 4.6-3.3 8-8 9.6C7.3 20 4 16.6 4 12V6Z" />
      <path d="m8.8 12.2 2.2 2.2 4.2-4.2" />
    </>
  ),
  gift: (
    <>
      <rect x="3.2" y="8.6" width="17.6" height="12.2" rx="2.6" />
      <path d="M3.2 13h17.6M12 8.6v12.2" />
      <path d="M12 8.6S10.6 4 8.2 4a2.4 2.4 0 0 0 0 4.6ZM12 8.6S13.4 4 15.8 4a2.4 2.4 0 0 1 0 4.6Z" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3.4h7.4L19 9v11.6H6Z" />
      <path d="M13.2 3.4V9H19M9 13.4h6M9 16.8h4" />
    </>
  ),
  edit: (
    <>
      <path d="M15.6 4.6 19.4 8.4 8.8 19H5v-3.8Z" />
      <path d="M13.4 6.8 17.2 10.6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.2 16.2 4.4 4.4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.6 12S6 5.6 12 5.6 21.4 12 21.4 12 18 18.4 12 18.4 2.6 12 2.6 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  heart: <path d="M12 20.4S3.6 15.6 3.6 9.8A4.6 4.6 0 0 1 12 7.2a4.6 4.6 0 0 1 8.4 2.6c0 5.8-8.4 10.6-8.4 10.6Z" />,
  bag: (
    <>
      <path d="M5.4 8h13.2l1 12.4H4.4Z" />
      <path d="M8.8 8V6a3.2 3.2 0 0 1 6.4 0v2" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6.4" cy="6.4" r="2.6" />
      <circle cx="6.4" cy="17.6" r="2.6" />
      <path d="M8.6 8.2 20 18.4M8.6 15.8 20 5.6" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15.6" r="4" />
      <path d="m10.9 12.7 8-8M16.4 7.2l2.4 2.4M18.9 4.7l2.4 2.4" />
    </>
  )
};

export function Ico({ name, size = 20 }) {
  const complex = COMPLEX[name];
  const simple = ICON[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {complex ?? (simple ? <path d={simple} /> : null)}
    </svg>
  );
}

/* Filled variant, used for the star in rating chips. */
export function IcoFill({ name, size = 13 }) {
  const complex = COMPLEX[name];
  const simple = ICON[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
      {complex ?? (simple ? <path d={simple} /> : null)}
    </svg>
  );
}

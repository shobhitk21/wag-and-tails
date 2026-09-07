/* The console shell — sidebar, top bar, scroll area. This is webPage() from
   js/screens-staff.js, which both consoles shared; the nav definition is passed
   in so staff and admin each supply their own groups. */
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogoMark, Avatar } from './Brand.jsx';
import { Ico } from './Icon.jsx';
import { useConfirm } from './ConfirmDialog.jsx';

export function WebShell({
  nav, badges = {}, subtitle, who, title, sub, actions,
  search = true, onSignOut, children
}) {
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();
  const [confirm, confirmDialog] = useConfirm();

  return (
    <div className={`portal${navOpen ? ' is-navopen' : ''}`}>
      <aside className="side" onClick={() => setNavOpen(false)}>
        <div className="side__brand">
          <LogoMark size={30} ink="#fff" ground="var(--brand-800)" />
          <div>
            <div className="side__brand-t">Wag &amp; Tails</div>
            <div className="side__brand-s">{subtitle}</div>
          </div>
        </div>

        {nav.map((group) => (
          <div key={group.group}>
            <div className="side__group">{group.group}</div>
            {group.items.map((item) => {
              const n = badges[item.to] ?? 0;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `navitem${isActive ? ' is-on' : ''}`}
                >
                  <Ico name={item.ico} size={17} />
                  <span className="grow">{item.label}</span>
                  {n > 0 && <span className="navitem__badge">{n}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}

        <div className="side__foot">
          <button className="navitem" onClick={() => navigate('/profile')}>
            <span className="avatar" style={{ width: 26, height: 26 }}>
              <Avatar name={who.name} art={who.art} size={26} />
            </span>
            <span className="grow" style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 12.5 }}>{who.name}</span>
              <span style={{ display: 'block', fontSize: 10.5, opacity: 0.55 }}>{who.role}</span>
            </span>
          </button>
          <button
            className="navitem"
            onClick={async () => {
              const ok = await confirm({
                title: 'Sign out?',
                body: 'You will need your email and password to get back in.',
                confirmLabel: 'Sign out',
                tone: 'danger'
              });
              if (ok) onSignOut?.();
            }}
          >
            <Ico name="logout" size={17} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="desk__main">
        <div className="topbar">
          <button
            className="wbtn wbtn--ghost wbtn--sm navtoggle"
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Menu"
          >
            <Ico name="filter" size={16} />
          </button>
          <div className="grow">
            <div className="topbar__t">{title}</div>
            {sub && <div className="topbar__s">{sub}</div>}
          </div>
          {search && (
            <div className="topbar__search">
              <Ico name="search" size={16} />
              <span>Search…</span>
            </div>
          )}
          {actions}
        </div>
        <div className="desk__scroll">{children}</div>
      </div>
      {confirmDialog}
    </div>
  );
}

/* Shown while a screen's first fetch is in flight. */
export function Loading({ label = 'Loading' }) {
  return (
    <div className="loadwrap">
      <div className="wspin" role="status" aria-label={label} />
    </div>
  );
}

/* Failed fetches say what went wrong and offer a retry — an API that is down
   should look different from a screen with no rows. */
export function ErrorBox({ error, onRetry }) {
  return (
    <div className="errbox">
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Could not load this screen.</div>
      <div className="dim">{String(error?.message ?? error)}</div>
      {onRetry && (
        <button className="wbtn wbtn--ghost wbtn--sm mt3" onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}

/* Transient confirmation, 2.4s, matching toast() in the apps. */
export function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="wtoast" role="status">
      <Ico name="check" size={16} />
      <span>{message}</span>
    </div>
  );
}

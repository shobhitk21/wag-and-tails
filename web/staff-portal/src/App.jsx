import { Navigate, Route, Routes } from 'react-router-dom';
import {
  SignIn, WebShell, useAuth, useApi, roleArt, roleLabel,
  BookingsScreen, BookingScreen, OrdersScreen, OrderScreen,
  CustomersScreen, CustomerScreen
} from '@wag/ui-web';
import api from '@wag/api-client';

import Dashboard from './pages/Dashboard.jsx';
import NewBooking from './pages/NewBooking.jsx';
import Partners from './pages/Partners.jsx';
import Profile from './pages/Profile.jsx';

/* The staff sidebar — Operations, then Directory, as in the prototype. */
const NAV = [
  {
    group: 'Operations',
    items: [
      { to: '/', label: 'Dashboard', ico: 'home', end: true },
      /* No "New booking" item here — it's an action button on the Bookings
         screen and the dashboard, not a destination of its own. */
      { to: '/bookings', label: 'Bookings', ico: 'cal' },
      { to: '/orders', label: 'Store orders', ico: 'bag' }
    ]
  },
  {
    group: 'Directory',
    items: [
      { to: '/customers', label: 'Customers', ico: 'user' },
      { to: '/partners', label: 'Partners', ico: 'brief' }
    ]
  }
];

export default function App() {
  const { user, signIn, signOut } = useAuth();

  /* The Bookings badge counts what actually needs a partner right now. */
  const { data: unassigned } = useApi(
    () => (user ? api.bookings.list('unassigned') : Promise.resolve(null)),
    [user?.code]
  );

  if (!user) return <SignIn surface="staff" onSignedIn={signIn} />;

  const who = { name: user.name, role: roleLabel(user.role), art: roleArt(user.role) };
  const badges = { '/bookings': unassigned?.bookings?.length ?? 0 };

  /* Every screen renders through the same shell; passing a renderPage function
     lets the shared screens set their own title, sub and actions. */
  const renderPage = ({ title, sub, actions, search, body }) => (
    <WebShell
      nav={NAV}
      badges={badges}
      subtitle="Staff portal"
      who={who}
      title={title}
      sub={sub}
      actions={actions}
      search={search}
      onSignOut={signOut}
    >
      {body}
    </WebShell>
  );

  return (
    <Routes>
      <Route path="/" element={<Dashboard renderPage={renderPage} />} />
      <Route path="/bookings/new" element={<NewBooking renderPage={renderPage} />} />
      <Route path="/bookings" element={<BookingsScreen renderPage={renderPage} canCreate />} />
      <Route path="/bookings/:id" element={<BookingScreen renderPage={renderPage} />} />
      <Route path="/orders" element={<OrdersScreen renderPage={renderPage} />} />
      <Route path="/orders/:id" element={<OrderScreen renderPage={renderPage} />} />
      <Route path="/customers" element={<CustomersScreen renderPage={renderPage} />} />
      <Route path="/customers/:id" element={<CustomerScreen renderPage={renderPage} />} />
      <Route path="/partners" element={<Partners renderPage={renderPage} />} />
      <Route path="/profile" element={<Profile renderPage={renderPage} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

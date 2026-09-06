import { Navigate, Route, Routes } from 'react-router-dom';
import {
  SignIn, WebShell, useAuth, useApi, roleArt, roleLabel,
  BookingsScreen, BookingScreen, OrdersScreen, OrderScreen,
  CustomersScreen, CustomerScreen
} from '@wag/ui-web';
import api from '@wag/api-client';

import Dashboard from './pages/Dashboard.jsx';
import Reports from './pages/Reports.jsx';
import Payouts from './pages/Payouts.jsx';
import Products from './pages/Products.jsx';
import Product from './pages/Product.jsx';
import Packages from './pages/Packages.jsx';
import Coupons from './pages/Coupons.jsx';
import Partners from './pages/Partners.jsx';
import Partner from './pages/Partner.jsx';
import Staff from './pages/Staff.jsx';
import Areas from './pages/Areas.jsx';
import Settings from './pages/Settings.jsx';
import Profile from './pages/Profile.jsx';

/* The admin sidebar — Overview, Operations, Catalogue, People, Configure. */
const NAV = [
  {
    group: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', ico: 'home', end: true },
      { to: '/reports', label: 'Reports', ico: 'doc' }
    ]
  },
  {
    group: 'Operations',
    items: [
      { to: '/bookings', label: 'Bookings', ico: 'cal' },
      { to: '/orders', label: 'Store orders', ico: 'bag' },
      { to: '/payouts', label: 'Payouts', ico: 'wallet' }
    ]
  },
  {
    group: 'Catalogue',
    items: [
      { to: '/products', label: 'Products', ico: 'bag' },
      { to: '/packages', label: 'Grooming packages', ico: 'scissors' },
      { to: '/coupons', label: 'Offers & coupons', ico: 'gift' }
    ]
  },
  {
    group: 'People',
    items: [
      { to: '/partners', label: 'Partners', ico: 'brief' },
      { to: '/customers', label: 'Customers', ico: 'user' },
      { to: '/staff', label: 'Staff', ico: 'shield' }
    ]
  },
  {
    group: 'Configure',
    items: [
      { to: '/areas', label: 'Service areas', ico: 'pin' },
      { to: '/settings', label: 'Settings', ico: 'key' }
    ]
  }
];

export default function App() {
  const { user, signIn, signOut } = useAuth();

  /* Badges count real work waiting: applicants to approve, batches to release. */
  const { data: partners } = useApi(
    () => (user ? api.partners.list() : Promise.resolve(null)),
    [user?.code]
  );
  const { data: payouts } = useApi(
    () => (user ? api.admin.payouts() : Promise.resolve(null)),
    [user?.code]
  );

  if (!user) return <SignIn surface="admin" onSignedIn={signIn} />;

  const who = { name: user.name, role: roleLabel(user.role), art: roleArt(user.role) };
  const badges = {
    '/partners': partners?.pending ?? 0,
    '/payouts': (payouts?.batches ?? []).filter((b) => b.rows.length > 0).length
  };

  const renderPage = ({ title, sub, actions, search, body }) => (
    <WebShell
      nav={NAV}
      badges={badges}
      subtitle="Admin console"
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
      <Route path="/reports" element={<Reports renderPage={renderPage} />} />

      {/* Shared with the staff portal — same component, same rows. */}
      <Route path="/bookings" element={<BookingsScreen renderPage={renderPage} />} />
      <Route path="/bookings/:id" element={<BookingScreen renderPage={renderPage} />} />
      <Route path="/orders" element={<OrdersScreen renderPage={renderPage} />} />
      <Route path="/orders/:id" element={<OrderScreen renderPage={renderPage} />} />
      <Route path="/customers" element={<CustomersScreen renderPage={renderPage} />} />
      <Route path="/customers/:id" element={<CustomerScreen renderPage={renderPage} canBook={false} />} />

      <Route path="/payouts" element={<Payouts renderPage={renderPage} />} />
      <Route path="/products" element={<Products renderPage={renderPage} />} />
      <Route path="/products/:id" element={<Product renderPage={renderPage} />} />
      <Route path="/packages" element={<Packages renderPage={renderPage} />} />
      <Route path="/coupons" element={<Coupons renderPage={renderPage} />} />
      <Route path="/partners" element={<Partners renderPage={renderPage} />} />
      <Route path="/partners/:id" element={<Partner renderPage={renderPage} />} />
      <Route path="/staff" element={<Staff renderPage={renderPage} />} />
      <Route path="/areas" element={<Areas renderPage={renderPage} />} />
      <Route path="/settings" element={<Settings renderPage={renderPage} />} />
      <Route path="/profile" element={<Profile renderPage={renderPage} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

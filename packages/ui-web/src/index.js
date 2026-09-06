/* Everything the two consoles share: the shell, the design-system primitives
   ported from styles.css, and the six screens that render identically in both. */
export * from './Brand.jsx';
export * from './Icon.jsx';
export * from './primitives.jsx';
export * from './WebShell.jsx';
export * from './SignIn.jsx';
export * from './auth.jsx';
export * from './useApi.js';

export { BookingsScreen, BookingScreen } from './screens/Bookings.jsx';
export { OrdersScreen, OrderScreen } from './screens/Orders.jsx';
export { CustomersScreen, CustomerScreen } from './screens/Customers.jsx';

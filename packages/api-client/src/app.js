/* The mobile apps' half of the API client.
   Shares the shape of the web client in ./index.js; the difference is only
   which routes it calls (/api/app/...).

   Identity used to be a plain `x-app-user: customer:C1041` header, which any
   caller could forge. It is a signed JWT now, refreshed transparently the same
   way the consoles do it. */

let baseUrl = 'http://localhost:4000';
let authToken = null;
let refreshToken = null;
let onSession = null;

export function configureAppApi({ baseUrl: url, token, refresh, onSessionChange } = {}) {
  if (url !== undefined) baseUrl = url || baseUrl;
  if (token !== undefined) authToken = token;
  if (refresh !== undefined) refreshToken = refresh;
  if (onSessionChange !== undefined) onSession = onSessionChange;
}

export class AppApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'AppApiError';
    this.status = status;
    this.details = details;
  }
}

async function send(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (authToken) headers['authorization'] = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    /* On a device, localhost is the phone itself — the usual cause of this. */
    throw new AppApiError(
      `Cannot reach the API at ${baseUrl}. On a real device set EXPO_PUBLIC_API_URL to your computer's LAN address.`,
      0
    );
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { res, data };
}

/* One shared in-flight refresh: refresh tokens are single-use, so two
   concurrent 401s must not each try to spend the same one. */
let inFlightRefresh = null;

async function refreshSession() {
  if (!refreshToken) return false;
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      const { res, data } = await send('/api/app/auth/refresh', {
        method: 'POST', body: { refreshToken }
      });
      if (!res.ok) {
        authToken = null;
        refreshToken = null;
        onSession?.(null);
        return false;
      }
      authToken = data.token;
      refreshToken = data.refreshToken;
      onSession?.({ user: data.user, token: data.token, refreshToken: data.refreshToken });
      return true;
    })().finally(() => { inFlightRefresh = null; });
  }
  return inFlightRefresh;
}

async function request(path, opts = {}) {
  let { res, data } = await send(path, opts);

  if (res.status === 401 && refreshToken && !path.startsWith('/api/app/auth/refresh')) {
    if (await refreshSession()) ({ res, data } = await send(path, opts));
  }

  if (!res.ok) {
    throw new AppApiError(data?.error ?? `Request failed (${res.status}).`, res.status, data?.details);
  }
  return data;
}

export const appApi = {
  raw: request,

  auth: {
    demoAccounts: (role) => request(`/api/app/auth/demo-accounts?role=${role}`),
    requestOtp: (phone, role) => request('/api/app/auth/request-otp', { method: 'POST', body: { phone, role } }),
    verifyOtp: (phone, code, role) => request('/api/app/auth/verify-otp', { method: 'POST', body: { phone, code, role } }),
    logout: (refresh) => request('/api/app/auth/logout', { method: 'POST', body: { refreshToken: refresh } })
  },

  customer: {
    home: () => request('/api/app/customer/home'),
    account: () => request('/api/app/customer/account'),
    addAddress: (body) => request('/api/app/customer/addresses', { method: 'POST', body }),
    setDefaultAddress: (id) => request(`/api/app/customer/addresses/${id}/default`, { method: 'POST' }),
    setDefaultPayment: (id) => request(`/api/app/customer/payments/${id}/default`, { method: 'POST' }),
    notifications: () => request('/api/app/customer/notifications'),
    offers: () => request('/api/app/customer/offers'),
    help: () => request('/api/app/customer/help')
  },

  pets: {
    list: () => request('/api/app/pets'),
    get: (id) => request(`/api/app/pets/${id}`),
    visit: (petId, code) => request(`/api/app/pets/${petId}/visits/${code}`),
    create: (body) => request('/api/app/pets', { method: 'POST', body }),
    update: (id, body) => request(`/api/app/pets/${id}`, { method: 'PATCH', body }),
    breeds: () => request('/api/app/pets/meta/breeds'),
    addVaccine: (petId, body) =>
      request(`/api/app/pets/${petId}/vaccines`, { method: 'POST', body }),
    updateVaccine: (petId, vaccineId, body) =>
      request(`/api/app/pets/${petId}/vaccines/${vaccineId}`, { method: 'PATCH', body }),
    removeVaccine: (petId, vaccineId) =>
      request(`/api/app/pets/${petId}/vaccines/${vaccineId}`, { method: 'DELETE' })
  },

  bookings: {
    list: () => request('/api/app/bookings'),
    get: (id) => request(`/api/app/bookings/${id}`),
    create: (body) => request('/api/app/bookings', { method: 'POST', body }),
    match: (id) => request(`/api/app/bookings/${id}/match`, { method: 'POST' }),
    reschedule: (id, dateLabel, slot) => request(`/api/app/bookings/${id}/reschedule`, { method: 'POST', body: { dateLabel, slot } }),
    cancel: (id, reason) => request(`/api/app/bookings/${id}/cancel`, { method: 'POST', body: { reason } }),
    pay: (id, method, useWallet) => request(`/api/app/bookings/${id}/pay`, { method: 'POST', body: { method, useWallet } }),
    rate: (id, body) => request(`/api/app/bookings/${id}/rate`, { method: 'POST', body })
  },

  jobs: {
    feed: (mode) => request(`/api/app/jobs?mode=${mode}`),
    get: (id) => request(`/api/app/jobs/${id}`),
    claim: (id) => request(`/api/app/jobs/${id}/claim`, { method: 'POST' }),
    setStatus: (id, status) => request(`/api/app/jobs/${id}/status`, { method: 'POST', body: { status } }),
    tick: (id, itemKey, done) => request(`/api/app/jobs/${id}/checklist`, { method: 'POST', body: { itemKey, done } }),
    photo: (id, phase) => request(`/api/app/jobs/${id}/photos`, { method: 'POST', body: { phase } }),
    complete: (id) => request(`/api/app/jobs/${id}/complete`, { method: 'POST' })
  },

  walks: {
    requests: () => request('/api/app/walks/requests'),
    get: (bookingId) => request(`/api/app/walks/${bookingId}`),
    accept: (bookingId) => request(`/api/app/walks/${bookingId}/accept`, { method: 'POST' }),
    setState: (bookingId, state) => request(`/api/app/walks/${bookingId}/state`, { method: 'POST', body: { state } }),
    end: (bookingId) => request(`/api/app/walks/${bookingId}/end`, { method: 'POST' })
  },

  partner: {
    home: () => request('/api/app/partner/home'),
    schedule: () => request('/api/app/partner/schedule'),
    earnings: () => request('/api/app/partner/earnings'),
    reviews: () => request('/api/app/partner/reviews'),
    documents: () => request('/api/app/partner/documents'),
    notifications: () => request('/api/app/partner/notifications')
  },

  store: {
    catalogue: (category) => request(`/api/app/store${category ? `?category=${category}` : ''}`),
    product: (id) => request(`/api/app/store/products/${id}`),
    cart: () => request('/api/app/store/cart'),
    addToCart: (body) => request('/api/app/store/cart', { method: 'POST', body }),
    setQty: (itemId, qty) => request(`/api/app/store/cart/${itemId}`, { method: 'PATCH', body: { qty } }),
    checkout: (address) => request('/api/app/store/checkout', { method: 'POST', body: { address } }),
    orders: () => request('/api/app/store/orders'),
    order: (id) => request(`/api/app/store/orders/${id}`)
  }
};

export default appApi;

/* One fetch layer for every surface. The two portals use it today; the RN apps
   can import the same module once they have a base URL of their own. */

const DEFAULT_BASE = 'http://localhost:4000';

let baseUrl = DEFAULT_BASE;
let authToken = null;

export function configureApi({ baseUrl: url, token } = {}) {
  if (url !== undefined) baseUrl = url || DEFAULT_BASE;
  if (token !== undefined) authToken = token;
}

export function getAuthToken() {
  return authToken;
}

/* Errors carry the API's own message so screens can show something true
   rather than "Failed to fetch". */
export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (authToken) headers['authorization'] = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(`Cannot reach the API at ${baseUrl}. Is it running?`, 0);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(data?.error ?? `Request failed (${res.status}).`, res.status, data?.details);
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, opts),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),

  health: () => request('/api/health'),

  auth: {
    demoUsers: (surface) => request(`/api/auth/demo-users?surface=${surface}`),
    login: (email, password, surface) =>
      request('/api/auth/login', { method: 'POST', body: { email, password, surface } }),
    me: () => request('/api/auth/me')
  },

  staff: {
    dashboard: () => request('/api/staff/dashboard'),
    profile: () => request('/api/staff/profile')
  },

  bookings: {
    list: (filter = 'all') => request(`/api/bookings?filter=${filter}`),
    get: (id) => request(`/api/bookings/${id}`),
    create: (payload) => request('/api/bookings', { method: 'POST', body: payload }),
    assign: (id, partnerId) => request(`/api/bookings/${id}/assign`, { method: 'POST', body: { partnerId } }),
    unassign: (id) => request(`/api/bookings/${id}/unassign`, { method: 'POST' }),
    cancel: (id) => request(`/api/bookings/${id}/cancel`, { method: 'POST' })
  },

  orders: {
    list: () => request('/api/orders'),
    get: (id) => request(`/api/orders/${id}`),
    setStatus: (id, status) => request(`/api/orders/${id}/status`, { method: 'POST', body: { status } })
  },

  customers: {
    list: () => request('/api/customers'),
    get: (id) => request(`/api/customers/${id}`)
  },

  partners: {
    list: () => request('/api/partners'),
    get: (id) => request(`/api/partners/${id}`),
    approve: (id) => request(`/api/partners/${id}/approve`, { method: 'POST' }),
    setStatus: (id, status) => request(`/api/partners/${id}/status`, { method: 'POST', body: { status } })
  },

  catalogue: {
    services: () => request('/api/catalogue/services'),
    products: (category) => request(`/api/catalogue/products${category ? `?category=${category}` : ''}`),
    product: (id) => request(`/api/catalogue/products/${id}`),
    updateProduct: (id, patch) => request(`/api/catalogue/products/${id}`, { method: 'PATCH', body: patch }),
    packages: () => request('/api/catalogue/packages'),
    coupons: () => request('/api/catalogue/coupons'),
    toggleCoupon: (id) => request(`/api/catalogue/coupons/${id}/toggle`, { method: 'POST' })
  },

  admin: {
    dashboard: () => request('/api/admin/dashboard'),
    reports: () => request('/api/admin/reports'),
    payouts: () => request('/api/admin/payouts'),
    releasePayouts: (kind) => request('/api/admin/payouts/release', { method: 'POST', body: { kind } }),
    staff: () => request('/api/admin/staff'),
    areas: () => request('/api/admin/areas'),
    toggleSlot: (id) => request(`/api/admin/slots/${id}/toggle`, { method: 'POST' }),
    settings: () => request('/api/admin/settings'),
    updateSettings: (values) => request('/api/admin/settings', { method: 'PATCH', body: { values } })
  }
};

export default api;

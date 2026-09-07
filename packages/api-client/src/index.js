/* One fetch layer for every surface. The two portals use it today; the RN apps
   can import the same module once they have a base URL of their own. */

const DEFAULT_BASE = 'http://localhost:4000';

let baseUrl = DEFAULT_BASE;
let authToken = null;
let refreshToken = null;
let onSession = null;

export function configureApi({ baseUrl: url, token, refresh, onSessionChange } = {}) {
  if (url !== undefined) baseUrl = url || DEFAULT_BASE;
  if (token !== undefined) authToken = token;
  if (refresh !== undefined) refreshToken = refresh;
  if (onSessionChange !== undefined) onSession = onSessionChange;
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

async function send(path, { method = 'GET', body, signal } = {}) {
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
  return { res, data };
}

/* Access tokens are short-lived, so a 401 is usually just "expired" rather
   than "signed out". One refresh is attempted and the call replayed; screens
   never see it. Concurrent 401s share a single in-flight refresh, otherwise
   each would burn the same single-use refresh token and the second would trip
   the server's reuse detection and kill the session. */
let inFlightRefresh = null;

async function refreshSession() {
  if (!refreshToken) return false;
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      const { res, data } = await send('/api/auth/refresh', {
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

  if (res.status === 401 && refreshToken && !path.startsWith('/api/auth/refresh')) {
    if (await refreshSession()) ({ res, data } = await send(path, opts));
  }

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
    logout: (refresh) => request('/api/auth/logout', { method: 'POST', body: { refreshToken: refresh } }),
    me: () => request('/api/auth/me')
  },

  staff: {
    dashboard: () => request('/api/staff/dashboard'),
    profile: () => request('/api/staff/profile'),
    updateProfile: (patch) => request('/api/staff/profile', { method: 'PATCH', body: patch })
  },

  bookings: {
    list: (filter = 'all') => request(`/api/bookings?filter=${filter}`),
    get: (id) => request(`/api/bookings/${id}`),
    create: (payload) => request('/api/bookings', { method: 'POST', body: payload }),
    assign: (id, partnerId) => request(`/api/bookings/${id}/assign`, { method: 'POST', body: { partnerId } }),
    unassign: (id) => request(`/api/bookings/${id}/unassign`, { method: 'POST' }),
    cancel: (id) => request(`/api/bookings/${id}/cancel`, { method: 'POST' }),
    reschedule: (id, dateLabel, slot) =>
      request(`/api/bookings/${id}/reschedule`, { method: 'POST', body: { dateLabel, slot } })
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
    setStatus: (id, status) => request(`/api/partners/${id}/status`, { method: 'POST', body: { status } }),
    update: (id, patch) => request(`/api/partners/${id}`, { method: 'PATCH', body: patch })
  },

  catalogue: {
    services: () => request('/api/catalogue/services'),
    products: (category) => request(`/api/catalogue/products${category ? `?category=${category}` : ''}`),
    product: (id) => request(`/api/catalogue/products/${id}`),
    updateProduct: (id, patch) => request(`/api/catalogue/products/${id}`, { method: 'PATCH', body: patch }),
    packages: () => request('/api/catalogue/packages'),
    coupons: () => request('/api/catalogue/coupons'),
    toggleCoupon: (id) => request(`/api/catalogue/coupons/${id}/toggle`, { method: 'POST' }),
    createProduct: (body) => request('/api/catalogue/products', { method: 'POST', body }),
    createPackage: (body) => request('/api/catalogue/packages', { method: 'POST', body }),
    updatePackage: (id, patch) => request(`/api/catalogue/packages/${id}`, { method: 'PATCH', body: patch }),
    createCoupon: (body) => request('/api/catalogue/coupons', { method: 'POST', body })
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
    updateSettings: (values) => request('/api/admin/settings', { method: 'PATCH', body: { values } }),
    createArea: (body) => request('/api/admin/areas', { method: 'POST', body }),
    updateArea: (name, patch) =>
      request(`/api/admin/areas/${encodeURIComponent(name)}`, { method: 'PATCH', body: patch }),
    inviteStaff: (body) => request('/api/admin/staff', { method: 'POST', body }),
    updateStaff: (code, patch) => request(`/api/admin/staff/${code}`, { method: 'PATCH', body: patch }),
    pauseBookings: (paused) => request('/api/admin/bookings/pause', { method: 'POST', body: { paused } }),
    /* CSV is a file, not JSON, so it comes back as a Blob and the caller
       saves it. Fetched with the Authorization header rather than linked to
       directly: a plain <a href> carries no header, and putting the token in
       the query string instead would write it into every access log it
       passes through. */
    exportCsv: async (dataset) => {
      const res = await fetch(`${baseUrl}/api/admin/export/${dataset}.csv`, {
        headers: authToken ? { authorization: `Bearer ${authToken}` } : {}
      });
      if (!res.ok) {
        const text = await res.text();
        let message = `Export failed (${res.status}).`;
        try { message = JSON.parse(text).error ?? message; } catch { /* not JSON */ }
        throw new ApiError(message, res.status);
      }
      const disposition = res.headers.get('content-disposition') ?? '';
      const named = /filename="?([^";]+)/.exec(disposition);
      return { blob: await res.blob(), filename: named?.[1] ?? `${dataset}.csv` };
    }
  }
};

export default api;

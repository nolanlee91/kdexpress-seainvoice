const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'haibien_token';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

async function request(path, opts = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    ...opts,
    headers,
    body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  });
  let data;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  login: (code, password) => request('/api/auth/login', { method: 'POST', body: { code, password } }),
  me: () => request('/api/auth/me'),
  changePassword: (current_password, new_password) =>
    request('/api/auth/change-password', { method: 'POST', body: { current_password, new_password } }),

  listUsers: () => request('/api/users'),
  createUser: (b) => request('/api/users', { method: 'POST', body: b }),
  updateUser: (id, b) => request('/api/users/' + id, { method: 'PUT', body: b }),
  deleteUser: (id) => request('/api/users/' + id, { method: 'DELETE' }),

  listCustomers: () => request('/api/customers'),
  createCustomer: (b) => request('/api/customers', { method: 'POST', body: b }),
  updateCustomer: (id, b) => request('/api/customers/' + id, { method: 'PUT', body: b }),
  deleteCustomer: (id) => request('/api/customers/' + id, { method: 'DELETE' }),

  listShipments: () => request('/api/sea-shipments'),
  getShipment: (id) => request('/api/sea-shipments/' + id),
  createShipment: (b) => request('/api/sea-shipments', { method: 'POST', body: b }),
  updateShipment: (id, b) => request('/api/sea-shipments/' + id, { method: 'PUT', body: b }),
  deleteShipment: (id) => request('/api/sea-shipments/' + id, { method: 'DELETE' }),
  addShipmentCustomer: (id, customer_id) =>
    request(`/api/sea-shipments/${id}/customers`, { method: 'POST', body: { customer_id } }),
  removeShipmentCustomer: (id, customer_id) =>
    request(`/api/sea-shipments/${id}/customers/${customer_id}`, { method: 'DELETE' }),

  scanInvoice: (id, customer_id, image_url) =>
    request(`/api/sea-shipments/${id}/invoices/scan`, { method: 'POST', body: { customer_id, image_url } }),
  listInvoices: (id, customer_id) =>
    request(`/api/sea-shipments/${id}/invoices${customer_id ? `?customer_id=${customer_id}` : ''}`),
  getInvoice: (id) => request('/api/invoices/' + id),
  deleteInvoice: (id) => request('/api/invoices/' + id, { method: 'DELETE' }),
  restoreInvoice: (id) => request('/api/invoices/' + id + '/restore', { method: 'POST' }),

  // Bước 3 — data gốc (editable raw)
  listRawItems: (id, customer_id) =>
    request(`/api/sea-shipments/${id}/raw-data-items${customer_id ? `?customer_id=${customer_id}` : ''}`),
  bulkRawItems: (b) => request('/api/raw-data-items/bulk', { method: 'POST', body: b }),
  deleteRawItem: (id) => request('/api/raw-data-items/' + id, { method: 'DELETE' }),
  translateRawItems: (items) =>
    request('/api/raw-data-items/translate', { method: 'POST', body: { items } }),
  suggestMetadata: (items) =>
    request('/api/raw-data-items/suggest-metadata', { method: 'POST', body: { items } }),

  // Settings per (shipment, customer): currency, exchange rate
  updateCustomerSettings: (shipId, customerId, b) =>
    request(`/api/sea-shipments/${shipId}/customers/${customerId}/settings`, { method: 'PUT', body: b }),

  // Promote raw → CI with currency conversion
  promoteToCI: (shipId, customerId, mode = 'replace') =>
    request(`/api/sea-shipments/${shipId}/customers/${customerId}/promote-to-ci`, { method: 'POST', body: { mode } }),
  // Normalize all CI units to English
  normalizeCIUnits: (shipId, customerId) =>
    request(`/api/sea-shipments/${shipId}/customers/${customerId}/normalize-ci-units`, { method: 'POST' }),

  // Bước 4 — Commercial Invoice (USD)
  listItems: (id, customer_id) =>
    request(`/api/sea-shipments/${id}/commercial-invoice-items${customer_id ? `?customer_id=${customer_id}` : ''}`),
  bulkItems: (b) => request('/api/commercial-invoice-items/bulk', { method: 'POST', body: b }),
  createItem: (id, b) => request(`/api/sea-shipments/${id}/commercial-invoice-items`, { method: 'POST', body: b }),
  updateItem: (id, b) => request('/api/commercial-invoice-items/' + id, { method: 'PUT', body: b }),
  deleteItem: (id) => request('/api/commercial-invoice-items/' + id, { method: 'DELETE' }),

  signR2: (contentType = 'image/jpeg', folder = 'haibien/invoices') =>
    request('/api/upload/sign-r2', { method: 'POST', body: { contentType, folder } }),

  exportUrl: (id) => `${BASE}/api/sea-shipments/${id}/export.xlsx`,
};

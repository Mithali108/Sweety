const API_BASE_URL = 'http://localhost:5000/api';

async function request(path, options = {}) {
  const {
    body,
    redirectOnUnauthorized = true,
    ...fetchOptions
  } = options;
  const headers = new Headers(fetchOptions.headers || {});
  const token = window.localStorage.getItem('token');

  headers.set('Accept', 'application/json');
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(
      `Unable to reach ${API_BASE_URL}. Check that the backend is running and allows this frontend origin through CORS.`,
    );
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.status === 401 && redirectOnUnauthorized) {
    window.localStorage.removeItem('token');
    window.location.reload();
  }

  if (!response.ok) {
    const message = typeof data?.message === 'string'
      ? data.message
      : typeof data?.error === 'string'
        ? data.error
        : `Request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return data;
}

function authRequest(path, credentials) {
  return request(path, {
    method: 'POST',
    body: credentials,
    redirectOnUnauthorized: false,
  });
}

function readingsList(filters = {}) {
  const query = new URLSearchParams();
  if (filters.date) {
    query.set('date', filters.date);
  } else if (filters.month) {
    query.set('month', filters.month);
  }

  const queryString = query.toString();
  return request(`/readings${queryString ? `?${queryString}` : ''}`);
}

export const api = {
  auth: {
    login: (credentials) => authRequest('/auth/login', credentials),
    register: (credentials) => authRequest('/auth/register', credentials),
  },
  readings: {
    list: readingsList,
    create: (reading) => request('/readings', { method: 'POST', body: reading }),
    update: (id, reading) => request(`/readings/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: reading,
    }),
    remove: (id) => request(`/readings/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    reports: (date) => {
      const query = date ? `?date=${encodeURIComponent(date)}` : '';
      return request(`/readings/reports${query}`);
    },
  },
};

export default api;

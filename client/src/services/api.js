/**
 * Client API Service
 * Interacts with Shivshree Agro Mart OS Backend API
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

// In-memory access token storage (Never stored in localStorage per strict security guidelines)
let inMemoryAccessToken = null;

export function setApiAccessToken(token) {
  inMemoryAccessToken = token;
}

export function getApiAccessToken() {
  return inMemoryAccessToken;
}

/**
 * Common fetch helper with credentials: 'include' and automatic Bearer token injection
 */
async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Accept': 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  if (inMemoryAccessToken) {
    headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Ensures HTTP-only refresh cookies are sent/received
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorMessage =
      body?.error?.message || `HTTP Error: ${response.status} ${response.statusText}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.code = body?.error?.code || 'API_ERROR';
    error.details = body?.error;
    throw error;
  }

  return body;
}

/**
 * Checks backend health
 */
export async function checkApiHealth() {
  const startTime = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP Error: ${response.status} ${response.statusText}`,
        latencyMs,
      };
    }

    const json = await response.json();
    return {
      ok: true,
      data: json.data,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      ok: false,
      error: err.name === 'AbortError' ? 'Connection timed out' : (err.message || 'Network error'),
      latencyMs,
    };
  }
}

// ==========================================
// Authentication Endpoints
// ==========================================

export async function loginApi(identifier, password) {
  const result = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
  if (result.data?.accessToken) {
    setApiAccessToken(result.data.accessToken);
  }
  return result.data;
}

export async function refreshApi() {
  const result = await apiFetch('/auth/refresh', {
    method: 'POST',
  });
  if (result.data?.accessToken) {
    setApiAccessToken(result.data.accessToken);
  }
  return result.data;
}

export async function logoutApi() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } finally {
    setApiAccessToken(null);
  }
}

export async function getMeApi() {
  const result = await apiFetch('/auth/me', { method: 'GET' });
  return result.data?.user;
}

export async function requestCustomerOtpApi(phone) {
  return apiFetch('/auth/customer/login-request', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyCustomerOtpApi(phone, otp) {
  const result = await apiFetch('/auth/customer/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  });
  if (result.data?.accessToken) {
    setApiAccessToken(result.data.accessToken);
  }
  return result.data;
}

export { API_BASE_URL };

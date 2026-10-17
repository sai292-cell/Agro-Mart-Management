/**
 * Client API Service
 * Interacts with Shivshree Agro Mart OS Backend API
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

/**
 * Checks backend health
 * @returns {Promise<{ ok: boolean, data?: any, error?: string, latencyMs: number }>}
 */
export async function checkApiHealth() {
  const startTime = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
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

export { API_BASE_URL };

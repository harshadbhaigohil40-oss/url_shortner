// apiFetch wrapper to handle automatic token refresh, CSRF, and request deduplication
export const API_URL = import.meta.env.PROD
  ? ''
  : (import.meta.env.VITE_API_URL || 'http://localhost:5000');

// API version prefix
export const API_VERSION = 'v1';

let csrfToken = null;
let csrfFetchPromise = null;
let refreshPromise = null;

// Request deduplication cache (key -> promise)
const pendingRequests = new Map();

const fetchCsrf = async () => {
  if (csrfFetchPromise) return csrfFetchPromise;
  csrfFetchPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/csrf-token`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        csrfToken = data.csrfToken;
      }
    } catch (e) {
      console.error("Failed to fetch CSRF token", e);
    } finally {
      csrfFetchPromise = null;
    }
  })();
  return csrfFetchPromise;
};

const doRefreshToken = async (login, logout) => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'GET',
        credentials: 'include', // Send the httpOnly cookie
      });

      if (refreshRes.ok) {
        const newData = await refreshRes.json();
        if (login) login(newData);
        return newData.token;
      } else {
        if (logout) logout();
        return null;
      }
    } catch (err) {
      console.error("Auth token refresh failed", err);
      if (logout) logout();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Create a deduplication key for a request
 */
const createRequestKey = (url, options) => {
  // Only deduplicate GET and idempotent requests by default
  if (options.method && options.method !== 'GET' && options.method !== 'HEAD') {
    return null;
  }
  // Include relevant headers that affect response
  const authHeader = options.headers?.Authorization || '';
  return `${options.method || 'GET'}:${url}:${authHeader}`;
};

export const apiFetch = async (url, options = {}, user, login, logout) => {
  // Always include credentials for cookies
  options.credentials = 'include';

  if (user && user.token) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${user.token}`
    };
  }

  // Handle CSRF
  if (options.method && options.method !== 'GET' && options.method !== 'HEAD') {
    if (!csrfToken) await fetchCsrf();
    options.headers = {
      ...options.headers,
      'x-csrf-token': csrfToken
    };
  }

  // Request deduplication for GET requests
  const requestKey = createRequestKey(url, options);
  if (requestKey) {
    const existing = pendingRequests.get(requestKey);
    if (existing) {
      return existing;
    }
  }

  const doFetch = async () => {
    let response = await fetch(url, options);

    // If CSRF token is invalid, retry once after fetching a new one
    if (response.status === 403) {
       const resData = await response.clone().json().catch(()=>({}));
       if (resData.message === 'Invalid CSRF Token' || resData.error?.code === 'CSRF_INVALID') {
         await fetchCsrf();
         options.headers['x-csrf-token'] = csrfToken;
         response = await fetch(url, options);
       }
    }

    // If unauthorized, try to refresh token (deduplicated across concurrent requests)
    if (response.status === 401 && user) {
      const newToken = await doRefreshToken(login, logout);
      if (newToken) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${newToken}`
        };
        response = await fetch(url, options);
      }
    }

    return response;
  };

  const promise = doFetch();

  // Cache the promise for deduplication
  if (requestKey) {
    pendingRequests.set(requestKey, promise);
    // Clean up after resolution
    promise.finally(() => pendingRequests.delete(requestKey));
  }

  return promise;
};

/**
 * Helper to build API URLs with version prefix
 */
export const buildApiUrl = (endpoint) => {
  return `${API_URL}/api/${API_VERSION}${endpoint}`;
};

/**
 * Clear deduplication cache (useful for testing or forced refresh)
 */
export const clearRequestCache = () => {
  pendingRequests.clear();
};


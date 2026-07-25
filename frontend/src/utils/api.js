// apiFetch wrapper to handle automatic token refresh and CSRF
export const API_URL = import.meta.env.PROD 
  ? '' 
  : (import.meta.env.VITE_API_URL || 'http://localhost:5000');

let csrfToken = null;

const fetchCsrf = async () => {
  try {
    const res = await fetch(`${API_URL}/api/csrf-token`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.csrfToken;
    }
  } catch (e) {
    console.error("Failed to fetch CSRF token", e);
  }
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

  let response = await fetch(url, options);

  // If CSRF token is invalid, retry once after fetching a new one
  if (response.status === 403 && response.statusText === "Forbidden") {
     const resData = await response.clone().json().catch(()=>({}));
     if (resData.message === 'Invalid CSRF Token') {
       await fetchCsrf();
       options.headers['x-csrf-token'] = csrfToken;
       response = await fetch(url, options);
     }
  }

  // If unauthorized, try to refresh token
  if (response.status === 401 && user) {
    try {
      const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'GET',
        credentials: 'include', // Send the httpOnly cookie
      });

      if (refreshRes.ok) {
        const newData = await refreshRes.json();
        login(newData); // Update local storage and state

        // Retry original request with new token
        options.headers.Authorization = `Bearer ${newData.token}`;
        response = await fetch(url, options);
      } else {
        // Refresh failed, logout user
        logout();
      }
    } catch (err) {
      console.error("Auth token refresh failed", err);
      logout();
    }
  }

  return response;
};


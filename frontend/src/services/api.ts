/**
 * Professional API Service Layer
 * - Centralized error handling
 * - Automatic token refresh
 * - Request/response interceptors
 * - Type-safe API calls
 * - Retry logic with exponential backoff
 */

import type {
  ApiResponse,
  User,
  AuthTokens,
  LoginCredentials,
  RegisterData,
  Url,
  ShortenUrlRequest,
  BulkShortenRequest,
  BulkShortenResult,
  UrlStats,
  DashboardFilters,
  BioPage,
  BioPageRequest,
  RealTimeClickEvent,
  ApiKeyInfo,
  WebhookPayload,
} from '@/types/api';

const API_URL = import.meta.env.VITE_API_URL || '';

// Token storage keys
const ACCESS_TOKEN_KEY = 'shortly_access_token';
const REFRESH_TOKEN_KEY = 'shortly_refresh_token';
const USER_KEY = 'shortly_user';

// Types
interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
  retries?: number;
}

interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

// State
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;
let authStateListeners: Array<(user: User | null) => void> = [];

// Utility functions
const getAccessToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

const setTokens = (tokens: AuthTokens): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
};

const clearTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

const getStoredUser = (): User | null => {
  try {
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

const setStoredUser = (user: User | null): void => {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
};

const notifyAuthStateChange = (user: User | null): void => {
  authStateListeners.forEach((listener) => listener(user));
};

export const subscribeToAuthChanges = (listener: (user: User | null) => void): (() => void) => {
  authStateListeners.push(listener);
  return () => {
    authStateListeners = authStateListeners.filter((l) => l !== listener);
  };
};

// Build URL with query params
const buildUrl = (endpoint: string, params?: Record<string, string | number | boolean | undefined>): string => {
  const url = new URL(`${API_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  return url.toString();
};

// Core fetch function with retry logic
async function fetchWithRetry<T>(
  url: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { retries = 3, ...fetchOptions } = options;
  const maxRetries = Math.max(0, retries);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);

      // Handle token expiration
      if (response.status === 401 && !options.skipAuth) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          // Retry with new token
          const newHeaders = new Headers(fetchOptions.headers);
          newHeaders.set('Authorization', `Bearer ${newToken}`);
          const retryResponse = await fetch(url, { ...fetchOptions, headers: newHeaders });
          return handleResponse<T>(retryResponse);
        }
      }

      return handleResponse<T>(response);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s...
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries exceeded');
}

async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errors: ApiResponse<T>['errors'] = undefined;

    if (isJson) {
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
        errors = errorData.errors;
      } catch {
        // Ignore JSON parse errors
      }
    }

    const error = new Error(errorMessage) as Error & {
      status?: number;
      errors?: ApiResponse<T>['errors'];
    };
    error.status = response.status;
    error.errors = errors;
    throw error;
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return { success: true };
  }

  if (isJson) {
    return response.json();
  }

  return { success: true, data: (await response.text()) as T };
}

// Token refresh
async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data: RefreshTokenResponse = await response.json();
      const accessToken = data.accessToken;

      // Update stored token
      const currentAccessToken = getAccessToken();
      if (currentAccessToken) {
        // We need to get the full tokens to update properly
        // For now, just update access token
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      }

      return accessToken;
    } catch {
      // Refresh failed - clear auth state
      clearAuth();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function clearAuth(): void {
  clearTokens();
  setStoredUser(null);
  notifyAuthStateChange(null);
}

// Public API methods
export const api = {
  // Auth
  async login(credentials: LoginCredentials): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    const response = await fetchWithRetry<{ user: User; tokens: AuthTokens }>(
      `${API_URL}/api/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        skipAuth: true,
      }
    );

    if (response.success && response.data) {
      setTokens(response.data.tokens);
      setStoredUser(response.data.user);
      notifyAuthStateChange(response.data.user);
    }

    return response;
  },

  async register(data: RegisterData): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    const response = await fetchWithRetry<{ user: User; tokens: AuthTokens }>(
      `${API_URL}/api/auth/register`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        skipAuth: true,
      }
    );

    if (response.success && response.data) {
      setTokens(response.data.tokens);
      setStoredUser(response.data.user);
      notifyAuthStateChange(response.data.user);
    }

    return response;
  },

  async logout(): Promise<void> {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Ignore logout errors
    } finally {
      clearAuth();
    }
  },

  async getMe(): Promise<ApiResponse<User>> {
    return fetchWithRetry<User>(`${API_URL}/api/auth/me`);
  },

  async refreshSession(): Promise<boolean> {
    const token = await refreshAccessToken();
    if (token) {
      const meResponse = await this.getMe();
      if (meResponse.success && meResponse.data) {
        setStoredUser(meResponse.data);
        notifyAuthStateChange(meResponse.data);
        return true;
      }
    }
    return false;
  },

  // URLs
  async shortenUrl(data: ShortenUrlRequest): Promise<ApiResponse<Url>> {
    return fetchWithRetry<Url>(`${API_URL}/api/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async bulkShorten(data: BulkShortenRequest): Promise<ApiResponse<{ results: BulkShortenResult[] }>> {
    return fetchWithRetry<{ results: BulkShortenResult[] }>(`${API_URL}/api/shorten/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async getUrls(filters: DashboardFilters): Promise<ApiResponse<{ urls: Url[]; totalPages: number; totalUrls: number; page: number }>> {
    return fetchWithRetry<{ urls: Url[]; totalPages: number; totalUrls: number; page: number }>(
      buildUrl(`${API_URL}/api/myurls`, {
        page: filters.page,
        limit: filters.limit,
        search: filters.search,
        sortBy: filters.sortBy,
        order: filters.order,
      })
    );
  },

  async getUrlStats(): Promise<ApiResponse<UrlStats>> {
    return fetchWithRetry<UrlStats>(`${API_URL}/api/myurls/stats`);
  },

  async deleteUrl(id: string): Promise<ApiResponse<void>> {
    return fetchWithRetry<void>(`${API_URL}/api/urls/${id}`, {
      method: 'DELETE',
    });
  },

  async toggleUrlStatus(id: string): Promise<ApiResponse<Url>> {
    return fetchWithRetry<Url>(`${API_URL}/api/urls/${id}/toggle`, {
      method: 'PUT',
    });
  },

  async updateUrl(id: string, data: Partial<ShortenUrlRequest>): Promise<ApiResponse<Url>> {
    return fetchWithRetry<Url>(`${API_URL}/api/urls/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async unlockUrl(code: string, password: string): Promise<ApiResponse<{ longUrl: string }>> {
    return fetchWithRetry<{ longUrl: string }>(`${API_URL}/api/unlock/${code}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      skipAuth: true,
    });
  },

  async analyzeUrl(longUrl: string): Promise<ApiResponse<any>> {
    return fetchWithRetry<any>(`${API_URL}/api/ai-analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ longUrl }),
    });
  },

  // Bio Pages
  async createBioPage(data: BioPageRequest): Promise<ApiResponse<BioPage>> {
    return fetchWithRetry<BioPage>(`${API_URL}/api/bio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async getBioPages(): Promise<ApiResponse<BioPage[]>> {
    return fetchWithRetry<BioPage[]>(`${API_URL}/api/bio`);
  },

  async getBioPage(slug: string): Promise<ApiResponse<BioPage>> {
    return fetchWithRetry<BioPage>(`${API_URL}/api/bio/${slug}`);
  },

  async updateBioPage(slug: string, data: Partial<BioPageRequest>): Promise<ApiResponse<BioPage>> {
    return fetchWithRetry<BioPage>(`${API_URL}/api/bio/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async deleteBioPage(slug: string): Promise<ApiResponse<void>> {
    return fetchWithRetry<void>(`${API_URL}/api/bio/${slug}`, {
      method: 'DELETE',
    });
  },

  // API Keys
  async getApiKeyInfo(): Promise<ApiResponse<ApiKeyInfo>> {
    return fetchWithRetry<ApiKeyInfo>(`${API_URL}/api/auth/api-key`);
  },

  async generateApiKey(name: string): Promise<ApiResponse<{ apiKey: string; keyId: string }>> {
    return fetchWithRetry<{ apiKey: string; keyId: string }>(`${API_URL}/api/auth/api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  },

  async revokeApiKey(keyId: string): Promise<ApiResponse<void>> {
    return fetchWithRetry<void>(`${API_URL}/api/auth/api-key/${keyId}`, {
      method: 'DELETE',
    });
  },

  // Real-time clicks (SSE)
  createClickStream(onMessage: (event: RealTimeClickEvent) => void, onError?: (error: Error) => void): EventSource | null {
    const token = getAccessToken();
    if (!token) return null;

    const eventSource = new EventSource(`${API_URL}/api/stream-clicks?token=${encodeURIComponent(token)}`);

    eventSource.onmessage = (event) => {
      try {
        if (event.data) {
          const data = JSON.parse(event.data);
          if (data.shortCode) {
            onMessage(data);
          }
        }
      } catch {
        // Ignore non-JSON frames (heartbeats)
      }
    };

    eventSource.onerror = (error) => {
      eventSource.close();
      onError?.(new Error('SSE connection lost'));
    };

    return eventSource;
  },

  // Utility
  getStoredUser,
  isAuthenticated: () => !!getAccessToken(),
  getAccessToken,
};
// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[];
  meta?: PaginationMeta;
}

export interface ValidationError {
  field: string;
  message: string;
  path?: string[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Auth Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  avatar?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface GoogleAuthCredential {
  credential: string;
  clientId: string;
}

// URL Types
export interface Url {
  _id: string;
  id: string;
  longUrl: string;
  shortCode: string;
  title?: string;
  favicon?: string;
  clicks: number;
  clickHistory?: ClickHistoryEntry[];
  user?: string | User;
  password?: string | null;
  isOneTime: boolean;
  isActive: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  iphoneUrl?: string;
  androidUrl?: string;
  webhookUrl?: string;
  maxClicks?: number;
  fallbackUrl?: string;
  splashMessage?: string;
  splashDelay?: number;
  abTestTargets?: AbTestTarget[];
  geoTargets?: GeoTarget[];
  deepLinkScheme?: string;
  aiSummary?: string;
  aiSafetyScore?: number;
  aiTags?: string[];
  createdAt: string;
  expiresAt?: string;
  updatedAt: string;
}

export interface ClickHistoryEntry {
  timestamp: string;
  browser: string;
  os: string;
  country: string;
  referer: string;
  servedUrl?: string;
}

export interface AbTestTarget {
  url: string;
  weight: number;
}

export interface GeoTarget {
  country: string;
  url: string;
}

export interface ShortenUrlRequest {
  longUrl: string;
  customAlias?: string;
  password?: string;
  expiresAt?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  iphoneUrl?: string;
  androidUrl?: string;
  webhookUrl?: string;
  maxClicks?: number;
  fallbackUrl?: string;
  splashMessage?: string;
  splashDelay?: number;
  isOneTime?: boolean;
  abTestTargets?: AbTestTarget[];
  geoTargets?: GeoTarget[];
  deepLinkScheme?: string;
}

export interface BulkShortenRequest {
  links: Array<{
    longUrl: string;
    customAlias?: string;
  }>;
}

export interface BulkShortenResult {
  longUrl: string;
  shortCode?: string;
  title?: string;
  favicon?: string;
  error?: string;
  _id?: string;
}

export interface UrlStats {
  totalUrls: number;
  totalClicks: number;
  activeUrls: number;
  topUrl?: {
    shortCode: string;
    clicks: number;
    title: string;
  };
}

export interface AnalyticsData {
  timestamp: string;
  browser: string;
  os: string;
  country: string;
  referer: string;
  servedUrl?: string;
}

// Bio Page Types
export interface BioPage {
  _id: string;
  slug: string;
  user: string | User;
  title: string;
  description?: string;
  avatar?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  fontFamily?: string;
  theme?: 'light' | 'dark' | 'system';
  links: BioLink[];
  socialLinks: SocialLink[];
  seoTitle?: string;
  seoDescription?: string;
  isPublished: boolean;
  views: number;
  clickHistory?: ClickHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface BioLink {
  _id?: string;
  title: string;
  url: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  clicks: number;
  order: number;
}

export interface SocialLink {
  platform: string;
  url: string;
  icon?: string;
  isActive: boolean;
}

export interface BioPageRequest {
  slug: string;
  title: string;
  description?: string;
  avatar?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  fontFamily?: string;
  theme?: 'light' | 'dark' | 'system';
  links: Omit<BioLink, '_id' | 'clicks'>[];
  socialLinks: SocialLink[];
  seoTitle?: string;
  seoDescription?: string;
  isPublished?: boolean;
}

// Dashboard Types
export interface DashboardFilters {
  page: number;
  limit: number;
  search: string;
  sortBy: string;
  order: 'asc' | 'desc';
}

export interface RealTimeClickEvent {
  shortCode: string;
  title: string;
  analytics: AnalyticsData;
  timestamp: string;
  userId: string;
}

// API Key Types
export interface ApiKeyInfo {
  apiKey?: string;
  keyId: string;
  name: string;
  lastUsed?: string;
  createdAt: string;
  expiresAt?: string;
  scopes: string[];
}

// Error Types
export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
  isOperational?: boolean;
}

// Webhook Types
export interface WebhookPayload {
  event: 'link.click' | 'link.created' | 'link.deleted' | 'bio.view' | 'bio.click';
  shortCode?: string;
  longUrl?: string;
  targetUrl?: string;
  timestamp: string;
  analytics?: AnalyticsData;
  bioSlug?: string;
  bioTitle?: string;
}

// SSE Types
export interface SSEEvent {
  type: 'click' | 'heartbeat';
  data: RealTimeClickEvent | null;
}
export const API_VERSION = 'v1';

export const API_ENDPOINTS = {
  HEALTH: '/api/v1/health',
  LOCATIONS: '/api/v1/locations',
  CATEGORIES: '/api/v1/categories',
  TAGS: '/api/v1/tags',
} as const;

export const BANGLADESH_SLUG = 'bangladesh';

export const BANGLADESH_DIVISIONS = [
  'barisal',
  'chattogram',
  'dhaka',
  'khulna',
  'mymensingh',
  'rajshahi',
  'rangpur',
  'sylhet',
] as const;

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

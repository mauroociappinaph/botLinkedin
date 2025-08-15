/**
 * Configuration constants for LinkedIn job search operations
 */

export const SEARCH_CONSTANTS = {
  // Timing constants
  PAGE_LOAD_TIMEOUT: 30000,
  ELEMENT_WAIT_TIMEOUT: 10000,
  SEARCH_DELAY_MIN: 1000,
  SEARCH_DELAY_MAX: 3000,

  // Pagination constants
  MAX_PAGES_PER_SEARCH: 10,
  JOBS_PER_PAGE: 25,

  // Retry constants
  MAX_SEARCH_RETRIES: 3,
  MAX_EXTRACTION_RETRIES: 2,

  // Performance thresholds
  SLOW_OPERATION_THRESHOLD: 5000,
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: 5,
  CIRCUIT_BREAKER_TIMEOUT: 60000,

  // Search filters
  DEFAULT_DATE_POSTED: 'past-week',
  DEFAULT_EXPERIENCE_LEVELS: ['entry-level', 'associate'],
  DEFAULT_JOB_TYPES: ['full-time', 'contract'],

  // Element interaction delays
  CLICK_DELAY_MIN: 200,
  CLICK_DELAY_MAX: 500,
  TYPE_DELAY_MIN: 50,
  TYPE_DELAY_MAX: 150,
} as const;

export const SEARCH_URLS = {
  JOBS_BASE: 'https://www.linkedin.com/jobs/search/',
  LOGIN: 'https://www.linkedin.com/login',
  FEED: 'https://www.linkedin.com/feed/',
} as const;

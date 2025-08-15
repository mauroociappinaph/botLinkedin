/**
 * Shared constants for browser interactions and delays
 */
export const INTERACTION_CONSTANTS = {
  // Delay ranges for different actions (in milliseconds)
  DELAYS: {
    PAGE_LOAD: { min: 2000, max: 5000 },
    TYPING: { min: 50, max: 150 },
    CLICK: { min: 100, max: 300 },
    MOUSE_MOVE: { min: 50, max: 200 },
    FORM_FIELD: { min: 500, max: 1500 },
    BETWEEN_APPLICATIONS: { min: 10000, max: 30000 },
    SCROLL: { min: 200, max: 800 },
    CAPTCHA_PAUSE: { min: 30000, max: 60000 },
    CLEAR_FIELD: { min: 50, max: 100 },
    PRE_ENTER: { min: 200, max: 500 },
    PRE_CLICK: { min: 100, max: 300 },
    POST_ACTION: { min: 200, max: 800 },
  },

  // Timeout constants
  TIMEOUTS: {
    ELEMENT_WAIT: 10000,
    SELECTOR_CHECK: 2000,
    CAPTCHA_CHECK: 1000,
    POST_LOGIN_WAIT: 3000,
  },

  // Retry configuration
  RETRY: {
    DEFAULT_RETRIES: 3,
    RETRY_DELAY: { min: 1000, max: 3000 },
    BACKOFF_MULTIPLIER: 1.5,
  },

  // Mouse and scroll behavior
  INTERACTION: {
    RANDOMIZATION_OFFSET: 20,
    MOUSE_STEPS_MIN: 3,
    MOUSE_STEPS_MAX: 7,
    SCROLL_STEPS: { min: 2, max: 4 },
    DEFAULT_SCROLL_DISTANCE: 500,
    DEFAULT_VIEWPORT: { width: 800, height: 600 },
  },
} as const;

export type DelayRange = { min: number; max: number };
export type InteractionConfig = typeof INTERACTION_CONSTANTS;

/**
 * Configuration interface for ApplicationHandler timing and behavior settings
 *
 * @interface ApplicationHandlerConfig
 * @description Defines all configurable parameters for the LinkedIn job application automation process
 */
export interface ApplicationHandlerConfig {
  /**
   * Maximum number of application steps to process before giving up
   * @default 5
   * @description LinkedIn applications typically have 1-4 steps, this provides a safety limit
   */
  MAX_APPLICATION_STEPS: number;

  /**
   * Timeout configurations in milliseconds
   */
  TIMEOUTS: {
    /**
     * Maximum time to wait for application modal to appear
     * @default 10000
     * @description Time in ms to wait for the Easy Apply modal to load
     */
    MODAL: number;

    /**
     * Maximum time to wait for application submission to complete
     * @default 4000
     * @description Time in ms to wait after clicking submit before checking for success
     */
    SUBMISSION: number;
  };

  /**
   * Delay ranges for human-like interaction timing
   * @description All delays use random values between min and max to simulate human behavior
   */
  DELAYS: {
    /**
     * Delay after clicking buttons (e.g., Easy Apply, Next, Submit)
     * @default { min: 1000, max: 2000 }
     */
    BUTTON_CLICK: { min: number; max: number };

    /**
     * Delay after filling form fields
     * @default { min: 1500, max: 3000 }
     */
    FORM_FIELD: { min: number; max: number };

    /**
     * Delay for page/content loading
     * @default { min: 1000, max: 2000 }
     */
    PAGE_LOAD: { min: number; max: number };

    /**
     * Delay after submitting application
     * @default { min: 2000, max: 4000 }
     */
    SUBMISSION: { min: number; max: number };

    /**
     * Delay after closing modals
     * @default { min: 500, max: 1000 }
     */
    MODAL_CLOSE: { min: number; max: number };
  };
}

/**
 * Default configuration for ApplicationHandler
 *
 * @constant DEFAULT_APPLICATION_CONFIG
 * @description Production-ready default values optimized for LinkedIn's interface timing
 * and anti-detection measures. Values are based on typical human interaction speeds.
 */
export const DEFAULT_APPLICATION_CONFIG: ApplicationHandlerConfig = {
  MAX_APPLICATION_STEPS: 5,
  TIMEOUTS: {
    MODAL: 10000,
    SUBMISSION: 4000,
  },
  DELAYS: {
    BUTTON_CLICK: { min: 1000, max: 2000 },
    FORM_FIELD: { min: 1500, max: 3000 },
    PAGE_LOAD: { min: 1000, max: 2000 },
    SUBMISSION: { min: 2000, max: 4000 },
    MODAL_CLOSE: { min: 500, max: 1000 },
  },
} as const;

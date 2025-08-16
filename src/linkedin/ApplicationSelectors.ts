/**
 * LinkedIn application-specific CSS selectors
 * Centralized location for all selectors used in job application automation
 *
 * @fileoverview This module contains all CSS selectors used for LinkedIn job application automation.
 * Selectors are organized by functionality and grouped for common operations.
 *
 * @example
 * ```typescript
 * import { APPLICATION_SELECTORS, SELECTOR_GROUPS } from './ApplicationSelectors';
 *
 * // Use individual selectors
 * await page.waitForSelector(APPLICATION_SELECTORS.APPLICATION_MODAL);
 *
 * // Use selector groups for fallback logic
 * const button = await findWorkingSelector(page, SELECTOR_GROUPS.EASY_APPLY_BUTTONS);
 * ```
 */
export const APPLICATION_SELECTORS = {
  // Easy Apply button detection
  EASY_APPLY_BUTTON: '.jobs-apply-button--top-card',
  EASY_APPLY_BUTTON_ALT: '.jobs-apply-button',
  EASY_APPLY_TEXT: '[data-control-name="jobdetails_topcard_inapply"]',

  // Application modal and forms
  APPLICATION_MODAL: '.jobs-easy-apply-modal',
  APPLICATION_FORM: '.jobs-easy-apply-content',
  FORM_CONTAINER: '.jobs-easy-apply-form-section__grouping',

  // Multi-step navigation
  NEXT_BUTTON: 'button[aria-label="Continue to next step"]',
  NEXT_BUTTON_ALT: 'button[data-easy-apply-next-button]',
  SUBMIT_BUTTON: 'button[aria-label="Submit application"]',
  SUBMIT_BUTTON_ALT: 'button[data-easy-apply-submit-button]',
  REVIEW_BUTTON: 'button[aria-label="Review your application"]',

  // Application progress indicators
  PROGRESS_BAR: '.jobs-easy-apply-modal__progress',
  STEP_INDICATOR: '.jobs-easy-apply-modal__step-indicator',
  CURRENT_STEP: '.jobs-easy-apply-modal__step-indicator--current',

  // Success and confirmation messages
  SUCCESS_MESSAGE: '.jobs-easy-apply-success-modal',
  CONFIRMATION_TEXT: '[data-test-modal-id="easy-apply-success-modal"]',
  APPLICATION_SENT: '.artdeco-inline-feedback--success',

  // Error and warning messages
  ERROR_MESSAGE: '.jobs-easy-apply-form-element__error-message',
  WARNING_MESSAGE: '.artdeco-inline-feedback--warning',
  REQUIRED_FIELD: '.jobs-easy-apply-form-element--error',

  // Close modal buttons
  CLOSE_MODAL: 'button[aria-label="Dismiss"]',
  CLOSE_MODAL_ALT: '.jobs-easy-apply-modal__close-button',

  // Already applied indicator
  ALREADY_APPLIED: '.jobs-details-top-card__apply-error',
  APPLIED_STATUS: '[data-test-job-details-apply-state="APPLIED"]',
} as const;

/**
 * Selector groups for common operations
 */
export const SELECTOR_GROUPS = {
  EASY_APPLY_BUTTONS: [
    APPLICATION_SELECTORS.EASY_APPLY_BUTTON,
    APPLICATION_SELECTORS.EASY_APPLY_BUTTON_ALT,
    APPLICATION_SELECTORS.EASY_APPLY_TEXT,
  ],

  ALREADY_APPLIED_INDICATORS: [
    APPLICATION_SELECTORS.ALREADY_APPLIED,
    APPLICATION_SELECTORS.APPLIED_STATUS,
  ],

  NEXT_STEP_BUTTONS: [
    APPLICATION_SELECTORS.NEXT_BUTTON,
    APPLICATION_SELECTORS.NEXT_BUTTON_ALT,
  ],

  SUBMIT_BUTTONS: [
    APPLICATION_SELECTORS.SUBMIT_BUTTON,
    APPLICATION_SELECTORS.SUBMIT_BUTTON_ALT,
    APPLICATION_SELECTORS.REVIEW_BUTTON,
  ],

  SUCCESS_INDICATORS: [
    APPLICATION_SELECTORS.SUCCESS_MESSAGE,
    APPLICATION_SELECTORS.CONFIRMATION_TEXT,
    APPLICATION_SELECTORS.APPLICATION_SENT,
  ],

  ERROR_INDICATORS: [
    APPLICATION_SELECTORS.ERROR_MESSAGE,
    APPLICATION_SELECTORS.REQUIRED_FIELD,
  ],

  CLOSE_MODAL_BUTTONS: [
    APPLICATION_SELECTORS.CLOSE_MODAL,
    APPLICATION_SELECTORS.CLOSE_MODAL_ALT,
  ],
} as const;

/**
 * Type-safe selector validation utility
 * Ensures selectors are valid CSS selectors at compile time
 */
export type SelectorString = string & { readonly __brand: unique symbol };

/**
 * Validates that a selector string is properly formatted
 * @param selector The CSS selector to validate
 * @returns The validated selector
 */
export function validateSelector(selector: string): SelectorString {
  if (!selector || typeof selector !== 'string') {
    throw new Error(`Invalid selector: ${selector}`);
  }

  // Basic CSS selector validation
  if (!/^[.#[\]a-zA-Z0-9_-]+/.test(selector.trim())) {
    throw new Error(`Malformed CSS selector: ${selector}`);
  }

  return selector as SelectorString;
}

/**
 * Selector categories for better organization and maintenance
 */
export const SELECTOR_CATEGORIES = {
  BUTTONS: 'Interactive elements like buttons and links',
  MODALS: 'Modal dialogs and overlays',
  FORMS: 'Form elements and inputs',
  INDICATORS: 'Status and progress indicators',
  MESSAGES: 'Success, error, and warning messages',
} as const;
/**
 * Selector metadata for maintenance and debugging
 */
export const SELECTOR_METADATA = {
  version: '1.0.0',
  lastUpdated: '2025-01-16',
  description: 'LinkedIn application automation selectors',

  /**
   * Known selector changes and deprecations
   * Helps track LinkedIn UI changes over time
   */
  changelog: {
    '1.0.0': 'Initial selector definitions',
  },

  /**
   * Fallback strategy configuration
   */
  fallbackStrategy: {
    maxRetries: 3,
    retryDelay: 1000,
    useAlternativeSelectors: true,
  },
} as const;

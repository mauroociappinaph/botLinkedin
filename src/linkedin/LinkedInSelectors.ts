/**
 * Centralized LinkedIn selector management with validation and fallbacks
 * Supports multiple locales and provides robust fallback mechanisms
 */
export class LinkedInSelectors {
  // LinkedIn job search selectors - Primary selectors with locale awareness
  public static readonly SELECTORS = {
    // Search input and button - Multi-locale support
    SEARCH_INPUT: '.jobs-search-box__text-input',
    LOCATION_INPUT:
      'input[id*="jobs-search-box-location"], input[aria-label*="Ciudad, provincia"], input[aria-label*="City, state"], .jobs-search-box__text-input[aria-label*="location"]',
    SEARCH_BUTTON:
      'button[aria-label*="Search"], button[aria-label*="Buscar"], .jobs-search-box__submit-button, button[data-test-id="jobs-search-box-submit-button"]',

    // Job search filters
    FILTERS_BUTTON: 'button[aria-label="Show all filters"]',
    DATE_POSTED_FILTER: 'fieldset[data-test-id="date-posted-facet"]',
    REMOTE_FILTER: 'fieldset[data-test-id="workplace-type-facet"]',
    EXPERIENCE_LEVEL_FILTER: 'fieldset[data-test-id="experience-level-facet"]',
    JOB_TYPE_FILTER: 'fieldset[data-test-id="job-type-facet"]',
    EASY_APPLY_FILTER: 'fieldset[data-test-id="apply-type-facet"]',
    APPLY_FILTERS_BUTTON: 'button[data-control-name="filter_show_results"]',

    // Job listings
    JOB_RESULTS_LIST: '.jobs-search__results-list',
    JOB_CARD: '.job-search-card',
    JOB_TITLE: '.job-search-card__title a',
    JOB_COMPANY: '.job-search-card__subtitle-link',
    JOB_LOCATION: '.job-search-card__location',
    JOB_LINK: '.job-search-card__title a',
    EASY_APPLY_BUTTON: '.jobs-apply-button--top-card',

    // Pagination
    PAGINATION_CONTAINER: '.artdeco-pagination',
    NEXT_PAGE_BUTTON: 'button[aria-label="Next"]',
    PAGE_NUMBERS: '.artdeco-pagination__pages li',

    // Results info
    RESULTS_COUNT: '.results-context-header__job-count',
    NO_RESULTS: '.jobs-search-no-results',

    // Loading states
    LOADING_SPINNER: '.jobs-search-results-list__loading-indicator',
  } as const;

  // Comprehensive fallback selectors organized by locale and priority
  public static readonly FALLBACK_SELECTORS = {
    SEARCH_INPUT: [
      // Spanish selectors
      'input[aria-label*="Busca por cargo"]',
      'input[aria-label*="Buscar empleos"]',
      'input[placeholder*="Buscar empleos"]',
      // English selectors
      'input[aria-label*="Search by title"]',
      'input[aria-label*="Search jobs"]',
      'input[placeholder*="Search jobs"]',
      // Generic selectors
      '.jobs-search-box input[type="text"]',
      'input.jobs-search-box__text-input',
      'input[placeholder*="Search"]',
      'input[name="keywords"]',
      '[data-test-id*="jobs-search-box-keyword"]',
    ],
    LOCATION_INPUT: [
      // Spanish selectors (ordered by specificity)
      'input[aria-label*="Ciudad, provincia/estado o código postal"]',
      'input[aria-label*="Ciudad, provincia"]',
      'input[placeholder*="Ciudad, provincia"]',
      'input[aria-label*="ubicación"]',
      'input[placeholder*="ubicación"]',
      // English selectors
      'input[aria-label*="City, state, zip code"]',
      'input[aria-label*="City, state"]',
      'input[placeholder*="City, state"]',
      'input[aria-label*="location"]',
      'input[placeholder*="location"]',
      // Generic selectors
      'input[id*="jobs-search-box-location"]',
      'input[name="location"]',
      '.jobs-search-box input[placeholder*="Ciudad"]',
      '.jobs-search-box input[placeholder*="City"]',
      '[data-test-id*="jobs-search-box-location"]',
    ],
    SEARCH_BUTTON: [
      // Spanish selectors
      'button[aria-label*="Buscar"]',
      'button:contains("Buscar")',
      // English selectors
      'button[aria-label*="Search"]',
      'button:contains("Search")',
      // Generic selectors
      '.jobs-search-box__submit-button',
      'button[data-test-id="jobs-search-box-submit-button"]',
      '.jobs-search-box button[type="submit"]',
    ],
    JOB_CARD: [
      '.job-search-card',
      '.job-result-card',
      '.jobs-search-results__list-item',
      '[data-test-id*="job-card"]',
    ],
    JOB_TITLE: [
      '.job-search-card__title a',
      '.job-result-card__title a',
      '.job-title a',
      '[data-test-id*="job-title"] a',
    ],
    EASY_APPLY_BUTTON: [
      '.jobs-apply-button--top-card',
      '.jobs-apply-button',
      '.apply-button',
      'button:contains("Easy Apply")',
      'button:contains("Postulación fácil")',
      '[data-test-id*="easy-apply"]',
    ],
  } as const;

  // LinkedIn filter values mapping
  public static readonly FILTER_VALUES = {
    DATE_POSTED: {
      past24h: 'r86400',
      pastWeek: 'r604800',
      pastMonth: 'r2592000',
      any: '',
    },
    REMOTE_WORK: {
      remote: '2',
      hybrid: '3',
      onsite: '1',
    },
    EXPERIENCE_LEVEL: {
      internship: '1',
      entry: '2',
      associate: '3',
      mid: '4',
      director: '5',
      executive: '6',
    },
    JOB_TYPE: {
      fullTime: 'F',
      partTime: 'P',
      contract: 'C',
      temporary: 'T',
      internship: 'I',
    },
  } as const;

  /**
   * Validates if a selector exists on the page with timeout and error handling
   * @param page - Puppeteer page instance
   * @param selector - CSS selector to validate
   * @param timeout - Maximum time to wait for selector (default: 2000ms)
   * @returns Promise<boolean> - True if selector exists and is visible
   */
  public static async validateSelector(
    page: import('puppeteer').Page,
    selector: string,
    timeout: number = 2000
  ): Promise<boolean> {
    try {
      await page.waitForSelector(selector, {
        timeout,
        visible: true,
      });
      return true;
    } catch {
      // Log validation failure for debugging (in development)
      return false;
    }
  }

  /**
   * Gets a working selector with comprehensive fallback options and caching
   * @param page - Puppeteer page instance
   * @param primarySelector - Primary selector to try first
   * @param fallbacks - Array of fallback selectors
   * @param timeout - Timeout for each selector validation
   * @returns Promise<string | null> - Working selector or null if none found
   */
  public static async getWorkingSelector(
    page: import('puppeteer').Page,
    primarySelector: string,
    fallbacks: string[] = [],
    timeout: number = 2000
  ): Promise<string | null> {
    // Try primary selector first
    if (await this.validateSelector(page, primarySelector, timeout)) {
      return primarySelector;
    }

    // Try fallback selectors in order of priority
    for (const fallback of fallbacks) {
      if (await this.validateSelector(page, fallback, timeout)) {
        return fallback;
      }
    }

    return null;
  }

  /**
   * Gets the appropriate fallback selectors for a given selector key
   * @param selectorKey - Key from FALLBACK_SELECTORS
   * @returns Array of fallback selectors or empty array if key not found
   */
  public static getFallbackSelectors(
    selectorKey: keyof typeof LinkedInSelectors.FALLBACK_SELECTORS
  ): readonly string[] {
    return this.FALLBACK_SELECTORS[selectorKey] || [];
  }

  /**
   * Detects the likely locale of the LinkedIn page based on visible elements
   * @param page - Puppeteer page instance
   * @returns Promise<'es' | 'en' | 'unknown'> - Detected locale
   */
  public static async detectLocale(
    page: import('puppeteer').Page
  ): Promise<'es' | 'en' | 'unknown'> {
    try {
      // Check for Spanish indicators
      const spanishIndicators = [
        'button:contains("Buscar")',
        'input[placeholder*="Ciudad, provincia"]',
        'text*="Postulación fácil"',
      ];

      for (const indicator of spanishIndicators) {
        if (await this.validateSelector(page, indicator, 1000)) {
          return 'es';
        }
      }

      // Check for English indicators
      const englishIndicators = [
        'button:contains("Search")',
        'input[placeholder*="City, state"]',
        'text*="Easy Apply"',
      ];

      for (const indicator of englishIndicators) {
        if (await this.validateSelector(page, indicator, 1000)) {
          return 'en';
        }
      }

      return 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

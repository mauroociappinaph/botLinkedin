/**
 * Centralized LinkedIn selector management with validation and fallbacks
 */
export class LinkedInSelectors {
  // LinkedIn job search selectors
  public static readonly SELECTORS = {
    // Search input and button
    SEARCH_INPUT: 'input[aria-label="Search by title, skill, or company"]',
    LOCATION_INPUT:
      'input[aria-label="City, state, zip code, or \\"remote\\""]',
    SEARCH_BUTTON: 'button[aria-label="Search"]',

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

  // Alternative selectors for fallback
  public static readonly FALLBACK_SELECTORS = {
    SEARCH_INPUT: ['input[placeholder*="Search"]', 'input[name="keywords"]'],
    LOCATION_INPUT: [
      'input[placeholder*="location"]',
      'input[name="location"]',
    ],
    JOB_CARD: ['.job-result-card', '.jobs-search-results__list-item'],
    JOB_TITLE: ['.job-result-card__title', '.job-title a'],
    EASY_APPLY_BUTTON: ['.jobs-apply-button', '.apply-button'],
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
      volunteer: 'V',
      internship: 'I',
    },
  } as const;

  /**
   * Validates if a selector exists on the page
   */
  public static async validateSelector(
    page: import('puppeteer').Page,
    selector: string
  ): Promise<boolean> {
    try {
      const element = await page.$(selector);
      return !!element;
    } catch {
      return false;
    }
  }

  /**
   * Gets a working selector with fallback options
   */
  public static async getWorkingSelector(
    page: import('puppeteer').Page,
    primarySelector: string,
    fallbacks: string[] = []
  ): Promise<string | null> {
    // Try primary selector first
    if (await this.validateSelector(page, primarySelector)) {
      return primarySelector;
    }

    // Try fallback selectors
    for (const fallback of fallbacks) {
      if (await this.validateSelector(page, fallback)) {
        return fallback;
      }
    }

    return null;
  }
}

import { Page } from 'puppeteer';
import {
  ExtractionError,
  NavigationError,
  SearchError,
} from '../errors/LinkedInErrors';
import {
  JobPosting,
  JobSearchConfig,
  LogLevel,
  SearchResult,
  ServiceResponse,
} from '../types';
import { CircuitBreaker, CircuitBreakerStats } from '../utils/CircuitBreaker';
import { DelayUtils } from '../utils/DelayUtils';
import { Logger } from '../utils/Logger';
import {
  PerformanceMonitor,
  PerformanceReport,
} from '../utils/PerformanceMonitor';
import { RetryUtils } from '../utils/RetryUtils';
import { JobPostingParser } from './JobPostingParser';
import { JobSearchConfigValidator } from './JobSearchConfigValidator';
import { LinkedInSelectors } from './LinkedInSelectors';

// Error response codes for better type safety
type ErrorCode =
  | 'INVALID_SEARCH_CONFIG'
  | 'NAVIGATION_FAILED'
  | 'SEARCH_FAILED'
  | 'EXTRACTION_FAILED'
  | 'TIMEOUT_ERROR'
  | 'AUTHENTICATION_ERROR';

/**
 * Handles LinkedIn job search functionality including navigation, filtering, and job extraction
 * Implements Requirements 2.1, 2.2, 2.4
 *
 * Refactored for better maintainability, error handling, and performance monitoring
 */
export class JobSearchHandler {
  private readonly page: Page;
  private readonly logger: Logger;
  private searchConfig: JobSearchConfig;
  private readonly performanceMonitor: PerformanceMonitor;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly jobParser: JobPostingParser;

  // Enhanced configuration constants
  private static readonly CONFIG = {
    MAX_PAGES: 10,
    JOBS_PER_PAGE: 25,
    TIMEOUTS: {
      PAGE_LOAD: 30000,
      ELEMENT_WAIT: 10000,
      FILTER_WAIT: 5000,
      RESULTS_WAIT: 15000,
    },
    DELAYS: {
      TYPING_MIN: 50,
      TYPING_MAX: 150,
      FILTER_MIN: 300,
      FILTER_MAX: 600,
      PAGE_TRANSITION_MIN: 1000,
      PAGE_TRANSITION_MAX: 2000,
    },
  } as const;

  // Cached selectors for better performance
  private static readonly CACHED_SELECTORS = {
    SEARCH_INPUT: LinkedInSelectors.SELECTORS.SEARCH_INPUT,
    LOCATION_INPUT: LinkedInSelectors.SELECTORS.LOCATION_INPUT,
    SEARCH_BUTTON: LinkedInSelectors.SELECTORS.SEARCH_BUTTON,
    JOB_CARD: LinkedInSelectors.SELECTORS.JOB_CARD,
    JOB_RESULTS_LIST: LinkedInSelectors.SELECTORS.JOB_RESULTS_LIST,
    FILTERS_BUTTON: LinkedInSelectors.SELECTORS.FILTERS_BUTTON,
    APPLY_FILTERS_BUTTON: LinkedInSelectors.SELECTORS.APPLY_FILTERS_BUTTON,
    NEXT_PAGE_BUTTON: LinkedInSelectors.SELECTORS.NEXT_PAGE_BUTTON,
    RESULTS_COUNT: LinkedInSelectors.SELECTORS.RESULTS_COUNT,
    JOB_TITLE: LinkedInSelectors.SELECTORS.JOB_TITLE,
    JOB_COMPANY: LinkedInSelectors.SELECTORS.JOB_COMPANY,
    JOB_LOCATION: LinkedInSelectors.SELECTORS.JOB_LOCATION,
    EASY_APPLY_BUTTON: LinkedInSelectors.SELECTORS.EASY_APPLY_BUTTON,
    NO_RESULTS: LinkedInSelectors.SELECTORS.NO_RESULTS,
    LOADING_SPINNER: LinkedInSelectors.SELECTORS.LOADING_SPINNER,
  } as const;

  private static readonly FILTER_VALUES = LinkedInSelectors.FILTER_VALUES;

  constructor(page: Page, searchConfig: JobSearchConfig, logger?: Logger) {
    this.page = page;
    this.searchConfig = searchConfig;
    this.logger = logger || new Logger(LogLevel.INFO);
    this.performanceMonitor = new PerformanceMonitor(this.logger);
    this.circuitBreaker = CircuitBreaker.forLinkedIn(this.logger);
    this.jobParser = new JobPostingParser(this.page, this.logger);
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Performs a complete job search with the configured parameters
   * @returns Search results with job postings
   */
  public async performSearch(): Promise<
    ServiceResponse<SearchResult<JobPosting>>
  > {
    try {
      this.logger.info('Starting LinkedIn job search', {
        keywords: this.searchConfig.keywords,
        location: this.searchConfig.location,
      });

      // Validate search configuration
      const validation = JobSearchConfigValidator.validate(this.searchConfig);
      if (!validation.isValid) {
        return this.createErrorResponse(
          'INVALID_SEARCH_CONFIG',
          `Invalid search configuration: ${validation.errors.join(', ')}`,
          true
        );
      }

      // Execute search workflow
      await this.executeSearchWorkflow();

      // Extract and return results
      const searchResults = await this.extractJobListings();

      return this.createSuccessResponse(searchResults);
    } catch (error) {
      return this.handleSearchError(error);
    }
  }

  /**
   * Updates the search configuration
   * @param newConfig New search configuration
   */
  public updateSearchConfig(newConfig: Partial<JobSearchConfig>): void {
    this.searchConfig = { ...this.searchConfig, ...newConfig };
    this.logger.debug('Search configuration updated', { newConfig });
  }

  /**
   * Gets the current search configuration
   * @returns Current search configuration
   */
  public getSearchConfig(): JobSearchConfig {
    return { ...this.searchConfig };
  }

  /**
   * Gets performance monitoring report
   */
  public getPerformanceReport(): PerformanceReport {
    return this.performanceMonitor.getReport();
  }

  /**
   * Gets circuit breaker statistics
   */
  public getCircuitBreakerStats(): CircuitBreakerStats {
    return this.circuitBreaker.getStats();
  }

  /**
   * Checks if the handler is healthy (circuit breaker closed, no slow operations)
   */
  public isHealthy(): boolean {
    return (
      this.circuitBreaker.isHealthy() &&
      !this.performanceMonitor.hasSlowOperations()
    );
  }

  /**
   * Resets performance monitoring and circuit breaker stats
   */
  public reset(): void {
    this.performanceMonitor.clear();
    this.circuitBreaker.forceClose();
    this.logger.info(
      'JobSearchHandler reset - cleared performance metrics and circuit breaker'
    );
  }

  // ============================================================================
  // PRIVATE WORKFLOW METHODS
  // ============================================================================

  /**
   * Executes the main search workflow steps
   */
  private async executeSearchWorkflow(): Promise<void> {
    await this.navigateToJobsPage();
    await this.applySearchParameters();
    await this.applySearchFilters();
  }

  /**
   * Creates a success response with search results
   */
  private createSuccessResponse(
    searchResults: SearchResult<JobPosting>
  ): ServiceResponse<SearchResult<JobPosting>> {
    this.logger.info('Job search completed successfully', {
      totalJobs: searchResults.totalCount,
      pages: Math.ceil(
        searchResults.totalCount / JobSearchHandler.CONFIG.JOBS_PER_PAGE
      ),
    });

    return {
      success: true,
      data: searchResults,
    };
  }

  /**
   * Creates an error response with proper typing
   */
  private createErrorResponse(
    code: ErrorCode,
    message: string,
    recoverable: boolean = true
  ): ServiceResponse<SearchResult<JobPosting>> {
    return {
      success: false,
      error: {
        code,
        message,
        timestamp: new Date(),
        recoverable,
      },
    };
  }

  /**
   * Handles search errors and creates appropriate error response
   */
  private handleSearchError(
    error: unknown
  ): ServiceResponse<SearchResult<JobPosting>> {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    this.logger.error('Job search failed', {
      error: errorMessage,
      errorType: error?.constructor?.name,
      searchConfig: this.searchConfig,
    });

    // Handle specific error types
    if (error instanceof NavigationError) {
      return this.createErrorResponse('NAVIGATION_FAILED', errorMessage, false);
    }

    if (error instanceof SearchError) {
      return this.createErrorResponse(
        'SEARCH_FAILED',
        errorMessage,
        error.recoverable
      );
    }

    if (error instanceof ExtractionError) {
      return this.createErrorResponse('EXTRACTION_FAILED', errorMessage, true);
    }

    if (error instanceof Error && error.message.includes('timeout')) {
      return this.createErrorResponse('TIMEOUT_ERROR', errorMessage, true);
    }

    // Default error handling
    return this.createErrorResponse(
      'SEARCH_FAILED',
      errorMessage,
      !(error instanceof NavigationError)
    );
  }

  // ============================================================================
  // PRIVATE NAVIGATION METHODS
  // ============================================================================

  /**
   * Navigates to LinkedIn jobs page with enhanced error handling
   */
  private async navigateToJobsPage(): Promise<void> {
    const metricName = 'navigate-to-jobs-page';
    this.performanceMonitor.startTimer(metricName, {
      operation: 'navigation',
      url: 'https://www.linkedin.com/jobs/',
    });

    try {
      this.logger.debug('Navigating to LinkedIn jobs page');

      await RetryUtils.retryPageOperation(
        async () => {
          await this.page.goto('https://www.linkedin.com/jobs/', {
            waitUntil: 'networkidle2',
            timeout: JobSearchHandler.CONFIG.TIMEOUTS.PAGE_LOAD,
          });

          // Wait for the search form to be available with fallback selectors
          const searchSelector = await LinkedInSelectors.getWorkingSelector(
            this.page,
            JobSearchHandler.CACHED_SELECTORS.SEARCH_INPUT,
            [...LinkedInSelectors.FALLBACK_SELECTORS.SEARCH_INPUT]
          );

          if (!searchSelector) {
            throw new NavigationError(
              'Search input not found on LinkedIn jobs page'
            );
          }

          await this.page.waitForSelector(searchSelector, {
            timeout: JobSearchHandler.CONFIG.TIMEOUTS.ELEMENT_WAIT,
          });
        },
        'Navigate to LinkedIn jobs page',
        this.logger
      );

      await DelayUtils.pageLoadDelay();
      this.performanceMonitor.endTimer(metricName, { success: true });
    } catch (error) {
      this.performanceMonitor.endTimer(metricName, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof Error && error.message.includes('timeout')) {
        throw new NavigationError(`Navigation timeout: ${error.message}`);
      }

      throw error instanceof NavigationError
        ? error
        : new NavigationError(
            `Failed to navigate to LinkedIn jobs page: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
    }
  }

  /**
   * Applies basic search parameters (keywords and location) with performance monitoring
   */
  private async applySearchParameters(): Promise<void> {
    const metricName = 'apply-search-parameters';
    this.performanceMonitor.startTimer(metricName, {
      operation: 'search_operation',
      keywords: this.searchConfig.keywords,
      location: this.searchConfig.location,
    });

    try {
      this.logger.debug('Applying search parameters', {
        keywords: this.searchConfig.keywords,
        location: this.searchConfig.location,
      });

      // Apply keywords
      await this.fillSearchInput(
        JobSearchHandler.CACHED_SELECTORS.SEARCH_INPUT,
        this.searchConfig.keywords.join(' ')
      );

      // Apply location
      await this.fillSearchInput(
        JobSearchHandler.CACHED_SELECTORS.LOCATION_INPUT,
        this.searchConfig.location
      );

      // Execute search
      await this.executeSearch();

      this.performanceMonitor.endTimer(metricName, { success: true });
    } catch (error) {
      this.performanceMonitor.endTimer(metricName, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error instanceof SearchError
        ? error
        : new SearchError(
            `Failed to apply search parameters: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
    }
  }

  /**
   * Helper method to clear and fill an input field with human-like typing
   */
  private async fillSearchInput(
    selector: string,
    value: string
  ): Promise<void> {
    try {
      await this.page.click(selector);
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('KeyA');
      await this.page.keyboard.up('Control');
      await DelayUtils.randomDelay(100, 300);

      await this.page.type(selector, value, {
        delay: DelayUtils.getRandomTypingDelay(
          JobSearchHandler.CONFIG.DELAYS.TYPING_MIN,
          JobSearchHandler.CONFIG.DELAYS.TYPING_MAX
        ),
      });

      await DelayUtils.formFieldDelay();
    } catch (error) {
      throw new SearchError(
        `Failed to fill input field ${selector}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Executes the search and waits for results
   */
  private async executeSearch(): Promise<void> {
    try {
      await this.page.click(JobSearchHandler.CACHED_SELECTORS.SEARCH_BUTTON);

      // Wait for results to load
      await this.page.waitForSelector(
        JobSearchHandler.CACHED_SELECTORS.JOB_RESULTS_LIST,
        {
          timeout: JobSearchHandler.CONFIG.TIMEOUTS.RESULTS_WAIT,
        }
      );

      await DelayUtils.pageLoadDelay();
    } catch (error) {
      throw new SearchError(
        `Search execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ============================================================================
  // PRIVATE FILTER METHODS
  // ============================================================================

  /**
   * Applies advanced search filters with comprehensive error handling
   */
  private async applySearchFilters(): Promise<void> {
    const metricName = 'apply-search-filters';
    this.performanceMonitor.startTimer(metricName, {
      operation: 'filter_operation',
      filtersCount: this.getActiveFiltersCount(),
    });

    try {
      this.logger.debug('Applying search filters', {
        datePosted: this.searchConfig.datePosted,
        remoteWork: this.searchConfig.remoteWork,
        experienceLevel: this.searchConfig.experienceLevel,
        jobType: this.searchConfig.jobType,
      });

      await this.openFiltersPanel();
      await this.applyAllFilters();
      await this.submitFilters();

      this.performanceMonitor.endTimer(metricName, { success: true });
    } catch (error) {
      this.performanceMonitor.endTimer(metricName, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      this.logger.warn(
        'Failed to apply some filters, continuing with basic search',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
      // Don't throw - filters are optional, continue with basic search
    }
  }

  /**
   * Opens the filters panel
   */
  private async openFiltersPanel(): Promise<void> {
    await this.page.waitForSelector(
      JobSearchHandler.CACHED_SELECTORS.FILTERS_BUTTON,
      {
        timeout: JobSearchHandler.CONFIG.TIMEOUTS.FILTER_WAIT,
      }
    );
    await this.page.click(JobSearchHandler.CACHED_SELECTORS.FILTERS_BUTTON);
    await DelayUtils.randomDelay(1000, 2000);
  }

  /**
   * Applies all configured filters
   */
  private async applyAllFilters(): Promise<void> {
    // Apply Easy Apply filter (always enabled for this bot)
    await this.applyEasyApplyFilter();

    // Apply conditional filters
    if (this.searchConfig.datePosted !== 'any') {
      await this.applyDatePostedFilter();
    }

    if (this.searchConfig.remoteWork) {
      await this.applyRemoteWorkFilter();
    }

    if (this.searchConfig.experienceLevel.length > 0) {
      await this.applyExperienceLevelFilter();
    }

    if (this.searchConfig.jobType.length > 0) {
      await this.applyJobTypeFilter();
    }
  }

  /**
   * Submits the applied filters
   */
  private async submitFilters(): Promise<void> {
    await this.page.waitForSelector(
      JobSearchHandler.CACHED_SELECTORS.APPLY_FILTERS_BUTTON,
      {
        timeout: JobSearchHandler.CONFIG.TIMEOUTS.FILTER_WAIT,
      }
    );
    await this.page.click(
      JobSearchHandler.CACHED_SELECTORS.APPLY_FILTERS_BUTTON
    );

    // Wait for filtered results to load
    await this.page.waitForSelector(
      JobSearchHandler.CACHED_SELECTORS.JOB_RESULTS_LIST,
      {
        timeout: JobSearchHandler.CONFIG.TIMEOUTS.RESULTS_WAIT,
      }
    );

    await DelayUtils.pageLoadDelay();
  }

  /**
   * Gets the count of active filters for metrics
   */
  private getActiveFiltersCount(): number {
    let count = 1; // Easy Apply is always active

    if (this.searchConfig.datePosted !== 'any') count++;
    if (this.searchConfig.remoteWork) count++;
    count += this.searchConfig.experienceLevel.length;
    count += this.searchConfig.jobType.length;

    return count;
  }

  /**
   * Applies Easy Apply filter
   */
  private async applyEasyApplyFilter(): Promise<void> {
    try {
      const easyApplyCheckbox = await this.page.$(
        'input[value="true"][name="f_LF"]'
      );
      if (easyApplyCheckbox) {
        const isChecked = await this.page.evaluate(
          (el) => el.checked,
          easyApplyCheckbox
        );
        if (!isChecked) {
          await easyApplyCheckbox.click();
          await DelayUtils.randomDelay(300, 600);
        }
      }
    } catch (error) {
      this.logger.debug('Could not apply Easy Apply filter', { error });
    }
  }

  /**
   * Applies date posted filter
   */
  private async applyDatePostedFilter(): Promise<void> {
    try {
      const filterValue =
        JobSearchHandler.FILTER_VALUES.DATE_POSTED[
          this.searchConfig.datePosted
        ];
      if (filterValue) {
        const dateFilter = await this.page.$(`input[value="${filterValue}"]`);
        if (dateFilter) {
          await dateFilter.click();
          await DelayUtils.randomDelay(300, 600);
        }
      }
    } catch (error) {
      this.logger.debug('Could not apply date posted filter', { error });
    }
  }

  /**
   * Applies remote work filter
   */
  private async applyRemoteWorkFilter(): Promise<void> {
    try {
      const remoteValue = JobSearchHandler.FILTER_VALUES.REMOTE_WORK.remote;
      const remoteFilter = await this.page.$(`input[value="${remoteValue}"]`);
      if (remoteFilter) {
        await remoteFilter.click();
        await DelayUtils.randomDelay(300, 600);
      }
    } catch (error) {
      this.logger.debug('Could not apply remote work filter', { error });
    }
  }

  /**
   * Applies experience level filters
   */
  private async applyExperienceLevelFilter(): Promise<void> {
    try {
      for (const level of this.searchConfig.experienceLevel) {
        const filterValue =
          JobSearchHandler.FILTER_VALUES.EXPERIENCE_LEVEL[
            level as keyof typeof JobSearchHandler.FILTER_VALUES.EXPERIENCE_LEVEL
          ];
        if (filterValue) {
          const levelFilter = await this.page.$(
            `input[value="${filterValue}"][name="f_E"]`
          );
          if (levelFilter) {
            await levelFilter.click();
            await DelayUtils.randomDelay(300, 600);
          }
        }
      }
    } catch (error) {
      this.logger.debug('Could not apply experience level filters', { error });
    }
  }

  /**
   * Applies job type filters
   */
  private async applyJobTypeFilter(): Promise<void> {
    try {
      for (const jobType of this.searchConfig.jobType) {
        const filterValue =
          JobSearchHandler.FILTER_VALUES.JOB_TYPE[
            jobType as keyof typeof JobSearchHandler.FILTER_VALUES.JOB_TYPE
          ];
        if (filterValue) {
          const typeFilter = await this.page.$(
            `input[value="${filterValue}"][name="f_JT"]`
          );
          if (typeFilter) {
            await typeFilter.click();
            await DelayUtils.randomDelay(300, 600);
          }
        }
      }
    } catch (error) {
      this.logger.debug('Could not apply job type filters', { error });
    }
  }

  // ============================================================================
  // PRIVATE EXTRACTION METHODS
  // ============================================================================

  /**
   * Extracts job listings from all pages
   */
  private async extractJobListings(): Promise<SearchResult<JobPosting>> {
    const allJobs: JobPosting[] = [];
    const startTime = Date.now();
    const totalCount = await this.getTotalResultsCount();

    this.logger.info(
      `Found ${totalCount} total job results, starting extraction`
    );

    try {
      await this.extractJobsFromAllPages(allJobs, totalCount);
    } catch (error) {
      this.logger.error('Error during job extraction', {
        error: error instanceof Error ? error.message : 'Unknown error',
        extractedSoFar: allJobs.length,
      });
    }

    const searchTime = Date.now() - startTime;

    return {
      results: allJobs,
      totalCount: Math.max(totalCount, allJobs.length),
      searchTime,
      filters: this.searchConfig,
    };
  }

  /**
   * Extracts jobs from all available pages with pagination
   */
  private async extractJobsFromAllPages(
    allJobs: JobPosting[],
    totalCount: number
  ): Promise<void> {
    let currentPage = 1;

    while (currentPage <= JobSearchHandler.CONFIG.MAX_PAGES) {
      this.logger.debug(`Extracting jobs from page ${currentPage}`);

      await this.waitForJobListings();
      const pageJobs = await this.extractJobsFromCurrentPage();
      allJobs.push(...pageJobs);

      this.logger.debug(
        `Extracted ${pageJobs.length} jobs from page ${currentPage}`
      );

      const hasNextPage = await this.hasNextPage();
      if (!hasNextPage || allJobs.length >= totalCount) {
        break;
      }

      await this.goToNextPage();
      currentPage++;
      await DelayUtils.pageLoadDelay();
    }
  }

  /**
   * Waits for job listings to be visible on the page
   */
  private async waitForJobListings(): Promise<void> {
    try {
      // Wait for either job results or no results message
      await Promise.race([
        this.page.waitForSelector(JobSearchHandler.CACHED_SELECTORS.JOB_CARD, {
          timeout: 10000,
        }),
        this.page.waitForSelector(
          JobSearchHandler.CACHED_SELECTORS.NO_RESULTS,
          {
            timeout: 10000,
          }
        ),
      ]);

      // Wait for loading spinner to disappear
      try {
        await this.page.waitForSelector(
          JobSearchHandler.CACHED_SELECTORS.LOADING_SPINNER,
          {
            hidden: true,
            timeout: 5000,
          }
        );
      } catch {
        // Loading spinner might not be present, continue
      }
    } catch {
      this.logger.warn('Timeout waiting for job listings to load');
    }
  }

  /**
   * Extracts job postings from the current page with enhanced error handling
   */
  private async extractJobsFromCurrentPage(): Promise<JobPosting[]> {
    const metricName = 'extract-jobs-from-page';
    let jobs: JobPosting[] = [];

    this.performanceMonitor.startTimer(metricName, {
      operation: 'extraction',
      page: 'current',
    });

    try {
      const jobCards = await this.page.$$(
        JobSearchHandler.CACHED_SELECTORS.JOB_CARD
      );

      this.logger.debug(`Found ${jobCards.length} job cards on current page`);

      // Use JobPostingParser to parse all job cards
      jobs = await this.jobParser.parseJobCards(jobCards);

      this.performanceMonitor.endTimer(metricName, {
        success: true,
        extractedCount: jobs.length,
        totalCards: jobCards.length,
      });
    } catch (error) {
      this.performanceMonitor.endTimer(metricName, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to extract jobs from current page', {
        error: errorMessage,
      });

      throw new ExtractionError(`Page extraction failed: ${errorMessage}`);
    }

    return jobs;
  }

  // ============================================================================
  // PRIVATE UTILITY METHODS
  // ============================================================================

  /**
   * Gets the total number of search results with fallback estimation
   */
  private async getTotalResultsCount(): Promise<number> {
    try {
      await this.page.waitForSelector(
        JobSearchHandler.CACHED_SELECTORS.RESULTS_COUNT,
        {
          timeout: JobSearchHandler.CONFIG.TIMEOUTS.FILTER_WAIT,
        }
      );

      const countText = await this.page.$eval(
        JobSearchHandler.CACHED_SELECTORS.RESULTS_COUNT,
        (el) => el.textContent?.trim() || '0'
      );

      // Extract number from text like "1,234 results"
      const match = countText.match(/[\d,]+/);
      if (match) {
        return parseInt(match[0].replace(/,/g, ''), 10);
      }

      return 0;
    } catch {
      // If we can't get the count, estimate based on visible job cards
      const jobCards = await this.page.$$(
        JobSearchHandler.CACHED_SELECTORS.JOB_CARD
      );
      return jobCards.length;
    }
  }

  /**
   * Checks if there's a next page available
   */
  private async hasNextPage(): Promise<boolean> {
    try {
      const nextButton = await this.page.$(
        JobSearchHandler.CACHED_SELECTORS.NEXT_PAGE_BUTTON
      );
      if (!nextButton) return false;

      const isDisabled = await this.page.evaluate((el) => {
        return el.disabled || el.getAttribute('aria-disabled') === 'true';
      }, nextButton);

      return !isDisabled;
    } catch {
      return false;
    }
  }

  /**
   * Navigates to the next page of results
   */
  private async goToNextPage(): Promise<void> {
    try {
      const nextButton = await this.page.$(
        JobSearchHandler.CACHED_SELECTORS.NEXT_PAGE_BUTTON
      );
      if (nextButton) {
        await nextButton.click();
        await DelayUtils.pageLoadDelay();
      }
    } catch (error) {
      this.logger.warn('Failed to navigate to next page', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

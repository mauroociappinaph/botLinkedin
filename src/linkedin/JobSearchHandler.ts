import { Page } from 'puppeteer';
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
import { LinkedInSelectors } from './LinkedInSelectors';

/**
 * Handles LinkedIn job search functionality including navigation, filtering, and job extraction
 * Implements Requirements 2.1, 2.2, 2.4
 */
export class JobSearchHandler {
  private page: Page;
  private logger: Logger;
  private searchConfig: JobSearchConfig;
  private performanceMonitor: PerformanceMonitor;
  private circuitBreaker: CircuitBreaker;

  // Configuration constants
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

  // Use centralized selector management
  private static readonly SELECTORS = LinkedInSelectors.SELECTORS;
  private static readonly FILTER_VALUES = LinkedInSelectors.FILTER_VALUES;

  constructor(page: Page, searchConfig: JobSearchConfig, logger?: Logger) {
    this.page = page;
    this.searchConfig = searchConfig;
    this.logger = logger || new Logger(LogLevel.INFO);
    this.performanceMonitor = new PerformanceMonitor(this.logger);
    this.circuitBreaker = CircuitBreaker.forLinkedIn(this.logger);
  }

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
      const validation = this.validateSearchConfig();
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            code: 'INVALID_SEARCH_CONFIG',
            message: `Invalid search configuration: ${validation.errors.join(', ')}`,
            timestamp: new Date(),
            recoverable: true,
          },
        };
      }

      // Navigate to LinkedIn jobs page
      await this.navigateToJobsPage();

      // Apply search parameters
      await this.applySearchParameters();

      // Apply filters
      await this.applySearchFilters();

      // Extract job listings with pagination
      const searchResults = await this.extractJobListings();

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
    } catch (error) {
      this.logger.error('Job search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        searchConfig: this.searchConfig,
      });

      return {
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message:
            error instanceof Error ? error.message : 'Unknown search error',
          timestamp: new Date(),
          recoverable: true,
        },
      };
    }
  }

  /**
   * Navigates to LinkedIn jobs page
   */
  private async navigateToJobsPage(): Promise<void> {
    await this.performanceMonitor.timePageLoad(
      'https://www.linkedin.com/jobs/',
      async () => {
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
              JobSearchHandler.SELECTORS.SEARCH_INPUT,
              [...LinkedInSelectors.FALLBACK_SELECTORS.SEARCH_INPUT]
            );

            if (!searchSelector) {
              throw new Error('Search input not found on LinkedIn jobs page');
            }

            await this.page.waitForSelector(searchSelector, {
              timeout: JobSearchHandler.CONFIG.TIMEOUTS.ELEMENT_WAIT,
            });
          },
          'Navigate to LinkedIn jobs page',
          this.logger
        );

        await DelayUtils.pageLoadDelay();
      }
    );

    await DelayUtils.pageLoadDelay();
  }

  /**
   * Applies basic search parameters (keywords and location)
   */
  private async applySearchParameters(): Promise<void> {
    this.logger.debug('Applying search parameters', {
      keywords: this.searchConfig.keywords,
      location: this.searchConfig.location,
    });

    // Clear and fill keywords
    const keywordsString = this.searchConfig.keywords.join(' ');
    await this.page.click(JobSearchHandler.SELECTORS.SEARCH_INPUT);
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('KeyA');
    await this.page.keyboard.up('Control');
    await DelayUtils.randomDelay(100, 300);

    await this.page.type(
      JobSearchHandler.SELECTORS.SEARCH_INPUT,
      keywordsString,
      {
        delay: DelayUtils.getRandomTypingDelay(
          JobSearchHandler.CONFIG.DELAYS.TYPING_MIN,
          JobSearchHandler.CONFIG.DELAYS.TYPING_MAX
        ),
      }
    );

    await DelayUtils.formFieldDelay();

    // Clear and fill location
    await this.page.click(JobSearchHandler.SELECTORS.LOCATION_INPUT);
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('KeyA');
    await this.page.keyboard.up('Control');
    await DelayUtils.randomDelay(100, 300);

    await this.page.type(
      JobSearchHandler.SELECTORS.LOCATION_INPUT,
      this.searchConfig.location,
      {
        delay: DelayUtils.getRandomTypingDelay(
          JobSearchHandler.CONFIG.DELAYS.TYPING_MIN,
          JobSearchHandler.CONFIG.DELAYS.TYPING_MAX
        ),
      }
    );

    await DelayUtils.formFieldDelay();

    // Click search button
    await this.page.click(JobSearchHandler.SELECTORS.SEARCH_BUTTON);

    // Wait for results to load
    await this.page.waitForSelector(
      JobSearchHandler.SELECTORS.JOB_RESULTS_LIST,
      {
        timeout: 15000,
      }
    );

    await DelayUtils.pageLoadDelay();
  }

  /**
   * Applies advanced search filters
   */
  private async applySearchFilters(): Promise<void> {
    this.logger.debug('Applying search filters');

    try {
      // Click "Show all filters" button
      await this.page.waitForSelector(
        JobSearchHandler.SELECTORS.FILTERS_BUTTON,
        {
          timeout: 5000,
        }
      );
      await this.page.click(JobSearchHandler.SELECTORS.FILTERS_BUTTON);

      await DelayUtils.randomDelay(1000, 2000);

      // Apply Easy Apply filter (always enabled for this bot)
      await this.applyEasyApplyFilter();

      // Apply date posted filter
      if (this.searchConfig.datePosted !== 'any') {
        await this.applyDatePostedFilter();
      }

      // Apply remote work filter
      if (this.searchConfig.remoteWork) {
        await this.applyRemoteWorkFilter();
      }

      // Apply experience level filters
      if (this.searchConfig.experienceLevel.length > 0) {
        await this.applyExperienceLevelFilter();
      }

      // Apply job type filters
      if (this.searchConfig.jobType.length > 0) {
        await this.applyJobTypeFilter();
      }

      // Click "Show results" button
      await this.page.waitForSelector(
        JobSearchHandler.SELECTORS.APPLY_FILTERS_BUTTON,
        {
          timeout: 5000,
        }
      );
      await this.page.click(JobSearchHandler.SELECTORS.APPLY_FILTERS_BUTTON);

      // Wait for filtered results to load
      await this.page.waitForSelector(
        JobSearchHandler.SELECTORS.JOB_RESULTS_LIST,
        {
          timeout: 15000,
        }
      );

      await DelayUtils.pageLoadDelay();
    } catch (error) {
      this.logger.warn(
        'Failed to apply some filters, continuing with basic search',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
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
        this.page.waitForSelector(JobSearchHandler.SELECTORS.JOB_CARD, {
          timeout: 10000,
        }),
        this.page.waitForSelector(JobSearchHandler.SELECTORS.NO_RESULTS, {
          timeout: 10000,
        }),
      ]);

      // Wait for loading spinner to disappear
      try {
        await this.page.waitForSelector(
          JobSearchHandler.SELECTORS.LOADING_SPINNER,
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
   * Extracts job postings from the current page
   */
  private async extractJobsFromCurrentPage(): Promise<JobPosting[]> {
    const jobs: JobPosting[] = [];

    try {
      const jobCards = await this.page.$$(JobSearchHandler.SELECTORS.JOB_CARD);

      for (const jobCard of jobCards) {
        try {
          const job = await this.extractJobFromCard(jobCard);
          if (job) {
            jobs.push(job);
          }
        } catch (error) {
          this.logger.debug('Failed to extract job from card', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to extract jobs from current page', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return jobs;
  }

  /**
   * Extracts job information from a single job card element
   */
  private async extractJobFromCard(
    jobCard: import('puppeteer').ElementHandle
  ): Promise<JobPosting | null> {
    try {
      // Extract job title and URL
      const titleElement = await jobCard.$(
        JobSearchHandler.SELECTORS.JOB_TITLE
      );
      const title = titleElement
        ? await this.page.evaluate((el) => el.textContent?.trim(), titleElement)
        : '';
      const url = titleElement
        ? await this.page.evaluate((el) => el.href, titleElement)
        : '';

      // Extract job ID from URL
      const jobIdMatch = url.match(/jobs\/view\/(\d+)/);
      const jobId = jobIdMatch ? jobIdMatch[1] : '';

      // Extract company name
      const companyElement = await jobCard.$(
        JobSearchHandler.SELECTORS.JOB_COMPANY
      );
      const company = companyElement
        ? await this.page.evaluate(
            (el) => el.textContent?.trim(),
            companyElement
          )
        : '';

      // Extract location
      const locationElement = await jobCard.$(
        JobSearchHandler.SELECTORS.JOB_LOCATION
      );
      const location = locationElement
        ? await this.page.evaluate(
            (el) => el.textContent?.trim(),
            locationElement
          )
        : '';

      // Check if Easy Apply is available
      const easyApplyElement = await jobCard.$(
        JobSearchHandler.SELECTORS.EASY_APPLY_BUTTON
      );
      const isEasyApply = !!easyApplyElement;

      // Only return jobs that have Easy Apply (as per requirements)
      if (!isEasyApply || !jobId || !title || !company) {
        return null;
      }

      return {
        id: jobId,
        title: title || 'Unknown Title',
        company: company || 'Unknown Company',
        location: location || 'Unknown Location',
        url: url || '',
        status: 'found',
        isEasyApply: true,
        appliedAt: null,
        description: null,
        salary: null,
        errorMessage: null,
      };
    } catch (error) {
      this.logger.debug('Error extracting job from card', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Gets the total number of search results
   */
  private async getTotalResultsCount(): Promise<number> {
    try {
      await this.page.waitForSelector(
        JobSearchHandler.SELECTORS.RESULTS_COUNT,
        {
          timeout: 5000,
        }
      );

      const countText = await this.page.$eval(
        JobSearchHandler.SELECTORS.RESULTS_COUNT,
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
      const jobCards = await this.page.$$(JobSearchHandler.SELECTORS.JOB_CARD);
      return jobCards.length;
    }
  }

  /**
   * Checks if there's a next page available
   */
  private async hasNextPage(): Promise<boolean> {
    try {
      const nextButton = await this.page.$(
        JobSearchHandler.SELECTORS.NEXT_PAGE_BUTTON
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
        JobSearchHandler.SELECTORS.NEXT_PAGE_BUTTON
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

  /**
   * Validates the search configuration
   */
  private validateSearchConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    this.validateKeywords(errors);
    this.validateLocation(errors);
    this.validateDatePosted(errors);
    this.validateExperienceLevels(errors);
    this.validateJobTypes(errors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private validateKeywords(errors: string[]): void {
    if (
      !this.searchConfig.keywords ||
      this.searchConfig.keywords.length === 0
    ) {
      errors.push('Keywords are required');
    }

    if (this.searchConfig.keywords.some((keyword) => !keyword.trim())) {
      errors.push('Keywords cannot be empty');
    }
  }

  private validateLocation(errors: string[]): void {
    if (!this.searchConfig.location || !this.searchConfig.location.trim()) {
      errors.push('Location is required');
    }
  }

  private validateDatePosted(errors: string[]): void {
    const validDateOptions = ['past24h', 'pastWeek', 'pastMonth', 'any'];
    if (!validDateOptions.includes(this.searchConfig.datePosted)) {
      errors.push('Invalid date posted option');
    }
  }

  private validateExperienceLevels(errors: string[]): void {
    const validExperienceLevels = [
      'internship',
      'entry',
      'associate',
      'mid',
      'director',
      'executive',
    ];
    if (
      this.searchConfig.experienceLevel.some(
        (level) => !validExperienceLevels.includes(level)
      )
    ) {
      errors.push('Invalid experience level specified');
    }
  }

  private validateJobTypes(errors: string[]): void {
    const validJobTypes = [
      'fullTime',
      'partTime',
      'contract',
      'temporary',
      'volunteer',
      'internship',
    ];
    if (
      this.searchConfig.jobType.some((type) => !validJobTypes.includes(type))
    ) {
      errors.push('Invalid job type specified');
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
}

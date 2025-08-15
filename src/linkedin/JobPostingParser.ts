import { ElementHandle, Page } from 'puppeteer';
import { JobPosting, LogLevel, ServiceResponse } from '../types';
import { DelayUtils } from '../utils/DelayUtils';
import { Logger } from '../utils/Logger';

/**
 * Handles parsing of LinkedIn job postings to extract job details
 * Implements Requirements 1.1, 1.2, 2.3
 */
export class JobPostingParser {
  private page: Page;
  private logger: Logger;

  // Selectors specific to job posting parsing
  private static readonly SELECTORS = {
    // Job card selectors
    JOB_CARD: '.job-search-card',
    JOB_TITLE: '.job-search-card__title a',
    JOB_COMPANY: '.job-search-card__subtitle-link',
    JOB_LOCATION: '.job-search-card__location',
    JOB_LINK: '.job-search-card__title a',
    EASY_APPLY_BUTTON: '.jobs-apply-button--top-card',

    // Job detail page selectors
    JOB_DESCRIPTION: '.jobs-description__content',
    JOB_DESCRIPTION_TEXT: '.jobs-box__html-content',
    SALARY_INFO: '.jobs-unified-top-card__job-insight',
    SALARY_RANGE: '.jobs-unified-top-card__job-insight-text',
    JOB_INSIGHTS: '.jobs-unified-top-card__job-insight',

    // Alternative selectors for job details
    ALT_JOB_DESCRIPTION: '.jobs-description-content__text',
    ALT_SALARY_INFO: '.job-details-jobs-unified-top-card__job-insight',

    // External application indicators
    EXTERNAL_APPLY: '.jobs-apply-button--external',
    EXTERNAL_LINK: 'a[data-control-name="external_apply"]',

    // Job posting metadata
    JOB_POSTING_DATE: '.jobs-unified-top-card__posted-date',
    JOB_APPLICANTS: '.jobs-unified-top-card__applicant-count',
  } as const;

  // Fallback selectors for different LinkedIn layouts
  private static readonly FALLBACK_SELECTORS = {
    JOB_TITLE: [
      '.job-result-card__title a',
      '.jobs-search-results__list-item h3 a',
      '.job-title a',
    ],
    JOB_COMPANY: [
      '.job-result-card__subtitle',
      '.jobs-search-results__list-item .job-result-card__subtitle-link',
      '.job-company-name',
    ],
    JOB_LOCATION: [
      '.job-result-card__location',
      '.jobs-search-results__list-item .job-result-card__location',
      '.job-location',
    ],
    EASY_APPLY_BUTTON: [
      '.jobs-apply-button',
      '.apply-button',
      'button[data-control-name="jobdetails_topcard_inapply"]',
    ],
    JOB_DESCRIPTION: [
      '.jobs-description-content__text',
      '.jobs-box__html-content',
      '.job-description-content',
    ],
  } as const;

  constructor(page: Page, logger?: Logger) {
    this.page = page;
    this.logger = logger || new Logger(LogLevel.INFO);
  }

  /**
   * Parses job postings from job cards on the search results page
   * @param jobCards Array of job card elements
   * @returns Array of parsed job postings
   */
  public async parseJobCards(jobCards: ElementHandle[]): Promise<JobPosting[]> {
    const jobs: JobPosting[] = [];

    this.logger.debug(`Starting to parse ${jobCards.length} job cards`);

    for (let i = 0; i < jobCards.length; i++) {
      try {
        const jobCard = jobCards[i];
        if (jobCard) {
          const job = await this.parseJobCard(jobCard);
          if (job) {
            jobs.push(job);
            this.logger.debug(
              `Successfully parsed job: ${job.title} at ${job.company}`
            );
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to parse job card ${i + 1}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logger.info(
      `Successfully parsed ${jobs.length} out of ${jobCards.length} job cards`
    );
    return jobs;
  }

  /**
   * Parses a single job card element to extract job information
   * @param jobCard Job card element handle
   * @returns Parsed job posting or null if parsing fails
   */
  public async parseJobCard(
    jobCard: ElementHandle
  ): Promise<JobPosting | null> {
    try {
      // Extract basic job information
      const jobData = await this.extractBasicJobInfo(jobCard);

      if (!jobData.id || !jobData.title || !jobData.company) {
        this.logger.debug('Skipping job card due to missing required fields', {
          id: jobData.id,
          title: jobData.title,
          company: jobData.company,
        });
        return null;
      }

      // Check if Easy Apply is available (requirement 1.1)
      const isEasyApply = await this.checkEasyApplyAvailability(jobCard);

      if (!isEasyApply) {
        this.logger.debug(`Skipping job ${jobData.title} - not Easy Apply`, {
          jobId: jobData.id,
          title: jobData.title,
        });
        return null;
      }

      // Create job posting object
      const jobPosting: JobPosting = {
        id: jobData.id,
        title: jobData.title,
        company: jobData.company,
        location: jobData.location || 'Location not specified',
        url: jobData.url || '',
        description: null, // Will be populated when job details are fetched
        salary: null, // Will be populated when job details are fetched
        status: 'found',
        isEasyApply: true,
        appliedAt: null,
        errorMessage: null,
      };

      return jobPosting;
    } catch (error) {
      this.logger.error('Error parsing job card', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Extracts basic job information from a job card
   * @param jobCard Job card element handle
   * @returns Basic job information
   */
  private async extractBasicJobInfo(jobCard: ElementHandle): Promise<{
    id: string;
    title: string;
    company: string;
    location: string;
    url: string;
  }> {
    // Extract job title and URL
    const titleData = await this.extractTitleAndUrl(jobCard);

    // Extract company name
    const company = await this.extractCompanyName(jobCard);

    // Extract location
    const location = await this.extractLocation(jobCard);

    return {
      id: titleData.id,
      title: titleData.title,
      company: company,
      location: location,
      url: titleData.url,
    };
  }

  /**
   * Extracts job title, URL, and ID from job card
   * @param jobCard Job card element handle
   * @returns Title, URL, and extracted job ID
   */
  private async extractTitleAndUrl(jobCard: ElementHandle): Promise<{
    title: string;
    url: string;
    id: string;
  }> {
    // Try primary selector first, then fallbacks
    const titleElement = await this.findElementWithFallbacks(
      jobCard,
      JobPostingParser.SELECTORS.JOB_TITLE,
      [...JobPostingParser.FALLBACK_SELECTORS.JOB_TITLE]
    );

    if (!titleElement) {
      return { title: '', url: '', id: '' };
    }

    const title = await this.page.evaluate((el) => {
      return el.textContent?.trim() || '';
    }, titleElement);

    const url = await this.page.evaluate((el) => {
      return el.href || '';
    }, titleElement);

    // Extract job ID from URL (requirement 1.2)
    const jobId = this.extractJobIdFromUrl(url);

    return { title, url, id: jobId };
  }

  /**
   * Extracts company name from job card
   * @param jobCard Job card element handle
   * @returns Company name
   */
  private async extractCompanyName(jobCard: ElementHandle): Promise<string> {
    const companyElement = await this.findElementWithFallbacks(
      jobCard,
      JobPostingParser.SELECTORS.JOB_COMPANY,
      [...JobPostingParser.FALLBACK_SELECTORS.JOB_COMPANY]
    );

    if (!companyElement) {
      return '';
    }

    return await this.page.evaluate((el) => {
      return el.textContent?.trim() || '';
    }, companyElement);
  }

  /**
   * Extracts location from job card
   * @param jobCard Job card element handle
   * @returns Location string
   */
  private async extractLocation(jobCard: ElementHandle): Promise<string> {
    const locationElement = await this.findElementWithFallbacks(
      jobCard,
      JobPostingParser.SELECTORS.JOB_LOCATION,
      [...JobPostingParser.FALLBACK_SELECTORS.JOB_LOCATION]
    );

    if (!locationElement) {
      return '';
    }

    return await this.page.evaluate((el) => {
      return el.textContent?.trim() || '';
    }, locationElement);
  }

  /**
   * Checks if Easy Apply is available for a job (requirement 1.1)
   * @param jobCard Job card element handle
   * @returns True if Easy Apply is available
   */
  private async checkEasyApplyAvailability(
    jobCard: ElementHandle
  ): Promise<boolean> {
    // Check for Easy Apply button
    const easyApplyElement = await this.findElementWithFallbacks(
      jobCard,
      JobPostingParser.SELECTORS.EASY_APPLY_BUTTON,
      [...JobPostingParser.FALLBACK_SELECTORS.EASY_APPLY_BUTTON]
    );

    if (easyApplyElement) {
      return true;
    }

    // Check if there's an external apply button (which means it's NOT Easy Apply)
    const externalApplyElement = await jobCard.$(
      JobPostingParser.SELECTORS.EXTERNAL_APPLY
    );
    if (externalApplyElement) {
      return false;
    }

    // If no Easy Apply button found, it's likely not an Easy Apply job
    return false;
  }

  /**
   * Fetches detailed job information by navigating to the job posting page
   * @param jobPosting Job posting to enhance with details
   * @returns Enhanced job posting with description and salary
   */
  public async fetchJobDetails(
    jobPosting: JobPosting
  ): Promise<ServiceResponse<JobPosting>> {
    try {
      this.logger.debug(`Fetching details for job: ${jobPosting.title}`, {
        jobId: jobPosting.id,
        url: jobPosting.url,
      });

      if (!jobPosting.url) {
        return {
          success: false,
          error: {
            code: 'MISSING_JOB_URL',
            message: 'Job URL is required to fetch details',
            timestamp: new Date(),
            recoverable: false,
          },
        };
      }

      // Navigate to job posting page
      await this.page.goto(jobPosting.url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      await DelayUtils.pageLoadDelay();

      // Extract job description (requirement 2.3)
      const description = await this.extractJobDescription();

      // Extract salary information when available (requirement 2.3)
      const salary = await this.extractSalaryInfo();

      // Create enhanced job posting
      const enhancedJob: JobPosting = {
        ...jobPosting,
        description,
        salary,
      };

      this.logger.debug(
        `Successfully fetched details for job: ${jobPosting.title}`,
        {
          hasDescription: !!description,
          hasSalary: !!salary,
        }
      );

      return {
        success: true,
        data: enhancedJob,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch job details for ${jobPosting.title}`, {
        jobId: jobPosting.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: {
          code: 'JOB_DETAILS_FETCH_FAILED',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to fetch job details',
          timestamp: new Date(),
          recoverable: true,
        },
      };
    }
  }

  /**
   * Extracts job description from job posting page
   * @returns Job description text or null if not found
   */
  private async extractJobDescription(): Promise<string | null> {
    try {
      // Wait for job description to load
      await this.page
        .waitForSelector(JobPostingParser.SELECTORS.JOB_DESCRIPTION, {
          timeout: 10000,
        })
        .catch(() => {
          // Description might not be immediately available
        });

      // Try primary selector first
      let descriptionElement = await this.page.$(
        JobPostingParser.SELECTORS.JOB_DESCRIPTION_TEXT
      );

      // Try fallback selectors if primary fails
      if (!descriptionElement) {
        for (const selector of JobPostingParser.FALLBACK_SELECTORS
          .JOB_DESCRIPTION) {
          descriptionElement = await this.page.$(selector);
          if (descriptionElement) break;
        }
      }

      if (!descriptionElement) {
        this.logger.debug('Job description not found');
        return null;
      }

      const description = await this.page.evaluate((el) => {
        // Get text content and clean it up
        const text = el.textContent || el.innerText || '';
        return text.trim().replace(/\s+/g, ' ');
      }, descriptionElement);

      return description || null;
    } catch (error) {
      this.logger.debug('Error extracting job description', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Extracts salary information from job posting page
   * @returns Salary information or null if not found
   */
  private async extractSalaryInfo(): Promise<string | null> {
    try {
      // Look for salary information in job insights
      const salaryElements = await this.page.$$(
        JobPostingParser.SELECTORS.JOB_INSIGHTS
      );

      for (const element of salaryElements) {
        const text = await this.page.evaluate((el) => {
          return el.textContent?.trim() || '';
        }, element);

        // Check if this insight contains salary information
        if (this.isSalaryText(text)) {
          this.logger.debug('Found salary information', { salary: text });
          return text;
        }
      }

      // Try alternative salary selector
      const altSalaryElement = await this.page.$(
        JobPostingParser.SELECTORS.ALT_SALARY_INFO
      );
      if (altSalaryElement) {
        const salaryText = await this.page.evaluate((el) => {
          return el.textContent?.trim() || '';
        }, altSalaryElement);

        if (this.isSalaryText(salaryText)) {
          return salaryText;
        }
      }

      this.logger.debug('No salary information found');
      return null;
    } catch (error) {
      this.logger.debug('Error extracting salary information', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Checks if text contains salary information
   * @param text Text to check
   * @returns True if text appears to contain salary information
   */
  private isSalaryText(text: string): boolean {
    const salaryPatterns = [
      /\$[\d,]+/, // Dollar amounts
      /€[\d,]+/, // Euro amounts
      /£[\d,]+/, // Pound amounts
      /\d+k\s*-\s*\d+k/i, // Salary ranges like "50k - 80k"
      /salary/i,
      /compensation/i,
      /per\s+(year|hour|month)/i,
      /annually/i,
      /hourly/i,
    ];

    return salaryPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Extracts job ID from LinkedIn job URL
   * @param url LinkedIn job URL
   * @returns Job ID or empty string if not found
   */
  private extractJobIdFromUrl(url: string): string {
    if (!url) return '';

    // LinkedIn job URLs typically have format: /jobs/view/{jobId}
    const jobIdMatch = url.match(/\/jobs\/view\/(\d+)/);
    return jobIdMatch ? jobIdMatch[1] || '' : '';
  }

  /**
   * Finds an element using primary selector with fallback options
   * @param parent Parent element to search within
   * @param primarySelector Primary CSS selector
   * @param fallbackSelectors Array of fallback selectors
   * @returns Element handle or null if not found
   */
  private async findElementWithFallbacks(
    parent: ElementHandle,
    primarySelector: string,
    fallbackSelectors: string[]
  ): Promise<ElementHandle | null> {
    // Try primary selector first
    let element = await parent.$(primarySelector);
    if (element) return element;

    // Try fallback selectors
    for (const selector of fallbackSelectors) {
      element = await parent.$(selector);
      if (element) return element;
    }

    return null;
  }

  /**
   * Validates that a job posting has all required fields
   * @param job Job posting to validate
   * @returns True if job has all required fields
   */
  public validateJobPosting(job: Partial<JobPosting>): boolean {
    const requiredFields = ['id', 'title', 'company', 'url'];

    for (const field of requiredFields) {
      if (
        !job[field as keyof JobPosting] ||
        (typeof job[field as keyof JobPosting] === 'string' &&
          !(job[field as keyof JobPosting] as string).trim())
      ) {
        this.logger.debug(`Job validation failed: missing ${field}`, {
          jobData: job,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Handles missing or malformed job data gracefully (requirement 2.3)
   * @param job Partial job data
   * @returns Sanitized job posting or null if critical data is missing
   */
  public sanitizeJobData(job: Partial<JobPosting>): JobPosting | null {
    // Check if we have minimum required data
    if (!this.validateJobPosting(job)) {
      return null;
    }

    // Sanitize and provide defaults for optional fields
    return {
      id: job.id!,
      title: job.title!.trim(),
      company: job.company!.trim(),
      location: job.location?.trim() || 'Location not specified',
      url: job.url!,
      description: job.description?.trim() || null,
      salary: job.salary?.trim() || null,
      status: job.status || 'found',
      isEasyApply: job.isEasyApply ?? true,
      appliedAt: job.appliedAt || null,
      errorMessage: job.errorMessage?.trim() || null,
    };
  }

  /**
   * Gets statistics about parsing performance
   * @returns Parsing statistics
   */
  public getParsingStats(): {
    totalParsed: number;
    successfullyParsed: number;
    failedToParse: number;
    easyApplyJobs: number;
    externalJobs: number;
  } {
    // This would be implemented with instance variables tracking stats
    // For now, returning placeholder structure
    return {
      totalParsed: 0,
      successfullyParsed: 0,
      failedToParse: 0,
      easyApplyJobs: 0,
      externalJobs: 0,
    };
  }
}

import { Page } from 'puppeteer';
import { JobRepository } from '../database/JobRepository';
import { ApplicationConfig, JobPosting, JobStatus, LogLevel } from '../types';
import { DelayUtils } from '../utils/DelayUtils';
import { Logger } from '../utils/Logger';
import { Failure, Result, ResultUtils, Success } from '../utils/Result';
import {
  ApplicationHandlerConfig,
  DEFAULT_APPLICATION_CONFIG,
} from './ApplicationHandlerConfig';
import { APPLICATION_SELECTORS, SELECTOR_GROUPS } from './ApplicationSelectors';
import { ApplicationStepProcessor } from './ApplicationStepProcessor';
import { ApplicationValidator } from './ApplicationValidator';
import { FormFiller } from './FormFiller';
import { SelectorManager } from './SelectorManager';

/**
 * Custom error class for application-specific errors
 */
export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly jobId: string,
    public readonly step?: string
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

/**
 * Handles LinkedIn job application automation
 * Focuses on Easy Apply jobs and manages the application process
 */
export class ApplicationHandler {
  private jobRepository: JobRepository;
  private logger: Logger;
  private formFiller: FormFiller;
  private selectorManager: SelectorManager;
  private stepProcessor: ApplicationStepProcessor;
  private validator: ApplicationValidator;
  private config: ApplicationHandlerConfig;

  constructor(
    applicationConfig: ApplicationConfig,
    jobRepository?: JobRepository,
    logger?: Logger,
    formFiller?: FormFiller,
    config: ApplicationHandlerConfig = DEFAULT_APPLICATION_CONFIG
  ) {
    this.jobRepository = jobRepository || new JobRepository();
    this.logger = logger || new Logger(LogLevel.INFO);
    this.formFiller = formFiller || new FormFiller(applicationConfig);
    this.config = config;

    // Initialize components
    this.selectorManager = new SelectorManager(this.logger);
    this.stepProcessor = new ApplicationStepProcessor(
      this.formFiller,
      this.selectorManager,
      this.logger,
      this.config
    );
    this.validator = new ApplicationValidator(
      this.selectorManager,
      this.logger
    );
  }

  /**
   * Attempts to apply to a job posting
   * @param page Puppeteer page instance
   * @param job Job posting to apply to
   * @returns Promise resolving to application result
   */
  async applyToJob(
    page: Page,
    job: JobPosting
  ): Promise<Result<boolean, ApplicationError>> {
    try {
      this.logger.info(
        `Starting application process for job: ${job.title} at ${job.company}`
      );

      // Check if already applied in database
      if (await this.hasAlreadyApplied(job.id)) {
        this.logger.info(`Job ${job.id} already applied to, skipping`);
        return Success(false);
      }

      // Validate job application prerequisites
      const validationResult =
        await this.validator.validateJobApplication(page);
      if (ResultUtils.isFailure(validationResult)) {
        return Failure(
          new ApplicationError(
            `Validation failed: ${validationResult.error.message}`,
            job.id,
            'validation'
          )
        );
      }

      if (!validationResult.data.isValid) {
        this.logger.info(
          `Job ${job.id} validation failed: ${validationResult.data.skipReason}`
        );
        await this.markJobAsSkipped(
          job.id,
          validationResult.data.skipReason || 'Validation failed'
        );
        return Success(false);
      }

      // Find and click Easy Apply button
      const clickResult = await this.clickEasyApplyButton(page);
      if (ResultUtils.isFailure(clickResult)) {
        return Failure(
          new ApplicationError(
            `Failed to click Easy Apply: ${clickResult.error.message}`,
            job.id,
            'easy_apply_click'
          )
        );
      }

      if (!clickResult.data) {
        this.logger.warn(`Easy Apply button not found for job ${job.id}`);
        await this.markJobAsSkipped(job.id, 'Easy Apply not available');
        return Success(false);
      }

      // Wait for application modal to load
      await this.waitForApplicationModal(page);

      // Navigate through application steps
      const applicationResult = await this.completeApplicationSteps(page, job);
      if (ResultUtils.isFailure(applicationResult)) {
        await this.markJobAsError(
          job.id,
          `Application process failed: ${applicationResult.error.message}`
        );
        return Failure(applicationResult.error);
      }

      if (applicationResult.data) {
        await this.markJobAsApplied(job.id);
        this.logger.info(`Successfully applied to job: ${job.title}`);
        return Success(true);
      } else {
        await this.markJobAsError(job.id, 'Application process failed');
        return Success(false);
      }
    } catch (error) {
      const appError = new ApplicationError(
        `Unexpected error: ${error}`,
        job.id,
        'unexpected'
      );
      this.logger.error(`Error applying to job ${job.id}: ${error}`);
      await this.markJobAsError(job.id, `Application error: ${error}`);
      return Failure(appError);
    }
  }

  /**
   * Checks if job has already been applied to in database
   */
  private async hasAlreadyApplied(jobId: string): Promise<boolean> {
    try {
      return await this.jobRepository.hasBeenAppliedTo(jobId);
    } catch (error) {
      this.logger.error(
        `Error checking application status for job ${jobId}: ${error}`
      );
      return false;
    }
  }

  /**
   * Finds and clicks the Easy Apply button
   */
  private async clickEasyApplyButton(
    page: Page
  ): Promise<Result<boolean, Error>> {
    try {
      const button = await this.selectorManager.findWorkingSelector(
        page,
        SELECTOR_GROUPS.EASY_APPLY_BUTTONS
      );
      if (!button) {
        return Success(false);
      }

      this.logger.debug('Clicking Easy Apply button');
      await button.click();
      await DelayUtils.randomDelay(
        this.config.DELAYS.BUTTON_CLICK.min,
        this.config.DELAYS.BUTTON_CLICK.max
      );
      return Success(true);
    } catch (error) {
      this.logger.error(`Error clicking Easy Apply button: ${error}`);
      return Failure(error as Error);
    }
  }

  /**
   * Waits for the application modal to appear with timeout handling
   */
  private async waitForApplicationModal(page: Page): Promise<void> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Modal timeout')),
        this.config.TIMEOUTS.MODAL
      )
    );

    const modalAppears = page.waitForSelector(
      APPLICATION_SELECTORS.APPLICATION_MODAL
    );

    try {
      await Promise.race([modalAppears, timeout]);
      await DelayUtils.randomDelay(
        this.config.DELAYS.PAGE_LOAD.min,
        this.config.DELAYS.PAGE_LOAD.max
      );
    } catch (error) {
      throw new Error(`Application modal did not appear: ${error}`);
    }
  }

  /**
   * Completes all application steps in the modal
   */
  private async completeApplicationSteps(
    page: Page,
    job: JobPosting
  ): Promise<Result<boolean, ApplicationError>> {
    try {
      let currentStep = 1;

      while (currentStep <= this.config.MAX_APPLICATION_STEPS) {
        const stepResult = await this.stepProcessor.processStep(
          page,
          job,
          currentStep
        );

        if (ResultUtils.isFailure(stepResult)) {
          return Failure(
            new ApplicationError(
              `Step processing failed: ${stepResult.error.message}`,
              job.id,
              `step_${currentStep}`
            )
          );
        }

        const { result } = stepResult.data;

        switch (result) {
          case 'submit': {
            const submitResult = await this.submitApplication(page);
            if (ResultUtils.isFailure(submitResult)) {
              return Failure(
                new ApplicationError(
                  `Submission failed: ${submitResult.error.message}`,
                  job.id,
                  'submission'
                )
              );
            }
            return Success(submitResult.data);
          }

          case 'error':
            return Success(false);

          case 'continue':
            currentStep++;
            break;
        }
      }

      this.logger.warn(
        `Reached maximum steps (${this.config.MAX_APPLICATION_STEPS}) without completion`
      );
      return Success(false);
    } catch (error) {
      this.logger.error(`Error completing application steps: ${error}`);
      return Failure(
        new ApplicationError(
          `Unexpected error in application steps: ${error}`,
          job.id,
          'steps_processing'
        )
      );
    }
  }

  /**
   * Checks if we're on the final application step
   */

  /**
   * Submits the final application
   */
  private async submitApplication(page: Page): Promise<Result<boolean, Error>> {
    try {
      const button = await this.selectorManager.findWorkingSelector(
        page,
        SELECTOR_GROUPS.SUBMIT_BUTTONS
      );
      if (!button) {
        return Success(false);
      }

      const isEnabled = await page.evaluate((el) => !el.disabled, button);
      if (!isEnabled) {
        return Success(false);
      }

      this.logger.debug('Submitting application');
      await button.click();

      // Wait for submission to complete
      await DelayUtils.randomDelay(
        this.config.DELAYS.SUBMISSION.min,
        this.config.DELAYS.SUBMISSION.max
      );

      // Check for success confirmation using validator
      const validationResult =
        await this.validator.validateApplicationSuccess(page);
      if (ResultUtils.isFailure(validationResult)) {
        return Failure(validationResult.error);
      }

      return Success(validationResult.data.isValid);
    } catch (error) {
      this.logger.error(`Error submitting application: ${error}`);
      return Failure(error as Error);
    }
  }

  /**
   * Marks job as successfully applied in database
   */
  private async markJobAsApplied(jobId: string): Promise<void> {
    try {
      await this.jobRepository.markAsApplied(jobId);
    } catch (error) {
      this.logger.error(`Error marking job ${jobId} as applied: ${error}`);
    }
  }

  /**
   * Marks job as skipped in database
   */
  private async markJobAsSkipped(jobId: string, reason: string): Promise<void> {
    try {
      await this.jobRepository.update(jobId, {
        status: JobStatus.SKIPPED,
        errorMessage: reason,
      });
    } catch (error) {
      this.logger.error(`Error marking job ${jobId} as skipped: ${error}`);
    }
  }

  /**
   * Marks job as error in database
   */
  private async markJobAsError(
    jobId: string,
    errorMessage: string
  ): Promise<void> {
    try {
      await this.jobRepository.update(jobId, {
        status: JobStatus.ERROR,
        errorMessage,
      });
    } catch (error) {
      this.logger.error(`Error marking job ${jobId} as error: ${error}`);
    }
  }

  /**
   * Updates the application configuration for form filling
   */
  updateApplicationConfig(config: ApplicationConfig): void {
    this.formFiller.updateConfig(config);
    this.logger.debug('Application handler configuration updated');
  }

  /**
   * Updates the handler configuration
   */
  updateHandlerConfig(config: Partial<ApplicationHandlerConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('Application handler timing configuration updated');
  }

  /**
   * Gets application statistics
   */
  async getApplicationStats(): Promise<{
    total: number;
    applied: number;
    skipped: number;
    errors: number;
  }> {
    try {
      return await this.jobRepository.getApplicationStats();
    } catch (error) {
      this.logger.error(`Error getting application stats: ${error}`);
      return { total: 0, applied: 0, skipped: 0, errors: 0 };
    }
  }
}

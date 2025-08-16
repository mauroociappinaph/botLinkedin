import { Page } from 'puppeteer';
import { JobPosting } from '../types';
import { DelayUtils } from '../utils/DelayUtils';
import { Logger } from '../utils/Logger';
import { Failure, Result, Success } from '../utils/Result';
import { ApplicationHandlerConfig } from './ApplicationHandlerConfig';
import { FormFiller } from './FormFiller';
import { SelectorManager } from './SelectorManager';

export type StepResult = 'continue' | 'submit' | 'error';

export interface ApplicationStepResult {
  result: StepResult;
  fieldsFilledCount: number;
  unfilledFields: string[];
  currentStep: number;
}

/**
 * Handles individual application steps processing
 */
export class ApplicationStepProcessor {
  constructor(
    private formFiller: FormFiller,
    private selectorManager: SelectorManager,
    private logger: Logger,
    private config: ApplicationHandlerConfig
  ) {}

  /**
   * Processes a single application step
   */
  async processStep(
    page: Page,
    job: JobPosting,
    stepNumber: number
  ): Promise<Result<ApplicationStepResult, Error>> {
    try {
      this.logger.debug(
        `Processing application step ${stepNumber} for job ${job.id}`
      );

      // Check if we're on the final step (submit/review)
      if (await this.isOnFinalStep(page)) {
        return Success({
          result: 'submit',
          fieldsFilledCount: 0,
          unfilledFields: [],
          currentStep: stepNumber,
        });
      }

      // Fill form fields before checking for errors
      const fieldsFilledCount = await this.formFiller.fillApplicationForm(page);
      this.logger.debug(
        `Filled ${fieldsFilledCount} fields on step ${stepNumber}`
      );

      // Wait a bit after filling fields
      await DelayUtils.randomDelay(
        this.config.DELAYS.PAGE_LOAD.min,
        this.config.DELAYS.PAGE_LOAD.max
      );

      // Check for errors or required fields after filling
      if (await this.hasFormErrors(page)) {
        const unfilledFields = await this.formFiller.getUnfilledFields(page);
        this.logger.warn(
          `Form errors detected on step ${stepNumber} for job ${job.id} after filling ${fieldsFilledCount} fields`
        );

        if (unfilledFields.length > 0) {
          this.logger.warn(`Unfilled fields: ${unfilledFields.join(', ')}`);
        }

        return Success({
          result: 'error',
          fieldsFilledCount,
          unfilledFields,
          currentStep: stepNumber,
        });
      }

      // Try to proceed to next step
      if (!(await this.proceedToNextStep(page))) {
        this.logger.warn(`Cannot proceed to next step from step ${stepNumber}`);
        return Success({
          result: 'error',
          fieldsFilledCount,
          unfilledFields: [],
          currentStep: stepNumber,
        });
      }

      await DelayUtils.formFieldDelay();

      return Success({
        result: 'continue',
        fieldsFilledCount,
        unfilledFields: [],
        currentStep: stepNumber,
      });
    } catch (error) {
      this.logger.error(
        `Error processing application step ${stepNumber}: ${error}`
      );
      return Failure(error as Error);
    }
  }

  /**
   * Checks if we're on the final step (submit/review)
   */
  private async isOnFinalStep(page: Page): Promise<boolean> {
    const finalStepSelectors = [
      'button[aria-label="Submit application"]',
      'button[data-easy-apply-submit-button]',
      'button[aria-label="Review your application"]',
    ];

    const submitButton = await this.selectorManager.findWorkingSelector(
      page,
      finalStepSelectors
    );
    return submitButton !== null;
  }

  /**
   * Checks for form errors on the current step
   */
  private async hasFormErrors(page: Page): Promise<boolean> {
    const errorSelectors = [
      '.jobs-easy-apply-form-element__error-message',
      '.artdeco-inline-feedback--warning',
      '.jobs-easy-apply-form-element--error',
    ];

    const errorElement = await this.selectorManager.findWorkingSelector(
      page,
      errorSelectors
    );
    return errorElement !== null;
  }

  /**
   * Attempts to proceed to the next step
   */
  private async proceedToNextStep(page: Page): Promise<boolean> {
    const nextSelectors = [
      'button[aria-label="Continue to next step"]',
      'button[data-easy-apply-next-button]',
    ];

    const button = await this.selectorManager.findWorkingSelector(
      page,
      nextSelectors
    );
    if (!button) {
      return false;
    }

    try {
      await button.click();
      await DelayUtils.randomDelay(
        this.config.DELAYS.FORM_FIELD.min,
        this.config.DELAYS.FORM_FIELD.max
      );
      return true;
    } catch (error) {
      this.logger.debug(`Error clicking next step button: ${error}`);
      return false;
    }
  }
}

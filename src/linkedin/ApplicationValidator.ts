import { Page } from 'puppeteer';
import { Logger } from '../utils/Logger';
import { Failure, Result, Success } from '../utils/Result';
import { SelectorManager } from './SelectorManager';

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  skipReason?: string;
}

/**
 * Validates application prerequisites and conditions
 */
export class ApplicationValidator {
  constructor(
    private selectorManager: SelectorManager,
    private logger: Logger
  ) {}

  /**
   * Validates if a job can be applied to
   */
  async validateJobApplication(
    page: Page
  ): Promise<Result<ValidationResult, Error>> {
    try {
      // Check if already applied on LinkedIn
      const alreadyApplied = await this.isAlreadyAppliedOnLinkedIn(page);
      if (alreadyApplied) {
        return Success({
          isValid: false,
          skipReason: 'Already applied on LinkedIn',
        });
      }

      // Check if Easy Apply is available
      const hasEasyApply = await this.hasEasyApplyButton(page);
      if (!hasEasyApply) {
        return Success({
          isValid: false,
          skipReason: 'Easy Apply not available',
        });
      }

      return Success({
        isValid: true,
      });
    } catch (error) {
      this.logger.error(`Error validating job application: ${error}`);
      return Failure(error as Error);
    }
  }

  /**
   * Validates application modal state
   */
  async validateApplicationModal(
    page: Page
  ): Promise<Result<ValidationResult, Error>> {
    try {
      const modalSelectors = [
        '.jobs-easy-apply-modal',
        '.jobs-easy-apply-content',
        '.jobs-easy-apply-form-section__grouping',
      ];

      const modal = await this.selectorManager.findWorkingSelector(
        page,
        modalSelectors
      );
      if (!modal) {
        return Success({
          isValid: false,
          reason: 'Application modal not found',
        });
      }

      return Success({
        isValid: true,
      });
    } catch (error) {
      this.logger.error(`Error validating application modal: ${error}`);
      return Failure(error as Error);
    }
  }

  /**
   * Validates application submission success
   */
  async validateApplicationSuccess(
    page: Page
  ): Promise<Result<ValidationResult, Error>> {
    try {
      const successSelectors = [
        '.jobs-easy-apply-success-modal',
        '[data-test-modal-id="easy-apply-success-modal"]',
        '.artdeco-inline-feedback--success',
      ];

      const successElement = await this.selectorManager.findWorkingSelector(
        page,
        successSelectors
      );
      if (!successElement) {
        return Success({
          isValid: false,
          reason: 'Success confirmation not found',
        });
      }

      this.logger.debug('Application success confirmed');
      return Success({
        isValid: true,
      });
    } catch (error) {
      this.logger.error(`Error validating application success: ${error}`);
      return Failure(error as Error);
    }
  }

  /**
   * Checks if already applied on LinkedIn
   */
  private async isAlreadyAppliedOnLinkedIn(page: Page): Promise<boolean> {
    try {
      const alreadyAppliedSelectors = [
        '.jobs-details-top-card__apply-error',
        '[data-test-job-details-apply-state="APPLIED"]',
      ];

      const workingElement = await this.selectorManager.findWorkingSelector(
        page,
        alreadyAppliedSelectors
      );
      return workingElement !== null;
    } catch (error) {
      this.logger.debug(`Error checking applied status: ${error}`);
      return false;
    }
  }

  /**
   * Checks if Easy Apply button is available
   */
  private async hasEasyApplyButton(page: Page): Promise<boolean> {
    try {
      const easyApplySelectors = [
        '.jobs-apply-button--top-card',
        '.jobs-apply-button',
        '[data-control-name="jobdetails_topcard_inapply"]',
      ];

      const button = await this.selectorManager.findWorkingSelector(
        page,
        easyApplySelectors
      );
      return button !== null;
    } catch (error) {
      this.logger.debug(`Error checking Easy Apply button: ${error}`);
      return false;
    }
  }
}

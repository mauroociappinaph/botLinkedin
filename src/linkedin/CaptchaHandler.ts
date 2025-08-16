import { Page } from 'puppeteer';
import { DelayUtils } from '../utils/DelayUtils';
import { Logger } from '../utils/Logger';

/**
 * CAPTCHA detection and handling for LinkedIn automation
 * Handles various CAPTCHA types and provides manual intervention support
 */
export class CaptchaHandler {
  private static readonly CAPTCHA_SELECTORS = {
    // Common CAPTCHA container selectors
    CAPTCHA_CONTAINER: [
      '.captcha-container',
      '.challenge-container',
      '[data-test="captcha"]',
      '.recaptcha-container',
      '#captcha',
    ],

    // reCAPTCHA specific selectors
    RECAPTCHA_FRAME: 'iframe[src*="recaptcha"]',
    RECAPTCHA_CHECKBOX: '.recaptcha-checkbox',

    // LinkedIn specific challenge selectors
    LINKEDIN_CHALLENGE: [
      '.challenge-page',
      '.security-challenge-page',
      '[data-test="security-challenge"]',
    ],

    // Generic challenge indicators
    CHALLENGE_INDICATORS: [
      'h1:contains("Security Verification")',
      'h2:contains("Help us protect the LinkedIn community")',
      '.challenge-form',
      '[aria-label*="verification"]',
      '[aria-label*="captcha"]',
    ],
  } as const;

  private static readonly CAPTCHA_TIMEOUT_MS = 300000; // 5 minutes
  private static readonly CHECK_INTERVAL_MS = 2000; // 2 seconds

  constructor(
    private page: Page,
    private logger: Logger
  ) {}

  /**
   * Detects if a CAPTCHA or security challenge is present on the page
   */
  public async detectCaptcha(): Promise<boolean> {
    try {
      this.logger.info('Checking for CAPTCHA or security challenges...');

      // Check for CAPTCHA containers
      for (const selector of CaptchaHandler.CAPTCHA_SELECTORS
        .CAPTCHA_CONTAINER) {
        const element = await this.page.$(selector);
        if (element) {
          this.logger.warn(`CAPTCHA detected using selector: ${selector}`);
          return true;
        }
      }

      // Check for reCAPTCHA frames
      const recaptchaFrame = await this.page.$(
        CaptchaHandler.CAPTCHA_SELECTORS.RECAPTCHA_FRAME
      );
      if (recaptchaFrame) {
        this.logger.warn('reCAPTCHA frame detected');
        return true;
      }

      // Check for LinkedIn specific challenges
      for (const selector of CaptchaHandler.CAPTCHA_SELECTORS
        .LINKEDIN_CHALLENGE) {
        const element = await this.page.$(selector);
        if (element) {
          this.logger.warn(`LinkedIn security challenge detected: ${selector}`);
          return true;
        }
      }

      // Check for challenge indicators by text content
      const challengeText = await this.page.evaluate(() => {
        const indicators = [
          'Security Verification',
          'Help us protect the LinkedIn community',
          'Please complete this security check',
          "Verify you're human",
          'Are you a robot?',
        ];

        const bodyText = (
          globalThis as any
        ).document.body.innerText.toLowerCase();
        return indicators.some((indicator) =>
          bodyText.includes(indicator.toLowerCase())
        );
      });

      if (challengeText) {
        this.logger.warn('CAPTCHA detected by text content analysis');
        return true;
      }

      // Check URL for challenge patterns
      const currentUrl = this.page.url();
      const challengeUrlPatterns = [
        '/challenge',
        '/security',
        '/captcha',
        '/verification',
      ];

      const urlHasChallenge = challengeUrlPatterns.some((pattern) =>
        currentUrl.includes(pattern)
      );

      if (urlHasChallenge) {
        this.logger.warn(`CAPTCHA detected in URL: ${currentUrl}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Error detecting CAPTCHA:', error);
      return false;
    }
  }

  /**
   * Handles CAPTCHA by pausing execution and waiting for manual resolution
   */
  public async handleCaptcha(): Promise<boolean> {
    try {
      this.logger.warn(
        'CAPTCHA detected! Pausing automation for manual intervention.'
      );

      // Take screenshot for debugging
      await this.takeScreenshot('captcha-detected');

      // Display instructions to user
      this.displayCaptchaInstructions();

      // Wait for CAPTCHA resolution
      const resolved = await this.waitForCaptchaResolution();

      if (resolved) {
        this.logger.info(
          'CAPTCHA resolved successfully. Resuming automation...'
        );
        await DelayUtils.randomDelay(2000, 4000); // Brief pause before continuing
        return true;
      } else {
        this.logger.error('CAPTCHA resolution failed or timed out');
        return false;
      }
    } catch (error) {
      this.logger.error('Error handling CAPTCHA:', error);
      return false;
    }
  }

  /**
   * Waits for CAPTCHA to be resolved manually
   */
  private async waitForCaptchaResolution(): Promise<boolean> {
    const startTime = Date.now();
    const timeoutMs = CaptchaHandler.CAPTCHA_TIMEOUT_MS;

    this.logger.info(
      `Waiting for CAPTCHA resolution (timeout: ${timeoutMs / 1000}s)...`
    );

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Check if CAPTCHA is still present
        const captchaPresent = await this.detectCaptcha();

        if (!captchaPresent) {
          // CAPTCHA resolved, verify we're on a valid LinkedIn page
          const isValidPage = await this.verifyValidLinkedInPage();
          if (isValidPage) {
            return true;
          }
        }

        // Wait before next check
        await DelayUtils.sleep(CaptchaHandler.CHECK_INTERVAL_MS);

        // Log progress every 30 seconds
        const elapsed = Date.now() - startTime;
        if (elapsed % 30000 < CaptchaHandler.CHECK_INTERVAL_MS) {
          const remaining = Math.ceil((timeoutMs - elapsed) / 1000);
          this.logger.info(
            `Still waiting for CAPTCHA resolution... (${remaining}s remaining)`
          );
        }
      } catch (error) {
        this.logger.error('Error while waiting for CAPTCHA resolution:', error);
        await DelayUtils.sleep(CaptchaHandler.CHECK_INTERVAL_MS);
      }
    }

    return false; // Timeout reached
  }

  /**
   * Verifies that we're on a valid LinkedIn page after CAPTCHA resolution
   */
  private async verifyValidLinkedInPage(): Promise<boolean> {
    try {
      const currentUrl = this.page.url();

      // Check if we're still on LinkedIn
      if (!currentUrl.includes('linkedin.com')) {
        this.logger.warn('Not on LinkedIn domain after CAPTCHA resolution');
        return false;
      }

      // Check for LinkedIn navigation elements
      const linkedinElements = [
        'nav[aria-label="Primary Navigation"]',
        '.global-nav',
        '[data-test="nav-logo"]',
        '.linkedin-logo',
      ];

      for (const selector of linkedinElements) {
        const element = await this.page.$(selector);
        if (element) {
          return true;
        }
      }

      // If no navigation found, check for job-related content
      const jobElements = [
        '.jobs-search',
        '.job-details',
        '.jobs-apply-button',
      ];

      for (const selector of jobElements) {
        const element = await this.page.$(selector);
        if (element) {
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error('Error verifying LinkedIn page:', error);
      return false;
    }
  }

  /**
   * Takes a screenshot for debugging purposes
   */
  private async takeScreenshot(filename: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = `screenshots/${filename}-${timestamp}.png`;

      await this.page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });

      this.logger.info(`Screenshot saved: ${screenshotPath}`);
    } catch (error) {
      this.logger.error('Failed to take screenshot:', error);
    }
  }

  /**
   * Displays instructions to the user for manual CAPTCHA resolution
   */
  private displayCaptchaInstructions(): void {
    const instructions = [
      '',
      '🤖 CAPTCHA DETECTED - MANUAL INTERVENTION REQUIRED',
      '='.repeat(60),
      '',
      '📋 INSTRUCTIONS:',
      '1. Switch to the browser window that opened',
      '2. Complete the CAPTCHA or security challenge',
      '3. Wait for the page to load completely',
      '4. Do NOT close the browser window',
      '5. The bot will automatically resume once resolved',
      '',
      '⏱️  TIMEOUT: 5 minutes',
      '🔄 The bot checks every 2 seconds for resolution',
      '',
      '❌ If you need to stop the bot, press Ctrl+C',
      '',
      '='.repeat(60),
    ];

    // Log to console and file
    instructions.forEach((line) => {
      if (line.startsWith('🤖') || line.startsWith('=')) {
        this.logger.warn(line);
      } else {
        this.logger.info(line);
      }
    });

    // Also log to console directly for immediate visibility
    console.log('\n' + instructions.join('\n') + '\n');
  }

  /**
   * Handles CAPTCHA timeout scenarios
   */
  public async handleCaptchaTimeout(): Promise<void> {
    this.logger.error('CAPTCHA resolution timed out after 5 minutes');

    await this.takeScreenshot('captcha-timeout');

    const timeoutMessage = [
      '',
      '⏰ CAPTCHA TIMEOUT',
      '='.repeat(40),
      '',
      'The CAPTCHA was not resolved within the 5-minute timeout.',
      'The bot will skip this job and continue with the next one.',
      '',
      'If this happens frequently, consider:',
      '• Using a different LinkedIn account',
      "• Reducing the bot's activity rate",
      '• Running the bot during off-peak hours',
      '',
      '='.repeat(40),
    ];

    timeoutMessage.forEach((line) => this.logger.warn(line));
  }

  /**
   * Handles CAPTCHA failure scenarios
   */
  public async handleCaptchaFailure(error: Error): Promise<void> {
    this.logger.error('CAPTCHA handling failed:', error);

    await this.takeScreenshot('captcha-failure');

    const failureMessage = [
      '',
      '❌ CAPTCHA HANDLING FAILED',
      '='.repeat(40),
      '',
      `Error: ${error.message}`,
      '',
      'The bot will skip this job and continue with the next one.',
      'If this error persists, please check the logs and screenshots.',
      '',
      '='.repeat(40),
    ];

    failureMessage.forEach((line) => this.logger.error(line));
  }
}

import { Page } from 'puppeteer';
import { DelayUtils } from '../utils/DelayUtils';
import { Logger } from '../utils/Logger';

/**
 * Configuration interface for CAPTCHA handler timeouts and intervals
 */
interface CaptchaConfig {
  readonly timeoutMs: number;
  readonly checkIntervalMs: number;
  readonly progressLogIntervalMs: number;
}

/**
 * Detection result interface for better type safety
 */
interface DetectionResult {
  readonly detected: boolean;
  readonly method?: string;
  readonly selector?: string;
}

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

  private static readonly DEFAULT_CONFIG: CaptchaConfig = {
    timeoutMs: 300000, // 5 minutes
    checkIntervalMs: 2000, // 2 seconds
    progressLogIntervalMs: 30000, // 30 seconds
  } as const;

  private static readonly CHALLENGE_TEXT_INDICATORS = [
    'Security Verification',
    'Help us protect the LinkedIn community',
    'Please complete this security check',
    "Verify you're human",
    'Are you a robot?',
  ] as const;

  private static readonly CHALLENGE_URL_PATTERNS = [
    '/challenge',
    '/security',
    '/captcha',
    '/verification',
  ] as const;

  private readonly config: CaptchaConfig;

  constructor(
    private page: Page,
    private logger: Logger,
    config?: Partial<CaptchaConfig>
  ) {
    this.config = { ...CaptchaHandler.DEFAULT_CONFIG, ...config };
  }

  /**
   * Detects if a CAPTCHA or security challenge is present on the page
   */
  public async detectCaptcha(): Promise<boolean> {
    try {
      this.logger.info('Checking for CAPTCHA or security challenges...');

      const detectionMethods: Array<() => Promise<DetectionResult>> = [
        (): Promise<DetectionResult> => this.detectCaptchaContainers(),
        (): Promise<DetectionResult> => this.detectRecaptchaFrames(),
        (): Promise<DetectionResult> => this.detectLinkedInChallenges(),
        (): Promise<DetectionResult> => this.detectChallengeByTextContent(),
        (): Promise<DetectionResult> => this.detectChallengeByUrl(),
      ];

      for (const method of detectionMethods) {
        const result = await method();
        if (result.detected) {
          this.logger.warn(
            `CAPTCHA detected: ${result.method}${result.selector ? ` (${result.selector})` : ''}`
          );
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error('Error detecting CAPTCHA:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  }

  /**
   * Detects CAPTCHA containers using common selectors
   */
  private async detectCaptchaContainers(): Promise<DetectionResult> {
    for (const selector of CaptchaHandler.CAPTCHA_SELECTORS.CAPTCHA_CONTAINER) {
      const element = await this.page.$(selector);
      if (element) {
        return { detected: true, method: 'CAPTCHA container', selector };
      }
    }
    return { detected: false };
  }

  /**
   * Detects reCAPTCHA frames
   */
  private async detectRecaptchaFrames(): Promise<DetectionResult> {
    const recaptchaFrame = await this.page.$(
      CaptchaHandler.CAPTCHA_SELECTORS.RECAPTCHA_FRAME
    );
    if (recaptchaFrame) {
      return {
        detected: true,
        method: 'reCAPTCHA frame',
        selector: CaptchaHandler.CAPTCHA_SELECTORS.RECAPTCHA_FRAME,
      };
    }
    return { detected: false };
  }

  /**
   * Detects LinkedIn specific security challenges
   */
  private async detectLinkedInChallenges(): Promise<DetectionResult> {
    for (const selector of CaptchaHandler.CAPTCHA_SELECTORS
      .LINKEDIN_CHALLENGE) {
      const element = await this.page.$(selector);
      if (element) {
        return {
          detected: true,
          method: 'LinkedIn security challenge',
          selector,
        };
      }
    }
    return { detected: false };
  }

  /**
   * Detects challenges by analyzing page text content
   */
  private async detectChallengeByTextContent(): Promise<DetectionResult> {
    const challengeText = await this.checkChallengeTextIndicators();
    if (challengeText) {
      return { detected: true, method: 'text content analysis' };
    }
    return { detected: false };
  }

  /**
   * Detects challenges by analyzing the current URL
   */
  private async detectChallengeByUrl(): Promise<DetectionResult> {
    const currentUrl = this.page.url();
    const urlHasChallenge = CaptchaHandler.CHALLENGE_URL_PATTERNS.some(
      (pattern) => currentUrl.includes(pattern)
    );

    if (urlHasChallenge) {
      return {
        detected: true,
        method: 'URL pattern analysis',
        selector: currentUrl,
      };
    }
    return { detected: false };
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
      this.logger.error('Error handling CAPTCHA:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  }

  /**
   * Waits for CAPTCHA to be resolved manually
   */
  private async waitForCaptchaResolution(): Promise<boolean> {
    const startTime = Date.now();
    const { timeoutMs, checkIntervalMs, progressLogIntervalMs } = this.config;

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
        await DelayUtils.sleep(checkIntervalMs);

        // Log progress periodically
        const elapsed = Date.now() - startTime;
        if (elapsed % progressLogIntervalMs < checkIntervalMs) {
          const remaining = Math.ceil((timeoutMs - elapsed) / 1000);
          this.logger.info(
            `Still waiting for CAPTCHA resolution... (${remaining}s remaining)`
          );
        }
      } catch (error) {
        this.logger.error('Error while waiting for CAPTCHA resolution:', {
          error: error instanceof Error ? error.message : String(error),
        });
        await DelayUtils.sleep(checkIntervalMs);
      }
    }

    return false; // Timeout reached
  }

  /**
   * Checks for challenge text indicators in the page content
   */
  private async checkChallengeTextIndicators(): Promise<boolean> {
    return this.page.evaluate((indicators: readonly string[]) => {
      // eslint-disable-next-line no-undef
      const bodyText = (document.body?.innerText?.toLowerCase() ||
        '') as string;
      return indicators.some((indicator: string) =>
        bodyText.includes(indicator.toLowerCase())
      );
    }, CaptchaHandler.CHALLENGE_TEXT_INDICATORS);
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

      // Use a more comprehensive verification approach
      const verificationMethods: Array<() => Promise<boolean>> = [
        (): Promise<boolean> => this.checkLinkedInNavigationElements(),
        (): Promise<boolean> => this.checkJobRelatedElements(),
        (): Promise<boolean> => this.checkLinkedInBrandingElements(),
      ];

      for (const method of verificationMethods) {
        const isValid = await method();
        if (isValid) {
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error('Error verifying LinkedIn page:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Checks for LinkedIn navigation elements
   */
  private async checkLinkedInNavigationElements(): Promise<boolean> {
    const navigationSelectors = [
      'nav[aria-label="Primary Navigation"]',
      '.global-nav',
      '[data-test="nav-logo"]',
      '.linkedin-logo',
    ];

    return this.checkAnyElementExists(navigationSelectors);
  }

  /**
   * Checks for job-related elements
   */
  private async checkJobRelatedElements(): Promise<boolean> {
    const jobSelectors = ['.jobs-search', '.job-details', '.jobs-apply-button'];

    return this.checkAnyElementExists(jobSelectors);
  }

  /**
   * Checks for LinkedIn branding elements
   */
  private async checkLinkedInBrandingElements(): Promise<boolean> {
    const brandingSelectors = [
      '[alt*="LinkedIn"]',
      '.li-logo',
      '[data-tracking-control-name*="linkedin"]',
    ];

    return this.checkAnyElementExists(brandingSelectors);
  }

  /**
   * Helper method to check if any element from a list exists
   */
  private async checkAnyElementExists(selectors: string[]): Promise<boolean> {
    for (const selector of selectors) {
      const element = await this.page.$(selector);
      if (element) {
        return true;
      }
    }
    return false;
  }

  /**
   * Takes a screenshot for debugging purposes
   */
  private async takeScreenshot(filename: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath =
        `screenshots/${filename}-${timestamp}.png` as const;

      await this.page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });

      this.logger.info(`Screenshot saved: ${screenshotPath}`);
    } catch (error) {
      this.logger.error('Failed to take screenshot:', {
        error: error instanceof Error ? error.message : String(error),
        filename,
      });
    }
  }

  /**
   * Displays instructions to the user for manual CAPTCHA resolution
   */
  private displayCaptchaInstructions(): void {
    const timeoutMinutes = Math.ceil(this.config.timeoutMs / 60000);
    const checkIntervalSeconds = this.config.checkIntervalMs / 1000;

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
      `⏱️  TIMEOUT: ${timeoutMinutes} minutes`,
      `🔄 The bot checks every ${checkIntervalSeconds} seconds for resolution`,
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
    // eslint-disable-next-line no-console
    console.log('\n' + instructions.join('\n') + '\n');
  }

  /**
   * Handles CAPTCHA timeout scenarios
   */
  public async handleCaptchaTimeout(): Promise<void> {
    const timeoutMinutes = Math.ceil(this.config.timeoutMs / 60000);
    this.logger.error(
      `CAPTCHA resolution timed out after ${timeoutMinutes} minutes`
    );

    await this.takeScreenshot('captcha-timeout');

    const timeoutMessage = [
      '',
      '⏰ CAPTCHA TIMEOUT',
      '='.repeat(40),
      '',
      `The CAPTCHA was not resolved within the ${timeoutMinutes}-minute timeout.`,
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
    this.logger.error('CAPTCHA handling failed:', {
      error: error.message,
      stack: error.stack,
    });

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

import { Page } from 'puppeteer';
import { ErrorCategory, ErrorSeverity, LinkedInBotError } from './ErrorHandler';
import { Logger } from './Logger';

/**
 * LinkedIn-specific error detection and handling
 * Detects rate limiting, bot detection, and other LinkedIn-specific issues
 */
export class LinkedInErrorDetector {
  private static readonly DETECTION_INDICATORS = {
    // Rate limiting indicators
    RATE_LIMIT_SELECTORS: [
      '.rate-limit-message',
      '.too-many-requests',
      '[data-test="rate-limit"]',
    ],

    RATE_LIMIT_TEXT: [
      'too many requests',
      'rate limit exceeded',
      'please try again later',
      "you've reached the limit",
      'slow down',
    ],

    // Bot detection indicators
    BOT_DETECTION_SELECTORS: [
      '.bot-detection',
      '.automated-behavior',
      '[data-test="bot-challenge"]',
    ],

    BOT_DETECTION_TEXT: [
      'automated behavior detected',
      'suspicious activity',
      'unusual activity',
      'account restricted',
      'temporarily restricted',
    ],

    // Account suspension indicators
    SUSPENSION_SELECTORS: [
      '.account-suspended',
      '.account-restricted',
      '[data-test="suspension"]',
    ],

    SUSPENSION_TEXT: [
      'account has been suspended',
      'account restricted',
      'violation of terms',
      'temporarily suspended',
    ],

    // LinkedIn error pages
    ERROR_PAGE_INDICATORS: [
      'linkedin.com/error',
      'something went wrong',
      'page not found',
      'access denied',
    ],
  } as const;

  constructor(
    private page: Page,
    private logger: Logger
  ) {}

  /**
   * Detects various LinkedIn-specific errors and issues
   */
  public async detectLinkedInErrors(): Promise<LinkedInBotError | null> {
    try {
      // Check for rate limiting
      const rateLimitError = await this.detectRateLimit();
      if (rateLimitError) return rateLimitError;

      // Check for bot detection
      const botDetectionError = await this.detectBotDetection();
      if (botDetectionError) return botDetectionError;

      // Check for account suspension
      const suspensionError = await this.detectAccountSuspension();
      if (suspensionError) return suspensionError;

      // Check for general LinkedIn errors
      const generalError = await this.detectGeneralErrors();
      if (generalError) return generalError;

      return null;
    } catch (error) {
      this.logger.error('Error during LinkedIn error detection:', error);
      return null;
    }
  }

  /**
   * Detects rate limiting from LinkedIn
   */
  private async detectRateLimit(): Promise<LinkedInBotError | null> {
    // Check for rate limit selectors
    for (const selector of LinkedInErrorDetector.DETECTION_INDICATORS
      .RATE_LIMIT_SELECTORS) {
      const element = await this.page.$(selector);
      if (element) {
        return new LinkedInBotError(
          'LinkedIn rate limit detected via selector',
          {
            category: ErrorCategory.DETECTION,
            severity: ErrorSeverity.HIGH,
            url: this.page.url(),
            selector,
            additionalData: { detectionMethod: 'selector' },
          }
        );
      }
    }

    // Check for rate limit text content
    const pageText = await this.page.evaluate(() =>
      (globalThis as any).document.body.innerText.toLowerCase()
    );

    for (const text of LinkedInErrorDetector.DETECTION_INDICATORS
      .RATE_LIMIT_TEXT) {
      if (pageText.includes(text)) {
        return new LinkedInBotError(`LinkedIn rate limit detected: "${text}"`, {
          category: ErrorCategory.DETECTION,
          severity: ErrorSeverity.HIGH,
          url: this.page.url(),
          additionalData: {
            detectionMethod: 'text',
            matchedText: text,
          },
        });
      }
    }

    // Check HTTP status codes that might indicate rate limiting
    const response =
      this.page.mainFrame().childFrames().length > 0
        ? null
        : await this.page.goto(this.page.url(), {
            waitUntil: 'domcontentloaded',
          });

    if (response && (response.status() === 429 || response.status() === 503)) {
      return new LinkedInBotError(
        `LinkedIn rate limit detected via HTTP status: ${response.status()}`,
        {
          category: ErrorCategory.DETECTION,
          severity: ErrorSeverity.HIGH,
          url: this.page.url(),
          additionalData: {
            detectionMethod: 'http_status',
            statusCode: response.status(),
          },
        }
      );
    }

    return null;
  }

  /**
   * Detects bot detection mechanisms
   */
  private async detectBotDetection(): Promise<LinkedInBotError | null> {
    // Check for bot detection selectors
    for (const selector of LinkedInErrorDetector.DETECTION_INDICATORS
      .BOT_DETECTION_SELECTORS) {
      const element = await this.page.$(selector);
      if (element) {
        return new LinkedInBotError(
          'LinkedIn bot detection triggered via selector',
          {
            category: ErrorCategory.DETECTION,
            severity: ErrorSeverity.HIGH,
            url: this.page.url(),
            selector,
            additionalData: { detectionMethod: 'selector' },
          }
        );
      }
    }

    // Check for bot detection text
    const pageText = await this.page.evaluate(() =>
      (globalThis as any).document.body.innerText.toLowerCase()
    );

    for (const text of LinkedInErrorDetector.DETECTION_INDICATORS
      .BOT_DETECTION_TEXT) {
      if (pageText.includes(text)) {
        return new LinkedInBotError(
          `LinkedIn bot detection triggered: "${text}"`,
          {
            category: ErrorCategory.DETECTION,
            severity: ErrorSeverity.HIGH,
            url: this.page.url(),
            additionalData: {
              detectionMethod: 'text',
              matchedText: text,
            },
          }
        );
      }
    }

    return null;
  }

  /**
   * Detects account suspension or restriction
   */
  private async detectAccountSuspension(): Promise<LinkedInBotError | null> {
    // Check for suspension selectors
    for (const selector of LinkedInErrorDetector.DETECTION_INDICATORS
      .SUSPENSION_SELECTORS) {
      const element = await this.page.$(selector);
      if (element) {
        return new LinkedInBotError(
          'LinkedIn account suspension detected via selector',
          {
            category: ErrorCategory.AUTHENTICATION,
            severity: ErrorSeverity.FATAL,
            url: this.page.url(),
            selector,
            additionalData: { detectionMethod: 'selector' },
          }
        );
      }
    }

    // Check for suspension text
    const pageText = await this.page.evaluate(() =>
      (globalThis as any).document.body.innerText.toLowerCase()
    );

    for (const text of LinkedInErrorDetector.DETECTION_INDICATORS
      .SUSPENSION_TEXT) {
      if (pageText.includes(text)) {
        return new LinkedInBotError(
          `LinkedIn account suspension detected: "${text}"`,
          {
            category: ErrorCategory.AUTHENTICATION,
            severity: ErrorSeverity.FATAL,
            url: this.page.url(),
            additionalData: {
              detectionMethod: 'text',
              matchedText: text,
            },
          }
        );
      }
    }

    return null;
  }

  /**
   * Detects general LinkedIn errors
   */
  private async detectGeneralErrors(): Promise<LinkedInBotError | null> {
    const currentUrl = this.page.url();

    // Check for error page URLs
    for (const indicator of LinkedInErrorDetector.DETECTION_INDICATORS
      .ERROR_PAGE_INDICATORS) {
      if (currentUrl.includes(indicator)) {
        return new LinkedInBotError(
          `LinkedIn error page detected: ${indicator}`,
          {
            category: ErrorCategory.UNKNOWN,
            severity: ErrorSeverity.MEDIUM,
            url: currentUrl,
            additionalData: {
              detectionMethod: 'url',
              matchedIndicator: indicator,
            },
          }
        );
      }
    }

    // Check for 404 or other error status codes
    const title = await this.page.title();
    if (
      title.toLowerCase().includes('not found') ||
      title.toLowerCase().includes('error') ||
      title.toLowerCase().includes('access denied')
    ) {
      return new LinkedInBotError(
        `LinkedIn error detected in page title: ${title}`,
        {
          category: ErrorCategory.UNKNOWN,
          severity: ErrorSeverity.MEDIUM,
          url: currentUrl,
          additionalData: {
            detectionMethod: 'title',
            pageTitle: title,
          },
        }
      );
    }

    return null;
  }

  /**
   * Monitors for LinkedIn errors during navigation
   */
  public async monitorForErrors(
    timeoutMs: number = 5000
  ): Promise<LinkedInBotError | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const error = await this.detectLinkedInErrors();
      if (error) {
        return error;
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return null;
  }

  /**
   * Checks if the current page indicates a successful LinkedIn session
   */
  public async verifyLinkedInSession(): Promise<boolean> {
    try {
      // Check for LinkedIn navigation elements
      const navSelectors = [
        'nav[aria-label="Primary Navigation"]',
        '.global-nav',
        '[data-test="nav-logo"]',
        '.linkedin-logo',
      ];

      for (const selector of navSelectors) {
        const element = await this.page.$(selector);
        if (element) {
          return true;
        }
      }

      // Check if we're on a LinkedIn domain
      const url = this.page.url();
      if (!url.includes('linkedin.com')) {
        return false;
      }

      // Check for login page (indicates session expired)
      const loginIndicators = [
        'input[name="session_key"]',
        'input[name="session_password"]',
        '.login-form',
      ];

      for (const selector of loginIndicators) {
        const element = await this.page.$(selector);
        if (element) {
          return false; // On login page, session not valid
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Error verifying LinkedIn session:', error);
      return false;
    }
  }

  /**
   * Gets recovery suggestions based on detected error type
   */
  public getRecoverySuggestions(error: LinkedInBotError): string[] {
    const suggestions: string[] = [];

    switch (error.context.category) {
      case ErrorCategory.DETECTION:
        suggestions.push(
          'Reduce bot activity rate and increase delays between actions',
          'Use different browser profiles or user agents',
          'Run the bot during off-peak hours',
          'Consider using residential proxies',
          'Take a break and resume later'
        );
        break;

      case ErrorCategory.AUTHENTICATION:
        suggestions.push(
          'Check LinkedIn credentials are still valid',
          'Manually log in to LinkedIn to verify account status',
          'Clear browser cookies and cache',
          'Use a different LinkedIn account if available',
          'Contact LinkedIn support if account is suspended'
        );
        break;

      case ErrorCategory.NETWORK:
        suggestions.push(
          'Check internet connection stability',
          'Try using a VPN or different network',
          'Increase timeout values in configuration',
          'Retry the operation after a delay'
        );
        break;

      default:
        suggestions.push(
          'Check the logs for more detailed error information',
          'Verify LinkedIn website is accessible manually',
          'Update the bot to the latest version',
          'Report the issue if it persists'
        );
    }

    return suggestions;
  }
}

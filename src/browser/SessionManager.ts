import { promises as fs } from 'fs';
import { Page } from 'puppeteer';
import { BotConfig, BrowserSession } from '../types';
import { DelayUtils } from '../utils/DelayUtils';
import { Logger } from '../utils/Logger';

/**
 * Centralized selectors for LinkedIn elements
 */
const SELECTORS = {
  LOGIN_FORM: {
    USERNAME: '#username',
    PASSWORD: '#password',
    SUBMIT_BUTTON: 'button[type="submit"]',
  },
  LOGIN_INDICATORS: [
    'nav[aria-label="Primary Navigation"]',
    '.global-nav__me',
    '.feed-identity-module',
    '[data-test-global-nav-me]',
  ],
  CAPTCHA_INDICATORS: [
    '.recaptcha-checkbox',
    '#captcha-internal',
    '.captcha-container',
    '[data-test-id="captcha"]',
    'iframe[src*="recaptcha"]',
  ],
  TWO_FACTOR_INDICATORS: [
    '#two-step-challenge',
    '.two-step-verification',
    '[data-test-id="two-factor"]',
    'input[name="pin"]',
  ],
  ERROR_INDICATORS: [
    '.alert--error',
    '.form__input--error',
    '.login-form__error-message',
    '[data-test-id="error-message"]',
  ],
} as const;

/**
 * Timeout constants
 */
const TIMEOUTS = {
  ELEMENT_WAIT: 10000,
  SELECTOR_CHECK: 2000,
  CAPTCHA_CHECK: 1000,
  POST_LOGIN_WAIT: 3000,
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  MIN_DELAY: 100,
  MAX_DELAY: 300,
  TYPING_DELAY: 200,
  FORM_DELAY: 500,
  LOGIN_DELAY: 2000,
  PROCESS_DELAY: 4000,
} as const;

/**
 * Manages LinkedIn session authentication, persistence, and recovery
 * Implements Requirements 10.1, 10.3, and 10.4
 */
export class SessionManager {
  private page: Page | null = null;
  private readonly config: BotConfig['linkedin'];
  private readonly delayConfig: BotConfig['delays'];
  private readonly logger: Logger;
  private sessionData: BrowserSession | null = null;
  private readonly cookiesPath: string;
  private sessionTimeout: number = TIMEOUTS.SESSION_TIMEOUT;

  private isAuthenticating: boolean = false;

  constructor(
    config: BotConfig['linkedin'],
    delayConfig: BotConfig['delays'],
    logger: Logger,
    cookiesPath: string = './cookies.json'
  ) {
    this.config = config;
    this.delayConfig = delayConfig;
    this.logger = logger;
    this.cookiesPath = cookiesPath;
  }

  /**
   * Sets the page instance for session management
   * @param page Puppeteer page instance
   */
  public setPage(page: Page): void {
    if (!page) {
      throw new Error('Page instance is required');
    }
    this.page = page;
  }

  /**
   * Asserts that page is available and throws if not
   */
  private assertPageExists(): void {
    if (!this.page) {
      throw new Error('Page not initialized. Call setPage() first.');
    }
  }

  /**
   * Attempts to login to LinkedIn with configured credentials
   * @returns Promise that resolves to true if login successful
   */
  public async login(): Promise<boolean> {
    this.assertPageExists();

    if (this.isAuthenticating) {
      this.logger.warn('Authentication already in progress');
      return false;
    }

    this.isAuthenticating = true;

    try {
      this.logger.info('Starting LinkedIn login process');

      // Try to restore existing session first
      const sessionRestored = await this.restoreSession();
      if (sessionRestored) {
        this.logger.info('Session restored successfully');
        this.isAuthenticating = false;
        return true;
      }

      // Navigate to LinkedIn login page
      if (!this.page) {
        throw new Error('Page not initialized');
      }

      await this.page.goto('https://www.linkedin.com/login', {
        waitUntil: 'networkidle2',
      });

      await DelayUtils.randomDelay(
        this.delayConfig.minPageLoad,
        this.delayConfig.maxPageLoad
      );

      // Check if already logged in
      if (await this.isLoggedIn()) {
        this.logger.info('Already logged in to LinkedIn');
        await this.saveSession();
        this.isAuthenticating = false;
        return true;
      }

      // Perform login
      const loginSuccess = await this.performLogin();

      if (loginSuccess) {
        await this.saveSession();
        this.logger.info('LinkedIn login successful');
      } else {
        this.logger.error('LinkedIn login failed');
      }

      this.isAuthenticating = false;
      return loginSuccess;
    } catch (error) {
      this.isAuthenticating = false;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Login failed: ${errorMessage}`);
      throw new Error(`LinkedIn login failed: ${errorMessage}`);
    }
  }

  /**
   * Performs the actual login process with credentials
   * @returns Promise that resolves to true if login successful
   */
  private async performLogin(): Promise<boolean> {
    if (!this.page) return false;

    try {
      await this.waitForLoginForm();
      await this.fillLoginCredentials();
      await this.submitLoginForm();
      await DelayUtils.randomDelay(
        TIMEOUTS.LOGIN_DELAY,
        TIMEOUTS.PROCESS_DELAY
      );

      return await this.handlePostLoginScenarios();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Login process failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Waits for login form elements to be available
   */
  private async waitForLoginForm(): Promise<void> {
    this.assertPageExists();

    await this.page!.waitForSelector(SELECTORS.LOGIN_FORM.USERNAME, {
      timeout: TIMEOUTS.ELEMENT_WAIT,
    });
    await this.page!.waitForSelector(SELECTORS.LOGIN_FORM.PASSWORD, {
      timeout: TIMEOUTS.ELEMENT_WAIT,
    });
  }

  /**
   * Fills login form with credentials using human-like typing
   */
  private async fillLoginCredentials(): Promise<void> {
    this.assertPageExists();

    // Fill username
    await this.page!.click(SELECTORS.LOGIN_FORM.USERNAME, { clickCount: 3 });
    await DelayUtils.randomDelay(TIMEOUTS.MIN_DELAY, TIMEOUTS.MAX_DELAY);

    await this.page!.type(SELECTORS.LOGIN_FORM.USERNAME, this.config.email, {
      delay: DelayUtils.getRandomTypingDelay(
        this.delayConfig.minTyping,
        this.delayConfig.maxTyping
      ),
    });

    await DelayUtils.randomDelay(TIMEOUTS.TYPING_DELAY, TIMEOUTS.FORM_DELAY);

    // Fill password
    await this.page!.click(SELECTORS.LOGIN_FORM.PASSWORD, { clickCount: 3 });
    await DelayUtils.randomDelay(TIMEOUTS.MIN_DELAY, TIMEOUTS.MAX_DELAY);

    await this.page!.type(SELECTORS.LOGIN_FORM.PASSWORD, this.config.password, {
      delay: DelayUtils.getRandomTypingDelay(
        this.delayConfig.minTyping,
        this.delayConfig.maxTyping
      ),
    });

    await DelayUtils.randomDelay(TIMEOUTS.FORM_DELAY, TIMEOUTS.FORM_DELAY * 2);
  }

  /**
   * Submits the login form
   */
  private async submitLoginForm(): Promise<void> {
    this.assertPageExists();

    const loginButton = await this.page!.$(SELECTORS.LOGIN_FORM.SUBMIT_BUTTON);
    if (!loginButton) {
      throw new Error('Login button not found');
    }

    await loginButton.click();
  }

  /**
   * Handles various scenarios that can occur after login attempt
   * @returns Promise that resolves to true if login was successful
   */
  private async handlePostLoginScenarios(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Wait a bit for page to load
      await DelayUtils.randomDelay(
        TIMEOUTS.POST_LOGIN_WAIT,
        TIMEOUTS.POST_LOGIN_WAIT + 2000
      );

      // Check if we're now logged in
      if (await this.isLoggedIn()) {
        return true;
      }

      // Check for CAPTCHA
      const captchaDetected = await this.detectCaptcha();
      if (captchaDetected) {
        this.logger.warn('CAPTCHA detected during login');
        await this.handleCaptchaIntervention();

        // After manual intervention, check if logged in
        return await this.isLoggedIn();
      }

      // Check for two-factor authentication
      const twoFactorDetected = await this.detectTwoFactor();
      if (twoFactorDetected) {
        this.logger.warn('Two-factor authentication required');
        await this.handleTwoFactorIntervention();

        // After manual intervention, check if logged in
        return await this.isLoggedIn();
      }

      // Check for login errors
      const errorMessage = await this.getLoginError();
      if (errorMessage) {
        this.logger.error(`Login error: ${errorMessage}`);
        return false;
      }

      // If we reach here, login likely failed for unknown reason
      this.logger.error('Login failed for unknown reason');
      return false;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Post-login handling failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Checks if currently logged in to LinkedIn
   * @returns Promise that resolves to true if logged in
   */
  public async isLoggedIn(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Check for LinkedIn feed or profile elements that indicate logged-in state
      const loggedInSelectors = SELECTORS.LOGIN_INDICATORS;

      for (const selector of loggedInSelectors) {
        try {
          await this.page.waitForSelector(selector, {
            timeout: TIMEOUTS.SELECTOR_CHECK,
          });
          this.updateSessionData(true);
          return true;
        } catch {
          // Continue to next selector
        }
      }

      // Check current URL for logged-in patterns
      const currentUrl = this.page.url();
      const loggedInUrls = [
        'linkedin.com/feed',
        'linkedin.com/in/',
        'linkedin.com/jobs',
        'linkedin.com/mynetwork',
      ];

      const isLoggedInUrl = loggedInUrls.some((url) =>
        currentUrl.includes(url)
      );
      if (isLoggedInUrl) {
        this.updateSessionData(true);
        return true;
      }

      this.updateSessionData(false);
      return false;
    } catch (error) {
      this.logger.error(`Error checking login status: ${error}`);
      this.updateSessionData(false);
      return false;
    }
  }

  /**
   * Detects if CAPTCHA is present on the page
   * @returns Promise that resolves to true if CAPTCHA detected
   */
  private async detectCaptcha(): Promise<boolean> {
    if (!this.page) return false;

    const captchaSelectors = SELECTORS.CAPTCHA_INDICATORS;

    for (const selector of captchaSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 1000 });
        return true;
      } catch {
        // Continue checking other selectors
      }
    }

    return false;
  }

  /**
   * Detects if two-factor authentication is required
   * @returns Promise that resolves to true if 2FA detected
   */
  private async detectTwoFactor(): Promise<boolean> {
    if (!this.page) return false;

    const twoFactorSelectors = SELECTORS.TWO_FACTOR_INDICATORS;

    for (const selector of twoFactorSelectors) {
      try {
        await this.page.waitForSelector(selector, {
          timeout: TIMEOUTS.CAPTCHA_CHECK,
        });
        return true;
      } catch {
        // Continue checking other selectors
      }
    }

    return false;
  }

  /**
   * Gets login error message if present
   * @returns Promise that resolves to error message or null
   */
  private async getLoginError(): Promise<string | null> {
    if (!this.page) return null;

    const errorSelectors = SELECTORS.ERROR_INDICATORS;

    for (const selector of errorSelectors) {
      try {
        const errorElement = await this.page.$(selector);
        if (errorElement) {
          const errorText = await this.page.evaluate(
            (el) => el.textContent,
            errorElement
          );
          return errorText?.trim() || null;
        }
      } catch {
        // Continue checking other selectors
      }
    }

    return null;
  }

  /**
   * Handles CAPTCHA intervention by pausing and waiting for manual resolution
   */
  private async handleCaptchaIntervention(): Promise<void> {
    this.logger.warn('CAPTCHA detected - Manual intervention required');
    this.logger.info('🤖 CAPTCHA CHALLENGE DETECTED 🤖');
    this.logger.info(
      'Please solve the CAPTCHA manually in the browser window.'
    );
    this.logger.info('The bot will wait for you to complete it...');
    this.logger.info(
      'Press Enter when you have solved the CAPTCHA to continue.'
    );

    // Wait for user input
    await this.waitForUserInput();

    // Give some time for the page to process
    await DelayUtils.randomDelay(
      TIMEOUTS.LOGIN_DELAY,
      TIMEOUTS.POST_LOGIN_WAIT
    );
  }

  /**
   * Handles two-factor authentication intervention
   */
  private async handleTwoFactorIntervention(): Promise<void> {
    this.logger.warn(
      'Two-factor authentication required - Manual intervention needed'
    );
    this.logger.info('🔐 TWO-FACTOR AUTHENTICATION REQUIRED 🔐');
    this.logger.info(
      'Please complete the two-factor authentication in the browser window.'
    );
    this.logger.info('The bot will wait for you to complete it...');
    this.logger.info('Press Enter when you have completed 2FA to continue.');

    // Wait for user input
    await this.waitForUserInput();

    // Give some time for the page to process
    await DelayUtils.randomDelay(2000, 3000);
  }

  /**
   * Checks if a file exists
   * @param filePath Path to the file
   * @returns Promise that resolves to true if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Waits for user input (Enter key) to continue
   */
  private async waitForUserInput(): Promise<void> {
    return new Promise((resolve) => {
      const stdin = process.stdin;

      const cleanup = (): void => {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
      };

      const onData = (key: string): void => {
        if (key === '\r' || key === '\n') {
          cleanup();
          resolve();
        }
      };

      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      stdin.on('data', onData);
    });
  }

  /**
   * Saves current session cookies and data
   */
  public async saveSession(): Promise<void> {
    if (!this.page) return;

    try {
      const cookies = await this.page.cookies('https://www.linkedin.com');
      const sessionData = {
        cookies,
        timestamp: new Date().toISOString(),
        url: this.page.url(),
        isLoggedIn: await this.isLoggedIn(),
      };

      await fs.writeFile(
        this.cookiesPath,
        JSON.stringify(sessionData, null, 2)
      );
      this.logger.info('Session saved successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to save session: ${errorMessage}`);
    }
  }

  /**
   * Restores session from saved cookies
   * @returns Promise that resolves to true if session restored successfully
   */
  public async restoreSession(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Check if cookies file exists
      const cookiesExist = await this.fileExists(this.cookiesPath);
      if (!cookiesExist) {
        this.logger.info('No saved session found');
        return false;
      }

      // Read and parse cookies
      const cookiesData = await fs.readFile(this.cookiesPath, 'utf-8');
      const sessionData = JSON.parse(cookiesData);

      // Check if session is not too old
      const sessionAge = Date.now() - new Date(sessionData.timestamp).getTime();
      if (sessionAge > this.sessionTimeout) {
        this.logger.info('Saved session expired');
        await this.clearSession();
        return false;
      }

      // Set cookies
      if (sessionData.cookies && Array.isArray(sessionData.cookies)) {
        for (const cookie of sessionData.cookies) {
          await this.page.setCookie(cookie);
        }
      }

      // Navigate to LinkedIn to test session
      await this.page.goto('https://www.linkedin.com/feed', {
        waitUntil: 'networkidle2',
      });

      await DelayUtils.randomDelay(
        TIMEOUTS.LOGIN_DELAY,
        TIMEOUTS.PROCESS_DELAY
      );

      // Check if session is valid
      const isValid = await this.isLoggedIn();
      if (isValid) {
        this.updateSessionData(true);
        this.logger.info('Session restored and validated');
        return true;
      } else {
        this.logger.info('Restored session is invalid');
        await this.clearSession();
        return false;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to restore session: ${errorMessage}`);
      await this.clearSession();
      return false;
    }
  }

  /**
   * Clears saved session data
   */
  public async clearSession(): Promise<void> {
    try {
      await fs.unlink(this.cookiesPath).catch(() => {
        // File might not exist, ignore error
      });

      this.sessionData = null;
      this.logger.info('Session cleared');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to clear session: ${errorMessage}`);
    }
  }

  /**
   * Checks if current session is expired
   * @returns True if session is expired
   */
  public isSessionExpired(): boolean {
    if (!this.sessionData) return true;

    const sessionAge = Date.now() - this.sessionData.lastActivity.getTime();
    return sessionAge > this.sessionTimeout;
  }

  /**
   * Refreshes the current session
   * @returns Promise that resolves to true if refresh successful
   */
  public async refreshSession(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Navigate to LinkedIn feed to refresh session
      await this.page.goto('https://www.linkedin.com/feed', {
        waitUntil: 'networkidle2',
      });

      await DelayUtils.randomDelay(
        TIMEOUTS.CAPTCHA_CHECK,
        TIMEOUTS.LOGIN_DELAY
      );

      const isValid = await this.isLoggedIn();
      if (isValid) {
        this.updateSessionData(true);
        await this.saveSession();
        return true;
      }

      return false;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to refresh session: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Handles session timeout by attempting re-authentication
   * @returns Promise that resolves to true if re-authentication successful
   */
  public async handleSessionTimeout(): Promise<boolean> {
    this.logger.warn('Session timeout detected, attempting re-authentication');

    try {
      // Clear expired session
      await this.clearSession();

      // Attempt fresh login
      return await this.login();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Session timeout handling failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Updates internal session data
   * @param isLoggedIn Current login status
   */
  private updateSessionData(isLoggedIn: boolean): void {
    this.sessionData = {
      isLoggedIn,
      lastActivity: new Date(),
      sessionId: this.generateSessionId(),
      cookies: [], // Will be populated when saving
    };
  }

  /**
   * Generates a unique session ID
   * @returns Session ID string
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Gets current session data
   * @returns Current session data or null
   */
  public getSessionData(): BrowserSession | null {
    return this.sessionData;
  }

  /**
   * Sets session timeout duration
   * @param timeoutMs Timeout in milliseconds
   */
  public setSessionTimeout(timeoutMs: number): void {
    this.sessionTimeout = timeoutMs;
  }

  /**
   * Gets current session timeout
   * @returns Timeout in milliseconds
   */
  public getSessionTimeout(): number {
    return this.sessionTimeout;
  }

  /**
   * Validates current session and handles re-authentication if needed
   * @returns Promise that resolves to true if session is valid
   */
  public async validateSession(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Check if session is expired
      if (this.isSessionExpired()) {
        return await this.handleSessionTimeout();
      }

      // Check if still logged in
      const isValid = await this.isLoggedIn();
      if (!isValid) {
        return await this.handleSessionTimeout();
      }

      // Update activity timestamp
      this.updateSessionData(true);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Session validation failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Performs cleanup when shutting down
   */
  public async cleanup(): Promise<void> {
    try {
      if (this.sessionData?.isLoggedIn) {
        await this.saveSession();
      }
      this.logger.info('SessionManager cleanup completed');
    } catch (error) {
      this.logger.error(`SessionManager cleanup failed: ${error}`);
    }
  }
}

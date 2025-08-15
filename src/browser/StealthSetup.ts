import type { LaunchOptions, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { STEALTH_CONFIG } from './StealthConstants';

/**
 * Configures stealth capabilities for Puppeteer to avoid detection
 * Implements anti-detection measures as required by Requirement 8.1
 */
export class StealthSetup {
  private static readonly isConfigured = false;

  /**
   * Validates that stealth configuration is properly set up
   * @returns true if stealth configuration is valid
   */
  public static validateStealthConfig(): boolean {
    try {
      // Check if required stealth plugins are available
      if (!StealthPlugin) {
        console.error('StealthPlugin is not available');
        return false;
      }

      // Validate configuration constants
      if (!STEALTH_CONFIG.USER_AGENT || !STEALTH_CONFIG.BROWSER_ARGS.length) {
        console.error('Invalid stealth configuration constants');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating stealth configuration:', error);
      return false;
    }
  }

  /**
   * Configures puppeteer-extra with stealth plugin
   * This should be called before launching any browser instances
   */
  public static configure(): void {
    if (this.isConfigured) {
      return;
    }

    if (!this.validateStealthConfig()) {
      throw new Error('Invalid stealth configuration detected');
    }

    try {
      // Add stealth plugin to puppeteer-extra
      puppeteer.use(StealthPlugin());

      // Mark as configured
      (this as unknown as { isConfigured: boolean }).isConfigured = true;

      console.debug('Stealth configuration applied successfully');
    } catch (error) {
      throw new Error(
        `Failed to configure stealth setup: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Gets the configured puppeteer instance with stealth capabilities
   * @returns Puppeteer instance with stealth plugin configured
   */
  public static getPuppeteer(): typeof puppeteer {
    this.configure();
    return puppeteer;
  }

  /**
   * Gets additional launch options for enhanced stealth
   * @returns Launch options that help avoid detection
   */
  public static getStealthLaunchOptions(): LaunchOptions {
    return {
      args: [
        ...STEALTH_CONFIG.BROWSER_ARGS,
        `--user-agent=${STEALTH_CONFIG.USER_AGENT}`,
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    } as const;
  }

  /**
   * Applies additional stealth measures to a page
   * @param page Puppeteer page instance
   */
  public static async applyPageStealth(page: Page): Promise<void> {
    this.assertPageValid(page);

    try {
      console.debug('Applying stealth configuration to page');

      await this.overrideNavigatorProperties(page);
      await this.setRealisticViewport(page);
      await this.setStealthHeaders(page);

      console.debug('Stealth configuration applied successfully');
    } catch (error) {
      throw new Error(
        `Failed to apply stealth configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validates that the page is valid for stealth configuration
   * @param page Puppeteer page instance
   */
  private static assertPageValid(page: Page): asserts page is Page {
    if (!page || page.isClosed()) {
      throw new Error('Invalid page provided for stealth configuration');
    }
  }

  /**
   * Overrides navigator properties to avoid detection
   * @param page Puppeteer page instance
   */
  private static async overrideNavigatorProperties(page: Page): Promise<void> {
    // Override the webdriver property
    await page.evaluateOnNewDocument(() => {
      // @ts-expect-error - This runs in browser context where navigator exists
      // eslint-disable-next-line no-undef
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    // Override the plugins property
    await page.evaluateOnNewDocument((plugins: readonly number[]) => {
      // @ts-expect-error - This runs in browser context where navigator exists
      // eslint-disable-next-line no-undef
      Object.defineProperty(navigator, 'plugins', {
        get: () => plugins,
      });
    }, STEALTH_CONFIG.NAVIGATOR_OVERRIDES.plugins);

    // Override the languages property
    await page.evaluateOnNewDocument((languages: readonly string[]) => {
      // @ts-expect-error - This runs in browser context where navigator exists
      // eslint-disable-next-line no-undef
      Object.defineProperty(navigator, 'languages', {
        get: () => languages,
      });
    }, STEALTH_CONFIG.NAVIGATOR_OVERRIDES.languages);
  }

  /**
   * Sets a realistic viewport to avoid detection
   * @param page Puppeteer page instance
   */
  private static async setRealisticViewport(page: Page): Promise<void> {
    await page.setViewport(STEALTH_CONFIG.VIEWPORT);
  }

  /**
   * Sets stealth HTTP headers
   * @param page Puppeteer page instance
   */
  private static async setStealthHeaders(page: Page): Promise<void> {
    await page.setExtraHTTPHeaders(STEALTH_CONFIG.HEADERS);
  }
}

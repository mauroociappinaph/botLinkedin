import { Browser, LaunchOptions, Page } from 'puppeteer';
import { BotConfig } from '../types';
import { StealthSetup } from './StealthSetup';

/**
 * Manages Puppeteer browser lifecycle with stealth capabilities
 * Implements Requirements 8.1, 8.2, and 10.1
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: BotConfig['browser'];
  private isInitialized = false;

  constructor(config: BotConfig['browser']) {
    this.config = config;
  }

  /**
   * Launches a new browser instance with stealth configuration
   * @returns Promise that resolves when browser is launched
   */
  public async launch(): Promise<void> {
    if (this.browser) {
      await this.close();
    }

    try {
      // Configure stealth setup
      const puppeteer = StealthSetup.getPuppeteer();
      const stealthOptions = StealthSetup.getStealthLaunchOptions();

      // Merge stealth options with user configuration
      const launchOptions: LaunchOptions = {
        ...stealthOptions,
        headless: this.config.headless,
        slowMo: this.config.slowMo,
        timeout: this.config.timeout,
        defaultViewport: null, // Use default viewport for more realistic behavior
      };

      // Launch browser with stealth capabilities
      this.browser = await puppeteer.launch(launchOptions);

      // Create initial page
      const pages = await this.browser.pages();
      if (pages.length > 0) {
        this.page = pages[0] || null;
      } else {
        this.page = await this.browser.newPage();
      }

      // Ensure we have a page
      if (!this.page) {
        throw new Error('Failed to create initial page');
      }

      // Apply additional stealth measures to the page
      await StealthSetup.applyPageStealth(this.page);

      // Set default timeout for page operations
      this.page.setDefaultTimeout(this.config.timeout);
      this.page.setDefaultNavigationTimeout(this.config.timeout);

      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Failed to launch browser: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Gets the current browser instance
   * @returns Browser instance or null if not launched
   */
  public getBrowser(): Browser | null {
    return this.browser;
  }

  /**
   * Gets the current page instance
   * @returns Page instance or null if not available
   */
  public getPage(): Page | null {
    return this.page;
  }

  /**
   * Creates a new page with stealth configuration
   * @returns New page instance
   */
  public async newPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const newPage = await this.browser.newPage();
    await StealthSetup.applyPageStealth(newPage);

    // Set default timeouts
    newPage.setDefaultTimeout(this.config.timeout);
    newPage.setDefaultNavigationTimeout(this.config.timeout);

    return newPage;
  }

  /**
   * Checks if browser is currently running
   * @returns True if browser is running, false otherwise
   */
  public isRunning(): boolean {
    return this.browser !== null && this.browser.connected;
  }

  /**
   * Checks if browser manager is properly initialized
   * @returns True if initialized, false otherwise
   */
  public isReady(): boolean {
    return this.isInitialized && this.isRunning() && this.page !== null;
  }

  /**
   * Restarts the browser instance
   * @returns Promise that resolves when browser is restarted
   */
  public async restart(): Promise<void> {
    await this.close();
    await this.launch();
  }

  /**
   * Closes the current page
   * @returns Promise that resolves when page is closed
   */
  public async closePage(): Promise<void> {
    if (this.page && !this.page.isClosed()) {
      await this.page.close();
      this.page = null;
    }
  }

  /**
   * Closes the browser and cleans up resources
   * @returns Promise that resolves when browser is closed
   */
  public async close(): Promise<void> {
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close();
        this.page = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      this.isInitialized = false;
    } catch (error) {
      // Log error but don't throw to ensure cleanup continues
      console.error('Error during browser cleanup:', error);
    }
  }

  /**
   * Gets browser version information
   * @returns Browser version string or null if not available
   */
  public async getVersion(): Promise<string | null> {
    if (!this.browser) {
      return null;
    }

    try {
      return await this.browser.version();
    } catch {
      return null;
    }
  }

  /**
   * Gets current browser configuration
   * @returns Browser configuration object
   */
  public getConfig(): BotConfig['browser'] {
    return { ...this.config };
  }

  /**
   * Updates browser configuration (requires restart to take effect)
   * @param newConfig New browser configuration
   */
  public updateConfig(newConfig: Partial<BotConfig['browser']>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Takes a screenshot of the current page
   * @param path Optional path to save screenshot
   * @returns Screenshot buffer or path
   */
  public async screenshot(path?: string): Promise<Buffer | string> {
    if (!this.page) {
      throw new Error('No active page available for screenshot');
    }

    if (path) {
      await this.page.screenshot({
        fullPage: true,
        type: 'png',
        path: path as `${string}.png`,
      });
      return path;
    } else {
      const buffer = await this.page.screenshot({
        fullPage: true,
        type: 'png',
      });
      return Buffer.from(buffer);
    }
  }

  /**
   * Graceful shutdown with cleanup
   * Should be called when the application is terminating
   */
  public async shutdown(): Promise<void> {
    await this.close();
  }
}

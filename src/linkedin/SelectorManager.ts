import { ElementHandle, Page } from 'puppeteer';
import { Logger } from '../utils/Logger';

/**
 * Type for CSS selector strings
 */
export type CSSSelector = string;

/**
 * Default timeout values for selector operations
 */
const DEFAULT_TIMEOUTS = {
  SELECTOR_WAIT: 5000,
} as const;

/**
 * Manages CSS selector operations and fallback logic
 */
export class SelectorManager {
  constructor(private logger: Logger) {}

  /**
   * Finds the first working selector from a list of selectors
   * @param page Puppeteer page instance
   * @param selectors Array of CSS selectors to try
   * @returns First visible element or null if none found
   */
  async findWorkingSelector(
    page: Page,
    selectors: readonly string[] | string[]
  ): Promise<ElementHandle | null> {
    if (selectors.length === 0) {
      this.logger.debug('No selectors provided to findWorkingSelector');
      return null;
    }

    for (const selector of selectors) {
      if (!this.isValidSelector(selector)) {
        this.logger.debug(`Invalid selector skipped: ${selector}`);
        continue;
      }

      try {
        const element = await page.$(selector);
        if (!element) continue;

        const isVisible = await element.isIntersectingViewport();
        if (isVisible) {
          this.logger.debug(`Found working selector: ${selector}`);
          return element;
        }
      } catch (error) {
        this.logger.debug(`Selector failed: ${selector} - ${error}`);
        continue;
      }
    }

    this.logger.debug(
      `No working selector found from: ${selectors.join(', ')}`
    );
    return null;
  }

  /**
   * Waits for any of the provided selectors to appear
   * @param page Puppeteer page instance
   * @param selectors Array of CSS selectors to wait for
   * @param timeout Maximum time to wait in milliseconds
   * @returns Promise<ElementHandle | null> First element that appears or null if timeout
   * @example
   * ```typescript
   * const element = await selectorManager.waitForAnySelector(page, ['.modal', '.popup'], 3000);
   * ```
   */
  async waitForAnySelector(
    page: Page,
    selectors: readonly string[] | string[],
    timeout: number = DEFAULT_TIMEOUTS.SELECTOR_WAIT
  ): Promise<ElementHandle | null> {
    if (selectors.length === 0) {
      this.logger.debug('No selectors provided to waitForAnySelector');
      return null;
    }

    const validSelectors = selectors.filter((selector) => {
      const isValid = this.isValidSelector(selector);
      if (!isValid) {
        this.logger.debug(`Invalid selector skipped: ${selector}`);
      }
      return isValid;
    });

    if (validSelectors.length === 0) {
      this.logger.debug('No valid selectors provided to waitForAnySelector');
      return null;
    }

    const promises = validSelectors.map((selector) =>
      page.waitForSelector(selector, { timeout }).catch(() => null)
    );

    try {
      const results = await Promise.allSettled(promises);
      const firstSuccess = results.find(
        (result) => result.status === 'fulfilled' && result.value !== null
      );

      return firstSuccess?.status === 'fulfilled' ? firstSuccess.value : null;
    } catch (error) {
      this.logger.debug(
        `Error waiting for selectors: ${validSelectors.join(', ')} - ${error}`
      );
      return null;
    }
  }

  /**
   * Checks if any of the provided selectors exist on the page
   * @param page Puppeteer page instance
   * @param selectors Array of CSS selectors to check
   * @returns Promise<boolean> True if any selector is found, false otherwise
   * @example
   * ```typescript
   * const hasButton = await selectorManager.hasAnySelector(page, ['.btn-primary', '.btn-secondary']);
   * ```
   */
  async hasAnySelector(
    page: Page,
    selectors: readonly string[] | string[]
  ): Promise<boolean> {
    if (selectors.length === 0) {
      this.logger.debug('No selectors provided to hasAnySelector');
      return false;
    }

    for (const selector of selectors) {
      if (!this.isValidSelector(selector)) {
        this.logger.debug(`Invalid selector skipped: ${selector}`);
        continue;
      }

      try {
        const element = await page.$(selector);
        if (element) {
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  }

  /**
   * Validates that a selector string is properly formatted
   * @param selector CSS selector to validate
   * @returns True if selector appears valid
   */
  private isValidSelector(selector: string): boolean {
    if (
      !selector ||
      typeof selector !== 'string' ||
      selector.trim().length === 0
    ) {
      return false;
    }

    const trimmed = selector.trim();

    // Basic CSS selector validation - must start with valid CSS selector characters
    // and not contain obviously invalid patterns
    return (
      /^[.#[\]a-zA-Z0-9_:-]/.test(trimmed) &&
      !trimmed.includes('..') && // No double dots
      !trimmed.includes('##') && // No double hashes
      !trimmed.endsWith(',')
    ); // No trailing commas
  }

  /**
   * Finds all matching selectors concurrently for performance analysis
   * @param page Puppeteer page instance
   * @param selectors Array of CSS selectors to check
   * @returns Array of found elements with their corresponding selectors
   */
  async findAllWorkingSelectors(
    page: Page,
    selectors: readonly string[] | string[]
  ): Promise<Array<{ selector: string; element: ElementHandle }>> {
    if (selectors.length === 0) {
      return [];
    }

    const validSelectors = selectors.filter((selector) =>
      this.isValidSelector(selector)
    );
    const results: Array<{ selector: string; element: ElementHandle }> = [];

    const promises = validSelectors.map(async (selector) => {
      try {
        const element = await page.$(selector);
        if (element && (await element.isIntersectingViewport())) {
          return { selector, element };
        }
      } catch (error) {
        this.logger.debug(`Selector failed: ${selector} - ${error}`);
      }
      return null;
    });

    const settled = await Promise.allSettled(promises);
    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }

    return results;
  }
}

import { Page } from 'puppeteer';
import { DelayUtils } from './DelayUtils';

/**
 * Configuration options for human-like typing
 */
export interface TypingOptions {
  minDelay?: number;
  maxDelay?: number;
  clearFirst?: boolean;
  pressEnter?: boolean;
  retries?: number;
}

/**
 * Configuration options for human-like clicking
 */
export interface ClickOptions {
  moveToElement?: boolean;
  doubleClick?: boolean;
  rightClick?: boolean;
  delay?: number;
  retries?: number;
}

/**
 * Configuration options for scrolling
 */
export interface ScrollOptions {
  direction?: 'up' | 'down';
  distance?: number;
  steps?: number;
  retries?: number;
}

/**
 * Action types for realistic timing execution
 */
export interface TimingAction {
  type: 'click' | 'type' | 'scroll' | 'wait';
  selector?: string;
  text?: string;
  delay?: { min: number; max: number };
  retries?: number;
}

/**
 * Class dedicated to human-like browser interactions with error recovery
 * Separated from DelayUtils to follow Single Responsibility Principle
 */
export class HumanLikeInteractions {
  // Default retry configuration
  private static readonly RETRY_CONFIG = {
    DEFAULT_RETRIES: 3,
    RETRY_DELAY: { min: 1000, max: 3000 },
    BACKOFF_MULTIPLIER: 1.5,
  } as const;

  // Interaction timing constants
  private static readonly INTERACTION_DELAYS = {
    CLEAR_FIELD: { min: 50, max: 100 },
    PRE_ENTER: { min: 200, max: 500 },
    PRE_CLICK: { min: 100, max: 300 },
    POST_ACTION: { min: 200, max: 800 },
    DEFAULT_VIEWPORT: { width: 800, height: 600 },
    SCROLL_STEPS: { min: 2, max: 4 },
    DEFAULT_SCROLL_DISTANCE: 500,
    RANDOMIZATION_OFFSET: 20,
    MOUSE_STEPS_MIN: 3,
    MOUSE_STEPS_MAX: 7,
  } as const;

  private static readonly TIMEOUTS = {
    ELEMENT_WAIT: 10000,
  } as const;

  /**
   * Simulates human-like typing with realistic delays and error recovery
   * @param page Puppeteer page instance
   * @param selector Element selector to type into
   * @param text Text to type
   * @param options Typing configuration options
   */
  public static async humanLikeType(
    page: Page,
    selector: string,
    text: string,
    options: TypingOptions = {}
  ): Promise<void> {
    const {
      minDelay = DelayUtils.getDefaultDelayConfig().minTyping,
      maxDelay = DelayUtils.getDefaultDelayConfig().maxTyping,
      clearFirst = true,
      pressEnter = false,
      retries = HumanLikeInteractions.RETRY_CONFIG.DEFAULT_RETRIES,
    } = options;

    return HumanLikeInteractions.withRetry(
      async () => {
        // Wait for element and focus
        await page.waitForSelector(selector, {
          timeout: HumanLikeInteractions.TIMEOUTS.ELEMENT_WAIT,
        });
        await page.click(selector);

        // Clear existing content if requested
        if (clearFirst) {
          await page.keyboard.down('Control');
          await page.keyboard.press('KeyA');
          await page.keyboard.up('Control');
          await DelayUtils.randomDelay(
            HumanLikeInteractions.INTERACTION_DELAYS.CLEAR_FIELD.min,
            HumanLikeInteractions.INTERACTION_DELAYS.CLEAR_FIELD.max
          );
        }

        // Type each character with human-like delays
        for (const char of text) {
          await page.keyboard.type(char);
          await DelayUtils.randomDelay(minDelay, maxDelay);
        }

        // Press Enter if requested
        if (pressEnter) {
          await DelayUtils.randomDelay(
            HumanLikeInteractions.INTERACTION_DELAYS.PRE_ENTER.min,
            HumanLikeInteractions.INTERACTION_DELAYS.PRE_ENTER.max
          );
          await page.keyboard.press('Enter');
        }
      },
      retries,
      `typing into ${selector}`
    );
  }

  /**
   * Simulates human-like mouse movement and clicking with error recovery
   * @param page Puppeteer page instance
   * @param selector Element selector to click
   * @param options Click configuration options
   */
  public static async humanLikeClick(
    page: Page,
    selector: string,
    options: ClickOptions = {}
  ): Promise<void> {
    const {
      moveToElement = true,
      doubleClick = false,
      rightClick = false,
      delay = DelayUtils.getRandomDelay(
        DelayUtils.getDefaultDelayConfig().minTyping,
        DelayUtils.getDefaultDelayConfig().maxTyping
      ),
      retries = HumanLikeInteractions.RETRY_CONFIG.DEFAULT_RETRIES,
    } = options;

    return HumanLikeInteractions.withRetry(
      async () => {
        // Wait for element to be visible
        await page.waitForSelector(selector, {
          visible: true,
          timeout: HumanLikeInteractions.TIMEOUTS.ELEMENT_WAIT,
        });

        if (moveToElement) {
          // Move mouse to element with human-like path
          await HumanLikeInteractions.moveMouseToElement(page, selector);
          await DelayUtils.randomDelay(
            HumanLikeInteractions.INTERACTION_DELAYS.PRE_CLICK.min,
            HumanLikeInteractions.INTERACTION_DELAYS.PRE_CLICK.max
          );
        }

        // Perform the click action
        if (doubleClick) {
          await page.click(selector, { clickCount: 2, delay });
        } else if (rightClick) {
          await page.click(selector, { button: 'right', delay });
        } else {
          await page.click(selector, { delay });
        }

        // Add post-click delay
        await DelayUtils.randomDelay(
          DelayUtils.getDefaultDelayConfig().minTyping,
          DelayUtils.getDefaultDelayConfig().maxTyping
        );
      },
      retries,
      `clicking ${selector}`
    );
  }

  /**
   * Moves mouse to an element with human-like movement patterns and error recovery
   * @param page Puppeteer page instance
   * @param selector Element selector to move to
   */
  public static async moveMouseToElement(
    page: Page,
    selector: string
  ): Promise<void> {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const box = await element.boundingBox();
    if (!box) {
      throw new Error(`Could not get bounding box for element: ${selector}`);
    }

    // Calculate target position (center of element with slight randomization)
    const targetX =
      box.x +
      box.width / 2 +
      (Math.random() - 0.5) *
        HumanLikeInteractions.INTERACTION_DELAYS.RANDOMIZATION_OFFSET;
    const targetY =
      box.y +
      box.height / 2 +
      (Math.random() - 0.5) *
        HumanLikeInteractions.INTERACTION_DELAYS.RANDOMIZATION_OFFSET;

    // Get current mouse position (approximate - use viewport center)
    const viewport = page.viewport();
    const currentPosition = {
      x: viewport
        ? viewport.width / 2
        : HumanLikeInteractions.INTERACTION_DELAYS.DEFAULT_VIEWPORT.width,
      y: viewport
        ? viewport.height / 2
        : HumanLikeInteractions.INTERACTION_DELAYS.DEFAULT_VIEWPORT.height,
    };

    // Move mouse in steps to simulate human movement
    const steps =
      Math.floor(
        Math.random() *
          (HumanLikeInteractions.INTERACTION_DELAYS.MOUSE_STEPS_MAX -
            HumanLikeInteractions.INTERACTION_DELAYS.MOUSE_STEPS_MIN +
            1)
      ) + HumanLikeInteractions.INTERACTION_DELAYS.MOUSE_STEPS_MIN;
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const x = currentPosition.x + (targetX - currentPosition.x) * progress;
      const y = currentPosition.y + (targetY - currentPosition.y) * progress;

      await page.mouse.move(x, y);
      await DelayUtils.randomDelay(
        DelayUtils.getDefaultDelayConfig().minTyping,
        DelayUtils.getDefaultDelayConfig().maxTyping
      );
    }
  }

  /**
   * Simulates human-like scrolling behavior with error recovery
   * @param page Puppeteer page instance
   * @param options Scrolling configuration
   */
  public static async humanLikeScroll(
    page: Page,
    options: ScrollOptions = {}
  ): Promise<void> {
    const {
      direction = 'down',
      distance = HumanLikeInteractions.INTERACTION_DELAYS
        .DEFAULT_SCROLL_DISTANCE,
      steps = Math.floor(
        Math.random() *
          (HumanLikeInteractions.INTERACTION_DELAYS.SCROLL_STEPS.max -
            HumanLikeInteractions.INTERACTION_DELAYS.SCROLL_STEPS.min +
            1)
      ) + HumanLikeInteractions.INTERACTION_DELAYS.SCROLL_STEPS.min,
      retries = HumanLikeInteractions.RETRY_CONFIG.DEFAULT_RETRIES,
    } = options;

    return HumanLikeInteractions.withRetry(
      async () => {
        const scrollStep = distance / steps;
        const scrollDirection = direction === 'down' ? 1 : -1;

        for (let i = 0; i < steps; i++) {
          await page.evaluate(
            (step: number, dir: number) => {
              (globalThis as any).scrollBy(0, step * dir);
            },
            scrollStep,
            scrollDirection
          );

          await DelayUtils.randomDelay(
            DelayUtils.getDefaultDelayConfig().minTyping,
            DelayUtils.getDefaultDelayConfig().maxTyping
          );
        }
      },
      retries,
      'scrolling'
    );
  }

  /**
   * Creates realistic interaction patterns by combining multiple delay types with error recovery
   * @param page Puppeteer page instance
   * @param actions Array of actions to perform with delays
   */
  public static async executeWithRealisticTiming(
    page: Page,
    actions: TimingAction[]
  ): Promise<void> {
    for (const action of actions) {
      const retries =
        action.retries || HumanLikeInteractions.RETRY_CONFIG.DEFAULT_RETRIES;

      await HumanLikeInteractions.withRetry(
        async () => {
          switch (action.type) {
            case 'click':
              if (action.selector) {
                await HumanLikeInteractions.humanLikeClick(
                  page,
                  action.selector,
                  { retries: 1 }
                );
              }
              break;
            case 'type':
              if (action.selector && action.text) {
                await HumanLikeInteractions.humanLikeType(
                  page,
                  action.selector,
                  action.text,
                  { retries: 1 }
                );
              }
              break;
            case 'scroll':
              await HumanLikeInteractions.humanLikeScroll(page, { retries: 1 });
              break;
            case 'wait':
              if (action.delay) {
                await DelayUtils.randomDelay(
                  action.delay.min,
                  action.delay.max
                );
              } else {
                await DelayUtils.formFieldDelay();
              }
              break;
          }
        },
        retries,
        `executing ${action.type} action`
      );

      // Add small delay between actions
      await DelayUtils.randomDelay(
        HumanLikeInteractions.INTERACTION_DELAYS.POST_ACTION.min,
        HumanLikeInteractions.INTERACTION_DELAYS.POST_ACTION.max
      );
    }
  }

  /**
   * Generic retry wrapper with exponential backoff
   * @param operation Function to retry
   * @param maxRetries Maximum number of retries
   * @param operationName Name of the operation for error messages
   */
  private static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries) {
          throw new Error(
            `Failed ${operationName} after ${maxRetries + 1} attempts. Last error: ${lastError.message}`
          );
        }

        // Calculate backoff delay with exponential increase
        const baseDelay = DelayUtils.getRandomDelay(
          HumanLikeInteractions.RETRY_CONFIG.RETRY_DELAY.min,
          HumanLikeInteractions.RETRY_CONFIG.RETRY_DELAY.max
        );
        const backoffDelay =
          baseDelay *
          Math.pow(
            HumanLikeInteractions.RETRY_CONFIG.BACKOFF_MULTIPLIER,
            attempt
          );

        await DelayUtils.delay(backoffDelay);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError || new Error(`Unknown error in ${operationName}`);
  }

  /**
   * Validates interaction configuration
   * @param config Interaction configuration object
   * @returns Validation result
   */
  public static validateInteractionConfig(config: {
    retries: number;
    timeout: number;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.retries < 0 || config.retries > 10) {
      errors.push('Retries must be between 0 and 10');
    }
    if (config.timeout < 1000 || config.timeout > 60000) {
      errors.push('Timeout must be between 1 and 60 seconds');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

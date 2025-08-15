import { Page } from 'puppeteer';
import {
  ActionExecutor,
  ClickConfig,
  KeyboardInteractions,
  MouseInteractions,
  ScrollConfig,
  ScrollInteractions,
  TimingAction,
  TypingConfig,
} from './interactions';

// Re-export interfaces for backward compatibility
export type TypingOptions = TypingConfig;
export type ClickOptions = ClickConfig;
export type ScrollOptions = ScrollConfig;
export { TimingAction };

/**
 * High-level orchestrator for human-like browser interactions
 * Delegates to specialized interaction classes for better maintainability
 */
export class HumanLikeInteractions {
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
    return KeyboardInteractions.humanLikeType(page, selector, text, options);
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
    return MouseInteractions.humanLikeClick(page, selector, options);
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
    return MouseInteractions.moveMouseToElement(page, selector);
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
    return ScrollInteractions.humanLikeScroll(page, options);
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
    return ActionExecutor.executeWithRealisticTiming(page, actions);
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

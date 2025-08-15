import { Page } from 'puppeteer';
import { DelayUtils } from '../DelayUtils';
import { TypingConfig } from './InteractionConfig';
import { InteractionConstants } from './InteractionConstants';
import { InteractionError } from './InteractionError';

/**
 * Handles keyboard-related interactions
 */
export class KeyboardInteractions {
    /**
     * Simulates human-like typing with realistic delays and error recovery
     */
    static async humanLikeType(
        page: Page,
        selector: string,
        text: string,
        config: TypingConfig = {}
    ): Promise<void> {
        const {
            minDelay = DelayUtils.getDefaultDelayConfig().minTyping,
            maxDelay = DelayUtils.getDefaultDelayConfig().maxTyping,
            clearFirst = true,
            pressEnter = false,
            retries = InteractionConstants.RETRY_CONFIG.DEFAULT_RETRIES,
        } = config;

        const operation = async (): Promise<void> => {
            // Wait for element and focus
            await page.waitForSelector(selector, {
                timeout: InteractionConstants.TIMEOUTS.ELEMENT_WAIT,
            });
            await page.click(selector);

            // Clear existing content if requested
            if (clearFirst) {
                await this.clearField(page);
            }

            // Type each character with human-like delays
            for (const char of text) {
                await page.keyboard.type(char);
                await DelayUtils.randomDelay(minDelay, maxDelay);
            }

            // Press Enter if requested
            if (pressEnter) {
                await DelayUtils.randomDelay(
                    InteractionConstants.INTERACTION_DELAYS.PRE_ENTER.min,
                    InteractionConstants.INTERACTION_DELAYS.PRE_ENTER.max
                );
                await page.keyboard.press('Enter');
            }
        };

        return this.withRetry(operation, retries || 1, 'typing', selector);
    }

    /**
     * Clears a field using keyboard shortcuts
     */
    private static async clearField(page: Page): Promise<void> {
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await DelayUtils.randomDelay(
            InteractionConstants.INTERACTION_DELAYS.CLEAR_FIELD.min,
            InteractionConstants.INTERACTION_DELAYS.CLEAR_FIELD.max
        );
    }

    /**
     * Generic retry wrapper with exponential backoff
     */
    private static async withRetry<T>(
        operation: () => Promise<T>,
        maxRetries: number,
        operationName: string,
        selector?: string
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt === maxRetries) {
                    throw new InteractionError(operationName, selector, maxRetries + 1, lastError);
                }

                // Calculate backoff delay with exponential increase
                const baseDelay = DelayUtils.getRandomDelay(
                    InteractionConstants.RETRY_CONFIG.RETRY_DELAY.min,
                    InteractionConstants.RETRY_CONFIG.RETRY_DELAY.max
                );
                const backoffDelay =
                    baseDelay *
                    Math.pow(InteractionConstants.RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt);

                await DelayUtils.delay(backoffDelay);
            }
        }

        // This should never be reached, but TypeScript requires it
        throw lastError || new InteractionError(operationName, selector);
    }
}

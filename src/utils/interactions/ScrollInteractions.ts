import { Page } from 'puppeteer';
import { DelayUtils } from '../DelayUtils';
import { ScrollConfig } from './InteractionConfig';
import { InteractionConstants } from './InteractionConstants';
import { InteractionError } from './InteractionError';

// No need for global declaration - window.scrollBy is already defined in DOM types

/**
 * Handles scroll-related interactions
 */
export class ScrollInteractions {
    /**
     * Simulates human-like scrolling behavior with error recovery
     */
    static async humanLikeScroll(
        page: Page,
        config: ScrollConfig = {}
    ): Promise<void> {
        const {
            direction = 'down',
            distance = InteractionConstants.INTERACTION_DELAYS.DEFAULT_SCROLL_DISTANCE,
            steps = Math.floor(
                Math.random() *
                (InteractionConstants.INTERACTION_DELAYS.SCROLL_STEPS.max -
                    InteractionConstants.INTERACTION_DELAYS.SCROLL_STEPS.min +
                    InteractionConstants.INTERACTION_DELAYS.PROGRESS_CALCULATION_BASE)
            ) + InteractionConstants.INTERACTION_DELAYS.SCROLL_STEPS.min,
            retries = InteractionConstants.RETRY_CONFIG.DEFAULT_RETRIES,
        } = config;

        const operation = async (): Promise<void> => {
            const scrollStep = distance / steps;
            const scrollDirection = direction === 'down' ? 1 : -1;

            for (let i = 0; i < steps; i++) {
                await page.evaluate(
                    `window.scrollBy(0, ${scrollStep * scrollDirection})`
                );

                await DelayUtils.randomDelay(
                    DelayUtils.getDefaultDelayConfig().minTyping,
                    DelayUtils.getDefaultDelayConfig().maxTyping
                );
            }
        };

        return this.withRetry(operation, retries || 1, 'scrolling');
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

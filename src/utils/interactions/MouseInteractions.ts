import { Page } from 'puppeteer';
import { DelayUtils } from '../DelayUtils';
import { ClickConfig } from './InteractionConfig';
import { InteractionConstants } from './InteractionConstants';
import { InteractionError } from './InteractionError';

/**
 * Handles mouse-related interactions
 */
export class MouseInteractions {
    /**
     * Simulates human-like mouse movement and clicking with error recovery
     */
    static async humanLikeClick(
        page: Page,
        selector: string,
        config: ClickConfig = {}
    ): Promise<void> {
        const {
            moveToElement = true,
            doubleClick = false,
            rightClick = false,
            delay = DelayUtils.getRandomDelay(
                DelayUtils.getDefaultDelayConfig().minTyping,
                DelayUtils.getDefaultDelayConfig().maxTyping
            ),
            retries = InteractionConstants.RETRY_CONFIG.DEFAULT_RETRIES,
        } = config;

        const operation = async (): Promise<void> => {
            // Wait for element to be visible
            await page.waitForSelector(selector, {
                visible: true,
                timeout: InteractionConstants.TIMEOUTS.ELEMENT_WAIT,
            });

            if (moveToElement) {
                // Move mouse to element with human-like path
                await this.moveMouseToElement(page, selector);
                await DelayUtils.randomDelay(
                    InteractionConstants.INTERACTION_DELAYS.PRE_CLICK.min,
                    InteractionConstants.INTERACTION_DELAYS.PRE_CLICK.max
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
        };

        return this.withRetry(operation, retries || 1, 'click', selector);
    }

    /**
     * Moves mouse to an element with human-like movement patterns
     */
    static async moveMouseToElement(page: Page, selector: string): Promise<void> {
        const element = await page.$(selector);
        if (!element) {
            throw new InteractionError('Element not found', selector);
        }

        const box = await element.boundingBox();
        if (!box) {
            throw new InteractionError('Could not get bounding box for element', selector);
        }

        // Calculate target position (center of element with slight randomization)
        const targetX =
            box.x +
            box.width / 2 +
            (Math.random() - InteractionConstants.INTERACTION_DELAYS.MOUSE_MOVEMENT_VARIANCE) *
            InteractionConstants.INTERACTION_DELAYS.RANDOMIZATION_OFFSET;
        const targetY =
            box.y +
            box.height / 2 +
            (Math.random() - InteractionConstants.INTERACTION_DELAYS.MOUSE_MOVEMENT_VARIANCE) *
            InteractionConstants.INTERACTION_DELAYS.RANDOMIZATION_OFFSET;

        // Get current mouse position (approximate - use viewport center)
        const viewport = page.viewport();
        const currentPosition = {
            x: viewport
                ? viewport.width / 2
                : InteractionConstants.INTERACTION_DELAYS.DEFAULT_VIEWPORT.width,
            y: viewport
                ? viewport.height / 2
                : InteractionConstants.INTERACTION_DELAYS.DEFAULT_VIEWPORT.height,
        };

        // Move mouse in steps to simulate human movement
        const steps =
            Math.floor(
                Math.random() *
                (InteractionConstants.INTERACTION_DELAYS.MOUSE_STEPS_MAX -
                    InteractionConstants.INTERACTION_DELAYS.MOUSE_STEPS_MIN +
                    InteractionConstants.INTERACTION_DELAYS.PROGRESS_CALCULATION_BASE)
            ) + InteractionConstants.INTERACTION_DELAYS.MOUSE_STEPS_MIN;

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

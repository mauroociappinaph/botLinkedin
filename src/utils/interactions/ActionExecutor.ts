import { Page } from 'puppeteer';
import { DelayUtils } from '../DelayUtils';
import { TimingAction } from './InteractionConfig';
import { InteractionConstants } from './InteractionConstants';
import { InteractionError } from './InteractionError';
import { KeyboardInteractions } from './KeyboardInteractions';
import { MouseInteractions } from './MouseInteractions';
import { ScrollInteractions } from './ScrollInteractions';

/**
 * Executes complex interaction sequences with realistic timing
 */
export class ActionExecutor {
    /**
     * Creates realistic interaction patterns by combining multiple delay types with error recovery
     */
    static async executeWithRealisticTiming(
        page: Page,
        actions: TimingAction[]
    ): Promise<void> {
        for (const action of actions) {
            const retries = action.retries || InteractionConstants.RETRY_CONFIG.DEFAULT_RETRIES;

            await this.withRetry(
                async () => {
                    await this.executeAction(page, action);
                },
                retries,
                `executing ${action.type} action`
            );

            // Add small delay between actions
            await DelayUtils.randomDelay(
                InteractionConstants.INTERACTION_DELAYS.POST_ACTION.min,
                InteractionConstants.INTERACTION_DELAYS.POST_ACTION.max
            );
        }
    }

    /**
     * Executes a single action based on its type
     */
    private static async executeAction(page: Page, action: TimingAction): Promise<void> {
        switch (action.type) {
            case 'click':
                if (action.selector) {
                    await MouseInteractions.humanLikeClick(page, action.selector, { retries: 1 });
                }
                break;
            case 'type':
                if (action.selector && action.text) {
                    await KeyboardInteractions.humanLikeType(
                        page,
                        action.selector,
                        action.text,
                        { retries: 1 }
                    );
                }
                break;
            case 'scroll':
                await ScrollInteractions.humanLikeScroll(page, { retries: 1 });
                break;
            case 'wait':
                if (action.delay) {
                    await DelayUtils.randomDelay(action.delay.min, action.delay.max);
                } else {
                    await DelayUtils.formFieldDelay();
                }
                break;
            default:
                throw new InteractionError(`Unknown action type: ${(action as TimingAction).type}`);
        }
    }

    /**
     * Generic retry wrapper with exponential backoff
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
                    throw new InteractionError(operationName, undefined, maxRetries + 1, lastError);
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
        throw lastError || new InteractionError(operationName);
    }
}

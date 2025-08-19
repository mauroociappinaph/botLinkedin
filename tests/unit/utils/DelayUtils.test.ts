import { DelayUtils } from '../../../src/utils/DelayUtils';

// Mock timers
jest.useFakeTimers();

describe('DelayUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.useFakeTimers();
    });

    describe('randomDelay', () => {
        it('should create a delay within the specified range', async () => {
            const delayPromise = DelayUtils.randomDelay(100, 200);

            // Fast-forward time
            jest.advanceTimersByTime(200);

            await expect(delayPromise).resolves.toBeUndefined();
        });

        it('should throw error when min is negative', async () => {
            await expect(DelayUtils.randomDelay(-100, 200)).rejects.toThrow(
                'Delay values must be non-negative'
            );
        });

        it('should throw error when max is negative', async () => {
            await expect(DelayUtils.randomDelay(100, -200)).rejects.toThrow(
                'Delay values must be non-negative'
            );
        });

        it('should throw error when min equals max', async () => {
            await expect(DelayUtils.randomDelay(100, 100)).rejects.toThrow(
                'Minimum delay must be less than maximum delay'
            );
        });

        it('should throw error when min is greater than max', async () => {
            await expect(DelayUtils.randomDelay(200, 100)).rejects.toThrow(
                'Minimum delay must be less than maximum delay'
            );
        });
    });

    describe('getRandomTypingDelay', () => {
        it('should return a value within the specified range', () => {
            const delay = DelayUtils.getRandomTypingDelay(50, 150);
            expect(delay).toBeGreaterThanOrEqual(50);
            expect(delay).toBeLessThanOrEqual(150);
        });

        it('should return exact value when min equals max', () => {
            const delay = DelayUtils.getRandomTypingDelay(100, 100);
            expect(delay).toBe(100);
        });

        it('should handle edge case with min = 0', () => {
            const delay = DelayUtils.getRandomTypingDelay(0, 100);
            expect(delay).toBeGreaterThanOrEqual(0);
            expect(delay).toBeLessThanOrEqual(100);
        });
    });

    describe('delay', () => {
        it('should create a fixed delay', async () => {
            const delayPromise = DelayUtils.delay(500);

            jest.advanceTimersByTime(500);

            await expect(delayPromise).resolves.toBeUndefined();
        });

        it('should handle zero delay', async () => {
            const delayPromise = DelayUtils.delay(0);

            jest.advanceTimersByTime(0);

            await expect(delayPromise).resolves.toBeUndefined();
        });
    });

    describe('sleep', () => {
        it('should be an alias for delay', async () => {
            const sleepPromise = DelayUtils.sleep(300);

            jest.advanceTimersByTime(300);

            await expect(sleepPromise).resolves.toBeUndefined();
        });
    });

    describe('pageLoadDelay', () => {
        it('should use default delays when no parameters provided', async () => {
            const delayPromise = DelayUtils.pageLoadDelay();

            // Advance by maximum default delay
            jest.advanceTimersByTime(5000);

            await expect(delayPromise).resolves.toBeUndefined();
        });

        it('should use custom delays when provided', async () => {
            const delayPromise = DelayUtils.pageLoadDelay(1000, 2000);

            jest.advanceTimersByTime(2000);

            await expect(delayPromise).resolves.toBeUndefined();
        });
    });

    describe('formFieldDelay', () => {
        it('should create appropriate delay for form field interactions', async () => {
            const delayPromise = DelayUtils.formFieldDelay();

            jest.advanceTimersByTime(1500);

            await expect(delayPromise).resolves.toBeUndefined();
        });

        it('should use custom delays when provided', async () => {
            const delayPromise = DelayUtils.formFieldDelay(500, 1000);

            jest.advanceTimersByTime(1000);

            await expect(delayPromise).resolves.toBeUndefined();
        });
    });

    describe('betweenApplicationsDelay', () => {
        it('should create longer delay between applications', async () => {
            const delayPromise = DelayUtils.betweenApplicationsDelay();

            jest.advanceTimersByTime(30000);

            await expect(delayPromise).resolves.toBeUndefined();
        });

        it('should use custom delays when provided', async () => {
            const delayPromise = DelayUtils.betweenApplicationsDelay(5000, 10000);

            jest.advanceTimersByTime(10000);

            await expect(delayPromise).resolves.toBeUndefined();
        });
    });

    describe('captchaPause', () => {
        it('should create pause for CAPTCHA resolution', async () => {
            const delayPromise = DelayUtils.captchaPause(1000, 2000);

            jest.advanceTimersByTime(2000);

            await expect(delayPromise).resolves.toBeUndefined();
        });

        it('should call notify callback during pause', async () => {
            const notifyCallback = jest.fn();
            const pausePromise = DelayUtils.captchaPause(9000, 11000, notifyCallback);

            // Advance by notification interval
            jest.advanceTimersByTime(5000);

            // Advance to completion
            jest.advanceTimersByTime(6000);

            await expect(pausePromise).resolves.toBeUndefined();
        });

        it('should handle callback errors gracefully', async () => {
            const errorCallback = jest.fn().mockImplementation(() => {
                throw new Error('Callback error');
            });

            const pausePromise = DelayUtils.captchaPause(4000, 6000, errorCallback);

            jest.advanceTimersByTime(5000);

            // Should not throw despite callback error
            await expect(pausePromise).resolves.toBeUndefined();
        });

        it('should throw error for invalid parameters', async () => {
            await expect(DelayUtils.captchaPause(-1000, 2000)).rejects.toThrow(
                'Invalid delay parameters'
            );

            await expect(DelayUtils.captchaPause(2000, 1000)).rejects.toThrow(
                'Invalid delay parameters'
            );
        });
    });

    describe('getRandomDelay', () => {
        it('should return value within specified range', () => {
            const delay = DelayUtils.getRandomDelay(100, 200);
            expect(delay).toBeGreaterThanOrEqual(100);
            expect(delay).toBeLessThanOrEqual(200);
        });

        it('should return exact value when min equals max', () => {
            const delay = DelayUtils.getRandomDelay(150, 150);
            expect(delay).toBe(150);
        });

        it('should handle large ranges', () => {
            const delay = DelayUtils.getRandomDelay(1000, 10000);
            expect(delay).toBeGreaterThanOrEqual(1000);
            expect(delay).toBeLessThanOrEqual(10000);
        });
    });

    describe('validateDelayConfig', () => {
        it('should validate correct configuration', () => {
            const config = {
                minPageLoad: 1000,
                maxPageLoad: 3000,
                minTyping: 50,
                maxTyping: 150,
            };

            const result = DelayUtils.validateDelayConfig(config);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect negative values', () => {
            const config = {
                minPageLoad: -100,
                maxPageLoad: 3000,
                minTyping: 50,
                maxTyping: 150,
            };

            const result = DelayUtils.validateDelayConfig(config);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Page load delays must be non-negative');
        });

        it('should detect negative typing delays', () => {
            const config = {
                minPageLoad: 1000,
                maxPageLoad: 3000,
                minTyping: -50,
                maxTyping: 150,
            };

            const result = DelayUtils.validateDelayConfig(config);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Typing delays must be non-negative');
        });

        it('should detect min >= max conditions', () => {
            const config = {
                minPageLoad: 3000,
                maxPageLoad: 1000,
                minTyping: 150,
                maxTyping: 50,
            };

            const result = DelayUtils.validateDelayConfig(config);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Minimum page load delay must be less than maximum');
            expect(result.errors).toContain('Minimum typing delay must be less than maximum');
        });

        it('should detect excessive delay values', () => {
            const config = {
                minPageLoad: 1000,
                maxPageLoad: 50000, // Too high
                minTyping: 50,
                maxTyping: 2000, // Too high
            };

            const result = DelayUtils.validateDelayConfig(config);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Maximum page load delay should not exceed 30 seconds');
            expect(result.errors).toContain('Maximum typing delay should not exceed 1 second');
        });

        it('should handle multiple validation errors', () => {
            const config = {
                minPageLoad: -1000,
                maxPageLoad: 50000,
                minTyping: 200,
                maxTyping: 100,
            };

            const result = DelayUtils.validateDelayConfig(config);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(1);
        });
    });

    describe('getDefaultDelayConfig', () => {
        it('should return valid default configuration', () => {
            const config = DelayUtils.getDefaultDelayConfig();

            expect(config).toHaveProperty('minPageLoad');
            expect(config).toHaveProperty('maxPageLoad');
            expect(config).toHaveProperty('minTyping');
            expect(config).toHaveProperty('maxTyping');

            const validation = DelayUtils.validateDelayConfig(config);
            expect(validation.isValid).toBe(true);
        });

        it('should return consistent values', () => {
            const config1 = DelayUtils.getDefaultDelayConfig();
            const config2 = DelayUtils.getDefaultDelayConfig();

            expect(config1).toEqual(config2);
        });
    });

    describe('jitteredDelay', () => {
        it('should create delay with jitter', async () => {
            const delayPromise = DelayUtils.jitteredDelay(1000, 20);

            jest.advanceTimersByTime(1200); // Base + max jitter

            await expect(delayPromise).resolves.toBeUndefined();
        });

        it('should throw error for invalid jitter percent', async () => {
            await expect(DelayUtils.jitteredDelay(1000, -10)).rejects.toThrow(
                'Jitter percent must be between 0 and 100'
            );

            await expect(DelayUtils.jitteredDelay(1000, 150)).rejects.toThrow(
                'Jitter percent must be between 0 and 100'
            );
        });

        it('should handle minimal jitter', async () => {
            const delayPromise = DelayUtils.jitteredDelay(1000, 1);

            jest.advanceTimersByTime(1020); // Base + max jitter

            await expect(delayPromise).resolves.toBeUndefined();
        });
    });

    describe('exponentialBackoff', () => {
        it('should create exponential delays', async () => {
            const backoffPromise = DelayUtils.exponentialBackoff(100, 2, 1000, 3);

            // Total delay should be 100 + 200 + 400 = 700ms
            jest.advanceTimersByTime(700);

            await expect(backoffPromise).resolves.toBeUndefined();
        }, 10000);

        it('should respect maximum delay cap', async () => {
            const backoffPromise = DelayUtils.exponentialBackoff(1000, 3, 2000, 3);

            // Delays: 1000, 2000 (capped), 2000 (capped) = 5000ms total
            jest.advanceTimersByTime(5000);

            await expect(backoffPromise).resolves.toBeUndefined();
        }, 10000);

        it('should handle single iteration', async () => {
            const backoffPromise = DelayUtils.exponentialBackoff(500, 2, 10000, 1);

            jest.advanceTimersByTime(500);

            await expect(backoffPromise).resolves.toBeUndefined();
        });
    });

    describe('getDelayForInteraction', () => {
        it('should return delay configuration for PAGE_LOAD', () => {
            const config = DelayUtils.getDelayForInteraction('PAGE_LOAD');

            expect(config).toHaveProperty('min');
            expect(config).toHaveProperty('max');
            expect(config.min).toBeGreaterThanOrEqual(0);
            expect(config.max).toBeGreaterThan(config.min);
        });

        it('should return delay configuration for TYPING', () => {
            const config = DelayUtils.getDelayForInteraction('TYPING');

            expect(config).toHaveProperty('min');
            expect(config).toHaveProperty('max');
            expect(config.min).toBeGreaterThanOrEqual(0);
            expect(config.max).toBeGreaterThan(config.min);
        });

        it('should return delay configuration for CLICK', () => {
            const config = DelayUtils.getDelayForInteraction('CLICK');

            expect(config).toHaveProperty('min');
            expect(config).toHaveProperty('max');
        });

        it('should return delay configuration for BETWEEN_APPLICATIONS', () => {
            const config = DelayUtils.getDelayForInteraction('BETWEEN_APPLICATIONS');

            expect(config).toHaveProperty('min');
            expect(config).toHaveProperty('max');
            expect(config.max).toBeGreaterThan(10000); // Should be substantial delay
        });
    });
});

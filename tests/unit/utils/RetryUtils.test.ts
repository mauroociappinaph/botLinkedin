import { Logger, LogLevel } from '../../../src/utils/Logger';
import { RetryUtils } from '../../../src/utils/RetryUtils';

describe('RetryUtils', () => {
    let mockLogger: Logger;

    beforeEach(() => {
        mockLogger = new Logger(LogLevel.DEBUG);
        jest.spyOn(mockLogger, 'debug').mockImplementation();
        jest.spyOn(mockLogger, 'warn').mockImplementation();
        jest.spyOn(mockLogger, 'error').mockImplementation();
        jest.spyOn(mockLogger, 'info').mockImplementation();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('withRetry', () => {
        it('should succeed on first attempt', async () => {
            const operation = jest.fn().mockResolvedValue('success');

            const result = await RetryUtils.withRetry(operation, {}, mockLogger);

            expect(result.success).toBe(true);
            expect(result.result).toBe('success');
            expect(result.attempts).toBe(1);
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('should retry on retryable errors', async () => {
            const operation = jest.fn()
                .mockRejectedValueOnce(new Error('TimeoutError'))
                .mockRejectedValueOnce(new Error('NetworkError'))
                .mockResolvedValue('success');

            const result = await RetryUtils.withRetry(
                operation,
                { maxAttempts: 3, baseDelay: 10 },
                mockLogger
            );

            expect(result.success).toBe(true);
            expect(result.result).toBe('success');
            expect(result.attempts).toBe(3);
            expect(operation).toHaveBeenCalledTimes(3);
        });

        it('should not retry on non-retryable errors', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('ValidationError'));

            const result = await RetryUtils.withRetry(
                operation,
                { maxAttempts: 3, baseDelay: 10 },
                mockLogger
            );

            expect(result.success).toBe(false);
            expect(result.attempts).toBe(1);
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('should respect maxAttempts limit', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('TimeoutError'));

            const result = await RetryUtils.withRetry(
                operation,
                { maxAttempts: 2, baseDelay: 10 },
                mockLogger
            );

            expect(result.success).toBe(false);
            expect(result.attempts).toBe(2);
            expect(operation).toHaveBeenCalledTimes(2);
        });

        it('should use custom retry condition', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('CustomError'));
            const retryCondition = jest.fn().mockReturnValue(true);

            const result = await RetryUtils.withRetry(
                operation,
                { maxAttempts: 2, baseDelay: 10, retryCondition },
                mockLogger
            );

            expect(result.success).toBe(false);
            expect(result.attempts).toBe(2);
            expect(retryCondition).toHaveBeenCalledWith(expect.any(Error));
        });

        it('should handle different error categories correctly', async () => {
            const networkError = new Error('ECONNRESET: connection reset');
            const authError = new Error('Unauthorized access');

            // Network error should be retried
            const networkOperation = jest.fn()
                .mockRejectedValueOnce(networkError)
                .mockResolvedValue('success');

            const networkResult = await RetryUtils.withRetry(
                networkOperation,
                { maxAttempts: 2, baseDelay: 10 },
                mockLogger
            );

            expect(networkResult.success).toBe(true);
            expect(networkOperation).toHaveBeenCalledTimes(2);

            // Auth error should not be retried
            const authOperation = jest.fn().mockRejectedValue(authError);

            const authResult = await RetryUtils.withRetry(
                authOperation,
                { maxAttempts: 3, baseDelay: 10 },
                mockLogger
            );

            expect(authResult.success).toBe(false);
            expect(authOperation).toHaveBeenCalledTimes(1);
        });

        it('should track timing information correctly', async () => {
            const operation = jest.fn().mockResolvedValue('success');
            const startTime = Date.now();

            const result = await RetryUtils.withRetry(operation, {}, mockLogger);

            expect(result.totalTime).toBeGreaterThanOrEqual(0);
            expect(result.totalTime).toBeLessThan(Date.now() - startTime + 100); // Allow some margin
        });

        it('should validate retry options', async () => {
            const operation = jest.fn().mockResolvedValue('success');

            // Test invalid maxAttempts
            await expect(
                RetryUtils.withRetry(operation, { maxAttempts: 0 }, mockLogger)
            ).rejects.toThrow('maxAttempts must be at least 1');

            // Test invalid baseDelay
            await expect(
                RetryUtils.withRetry(operation, { baseDelay: -1 }, mockLogger)
            ).rejects.toThrow('baseDelay must be non-negative');
        });
    });

    describe('retryPageOperation', () => {
        it('should succeed on first attempt', async () => {
            const operation = jest.fn().mockResolvedValue('page loaded');

            const result = await RetryUtils.retryPageOperation(
                operation,
                'test operation',
                mockLogger
            );

            expect(result).toBe('page loaded');
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('should retry on Puppeteer errors', async () => {
            const operation = jest.fn()
                .mockRejectedValueOnce(new Error('TimeoutError: waiting for selector'))
                .mockResolvedValue('success');

            const result = await RetryUtils.retryPageOperation(
                operation,
                'test operation',
                mockLogger
            );

            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(2);
        });

        it('should throw after max attempts', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('TimeoutError'));

            await expect(
                RetryUtils.retryPageOperation(operation, 'test operation', mockLogger)
            ).rejects.toThrow('test operation failed after 3 attempts');

            expect(operation).toHaveBeenCalledTimes(3);
        });

        it('should handle non-retryable errors in page operations', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('Authentication failed'));

            await expect(
                RetryUtils.retryPageOperation(operation, 'auth operation', mockLogger)
            ).rejects.toThrow('auth operation failed after 1 attempts');

            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('should handle protocol errors correctly', async () => {
            const operation = jest.fn()
                .mockRejectedValueOnce(new Error('Protocol error: Target closed'))
                .mockResolvedValue('recovered');

            const result = await RetryUtils.retryPageOperation(
                operation,
                'protocol operation',
                mockLogger
            );

            expect(result).toBe('recovered');
            expect(operation).toHaveBeenCalledTimes(2);
        });
    });
});

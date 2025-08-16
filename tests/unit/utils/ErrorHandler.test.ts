import { ErrorCategory, ErrorHandler, ErrorSeverity, LinkedInBotError } from '../../../src/utils/ErrorHandler';
import { Logger, LogLevel } from '../../../src/utils/Logger';

describe('ErrorHandler', () => {
    let errorHandler: ErrorHandler;
    let mockLogger: Logger;

    beforeEach(() => {
        mockLogger = new Logger(LogLevel.ERROR); // Use ERROR level to suppress logs during tests
        errorHandler = new ErrorHandler(mockLogger);
    });

    describe('categorizeError', () => {
        test('should categorize network errors correctly', () => {
            const networkError = new Error('Network connection failed');
            const category = errorHandler.categorizeError(networkError);
            expect(category).toBe(ErrorCategory.NETWORK);
        });

        test('should categorize timeout errors correctly', () => {
            const timeoutError = new Error('Operation timed out');
            const category = errorHandler.categorizeError(timeoutError);
            expect(category).toBe(ErrorCategory.TIMEOUT);
        });

        test('should categorize authentication errors correctly', () => {
            const authError = new Error('Login failed - unauthorized');
            const category = errorHandler.categorizeError(authError);
            expect(category).toBe(ErrorCategory.AUTHENTICATION);
        });

        test('should categorize parsing errors correctly', () => {
            const parseError = new Error('Cannot read property of undefined - selector not found');
            const category = errorHandler.categorizeError(parseError);
            expect(category).toBe(ErrorCategory.PARSING);
        });

        test('should categorize detection errors correctly', () => {
            const detectionError = new Error('Bot detected - rate limit exceeded');
            const category = errorHandler.categorizeError(detectionError);
            expect(category).toBe(ErrorCategory.DETECTION);
        });

        test('should categorize CAPTCHA errors correctly', () => {
            const captchaError = new Error('CAPTCHA challenge required');
            const category = errorHandler.categorizeError(captchaError);
            expect(category).toBe(ErrorCategory.CAPTCHA);
        });

        test('should categorize configuration errors correctly', () => {
            const configError = new Error('Invalid config - missing required field');
            const category = errorHandler.categorizeError(configError);
            expect(category).toBe(ErrorCategory.CONFIGURATION);
        });

        test('should default to unknown category for unrecognized errors', () => {
            const unknownError = new Error('Some random error message');
            const category = errorHandler.categorizeError(unknownError);
            expect(category).toBe(ErrorCategory.UNKNOWN);
        });
    });

    describe('determineSeverity', () => {
        test('should assign FATAL severity to configuration errors', () => {
            const error = new Error('Config error');
            const severity = errorHandler.determineSeverity(error, ErrorCategory.CONFIGURATION);
            expect(severity).toBe(ErrorSeverity.FATAL);
        });

        test('should assign HIGH severity to detection errors', () => {
            const error = new Error('Detection error');
            const severity = errorHandler.determineSeverity(error, ErrorCategory.DETECTION);
            expect(severity).toBe(ErrorSeverity.HIGH);
        });

        test('should assign HIGH severity to CAPTCHA errors', () => {
            const error = new Error('CAPTCHA error');
            const severity = errorHandler.determineSeverity(error, ErrorCategory.CAPTCHA);
            expect(severity).toBe(ErrorSeverity.HIGH);
        });

        test('should assign HIGH severity to authentication errors', () => {
            const error = new Error('Auth error');
            const severity = errorHandler.determineSeverity(error, ErrorCategory.AUTHENTICATION);
            expect(severity).toBe(ErrorSeverity.HIGH);
        });

        test('should assign MEDIUM severity to network errors', () => {
            const error = new Error('Network error');
            const severity = errorHandler.determineSeverity(error, ErrorCategory.NETWORK);
            expect(severity).toBe(ErrorSeverity.MEDIUM);
        });

        test('should assign MEDIUM severity to timeout errors', () => {
            const error = new Error('Timeout error');
            const severity = errorHandler.determineSeverity(error, ErrorCategory.TIMEOUT);
            expect(severity).toBe(ErrorSeverity.MEDIUM);
        });

        test('should assign LOW severity to unknown errors', () => {
            const error = new Error('Unknown error');
            const severity = errorHandler.determineSeverity(error, ErrorCategory.UNKNOWN);
            expect(severity).toBe(ErrorSeverity.LOW);
        });
    });

    describe('enhanceError', () => {
        test('should enhance error with context and categorization', () => {
            const originalError = new Error('Test error');
            const enhanced = errorHandler.enhanceError(originalError, {
                jobId: 'test-job-123',
                selector: '.test-selector',
            });

            expect(enhanced).toBeInstanceOf(LinkedInBotError);
            expect(enhanced.message).toBe('Test error');
            expect(enhanced.context.jobId).toBe('test-job-123');
            expect(enhanced.context.selector).toBe('.test-selector');
            expect(enhanced.context.category).toBe(ErrorCategory.UNKNOWN);
            expect(enhanced.context.severity).toBe(ErrorSeverity.LOW);
            expect(enhanced.context.timestamp).toBeInstanceOf(Date);
            expect(enhanced.originalError).toBe(originalError);
        });

        test('should use provided category and severity', () => {
            const originalError = new Error('Network failure');
            const enhanced = errorHandler.enhanceError(originalError, {
                category: ErrorCategory.NETWORK,
                severity: ErrorSeverity.MEDIUM,
            });

            expect(enhanced.context.category).toBe(ErrorCategory.NETWORK);
            expect(enhanced.context.severity).toBe(ErrorSeverity.MEDIUM);
        });
    });

    describe('executeWithRetry', () => {
        test('should succeed on first attempt', async () => {
            const operation = jest.fn().mockResolvedValue('success');

            const result = await errorHandler.executeWithRetry(operation);

            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(1);
        });

        test('should retry on failure and eventually succeed', async () => {
            const operation = jest.fn()
                .mockRejectedValueOnce(new Error('First failure'))
                .mockRejectedValueOnce(new Error('Second failure'))
                .mockResolvedValue('success');

            const result = await errorHandler.executeWithRetry(operation, {
                category: ErrorCategory.NETWORK,
            }, {
                baseDelayMs: 10, // Reduce delay for testing
                maxDelayMs: 50,
            });

            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(3);
        });

        test('should throw enhanced error after all retries exhausted', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));

            await expect(
                errorHandler.executeWithRetry(operation, {
                    category: ErrorCategory.NETWORK,
                }, {
                    baseDelayMs: 10, // Reduce delay for testing
                    maxDelayMs: 50,
                })
            ).rejects.toThrow(LinkedInBotError);

            expect(operation).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
        }, 10000); // 10 second timeout

        test('should not retry for non-retryable errors', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('Config error'));

            await expect(
                errorHandler.executeWithRetry(operation, {
                    category: ErrorCategory.CONFIGURATION,
                })
            ).rejects.toThrow(LinkedInBotError);

            expect(operation).toHaveBeenCalledTimes(1); // No retries for config errors
        });
    });

    describe('handleGracefulDegradation', () => {
        test('should use primary operation when it succeeds', async () => {
            const primaryOperation = jest.fn().mockResolvedValue('primary success');
            const fallbackOperation = jest.fn().mockResolvedValue('fallback success');

            const result = await errorHandler.handleGracefulDegradation(
                primaryOperation,
                fallbackOperation
            );

            expect(result).toBe('primary success');
            expect(primaryOperation).toHaveBeenCalledTimes(1);
            expect(fallbackOperation).not.toHaveBeenCalled();
        });

        test('should use fallback when primary fails with low severity', async () => {
            const primaryOperation = jest.fn().mockRejectedValue(new Error('Primary failed'));
            const fallbackOperation = jest.fn().mockResolvedValue('fallback success');

            const result = await errorHandler.handleGracefulDegradation(
                primaryOperation,
                fallbackOperation,
                { severity: ErrorSeverity.LOW }
            );

            expect(result).toBe('fallback success');
            expect(primaryOperation).toHaveBeenCalledTimes(1);
            expect(fallbackOperation).toHaveBeenCalledTimes(1);
        });

        test('should not use fallback for high severity errors', async () => {
            const primaryOperation = jest.fn().mockRejectedValue(new Error('Critical failure'));
            const fallbackOperation = jest.fn().mockResolvedValue('fallback success');

            await expect(
                errorHandler.handleGracefulDegradation(
                    primaryOperation,
                    fallbackOperation,
                    { severity: ErrorSeverity.HIGH }
                )
            ).rejects.toThrow(LinkedInBotError);

            expect(primaryOperation).toHaveBeenCalledTimes(1);
            expect(fallbackOperation).not.toHaveBeenCalled();
        });
    });

    describe('createCircuitBreaker', () => {
        test('should allow operations when circuit is closed', async () => {
            const operation = jest.fn().mockResolvedValue('success');
            const circuitBreakerOperation = errorHandler.createCircuitBreaker(operation, 3);

            const result = await circuitBreakerOperation();

            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(1);
        });

        test('should open circuit after failure threshold', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('Failure'));
            const circuitBreakerOperation = errorHandler.createCircuitBreaker(operation, 2);

            // First two failures should be allowed
            await expect(circuitBreakerOperation()).rejects.toThrow('Failure');
            await expect(circuitBreakerOperation()).rejects.toThrow('Failure');

            // Third attempt should be blocked by circuit breaker
            await expect(circuitBreakerOperation()).rejects.toThrow('Circuit breaker is open');

            expect(operation).toHaveBeenCalledTimes(2);
        });
    });
});

import { CircuitBreaker, CircuitState } from '../../../src/utils/CircuitBreaker';
import { Logger, LogLevel } from '../../../src/utils/Logger';

describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;
    let mockLogger: Logger;

    beforeEach(() => {
        mockLogger = new Logger(LogLevel.DEBUG);
        jest.spyOn(mockLogger, 'debug').mockImplementation();
        jest.spyOn(mockLogger, 'info').mockImplementation();
        jest.spyOn(mockLogger, 'warn').mockImplementation();

        circuitBreaker = new CircuitBreaker({
            failureThreshold: 3,
            recoveryTimeout: 1000,
            monitoringPeriod: 5000,
            successThreshold: 2
        }, mockLogger);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('successful operations', () => {
        it('should execute successful operation', async () => {
            const operation = jest.fn().mockResolvedValue('success');

            const result = await circuitBreaker.execute(operation);

            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(1);
            expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
        });

        it('should reset failure count on success', async () => {
            const failingOperation = jest.fn().mockRejectedValue(new Error('failure'));
            const successOperation = jest.fn().mockResolvedValue('success');

            // Cause some failures
            await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
            await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();

            // Then succeed
            await circuitBreaker.execute(successOperation);

            const stats = circuitBreaker.getStats();
            expect(stats.failures).toBe(0); // Should be reset
            expect(stats.successes).toBe(1);
        });
    });

    describe('circuit opening', () => {
        it('should open circuit after failure threshold', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('failure'));

            // Cause failures to exceed threshold
            for (let i = 0; i < 3; i++) {
                await expect(circuitBreaker.execute(operation)).rejects.toThrow();
            }

            expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Circuit breaker OPEN - failure threshold exceeded',
                expect.objectContaining({ failures: 3, threshold: 3 })
            );
        });

        it('should reject requests when circuit is open', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('failure'));

            // Open the circuit
            for (let i = 0; i < 3; i++) {
                await expect(circuitBreaker.execute(operation)).rejects.toThrow();
            }

            // Next request should be rejected immediately
            await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is OPEN - request rejected');

            const stats = circuitBreaker.getStats();
            expect(stats.rejectedRequests).toBe(1);
        });
    });

    describe('circuit recovery', () => {
        beforeEach(async () => {
            // Open the circuit
            const failingOperation = jest.fn().mockRejectedValue(new Error('failure'));
            for (let i = 0; i < 3; i++) {
                await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
            }
            expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);
        });

        it('should transition to half-open after recovery timeout', async () => {
            const operation = jest.fn().mockResolvedValue('success');

            // Fast-forward time to exceed recovery timeout
            jest.advanceTimersByTime(1500);

            await circuitBreaker.execute(operation);

            expect(circuitBreaker.getStats().state).toBe(CircuitState.HALF_OPEN);
        });

        it('should close circuit after successful operations in half-open state', async () => {
            const operation = jest.fn().mockResolvedValue('success');

            // Fast-forward time and execute successful operations
            jest.advanceTimersByTime(1500);

            await circuitBreaker.execute(operation); // First success (half-open)
            await circuitBreaker.execute(operation); // Second success (should close)

            expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
            expect(mockLogger.info).toHaveBeenCalledWith('Circuit breaker CLOSED - service recovered');
        });

        it('should reopen circuit on failure in half-open state', async () => {
            const failingOperation = jest.fn().mockRejectedValue(new Error('still failing'));

            // Fast-forward time and try operation
            jest.advanceTimersByTime(1500);

            await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();

            expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);
            expect(mockLogger.warn).toHaveBeenCalledWith('Circuit breaker OPEN - half-open test failed');
        });
    });

    describe('statistics', () => {
        it('should track operation statistics', async () => {
            const successOperation = jest.fn().mockResolvedValue('success');
            const failingOperation = jest.fn().mockRejectedValue(new Error('failure'));

            await circuitBreaker.execute(successOperation);
            await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();

            const stats = circuitBreaker.getStats();
            expect(stats.totalRequests).toBe(2);
            expect(stats.successes).toBe(1);
            expect(stats.failures).toBe(1);
            expect(stats.lastSuccessTime).toBeDefined();
            expect(stats.lastFailureTime).toBeDefined();
        });

        it('should report healthy state when closed', () => {
            expect(circuitBreaker.isHealthy()).toBe(true);
        });

        it('should report unhealthy state when open', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('failure'));

            // Open the circuit
            for (let i = 0; i < 3; i++) {
                await expect(circuitBreaker.execute(operation)).rejects.toThrow();
            }

            expect(circuitBreaker.isHealthy()).toBe(false);
        });
    });

    describe('manual control', () => {
        it('should force open circuit', () => {
            circuitBreaker.forceOpen();

            expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);
            expect(mockLogger.warn).toHaveBeenCalledWith('Circuit breaker manually forced OPEN');
        });

        it('should force close circuit', async () => {
            // First open the circuit
            const operation = jest.fn().mockRejectedValue(new Error('failure'));
            for (let i = 0; i < 3; i++) {
                await expect(circuitBreaker.execute(operation)).rejects.toThrow();
            }

            // Then force close
            circuitBreaker.forceClose();

            expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
            expect(circuitBreaker.getStats().failures).toBe(0);
            expect(mockLogger.info).toHaveBeenCalledWith('Circuit breaker manually forced CLOSED');
        });
    });

    describe('LinkedIn-specific configuration', () => {
        it('should create LinkedIn-specific circuit breaker', () => {
            const linkedInBreaker = CircuitBreaker.forLinkedIn(mockLogger);
            const stats = linkedInBreaker.getStats();

            expect(stats.state).toBe(CircuitState.CLOSED);
            expect(linkedInBreaker.isHealthy()).toBe(true);
        });
    });
});

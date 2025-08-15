import { Logger } from './Logger';

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Circuit is open, requests fail fast
  HALF_OPEN = 'HALF_OPEN', // Testing if service is back
}

export interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures before opening
  recoveryTimeout: number; // Time to wait before trying again (ms)
  monitoringPeriod: number; // Time window for failure counting (ms)
  successThreshold: number; // Successes needed to close from half-open
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | undefined;
  lastSuccessTime: number | undefined;
  totalRequests: number;
  rejectedRequests: number;
}

/**
 * Circuit breaker pattern implementation for LinkedIn rate limiting protection
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private totalRequests: number = 0;
  private rejectedRequests: number = 0;
  private readonly options: CircuitBreakerOptions;
  private readonly logger: Logger | undefined;

  private static readonly DEFAULT_OPTIONS: CircuitBreakerOptions = {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    monitoringPeriod: 300000, // 5 minutes
    successThreshold: 3,
  };

  constructor(options: Partial<CircuitBreakerOptions> = {}, logger?: Logger) {
    this.options = { ...CircuitBreaker.DEFAULT_OPTIONS, ...options };
    this.logger = logger;
  }

  /**
   * Executes an operation through the circuit breaker
   */
  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.logger?.info('Circuit breaker transitioning to HALF_OPEN');
      } else {
        this.rejectedRequests++;
        throw new Error('Circuit breaker is OPEN - request rejected');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Handles successful operation
   */
  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.options.successThreshold) {
        this.reset();
        this.logger?.info('Circuit breaker CLOSED - service recovered');
      }
    } else {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

  /**
   * Handles failed operation
   */
  private onFailure(error: Error): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    this.logger?.debug('Circuit breaker recorded failure', {
      error: error.message,
      failures: this.failures,
      threshold: this.options.failureThreshold,
    });

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.logger?.warn('Circuit breaker OPEN - half-open test failed');
    } else if (this.state === CircuitState.CLOSED && this.shouldOpen()) {
      this.state = CircuitState.OPEN;
      this.logger?.warn('Circuit breaker OPEN - failure threshold exceeded', {
        failures: this.failures,
        threshold: this.options.failureThreshold,
      });
    }
  }

  /**
   * Checks if circuit should open based on failure threshold
   */
  private shouldOpen(): boolean {
    if (this.failures < this.options.failureThreshold) {
      return false;
    }

    // Check if failures occurred within monitoring period
    const now = Date.now();
    const monitoringStart = now - this.options.monitoringPeriod;

    return (this.lastFailureTime || 0) > monitoringStart;
  }

  /**
   * Checks if we should attempt to reset from open state
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) {
      return true;
    }

    const now = Date.now();
    return now - this.lastFailureTime >= this.options.recoveryTimeout;
  }

  /**
   * Resets the circuit breaker to closed state
   */
  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
  }

  /**
   * Gets current circuit breaker statistics
   */
  public getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      rejectedRequests: this.rejectedRequests,
    };
  }

  /**
   * Checks if circuit breaker is healthy
   */
  public isHealthy(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Forces circuit breaker to open (for testing or manual intervention)
   */
  public forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.lastFailureTime = Date.now();
    this.logger?.warn('Circuit breaker manually forced OPEN');
  }

  /**
   * Forces circuit breaker to close (for testing or manual intervention)
   */
  public forceClose(): void {
    this.reset();
    this.logger?.info('Circuit breaker manually forced CLOSED');
  }

  /**
   * Creates a LinkedIn-specific circuit breaker with appropriate settings
   */
  public static forLinkedIn(logger?: Logger): CircuitBreaker {
    return new CircuitBreaker(
      {
        failureThreshold: 3, // Open after 3 failures
        recoveryTimeout: 300000, // Wait 5 minutes before retry
        monitoringPeriod: 600000, // Monitor failures over 10 minutes
        successThreshold: 2, // Need 2 successes to close
      },
      logger
    );
  }
}

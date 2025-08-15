import { Logger } from './Logger';

/**
 * Categories of errors for retry logic
 */
export enum ErrorCategory {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  PUPPETEER = 'puppeteer',
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  UNKNOWN = 'unknown',
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: Error) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error | undefined;
  attempts: number;
  totalTime: number;
}

/**
 * Utility class for implementing retry logic with exponential backoff
 */
export class RetryUtils {
  private static readonly DEFAULT_OPTIONS: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryCondition: (error: Error) => {
      return this.isRetryableError(error);
    },
  };

  /**
   * Executes a function with retry logic and exponential backoff
   */
  public static async withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    logger?: Logger
  ): Promise<RetryResult<T>> {
    const config = { ...this.DEFAULT_OPTIONS, ...options };

    // Validate configuration
    this.validateRetryOptions(config);

    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        logger?.debug(
          `Attempting operation (attempt ${attempt}/${config.maxAttempts})`
        );

        const result = await operation();
        const totalTime = Date.now() - startTime;

        logger?.debug(`Operation succeeded on attempt ${attempt}`, {
          totalTime,
        });

        return {
          success: true,
          result,
          attempts: attempt,
          totalTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger?.debug(`Operation failed on attempt ${attempt}`, {
          error: lastError.message,
          attempt,
          maxAttempts: config.maxAttempts,
        });

        // Check if we should retry
        const shouldRetry =
          attempt < config.maxAttempts &&
          (!config.retryCondition || config.retryCondition(lastError));

        if (!shouldRetry) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const baseDelay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );

        // Add jitter (±25% of base delay) to prevent thundering herd
        const jitter = baseDelay * 0.25 * (Math.random() - 0.5);
        const delay = Math.max(0, baseDelay + jitter);

        logger?.debug(`Retrying in ${Math.round(delay)}ms...`);
        await this.delay(delay);
      }
    }

    const totalTime = Date.now() - startTime;

    return {
      success: false,
      error: lastError,
      attempts: config.maxAttempts,
      totalTime,
    };
  }

  /**
   * Retry specifically for Puppeteer page operations
   */
  public static async retryPageOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    logger?: Logger
  ): Promise<T> {
    const result = await this.withRetry(
      operation,
      {
        maxAttempts: 3,
        baseDelay: 2000,
        maxDelay: 8000,
        retryCondition: (error: Error) => {
          const category = this.categorizeError(error);
          return [
            ErrorCategory.NETWORK,
            ErrorCategory.TIMEOUT,
            ErrorCategory.PUPPETEER,
          ].includes(category);
        },
      },
      logger
    );

    if (!result.success) {
      throw new Error(
        `${operationName} failed after ${result.attempts} attempts: ${result.error?.message}`
      );
    }

    return result.result!;
  }

  /**
   * Categorizes an error for retry decision making
   */
  private static categorizeError(error: Error): ErrorCategory {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    if (errorName.includes('timeout') || errorMessage.includes('timeout')) {
      return ErrorCategory.TIMEOUT;
    }

    if (
      errorName.includes('network') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('etimedout')
    ) {
      return ErrorCategory.NETWORK;
    }

    if (
      errorMessage.includes('target closed') ||
      errorMessage.includes('node is detached') ||
      errorMessage.includes('protocol error')
    ) {
      return ErrorCategory.PUPPETEER;
    }

    if (
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('login')
    ) {
      return ErrorCategory.AUTHENTICATION;
    }

    if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests')
    ) {
      return ErrorCategory.RATE_LIMIT;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Determines if an error should trigger a retry
   */
  private static isRetryableError(error: Error): boolean {
    const category = this.categorizeError(error);

    // Don't retry authentication errors or unknown errors
    const nonRetryableCategories = [
      ErrorCategory.AUTHENTICATION,
      ErrorCategory.UNKNOWN,
    ];

    return !nonRetryableCategories.includes(category);
  }

  /**
   * Validates retry configuration options
   */
  private static validateRetryOptions(options: RetryOptions): void {
    if (options.maxAttempts < 1) {
      throw new Error('maxAttempts must be at least 1');
    }
    if (options.baseDelay < 0) {
      throw new Error('baseDelay must be non-negative');
    }
    if (options.maxDelay < options.baseDelay) {
      throw new Error('maxDelay must be greater than or equal to baseDelay');
    }
    if (options.backoffMultiplier <= 0) {
      throw new Error('backoffMultiplier must be positive');
    }
  }

  /**
   * Simple delay utility
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

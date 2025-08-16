import { Page } from 'puppeteer';
import { DelayUtils } from './DelayUtils';
import { Logger } from './Logger';

/**
 * Error categories for different types of failures
 */
export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  PARSING = 'parsing',
  APPLICATION = 'application',
  DETECTION = 'detection',
  CAPTCHA = 'captcha',
  TIMEOUT = 'timeout',
  CONFIGURATION = 'configuration',
  UNKNOWN = 'unknown',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low', // Non-critical, can continue
  MEDIUM = 'medium', // Significant but recoverable
  HIGH = 'high', // Critical, requires intervention
  FATAL = 'fatal', // Unrecoverable, must stop
}

/**
 * Retry configuration for different error types
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  shouldRetry: (error: Error, attempt: number) => boolean;
}

/**
 * Error context information
 */
export interface ErrorContext {
  category: ErrorCategory;
  severity: ErrorSeverity;
  url?: string;
  selector?: string;
  jobId?: string;
  sessionId?: string;
  timestamp: Date;
  userAgent?: string;
  retryAttempt?: number;
  additionalData?: Record<string, unknown>;
}

/**
 * Custom error class with enhanced context
 */
export class LinkedInBotError extends Error {
  public readonly context: ErrorContext;
  public readonly originalError: Error | undefined;

  constructor(
    message: string,
    context: Partial<ErrorContext> = {},
    originalError?: Error
  ) {
    super(message);
    this.name = 'LinkedInBotError';
    this.originalError = originalError;

    this.context = {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      timestamp: new Date(),
      ...context,
    };

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LinkedInBotError);
    }
  }
}

/**
 * Comprehensive error handling with retry logic and recovery strategies
 */
export class ErrorHandler {
  private static readonly DEFAULT_RETRY_CONFIGS: Record<
    ErrorCategory,
    RetryConfig
  > = {
    [ErrorCategory.NETWORK]: {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      multiplier: 2,
      shouldRetry: (_error: Error, attempt: number) => attempt <= 3,
    },
    [ErrorCategory.TIMEOUT]: {
      maxRetries: 2,
      baseDelayMs: 2000,
      maxDelayMs: 15000,
      multiplier: 2.5,
      shouldRetry: (_error: Error, attempt: number) => attempt <= 2,
    },
    [ErrorCategory.PARSING]: {
      maxRetries: 1,
      baseDelayMs: 500,
      maxDelayMs: 2000,
      multiplier: 2,
      shouldRetry: (_error: Error, attempt: number) => attempt <= 1,
    },
    [ErrorCategory.APPLICATION]: {
      maxRetries: 2,
      baseDelayMs: 3000,
      maxDelayMs: 12000,
      multiplier: 2,
      shouldRetry: (_error: Error, attempt: number) => attempt <= 2,
    },
    [ErrorCategory.DETECTION]: {
      maxRetries: 0, // Don't retry detection errors
      baseDelayMs: 0,
      maxDelayMs: 0,
      multiplier: 1,
      shouldRetry: () => false,
    },
    [ErrorCategory.CAPTCHA]: {
      maxRetries: 0, // CAPTCHA requires manual intervention
      baseDelayMs: 0,
      maxDelayMs: 0,
      multiplier: 1,
      shouldRetry: () => false,
    },
    [ErrorCategory.AUTHENTICATION]: {
      maxRetries: 1,
      baseDelayMs: 5000,
      maxDelayMs: 10000,
      multiplier: 2,
      shouldRetry: (_error: Error, attempt: number) => attempt <= 1,
    },
    [ErrorCategory.CONFIGURATION]: {
      maxRetries: 0, // Configuration errors are not retryable
      baseDelayMs: 0,
      maxDelayMs: 0,
      multiplier: 1,
      shouldRetry: () => false,
    },
    [ErrorCategory.UNKNOWN]: {
      maxRetries: 1,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
      multiplier: 2,
      shouldRetry: (_error: Error, attempt: number) => attempt <= 1,
    },
  };

  constructor(
    private logger: Logger,
    private page?: Page
  ) {}

  /**
   * Executes an operation with retry logic and error handling
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext> = {},
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const category = context.category || ErrorCategory.UNKNOWN;
    const retryConfig = {
      ...ErrorHandler.DEFAULT_RETRY_CONFIGS[category],
      ...customRetryConfig,
    };

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= retryConfig.maxRetries) {
      try {
        const result = await operation();

        // Log successful retry if this wasn't the first attempt
        if (attempt > 0) {
          this.logger.info(`Operation succeeded after ${attempt} retries`, {
            category,
            attempt,
            context,
          });
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        // Determine if we should retry
        const shouldRetry =
          attempt <= retryConfig.maxRetries &&
          retryConfig.shouldRetry(lastError, attempt);

        if (!shouldRetry) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryConfig.baseDelayMs *
            Math.pow(retryConfig.multiplier, attempt - 1),
          retryConfig.maxDelayMs
        );

        this.logger.warn(
          `Operation failed, retrying in ${delay}ms (attempt ${attempt}/${retryConfig.maxRetries})`,
          {
            error: lastError.message,
            category,
            attempt,
            delay,
            context,
          }
        );

        await DelayUtils.delay(delay);
      }
    }

    // All retries exhausted, throw enhanced error
    const enhancedError = this.enhanceError(lastError!, {
      ...context,
      retryAttempt: attempt - 1,
    });

    this.logger.error('Operation failed after all retries', {
      error: enhancedError.message,
      category: enhancedError.context.category,
      severity: enhancedError.context.severity,
      retries: attempt - 1,
      context: enhancedError.context,
    });

    throw enhancedError;
  }

  /**
   * Handles network-related errors with appropriate retry logic
   */
  public async handleNetworkError<T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    return this.executeWithRetry(operation, {
      ...context,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
    });
  }

  /**
   * Handles timeout errors with extended retry delays
   */
  public async handleTimeoutError<T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    return this.executeWithRetry(operation, {
      ...context,
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
    });
  }

  /**
   * Handles parsing errors with limited retries
   */
  public async handleParsingError<T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    return this.executeWithRetry(operation, {
      ...context,
      category: ErrorCategory.PARSING,
      severity: ErrorSeverity.LOW,
    });
  }

  /**
   * Handles application-specific errors
   */
  public async handleApplicationError<T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    return this.executeWithRetry(operation, {
      ...context,
      category: ErrorCategory.APPLICATION,
      severity: ErrorSeverity.MEDIUM,
    });
  }

  /**
   * Handles detection errors (no retry, immediate escalation)
   */
  public handleDetectionError(
    error: Error,
    context: Partial<ErrorContext> = {}
  ): LinkedInBotError {
    const enhancedError = this.enhanceError(error, {
      ...context,
      category: ErrorCategory.DETECTION,
      severity: ErrorSeverity.HIGH,
    });

    this.logger.error('Bot detection error - immediate intervention required', {
      error: enhancedError.message,
      context: enhancedError.context,
    });

    return enhancedError;
  }

  /**
   * Handles CAPTCHA errors (no retry, requires manual intervention)
   */
  public handleCaptchaError(
    error: Error,
    context: Partial<ErrorContext> = {}
  ): LinkedInBotError {
    const enhancedError = this.enhanceError(error, {
      ...context,
      category: ErrorCategory.CAPTCHA,
      severity: ErrorSeverity.HIGH,
    });

    this.logger.warn('CAPTCHA detected - manual intervention required', {
      error: enhancedError.message,
      context: enhancedError.context,
    });

    return enhancedError;
  }

  /**
   * Handles authentication errors with session recovery
   */
  public async handleAuthenticationError<T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    return this.executeWithRetry(operation, {
      ...context,
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
    });
  }

  /**
   * Handles configuration errors (no retry, immediate failure)
   */
  public handleConfigurationError(
    error: Error,
    context: Partial<ErrorContext> = {}
  ): LinkedInBotError {
    const enhancedError = this.enhanceError(error, {
      ...context,
      category: ErrorCategory.CONFIGURATION,
      severity: ErrorSeverity.FATAL,
    });

    this.logger.error('Configuration error - cannot continue', {
      error: enhancedError.message,
      context: enhancedError.context,
    });

    return enhancedError;
  }

  /**
   * Categorizes errors based on their characteristics
   */
  public categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network-related errors
    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      name.includes('networkerror')
    ) {
      return ErrorCategory.NETWORK;
    }

    // Timeout errors
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      name.includes('timeouterror')
    ) {
      return ErrorCategory.TIMEOUT;
    }

    // Authentication errors
    if (
      message.includes('login') ||
      message.includes('authentication') ||
      message.includes('unauthorized') ||
      message.includes('session expired')
    ) {
      return ErrorCategory.AUTHENTICATION;
    }

    // Parsing errors
    if (
      message.includes('parse') ||
      message.includes('selector') ||
      message.includes('element not found') ||
      message.includes('cannot read property')
    ) {
      return ErrorCategory.PARSING;
    }

    // Detection errors
    if (
      message.includes('detected') ||
      message.includes('blocked') ||
      message.includes('rate limit') ||
      message.includes('too many requests')
    ) {
      return ErrorCategory.DETECTION;
    }

    // CAPTCHA errors
    if (
      message.includes('captcha') ||
      message.includes('challenge') ||
      message.includes('verification')
    ) {
      return ErrorCategory.CAPTCHA;
    }

    // Configuration errors
    if (
      message.includes('config') ||
      message.includes('invalid') ||
      message.includes('missing required')
    ) {
      return ErrorCategory.CONFIGURATION;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Determines error severity based on category, error content, and context
   * Considers retry attempts, error patterns, and session state for dynamic severity assignment
   */
  public determineSeverity(
    error: Error,
    category: ErrorCategory,
    context: Partial<ErrorContext> = {}
  ): ErrorSeverity {
    // Base severity from category mapping
    let baseSeverity = this.getBaseSeverityForCategory(category);

    // Escalate severity based on retry attempts
    if (context.retryAttempt && context.retryAttempt > 2) {
      baseSeverity = this.escalateSeverity(baseSeverity);
    }

    // Analyze error message for severity hints
    const messageSeverity = this.analyzeSeverityFromMessage(error.message);
    if (messageSeverity > baseSeverity) {
      baseSeverity = messageSeverity;
    }

    // Context-specific adjustments
    if (context.sessionId && this.isSessionCritical(context)) {
      baseSeverity = this.escalateSeverity(baseSeverity);
    }

    return baseSeverity;
  }

  /**
   * Gets base severity for error category
   */
  private getBaseSeverityForCategory(category: ErrorCategory): ErrorSeverity {
    const severityMap: Record<ErrorCategory, ErrorSeverity> = {
      [ErrorCategory.CONFIGURATION]: ErrorSeverity.FATAL,
      [ErrorCategory.DETECTION]: ErrorSeverity.HIGH,
      [ErrorCategory.CAPTCHA]: ErrorSeverity.HIGH,
      [ErrorCategory.AUTHENTICATION]: ErrorSeverity.HIGH,
      [ErrorCategory.NETWORK]: ErrorSeverity.MEDIUM,
      [ErrorCategory.TIMEOUT]: ErrorSeverity.MEDIUM,
      [ErrorCategory.APPLICATION]: ErrorSeverity.MEDIUM,
      [ErrorCategory.PARSING]: ErrorSeverity.LOW,
      [ErrorCategory.UNKNOWN]: ErrorSeverity.LOW,
    };

    return severityMap[category] || ErrorSeverity.LOW;
  }

  /**
   * Escalates severity to the next level
   */
  private escalateSeverity(currentSeverity: ErrorSeverity): ErrorSeverity {
    const escalationMap: Record<ErrorSeverity, ErrorSeverity> = {
      [ErrorSeverity.LOW]: ErrorSeverity.MEDIUM,
      [ErrorSeverity.MEDIUM]: ErrorSeverity.HIGH,
      [ErrorSeverity.HIGH]: ErrorSeverity.FATAL,
      [ErrorSeverity.FATAL]: ErrorSeverity.FATAL, // Cannot escalate further
    };

    return escalationMap[currentSeverity];
  }

  /**
   * Analyzes error message for severity indicators
   */
  private analyzeSeverityFromMessage(message: string): ErrorSeverity {
    const lowerMessage = message.toLowerCase();

    // Fatal indicators
    if (
      lowerMessage.includes('fatal') ||
      lowerMessage.includes('critical') ||
      lowerMessage.includes('unrecoverable')
    ) {
      return ErrorSeverity.FATAL;
    }

    // High severity indicators
    if (
      lowerMessage.includes('blocked') ||
      lowerMessage.includes('banned') ||
      lowerMessage.includes('suspended') ||
      lowerMessage.includes('access denied')
    ) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity indicators
    if (
      lowerMessage.includes('failed') ||
      lowerMessage.includes('error') ||
      lowerMessage.includes('unable')
    ) {
      return ErrorSeverity.MEDIUM;
    }

    return ErrorSeverity.LOW;
  }

  /**
   * Determines if the current session context indicates critical state
   */
  private isSessionCritical(context: Partial<ErrorContext>): boolean {
    // Consider session critical if we have multiple error indicators
    return Boolean(
      context.retryAttempt &&
        context.retryAttempt > 1 &&
        context.jobId && // We're in the middle of processing a job
        (context.url?.includes('linkedin.com') || context.selector) // We're on LinkedIn
    );
  }

  /**
   * Enhances an error with additional context and categorization
   */
  public enhanceError(
    error: Error,
    context: Partial<ErrorContext> = {}
  ): LinkedInBotError {
    const category = context.category || this.categorizeError(error);
    const severity =
      context.severity || this.determineSeverity(error, category, context);

    const enhancedContext: ErrorContext = {
      category,
      severity,
      timestamp: new Date(),
      ...context,
    };

    // Add page context if available
    if (this.page) {
      enhancedContext.url = this.page.url();
      // Note: userAgent would require async call, skipping for simplicity
    }

    return new LinkedInBotError(error.message, enhancedContext, error);
  }

  /**
   * Handles graceful degradation for non-critical errors
   */
  public async handleGracefulDegradation<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (error) {
      const enhancedError = this.enhanceError(
        error instanceof Error ? error : new Error(String(error)),
        context
      );

      // Only use fallback for non-critical errors
      if (
        enhancedError.context.severity === ErrorSeverity.LOW ||
        enhancedError.context.severity === ErrorSeverity.MEDIUM
      ) {
        this.logger.warn('Primary operation failed, attempting fallback', {
          error: enhancedError.message,
          category: enhancedError.context.category,
          context: enhancedError.context,
        });

        try {
          return await fallbackOperation();
        } catch (fallbackError) {
          this.logger.error('Fallback operation also failed', {
            primaryError: enhancedError.message,
            fallbackError:
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError),
            context: enhancedError.context,
          });
          throw enhancedError; // Throw original error
        }
      }

      throw enhancedError;
    }
  }

  /**
   * Creates a circuit breaker for repeated failures
   */
  public createCircuitBreaker<T>(
    operation: () => Promise<T>,
    failureThreshold: number = 5,
    resetTimeoutMs: number = 60000
  ): () => Promise<T> {
    let failures = 0;
    let lastFailureTime = 0;
    let isOpen = false;

    return async (): Promise<T> => {
      // Check if circuit should be reset
      if (isOpen && Date.now() - lastFailureTime > resetTimeoutMs) {
        isOpen = false;
        failures = 0;
        this.logger.info('Circuit breaker reset - attempting operation');
      }

      // If circuit is open, fail fast
      if (isOpen) {
        throw new LinkedInBotError(
          'Circuit breaker is open - too many recent failures',
          {
            category: ErrorCategory.UNKNOWN,
            severity: ErrorSeverity.HIGH,
            additionalData: { failures, lastFailureTime },
          }
        );
      }

      try {
        const result = await operation();

        // Reset failure count on success
        if (failures > 0) {
          failures = 0;
          this.logger.info(
            'Circuit breaker - operation succeeded, resetting failure count'
          );
        }

        return result;
      } catch (error) {
        failures++;
        lastFailureTime = Date.now();

        if (failures >= failureThreshold) {
          isOpen = true;
          this.logger.error(
            `Circuit breaker opened after ${failures} failures`
          );
        }

        throw error;
      }
    };
  }

  /**
   * Logs error statistics for monitoring
   */
  public logErrorStatistics(errors: LinkedInBotError[]): void {
    const stats = {
      total: errors.length,
      byCategory: {} as Record<ErrorCategory, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      retryable: 0,
      nonRetryable: 0,
    };

    errors.forEach((error) => {
      const { category, severity } = error.context;

      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;

      const retryConfig = ErrorHandler.DEFAULT_RETRY_CONFIGS[category];
      if (retryConfig.maxRetries > 0) {
        stats.retryable++;
      } else {
        stats.nonRetryable++;
      }
    });

    this.logger.info('Error statistics summary', { stats });
  }
}

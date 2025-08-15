/**
 * Utility class for generating human-like delays and timing patterns
 * Focused purely on timing utilities - browser interactions moved to HumanLikeInteractions
 */
export class DelayUtils {
  // Default delay ranges for different actions (in milliseconds)
  private static readonly DEFAULT_DELAYS = {
    PAGE_LOAD: { min: 2000, max: 5000 },
    TYPING: { min: 50, max: 150 },
    CLICK: { min: 100, max: 300 },
    MOUSE_MOVE: { min: 50, max: 200 },
    FORM_FIELD: { min: 500, max: 1500 },
    BETWEEN_APPLICATIONS: { min: 10000, max: 30000 },
    SCROLL: { min: 200, max: 800 },
    CAPTCHA_PAUSE: { min: 30000, max: 60000 },
  };

  // Timeout constants for various operations
  private static readonly TIMEOUTS = {
    NOTIFICATION_INTERVAL: 5000,
  } as const;

  /**
   * Creates a random delay between min and max milliseconds
   * @param minMs Minimum delay in milliseconds
   * @param maxMs Maximum delay in milliseconds
   * @returns Promise that resolves after the delay
   */
  public static async randomDelay(minMs: number, maxMs: number): Promise<void> {
    if (minMs < 0 || maxMs < 0) {
      throw new Error('Delay values must be non-negative');
    }
    if (minMs >= maxMs) {
      throw new Error('Minimum delay must be less than maximum delay');
    }

    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Gets a random typing delay for human-like typing
   * @param minMs Minimum typing delay
   * @param maxMs Maximum typing delay
   * @returns Random delay value
   */
  public static getRandomTypingDelay(minMs: number, maxMs: number): number {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  }

  /**
   * Creates a fixed delay
   * @param ms Delay in milliseconds
   * @returns Promise that resolves after the delay
   */
  public static async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Creates delays appropriate for page loading with realistic variation
   * @param minMs Minimum delay (defaults to configured page load min)
   * @param maxMs Maximum delay (defaults to configured page load max)
   */
  public static async pageLoadDelay(
    minMs: number = DelayUtils.DEFAULT_DELAYS.PAGE_LOAD.min,
    maxMs: number = DelayUtils.DEFAULT_DELAYS.PAGE_LOAD.max
  ): Promise<void> {
    await DelayUtils.randomDelay(minMs, maxMs);
  }

  /**
   * Creates delays between form field interactions
   * @param minMs Minimum delay
   * @param maxMs Maximum delay
   */
  public static async formFieldDelay(
    minMs: number = DelayUtils.DEFAULT_DELAYS.FORM_FIELD.min,
    maxMs: number = DelayUtils.DEFAULT_DELAYS.FORM_FIELD.max
  ): Promise<void> {
    await DelayUtils.randomDelay(minMs, maxMs);
  }

  /**
   * Creates longer delays between job applications to avoid rate limiting
   * @param minMs Minimum delay
   * @param maxMs Maximum delay
   */
  public static async betweenApplicationsDelay(
    minMs: number = DelayUtils.DEFAULT_DELAYS.BETWEEN_APPLICATIONS.min,
    maxMs: number = DelayUtils.DEFAULT_DELAYS.BETWEEN_APPLICATIONS.max
  ): Promise<void> {
    await DelayUtils.randomDelay(minMs, maxMs);
  }

  /**
   * Creates a pause for CAPTCHA resolution with user notification
   * @param minMs Minimum pause duration
   * @param maxMs Maximum pause duration
   * @param notifyCallback Optional callback to notify about CAPTCHA pause
   */
  public static async captchaPause(
    minMs: number = DelayUtils.DEFAULT_DELAYS.CAPTCHA_PAUSE.min,
    maxMs: number = DelayUtils.DEFAULT_DELAYS.CAPTCHA_PAUSE.max,
    notifyCallback?: (remainingTime: number) => void
  ): Promise<void> {
    if (minMs < 0 || maxMs < 0 || minMs >= maxMs) {
      throw new Error(
        'Invalid delay parameters: minMs must be less than maxMs and both must be non-negative'
      );
    }

    const totalDelay = DelayUtils.getRandomDelay(minMs, maxMs);
    const intervalMs = DelayUtils.TIMEOUTS.NOTIFICATION_INTERVAL;
    let remainingTime = totalDelay;

    const interval = setInterval(() => {
      remainingTime -= intervalMs;
      if (notifyCallback) {
        notifyCallback(Math.max(0, remainingTime));
      }
    }, intervalMs);

    try {
      await DelayUtils.delay(totalDelay);
    } finally {
      clearInterval(interval);
    }
  }

  /**
   * Gets a random delay value within the specified range
   * @param minMs Minimum delay
   * @param maxMs Maximum delay
   * @returns Random delay value
   */
  public static getRandomDelay(minMs: number, maxMs: number): number {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  }

  /**
   * Validates delay configuration values
   * @param config Delay configuration object
   * @returns Validation result
   */
  public static validateDelayConfig(config: {
    minPageLoad: number;
    maxPageLoad: number;
    minTyping: number;
    maxTyping: number;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.minPageLoad < 0 || config.maxPageLoad < 0) {
      errors.push('Page load delays must be non-negative');
    }
    if (config.minPageLoad >= config.maxPageLoad) {
      errors.push('Minimum page load delay must be less than maximum');
    }
    if (config.minTyping < 0 || config.maxTyping < 0) {
      errors.push('Typing delays must be non-negative');
    }
    if (config.minTyping >= config.maxTyping) {
      errors.push('Minimum typing delay must be less than maximum');
    }
    if (config.maxPageLoad > 30000) {
      errors.push('Maximum page load delay should not exceed 30 seconds');
    }
    if (config.maxTyping > 1000) {
      errors.push('Maximum typing delay should not exceed 1 second');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Gets default delay configuration
   * @returns Default delay configuration object
   */
  public static getDefaultDelayConfig(): {
    minPageLoad: number;
    maxPageLoad: number;
    minTyping: number;
    maxTyping: number;
  } {
    return {
      minPageLoad: DelayUtils.DEFAULT_DELAYS.PAGE_LOAD.min,
      maxPageLoad: DelayUtils.DEFAULT_DELAYS.PAGE_LOAD.max,
      minTyping: DelayUtils.DEFAULT_DELAYS.TYPING.min,
      maxTyping: DelayUtils.DEFAULT_DELAYS.TYPING.max,
    };
  }

  /**
   * Creates a delay with jitter to avoid predictable patterns
   * @param baseMs Base delay in milliseconds
   * @param jitterPercent Percentage of jitter to add (0-100)
   * @returns Promise that resolves after the jittered delay
   */
  public static async jitteredDelay(
    baseMs: number,
    jitterPercent: number = 20
  ): Promise<void> {
    if (jitterPercent < 0 || jitterPercent > 100) {
      throw new Error('Jitter percent must be between 0 and 100');
    }

    const jitterAmount = (baseMs * jitterPercent) / 100;
    const minDelay = baseMs - jitterAmount;
    const maxDelay = baseMs + jitterAmount;

    await DelayUtils.randomDelay(Math.max(0, minDelay), maxDelay);
  }

  /**
   * Creates a series of delays with increasing intervals (exponential backoff)
   * @param baseMs Base delay in milliseconds
   * @param multiplier Multiplier for each subsequent delay
   * @param maxDelayMs Maximum delay cap
   * @param iterations Number of delays to create
   */
  public static async exponentialBackoff(
    baseMs: number,
    multiplier: number = 2,
    maxDelayMs: number = 30000,
    iterations: number = 3
  ): Promise<void> {
    let currentDelay = baseMs;

    for (let i = 0; i < iterations; i++) {
      await DelayUtils.delay(Math.min(currentDelay, maxDelayMs));
      currentDelay *= multiplier;
    }
  }

  /**
   * Gets delay configuration for specific interaction types
   * @param interactionType Type of interaction
   * @returns Delay configuration for the interaction type
   */
  public static getDelayForInteraction(
    interactionType: keyof typeof DelayUtils.DEFAULT_DELAYS
  ): { min: number; max: number } {
    return DelayUtils.DEFAULT_DELAYS[interactionType];
  }
}

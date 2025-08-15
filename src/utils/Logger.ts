import { LogLevel } from '../types';

/**
 * Log formatting options
 */
export enum LogFormat {
  PLAIN = 'plain',
  JSON = 'json',
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  level: LogLevel;
  format: LogFormat;
}

/**
 * Basic logging service for SessionManager requirements
 * Full implementation will be completed in task 10
 */
export class Logger {
  private static readonly LOG_LEVEL_PRIORITY = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
  } as const;

  private logLevel: LogLevel;
  private format: LogFormat;

  constructor(config: LoggerConfig | LogLevel = LogLevel.INFO) {
    if (typeof config === 'string') {
      // Backward compatibility: accept LogLevel directly
      this.logLevel = config;
      this.format = LogFormat.PLAIN;
    } else {
      this.logLevel = config.level;
      this.format = config.format ?? LogFormat.PLAIN;
    }
  }

  /**
   * Creates a logger with DEBUG level for development
   */
  public static createDebugLogger(format: LogFormat = LogFormat.PLAIN): Logger {
    return new Logger({ level: LogLevel.DEBUG, format });
  }

  /**
   * Creates a logger with INFO level for production (safer than ERROR-only)
   */
  public static createProductionLogger(format: LogFormat = LogFormat.JSON): Logger {
    return new Logger({ level: LogLevel.INFO, format });
  }

  /**
   * Creates a logger with ERROR level only (for critical production environments)
   */
  public static createErrorOnlyLogger(format: LogFormat = LogFormat.JSON): Logger {
    return new Logger({ level: LogLevel.ERROR, format });
  }

  /**
   * Creates a logger with JSON formatting
   */
  public static createJsonLogger(level: LogLevel = LogLevel.INFO): Logger {
    return new Logger({ level, format: LogFormat.JSON });
  }

  /**
   * Creates a logger with custom configuration
   */
  public static create(config: LoggerConfig): Logger {
    return new Logger(config);
  }

  /**
   * Updates the log level at runtime
   * @param level New log level
   * @returns This logger instance for method chaining
   */
  public setLogLevel(level: LogLevel): Logger {
    this.logLevel = level;
    return this;
  }

  /**
   * Updates the log format at runtime
   * @param format New log format
   * @returns This logger instance for method chaining
   */
  public setFormat(format: LogFormat): Logger {
    this.format = format;
    return this;
  }

  /**
   * Gets the current log level
   * @returns Current log level
   */
  public getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Gets the current log format
   * @returns Current log format
   */
  public getFormat(): LogFormat {
    return this.format;
  }

  /**
   * Checks if a specific log level would be logged
   * Useful for avoiding expensive operations when logging is disabled
   * @param level Log level to check
   * @returns True if the level would be logged
   */
  public isLevelEnabled(level: LogLevel): boolean {
    return this.shouldLog(level);
  }

  /**
   * Logs an info message
   * @param message Message to log
   * @param context Optional context data
   */
  public info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Logs a warning message
   * @param message Message to log
   * @param context Optional context data
   */
  public warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Logs an error message
   * @param message Message to log
   * @param context Optional context data
   */
  public error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Logs a debug message
   * @param message Message to log
   * @param context Optional context data
   */
  public debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Internal logging method
   * @param level Log level
   * @param message Message to log
   * @param context Optional context data
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    // Check if we should log this level
    if (!this.shouldLog(level)) {
      return;
    }

    const logMessage = this.formatMessage(level, message, context);

    // Use appropriate console method based on log level
    switch (level) {
      case LogLevel.ERROR:
        // eslint-disable-next-line no-console
        console.error(logMessage);
        break;
      case LogLevel.WARN:
        // eslint-disable-next-line no-console
        console.warn(logMessage);
        break;
      case LogLevel.DEBUG:
        // eslint-disable-next-line no-console
        console.debug(logMessage);
        break;
      default:
        // eslint-disable-next-line no-console
        console.info(logMessage);
    }
  }

  /**
   * Formats log message based on current format setting
   * @param level Log level
   * @param message Message to log
   * @param context Optional context data
   * @returns Formatted log message
   */
  private formatMessage(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): string {
    const timestamp = new Date().toISOString();

    if (this.format === LogFormat.JSON) {
      const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        message,
        ...(context && { context }),
      };
      return this.safeStringify(logEntry);
    }

    // Plain text format
    const contextStr = context ? ` ${this.safeStringify(context)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  /**
   * Determines if a message should be logged based on current log level
   * @param level Message log level
   * @returns True if message should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const currentPriority = Logger.LOG_LEVEL_PRIORITY[this.logLevel];
    const messagePriority = Logger.LOG_LEVEL_PRIORITY[level];

    // Handle case where level is not found (should not happen with proper typing)
    if (currentPriority === undefined || messagePriority === undefined) {
      return true; // Default to logging if level is unknown
    }

    return messagePriority >= currentPriority;
  }

  /**
   * Safely stringify context objects, handling circular references
   * @param context Context object to stringify
   * @returns Safe JSON string
   */
  private safeStringify(context: Record<string, unknown>): string {
    try {
      return JSON.stringify(context, this.getCircularReplacer());
    } catch {
      return '[Context serialization failed]';
    }
  }

  /**
   * Creates a replacer function to handle circular references in JSON.stringify
   * @returns Replacer function for JSON.stringify
   */
  private getCircularReplacer(): (key: string, value: unknown) => unknown {
    const seen = new WeakSet();
    return (_key: string, value: unknown): unknown => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    };
  }
}

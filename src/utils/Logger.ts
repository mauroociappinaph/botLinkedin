import * as fs from 'fs';
import * as path from 'path';
import { LogLevel } from '../types';

export { LogLevel };

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
  format?: LogFormat;
  enableFileLogging?: boolean;
  logDirectory?: string;
  maxFileSize?: number; // in MB
  maxFiles?: number;
  excludeSensitive?: boolean;
}

/**
 * Session statistics for monitoring
 */
export interface SessionStats {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  jobsProcessed: number;
  applicationsSubmitted: number;
  duplicatesSkipped: number;
  errorsEncountered: number;
  captchasChallenged: number;
  averageProcessingTime?: number;
}

/**
 * Session report structure for file output
 */
export interface SessionReport {
  sessionId: string;
  duration: string;
  summary: {
    jobsProcessed: number;
    applicationsSubmitted: number;
    duplicatesSkipped: number;
    errorsEncountered: number;
    captchasChallenged: number;
    successRate: string;
    averageProcessingTime: string;
  };
  startTime: string;
  endTime?: string;
}

/**
 * Comprehensive logging service with file rotation and monitoring capabilities
 * Supports multiple output levels, file-based logging, and session reporting
 */
export class Logger {
  private static readonly LOG_LEVEL_PRIORITY = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
  } as const;

  private static readonly SENSITIVE_FIELDS = [
    'password',
    'credentials',
    'token',
    'cookie',
    'session',
    'auth',
    'secret',
  ];

  private static readonly DEFAULT_MAX_FILE_SIZE = 10; // MB
  private static readonly DEFAULT_MAX_FILES = 5;
  private static readonly DEFAULT_LOG_DIR = 'logs';

  private logLevel: LogLevel;
  private format: LogFormat;
  private enableFileLogging: boolean;
  private logDirectory: string;
  private maxFileSize: number;
  private maxFiles: number;
  private excludeSensitive: boolean;
  private currentLogFile?: string;
  private sessionStats: Map<string, SessionStats> = new Map();

  constructor(config: LoggerConfig | LogLevel = LogLevel.INFO) {
    if (typeof config === 'string') {
      // Backward compatibility: accept LogLevel directly
      this.logLevel = config;
      this.format = LogFormat.PLAIN;
      this.enableFileLogging = false;
      this.logDirectory = Logger.DEFAULT_LOG_DIR;
      this.maxFileSize = Logger.DEFAULT_MAX_FILE_SIZE;
      this.maxFiles = Logger.DEFAULT_MAX_FILES;
      this.excludeSensitive = true;
    } else {
      this.logLevel = config.level;
      this.format = config.format ?? LogFormat.PLAIN;
      this.enableFileLogging = config.enableFileLogging ?? false;
      this.logDirectory = config.logDirectory ?? Logger.DEFAULT_LOG_DIR;
      this.maxFileSize = config.maxFileSize ?? Logger.DEFAULT_MAX_FILE_SIZE;
      this.maxFiles = config.maxFiles ?? Logger.DEFAULT_MAX_FILES;
      this.excludeSensitive = config.excludeSensitive ?? true;
    }

    if (this.enableFileLogging) {
      this.initializeFileLogging();
    }
  }

  /**
   * Creates a logger with DEBUG level for development
   */
  public static createDebugLogger(format: LogFormat = LogFormat.PLAIN): Logger {
    return new Logger({ level: LogLevel.DEBUG, format });
  }

  /**
   * Creates a logger with file logging enabled for production use
   */
  public static createFileLogger(
    level: LogLevel = LogLevel.INFO,
    logDirectory?: string
  ): Logger {
    return new Logger({
      level,
      format: LogFormat.JSON,
      enableFileLogging: true,
      logDirectory: logDirectory || Logger.DEFAULT_LOG_DIR,
      excludeSensitive: true,
    });
  }

  /**
   * Creates a logger with INFO level for production (safer than ERROR-only)
   */
  public static createProductionLogger(
    format: LogFormat = LogFormat.JSON
  ): Logger {
    return new Logger({ level: LogLevel.INFO, format });
  }

  /**
   * Creates a logger with ERROR level only (for critical production environments)
   */
  public static createErrorOnlyLogger(
    format: LogFormat = LogFormat.JSON
  ): Logger {
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
   * Starts tracking a new session
   * @param sessionId Unique session identifier
   * @returns Session stats object for tracking
   */
  public startSession(sessionId: string): SessionStats {
    const stats: SessionStats = {
      sessionId,
      startTime: new Date(),
      jobsProcessed: 0,
      applicationsSubmitted: 0,
      duplicatesSkipped: 0,
      errorsEncountered: 0,
      captchasChallenged: 0,
    };

    this.sessionStats.set(sessionId, stats);
    this.info('Session started', { sessionId, startTime: stats.startTime });
    return stats;
  }

  /**
   * Updates session statistics
   * @param sessionId Session identifier
   * @param updates Partial updates to apply
   */
  public updateSession(
    sessionId: string,
    updates: Partial<Omit<SessionStats, 'sessionId' | 'startTime'>>
  ): void {
    const stats = this.sessionStats.get(sessionId);
    if (stats) {
      Object.assign(stats, updates);
      this.debug('Session updated', { sessionId, updates });
    }
  }

  /**
   * Ends a session and generates summary report
   * @param sessionId Session identifier
   * @returns Final session statistics
   */
  public endSession(sessionId: string): SessionStats | null {
    const stats = this.sessionStats.get(sessionId);
    if (!stats) {
      this.warn('Attempted to end non-existent session', { sessionId });
      return null;
    }

    stats.endTime = new Date();
    const duration = stats.endTime.getTime() - stats.startTime.getTime();
    stats.averageProcessingTime =
      stats.jobsProcessed > 0 ? duration / stats.jobsProcessed : 0;

    this.generateSessionReport(stats);
    this.sessionStats.delete(sessionId);
    return stats;
  }

  /**
   * Gets current session statistics
   * @param sessionId Session identifier
   * @returns Current session stats or null if not found
   */
  public getSessionStats(sessionId: string): SessionStats | null {
    return this.sessionStats.get(sessionId) || null;
  }

  /**
   * Logs job processing activity
   * @param sessionId Session identifier
   * @param jobId Job identifier
   * @param action Action performed
   * @param context Additional context
   */
  public logJobActivity(
    sessionId: string,
    jobId: string,
    action: string,
    context?: Record<string, unknown>
  ): void {
    const sanitizedContext = this.excludeSensitive
      ? this.sanitizeContext(context)
      : context;

    this.info(`Job ${action}`, {
      sessionId,
      jobId,
      action,
      ...sanitizedContext,
    });
  }

  /**
   * Logs application activity
   * @param sessionId Session identifier
   * @param jobId Job identifier
   * @param success Whether application was successful
   * @param context Additional context
   */
  public logApplication(
    sessionId: string,
    jobId: string,
    success: boolean,
    context?: Record<string, unknown>
  ): void {
    const sanitizedContext = this.excludeSensitive
      ? this.sanitizeContext(context)
      : context;

    const level = success ? LogLevel.INFO : LogLevel.WARN;
    const message = success ? 'Application submitted' : 'Application failed';

    this.log(level, message, {
      sessionId,
      jobId,
      success,
      ...sanitizedContext,
    });

    // Update session stats
    this.updateSession(sessionId, {
      applicationsSubmitted: success
        ? (this.getSessionStats(sessionId)?.applicationsSubmitted || 0) + 1
        : this.getSessionStats(sessionId)?.applicationsSubmitted || 0,
      errorsEncountered: success
        ? this.getSessionStats(sessionId)?.errorsEncountered || 0
        : (this.getSessionStats(sessionId)?.errorsEncountered || 0) + 1,
    });
  }

  /**
   * Logs CAPTCHA challenge
   * @param sessionId Session identifier
   * @param type CAPTCHA type
   * @param resolved Whether it was resolved
   */
  public logCaptcha(sessionId: string, type: string, resolved: boolean): void {
    this.warn('CAPTCHA challenge encountered', {
      sessionId,
      type,
      resolved,
      timestamp: new Date(),
    });

    this.updateSession(sessionId, {
      captchasChallenged:
        (this.getSessionStats(sessionId)?.captchasChallenged || 0) + 1,
    });
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

    const sanitizedContext = this.excludeSensitive
      ? this.sanitizeContext(context)
      : context;

    const logMessage = this.formatMessage(level, message, sanitizedContext);

    // Console output
    this.outputToConsole(level, logMessage);

    // File output if enabled
    if (this.enableFileLogging) {
      this.outputToFile(logMessage);
    }
  }

  /**
   * Outputs log message to console
   * @param level Log level
   * @param message Formatted message
   */
  private outputToConsole(level: LogLevel, message: string): void {
    switch (level) {
      case LogLevel.ERROR:
        // eslint-disable-next-line no-console
        console.error(message);
        break;
      case LogLevel.WARN:
        // eslint-disable-next-line no-console
        console.warn(message);
        break;
      case LogLevel.DEBUG:
        // eslint-disable-next-line no-console
        console.debug(message);
        break;
      default:
        // eslint-disable-next-line no-console
        console.info(message);
    }
  }

  /**
   * Outputs log message to file
   * @param message Formatted message
   */
  private outputToFile(message: string): void {
    try {
      if (!this.currentLogFile) {
        this.currentLogFile = this.createLogFile();
      }

      // Check if current file needs rotation
      if (this.shouldRotateFile()) {
        this.rotateLogFile();
        this.currentLogFile = this.createLogFile();
      }

      fs.appendFileSync(this.currentLogFile, message + '\n', 'utf8');
    } catch (error) {
      // Fallback to console if file logging fails
      // eslint-disable-next-line no-console
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Initializes file logging system
   */
  private initializeFileLogging(): void {
    try {
      // Create log directory if it doesn't exist
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }

      // Clean up old log files if needed
      this.cleanupOldLogFiles();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize file logging:', error);
      this.enableFileLogging = false;
    }
  }

  /**
   * Creates a new log file with timestamp
   * @returns Path to the new log file
   */
  private createLogFile(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `linkedin-bot-${timestamp}.log`;
    return path.join(this.logDirectory, filename);
  }

  /**
   * Checks if current log file should be rotated
   * @returns True if file should be rotated
   */
  private shouldRotateFile(): boolean {
    if (!this.currentLogFile || !fs.existsSync(this.currentLogFile)) {
      return false;
    }

    try {
      const stats = fs.statSync(this.currentLogFile);
      const fileSizeMB = stats.size / (1024 * 1024);
      return fileSizeMB >= this.maxFileSize;
    } catch {
      return false;
    }
  }

  /**
   * Rotates the current log file
   */
  private rotateLogFile(): void {
    if (!this.currentLogFile) return;

    try {
      // Archive current file with rotation suffix
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivedName = this.currentLogFile.replace(
        '.log',
        `-archived-${timestamp}.log`
      );
      fs.renameSync(this.currentLogFile, archivedName);

      // Clean up old files after rotation
      this.cleanupOldLogFiles();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Cleans up old log files based on maxFiles setting
   */
  private cleanupOldLogFiles(): void {
    try {
      const files = fs
        .readdirSync(this.logDirectory)
        .filter((file) => file.endsWith('.log'))
        .map((file) => ({
          name: file,
          path: path.join(this.logDirectory, file),
          mtime: fs.statSync(path.join(this.logDirectory, file)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Remove files beyond maxFiles limit
      if (files.length > this.maxFiles) {
        const filesToDelete = files.slice(this.maxFiles);
        filesToDelete.forEach((file) => {
          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`Failed to delete old log file ${file.name}:`, error);
          }
        });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to cleanup old log files:', error);
    }
  }

  /**
   * Sanitizes context object to remove sensitive information
   * @param context Context object to sanitize
   * @param seen Set to track circular references
   * @returns Sanitized context object
   */
  private sanitizeContext(
    context?: Record<string, unknown>,
    seen: WeakSet<object> = new WeakSet()
  ): Record<string, unknown> | undefined {
    if (!context) return context;

    // Handle circular references
    if (seen.has(context)) {
      return { '[Circular Reference]': true };
    }
    seen.add(context);

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = Logger.SENSITIVE_FIELDS.some((field) =>
        lowerKey.includes(field)
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeContext(
          value as Record<string, unknown>,
          seen
        );
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Generates a comprehensive session report
   * @param stats Session statistics
   */
  private generateSessionReport(stats: SessionStats): void {
    const duration = stats.endTime
      ? stats.endTime.getTime() - stats.startTime.getTime()
      : 0;

    const report: SessionReport = {
      sessionId: stats.sessionId,
      duration: `${Math.round(duration / 1000)}s`,
      summary: {
        jobsProcessed: stats.jobsProcessed,
        applicationsSubmitted: stats.applicationsSubmitted,
        duplicatesSkipped: stats.duplicatesSkipped,
        errorsEncountered: stats.errorsEncountered,
        captchasChallenged: stats.captchasChallenged,
        successRate:
          stats.jobsProcessed > 0
            ? `${Math.round((stats.applicationsSubmitted / stats.jobsProcessed) * 100)}%`
            : '0%',
        averageProcessingTime: stats.averageProcessingTime
          ? `${Math.round(stats.averageProcessingTime)}ms`
          : 'N/A',
      },
      startTime: stats.startTime.toISOString(),
      ...(stats.endTime && { endTime: stats.endTime.toISOString() }),
    };

    // Log with sessionId as a top-level field for JSON format
    this.log(
      LogLevel.INFO,
      'Session completed',
      report as unknown as Record<string, unknown>
    );

    // Also write detailed report to file if file logging is enabled
    if (this.enableFileLogging) {
      this.writeSessionReportToFile(report);
    }
  }

  /**
   * Writes detailed session report to a separate file
   * @param report Session report data
   */
  private writeSessionReportToFile(report: SessionReport): void {
    try {
      const reportFile = path.join(
        this.logDirectory,
        `session-report-${report.sessionId}.json`
      );

      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to write session report:', error);
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
      const logEntry: Record<string, unknown> = {
        timestamp,
        level: level.toUpperCase(),
        message,
        ...(context && { context }),
      };

      // Include simple fields at top level for easier access, but avoid duplicating complex objects
      if (context) {
        for (const [key, value] of Object.entries(context)) {
          if (typeof value !== 'object' || value === null) {
            logEntry[key] = value;
          }
        }
      }

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

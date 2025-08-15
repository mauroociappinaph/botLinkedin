import { LogLevel } from '../types';

/**
 * Basic logging service for SessionManager requirements
 * Full implementation will be completed in task 10
 */
export class Logger {
  private logLevel: LogLevel;

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    this.logLevel = logLevel;
  }

  /**
   * Logs an info message
   * @param message Message to log
   * @param context Optional context data
   */
  public info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Logs a warning message
   * @param message Message to log
   * @param context Optional context data
   */
  public warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Logs an error message
   * @param message Message to log
   * @param context Optional context data
   */
  public error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Logs a debug message
   * @param message Message to log
   * @param context Optional context data
   */
  public debug(message: string, context?: Record<string, any>): void {
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
    context?: Record<string, any>
  ): void {
    // Check if we should log this level
    const levelOrder = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ];
    const currentLevelIndex = levelOrder.indexOf(this.logLevel);
    const messageLevelIndex = levelOrder.indexOf(level);

    if (messageLevelIndex < currentLevelIndex) {
      return;
    }

    const timestamp = new Date().toISOString();

    // Simple console output for now
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    console.log(
      `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`
    );
  }
}

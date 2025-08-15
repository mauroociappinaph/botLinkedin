/**
 * Utility for generating and managing correlation IDs for request tracing
 */

export class CorrelationId {
  private static current: string | null = null;

  /**
   * Generates a new correlation ID
   */
  public static generate(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sets the current correlation ID for the request context
   */
  public static set(id: string): void {
    this.current = id;
  }

  /**
   * Gets the current correlation ID
   */
  public static get(): string | null {
    return this.current;
  }

  /**
   * Clears the current correlation ID
   */
  public static clear(): void {
    this.current = null;
  }

  /**
   * Executes a function with a specific correlation ID
   */
  public static async withId<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const previousId = this.current;
    this.set(id);
    try {
      return await fn();
    } finally {
      if (previousId) {
        this.set(previousId);
      } else {
        this.clear();
      }
    }
  }
}

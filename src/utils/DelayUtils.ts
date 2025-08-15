/**
 * Utility class for generating human-like delays and timing
 * Basic implementation for SessionManager requirements
 */
export class DelayUtils {
  /**
   * Creates a random delay between min and max milliseconds
   * @param minMs Minimum delay in milliseconds
   * @param maxMs Maximum delay in milliseconds
   * @returns Promise that resolves after the delay
   */
  public static async randomDelay(minMs: number, maxMs: number): Promise<void> {
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
}

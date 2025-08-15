import { PrismaClient } from '@prisma/client';

/**
 * Database connection utilities and Prisma client management
 * Provides centralized database connection handling with proper lifecycle management
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private prisma: PrismaClient;
  private isConnected: boolean = false;

  private constructor() {
    this.prisma = new PrismaClient({
      log: ['error', 'warn'],
      errorFormat: 'pretty',
    });

    // Handle process termination gracefully
    process.on('beforeExit', () => {
      this.disconnect().catch(() => {
        // Silently handle disconnect errors during shutdown
      });
    });
  }

  /**
   * Get singleton instance of DatabaseService
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Get Prisma client instance
   */
  public getClient(): PrismaClient {
    return this.prisma;
  }

  /**
   * Connect to database
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.prisma.$connect();
      this.isConnected = true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to connect to database: ${errorMessage}`);
    }
  }

  /**
   * Disconnect from database
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to disconnect from database: ${errorMessage}`);
    }
  }

  /**
   * Test database connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if database is connected
   */
  public isConnectionActive(): boolean {
    return this.isConnected;
  }

  /**
   * Execute database operations within a transaction
   */
  public async transaction<T>(
    operation: (prisma: any) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      return operation(tx);
    });
  }
}

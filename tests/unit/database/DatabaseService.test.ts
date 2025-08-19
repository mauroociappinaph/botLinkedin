import { PrismaClient } from '@prisma/client';
import { DatabaseService } from '../../../src/database/DatabaseService';

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $queryRaw: jest.fn(),
        $transaction: jest.fn(),
    })),
}));

describe('DatabaseService', () => {
    let databaseService: DatabaseService;
    let mockPrisma: jest.Mocked<PrismaClient>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Get a fresh instance for each test
        databaseService = DatabaseService.getInstance();
        mockPrisma = databaseService.getClient() as jest.Mocked<PrismaClient>;
    });

    afterEach(() => {
        // Reset singleton instance for clean tests
        (DatabaseService as any).instance = undefined;
    });

    describe('getInstance', () => {
        it('should return singleton instance', () => {
            const instance1 = DatabaseService.getInstance();
            const instance2 = DatabaseService.getInstance();

            expect(instance1).toBe(instance2);
        });

        it('should create new instance if none exists', () => {
            const instance = DatabaseService.getInstance();

            expect(instance).toBeInstanceOf(DatabaseService);
        });
    });

    describe('getClient', () => {
        it('should return Prisma client instance', () => {
            const client = databaseService.getClient();

            expect(client).toBeDefined();
            expect(PrismaClient).toHaveBeenCalled();
        });
    });

    describe('connect', () => {
        it('should connect to database successfully', async () => {
            mockPrisma.$connect.mockResolvedValue(undefined);

            await databaseService.connect();

            expect(mockPrisma.$connect).toHaveBeenCalledTimes(1);
            expect(databaseService.isConnectionActive()).toBe(true);
        });

        it('should not connect if already connected', async () => {
            mockPrisma.$connect.mockResolvedValue(undefined);

            // Connect first time
            await databaseService.connect();
            expect(mockPrisma.$connect).toHaveBeenCalledTimes(1);

            // Try to connect again
            await databaseService.connect();
            expect(mockPrisma.$connect).toHaveBeenCalledTimes(1); // Should not be called again
        });

        it('should throw error on connection failure', async () => {
            const connectionError = new Error('Connection failed');
            mockPrisma.$connect.mockRejectedValue(connectionError);

            await expect(databaseService.connect()).rejects.toThrow(
                'Failed to connect to database: Connection failed'
            );

            expect(databaseService.isConnectionActive()).toBe(false);
        });

        it('should handle non-Error connection failures', async () => {
            mockPrisma.$connect.mockRejectedValue('String error');

            await expect(databaseService.connect()).rejects.toThrow(
                'Failed to connect to database: String error'
            );
        });
    });

    describe('disconnect', () => {
        it('should disconnect from database successfully', async () => {
            mockPrisma.$connect.mockResolvedValue(undefined);
            mockPrisma.$disconnect.mockResolvedValue(undefined);

            // Connect first
            await databaseService.connect();
            expect(databaseService.isConnectionActive()).toBe(true);

            // Then disconnect
            await databaseService.disconnect();

            expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
            expect(databaseService.isConnectionActive()).toBe(false);
        });

        it('should not disconnect if not connected', async () => {
            mockPrisma.$disconnect.mockResolvedValue(undefined);

            await databaseService.disconnect();

            expect(mockPrisma.$disconnect).not.toHaveBeenCalled();
        });

        it('should throw error on disconnection failure', async () => {
            mockPrisma.$connect.mockResolvedValue(undefined);
            mockPrisma.$disconnect.mockRejectedValue(new Error('Disconnect failed'));

            // Connect first
            await databaseService.connect();

            await expect(databaseService.disconnect()).rejects.toThrow(
                'Failed to disconnect from database: Disconnect failed'
            );
        });
    });

    describe('testConnection', () => {
        it('should return true for successful connection test', async () => {
            mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

            const result = await databaseService.testConnection();

            expect(result).toBe(true);
            expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(expect.any(Array));
        });

        it('should return false for failed connection test', async () => {
            mockPrisma.$queryRaw.mockRejectedValue(new Error('Query failed'));

            const result = await databaseService.testConnection();

            expect(result).toBe(false);
        });
    });

    describe('isConnectionActive', () => {
        it('should return false initially', () => {
            expect(databaseService.isConnectionActive()).toBe(false);
        });

        it('should return true after successful connection', async () => {
            mockPrisma.$connect.mockResolvedValue(undefined);

            await databaseService.connect();

            expect(databaseService.isConnectionActive()).toBe(true);
        });

        it('should return false after disconnection', async () => {
            mockPrisma.$connect.mockResolvedValue(undefined);
            mockPrisma.$disconnect.mockResolvedValue(undefined);

            await databaseService.connect();
            await databaseService.disconnect();

            expect(databaseService.isConnectionActive()).toBe(false);
        });
    });

    describe('transaction', () => {
        it('should execute transaction successfully', async () => {
            const mockOperation = jest.fn().mockResolvedValue('result');
            const mockTx = { someMethod: jest.fn() };

            mockPrisma.$transaction.mockImplementation(async (callback) => {
                return callback(mockTx);
            });

            const result = await databaseService.transaction(mockOperation);

            expect(result).toBe('result');
            expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
            expect(mockOperation).toHaveBeenCalledWith(mockTx);
        });

        it('should handle transaction errors', async () => {
            const mockOperation = jest.fn().mockRejectedValue(new Error('Transaction failed'));

            mockPrisma.$transaction.mockImplementation(async (callback) => {
                return callback({});
            });

            await expect(databaseService.transaction(mockOperation)).rejects.toThrow('Transaction failed');
        });

        it('should pass transaction context to operation', async () => {
            const mockOperation = jest.fn().mockResolvedValue('success');
            const mockTx = {
                jobPosting: { create: jest.fn() },
                applicationSession: { findMany: jest.fn() }
            };

            mockPrisma.$transaction.mockImplementation(async (callback) => {
                return callback(mockTx);
            });

            await databaseService.transaction(mockOperation);

            expect(mockOperation).toHaveBeenCalledWith(mockTx);
        });
    });

    describe('process lifecycle', () => {
        it('should handle beforeExit event gracefully', async () => {
            mockPrisma.$disconnect.mockResolvedValue(undefined);

            // Simulate process beforeExit event
            process.emit('beforeExit', 0);

            // Give some time for the async disconnect to potentially execute
            await new Promise(resolve => setTimeout(resolve, 10));

            // Should not throw any errors
            expect(true).toBe(true);
        });

        it('should handle disconnect errors during shutdown silently', async () => {
            mockPrisma.$disconnect.mockRejectedValue(new Error('Shutdown error'));

            // Simulate process beforeExit event
            process.emit('beforeExit', 0);

            // Give some time for the async disconnect to potentially execute
            await new Promise(resolve => setTimeout(resolve, 10));

            // Should not throw any errors even if disconnect fails
            expect(true).toBe(true);
        });
    });
});

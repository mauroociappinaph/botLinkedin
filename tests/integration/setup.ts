// Integration test setup file
// This file runs before each integration test

import { DatabaseService } from '../../src/database/DatabaseService';

// Extend Jest timeout for integration tests
jest.setTimeout(60000);

// Global database service for cleanup
let globalDatabaseService: DatabaseService;

// Add any global setup needed for integration tests
beforeAll(async () => {
    // Initialize database for integration tests
    globalDatabaseService = DatabaseService.getInstance();

    try {
        await globalDatabaseService.connect();
        console.log('Integration tests: Database connected successfully');
    } catch (error) {
        console.error('Integration tests: Failed to connect to database:', error);
        throw error;
    }
});

afterAll(async () => {
    // Global cleanup code
    if (globalDatabaseService) {
        try {
            // Clean up all test data
            const prisma = globalDatabaseService.getClient();
            await prisma.jobPosting.deleteMany();
            await prisma.applicationSession.deleteMany();

            // Disconnect from database
            await globalDatabaseService.disconnect();
            console.log('Integration tests: Database cleanup completed');
        } catch (error) {
            console.error('Integration tests: Cleanup error:', error);
        }
    }
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Suppress console output during tests unless explicitly needed
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
    // Suppress console output during tests
    console.log = jest.fn();
    console.warn = jest.fn();
    // Keep error logging for debugging
    console.error = originalConsoleError;
});

afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
});

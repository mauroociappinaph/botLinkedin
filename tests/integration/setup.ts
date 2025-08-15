// Integration test setup file
// This file runs before each integration test

// Extend Jest timeout for integration tests
jest.setTimeout(30000);

// Add any global setup needed for integration tests
beforeAll(async () => {
    // Global setup code here if needed
});

afterAll(async () => {
    // Global cleanup code here if needed
});

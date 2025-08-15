#!/usr/bin/env ts-node

import { LogLevel } from '../src/types';
import { LogFormat, Logger } from '../src/utils/Logger';

/**
 * Demonstration of Logger formatting options and runtime configuration
 */
function demonstrateLoggerFeatures(): void {
    console.log('=== Logger Feature Demonstration ===\n');

    // 1. Plain text formatting (default)
    console.log('1. Plain Text Format:');
    const plainLogger = Logger.createDebugLogger(LogFormat.PLAIN);
    plainLogger.info('Application started', { version: '1.0.0', env: 'development' });
    plainLogger.warn('This is a warning message');
    plainLogger.error('Error occurred', { code: 500, details: 'Internal server error' });
    plainLogger.debug('Debug information', { userId: 123, action: 'login' });

    console.log('\n2. JSON Format:');
    const jsonLogger = Logger.createJsonLogger(LogLevel.DEBUG);
    jsonLogger.info('Application started', { version: '1.0.0', env: 'development' });
    jsonLogger.warn('This is a warning message');
    jsonLogger.error('Error occurred', { code: 500, details: 'Internal server error' });
    jsonLogger.debug('Debug information', { userId: 123, action: 'login' });

    // 3. Runtime log level filtering
    console.log('\n3. Runtime Log Level Changes:');
    const runtimeLogger = new Logger({ level: LogLevel.ERROR, format: LogFormat.PLAIN });

    console.log('Logger set to ERROR level - only errors should appear:');
    runtimeLogger.debug('This debug message should NOT appear');
    runtimeLogger.info('This info message should NOT appear');
    runtimeLogger.warn('This warning should NOT appear');
    runtimeLogger.error('This error SHOULD appear');

    // Change level at runtime
    runtimeLogger.setLogLevel(LogLevel.INFO);
    console.log('\nLogger changed to INFO level - info, warn, and error should appear:');
    runtimeLogger.debug('This debug message should NOT appear');
    runtimeLogger.info('This info message SHOULD appear');
    runtimeLogger.warn('This warning SHOULD appear');
    runtimeLogger.error('This error SHOULD appear');

    // 4. Runtime format changes
    console.log('\n4. Runtime Format Changes:');
    runtimeLogger.setFormat(LogFormat.JSON);
    console.log('Format changed to JSON:');
    runtimeLogger.info('Now using JSON format', { feature: 'runtime-format-change' });

    // 5. Level checking for expensive operations
    console.log('\n5. Level Checking for Performance:');
    const perfLogger = new Logger({ level: LogLevel.WARN, format: LogFormat.PLAIN });

    if (perfLogger.isLevelEnabled(LogLevel.DEBUG)) {
        // This expensive operation won't run because DEBUG is disabled
        const expensiveData = generateExpensiveDebugData();
        perfLogger.debug('Expensive debug data', expensiveData);
    } else {
        console.log('Skipped expensive debug operation (DEBUG level disabled)');
    }

    if (perfLogger.isLevelEnabled(LogLevel.ERROR)) {
        perfLogger.error('This error will be logged');
    }

    // 6. Circular reference handling
    console.log('\n6. Circular Reference Handling:');
    const circularLogger = Logger.createJsonLogger();
    const obj: any = { name: 'test' };
    obj.self = obj; // Create circular reference

    circularLogger.info('Object with circular reference', { data: obj });

    console.log('\n=== Demo Complete ===');
}

/**
 * Simulates an expensive operation that should only run when debug logging is enabled
 */
function generateExpensiveDebugData(): Record<string, unknown> {
    console.log('Performing expensive debug data generation...');
    return {
        timestamp: Date.now(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        // Simulate expensive computation
        largeArray: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: Math.random() })),
    };
}

// Run the demonstration
if (require.main === module) {
    demonstrateLoggerFeatures();
}

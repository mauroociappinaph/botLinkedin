import { LogLevel } from '../../../src/types';
import { LogFormat, Logger } from '../../../src/utils/Logger';

// Mock console methods
const mockConsole = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// Replace console methods with mocks
Object.assign(console, mockConsole);

// Helper functions
function parseJsonLogEntry(mockCall: jest.MockedFunction<any>): Record<string, any> {
    const logCall = mockCall.mock.calls[0][0];
    return JSON.parse(logCall) as Record<string, any>;
}

describe('Logger', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        Object.values(mockConsole).forEach(mock => mock.mockClear());
    });

    describe('Constructor and Factory Methods', () => {
        it('should create logger with LogLevel parameter (backward compatibility)', () => {
            const logger = new Logger(LogLevel.DEBUG);
            expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
            expect(logger.getFormat()).toBe(LogFormat.PLAIN);
        });

        it('should create logger with config object', () => {
            const logger = new Logger({ level: LogLevel.WARN, format: LogFormat.JSON });
            expect(logger.getLogLevel()).toBe(LogLevel.WARN);
            expect(logger.getFormat()).toBe(LogFormat.JSON);
        });

        it('should create debug logger with factory method', () => {
            const logger = Logger.createDebugLogger(LogFormat.JSON);
            expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
            expect(logger.getFormat()).toBe(LogFormat.JSON);
        });

        it('should create production logger with factory method', () => {
            const logger = Logger.createProductionLogger();
            expect(logger.getLogLevel()).toBe(LogLevel.INFO);
            expect(logger.getFormat()).toBe(LogFormat.JSON);
        });

        it('should create error-only logger with factory method', () => {
            const logger = Logger.createErrorOnlyLogger();
            expect(logger.getLogLevel()).toBe(LogLevel.ERROR);
            expect(logger.getFormat()).toBe(LogFormat.JSON);
        });

        it('should create JSON logger with factory method', () => {
            const logger = Logger.createJsonLogger(LogLevel.WARN);
            expect(logger.getLogLevel()).toBe(LogLevel.WARN);
            expect(logger.getFormat()).toBe(LogFormat.JSON);
        });
    });

    describe('Runtime Configuration', () => {
        it('should update log level at runtime', () => {
            const logger = new Logger(LogLevel.ERROR);
            expect(logger.getLogLevel()).toBe(LogLevel.ERROR);

            logger.setLogLevel(LogLevel.DEBUG);
            expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
        });

        it('should update format at runtime', () => {
            const logger = new Logger({ level: LogLevel.INFO, format: LogFormat.PLAIN });
            expect(logger.getFormat()).toBe(LogFormat.PLAIN);

            logger.setFormat(LogFormat.JSON);
            expect(logger.getFormat()).toBe(LogFormat.JSON);
        });
    });

    describe('Log Level Filtering', () => {
        it('should respect log level hierarchy', () => {
            const logger = new Logger(LogLevel.WARN);

            logger.debug('debug message');
            logger.info('info message');
            logger.warn('warn message');
            logger.error('error message');

            expect(mockConsole.debug).not.toHaveBeenCalled();
            expect(mockConsole.info).not.toHaveBeenCalled();
            expect(mockConsole.warn).toHaveBeenCalledTimes(1);
            expect(mockConsole.error).toHaveBeenCalledTimes(1);
        });

        it('should check if level is enabled', () => {
            const logger = new Logger(LogLevel.WARN);

            expect(logger.isLevelEnabled(LogLevel.DEBUG)).toBe(false);
            expect(logger.isLevelEnabled(LogLevel.INFO)).toBe(false);
            expect(logger.isLevelEnabled(LogLevel.WARN)).toBe(true);
            expect(logger.isLevelEnabled(LogLevel.ERROR)).toBe(true);
        });
    });

    describe('Log Formatting', () => {
        it('should format plain text logs correctly', () => {
            const logger = new Logger({ level: LogLevel.DEBUG, format: LogFormat.PLAIN });

            logger.info('test message', { key: 'value' });

            expect(mockConsole.info).toHaveBeenCalledWith(
                expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: test message {"key":"value"}$/)
            );
        });

        it('should format JSON logs correctly', () => {
            const logger = new Logger({ level: LogLevel.DEBUG, format: LogFormat.JSON });

            logger.info('test message', { key: 'value' });

            const logEntry = parseJsonLogEntry(mockConsole.info);

            expect(logEntry).toMatchObject({
                level: 'INFO',
                message: 'test message',
                context: { key: 'value' }
            });
            expect(logEntry['timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        it('should handle logs without context', () => {
            const logger = new Logger({ level: LogLevel.DEBUG, format: LogFormat.PLAIN });

            logger.info('test message');

            expect(mockConsole.info).toHaveBeenCalledWith(
                expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: test message$/)
            );
        });
    });

    describe('Circular Reference Handling', () => {
        it('should handle circular references in context', () => {
            const logger = new Logger({ level: LogLevel.DEBUG, format: LogFormat.JSON });

            const obj: Record<string, any> = { name: 'test' };
            obj['self'] = obj; // Create circular reference

            logger.info('test message', { data: obj });

            const logEntry = parseJsonLogEntry(mockConsole.info);

            expect(logEntry['context']['data']['self']).toBe('[Circular Reference]');
        });

        it('should handle serialization failures gracefully', () => {
            const logger = new Logger({ level: LogLevel.DEBUG, format: LogFormat.PLAIN });

            // Create an object that will fail JSON.stringify
            const problematicObj = {};
            Object.defineProperty(problematicObj, 'badProp', {
                get() {
                    throw new Error('Serialization error');
                }
            });

            // Should not throw an error
            expect(() => {
                logger.info('test message', { data: problematicObj });
            }).not.toThrow();
        });
    });

    describe('Console Method Selection', () => {
        it('should use appropriate console methods for each log level', () => {
            const logger = new Logger(LogLevel.DEBUG);

            logger.debug('debug message');
            logger.info('info message');
            logger.warn('warn message');
            logger.error('error message');

            expect(mockConsole.debug).toHaveBeenCalledTimes(1);
            expect(mockConsole.info).toHaveBeenCalledTimes(1);
            expect(mockConsole.warn).toHaveBeenCalledTimes(1);
            expect(mockConsole.error).toHaveBeenCalledTimes(1);
        });
    });
});

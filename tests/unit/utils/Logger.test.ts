import * as fs from 'fs';
import { LogFormat, Logger, LogLevel } from '../../../src/utils/Logger';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Logger', () => {
    let consoleInfoSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let consoleDebugSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock console methods
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();

        // Mock fs methods
        mockFs.existsSync.mockReturnValue(true);
        mockFs.mkdirSync.mockImplementation();
        mockFs.appendFileSync.mockImplementation();
        mockFs.writeFileSync.mockImplementation();
        mockFs.readdirSync.mockReturnValue([]);
        mockFs.statSync.mockReturnValue({ size: 1024, mtime: new Date() } as any);
    });

    afterEach(() => {
        consoleInfoSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleDebugSpy.mockRestore();
    });

    describe('Basic Logging', () => {
        test('should log info messages at INFO level', () => {
            const logger = new Logger(LogLevel.INFO);
            logger.info('Test message');

            expect(consoleInfoSpy).toHaveBeenCalledWith(
                expect.stringContaining('INFO: Test message')
            );
        });

        test('should log error messages at INFO level', () => {
            const logger = new Logger(LogLevel.INFO);
            logger.error('Error message');

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('ERROR: Error message')
            );
        });

        test('should not log debug messages at INFO level', () => {
            const logger = new Logger(LogLevel.INFO);
            logger.debug('Debug message');

            expect(consoleDebugSpy).not.toHaveBeenCalled();
        });

        test('should log debug messages at DEBUG level', () => {
            const logger = new Logger(LogLevel.DEBUG);
            logger.debug('Debug message');

            expect(consoleDebugSpy).toHaveBeenCalledWith(
                expect.stringContaining('DEBUG: Debug message')
            );
        });
    });

    describe('Log Formatting', () => {
        test('should format messages in plain text format', () => {
            const logger = new Logger({
                level: LogLevel.INFO,
                format: LogFormat.PLAIN,
                excludeSensitive: false, // Disable sensitive filtering for this test
            });

            logger.info('Test message', { key: 'value' });

            expect(consoleInfoSpy).toHaveBeenCalledWith(
                expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: Test message {"key":"value"}/)
            );
        });

        test('should format messages in JSON format', () => {
            const logger = new Logger({
                level: LogLevel.INFO,
                format: LogFormat.JSON,
                excludeSensitive: false, // Disable sensitive filtering for this test
            });

            logger.info('Test message', { key: 'value' });

            const logCall = consoleInfoSpy.mock.calls[0][0];
            const logEntry = JSON.parse(logCall);

            expect(logEntry).toMatchObject({
                level: 'INFO',
                message: 'Test message',
                context: { key: 'value' },
            });
            expect(logEntry.timestamp).toBeDefined();
        });
    });

    describe('Sensitive Data Filtering', () => {
        test('should redact sensitive fields by default', () => {
            const logger = new Logger({
                level: LogLevel.INFO,
                format: LogFormat.JSON,
                excludeSensitive: true,
            });

            logger.info('Login attempt', {
                username: 'user@example.com',
                password: 'secret123',
                token: 'abc123',
                normalField: 'visible',
            });

            const logCall = consoleInfoSpy.mock.calls[0][0];
            const logEntry = JSON.parse(logCall);

            expect(logEntry.context.password).toBe('[REDACTED]');
            expect(logEntry.context.token).toBe('[REDACTED]');
            expect(logEntry.context.normalField).toBe('visible');
        });

        test('should not redact sensitive fields when disabled', () => {
            const logger = new Logger({
                level: LogLevel.INFO,
                format: LogFormat.JSON,
                excludeSensitive: false,
            });

            logger.info('Login attempt', {
                password: 'secret123',
                normalField: 'visible',
            });

            const logCall = consoleInfoSpy.mock.calls[0][0];
            const logEntry = JSON.parse(logCall);

            expect(logEntry.context.password).toBe('secret123');
            expect(logEntry.context.normalField).toBe('visible');
        });
    });

    describe('File Logging', () => {
        test('should initialize file logging directory', () => {
            mockFs.existsSync.mockReturnValue(false);

            new Logger({
                level: LogLevel.INFO,
                enableFileLogging: true,
                logDirectory: 'test-logs',
            });

            expect(mockFs.mkdirSync).toHaveBeenCalledWith('test-logs', { recursive: true });
        });

        test('should write logs to file when file logging is enabled', () => {
            const logger = new Logger({
                level: LogLevel.INFO,
                enableFileLogging: true,
                logDirectory: 'test-logs',
            });

            logger.info('Test message');

            expect(mockFs.appendFileSync).toHaveBeenCalledWith(
                expect.stringContaining('.log'),
                expect.stringContaining('INFO: Test message'),
                'utf8'
            );
        });

        test('should handle file logging errors gracefully', () => {
            mockFs.appendFileSync.mockImplementation(() => {
                throw new Error('File write error');
            });

            const logger = new Logger({
                level: LogLevel.INFO,
                enableFileLogging: true,
            });

            // Should not throw
            expect(() => logger.info('Test message')).not.toThrow();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to write to log file:',
                expect.any(Error)
            );
        });
    });

    describe('Session Tracking', () => {
        test('should start and track session statistics', () => {
            const logger = new Logger(LogLevel.INFO);
            const sessionId = 'test-session-123';

            const stats = logger.startSession(sessionId);

            expect(stats.sessionId).toBe(sessionId);
            expect(stats.startTime).toBeInstanceOf(Date);
            expect(stats.jobsProcessed).toBe(0);
            expect(stats.applicationsSubmitted).toBe(0);

            expect(consoleInfoSpy).toHaveBeenCalledWith(
                expect.stringContaining('Session started')
            );
        });

        test('should update session statistics', () => {
            const logger = new Logger(LogLevel.INFO);
            const sessionId = 'test-session-123';

            logger.startSession(sessionId);
            logger.updateSession(sessionId, {
                jobsProcessed: 5,
                applicationsSubmitted: 3,
            });

            const stats = logger.getSessionStats(sessionId);
            expect(stats?.jobsProcessed).toBe(5);
            expect(stats?.applicationsSubmitted).toBe(3);
        });

        test('should end session and generate report', () => {
            const logger = new Logger({
                level: LogLevel.INFO,
                format: LogFormat.JSON,
                excludeSensitive: false, // Disable sensitive filtering for this test
            });
            const sessionId = 'test-session-123';

            logger.startSession(sessionId);
            logger.updateSession(sessionId, {
                jobsProcessed: 10,
                applicationsSubmitted: 7,
            });

            const finalStats = logger.endSession(sessionId);

            expect(finalStats?.endTime).toBeInstanceOf(Date);
            expect(finalStats?.jobsProcessed).toBe(10);
            expect(finalStats?.applicationsSubmitted).toBe(7);

            // Check that session completed message was logged
            const sessionCompletedCall = consoleInfoSpy.mock.calls.find(call =>
                call[0].includes('Session completed')
            );
            expect(sessionCompletedCall).toBeDefined();

            // Parse the JSON log entry to verify content
            const logEntry = JSON.parse(sessionCompletedCall[0]);
            expect(logEntry.message).toBe('Session completed');
            expect(logEntry.sessionId).toBe(sessionId);
            expect(logEntry.summary.jobsProcessed).toBe(10);
            expect(logEntry.summary.applicationsSubmitted).toBe(7);
            expect(logEntry.summary.successRate).toBe('70%');

            // Session should be removed after ending
            expect(logger.getSessionStats(sessionId)).toBeNull();
        });

        test('should handle ending non-existent session', () => {
            const logger = new Logger(LogLevel.INFO);
            const result = logger.endSession('non-existent');

            expect(result).toBeNull();
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Attempted to end non-existent session')
            );
        });
    });

    describe('Job Activity Logging', () => {
        test('should log job activity with session context', () => {
            const logger = new Logger({
                level: LogLevel.INFO,
                format: LogFormat.JSON,
                excludeSensitive: false, // Disable sensitive filtering for this test
            });
            const sessionId = 'test-session';
            const jobId = 'job-123';

            logger.logJobActivity(sessionId, jobId, 'processed', {
                title: 'Software Engineer',
                company: 'Tech Corp',
            });

            // Check that job processed message was logged
            const jobProcessedCall = consoleInfoSpy.mock.calls.find(call =>
                call[0].includes('Job processed')
            );
            expect(jobProcessedCall).toBeDefined();

            // Parse the JSON log entry to verify content
            const logEntry = JSON.parse(jobProcessedCall[0]);
            expect(logEntry.message).toBe('Job processed');
            expect(logEntry.sessionId).toBe(sessionId);
            expect(logEntry.jobId).toBe(jobId);
            expect(logEntry.action).toBe('processed');
            expect(logEntry.title).toBe('Software Engineer');
            expect(logEntry.company).toBe('Tech Corp');
        });

        test('should log application results and update session stats', () => {
            const logger = new Logger({
                level: LogLevel.INFO,
                format: LogFormat.JSON,
                excludeSensitive: false, // Disable sensitive filtering for this test
            });
            const sessionId = 'test-session';
            const jobId = 'job-123';

            logger.startSession(sessionId);
            logger.logApplication(sessionId, jobId, true, {
                formFields: 5,
            });

            // Check that application submitted message was logged
            const applicationCall = consoleInfoSpy.mock.calls.find(call =>
                call[0].includes('Application submitted')
            );
            expect(applicationCall).toBeDefined();

            // Parse the JSON log entry to verify content
            const logEntry = JSON.parse(applicationCall[0]);
            expect(logEntry.message).toBe('Application submitted');
            expect(logEntry.sessionId).toBe(sessionId);
            expect(logEntry.jobId).toBe(jobId);
            expect(logEntry.success).toBe(true);
            expect(logEntry.formFields).toBe(5);

            const stats = logger.getSessionStats(sessionId);
            expect(stats?.applicationsSubmitted).toBe(1);
        });

        test('should log CAPTCHA challenges', () => {
            const logger = new Logger({
                level: LogLevel.INFO,
                format: LogFormat.JSON,
                excludeSensitive: false, // Disable sensitive filtering for this test
            });
            const sessionId = 'test-session';

            logger.startSession(sessionId);
            logger.logCaptcha(sessionId, 'recaptcha', true);

            // Check that CAPTCHA challenge message was logged
            const captchaCall = consoleWarnSpy.mock.calls.find(call =>
                call[0].includes('CAPTCHA challenge encountered')
            );
            expect(captchaCall).toBeDefined();

            // Parse the JSON log entry to verify content
            const logEntry = JSON.parse(captchaCall[0]);
            expect(logEntry.message).toBe('CAPTCHA challenge encountered');
            expect(logEntry.sessionId).toBe(sessionId);
            expect(logEntry.type).toBe('recaptcha');
            expect(logEntry.resolved).toBe(true);

            const stats = logger.getSessionStats(sessionId);
            expect(stats?.captchasChallenged).toBe(1);
        });
    });

    describe('Static Factory Methods', () => {
        test('should create debug logger', () => {
            const logger = Logger.createDebugLogger();
            expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
        });

        test('should create production logger', () => {
            const logger = Logger.createProductionLogger();
            expect(logger.getLogLevel()).toBe(LogLevel.INFO);
            expect(logger.getFormat()).toBe(LogFormat.JSON);
        });

        test('should create file logger', () => {
            const logger = Logger.createFileLogger(LogLevel.WARN, 'custom-logs');
            expect(logger.getLogLevel()).toBe(LogLevel.WARN);
        });

        test('should create JSON logger', () => {
            const logger = Logger.createJsonLogger(LogLevel.ERROR);
            expect(logger.getLogLevel()).toBe(LogLevel.ERROR);
            expect(logger.getFormat()).toBe(LogFormat.JSON);
        });
    });

    describe('Log Level Management', () => {
        test('should update log level at runtime', () => {
            const logger = new Logger(LogLevel.INFO);
            logger.setLogLevel(LogLevel.DEBUG);

            expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
        });

        test('should update log format at runtime', () => {
            const logger = new Logger(LogLevel.INFO);
            logger.setFormat(LogFormat.JSON);

            expect(logger.getFormat()).toBe(LogFormat.JSON);
        });

        test('should check if log level is enabled', () => {
            const logger = new Logger(LogLevel.WARN);

            expect(logger.isLevelEnabled(LogLevel.ERROR)).toBe(true);
            expect(logger.isLevelEnabled(LogLevel.WARN)).toBe(true);
            expect(logger.isLevelEnabled(LogLevel.INFO)).toBe(false);
            expect(logger.isLevelEnabled(LogLevel.DEBUG)).toBe(false);
        });
    });

    describe('Circular Reference Handling', () => {
        test('should handle circular references in context objects', () => {
            const logger = new Logger({
                level: LogLevel.INFO,
                format: LogFormat.JSON,
            });

            const circularObj: any = { name: 'test' };
            circularObj.self = circularObj;

            // Should not throw
            expect(() => logger.info('Test with circular ref', circularObj)).not.toThrow();

            const logCall = consoleInfoSpy.mock.calls[0][0];
            expect(logCall).toContain('[Circular Reference]');
        });
    });
});

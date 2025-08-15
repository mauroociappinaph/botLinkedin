import { Logger, LogLevel } from '../../../src/utils/Logger';
import { PerformanceMonitor } from '../../../src/utils/PerformanceMonitor';

describe('PerformanceMonitor', () => {
    let performanceMonitor: PerformanceMonitor;
    let mockLogger: Logger;

    beforeEach(() => {
        mockLogger = new Logger(LogLevel.DEBUG);
        jest.spyOn(mockLogger, 'debug').mockImplementation();
        jest.spyOn(mockLogger, 'info').mockImplementation();
        jest.spyOn(mockLogger, 'warn').mockImplementation();

        performanceMonitor = new PerformanceMonitor(mockLogger);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('timer operations', () => {
        it('should start and end timer correctly', () => {
            performanceMonitor.startTimer('test-operation');

            // Simulate some time passing
            jest.advanceTimersByTime(100);

            const duration = performanceMonitor.endTimer('test-operation');

            expect(duration).toBeGreaterThan(0);
            expect(mockLogger.debug).toHaveBeenCalledWith('Started timing: test-operation', undefined);
            expect(mockLogger.debug).toHaveBeenCalledWith('Completed timing: test-operation', expect.objectContaining({
                duration: expect.stringContaining('ms'),
                success: true
            }));
        });

        it('should handle ending non-existent timer', () => {
            const duration = performanceMonitor.endTimer('non-existent');

            expect(duration).toBe(0);
            expect(mockLogger.warn).toHaveBeenCalledWith("Timer 'non-existent' was not started");
        });

        it('should include metadata in timer', () => {
            const metadata = { url: 'https://example.com', type: 'page_load' };

            performanceMonitor.startTimer('test-operation', metadata);
            performanceMonitor.endTimer('test-operation', { success: true });

            const report = performanceMonitor.getReport();
            expect(report.metrics[0].metadata).toEqual({
                ...metadata,
                success: true
            });
        });
    });

    describe('timeOperation', () => {
        it('should time successful operation', async () => {
            const operation = jest.fn().mockResolvedValue('result');

            const result = await performanceMonitor.timeOperation(
                'async-operation',
                operation,
                { type: 'test' }
            );

            expect(result).toBe('result');
            expect(operation).toHaveBeenCalledTimes(1);

            const report = performanceMonitor.getReport();
            expect(report.metrics).toHaveLength(1);
            expect(report.metrics[0].name).toBe('async-operation');
            expect(report.metrics[0].metadata?.success).toBe(true);
        });

        it('should time failed operation', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('Test error'));

            await expect(
                performanceMonitor.timeOperation('failed-operation', operation)
            ).rejects.toThrow('Test error');

            const report = performanceMonitor.getReport();
            expect(report.metrics[0].metadata?.success).toBe(false);
            expect(report.metrics[0].metadata?.error).toBe('Test error');
        });
    });

    describe('specialized timing methods', () => {
        it('should time page load operation', async () => {
            const operation = jest.fn().mockResolvedValue('loaded');

            const result = await performanceMonitor.timePageLoad(
                'https://example.com',
                operation
            );

            expect(result).toBe('loaded');

            const report = performanceMonitor.getReport();
            expect(report.metrics[0].metadata?.type).toBe('page_load');
            expect(report.metrics[0].metadata?.url).toBe('https://example.com');
        });

        it('should time selector wait operation', async () => {
            const operation = jest.fn().mockResolvedValue('found');

            const result = await performanceMonitor.timeSelectorWait(
                '.test-selector',
                operation
            );

            expect(result).toBe('found');

            const report = performanceMonitor.getReport();
            expect(report.metrics[0].metadata?.type).toBe('selector_wait');
            expect(report.metrics[0].metadata?.selector).toBe('.test-selector');
        });
    });

    describe('reporting', () => {
        beforeEach(() => {
            // Add some test metrics
            performanceMonitor.startTimer('operation1', { type: 'page_load' });
            jest.advanceTimersByTime(1000);
            performanceMonitor.endTimer('operation1');

            performanceMonitor.startTimer('operation2', { type: 'page_load' });
            jest.advanceTimersByTime(2000);
            performanceMonitor.endTimer('operation2');

            performanceMonitor.startTimer('operation3', { type: 'selector_wait' });
            jest.advanceTimersByTime(500);
            performanceMonitor.endTimer('operation3');
        });

        it('should generate correct performance report', () => {
            const report = performanceMonitor.getReport();

            expect(report.metrics).toHaveLength(3);
            expect(report.totalDuration).toBeGreaterThan(0);
            expect(report.totalPageLoads).toBe(2);
            expect(report.averagePageLoadTime).toBeGreaterThan(0);
            expect(report.slowestOperations).toHaveLength(3);
        });

        it('should get metrics by type', () => {
            const pageLoadMetrics = performanceMonitor.getMetricsByType('page_load');
            const selectorWaitMetrics = performanceMonitor.getMetricsByType('selector_wait');

            expect(pageLoadMetrics).toHaveLength(2);
            expect(selectorWaitMetrics).toHaveLength(1);
        });

        it('should detect slow operations', () => {
            expect(performanceMonitor.hasSlowOperations(100)).toBe(true);
            expect(performanceMonitor.hasSlowOperations(10000)).toBe(false);
        });

        it('should log performance summary', () => {
            performanceMonitor.logSummary();

            expect(mockLogger.info).toHaveBeenCalledWith('Performance Summary', expect.objectContaining({
                totalDuration: expect.stringContaining('ms'),
                totalOperations: 3,
                averagePageLoadTime: expect.stringContaining('ms'),
                totalPageLoads: 2
            }));
        });

        it('should clear metrics', () => {
            performanceMonitor.clear();

            const report = performanceMonitor.getReport();
            expect(report.metrics).toHaveLength(0);
            expect(report.totalDuration).toBe(0);
        });
    });
});

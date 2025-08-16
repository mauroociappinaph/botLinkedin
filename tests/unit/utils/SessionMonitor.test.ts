import { Logger, LogLevel, SessionStats } from '../../../src/utils/Logger';
import { AlertConfig, SessionMonitor } from '../../../src/utils/SessionMonitor';

// Mock process methods
const mockMemoryUsage = jest.fn();
const mockCpuUsage = jest.fn();
const mockUptime = jest.fn();

Object.defineProperty(process, 'memoryUsage', {
    value: mockMemoryUsage,
});

Object.defineProperty(process, 'cpuUsage', {
    value: mockCpuUsage,
});

Object.defineProperty(process, 'uptime', {
    value: mockUptime,
});

describe('SessionMonitor', () => {
    let logger: Logger;
    let monitor: SessionMonitor;
    let consoleInfoSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Mock console methods
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        // Mock process methods
        mockMemoryUsage.mockReturnValue({
            rss: 100 * 1024 * 1024, // 100MB
            heapTotal: 80 * 1024 * 1024, // 80MB
            heapUsed: 60 * 1024 * 1024, // 60MB
            external: 10 * 1024 * 1024, // 10MB
            arrayBuffers: 5 * 1024 * 1024, // 5MB
        });

        mockCpuUsage.mockReturnValue({
            user: 1000000, // 1 second in microseconds
            system: 500000, // 0.5 seconds in microseconds
        });

        mockUptime.mockReturnValue(3600); // 1 hour

        logger = new Logger(LogLevel.INFO);
        monitor = new SessionMonitor(logger);
    });

    afterEach(() => {
        jest.useRealTimers();
        consoleInfoSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    describe('Performance Monitoring', () => {
        test('should start monitoring with specified interval', () => {
            monitor.startMonitoring(5000);

            expect(consoleInfoSpy).toHaveBeenCalledWith(
                expect.stringContaining('Starting session monitoring'),
                expect.objectContaining({
                    interval: '5000ms',
                })
            );

            // Fast-forward time to trigger monitoring
            jest.advanceTimersByTime(5000);

            // Should have collected metrics
            const history = monitor.getPerformanceHistory();
            expect(history.length).toBe(1);
        });

        test('should stop monitoring', () => {
            monitor.startMonitoring(1000);
            monitor.stopMonitoring();

            expect(consoleInfoSpy).toHaveBeenCalledWith(
                expect.stringContaining('Session monitoring stopped')
            );

            // Advance time - should not collect more metrics
            const initialHistory = monitor.getPerformanceHistory();
            jest.advanceTimersByTime(2000);
            const finalHistory = monitor.getPerformanceHistory();

            expect(finalHistory.length).toBe(initialHistory.length);
        });

        test('should collect current performance metrics', () => {
            const metrics = monitor.getCurrentMetrics();

            expect(metrics).toMatchObject({
                memoryUsage: expect.objectContaining({
                    heapUsed: 60 * 1024 * 1024,
                }),
                cpuUsage: expect.objectContaining({
                    user: 1000000,
                    system: 500000,
                }),
                uptime: 3600,
                timestamp: expect.any(Date),
            });
        });

        test('should maintain performance history with size limit', () => {
            monitor.startMonitoring(100);

            // Generate more than max history size (100)
            for (let i = 0; i < 150; i++) {
                jest.advanceTimersByTime(100);
            }

            const history = monitor.getPerformanceHistory();
            expect(history.length).toBeLessThanOrEqual(100);
        });

        test('should return limited performance history', () => {
            monitor.startMonitoring(100);

            // Generate some history
            for (let i = 0; i < 10; i++) {
                jest.advanceTimersByTime(100);
            }

            const limitedHistory = monitor.getPerformanceHistory(5);
            expect(limitedHistory.length).toBe(5);
        });
    });

    describe('Alert System', () => {
        test('should generate memory usage alert', () => {
            const alertConfig: AlertConfig = {
                maxMemoryMB: 50, // Set lower than current usage (60MB)
            };

            monitor = new SessionMonitor(logger, alertConfig);
            monitor.startMonitoring(1000);

            // Trigger monitoring cycle
            jest.advanceTimersByTime(1000);

            const alerts = monitor.getActiveAlerts();
            expect(alerts.length).toBe(1);
            expect(alerts[0]).toMatchObject({
                type: 'memory',
                severity: 'warning',
                value: 60,
                threshold: 50,
            });

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Alert generated'),
                expect.objectContaining({
                    type: 'memory',
                })
            );
        });

        test('should generate critical memory alert for very high usage', () => {
            // Mock very high memory usage
            mockMemoryUsage.mockReturnValue({
                rss: 200 * 1024 * 1024,
                heapTotal: 180 * 1024 * 1024,
                heapUsed: 160 * 1024 * 1024, // 160MB
                external: 20 * 1024 * 1024,
                arrayBuffers: 10 * 1024 * 1024,
            });

            const alertConfig: AlertConfig = {
                maxMemoryMB: 100, // 160MB > 100MB * 1.5 = critical
            };

            monitor = new SessionMonitor(logger, alertConfig);
            monitor.startMonitoring(1000);

            jest.advanceTimersByTime(1000);

            const alerts = monitor.getActiveAlerts();
            expect(alerts[0].severity).toBe('critical');
        });

        test('should not duplicate similar alerts', () => {
            const alertConfig: AlertConfig = {
                maxMemoryMB: 50,
            };

            monitor = new SessionMonitor(logger, alertConfig);
            monitor.startMonitoring(1000);

            // Trigger multiple monitoring cycles
            jest.advanceTimersByTime(1000);
            jest.advanceTimersByTime(1000);
            jest.advanceTimersByTime(1000);

            const alerts = monitor.getActiveAlerts();
            expect(alerts.length).toBe(1); // Should not duplicate
        });

        test('should clear all alerts', () => {
            const alertConfig: AlertConfig = {
                maxMemoryMB: 50,
            };

            monitor = new SessionMonitor(logger, alertConfig);
            monitor.startMonitoring(1000);

            jest.advanceTimersByTime(1000);
            expect(monitor.getActiveAlerts().length).toBe(1);

            monitor.clearAlerts();
            expect(monitor.getActiveAlerts().length).toBe(0);

            expect(consoleInfoSpy).toHaveBeenCalledWith(
                expect.stringContaining('All alerts cleared')
            );
        });
    });

    describe('Session Performance Analysis', () => {
        test('should analyze session performance', () => {
            const sessionStats: SessionStats = {
                sessionId: 'test-session',
                startTime: new Date(),
                endTime: new Date(),
                jobsProcessed: 100,
                applicationsSubmitted: 75,
                duplicatesSkipped: 10,
                errorsEncountered: 5,
                captchasChallenged: 2,
                averageProcessingTime: 1500,
            };

            const analysis = monitor.analyzeSessionPerformance(sessionStats);

            expect(analysis).toMatchObject({
                sessionId: 'test-session',
                performance: {
                    errorRate: 5, // 5/100 * 100
                    successRate: 75, // 75/100 * 100
                    captchaRate: 2, // 2/100 * 100
                    averageProcessingTime: 1500,
                    memoryUsageMB: 60,
                },
                health: {
                    status: expect.any(String),
                    recommendations: expect.any(Array),
                },
                alerts: expect.any(Array),
                timestamp: expect.any(Date),
            });

            expect(consoleInfoSpy).toHaveBeenCalledWith(
                expect.stringContaining('Session performance analysis completed'),
                analysis
            );
        });

        test('should determine healthy status for good metrics', () => {
            const sessionStats: SessionStats = {
                sessionId: 'test-session',
                startTime: new Date(),
                jobsProcessed: 100,
                applicationsSubmitted: 90,
                duplicatesSkipped: 5,
                errorsEncountered: 2,
                captchasChallenged: 1,
            };

            const analysis = monitor.analyzeSessionPerformance(sessionStats);
            expect(analysis.health.status).toBe('healthy');
        });

        test('should determine warning status for moderate issues', () => {
            const alertConfig: AlertConfig = {
                maxErrorRate: 10,
                minSuccessRate: 80,
            };

            monitor = new SessionMonitor(logger, alertConfig);

            const sessionStats: SessionStats = {
                sessionId: 'test-session',
                startTime: new Date(),
                jobsProcessed: 100,
                applicationsSubmitted: 70, // Below min success rate
                duplicatesSkipped: 10,
                errorsEncountered: 15, // Above max error rate
                captchasChallenged: 2,
            };

            const analysis = monitor.analyzeSessionPerformance(sessionStats);
            expect(analysis.health.status).toBe('warning');
        });

        test('should generate appropriate recommendations', () => {
            const alertConfig: AlertConfig = {
                maxErrorRate: 5,
                minSuccessRate: 80,
                maxCaptchaRate: 3,
            };

            monitor = new SessionMonitor(logger, alertConfig);

            const sessionStats: SessionStats = {
                sessionId: 'test-session',
                startTime: new Date(),
                jobsProcessed: 100,
                applicationsSubmitted: 60,
                duplicatesSkipped: 10,
                errorsEncountered: 10,
                captchasChallenged: 5,
            };

            const analysis = monitor.analyzeSessionPerformance(sessionStats);

            expect(analysis.health.recommendations).toContain(
                'Consider increasing delays between actions to reduce errors'
            );
            expect(analysis.health.recommendations).toContain(
                'Review job search criteria to target more suitable positions'
            );
            expect(analysis.health.recommendations).toContain(
                'Increase stealth measures and reduce automation speed'
            );
        });
    });

    describe('Monitoring Report Generation', () => {
        test('should generate comprehensive monitoring report', () => {
            monitor.startMonitoring(1000);

            // Generate some history
            for (let i = 0; i < 5; i++) {
                jest.advanceTimersByTime(1000);
            }

            const report = monitor.generateMonitoringReport();

            expect(report).toMatchObject({
                timestamp: expect.any(Date),
                currentMetrics: {
                    memoryUsageMB: 60,
                    memoryLimitMB: 512, // Default limit
                    uptime: 3600,
                    cpuUser: 1000000,
                    cpuSystem: 500000,
                },
                performanceTrends: expect.objectContaining({
                    memoryTrend: expect.any(String),
                    dataPoints: expect.any(Number),
                    timespan: expect.any(String),
                }),
                activeAlerts: expect.any(Array),
                alertConfig: expect.any(Object),
                healthStatus: expect.any(String),
            });

            expect(consoleInfoSpy).toHaveBeenCalledWith(
                expect.stringContaining('Monitoring report generated'),
                report
            );
        });

        test('should analyze performance trends', () => {
            monitor.startMonitoring(1000);

            // Generate history with increasing memory usage
            for (let i = 0; i < 10; i++) {
                mockMemoryUsage.mockReturnValue({
                    rss: (60 + i * 5) * 1024 * 1024,
                    heapTotal: (50 + i * 4) * 1024 * 1024,
                    heapUsed: (40 + i * 3) * 1024 * 1024,
                    external: 10 * 1024 * 1024,
                    arrayBuffers: 5 * 1024 * 1024,
                });
                jest.advanceTimersByTime(1000);
            }

            const report = monitor.generateMonitoringReport();
            expect(report.performanceTrends.memoryTrend).toBe('increasing');
        });
    });

    describe('Health Status Determination', () => {
        test('should return healthy status with no issues', () => {
            const report = monitor.generateMonitoringReport();
            expect(report.healthStatus).toBe('healthy');
        });

        test('should return warning status with some alerts', () => {
            const alertConfig: AlertConfig = {
                maxMemoryMB: 50,
            };

            monitor = new SessionMonitor(logger, alertConfig);
            monitor.startMonitoring(1000);

            jest.advanceTimersByTime(1000);

            const report = monitor.generateMonitoringReport();
            expect(report.healthStatus).toBe('warning');
        });

        test('should return critical status with critical alerts', () => {
            // Mock very high memory usage for critical alert
            mockMemoryUsage.mockReturnValue({
                rss: 200 * 1024 * 1024,
                heapTotal: 180 * 1024 * 1024,
                heapUsed: 160 * 1024 * 1024,
                external: 20 * 1024 * 1024,
                arrayBuffers: 10 * 1024 * 1024,
            });

            const alertConfig: AlertConfig = {
                maxMemoryMB: 100,
            };

            monitor = new SessionMonitor(logger, alertConfig);
            monitor.startMonitoring(1000);

            jest.advanceTimersByTime(1000);

            const report = monitor.generateMonitoringReport();
            expect(report.healthStatus).toBe('critical');
        });
    });

    describe('Edge Cases', () => {
        test('should handle insufficient data for trends', () => {
            const report = monitor.generateMonitoringReport();
            expect(report.performanceTrends.trend).toBe('insufficient_data');
        });

        test('should handle zero job processing in session analysis', () => {
            const sessionStats: SessionStats = {
                sessionId: 'test-session',
                startTime: new Date(),
                jobsProcessed: 0,
                applicationsSubmitted: 0,
                duplicatesSkipped: 0,
                errorsEncountered: 0,
                captchasChallenged: 0,
            };

            const analysis = monitor.analyzeSessionPerformance(sessionStats);
            expect(analysis.performance.successRate).toBe(0);
            expect(analysis.performance.errorRate).toBe(0);
        });
    });
});

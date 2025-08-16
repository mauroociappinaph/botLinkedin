import { Logger, SessionStats } from './Logger';

/**
 * Performance metrics for monitoring
 */
export interface PerformanceMetrics {
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  uptime: number;
  timestamp: Date;
}

/**
 * Alert configuration for monitoring thresholds
 */
export interface AlertConfig {
  maxMemoryMB?: number;
  maxErrorRate?: number; // percentage
  maxCaptchaRate?: number; // percentage
  minSuccessRate?: number; // percentage
}

/**
 * Alert information
 */
export interface Alert {
  type: 'memory' | 'error_rate' | 'captcha_rate' | 'success_rate';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

/**
 * Session performance analysis result
 */
export interface SessionPerformanceAnalysis {
  sessionId: string;
  performance: {
    errorRate: number;
    successRate: number;
    captchaRate: number;
    averageProcessingTime: number;
    memoryUsageMB: number;
  };
  health: {
    status: string;
    recommendations: string[];
  };
  alerts: Alert[];
  timestamp: Date;
}

/**
 * Performance trends analysis
 */
export interface PerformanceTrends {
  memoryTrend: 'increasing' | 'decreasing' | 'stable';
  dataPoints: number;
  timespan: string;
  trend?: 'insufficient_data';
}

/**
 * Comprehensive monitoring report
 */
export interface MonitoringReport {
  timestamp: Date;
  currentMetrics: {
    memoryUsageMB: number;
    memoryLimitMB: number;
    uptime: number;
    cpuUser: number;
    cpuSystem: number;
  };
  performanceTrends: PerformanceTrends;
  activeAlerts: Alert[];
  alertConfig: AlertConfig;
  healthStatus: string;
}

/**
 * Advanced session monitoring and alerting system
 * Complements the Logger with performance tracking and health monitoring
 */
export class SessionMonitor {
  private logger: Logger;
  private alertConfig: AlertConfig;
  private performanceHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 100;
  private monitoringInterval?: ReturnType<typeof setInterval>;
  private alerts: Alert[] = [];

  constructor(logger: Logger, alertConfig: AlertConfig = {}) {
    this.logger = logger;
    this.alertConfig = {
      maxMemoryMB: 512,
      maxErrorRate: 20,
      maxCaptchaRate: 10,
      minSuccessRate: 50,
      ...alertConfig,
    };
  }

  /**
   * Starts performance monitoring
   * @param intervalMs Monitoring interval in milliseconds
   */
  public startMonitoring(intervalMs: number = 30000): void {
    this.logger.info('Starting session monitoring', {
      interval: `${intervalMs}ms`,
      alertConfig: this.alertConfig,
    });

    this.monitoringInterval = setInterval(() => {
      this.collectPerformanceMetrics();
      this.checkAlerts();
    }, intervalMs);
  }

  /**
   * Stops performance monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      this.logger.info('Session monitoring stopped');
    }
  }

  /**
   * Gets current performance metrics
   * @returns Current performance data
   */
  public getCurrentMetrics(): PerformanceMetrics {
    return {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
      timestamp: new Date(),
    };
  }

  /**
   * Gets performance history
   * @param limit Maximum number of entries to return
   * @returns Array of historical performance metrics
   */
  public getPerformanceHistory(limit?: number): PerformanceMetrics[] {
    const history = [...this.performanceHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Gets active alerts
   * @returns Array of current alerts
   */
  public getActiveAlerts(): Alert[] {
    return [...this.alerts];
  }

  /**
   * Clears all alerts
   */
  public clearAlerts(): void {
    this.alerts = [];
    this.logger.info('All alerts cleared');
  }

  /**
   * Analyzes session performance and generates insights
   * @param sessionStats Session statistics to analyze
   * @returns Performance analysis report
   */
  public analyzeSessionPerformance(
    sessionStats: SessionStats
  ): SessionPerformanceAnalysis {
    const errorRate =
      sessionStats.jobsProcessed > 0
        ? (sessionStats.errorsEncountered / sessionStats.jobsProcessed) * 100
        : 0;

    const successRate =
      sessionStats.jobsProcessed > 0
        ? (sessionStats.applicationsSubmitted / sessionStats.jobsProcessed) *
          100
        : 0;

    const captchaRate =
      sessionStats.jobsProcessed > 0
        ? (sessionStats.captchasChallenged / sessionStats.jobsProcessed) * 100
        : 0;

    const currentMetrics = this.getCurrentMetrics();
    const memoryUsageMB = currentMetrics.memoryUsage.heapUsed / (1024 * 1024);

    const analysis = {
      sessionId: sessionStats.sessionId,
      performance: {
        errorRate: Math.round(errorRate * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        captchaRate: Math.round(captchaRate * 100) / 100,
        averageProcessingTime: sessionStats.averageProcessingTime || 0,
        memoryUsageMB: Math.round(memoryUsageMB * 100) / 100,
      },
      health: {
        status: this.determineHealthStatus(
          errorRate,
          successRate,
          captchaRate,
          memoryUsageMB
        ),
        recommendations: this.generateRecommendations(
          errorRate,
          successRate,
          captchaRate,
          memoryUsageMB
        ),
      },
      alerts: this.getActiveAlerts(),
      timestamp: new Date(),
    };

    this.logger.info('Session performance analysis completed', analysis);
    return analysis;
  }

  /**
   * Generates a comprehensive monitoring report
   * @returns Detailed monitoring report
   */
  public generateMonitoringReport(): MonitoringReport {
    const currentMetrics = this.getCurrentMetrics();
    const recentHistory = this.getPerformanceHistory(10);

    const report = {
      timestamp: new Date(),
      currentMetrics: {
        memoryUsageMB:
          Math.round(
            (currentMetrics.memoryUsage.heapUsed / (1024 * 1024)) * 100
          ) / 100,
        memoryLimitMB: this.alertConfig.maxMemoryMB || 512,
        uptime: Math.round(currentMetrics.uptime),
        cpuUser: currentMetrics.cpuUsage.user,
        cpuSystem: currentMetrics.cpuUsage.system,
      },
      performanceTrends: this.analyzePerformanceTrends(recentHistory),
      activeAlerts: this.getActiveAlerts(),
      alertConfig: this.alertConfig,
      healthStatus: this.getOverallHealthStatus(),
    };

    this.logger.info('Monitoring report generated', report);
    return report;
  }

  /**
   * Collects current performance metrics and stores in history
   */
  private collectPerformanceMetrics(): void {
    const metrics = this.getCurrentMetrics();

    this.performanceHistory.push(metrics);

    // Maintain history size limit
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory = this.performanceHistory.slice(
        -this.maxHistorySize
      );
    }

    this.logger.debug('Performance metrics collected', {
      memoryMB:
        Math.round((metrics.memoryUsage.heapUsed / (1024 * 1024)) * 100) / 100,
      uptime: Math.round(metrics.uptime),
    });
  }

  /**
   * Checks for alert conditions and generates alerts
   */
  private checkAlerts(): void {
    const currentMetrics = this.getCurrentMetrics();
    const memoryUsageMB = currentMetrics.memoryUsage.heapUsed / (1024 * 1024);

    // Memory usage alert
    if (
      this.alertConfig.maxMemoryMB &&
      memoryUsageMB > this.alertConfig.maxMemoryMB
    ) {
      this.addAlert({
        type: 'memory',
        severity:
          memoryUsageMB > this.alertConfig.maxMemoryMB * 1.5
            ? 'critical'
            : 'warning',
        message: `High memory usage: ${Math.round(memoryUsageMB)}MB`,
        value: memoryUsageMB,
        threshold: this.alertConfig.maxMemoryMB,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Adds an alert if it doesn't already exist
   * @param alert Alert to add
   */
  private addAlert(alert: Alert): void {
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(
      (a) =>
        a.type === alert.type &&
        Math.abs(a.timestamp.getTime() - alert.timestamp.getTime()) < 60000 // Within 1 minute
    );

    if (!existingAlert) {
      this.alerts.push(alert);
      this.logger.warn('Alert generated', {
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        value: alert.value,
        threshold: alert.threshold,
        timestamp: alert.timestamp.toISOString(),
      });
    }
  }

  /**
   * Determines overall health status based on metrics
   * @param errorRate Error rate percentage
   * @param successRate Success rate percentage
   * @param captchaRate CAPTCHA rate percentage
   * @param memoryUsageMB Memory usage in MB
   * @returns Health status string
   */
  private determineHealthStatus(
    errorRate: number,
    successRate: number,
    captchaRate: number,
    memoryUsageMB: number
  ): string {
    const issues = [];

    if (
      this.alertConfig.maxErrorRate &&
      errorRate > this.alertConfig.maxErrorRate
    ) {
      issues.push('high_error_rate');
    }

    if (
      this.alertConfig.minSuccessRate &&
      successRate < this.alertConfig.minSuccessRate
    ) {
      issues.push('low_success_rate');
    }

    if (
      this.alertConfig.maxCaptchaRate &&
      captchaRate > this.alertConfig.maxCaptchaRate
    ) {
      issues.push('high_captcha_rate');
    }

    if (
      this.alertConfig.maxMemoryMB &&
      memoryUsageMB > this.alertConfig.maxMemoryMB
    ) {
      issues.push('high_memory_usage');
    }

    if (issues.length === 0) return 'healthy';
    if (issues.length <= 2) return 'warning';
    return 'critical';
  }

  /**
   * Generates recommendations based on performance metrics
   * @param errorRate Error rate percentage
   * @param successRate Success rate percentage
   * @param captchaRate CAPTCHA rate percentage
   * @param memoryUsageMB Memory usage in MB
   * @returns Array of recommendations
   */
  private generateRecommendations(
    errorRate: number,
    successRate: number,
    captchaRate: number,
    memoryUsageMB: number
  ): string[] {
    const recommendations = [];

    if (
      this.alertConfig.maxErrorRate &&
      errorRate > this.alertConfig.maxErrorRate
    ) {
      recommendations.push(
        'Consider increasing delays between actions to reduce errors'
      );
    }

    if (
      this.alertConfig.minSuccessRate &&
      successRate < this.alertConfig.minSuccessRate
    ) {
      recommendations.push(
        'Review job search criteria to target more suitable positions'
      );
    }

    if (
      this.alertConfig.maxCaptchaRate &&
      captchaRate > this.alertConfig.maxCaptchaRate
    ) {
      recommendations.push(
        'Increase stealth measures and reduce automation speed'
      );
    }

    if (
      this.alertConfig.maxMemoryMB &&
      memoryUsageMB > this.alertConfig.maxMemoryMB
    ) {
      recommendations.push('Consider restarting the session to free up memory');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable parameters');
    }

    return recommendations;
  }

  /**
   * Analyzes performance trends from historical data
   * @param history Array of performance metrics
   * @returns Trend analysis
   */
  private analyzePerformanceTrends(
    history: PerformanceMetrics[]
  ): PerformanceTrends {
    if (history.length < 2) {
      return {
        memoryTrend: 'stable' as const,
        dataPoints: 0,
        timespan: '0s',
        trend: 'insufficient_data' as const,
      };
    }

    const memoryTrend = this.calculateTrend(
      history.map((h) => h.memoryUsage.heapUsed / (1024 * 1024))
    );

    const lastEntry = history[history.length - 1];
    const firstEntry = history[0];

    if (!lastEntry || !firstEntry) {
      return {
        trend: 'insufficient_data',
        memoryTrend: 'stable',
        dataPoints: 0,
        timespan: '0s',
      };
    }

    return {
      memoryTrend:
        memoryTrend > 0.1
          ? 'increasing'
          : memoryTrend < -0.1
            ? 'decreasing'
            : 'stable',
      dataPoints: history.length,
      timespan: `${Math.round((lastEntry.timestamp.getTime() - firstEntry.timestamp.getTime()) / 1000)}s`,
    };
  }

  /**
   * Calculates trend direction from array of values
   * @param values Array of numeric values
   * @returns Trend coefficient
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + index * val, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  /**
   * Gets overall system health status
   * @returns Health status string
   */
  private getOverallHealthStatus(): string {
    const criticalAlerts = this.alerts.filter((a) => a.severity === 'critical');
    const warningAlerts = this.alerts.filter((a) => a.severity === 'warning');

    if (criticalAlerts.length > 0) return 'critical';
    if (warningAlerts.length > 2) return 'warning';
    if (warningAlerts.length > 0) return 'degraded';
    return 'healthy';
  }
}

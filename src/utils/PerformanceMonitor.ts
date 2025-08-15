import { Logger } from './Logger';

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata: Record<string, any> | undefined;
}

export interface PerformanceReport {
  totalDuration: number;
  metrics: PerformanceMetric[];
  slowestOperations: PerformanceMetric[];
  averagePageLoadTime: number;
  totalPageLoads: number;
}

/**
 * Performance monitoring utility for tracking page load times and operation durations
 */
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private completedMetrics: PerformanceMetric[] = [];
  private logger: Logger | undefined;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Starts timing an operation
   */
  public startTimer(name: string, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      name,
      startTime: Date.now(),
      metadata,
    };

    this.metrics.set(name, metric);
    this.logger?.debug(`Started timing: ${name}`, metadata);
  }

  /**
   * Ends timing an operation
   */
  public endTimer(
    name: string,
    additionalMetadata?: Record<string, any>
  ): number {
    const metric = this.metrics.get(name);
    if (!metric) {
      this.logger?.warn(`Timer '${name}' was not started`);
      return 0;
    }

    const endTime = Date.now();
    const duration = endTime - metric.startTime;

    const completedMetric: PerformanceMetric = {
      ...metric,
      endTime,
      duration,
      metadata: { ...metric.metadata, ...additionalMetadata },
    };

    this.completedMetrics.push(completedMetric);
    this.metrics.delete(name);

    this.logger?.debug(`Completed timing: ${name}`, {
      duration: `${duration}ms`,
      ...completedMetric.metadata,
    });

    return duration;
  }

  /**
   * Times an async operation
   */
  public async timeOperation<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.startTimer(name, metadata);

    try {
      const result = await operation();
      this.endTimer(name, { success: true });
      return result;
    } catch (error) {
      this.endTimer(name, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Times a page navigation operation
   */
  public async timePageLoad<T>(
    url: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.timeOperation(`page_load_${url}`, operation, {
      url,
      type: 'page_load',
      ...metadata,
    });
  }

  /**
   * Times a selector wait operation
   */
  public async timeSelectorWait<T>(
    selector: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.timeOperation(`selector_wait_${selector}`, operation, {
      selector,
      type: 'selector_wait',
      ...metadata,
    });
  }

  /**
   * Gets performance report
   */
  public getReport(): PerformanceReport {
    const pageLoadMetrics = this.completedMetrics.filter(
      (m) => m.metadata?.['type'] === 'page_load' && m.duration !== undefined
    );

    const slowestOperations = [...this.completedMetrics]
      .filter((m) => m.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5);

    const totalDuration = this.completedMetrics.reduce(
      (sum, metric) => sum + (metric.duration || 0),
      0
    );

    const averagePageLoadTime =
      pageLoadMetrics.length > 0
        ? pageLoadMetrics.reduce(
            (sum, metric) => sum + (metric.duration || 0),
            0
          ) / pageLoadMetrics.length
        : 0;

    return {
      totalDuration,
      metrics: [...this.completedMetrics],
      slowestOperations,
      averagePageLoadTime,
      totalPageLoads: pageLoadMetrics.length,
    };
  }

  /**
   * Logs performance summary
   */
  public logSummary(): void {
    const report = this.getReport();

    this.logger?.info('Performance Summary', {
      totalDuration: `${report.totalDuration}ms`,
      totalOperations: report.metrics.length,
      averagePageLoadTime: `${Math.round(report.averagePageLoadTime)}ms`,
      totalPageLoads: report.totalPageLoads,
    });

    if (report.slowestOperations.length > 0) {
      this.logger?.info('Slowest Operations', {
        operations: report.slowestOperations.map((op) => ({
          name: op.name,
          duration: `${op.duration}ms`,
        })),
      });
    }
  }

  /**
   * Clears all metrics
   */
  public clear(): void {
    this.metrics.clear();
    this.completedMetrics = [];
  }

  /**
   * Gets metrics by type
   */
  public getMetricsByType(type: string): PerformanceMetric[] {
    return this.completedMetrics.filter((m) => m.metadata?.type === type);
  }

  /**
   * Checks if any operation exceeded threshold
   */
  public hasSlowOperations(thresholdMs: number = 5000): boolean {
    return this.completedMetrics.some((m) => (m.duration || 0) > thresholdMs);
  }
}

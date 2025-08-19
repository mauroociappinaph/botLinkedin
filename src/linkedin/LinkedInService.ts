import { Page } from 'puppeteer';
import { BrowserManager, SessionManager } from '../browser';
import { ConfigLoader } from '../config';
import {
  ApplicationRepository,
  DatabaseService,
  JobRepository,
} from '../database';
import {
  BotConfig,
  JobPosting,
  JobStatus,
  LogLevel,
  ServiceResponse,
} from '../types';
import { ErrorHandler, Logger } from '../utils';
import { ApplicationHandler } from './ApplicationHandler';
import { JobSearchHandler } from './JobSearchHandler';

/**
 * Statistics for job processing session
 */
interface SessionStatistics {
  processed: number;
  applied: number;
  skipped: number;
  errors: number;
}

/**
 * Main orchestrator class for LinkedIn job application automation
 * Integrates all components: search, application, database, logging
 * Implements Requirements: 5.2, 5.3, 7.3
 */
export class LinkedInService {
  private config!: BotConfig;
  private logger: Logger;
  private databaseService: DatabaseService;
  private jobRepository: JobRepository;
  private applicationRepository: ApplicationRepository;
  private browserManager?: BrowserManager;
  private sessionManager?: SessionManager;
  private jobSearchHandler?: JobSearchHandler;
  private applicationHandler?: ApplicationHandler;
  private errorHandler: ErrorHandler;
  private page?: Page;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;
  private currentSessionId?: string;
  private readonly configPath?: string;

  constructor(configPath?: string) {
    this.configPath = configPath;

    // Initialize logger
    this.logger = new Logger({
      level: LogLevel.INFO,
      enableFileLogging: true,
      logDirectory: './logs',
      maxFileSize: 10, // 10MB
    });

    // Initialize error handler
    this.errorHandler = new ErrorHandler(this.logger);

    // Initialize database services
    this.databaseService = DatabaseService.getInstance();
    this.jobRepository = new JobRepository();
    this.applicationRepository = new ApplicationRepository();

    // Setup graceful shutdown handlers
    this.setupShutdownHandlers();
  }

  /**
   * Main entry point to start the job application process
   */
  public async start(): Promise<ServiceResponse<void>> {
    try {
      this.logger.info('Starting LinkedIn job application bot');
      this.isRunning = true;
      this.shouldStop = false;

      // Initialize all services
      await this.initialize();

      // Create new application session
      this.currentSessionId = await this.createApplicationSession();

      // Execute main job processing loop
      await this.executeJobProcessingLoop();

      // Complete session and cleanup
      await this.completeSession();

      this.logger.info('LinkedIn job application bot completed successfully');
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('LinkedIn bot execution failed', {
        error: errorMessage,
      });

      await this.handleError(error);

      return {
        success: false,
        error: {
          code: 'BOT_EXECUTION_FAILED',
          message: errorMessage,
          timestamp: new Date(),
          recoverable: false,
        },
      };
    } finally {
      await this.cleanup();
      this.isRunning = false;
    }
  }

  /**
   * Gracefully stops the bot execution
   */
  public async stop(): Promise<void> {
    this.logger.info('Stopping LinkedIn job application bot');
    this.shouldStop = true;

    // Wait for current operation to complete
    while (this.isRunning) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    await this.cleanup();
  }

  /**
   * Gets current execution statistics
   */
  public async getStats(): Promise<{
    sessionId?: string | undefined;
    jobsProcessed: number;
    applicationsSubmitted: number;
    duplicatesSkipped: number;
    errorsEncountered: number;
    isRunning: boolean;
  }> {
    const stats = (await this.applicationHandler?.getApplicationStats()) || {
      total: 0,
      applied: 0,
      skipped: 0,
      errors: 0,
    };

    return {
      sessionId: this.currentSessionId,
      jobsProcessed: stats.total,
      applicationsSubmitted: stats.applied,
      duplicatesSkipped: stats.skipped,
      errorsEncountered: stats.errors,
      isRunning: this.isRunning,
    };
  }

  /**
   * Initializes all required services and components
   */
  private async initialize(): Promise<void> {
    this.logger.info('Initializing LinkedIn service components');

    try {
      // Load and validate configuration
      await this.initializeConfiguration();

      // Initialize database connection
      await this.initializeDatabase();

      // Initialize browser and session
      await this.initializeBrowser();

      // Initialize handlers
      await this.initializeHandlers();

      this.logger.info('All components initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize LinkedIn service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Loads and validates configuration
   */
  private async initializeConfiguration(): Promise<void> {
    this.config = await ConfigLoader.load(this.configPath);
    this.logger.debug('Configuration loaded successfully');
  }

  /**
   * Initializes database connection
   */
  private async initializeDatabase(): Promise<void> {
    await this.databaseService.connect();
    this.logger.debug('Database connection established');
  }

  /**
   * Initializes browser and session management
   */
  private async initializeBrowser(): Promise<void> {
    this.browserManager = new BrowserManager(this.config.browser);
    this.sessionManager = new SessionManager(
      this.config.linkedin,
      this.config.delays,
      this.logger
    );

    // Initialize browser and session
    await this.browserManager.launch();
    this.page = await this.browserManager.newPage();
    this.logger.debug('Browser initialized');

    // Set page for session manager and login to LinkedIn
    this.sessionManager.setPage(this.page);
    await this.sessionManager.login();
    this.logger.debug('LinkedIn session established');
  }

  /**
   * Initializes job search and application handlers
   */
  private async initializeHandlers(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized before handlers');
    }

    this.jobSearchHandler = new JobSearchHandler(
      this.page,
      this.config.search,
      this.logger
    );

    this.applicationHandler = new ApplicationHandler(
      this.config.application,
      this.jobRepository,
      this.logger
    );

    // Set error handler page context
    this.errorHandler = new ErrorHandler(this.logger, this.page);

    this.logger.debug('Handlers initialized successfully');
  }

  /**
   * Creates a new application session in the database
   */
  private async createApplicationSession(): Promise<string> {
    const session = await this.applicationRepository.create({
      searchConfig: this.config.search,
    });

    this.logger.info('Application session created', { sessionId: session.id });
    return session.id;
  }

  /**
   * Main job processing loop with duplicate checking
   */
  private async executeJobProcessingLoop(): Promise<void> {
    this.logger.info('Starting job processing loop');

    try {
      const jobs = await this.performJobSearch();
      await this.updateSessionJobsFound(jobs.length);

      const statistics = await this.processJobsSequentially(jobs);
      this.logProcessingResults(statistics);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Job processing loop failed', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Performs job search and returns results
   */
  private async performJobSearch(): Promise<JobPosting[]> {
    if (!this.jobSearchHandler) {
      throw new Error('Job search handler not initialized');
    }

    const searchResult = await this.jobSearchHandler.performSearch();

    if (!searchResult.success || !searchResult.data) {
      throw new Error(
        `Job search failed: ${searchResult.error?.message || 'Unknown error'}`
      );
    }

    const jobs = searchResult.data.results;
    this.logger.info(`Found ${jobs.length} jobs to process`);
    return jobs;
  }

  /**
   * Updates session with number of jobs found
   */
  private async updateSessionJobsFound(jobCount: number): Promise<void> {
    if (this.currentSessionId) {
      await this.applicationRepository.update(this.currentSessionId, {
        totalJobsFound: jobCount,
      });
    }
  }

  /**
   * Processes jobs sequentially and returns statistics
   */
  private async processJobsSequentially(
    jobs: JobPosting[]
  ): Promise<SessionStatistics> {
    const statistics: SessionStatistics = {
      processed: 0,
      applied: 0,
      skipped: 0,
      errors: 0,
    };

    for (const job of jobs) {
      if (this.shouldStop) {
        this.logger.info('Stop signal received, terminating job processing');
        break;
      }

      await this.processIndividualJob(job, statistics, jobs.length);
      await this.updateSessionStatistics(statistics);
      await this.delayBetweenApplications();
    }

    return statistics;
  }

  /**
   * Processes a single job and updates statistics
   */
  private async processIndividualJob(
    job: JobPosting,
    statistics: SessionStatistics,
    totalJobs: number
  ): Promise<void> {
    try {
      statistics.processed++;
      this.logger.info(
        `Processing job ${statistics.processed}/${totalJobs}: ${job.title} at ${job.company}`
      );

      // Check for duplicates
      if (await this.isDuplicateJob(job)) {
        statistics.skipped++;
        this.logger.info(`Skipping duplicate job: ${job.id}`);
        return;
      }

      // Store job in database
      await this.storeJob(job);

      // Apply to job
      const applicationResult = await this.applyToJobSafely(job);
      this.updateStatisticsFromResult(applicationResult, job, statistics);
    } catch (error) {
      await this.handleJobProcessingError(error, job, statistics);
    }
  }

  /**
   * Safely applies to a job with proper error handling
   */
  private async applyToJobSafely(
    job: JobPosting
  ): Promise<ServiceResponse<boolean>> {
    if (!this.applicationHandler || !this.page) {
      throw new Error('Application handler or page not initialized');
    }

    return await this.errorHandler.executeWithRetry(
      () => this.applicationHandler!.applyToJob(this.page!, job),
      {
        category: 'application' as unknown,
        jobId: job.id,
      }
    );
  }

  /**
   * Updates statistics based on application result
   */
  private updateStatisticsFromResult(
    result: ServiceResponse<boolean>,
    job: JobPosting,
    statistics: SessionStatistics
  ): void {
    if (result.success && result.data) {
      statistics.applied++;
      this.logger.info(`Successfully applied to: ${job.title}`);
    } else if (result.success && !result.data) {
      statistics.skipped++;
      this.logger.info(`Skipped job: ${job.title}`);
    } else {
      statistics.errors++;
      this.logger.error(`Failed to apply to: ${job.title}`, {
        error: result.error?.message || 'Application failed',
      });
    }
  }

  /**
   * Handles errors during job processing
   */
  private async handleJobProcessingError(
    error: unknown,
    job: JobPosting,
    statistics: SessionStatistics
  ): Promise<void> {
    statistics.errors++;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    this.logger.error(`Error processing job: ${job.title}`, {
      error: errorMessage,
    });

    // Mark job as error in database
    try {
      await this.jobRepository.update(job.id, {
        status: JobStatus.ERROR,
        errorMessage,
      });
    } catch (dbError) {
      this.logger.error('Failed to update job status in database', {
        jobId: job.id,
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
      });
    }
  }

  /**
   * Updates session statistics in database
   */
  private async updateSessionStatistics(
    statistics: SessionStatistics
  ): Promise<void> {
    if (this.currentSessionId) {
      await this.applicationRepository.update(this.currentSessionId, {
        totalApplicationsSubmitted: statistics.applied,
        totalSkipped: statistics.skipped,
        totalErrors: statistics.errors,
      });
    }
  }

  /**
   * Logs final processing results
   */
  private logProcessingResults(statistics: SessionStatistics): void {
    this.logger.info('Job processing completed', {
      processed: statistics.processed,
      applied: statistics.applied,
      skipped: statistics.skipped,
      errors: statistics.errors,
    });
  }

  /**
   * Checks if a job is a duplicate (already processed)
   */
  private async isDuplicateJob(job: JobPosting): Promise<boolean> {
    try {
      const existingJob = await this.jobRepository.findById(job.id);
      return existingJob !== null;
    } catch (error) {
      this.logger.error('Error checking for duplicate job', {
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Stores a job in the database
   */
  private async storeJob(job: JobPosting): Promise<void> {
    try {
      await this.jobRepository.create({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        description: job.description || null,
        salary: job.salary || null,
        status: JobStatus.FOUND,
        isEasyApply: job.isEasyApply,
        appliedAt: null,
        errorMessage: null,
      });
    } catch (error) {
      // If job already exists, update it
      if (
        error instanceof Error &&
        error.message.includes('UNIQUE constraint')
      ) {
        await this.jobRepository.update(job.id, {
          status: JobStatus.FOUND,
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Adds appropriate delay between job applications
   */
  private async delayBetweenApplications(): Promise<void> {
    const minDelay = this.config.delays.minPageLoad;
    const maxDelay = this.config.delays.maxPageLoad;
    const delay =
      Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    this.logger.debug(`Waiting ${delay}ms before next application`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Completes the current application session
   */
  private async completeSession(): Promise<void> {
    if (this.currentSessionId) {
      await this.applicationRepository.update(this.currentSessionId, {
        endTime: new Date(),
      });

      this.logger.info('Application session completed', {
        sessionId: this.currentSessionId,
      });
    }
  }

  /**
   * Handles errors during execution
   */
  private async handleError(error: unknown): Promise<void> {
    // Mark session as failed if exists
    if (this.currentSessionId) {
      try {
        await this.applicationRepository.update(this.currentSessionId, {
          endTime: new Date(),
        });
      } catch (dbError) {
        this.logger.error('Failed to update session status', {
          error: dbError instanceof Error ? dbError.message : 'Unknown error',
        });
      }
    }

    // Use centralized error handling
    const enhancedError = this.errorHandler.enhanceError(
      error instanceof Error ? error : new Error(String(error)),
      {
        sessionId: this.currentSessionId,
        url: this.page?.url(),
      }
    );

    this.logger.error('LinkedIn service execution failed', {
      error: enhancedError.message,
      category: enhancedError.context.category,
      severity: enhancedError.context.severity,
      sessionId: this.currentSessionId,
    });
  }

  /**
   * Cleanup resources and connections
   */
  private async cleanup(): Promise<void> {
    this.logger.info('Cleaning up LinkedIn service resources');

    try {
      // Close browser
      if (this.browserManager) {
        await this.browserManager.close();
      }

      // Disconnect from database
      if (this.databaseService) {
        await this.databaseService.disconnect();
      }

      this.logger.info('Cleanup completed successfully');
    } catch (error) {
      this.logger.error('Error during cleanup', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Sets up graceful shutdown handlers for process signals
   */
  private setupShutdownHandlers(): void {
    const handleShutdown = async (signal: string): Promise<void> => {
      this.logger.info(`Received ${signal}, initiating graceful shutdown`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGUSR2', () => handleShutdown('SIGUSR2')); // For nodemon
  }
}

import { JobRepository } from '../database/JobRepository';
import { ApplicationConfig, LogLevel } from '../types';
import { Logger } from '../utils/Logger';
import { ApplicationHandler } from './ApplicationHandler';
import {
  ApplicationHandlerConfig,
  DEFAULT_APPLICATION_CONFIG,
} from './ApplicationHandlerConfig';
import { FormFiller } from './FormFiller';

/**
 * Builder pattern for creating ApplicationHandler instances
 */
export class ApplicationHandlerBuilder {
  private applicationConfig?: ApplicationConfig;
  private jobRepository?: JobRepository;
  private logger?: Logger;
  private formFiller?: FormFiller;
  private handlerConfig: ApplicationHandlerConfig = DEFAULT_APPLICATION_CONFIG;

  /**
   * Sets the application configuration
   */
  withApplicationConfig(config: ApplicationConfig): ApplicationHandlerBuilder {
    this.applicationConfig = config;
    return this;
  }

  /**
   * Sets the job repository
   */
  withJobRepository(repository: JobRepository): ApplicationHandlerBuilder {
    this.jobRepository = repository;
    return this;
  }

  /**
   * Sets the logger
   */
  withLogger(logger: Logger): ApplicationHandlerBuilder {
    this.logger = logger;
    return this;
  }

  /**
   * Sets the form filler
   */
  withFormFiller(formFiller: FormFiller): ApplicationHandlerBuilder {
    this.formFiller = formFiller;
    return this;
  }

  /**
   * Sets the handler configuration
   */
  withHandlerConfig(
    config: ApplicationHandlerConfig
  ): ApplicationHandlerBuilder {
    this.handlerConfig = config;
    return this;
  }

  /**
   * Sets custom timeouts
   */
  withTimeouts(timeouts: {
    modal?: number;
    submission?: number;
  }): ApplicationHandlerBuilder {
    this.handlerConfig = {
      ...this.handlerConfig,
      TIMEOUTS: {
        ...this.handlerConfig.TIMEOUTS,
        ...timeouts,
      },
    };
    return this;
  }

  /**
   * Sets custom delays
   */
  withDelays(
    delays: Partial<ApplicationHandlerConfig['DELAYS']>
  ): ApplicationHandlerBuilder {
    this.handlerConfig = {
      ...this.handlerConfig,
      DELAYS: {
        ...this.handlerConfig.DELAYS,
        ...delays,
      },
    };
    return this;
  }

  /**
   * Sets maximum application steps
   */
  withMaxSteps(maxSteps: number): ApplicationHandlerBuilder {
    this.handlerConfig = {
      ...this.handlerConfig,
      MAX_APPLICATION_STEPS: maxSteps,
    };
    return this;
  }

  /**
   * Creates a logger with specified log level
   */
  withLogLevel(level: LogLevel): ApplicationHandlerBuilder {
    this.logger = new Logger(level);
    return this;
  }

  /**
   * Builds the ApplicationHandler instance
   */
  build(): ApplicationHandler {
    if (!this.applicationConfig) {
      throw new Error('ApplicationConfig is required');
    }

    return new ApplicationHandler(
      this.applicationConfig,
      this.jobRepository,
      this.logger,
      this.formFiller,
      this.handlerConfig
    );
  }

  /**
   * Creates a builder with default production settings
   */
  static forProduction(
    applicationConfig: ApplicationConfig
  ): ApplicationHandlerBuilder {
    return new ApplicationHandlerBuilder()
      .withApplicationConfig(applicationConfig)
      .withLogLevel(LogLevel.INFO)
      .withJobRepository(new JobRepository());
  }

  /**
   * Creates a builder with default development settings
   */
  static forDevelopment(
    applicationConfig: ApplicationConfig
  ): ApplicationHandlerBuilder {
    return new ApplicationHandlerBuilder()
      .withApplicationConfig(applicationConfig)
      .withLogLevel(LogLevel.DEBUG)
      .withJobRepository(new JobRepository());
  }

  /**
   * Creates a builder with default testing settings
   */
  static forTesting(
    applicationConfig: ApplicationConfig
  ): ApplicationHandlerBuilder {
    return new ApplicationHandlerBuilder()
      .withApplicationConfig(applicationConfig)
      .withLogLevel(LogLevel.ERROR)
      .withMaxSteps(2); // Faster tests
  }
}

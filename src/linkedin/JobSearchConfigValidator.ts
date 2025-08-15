import { JobSearchConfig } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates job search configuration parameters
 */
export class JobSearchConfigValidator {
  private static readonly VALIDATION_CONFIG = {
    MAX_KEYWORD_LENGTH: 100,
    MAX_LOCATION_LENGTH: 50,
    VALID_DATE_OPTIONS: ['past24h', 'pastWeek', 'pastMonth', 'any'] as const,
    VALID_EXPERIENCE_LEVELS: [
      'internship',
      'entry',
      'associate',
      'mid',
      'director',
      'executive',
    ] as const,
    VALID_JOB_TYPES: [
      'fullTime',
      'partTime',
      'contract',
      'temporary',
      'volunteer',
      'internship',
    ] as const,
  } as const;

  /**
   * Validates the complete search configuration
   */
  public static validate(config: JobSearchConfig): ValidationResult {
    const errors: string[] = [];

    this.validateKeywords(config, errors);
    this.validateLocation(config, errors);
    this.validateDatePosted(config, errors);
    this.validateExperienceLevels(config, errors);
    this.validateJobTypes(config, errors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private static validateKeywords(
    config: JobSearchConfig,
    errors: string[]
  ): void {
    if (!config.keywords || config.keywords.length === 0) {
      errors.push('Keywords are required');
      return;
    }

    if (config.keywords.some((keyword) => !keyword.trim())) {
      errors.push('Keywords cannot be empty');
    }

    if (
      config.keywords.some(
        (keyword) => keyword.length > this.VALIDATION_CONFIG.MAX_KEYWORD_LENGTH
      )
    ) {
      errors.push(
        `Keywords cannot exceed ${this.VALIDATION_CONFIG.MAX_KEYWORD_LENGTH} characters`
      );
    }
  }

  private static validateLocation(
    config: JobSearchConfig,
    errors: string[]
  ): void {
    if (!config.location || !config.location.trim()) {
      errors.push('Location is required');
      return;
    }

    if (config.location.length > this.VALIDATION_CONFIG.MAX_LOCATION_LENGTH) {
      errors.push(
        `Location cannot exceed ${this.VALIDATION_CONFIG.MAX_LOCATION_LENGTH} characters`
      );
    }
  }

  private static validateDatePosted(
    config: JobSearchConfig,
    errors: string[]
  ): void {
    if (
      !this.VALIDATION_CONFIG.VALID_DATE_OPTIONS.includes(
        config.datePosted as any
      )
    ) {
      errors.push(
        `Invalid date posted option. Valid options: ${this.VALIDATION_CONFIG.VALID_DATE_OPTIONS.join(', ')}`
      );
    }
  }

  private static validateExperienceLevels(
    config: JobSearchConfig,
    errors: string[]
  ): void {
    const invalidLevels = config.experienceLevel.filter(
      (level) =>
        !this.VALIDATION_CONFIG.VALID_EXPERIENCE_LEVELS.includes(level as any)
    );

    if (invalidLevels.length > 0) {
      errors.push(`Invalid experience levels: ${invalidLevels.join(', ')}`);
    }
  }

  private static validateJobTypes(
    config: JobSearchConfig,
    errors: string[]
  ): void {
    const invalidTypes = config.jobType.filter(
      (type) => !this.VALIDATION_CONFIG.VALID_JOB_TYPES.includes(type as any)
    );

    if (invalidTypes.length > 0) {
      errors.push(`Invalid job types: ${invalidTypes.join(', ')}`);
    }
  }
}

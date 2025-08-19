import { BooleanSearchConfigValidator } from '../search/BooleanSearchConfigValidator';
import { JobSearchConfig, ValidationError } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates job search configuration parameters including boolean search integration
 *
 * This validator ensures that all search parameters are valid and compatible with LinkedIn's
 * search functionality. It supports both traditional keyword-based search and boolean search
 * expressions with proper fallback handling.
 */
export class JobSearchConfigValidator {
  private static readonly VALIDATION_CONFIG = {
    MAX_KEYWORD_LENGTH: 100,
    MAX_LOCATION_LENGTH: 50,
    MIN_KEYWORDS_COUNT: 1,
    MAX_KEYWORDS_COUNT: 10,
    MAX_SALARY: 1000000, // $1M max salary
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

    // Validate basic search parameters
    this.validateKeywords(config, errors);
    this.validateLocation(config, errors);
    this.validateDatePosted(config, errors);
    this.validateExperienceLevels(config, errors);
    this.validateJobTypes(config, errors);

    // Validate optional salary range
    this.validateSalaryRange(config, errors);

    // Validate boolean search configuration if present
    this.validateBooleanSearch(config, errors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private static validateKeywords(
    config: JobSearchConfig,
    errors: string[]
  ): void {
    // Skip keyword validation if boolean search is enabled and has expression
    if (
      config.booleanSearch?.enabled &&
      config.booleanSearch.expression?.trim()
    ) {
      return;
    }

    if (!config.keywords || config.keywords.length === 0) {
      errors.push('Keywords are required when boolean search is not enabled');
      return;
    }

    if (config.keywords.length < this.VALIDATION_CONFIG.MIN_KEYWORDS_COUNT) {
      errors.push(
        `At least ${this.VALIDATION_CONFIG.MIN_KEYWORDS_COUNT} keyword is required`
      );
    }

    if (config.keywords.length > this.VALIDATION_CONFIG.MAX_KEYWORDS_COUNT) {
      errors.push(
        `Cannot exceed ${this.VALIDATION_CONFIG.MAX_KEYWORDS_COUNT} keywords`
      );
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
        config.datePosted as (typeof this.VALIDATION_CONFIG.VALID_DATE_OPTIONS)[number]
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
        !this.VALIDATION_CONFIG.VALID_EXPERIENCE_LEVELS.includes(
          level as (typeof this.VALIDATION_CONFIG.VALID_EXPERIENCE_LEVELS)[number]
        )
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
      (type) =>
        !this.VALIDATION_CONFIG.VALID_JOB_TYPES.includes(
          type as (typeof this.VALIDATION_CONFIG.VALID_JOB_TYPES)[number]
        )
    );

    if (invalidTypes.length > 0) {
      errors.push(`Invalid job types: ${invalidTypes.join(', ')}`);
    }
  }

  /**
   * Validates salary range configuration
   * @param config - Job search configuration
   * @param errors - Array to collect validation errors
   */
  private static validateSalaryRange(
    config: JobSearchConfig,
    errors: string[]
  ): void {
    if (config.salaryRange) {
      const { min, max } = config.salaryRange;

      if (min !== undefined) {
        if (min < 0) {
          errors.push('Minimum salary cannot be negative');
        }
        if (min > this.VALIDATION_CONFIG.MAX_SALARY) {
          errors.push(
            `Minimum salary cannot exceed ${this.VALIDATION_CONFIG.MAX_SALARY.toLocaleString()}`
          );
        }
      }

      if (max !== undefined) {
        if (max < 0) {
          errors.push('Maximum salary cannot be negative');
        }
        if (max > this.VALIDATION_CONFIG.MAX_SALARY) {
          errors.push(
            `Maximum salary cannot exceed ${this.VALIDATION_CONFIG.MAX_SALARY.toLocaleString()}`
          );
        }
      }

      if (min !== undefined && max !== undefined && min > max) {
        errors.push('Minimum salary cannot be greater than maximum salary');
      }
    }
  }

  /**
   * Validates boolean search configuration and integration with regular keywords
   * @param config - Job search configuration
   * @param errors - Array to collect validation errors
   */
  private static validateBooleanSearch(
    config: JobSearchConfig,
    errors: string[]
  ): void {
    if (config.booleanSearch?.enabled) {
      // Validate the boolean search configuration
      const booleanValidation = BooleanSearchConfigValidator.validate({
        enabled: config.booleanSearch.enabled,
        expression: config.booleanSearch.expression || '',
        fallbackKeywords: config.keywords,
        validateSyntax: config.booleanSearch.validateSyntax ?? true,
      });

      if (!booleanValidation.isValid) {
        errors.push(
          ...booleanValidation.errors.map(
            (error: ValidationError) => error.message
          )
        );
      }

      // Additional validation for boolean search integration
      if (
        config.booleanSearch.enabled &&
        (!config.booleanSearch.expression ||
          config.booleanSearch.expression.trim().length === 0) &&
        (!config.keywords || config.keywords.length === 0)
      ) {
        errors.push(
          'Either boolean search expression or regular keywords must be provided'
        );
      }
    }
  }
}

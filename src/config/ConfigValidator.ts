import { ConfigValidation } from '../types';

export class ConfigValidator {
  /**
   * Validates the complete bot configuration
   * @param config Configuration object to validate
   * @returns Validation result with errors and warnings
   */
  static validate(config: any): ConfigValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if config is an object
    if (!config || typeof config !== 'object') {
      errors.push('Configuration must be a valid object');
      return { isValid: false, errors, warnings };
    }

    // Validate LinkedIn credentials
    ConfigValidator.validateLinkedInConfig(config.linkedin, errors);

    // Validate search configuration
    ConfigValidator.validateSearchConfig(config.search, errors, warnings);

    // Validate application configuration
    ConfigValidator.validateApplicationConfig(
      config.application,
      errors,
      warnings
    );

    // Validate browser configuration
    ConfigValidator.validateBrowserConfig(config.browser, errors, warnings);

    // Validate delays configuration
    ConfigValidator.validateDelaysConfig(config.delays, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates LinkedIn credentials configuration
   */
  private static validateLinkedInConfig(linkedin: any, errors: string[]): void {
    if (!linkedin) {
      errors.push('LinkedIn configuration is required');
      return;
    }

    if (!linkedin.email || typeof linkedin.email !== 'string') {
      errors.push('LinkedIn email is required and must be a string');
    } else if (!ConfigValidator.isValidEmail(linkedin.email)) {
      errors.push('LinkedIn email must be a valid email address');
    }

    if (!linkedin.password || typeof linkedin.password !== 'string') {
      errors.push('LinkedIn password is required and must be a string');
    } else if (linkedin.password.length < 6) {
      errors.push('LinkedIn password must be at least 6 characters long');
    }
  }

  /**
   * Validates job search configuration
   */
  private static validateSearchConfig(
    search: any,
    errors: string[],
    warnings: string[]
  ): void {
    if (!search) {
      errors.push('Search configuration is required');
      return;
    }

    // Validate keywords
    if (!search.keywords || !Array.isArray(search.keywords)) {
      errors.push('Search keywords must be an array');
    } else if (search.keywords.length === 0) {
      warnings.push(
        'No search keywords specified - this may result in very broad searches'
      );
    } else {
      search.keywords.forEach((keyword: any, index: number) => {
        if (typeof keyword !== 'string') {
          errors.push(`Search keyword at index ${index} must be a string`);
        }
      });
    }

    // Validate location
    if (!search.location || typeof search.location !== 'string') {
      errors.push('Search location is required and must be a string');
    }

    // Validate date posted
    const validDateOptions = ['past24h', 'pastWeek', 'pastMonth', 'any'];
    if (!search.datePosted || !validDateOptions.includes(search.datePosted)) {
      errors.push(`Date posted must be one of: ${validDateOptions.join(', ')}`);
    }

    // Validate remote work
    if (typeof search.remoteWork !== 'boolean') {
      errors.push('Remote work preference must be a boolean');
    }

    // Validate experience level
    if (!search.experienceLevel || !Array.isArray(search.experienceLevel)) {
      errors.push('Experience level must be an array');
    } else {
      const validExperienceLevels = [
        'internship',
        'entry',
        'associate',
        'mid',
        'director',
        'executive',
      ];
      search.experienceLevel.forEach((level: any, index: number) => {
        if (
          typeof level !== 'string' ||
          !validExperienceLevels.includes(level)
        ) {
          errors.push(
            `Experience level at index ${index} must be one of: ${validExperienceLevels.join(', ')}`
          );
        }
      });
    }

    // Validate job type
    if (!search.jobType || !Array.isArray(search.jobType)) {
      errors.push('Job type must be an array');
    } else {
      const validJobTypes = [
        'fullTime',
        'partTime',
        'contract',
        'temporary',
        'volunteer',
        'internship',
      ];
      search.jobType.forEach((type: any, index: number) => {
        if (typeof type !== 'string' || !validJobTypes.includes(type)) {
          errors.push(
            `Job type at index ${index} must be one of: ${validJobTypes.join(', ')}`
          );
        }
      });
    }

    // Validate optional salary range
    if (search.salaryRange) {
      if (typeof search.salaryRange !== 'object') {
        errors.push('Salary range must be an object');
      } else {
        if (
          search.salaryRange.min !== undefined &&
          (typeof search.salaryRange.min !== 'number' ||
            search.salaryRange.min < 0)
        ) {
          errors.push('Salary range minimum must be a positive number');
        }
        if (
          search.salaryRange.max !== undefined &&
          (typeof search.salaryRange.max !== 'number' ||
            search.salaryRange.max < 0)
        ) {
          errors.push('Salary range maximum must be a positive number');
        }
        if (
          search.salaryRange.min &&
          search.salaryRange.max &&
          search.salaryRange.min > search.salaryRange.max
        ) {
          errors.push('Salary range minimum cannot be greater than maximum');
        }
      }
    }
  }

  /**
   * Validates application configuration
   */
  private static validateApplicationConfig(
    application: any,
    errors: string[],
    warnings: string[]
  ): void {
    if (!application) {
      errors.push('Application configuration is required');
      return;
    }

    // Validate personal info
    if (!application.personalInfo) {
      errors.push('Personal info configuration is required');
    } else {
      if (
        !application.personalInfo.experience ||
        typeof application.personalInfo.experience !== 'string'
      ) {
        errors.push('Experience description is required and must be a string');
      }

      // Validate salary expectation
      if (!application.personalInfo.salaryExpectation) {
        errors.push('Salary expectation is required');
      } else {
        const salary = application.personalInfo.salaryExpectation;

        if (typeof salary.min !== 'number' || salary.min < 0) {
          errors.push('Salary expectation minimum must be a positive number');
        }

        if (typeof salary.max !== 'number' || salary.max < 0) {
          errors.push('Salary expectation maximum must be a positive number');
        }

        if (salary.min && salary.max && salary.min > salary.max) {
          errors.push(
            'Salary expectation minimum cannot be greater than maximum'
          );
        }

        if (!salary.currency || typeof salary.currency !== 'string') {
          errors.push('Salary currency is required and must be a string');
        } else if (salary.currency.length !== 3) {
          warnings.push(
            'Salary currency should be a 3-letter currency code (e.g., USD, EUR)'
          );
        }
      }
    }

    // Validate common answers
    if (!application.commonAnswers) {
      warnings.push(
        'No common answers configured - forms may require manual intervention'
      );
    } else if (typeof application.commonAnswers !== 'object') {
      errors.push('Common answers must be an object');
    } else {
      Object.entries(application.commonAnswers).forEach(([key, value]) => {
        if (typeof value !== 'string') {
          errors.push(`Common answer for "${key}" must be a string`);
        }
      });
    }
  }

  /**
   * Validates browser configuration
   */
  private static validateBrowserConfig(
    browser: any,
    errors: string[],
    warnings: string[]
  ): void {
    if (!browser) {
      errors.push('Browser configuration is required');
      return;
    }

    if (typeof browser.headless !== 'boolean') {
      errors.push('Browser headless setting must be a boolean');
    }

    if (typeof browser.slowMo !== 'number' || browser.slowMo < 0) {
      errors.push('Browser slowMo must be a non-negative number');
    } else if (browser.slowMo > 1000) {
      warnings.push(
        'Browser slowMo is very high - this may significantly slow down execution'
      );
    }

    if (typeof browser.timeout !== 'number' || browser.timeout < 1000) {
      errors.push('Browser timeout must be a number >= 1000ms');
    } else if (browser.timeout < 30000) {
      warnings.push(
        'Browser timeout is quite low - consider increasing for better reliability'
      );
    }
  }

  /**
   * Validates delays configuration
   */
  private static validateDelaysConfig(
    delays: any,
    errors: string[],
    warnings: string[]
  ): void {
    if (!delays) {
      errors.push('Delays configuration is required');
      return;
    }

    const delayFields = [
      'minPageLoad',
      'maxPageLoad',
      'minTyping',
      'maxTyping',
    ];

    delayFields.forEach((field) => {
      if (typeof delays[field] !== 'number' || delays[field] < 0) {
        errors.push(`${field} must be a non-negative number`);
      }
    });

    // Validate min/max relationships
    if (
      delays.minPageLoad &&
      delays.maxPageLoad &&
      delays.minPageLoad > delays.maxPageLoad
    ) {
      errors.push('minPageLoad cannot be greater than maxPageLoad');
    }

    if (
      delays.minTyping &&
      delays.maxTyping &&
      delays.minTyping > delays.maxTyping
    ) {
      errors.push('minTyping cannot be greater than maxTyping');
    }

    // Performance warnings
    if (delays.maxPageLoad && delays.maxPageLoad > 10000) {
      warnings.push(
        'maxPageLoad is very high - this may significantly slow down execution'
      );
    }

    if (delays.maxTyping && delays.maxTyping > 500) {
      warnings.push('maxTyping is very high - typing will be very slow');
    }
  }

  /**
   * Validates email format
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validates that the configuration has all required fields
   * @param config Configuration to validate
   * @returns True if all required fields are present
   */
  static hasRequiredFields(config: any): boolean {
    const requiredPaths = [
      'linkedin.email',
      'linkedin.password',
      'search.keywords',
      'search.location',
      'search.datePosted',
      'search.remoteWork',
      'search.experienceLevel',
      'search.jobType',
      'application.personalInfo.experience',
      'application.personalInfo.salaryExpectation.min',
      'application.personalInfo.salaryExpectation.max',
      'application.personalInfo.salaryExpectation.currency',
      'browser.headless',
      'browser.slowMo',
      'browser.timeout',
      'delays.minPageLoad',
      'delays.maxPageLoad',
      'delays.minTyping',
      'delays.maxTyping',
    ];

    return requiredPaths.every((path) => {
      const value = ConfigValidator.getNestedValue(config, path);
      return value !== undefined && value !== null;
    });
  }

  /**
   * Gets a nested value from an object using dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

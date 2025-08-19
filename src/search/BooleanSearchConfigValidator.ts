import { ValidationError, ValidationResult } from '../types';
import { BooleanSearchBuilder } from './BooleanSearchBuilder';

/**
 * Validates boolean search configuration for LinkedIn job searches
 */
export class BooleanSearchConfigValidator {
  private static readonly booleanSearchBuilder = new BooleanSearchBuilder();

  /**
   * Validates a boolean search configuration
   */
  public static validate(config: {
    enabled: boolean;
    expression: string;
    fallbackKeywords?: string[];
    validateSyntax?: boolean;
  }): ValidationResult {
    const errors: ValidationError[] = [];

    // If boolean search is disabled, no validation needed
    if (!config.enabled) {
      return { isValid: true, errors: [] };
    }

    // Validate expression is provided
    if (!config.expression || config.expression.trim().length === 0) {
      errors.push({
        field: 'booleanSearch.expression',
        message: 'Boolean search expression is required when enabled',
        code: 'REQUIRED_FIELD',
        value: config.expression,
      });
    }

    // Validate expression syntax if requested
    if (config.validateSyntax !== false && config.expression) {
      const syntaxValidation =
        this.booleanSearchBuilder.validateBooleanExpression(config.expression);

      if (!syntaxValidation.isValid) {
        errors.push(
          ...syntaxValidation.errors.map((error) => ({
            field: 'booleanSearch.expression',
            message: error,
            code: 'INVALID_SYNTAX',
            value: config.expression,
          }))
        );
      }
    }

    // Validate fallback keywords
    if (config.fallbackKeywords) {
      if (!Array.isArray(config.fallbackKeywords)) {
        errors.push({
          field: 'booleanSearch.fallbackKeywords',
          message: 'Fallback keywords must be an array',
          code: 'INVALID_TYPE',
          value: config.fallbackKeywords,
        });
      } else if (config.fallbackKeywords.length === 0) {
        errors.push({
          field: 'booleanSearch.fallbackKeywords',
          message: 'At least one fallback keyword is recommended',
          code: 'EMPTY_ARRAY',
          value: config.fallbackKeywords,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates the overall job search config including boolean search
   */
  public static validateJobSearchConfig(config: any): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate boolean search if present
    if (config.booleanSearch) {
      const booleanValidation = this.validate(config.booleanSearch);
      errors.push(...booleanValidation.errors);
    }

    // If boolean search is enabled but no fallback keywords and no regular keywords
    if (
      config.booleanSearch?.enabled &&
      (!config.booleanSearch.fallbackKeywords ||
        config.booleanSearch.fallbackKeywords.length === 0) &&
      (!config.keywords || config.keywords.length === 0)
    ) {
      errors.push({
        field: 'search',
        message:
          'Either fallback keywords or regular keywords must be provided when boolean search is enabled',
        code: 'MISSING_FALLBACK',
        value: config,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Provides suggestions for improving boolean search expressions
   */
  public static getSuggestions(expression: string): string[] {
    const suggestions: string[] = [];

    if (!expression || expression.trim().length === 0) {
      return ['Provide a boolean search expression'];
    }

    // Check for common improvements
    if (!expression.includes('"') && expression.includes(' ')) {
      suggestions.push(
        'Consider using quotes for exact phrases: "software engineer"'
      );
    }

    if (
      !expression.toUpperCase().includes('AND') &&
      !expression.toUpperCase().includes('OR')
    ) {
      suggestions.push(
        'Use AND/OR operators to combine terms: term1 AND term2'
      );
    }

    if (expression.length > 500) {
      suggestions.push(
        'Consider shortening the expression for better performance'
      );
    }

    if (expression.split(/\s+/).length > 20) {
      suggestions.push('Too many terms might reduce search effectiveness');
    }

    // Check for potential LinkedIn-specific improvements
    if (
      !expression.toLowerCase().includes('remote') &&
      !expression.toLowerCase().includes('location')
    ) {
      suggestions.push('Consider adding location-related terms if relevant');
    }

    return suggestions;
  }
}

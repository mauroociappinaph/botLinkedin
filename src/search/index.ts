/**
 * Search module exports
 *
 * This module provides advanced search capabilities for LinkedIn job searches,
 * including boolean search expressions and validation.
 */

export {
  BooleanOperator,
  BooleanSearchBuilder,
  type BooleanSearchConfig,
  type BooleanSearchTerm,
  type BooleanSearchValidation,
} from './BooleanSearchBuilder';

export { BooleanSearchConfigValidator } from './BooleanSearchConfigValidator';

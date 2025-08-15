/**
 * Custom error hierarchy for LinkedIn automation operations
 */

export class LinkedInError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'LinkedInError';
  }
}

export class NavigationError extends LinkedInError {
  constructor(message: string) {
    super(message, 'NAVIGATION_ERROR', true);
  }
}

export class SearchError extends LinkedInError {
  constructor(message: string, recoverable: boolean = true) {
    super(message, 'SEARCH_ERROR', recoverable);
  }
}

export class ExtractionError extends LinkedInError {
  constructor(message: string) {
    super(message, 'EXTRACTION_ERROR', true);
  }
}

export class AuthenticationError extends LinkedInError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', false);
  }
}

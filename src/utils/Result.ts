/**
 * Result pattern for better error handling
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

export interface Success<T> {
  success: true;
  data: T;
}

export interface Failure<E> {
  success: false;
  error: E;
}

export const createSuccess = <T>(data: T): Success<T> => ({
  success: true,
  data,
});

export const createFailure = <E>(error: E): Failure<E> => ({
  success: false,
  error,
});

// Aliases for convenience
export { createFailure as Failure, createSuccess as Success };

/**
 * Utility functions for working with Results
 */
export class ResultUtils {
  static isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
    return result.success;
  }

  static isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
    return !result.success;
  }

  static map<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
    if (ResultUtils.isSuccess(result)) {
      return createSuccess(fn(result.data));
    }
    return result;
  }

  static mapError<T, E, F>(
    result: Result<T, E>,
    fn: (error: E) => F
  ): Result<T, F> {
    if (ResultUtils.isFailure(result)) {
      return createFailure(fn(result.error));
    }
    return result;
  }
}

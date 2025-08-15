import { InteractionConfig, ValidationResult, ValidationRule } from './InteractionConfig';

/**
 * Validation rules for different configuration types
 */
class RetryValidationRule implements ValidationRule<number> {
    validate(retries: number): ValidationResult {
        const errors: string[] = [];

        if (retries < 0 || retries > 10) {
            errors.push('Retries must be between 0 and 10');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }
}

class TimeoutValidationRule implements ValidationRule<number> {
    validate(timeout: number): ValidationResult {
        const errors: string[] = [];

        if (timeout < 1000 || timeout > 60000) {
            errors.push('Timeout must be between 1 and 60 seconds');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }
}

class DelayValidationRule implements ValidationRule<number> {
    validate(delay: number): ValidationResult {
        const errors: string[] = [];

        if (delay < 0 || delay > 5000) {
            errors.push('Delay must be between 0 and 5000 milliseconds');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }
}

/**
 * Comprehensive configuration validator
 */
export class InteractionConfigValidator {
    private rules: Map<string, ValidationRule<any>> = new Map([
        ['retries', new RetryValidationRule()],
        ['timeout', new TimeoutValidationRule()],
        ['delay', new DelayValidationRule()],
    ]);

    /**
     * Validates interaction configuration
     */
    validate(config: Partial<InteractionConfig>): ValidationResult {
        const allErrors: string[] = [];

        for (const [key, value] of Object.entries(config)) {
            const rule = this.rules.get(key);
            if (rule && value !== undefined) {
                const result = rule.validate(value);
                allErrors.push(...result.errors);
            }
        }

        return {
            isValid: allErrors.length === 0,
            errors: allErrors,
        };
    }

    /**
     * Adds a custom validation rule
     */
    addRule<T>(key: string, rule: ValidationRule<T>): void {
        this.rules.set(key, rule);
    }
}

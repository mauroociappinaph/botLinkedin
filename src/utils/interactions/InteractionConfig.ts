/**
 * Configuration interfaces for human-like interactions
 */

export interface InteractionConfig {
    retries?: number;
    timeout?: number;
    moveToElement?: boolean;
    delay?: number;
}

export interface TypingConfig extends InteractionConfig {
    minDelay?: number;
    maxDelay?: number;
    clearFirst?: boolean;
    pressEnter?: boolean;
}

export interface ClickConfig extends InteractionConfig {
    doubleClick?: boolean;
    rightClick?: boolean;
}

export interface ScrollConfig extends InteractionConfig {
    direction?: 'up' | 'down';
    distance?: number;
    steps?: number;
}

export interface TimingAction {
    type: 'click' | 'type' | 'scroll' | 'wait';
    selector?: string;
    text?: string;
    delay?: { min: number; max: number };
    retries?: number;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

/**
 * Validation rule interface
 */
export interface ValidationRule<T> {
    validate(value: T): ValidationResult;
}

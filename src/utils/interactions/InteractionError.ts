

/**
 * Custom error class for interaction failures
 */
export class InteractionError extends Error {
    public readonly timestamp: Date;

    constructor(
        public readonly operation: string,
        public readonly selector?: string | null,
        public readonly attempts?: number | null,
        public readonly originalError?: Error | null,
        public readonly context?: Record<string, unknown> | null
    ) {
        if (!operation?.trim()) {
            throw new Error('Operation name is required and cannot be empty');
        }

        if (attempts !== null && attempts !== undefined && attempts < 0) {
            throw new Error('Attempts must be a non-negative number');
        }

        const selectorPart = selector ? ` for ${selector}` : '';
        const attemptsPart = attempts ? ` after ${attempts} attempts` : '';
        const message = `${operation} failed${selectorPart}${attemptsPart}`;

        super(message);

        // Set cause property if originalError exists
        if (originalError) {
            Object.defineProperty(this, 'cause', {
                value: originalError,
                writable: false,
                enumerable: false,
                configurable: true
            });
        }

        this.name = 'InteractionError';
        this.timestamp = new Date();
    }

    /**
     * Converts the error to a structured object for logging
     */
    public toLogContext(): Record<string, unknown> {
        const logContext: Record<string, unknown> = {
            operation: this.operation,
            timestamp: this.timestamp.toISOString(),
            userMessage: this.getUserMessage(),
        };

        // Only include non-null/undefined values
        if (this.selector) {
            logContext['selector'] = this.selector;
        }
        if (this.attempts != null) {
            logContext['attempts'] = this.attempts;
        }
        if (this.context) {
            logContext['context'] = this.context;
        }
        if (this.stack) {
            logContext['stack'] = this.stack;
        }

        if (this.originalError) {
            logContext['originalError'] = {
                message: this.originalError.message,
                name: this.originalError.name,
                ...(this.originalError.stack && { stack: this.originalError.stack })
            };
        }

        return logContext;
    }

    /**
     * Creates a user-friendly error message without technical details
     */
    public getUserMessage(): string {
        const action = this.operation === 'click' ? 'clicking' :
            this.operation === 'type' ? 'typing into' :
                this.operation === 'scroll' ? 'scrolling' :
                    this.operation === 'move' ? 'moving to' :
                        `performing ${this.operation} on`;

        return `Failed ${action}${this.selector ? ` element ${this.selector}` : ' page element'}. Please try again.`;
    }

    /**
     * Factory method for timeout errors
     */
    public static timeout(operation: string, selector?: string, timeoutMs?: number): InteractionError {
        const context = timeoutMs ? { timeoutMs } : undefined;
        return new InteractionError(operation, selector, undefined, undefined, context);
    }

    /**
     * Factory method for element not found errors
     */
    public static elementNotFound(selector: string): InteractionError {
        return new InteractionError('element lookup', selector, undefined, undefined, { reason: 'not found' });
    }

    /**
     * Factory method for retry exhaustion errors
     */
    public static retriesExhausted(operation: string, selector: string, attempts: number, lastError?: Error): InteractionError {
        return new InteractionError(operation, selector, attempts, lastError, { reason: 'retries exhausted' });
    }
}

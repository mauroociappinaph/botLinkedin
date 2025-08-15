/**
 * Custom error class for interaction failures
 */
export class InteractionError extends Error {
    public readonly timestamp: Date;

    constructor(
        public readonly operation: string,
        public readonly selector?: string,
        public readonly attempts?: number,
        public readonly originalError?: Error,
        public readonly context?: Record<string, unknown>
    ) {
        const message = `${operation} failed${selector ? ` for ${selector}` : ''}${attempts ? ` after ${attempts} attempts` : ''}`;
        super(message);
        this.name = 'InteractionError';
        // Set cause property if originalError exists (ES2022 feature)
        if (originalError && 'cause' in Error.prototype) {
            (this as unknown).cause = originalError;
        }
        this.timestamp = new Date();
    }

    /**
     * Converts the error to a structured object for logging
     */
    public toLogContext(): Record<string, unknown> {
        return {
            operation: this.operation,
            selector: this.selector,
            attempts: this.attempts,
            timestamp: this.timestamp.toISOString(),
            originalError: this.originalError?.message,
            context: this.context,
            stack: this.stack,
        };
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
}

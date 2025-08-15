import { InteractionError } from '../../../../src/utils/interactions/InteractionError';

describe('InteractionError', () => {
    it('should create error with operation only', () => {
        const error = new InteractionError('click');

        expect(error.operation).toBe('click');
        expect(error.selector).toBeUndefined();
        expect(error.attempts).toBeUndefined();
        expect(error.message).toBe('click failed');
        expect(error.name).toBe('InteractionError');
    });

    it('should create error with operation and selector', () => {
        const error = new InteractionError('click', '#button');

        expect(error.operation).toBe('click');
        expect(error.selector).toBe('#button');
        expect(error.message).toBe('click failed for #button');
    });

    it('should create error with all parameters', () => {
        const cause = new Error('Network timeout');
        const error = new InteractionError('type', '#input', 3, cause);

        expect(error.operation).toBe('type');
        expect(error.selector).toBe('#input');
        expect(error.attempts).toBe(3);
        // Note: cause property is set but not directly accessible in older TypeScript versions
        expect(error.message).toBe('type failed for #input after 3 attempts');
    });

    it('should validate constructor parameters', () => {
        expect(() => new InteractionError('')).toThrow('Operation name is required and cannot be empty');
        expect(() => new InteractionError('click', '#button', -1)).toThrow('Attempts must be a non-negative number');
    });

    describe('factory methods', () => {
        it('should create timeout error', () => {
            const error = InteractionError.timeout('click', '#button', 5000);
            expect(error.operation).toBe('click');
            expect(error.selector).toBe('#button');
            expect(error.context).toEqual({ timeoutMs: 5000 });
        });

        it('should create element not found error', () => {
            const error = InteractionError.elementNotFound('#missing');
            expect(error.operation).toBe('element lookup');
            expect(error.selector).toBe('#missing');
            expect(error.context).toEqual({ reason: 'not found' });
        });

        it('should create retries exhausted error', () => {
            const lastError = new Error('Connection failed');
            const error = InteractionError.retriesExhausted('click', '#button', 3, lastError);
            expect(error.operation).toBe('click');
            expect(error.attempts).toBe(3);
            expect(error.originalError).toBe(lastError);
            expect(error.context).toEqual({ reason: 'retries exhausted' });
        });
    });
});

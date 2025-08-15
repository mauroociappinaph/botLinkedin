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
});

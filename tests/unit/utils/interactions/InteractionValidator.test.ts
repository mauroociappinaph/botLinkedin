import { InteractionConfigValidator } from '../../../../src/utils/interactions/InteractionValidator';

describe('InteractionConfigValidator', () => {
    let validator: InteractionConfigValidator;

    beforeEach(() => {
        validator = new InteractionConfigValidator();
    });

    it('should validate valid configuration', () => {
        const config = {
            retries: 3,
            timeout: 5000,
            delay: 100
        };

        const result = validator.validate(config);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid retries', () => {
        const config = {
            retries: -1
        };

        const result = validator.validate(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Retries must be between 0 and 10');
    });

    it('should reject invalid timeout', () => {
        const config = {
            timeout: 500
        };

        const result = validator.validate(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Timeout must be between 1 and 60 seconds');
    });

    it('should reject invalid delay', () => {
        const config = {
            delay: 10000
        };

        const result = validator.validate(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Delay must be between 0 and 5000 milliseconds');
    });

    it('should accumulate multiple errors', () => {
        const config = {
            retries: 15,
            timeout: 100,
            delay: -100
        };

        const result = validator.validate(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(3);
    });
});

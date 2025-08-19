import { ConfigValidator } from '../../../src/config/ConfigValidator';
import { BotConfig } from '../../../src/types';

// Test data factory functions
const createValidConfig = (): BotConfig => ({
    linkedin: {
        email: 'test@example.com',
        password: 'password123'
    },
    search: {
        keywords: ['software engineer', 'developer'],
        location: 'San Francisco, CA',
        datePosted: 'pastWeek',
        remoteWork: true,
        experienceLevel: ['mid', 'director'],
        jobType: ['fullTime', 'contract']
    },
    application: {
        personalInfo: {
            experience: 'Senior software engineer with 5 years of experience',
            salaryExpectation: {
                min: 100000,
                max: 150000,
                currency: 'USD'
            }
        },
        commonAnswers: {
            'Are you authorized to work in the US?': 'Yes',
            'Do you require sponsorship?': 'No'
        }
    },
    browser: {
        headless: true,
        slowMo: 100,
        timeout: 30000
    },
    delays: {
        minPageLoad: 1000,
        maxPageLoad: 3000,
        minTyping: 50,
        maxTyping: 150
    }
});

// Test utilities
const expectValidationError = (config: unknown, expectedError: string): void => {
    const result = ConfigValidator.validate(config);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(expectedError);
};

const expectValidationWarning = (config: BotConfig, expectedWarning: string): void => {
    const result = ConfigValidator.validate(config);
    expect(result.warnings).toContain(expectedWarning);
};

const createConfigWithOverride = <T extends keyof BotConfig>(
    section: T,
    overrides: Partial<BotConfig[T]>
): BotConfig => {
    const config = createValidConfig();
    return {
        ...config,
        [section]: { ...config[section], ...overrides }
    };
};

const createConfigWithoutSection = <T extends keyof BotConfig>(section: T): Partial<BotConfig> => {
    const config = createValidConfig();
    const { [section]: _, ...configWithoutSection } = config;
    return configWithoutSection;
};

// Test constants
const VALIDATION_ERRORS = {
    INVALID_OBJECT: 'Configuration must be a valid object',
    LINKEDIN_REQUIRED: 'LinkedIn configuration is required',
    INVALID_EMAIL: 'LinkedIn email must be a valid email address',
    EMAIL_STRING_REQUIRED: 'LinkedIn email is required and must be a string',
    PASSWORD_TOO_SHORT: 'LinkedIn password must be at least 6 characters long',
    PASSWORD_STRING_REQUIRED: 'LinkedIn password is required and must be a string',
    SEARCH_REQUIRED: 'Search configuration is required',
    KEYWORDS_ARRAY_REQUIRED: 'Search keywords must be an array',
    LOCATION_STRING_REQUIRED: 'Search location is required and must be a string',
    INVALID_DATE_POSTED: 'Date posted must be one of: past24h, pastWeek, pastMonth, any',
    REMOTE_WORK_BOOLEAN: 'Remote work preference must be a boolean',
    INVALID_EXPERIENCE_LEVEL: 'Experience level at index 1 must be one of: internship, entry, associate, mid, director, executive',
    INVALID_JOB_TYPE: 'Job type at index 1 must be one of: fullTime, partTime, contract, temporary, volunteer, internship',
    INVALID_SALARY_RANGE: 'Salary range minimum cannot be greater than maximum',
    APPLICATION_REQUIRED: 'Application configuration is required',
    PERSONAL_INFO_REQUIRED: 'Personal info configuration is required',
    EXPERIENCE_STRING_REQUIRED: 'Experience description is required and must be a string',
    BROWSER_REQUIRED: 'Browser configuration is required',
    HEADLESS_BOOLEAN_REQUIRED: 'Browser headless setting must be a boolean',
    DELAYS_REQUIRED: 'Delays configuration is required',
    MIN_MAX_PAGE_LOAD: 'minPageLoad cannot be greater than maxPageLoad',
    MIN_MAX_TYPING: 'minTyping cannot be greater than maxTyping'
} as const;

const VALIDATION_WARNINGS = {
    EMPTY_KEYWORDS: 'No search keywords specified - this may result in very broad searches',
    MISSING_COMMON_ANSWERS: 'No common answers configured - forms may require manual intervention',
    HIGH_SLOW_MO: 'Browser slowMo is very high - this may significantly slow down execution',
    LOW_TIMEOUT: 'Browser timeout is quite low - consider increasing for better reliability',
    HIGH_PAGE_LOAD: 'maxPageLoad is very high - this may significantly slow down execution',
    HIGH_TYPING: 'maxTyping is very high - typing will be very slow'
} as const;

describe('ConfigValidator', () => {
    let validConfig: BotConfig;

    beforeEach(() => {
        validConfig = createValidConfig();
    });

    describe('validate', () => {
        it('should validate a correct configuration', () => {
            const result = ConfigValidator.validate(validConfig);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });

        it('should reject null or undefined config', () => {
            expectValidationError(null, VALIDATION_ERRORS.INVALID_OBJECT);
        });

        it('should reject non-object config', () => {
            expectValidationError('invalid', VALIDATION_ERRORS.INVALID_OBJECT);
        });
    });

    describe('LinkedIn configuration validation', () => {
        it('should require LinkedIn configuration', () => {
            const config = createConfigWithoutSection('linkedin');
            expectValidationError(config, VALIDATION_ERRORS.LINKEDIN_REQUIRED);
        });

        it('should require valid email', () => {
            const config = createConfigWithOverride('linkedin', { email: 'invalid-email' });
            expectValidationError(config, VALIDATION_ERRORS.INVALID_EMAIL);
        });

        it('should require email to be a string', () => {
            const config = createConfigWithOverride('linkedin', { email: 123 as any });
            expectValidationError(config, VALIDATION_ERRORS.EMAIL_STRING_REQUIRED);
        });

        it('should require password with minimum length', () => {
            const config = createConfigWithOverride('linkedin', { password: '123' });
            expectValidationError(config, VALIDATION_ERRORS.PASSWORD_TOO_SHORT);
        });

        it('should require password to be a string', () => {
            const config = createConfigWithOverride('linkedin', { password: 123 as any });
            expectValidationError(config, VALIDATION_ERRORS.PASSWORD_STRING_REQUIRED);
        });
    });

    describe('Search configuration validation', () => {
        it('should require search configuration', () => {
            const config = createConfigWithoutSection('search');
            expectValidationError(config, VALIDATION_ERRORS.SEARCH_REQUIRED);
        });

        it('should require keywords array', () => {
            const config = createConfigWithOverride('search', { keywords: 'not-array' as any });
            expectValidationError(config, VALIDATION_ERRORS.KEYWORDS_ARRAY_REQUIRED);
        });

        it('should warn about empty keywords', () => {
            const config = createConfigWithOverride('search', { keywords: [] });
            expectValidationWarning(config, VALIDATION_WARNINGS.EMPTY_KEYWORDS);
        });

        it('should validate keyword types', () => {
            const config = createConfigWithOverride('search', {
                keywords: ['valid', 123 as any, 'also-valid']
            });
            expectValidationError(config, 'Search keyword at index 1 must be a string');
        });

        it('should require location string', () => {
            const config = createConfigWithOverride('search', { location: 123 as any });
            expectValidationError(config, VALIDATION_ERRORS.LOCATION_STRING_REQUIRED);
        });

        it('should validate datePosted values', () => {
            const config = createConfigWithOverride('search', { datePosted: 'invalid' as any });
            expectValidationError(config, VALIDATION_ERRORS.INVALID_DATE_POSTED);
        });

        it('should require boolean remoteWork', () => {
            const config = createConfigWithOverride('search', { remoteWork: 'yes' as any });
            expectValidationError(config, VALIDATION_ERRORS.REMOTE_WORK_BOOLEAN);
        });

        it('should validate experience level values', () => {
            const config = createConfigWithOverride('search', {
                experienceLevel: ['mid', 'invalid', 'senior']
            });
            expectValidationError(config, VALIDATION_ERRORS.INVALID_EXPERIENCE_LEVEL);
        });

        it('should validate job type values', () => {
            const config = createConfigWithOverride('search', {
                jobType: ['fullTime', 'invalid']
            });
            expectValidationError(config, VALIDATION_ERRORS.INVALID_JOB_TYPE);
        });

        it('should validate salary range when provided', () => {
            const config = createConfigWithOverride('search', {
                salaryRange: { min: 150000, max: 100000 }
            });
            expectValidationError(config, VALIDATION_ERRORS.INVALID_SALARY_RANGE);
        });
    });

    describe('Application configuration validation', () => {
        it('should require application configuration', () => {
            const config = createConfigWithoutSection('application');
            expectValidationError(config, VALIDATION_ERRORS.APPLICATION_REQUIRED);
        });

        it('should require personal info', () => {
            const config = createConfigWithOverride('application', {
                personalInfo: undefined as any
            });
            expectValidationError(config, VALIDATION_ERRORS.PERSONAL_INFO_REQUIRED);
        });

        it('should require experience string', () => {
            const config = createConfigWithOverride('application', {
                personalInfo: {
                    ...validConfig.application.personalInfo,
                    experience: 123 as any
                }
            });
            expectValidationError(config, VALIDATION_ERRORS.EXPERIENCE_STRING_REQUIRED);
        });

        it('should validate salary expectation structure', () => {
            const config = createConfigWithOverride('application', {
                personalInfo: {
                    ...validConfig.application.personalInfo,
                    salaryExpectation: {
                        min: 150000,
                        max: 100000,
                        currency: 'USD'
                    }
                }
            });
            expectValidationError(config, VALIDATION_ERRORS.INVALID_SALARY_RANGE);
        });

        it('should warn about missing common answers', () => {
            const config = createConfigWithOverride('application', {
                commonAnswers: undefined as any
            });
            expectValidationWarning(config, VALIDATION_WARNINGS.MISSING_COMMON_ANSWERS);
        });
    });

    describe('Browser configuration validation', () => {
        it('should require browser configuration', () => {
            const config = createConfigWithoutSection('browser');
            expectValidationError(config, VALIDATION_ERRORS.BROWSER_REQUIRED);
        });

        it('should require boolean headless', () => {
            const config = createConfigWithOverride('browser', { headless: 'true' as any });
            expectValidationError(config, VALIDATION_ERRORS.HEADLESS_BOOLEAN_REQUIRED);
        });

        it('should warn about high slowMo values', () => {
            const config = createConfigWithOverride('browser', { slowMo: 2000 });
            expectValidationWarning(config, VALIDATION_WARNINGS.HIGH_SLOW_MO);
        });

        it('should warn about low timeout values', () => {
            const config = createConfigWithOverride('browser', { timeout: 5000 });
            expectValidationWarning(config, VALIDATION_WARNINGS.LOW_TIMEOUT);
        });
    });

    describe('Delays configuration validation', () => {
        it('should require delays configuration', () => {
            const config = createConfigWithoutSection('delays');
            expectValidationError(config, VALIDATION_ERRORS.DELAYS_REQUIRED);
        });

        it('should validate min/max relationships', () => {
            const config = createConfigWithOverride('delays', {
                minPageLoad: 5000,
                maxPageLoad: 3000,
                minTyping: 200,
                maxTyping: 100
            });

            const result = ConfigValidator.validate(config);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain(VALIDATION_ERRORS.MIN_MAX_PAGE_LOAD);
            expect(result.errors).toContain(VALIDATION_ERRORS.MIN_MAX_TYPING);
        });

        it('should warn about high delay values', () => {
            const config = createConfigWithOverride('delays', {
                minPageLoad: 1000,
                maxPageLoad: 15000,
                minTyping: 50,
                maxTyping: 600
            });

            const result = ConfigValidator.validate(config);
            expect(result.warnings).toContain(VALIDATION_WARNINGS.HIGH_PAGE_LOAD);
            expect(result.warnings).toContain(VALIDATION_WARNINGS.HIGH_TYPING);
        });
    });

    describe('hasRequiredFields', () => {
        it('should return true for complete configuration', () => {
            const result = ConfigValidator.hasRequiredFields(validConfig);
            expect(result).toBe(true);
        });

        it('should return false for incomplete configuration', () => {
            const config = createConfigWithOverride('linkedin', { email: undefined as any });
            const result = ConfigValidator.hasRequiredFields(config);
            expect(result).toBe(false);
        });

        it('should handle nested missing fields', () => {
            const config = createConfigWithOverride('application', {
                personalInfo: {
                    ...validConfig.application.personalInfo,
                    experience: undefined as any
                }
            });
            const result = ConfigValidator.hasRequiredFields(config);
            expect(result).toBe(false);
        });
    });
});

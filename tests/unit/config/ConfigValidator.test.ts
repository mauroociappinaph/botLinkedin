import { ConfigValidator } from '../../../src/config/ConfigValidator';

describe('ConfigValidator', () => {
    const validConfig = {
        linkedin: {
            email: 'test@example.com',
            password: 'password123'
        },
        search: {
            keywords: ['software engineer'],
            location: 'San Francisco',
            datePosted: 'pastWeek',
            remoteWork: true,
            experienceLevel: ['mid'],
            jobType: ['fullTime']
        },
        application: {
            personalInfo: {
                experience: 'Senior developer with 5 years experience',
                salaryExpectation: {
                    min: 100000,
                    max: 150000,
                    currency: 'USD'
                }
            },
            commonAnswers: {
                'Why do you want to work here?': 'Great company culture'
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
    };

    describe('validate', () => {
        it('should validate correct configuration', () => {
            const result = ConfigValidator.validate(validConfig);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject null or undefined config', () => {
            const result = ConfigValidator.validate(null);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Configuration must be a valid object');
        });

        it('should reject invalid email format', () => {
            const invalidConfig = {
                ...validConfig,
                linkedin: {
                    ...validConfig.linkedin,
                    email: 'invalid-email'
                }
            };

            const result = ConfigValidator.validate(invalidConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('LinkedIn email must be a valid email address');
        });

        it('should reject short password', () => {
            const invalidConfig = {
                ...validConfig,
                linkedin: {
                    ...validConfig.linkedin,
                    password: '123'
                }
            };

            const result = ConfigValidator.validate(invalidConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('LinkedIn password must be at least 6 characters long');
        });

        it('should reject invalid date posted option', () => {
            const invalidConfig = {
                ...validConfig,
                search: {
                    ...validConfig.search,
                    datePosted: 'invalid'
                }
            };

            const result = ConfigValidator.validate(invalidConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Date posted must be one of: past24h, pastWeek, pastMonth, any');
        });

        it('should reject invalid experience level', () => {
            const invalidConfig = {
                ...validConfig,
                search: {
                    ...validConfig.search,
                    experienceLevel: ['invalid']
                }
            };

            const result = ConfigValidator.validate(invalidConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Experience level at index 0 must be one of: internship, entry, associate, mid, director, executive');
        });

        it('should reject invalid salary range', () => {
            const invalidConfig = {
                ...validConfig,
                application: {
                    ...validConfig.application,
                    personalInfo: {
                        ...validConfig.application.personalInfo,
                        salaryExpectation: {
                            min: 150000,
                            max: 100000, // max < min
                            currency: 'USD'
                        }
                    }
                }
            };

            const result = ConfigValidator.validate(invalidConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Salary expectation minimum cannot be greater than maximum');
        });

        it('should reject invalid browser timeout', () => {
            const invalidConfig = {
                ...validConfig,
                browser: {
                    ...validConfig.browser,
                    timeout: 500 // too low
                }
            };

            const result = ConfigValidator.validate(invalidConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Browser timeout must be a number >= 1000ms');
        });

        it('should reject invalid delay configuration', () => {
            const invalidConfig = {
                ...validConfig,
                delays: {
                    minPageLoad: 3000,
                    maxPageLoad: 1000, // max < min
                    minTyping: 50,
                    maxTyping: 150
                }
            };

            const result = ConfigValidator.validate(invalidConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('minPageLoad cannot be greater than maxPageLoad');
        });

        it('should generate warnings for potential issues', () => {
            const configWithWarnings = {
                ...validConfig,
                search: {
                    ...validConfig.search,
                    keywords: [] // empty keywords should generate warning
                },
                browser: {
                    ...validConfig.browser,
                    timeout: 15000 // low timeout should generate warning
                }
            };

            const result = ConfigValidator.validate(configWithWarnings);

            expect(result.warnings).toContain('No search keywords specified - this may result in very broad searches');
            expect(result.warnings).toContain('Browser timeout is quite low - consider increasing for better reliability');
        });
    });

    describe('hasRequiredFields', () => {
        it('should return true for complete configuration', () => {
            const result = ConfigValidator.hasRequiredFields(validConfig);
            expect(result).toBe(true);
        });

        it('should return false for incomplete configuration', () => {
            const incompleteConfig = {
                linkedin: {
                    email: 'test@example.com'
                    // missing password
                }
            };

            const result = ConfigValidator.hasRequiredFields(incompleteConfig);
            expect(result).toBe(false);
        });
    });
});

import { promises as fs } from 'fs';
import { join } from 'path';
import { ConfigLoader } from '../../src/config/ConfigLoader';
import { ConfigValidator } from '../../src/config/ConfigValidator';

describe('Configuration Integration', () => {
    const testConfigPath = join(__dirname, 'test-config.json');

    const validConfig = {
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
            jobType: ['fullTime']
        },
        application: {
            personalInfo: {
                experience: 'Senior software engineer with 5+ years of experience in full-stack development',
                salaryExpectation: {
                    min: 120000,
                    max: 180000,
                    currency: 'USD'
                }
            },
            commonAnswers: {
                'Why do you want to work here?': 'I am excited about the company mission and growth opportunities',
                'What are your salary expectations?': 'I am looking for a competitive salary based on market rates'
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

    beforeEach(async () => {
        // Clean up any existing test config
        try {
            await fs.unlink(testConfigPath);
        } catch {
            // File doesn't exist, that's fine
        }
    });

    afterEach(async () => {
        // Clean up test config
        try {
            await fs.unlink(testConfigPath);
        } catch {
            // File doesn't exist, that's fine
        }
    });

    it('should load and validate a complete configuration file', async () => {
        // Write test config file
        await fs.writeFile(testConfigPath, JSON.stringify(validConfig, null, 2));

        // Load configuration
        const loadedConfig = await ConfigLoader.load(testConfigPath);

        // Validate configuration
        const validation = ConfigValidator.validate(loadedConfig);

        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
        expect(loadedConfig).toEqual(validConfig);
    });

    it('should detect and report configuration errors', async () => {
        const invalidConfig = {
            ...validConfig,
            linkedin: {
                email: 'invalid-email', // Invalid email format
                password: '123' // Too short
            },
            search: {
                ...validConfig.search,
                datePosted: 'invalid', // Invalid option
                experienceLevel: ['invalid'] // Invalid experience level
            }
        };

        // Write invalid config file
        await fs.writeFile(testConfigPath, JSON.stringify(invalidConfig, null, 2));

        // Load configuration
        const loadedConfig = await ConfigLoader.load(testConfigPath);

        // Validate configuration
        const validation = ConfigValidator.validate(loadedConfig);

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
        expect(validation.errors).toContain('LinkedIn email must be a valid email address');
        expect(validation.errors).toContain('LinkedIn password must be at least 6 characters long');
        expect(validation.errors).toContain('Date posted must be one of: past24h, pastWeek, pastMonth, any');
    });

    it('should handle missing configuration file gracefully', async () => {
        const nonExistentPath = join(__dirname, 'non-existent-config.json');

        await expect(ConfigLoader.load(nonExistentPath)).rejects.toThrow(
            `Configuration file not found at: ${nonExistentPath}`
        );
    });

    it('should handle malformed JSON gracefully', async () => {
        const malformedJson = '{ "linkedin": { "email": "test@example.com", "password": "password123" } invalid }';

        await fs.writeFile(testConfigPath, malformedJson);

        await expect(ConfigLoader.load(testConfigPath)).rejects.toThrow(
            'Invalid JSON in configuration file'
        );
    });

    it('should validate required fields correctly', () => {
        expect(ConfigValidator.hasRequiredFields(validConfig)).toBe(true);

        const incompleteConfig = {
            linkedin: {
                email: 'test@example.com'
                // missing password and other required fields
            }
        };

        expect(ConfigValidator.hasRequiredFields(incompleteConfig)).toBe(false);
    });
});

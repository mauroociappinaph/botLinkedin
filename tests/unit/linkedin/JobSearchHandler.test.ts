import { JobSearchHandler } from '../../../src/linkedin/JobSearchHandler';
import { JobSearchConfig, LogLevel } from '../../../src/types';
import { Logger } from '../../../src/utils/Logger';

// Mock DelayUtils to avoid real delays in tests
jest.mock('../../../src/utils/DelayUtils', () => ({
    DelayUtils: {
        pageLoadDelay: jest.fn().mockResolvedValue(undefined),
        formFieldDelay: jest.fn().mockResolvedValue(undefined),
        randomDelay: jest.fn().mockResolvedValue(undefined),
        getRandomTypingDelay: jest.fn().mockReturnValue(50),
    },
}));

// Mock Puppeteer Page
const mockPage = {
    goto: jest.fn(),
    waitForSelector: jest.fn(),
    click: jest.fn(),
    type: jest.fn(),
    keyboard: {
        down: jest.fn(),
        press: jest.fn(),
        up: jest.fn(),
    },
    $: jest.fn(),
    $$: jest.fn(),
    $eval: jest.fn(),
    evaluate: jest.fn(),
} as any;

describe('JobSearchHandler', () => {
    let jobSearchHandler: JobSearchHandler;
    let mockLogger: Logger;
    let searchConfig: JobSearchConfig;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Create mock logger
        mockLogger = new Logger(LogLevel.DEBUG);
        jest.spyOn(mockLogger, 'info').mockImplementation();
        jest.spyOn(mockLogger, 'debug').mockImplementation();
        jest.spyOn(mockLogger, 'warn').mockImplementation();
        jest.spyOn(mockLogger, 'error').mockImplementation();

        // Create test search configuration
        searchConfig = {
            keywords: ['software engineer', 'developer'],
            location: 'San Francisco, CA',
            datePosted: 'pastWeek',
            remoteWork: true,
            experienceLevel: ['mid', 'associate'],
            jobType: ['fullTime'],
        };

        jobSearchHandler = new JobSearchHandler(mockPage, searchConfig, mockLogger);
    });

    describe('constructor', () => {
        it('should initialize with provided configuration', () => {
            expect(jobSearchHandler.getSearchConfig()).toEqual(searchConfig);
        });

        it('should create default logger if none provided', () => {
            const handler = new JobSearchHandler(mockPage, searchConfig);
            expect(handler).toBeDefined();
        });
    });

    describe('validateSearchConfig', () => {
        it('should validate correct configuration', () => {
            const validation = (jobSearchHandler as any).validateSearchConfig();
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it('should reject empty keywords array', () => {
            const invalidConfig = { ...searchConfig, keywords: [] };
            const handler = new JobSearchHandler(mockPage, invalidConfig, mockLogger);

            const validation = (handler as any).validateSearchConfig();
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Keywords are required');
        });

        it('should reject empty keyword strings', () => {
            const invalidConfig = { ...searchConfig, keywords: ['valid', '', '  '] };
            const handler = new JobSearchHandler(mockPage, invalidConfig, mockLogger);

            const validation = (handler as any).validateSearchConfig();
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Keywords cannot be empty');
        });

        it('should reject empty location', () => {
            const invalidConfig = { ...searchConfig, location: '' };
            const handler = new JobSearchHandler(mockPage, invalidConfig, mockLogger);

            const validation = (handler as any).validateSearchConfig();
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Location is required');
        });

        it('should reject whitespace-only location', () => {
            const invalidConfig = { ...searchConfig, location: '   ' };
            const handler = new JobSearchHandler(mockPage, invalidConfig, mockLogger);

            const validation = (handler as any).validateSearchConfig();
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Location is required');
        });

        it('should reject invalid date posted option', () => {
            const invalidConfig = { ...searchConfig, datePosted: 'invalid' as any };
            const handler = new JobSearchHandler(mockPage, invalidConfig, mockLogger);

            const validation = (handler as any).validateSearchConfig();
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Invalid date posted option');
        });

        it('should accept valid date posted options', () => {
            const validOptions = ['past24h', 'pastWeek', 'pastMonth', 'any'];

            validOptions.forEach(option => {
                const config = { ...searchConfig, datePosted: option as any };
                const handler = new JobSearchHandler(mockPage, config, mockLogger);
                const validation = (handler as any).validateSearchConfig();
                expect(validation.isValid).toBe(true);
            });
        });

        it('should reject invalid experience levels', () => {
            const invalidConfig = { ...searchConfig, experienceLevel: ['invalid', 'mid'] };
            const handler = new JobSearchHandler(mockPage, invalidConfig, mockLogger);

            const validation = (handler as any).validateSearchConfig();
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Invalid experience level specified');
        });

        it('should accept valid experience levels', () => {
            const validLevels = ['internship', 'entry', 'associate', 'mid', 'director', 'executive'];
            const config = { ...searchConfig, experienceLevel: validLevels };
            const handler = new JobSearchHandler(mockPage, config, mockLogger);

            const validation = (handler as any).validateSearchConfig();
            expect(validation.isValid).toBe(true);
        });

        it('should reject invalid job types', () => {
            const invalidConfig = { ...searchConfig, jobType: ['invalid', 'fullTime'] };
            const handler = new JobSearchHandler(mockPage, invalidConfig, mockLogger);

            const validation = (handler as any).validateSearchConfig();
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Invalid job type specified');
        });

        it('should accept valid job types', () => {
            const validTypes = ['fullTime', 'partTime', 'contract', 'temporary', 'volunteer', 'internship'];
            const config = { ...searchConfig, jobType: validTypes };
            const handler = new JobSearchHandler(mockPage, config, mockLogger);

            const validation = (handler as any).validateSearchConfig();
            expect(validation.isValid).toBe(true);
        });

        it('should accumulate multiple validation errors', () => {
            const invalidConfig = {
                ...searchConfig,
                keywords: [],
                location: '',
                datePosted: 'invalid' as any,
                experienceLevel: ['invalid'],
                jobType: ['invalid']
            };
            const handler = new JobSearchHandler(mockPage, invalidConfig, mockLogger);

            const validation = (handler as any).validateSearchConfig();
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toHaveLength(5);
            expect(validation.errors).toContain('Keywords are required');
            expect(validation.errors).toContain('Location is required');
            expect(validation.errors).toContain('Invalid date posted option');
            expect(validation.errors).toContain('Invalid experience level specified');
            expect(validation.errors).toContain('Invalid job type specified');
        });
    });

    describe('individual validation methods', () => {
        it('should validate keywords correctly', () => {
            const handler = jobSearchHandler as any;
            let errors: string[] = [];

            // Test valid keywords
            handler.searchConfig.keywords = ['software', 'engineer'];
            handler.validateKeywords(errors);
            expect(errors).toHaveLength(0);

            // Test empty keywords array
            errors = [];
            handler.searchConfig.keywords = [];
            handler.validateKeywords(errors);
            expect(errors).toContain('Keywords are required');

            // Test empty keyword strings
            errors = [];
            handler.searchConfig.keywords = ['valid', '', '  '];
            handler.validateKeywords(errors);
            expect(errors).toContain('Keywords cannot be empty');
        });

        it('should validate location correctly', () => {
            const handler = jobSearchHandler as any;
            let errors: string[] = [];

            // Test valid location
            handler.searchConfig.location = 'San Francisco, CA';
            handler.validateLocation(errors);
            expect(errors).toHaveLength(0);

            // Test empty location
            errors = [];
            handler.searchConfig.location = '';
            handler.validateLocation(errors);
            expect(errors).toContain('Location is required');

            // Test whitespace-only location
            errors = [];
            handler.searchConfig.location = '   ';
            handler.validateLocation(errors);
            expect(errors).toContain('Location is required');
        });

        it('should validate date posted correctly', () => {
            const handler = jobSearchHandler as any;
            let errors: string[] = [];

            // Test valid date options
            const validOptions = ['past24h', 'pastWeek', 'pastMonth', 'any'];
            validOptions.forEach(option => {
                errors = [];
                handler.searchConfig.datePosted = option;
                handler.validateDatePosted(errors);
                expect(errors).toHaveLength(0);
            });

            // Test invalid date option
            errors = [];
            handler.searchConfig.datePosted = 'invalid';
            handler.validateDatePosted(errors);
            expect(errors).toContain('Invalid date posted option');
        });

        it('should validate experience levels correctly', () => {
            const handler = jobSearchHandler as any;
            let errors: string[] = [];

            // Test valid experience levels
            handler.searchConfig.experienceLevel = ['entry', 'mid'];
            handler.validateExperienceLevels(errors);
            expect(errors).toHaveLength(0);

            // Test invalid experience level
            errors = [];
            handler.searchConfig.experienceLevel = ['invalid', 'mid'];
            handler.validateExperienceLevels(errors);
            expect(errors).toContain('Invalid experience level specified');

            // Test empty array (should be valid)
            errors = [];
            handler.searchConfig.experienceLevel = [];
            handler.validateExperienceLevels(errors);
            expect(errors).toHaveLength(0);
        });

        it('should validate job types correctly', () => {
            const handler = jobSearchHandler as any;
            let errors: string[] = [];

            // Test valid job types
            handler.searchConfig.jobType = ['fullTime', 'contract'];
            handler.validateJobTypes(errors);
            expect(errors).toHaveLength(0);

            // Test invalid job type
            errors = [];
            handler.searchConfig.jobType = ['invalid', 'fullTime'];
            handler.validateJobTypes(errors);
            expect(errors).toContain('Invalid job type specified');

            // Test empty array (should be valid)
            errors = [];
            handler.searchConfig.jobType = [];
            handler.validateJobTypes(errors);
            expect(errors).toHaveLength(0);
        });
    });

    describe('updateSearchConfig', () => {
        it('should update search configuration', () => {
            const updates = { location: 'New York, NY', remoteWork: false };
            jobSearchHandler.updateSearchConfig(updates);

            const updatedConfig = jobSearchHandler.getSearchConfig();
            expect(updatedConfig.location).toBe('New York, NY');
            expect(updatedConfig.remoteWork).toBe(false);
            expect(updatedConfig.keywords).toEqual(searchConfig.keywords); // Should preserve other fields
        });
    });

    describe('performSearch', () => {
        beforeEach(() => {
            // Mock successful page interactions
            mockPage.goto.mockResolvedValue(undefined);
            mockPage.waitForSelector.mockResolvedValue(undefined);
            mockPage.click.mockResolvedValue(undefined);
            mockPage.type.mockResolvedValue(undefined);
            mockPage.$$.mockResolvedValue([]);
            mockPage.$eval.mockResolvedValue('0 results');
        });

        it('should return error for invalid configuration', async () => {
            const invalidConfig = { ...searchConfig, keywords: [] };
            const handler = new JobSearchHandler(mockPage, invalidConfig, mockLogger);

            const result = await handler.performSearch();

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INVALID_SEARCH_CONFIG');
        });

        it('should handle search errors gracefully', async () => {
            mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

            const result = await jobSearchHandler.performSearch();

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('SEARCH_FAILED');
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should return successful result with valid configuration', async () => {
            // Mock successful search flow
            mockPage.$$.mockResolvedValue([]); // No job cards found
            mockPage.$eval.mockResolvedValue('0 results');
            mockPage.$.mockResolvedValue(null); // No next page button

            const result = await jobSearchHandler.performSearch();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.results).toEqual([]);
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Starting LinkedIn job search',
                expect.objectContaining({
                    keywords: searchConfig.keywords,
                    location: searchConfig.location
                })
            );
        }, 10000);
    });

    describe('extractJobFromCard', () => {
        it('should extract job information correctly', async () => {
            const mockJobCard = {
                $: jest.fn()
            };

            // Mock job card elements
            const mockTitleElement = {};
            const mockCompanyElement = {};
            const mockLocationElement = {};
            const mockEasyApplyElement = {};

            mockJobCard.$.mockImplementation((selector) => {
                if (selector.includes('title')) return mockTitleElement;
                if (selector.includes('company')) return mockCompanyElement;
                if (selector.includes('location')) return mockLocationElement;
                if (selector.includes('apply')) return mockEasyApplyElement;
                return null;
            });

            // Mock page.evaluate calls
            mockPage.evaluate
                .mockResolvedValueOnce('Software Engineer') // title
                .mockResolvedValueOnce('https://linkedin.com/jobs/view/123456') // url
                .mockResolvedValueOnce('Tech Company') // company
                .mockResolvedValueOnce('San Francisco, CA'); // location

            const job = await (jobSearchHandler as unknown).extractJobFromCard(mockJobCard);

            expect(job).toEqual({
                id: '123456',
                title: 'Software Engineer',
                company: 'Tech Company',
                location: 'San Francisco, CA',
                url: 'https://linkedin.com/jobs/view/123456',
                status: 'found',
                isEasyApply: true,
                appliedAt: null,
                description: null,
                salary: null,
                errorMessage: null
            });
        });

        it('should return null for jobs without Easy Apply', async () => {
            const mockJobCard = {
                $: jest.fn().mockResolvedValue(null) // No Easy Apply button
            };

            const job = await (jobSearchHandler as unknown).extractJobFromCard(mockJobCard);
            expect(job).toBeNull();
        });
    });
});

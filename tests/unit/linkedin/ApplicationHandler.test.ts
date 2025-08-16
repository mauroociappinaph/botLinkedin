import { ApplicationHandler } from '../../../src/linkedin/ApplicationHandler';
import { ApplicationConfig } from '../../../src/types';

// Mock dependencies
jest.mock('../../../src/database/JobRepository');
jest.mock('../../../src/utils/Logger');
jest.mock('../../../src/linkedin/FormFiller');

// Mock the JobRepository
const mockJobRepository = {
    getApplicationStats: jest.fn().mockResolvedValue({
        total: 10,
        applied: 5,
        skipped: 3,
        errors: 2,
    }),
};

// Mock the JobRepository constructor
jest.mock('../../../src/database/JobRepository', () => {
    return {
        JobRepository: jest.fn().mockImplementation(() => mockJobRepository),
    };
});

describe('ApplicationHandler', () => {
    let applicationHandler: ApplicationHandler;
    let mockApplicationConfig: ApplicationConfig;
    // let mockJobPosting: JobPosting;

    beforeEach(() => {
        mockApplicationConfig = {
            personalInfo: {
                experience: '3 years of software development experience',
                salaryExpectation: {
                    min: 70000,
                    max: 100000,
                    currency: 'USD',
                },
            },
            commonAnswers: {
                'Are you authorized to work in the US?': 'Yes',
                'Do you require sponsorship?': 'No',
            },
        };

        // mockJobPosting = {
        //     id: 'test-job-123',
        //     title: 'Software Engineer',
        //     company: 'Test Company',
        //     location: 'San Francisco, CA',
        //     url: 'https://linkedin.com/jobs/view/test-job-123',
        //     status: JobStatus.FOUND,
        //     isEasyApply: true,
        // };

        applicationHandler = new ApplicationHandler(mockApplicationConfig);
    });

    describe('constructor', () => {
        it('should initialize with application config', () => {
            expect(applicationHandler).toBeDefined();
        });
    });

    describe('updateApplicationConfig', () => {
        it('should update the form filler configuration', () => {
            const newConfig: ApplicationConfig = {
                ...mockApplicationConfig,
                personalInfo: {
                    ...mockApplicationConfig.personalInfo,
                    experience: '5 years of experience',
                },
            };

            expect(() => {
                applicationHandler.updateApplicationConfig(newConfig);
            }).not.toThrow();
        });
    });

    describe('getApplicationStats', () => {
        it('should return application statistics', async () => {
            const stats = await applicationHandler.getApplicationStats();

            expect(stats).toHaveProperty('total');
            expect(stats).toHaveProperty('applied');
            expect(stats).toHaveProperty('skipped');
            expect(stats).toHaveProperty('errors');
        });
    });
});

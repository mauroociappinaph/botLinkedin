import { JobPostingParser } from '../../../src/linkedin/JobPostingParser';
import { LogLevel } from '../../../src/types';
import { Logger } from '../../../src/utils/Logger';
import { MockPageBuilder } from '../../utils/MockPageBuilder';

describe('JobPostingParser', () => {
    let parser: JobPostingParser;
    let mockPage: any;
    let logger: Logger;

    beforeEach(() => {
        logger = new Logger(LogLevel.DEBUG);
        mockPage = new MockPageBuilder().build();

        // Add missing methods for our tests
        mockPage.$$ = jest.fn().mockResolvedValue([]);
        mockPage.goto = jest.fn().mockResolvedValue(undefined);
        mockPage.waitForSelector = jest.fn().mockResolvedValue(undefined);

        parser = new JobPostingParser(mockPage, logger);
    });

    describe('parseJobCard', () => {
        it('should parse a valid job card with Easy Apply', async () => {
            // Mock job card element
            const mockJobCard = {
                $: jest.fn().mockImplementation((selector: string) => {
                    if (selector.includes('title')) {
                        return Promise.resolve({});
                    }
                    if (selector.includes('company')) {
                        return Promise.resolve({});
                    }
                    if (selector.includes('location')) {
                        return Promise.resolve({});
                    }
                    if (selector.includes('apply-button')) {
                        return Promise.resolve({}); // Easy Apply button exists
                    }
                    return Promise.resolve(null);
                })
            };

            // Mock page.evaluate calls
            mockPage.evaluate
                .mockResolvedValueOnce('Software Engineer') // title
                .mockResolvedValueOnce('https://linkedin.com/jobs/view/123456') // url
                .mockResolvedValueOnce('Tech Company') // company
                .mockResolvedValueOnce('San Francisco, CA'); // location

            const result = await parser.parseJobCard(mockJobCard as any);

            expect(result).not.toBeNull();
            expect(result?.id).toBe('123456');
            expect(result?.title).toBe('Software Engineer');
            expect(result?.company).toBe('Tech Company');
            expect(result?.location).toBe('San Francisco, CA');
            expect(result?.isEasyApply).toBe(true);
            expect(result?.status).toBe('found');
        });

        it('should return null for job without Easy Apply', async () => {
            const mockJobCard = {
                $: jest.fn().mockImplementation((selector: string) => {
                    if (selector.includes('title')) {
                        return Promise.resolve({});
                    }
                    if (selector.includes('company')) {
                        return Promise.resolve({});
                    }
                    if (selector.includes('location')) {
                        return Promise.resolve({});
                    }
                    if (selector.includes('apply-button')) {
                        return Promise.resolve(null); // No Easy Apply button
                    }
                    return Promise.resolve(null);
                })
            };

            mockPage.evaluate
                .mockResolvedValueOnce('Software Engineer')
                .mockResolvedValueOnce('https://linkedin.com/jobs/view/123456')
                .mockResolvedValueOnce('Tech Company')
                .mockResolvedValueOnce('San Francisco, CA');

            const result = await parser.parseJobCard(mockJobCard as any);

            expect(result).toBeNull();
        });

        it('should return null for job with missing required fields', async () => {
            const mockJobCard = {
                $: jest.fn().mockImplementation((selector: string) => {
                    if (selector.includes('title')) {
                        return Promise.resolve({});
                    }
                    if (selector.includes('company')) {
                        return Promise.resolve(null); // Missing company
                    }
                    if (selector.includes('location')) {
                        return Promise.resolve({});
                    }
                    if (selector.includes('apply-button')) {
                        return Promise.resolve({});
                    }
                    return Promise.resolve(null);
                })
            };

            mockPage.evaluate
                .mockResolvedValueOnce('Software Engineer')
                .mockResolvedValueOnce('https://linkedin.com/jobs/view/123456')
                .mockResolvedValueOnce('') // Empty company
                .mockResolvedValueOnce('San Francisco, CA');

            const result = await parser.parseJobCard(mockJobCard as any);

            expect(result).toBeNull();
        });
    });

    describe('extractJobIdFromUrl', () => {
        it('should extract job ID from LinkedIn URL', () => {
            const url = 'https://www.linkedin.com/jobs/view/123456789?refId=abc';
            const parser = new JobPostingParser(mockPage, logger);

            // Access private method for testing
            const extractJobIdFromUrl = (parser as any).extractJobIdFromUrl;
            const jobId = extractJobIdFromUrl(url);

            expect(jobId).toBe('123456789');
        });

        it('should return empty string for invalid URL', () => {
            const url = 'https://www.linkedin.com/invalid-url';
            const parser = new JobPostingParser(mockPage, logger);

            const extractJobIdFromUrl = (parser as any).extractJobIdFromUrl;
            const jobId = extractJobIdFromUrl(url);

            expect(jobId).toBe('');
        });
    });

    describe('validateJobPosting', () => {
        it('should validate job with all required fields', () => {
            const job = {
                id: '123456',
                title: 'Software Engineer',
                company: 'Tech Company',
                url: 'https://linkedin.com/jobs/view/123456'
            };

            const isValid = parser.validateJobPosting(job);
            expect(isValid).toBe(true);
        });

        it('should reject job with missing required fields', () => {
            const job = {
                id: '',
                title: 'Software Engineer',
                company: 'Tech Company',
                url: 'https://linkedin.com/jobs/view/123456'
            };

            const isValid = parser.validateJobPosting(job);
            expect(isValid).toBe(false);
        });
    });

    describe('sanitizeJobData', () => {
        it('should sanitize valid job data', () => {
            const job = {
                id: '123456',
                title: '  Software Engineer  ',
                company: '  Tech Company  ',
                location: '  San Francisco, CA  ',
                url: 'https://linkedin.com/jobs/view/123456'
            };

            const sanitized = parser.sanitizeJobData(job);

            expect(sanitized).not.toBeNull();
            expect(sanitized?.title).toBe('Software Engineer');
            expect(sanitized?.company).toBe('Tech Company');
            expect(sanitized?.location).toBe('San Francisco, CA');
            expect(sanitized?.isEasyApply).toBe(true);
        });

        it('should return null for invalid job data', () => {
            const job = {
                id: '',
                title: 'Software Engineer',
                company: 'Tech Company'
            };

            const sanitized = parser.sanitizeJobData(job);
            expect(sanitized).toBeNull();
        });

        it('should provide defaults for optional fields', () => {
            const job = {
                id: '123456',
                title: 'Software Engineer',
                company: 'Tech Company',
                url: 'https://linkedin.com/jobs/view/123456'
            };

            const sanitized = parser.sanitizeJobData(job);

            expect(sanitized?.location).toBe('Location not specified');
            expect(sanitized?.description).toBeNull();
            expect(sanitized?.salary).toBeNull();
            expect(sanitized?.status).toBe('found');
        });
    });

    describe('fetchJobDetails', () => {
        it('should fetch job details successfully', async () => {
            const jobPosting = {
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
            };

            // Mock successful navigation and element finding
            mockPage.goto.mockResolvedValue(undefined);
            mockPage.waitForSelector.mockResolvedValue(undefined);
            mockPage.$.mockResolvedValue({});
            mockPage.evaluate.mockResolvedValueOnce('Job description content');

            const result = await parser.fetchJobDetails(jobPosting);

            expect(result.success).toBe(true);
            expect(result.data?.description).toBe('Job description content');
        });

        it('should handle missing job URL', async () => {
            const jobPosting = {
                id: '123456',
                title: 'Software Engineer',
                company: 'Tech Company',
                location: 'San Francisco, CA',
                url: '',
                status: 'found',
                isEasyApply: true,
                appliedAt: null,
                description: null,
                salary: null,
                errorMessage: null
            };

            const result = await parser.fetchJobDetails(jobPosting);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('MISSING_JOB_URL');
        });
    });
});

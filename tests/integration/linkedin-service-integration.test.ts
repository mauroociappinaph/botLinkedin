import { Page } from 'puppeteer';
import { BrowserManager } from '../../src/browser/BrowserManager';
import { DatabaseService } from '../../src/database/DatabaseService';
import { JobRepository } from '../../src/database/JobRepository';
import { BotConfig, JobPosting, JobStatus } from '../../src/types';

// Test constants
const TEST_TIMEOUTS = {
    DEFAULT: 5000,
    PAGE_LOAD: 3000,
    ELEMENT_WAIT: 2000
} as const;

// Test data factories
const createTestJob = (overrides: Partial<JobPosting> = {}): JobPosting => ({
    id: 'test-job-123',
    title: 'Test Software Engineer',
    company: 'Test Company',
    location: 'Test Location',
    url: 'https://linkedin.com/jobs/view/test-job-123',
    description: 'Test job description',
    salary: '$120,000 - $180,000',
    status: JobStatus.FOUND,
    isEasyApply: true,
    appliedAt: null,
    errorMessage: null,
    ...overrides
});

const createTestJobs = (count: number, statusOverride?: JobStatus): JobPosting[] =>
    Array.from({ length: count }, (_, i) => createTestJob({
        id: `test-job-${i}`,
        title: `Test Job ${i}`,
        company: `Company ${i}`,
        location: `Location ${i}`,
        url: `https://linkedin.com/jobs/view/test-job-${i}`,
        status: statusOverride || JobStatus.FOUND
    }));



describe('LinkedIn Service Integration Tests', () => {
    let browserManager: BrowserManager;
    let page: Page;
    let databaseService: DatabaseService;
    let jobRepository: JobRepository;
    // let logger: Logger; // Commented out as not used in current tests

    const testConfig: BotConfig = {
        linkedin: {
            email: 'test@example.com',
            password: 'testpassword123'
        },
        search: {
            keywords: ['software engineer'],
            location: 'San Francisco, CA',
            datePosted: 'pastWeek',
            remoteWork: true,
            experienceLevel: ['mid'],
            jobType: ['fullTime']
        },
        application: {
            personalInfo: {
                experience: 'Senior software engineer with 5+ years of experience',
                salaryExpectation: {
                    min: 120000,
                    max: 180000,
                    currency: 'USD'
                }
            },
            commonAnswers: {
                'Why do you want to work here?': 'I am excited about the company mission',
                'What are your salary expectations?': 'Competitive salary based on market rates'
            }
        },
        browser: {
            headless: true,
            slowMo: 0,
            timeout: 30000
        },
        delays: {
            minPageLoad: 100,
            maxPageLoad: 200,
            minTyping: 10,
            maxTyping: 20
        }
    };

    beforeAll(async () => {
        // Initialize database
        databaseService = DatabaseService.getInstance();
        await databaseService.connect();
        jobRepository = new JobRepository();
        // logger = new Logger({ level: LogLevel.ERROR }); // Reduce log noise in tests

        // Initialize browser for mock LinkedIn pages
        browserManager = new BrowserManager(testConfig.browser);
        await browserManager.launch();
        page = await browserManager.newPage();
    });

    afterAll(async () => {
        if (browserManager) {
            await browserManager.close();
        }
        if (databaseService) {
            await databaseService.disconnect();
        }
    });

    beforeEach(async () => {
        // Clean up database before each test
        const prisma = databaseService.getClient();
        await prisma.jobPosting.deleteMany();
        await prisma.applicationSession.deleteMany();
    });

    describe('LinkedIn Login Flow', () => {
        const HTML_MOCKS = {
            LOGIN_PAGE: `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Login</title></head>
                <body>
                    <form id="login-form">
                        <input type="email" id="username" name="session_key" />
                        <input type="password" id="password" name="session_password" />
                        <button type="submit" class="btn__primary--large">Sign in</button>
                    </form>
                </body>
                </html>
            `,
            LOGIN_WITH_SUCCESS: `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Login</title></head>
                <body>
                    <form id="login-form">
                        <input type="email" id="username" name="session_key" />
                        <input type="password" id="password" name="session_password" />
                        <button type="submit" class="btn__primary--large">Sign in</button>
                    </form>
                    <script>
                        document.getElementById('login-form').addEventListener('submit', function(e) {
                            e.preventDefault();
                            document.body.innerHTML = '<div id="logged-in">Welcome to LinkedIn</div>';
                        });
                    </script>
                </body>
                </html>
            `,
            LOGIN_WITH_ERROR: `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Login</title></head>
                <body>
                    <form id="login-form">
                        <input type="email" id="username" name="session_key" />
                        <input type="password" id="password" name="session_password" />
                        <button type="submit" class="btn__primary--large">Sign in</button>
                    </form>
                    <div class="alert alert--error" style="display: none;">
                        There was a problem with your login
                    </div>
                    <script>
                        document.getElementById('login-form').addEventListener('submit', function(e) {
                            e.preventDefault();
                            document.querySelector('.alert--error').style.display = 'block';
                        });
                    </script>
                </body>
                </html>
            `
        };

        it('should handle login page navigation', async () => {
            await page.setContent(HTML_MOCKS.LOGIN_PAGE);

            // Test that login elements are found
            const emailInput = await page.$('#username');
            const passwordInput = await page.$('#password');
            const submitButton = await page.$('button[type="submit"]');

            expect(emailInput).toBeTruthy();
            expect(passwordInput).toBeTruthy();
            expect(submitButton).toBeTruthy();
        });

        it('should handle login form submission', async () => {
            await page.setContent(HTML_MOCKS.LOGIN_WITH_SUCCESS);

            // Fill login form
            await page.type('#username', testConfig.linkedin.email);
            await page.type('#password', testConfig.linkedin.password);

            // Submit form
            await page.click('button[type="submit"]');

            // Wait for login success indicator
            await page.waitForSelector('#logged-in', { timeout: TEST_TIMEOUTS.DEFAULT });

            const loggedInElement = await page.$('#logged-in');
            expect(loggedInElement).toBeTruthy();
        });

        it('should handle authentication errors gracefully', async () => {
            await page.setContent(HTML_MOCKS.LOGIN_WITH_ERROR);

            // Fill with invalid credentials
            await page.type('#username', 'invalid@example.com');
            await page.type('#password', 'wrongpassword');

            // Submit form
            await page.click('button[type="submit"]');

            // Wait for error message
            await page.waitForSelector('.alert--error', { visible: true, timeout: TEST_TIMEOUTS.DEFAULT });

            const errorElement = await page.$('.alert--error');
            const isVisible = await page.evaluate(el => el && (el as HTMLElement).style.display !== 'none', errorElement);
            expect(isVisible).toBe(true);
        });
    });

    describe('Job Search Functionality', () => {
        it('should navigate to jobs page and apply search filters', async () => {
            const mockJobsPage = `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Jobs</title></head>
                <body>
                    <div class="jobs-search-box">
                        <input type="text" id="jobs-search-box-keyword-id-ember123" placeholder="Search jobs" />
                        <input type="text" id="jobs-search-box-location-id-ember456" placeholder="Location" />
                        <button class="jobs-search-box__submit-button">Search</button>
                    </div>
                    <div class="search-reusables__filters-bar">
                        <button class="search-reusables__filter-pill-button">All filters</button>
                    </div>
                    <div class="jobs-search-results-list" style="display: none;">
                        <div class="job-result-card">
                            <h3 class="job-result-card__title">Software Engineer</h3>
                            <h4 class="job-result-card__subtitle">Tech Company</h4>
                            <div class="job-result-card__location">San Francisco, CA</div>
                            <button class="jobs-apply-button--top-card">Easy Apply</button>
                        </div>
                    </div>
                    <script>
                        document.querySelector('.jobs-search-box__submit-button').addEventListener('click', function() {
                            document.querySelector('.jobs-search-results-list').style.display = 'block';
                        });
                    </script>
                </body>
                </html>
            `;

            await page.setContent(mockJobsPage);

            // Test search functionality
            await page.type('#jobs-search-box-keyword-id-ember123', testConfig.search.keywords.join(' '));
            await page.type('#jobs-search-box-location-id-ember456', testConfig.search.location);

            // Click search
            await page.click('.jobs-search-box__submit-button');

            // Wait for results
            await page.waitForSelector('.jobs-search-results-list', { visible: true, timeout: TEST_TIMEOUTS.DEFAULT });

            const resultsVisible = await page.evaluate(() => {
                const results = document.querySelector('.jobs-search-results-list') as HTMLElement;
                return results && results.style.display !== 'none';
            });

            expect(resultsVisible).toBe(true);
        });

        it('should extract job information from search results', async () => {
            const mockJobsWithResults = `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Jobs</title></head>
                <body>
                    <div class="jobs-search-results-list">
                        <div class="job-result-card" data-job-id="123456">
                            <h3 class="job-result-card__title">
                                <a href="/jobs/view/123456">Senior Software Engineer</a>
                            </h3>
                            <h4 class="job-result-card__subtitle">
                                <a href="/company/tech-corp">Tech Corp</a>
                            </h4>
                            <div class="job-result-card__location">San Francisco, CA</div>
                            <button class="jobs-apply-button--top-card">Easy Apply</button>
                        </div>
                        <div class="job-result-card" data-job-id="789012">
                            <h3 class="job-result-card__title">
                                <a href="/jobs/view/789012">Frontend Developer</a>
                            </h3>
                            <h4 class="job-result-card__subtitle">
                                <a href="/company/startup-inc">Startup Inc</a>
                            </h4>
                            <div class="job-result-card__location">Remote</div>
                            <button class="jobs-apply-button--top-card">Easy Apply</button>
                        </div>
                    </div>
                </body>
                </html>
            `;

            await page.setContent(mockJobsWithResults);

            // Extract job information
            const jobs = await page.evaluate(() => {
                const jobCards = Array.from(document.querySelectorAll('.job-result-card'));
                return jobCards.map(card => {
                    const titleElement = card.querySelector('.job-result-card__title a');
                    const companyElement = card.querySelector('.job-result-card__subtitle a');
                    const locationElement = card.querySelector('.job-result-card__location');
                    const easyApplyButton = card.querySelector('.jobs-apply-button--top-card');

                    return {
                        id: card.getAttribute('data-job-id'),
                        title: titleElement?.textContent?.trim(),
                        company: companyElement?.textContent?.trim(),
                        location: locationElement?.textContent?.trim(),
                        url: titleElement?.getAttribute('href'),
                        hasEasyApply: !!easyApplyButton
                    };
                });
            });

            expect(jobs).toHaveLength(2);
            expect(jobs[0]).toMatchObject({
                id: '123456',
                title: 'Senior Software Engineer',
                company: 'Tech Corp',
                location: 'San Francisco, CA',
                hasEasyApply: true
            });
            expect(jobs[1]).toMatchObject({
                id: '789012',
                title: 'Frontend Developer',
                company: 'Startup Inc',
                location: 'Remote',
                hasEasyApply: true
            });
        });

        it('should handle empty search results', async () => {
            const mockEmptyResults = `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Jobs</title></head>
                <body>
                    <div class="jobs-search-no-results">
                        <h2>No jobs found</h2>
                        <p>Try adjusting your search criteria</p>
                    </div>
                </body>
                </html>
            `;

            await page.setContent(mockEmptyResults);

            const noResultsElement = await page.$('.jobs-search-no-results');
            expect(noResultsElement).toBeTruthy();

            const noResultsText = await page.evaluate(el => el?.textContent, noResultsElement);
            expect(noResultsText).toContain('No jobs found');
        });
    });

    describe('Application Process', () => {
        it('should simulate Easy Apply application flow', async () => {
            const mockApplicationModal = `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Application</title></head>
                <body>
                    <div class="jobs-easy-apply-modal">
                        <div class="jobs-easy-apply-content">
                            <h2>Apply to Software Engineer at Tech Corp</h2>
                            <form class="jobs-easy-apply-form">
                                <div class="form-group">
                                    <label>Years of experience</label>
                                    <input type="text" name="experience" />
                                </div>
                                <div class="form-group">
                                    <label>Salary expectation</label>
                                    <input type="text" name="salary" />
                                </div>
                                <div class="form-group">
                                    <label>Why do you want to work here?</label>
                                    <textarea name="motivation"></textarea>
                                </div>
                                <button type="button" class="jobs-apply-button" id="submit-application">
                                    Submit application
                                </button>
                            </form>
                        </div>
                    </div>
                    <div class="application-success" style="display: none;">
                        <h3>Application submitted successfully!</h3>
                    </div>
                    <script>
                        document.getElementById('submit-application').addEventListener('click', function() {
                            document.querySelector('.jobs-easy-apply-modal').style.display = 'none';
                            document.querySelector('.application-success').style.display = 'block';
                        });
                    </script>
                </body>
                </html>
            `;

            await page.setContent(mockApplicationModal);

            // Fill application form
            await page.type('input[name="experience"]', testConfig.application.personalInfo.experience);
            await page.type('input[name="salary"]', `${testConfig.application.personalInfo.salaryExpectation.min}-${testConfig.application.personalInfo.salaryExpectation.max} ${testConfig.application.personalInfo.salaryExpectation.currency}`);
            await page.type('textarea[name="motivation"]', testConfig.application.commonAnswers['Why do you want to work here?'] || '');

            // Submit application
            await page.click('#submit-application');

            // Wait for success message
            await page.waitForSelector('.application-success', { visible: true, timeout: TEST_TIMEOUTS.DEFAULT });

            const successElement = await page.$('.application-success');
            const isVisible = await page.evaluate(el => el && (el as HTMLElement).style.display !== 'none', successElement);
            expect(isVisible).toBe(true);
        });

        it('should handle multi-step application process', async () => {
            const mockMultiStepApplication = `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Multi-Step Application</title></head>
                <body>
                    <div class="jobs-easy-apply-modal">
                        <div class="step-1" id="step-1">
                            <h3>Step 1: Basic Information</h3>
                            <input type="text" name="name" placeholder="Full Name" />
                            <button class="next-button" onclick="nextStep(2)">Next</button>
                        </div>
                        <div class="step-2" id="step-2" style="display: none;">
                            <h3>Step 2: Experience</h3>
                            <textarea name="experience" placeholder="Describe your experience"></textarea>
                            <button class="next-button" onclick="nextStep(3)">Next</button>
                        </div>
                        <div class="step-3" id="step-3" style="display: none;">
                            <h3>Step 3: Review and Submit</h3>
                            <p>Please review your application</p>
                            <button class="submit-button" onclick="submitApplication()">Submit</button>
                        </div>
                        <div class="success" id="success" style="display: none;">
                            <h3>Application submitted!</h3>
                        </div>
                    </div>
                    <script>
                        function nextStep(step) {
                            document.querySelectorAll('[id^="step-"]').forEach(el => el.style.display = 'none');
                            document.getElementById('step-' + step).style.display = 'block';
                        }
                        function submitApplication() {
                            document.querySelectorAll('[id^="step-"]').forEach(el => el.style.display = 'none');
                            document.getElementById('success').style.display = 'block';
                        }
                    </script>
                </body>
                </html>
            `;

            await page.setContent(mockMultiStepApplication);

            // Step 1
            await page.type('input[name="name"]', 'Test User');
            await page.click('.next-button');
            await page.waitForSelector('#step-2', { visible: true });

            // Step 2
            await page.type('textarea[name="experience"]', testConfig.application.personalInfo.experience);

            // Wait for the next button to be visible and click it
            await page.waitForSelector('#step-2 .next-button', { visible: true });
            await page.click('#step-2 .next-button');
            await page.waitForSelector('#step-3', { visible: true });

            // Step 3
            await page.click('.submit-button');
            await page.waitForSelector('#success', { visible: true });

            const successVisible = await page.evaluate(() => {
                const success = document.getElementById('success') as HTMLElement;
                return success && success.style.display !== 'none';
            });

            expect(successVisible).toBe(true);
        });

        it('should handle application errors gracefully', async () => {
            const mockErrorApplication = `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Application Error</title></head>
                <body>
                    <div class="jobs-easy-apply-modal">
                        <form class="jobs-easy-apply-form">
                            <input type="text" name="required-field" required />
                            <button type="button" id="submit-btn">Submit</button>
                        </form>
                        <div class="error-message" style="display: none;">
                            Please fill in all required fields
                        </div>
                    </div>
                    <script>
                        document.getElementById('submit-btn').addEventListener('click', function() {
                            const requiredField = document.querySelector('input[name="required-field"]');
                            if (!requiredField.value) {
                                document.querySelector('.error-message').style.display = 'block';
                            }
                        });
                    </script>
                </body>
                </html>
            `;

            await page.setContent(mockErrorApplication);

            // Try to submit without filling required field
            await page.click('#submit-btn');

            // Wait for error message
            await page.waitForSelector('.error-message', { visible: true, timeout: TEST_TIMEOUTS.DEFAULT });

            const errorVisible = await page.evaluate(() => {
                const error = document.querySelector('.error-message') as HTMLElement;
                return error && error.style.display !== 'none';
            });

            expect(errorVisible).toBe(true);
        });
    });

    describe('Database Persistence and Duplicate Detection', () => {
        it('should store job applications in database', async () => {
            const testJob = createTestJob();

            // Store job in database
            await jobRepository.create(testJob);

            // Verify job was stored
            const storedJob = await jobRepository.findById(testJob.id);
            expect(storedJob).toBeTruthy();
            expect(storedJob?.title).toBe(testJob.title);
            expect(storedJob?.company).toBe(testJob.company);
            expect(storedJob?.status).toBe(JobStatus.FOUND);
        });

        it('should detect duplicate job applications', async () => {
            const testJob = createTestJob({
                id: 'duplicate-job-456',
                title: 'Duplicate Test Job',
                company: 'Duplicate Company',
                location: 'Duplicate Location',
                url: 'https://linkedin.com/jobs/view/duplicate-job-456',
                description: 'Duplicate job description',
                salary: null,
                status: JobStatus.APPLIED,
                appliedAt: new Date()
            });

            // Store job as already applied
            await jobRepository.create(testJob);
            await jobRepository.markAsApplied(testJob.id);

            // Check if job has been applied to
            const hasBeenApplied = await jobRepository.hasBeenAppliedTo(testJob.id);
            expect(hasBeenApplied).toBe(true);

            // Verify job status is APPLIED
            const storedJob = await jobRepository.findById(testJob.id);
            expect(storedJob?.status).toBe(JobStatus.APPLIED);
            expect(storedJob?.appliedAt).toBeTruthy();
        });

        it('should track application statistics', async () => {
            // Create test jobs with different statuses
            const jobs: JobPosting[] = [
                createTestJob({
                    id: 'stats-job-1',
                    title: 'Applied Job 1',
                    company: 'Company 1',
                    location: 'Location 1',
                    url: 'https://linkedin.com/jobs/view/stats-job-1',
                    status: JobStatus.APPLIED,
                    appliedAt: new Date()
                }),
                createTestJob({
                    id: 'stats-job-2',
                    title: 'Applied Job 2',
                    company: 'Company 2',
                    location: 'Location 2',
                    url: 'https://linkedin.com/jobs/view/stats-job-2',
                    status: JobStatus.APPLIED,
                    appliedAt: new Date()
                }),
                createTestJob({
                    id: 'stats-job-3',
                    title: 'Skipped Job',
                    company: 'Company 3',
                    location: 'Location 3',
                    url: 'https://linkedin.com/jobs/view/stats-job-3',
                    status: JobStatus.SKIPPED,
                    isEasyApply: false,
                    errorMessage: 'Not Easy Apply'
                }),
                createTestJob({
                    id: 'stats-job-4',
                    title: 'Error Job',
                    company: 'Company 4',
                    location: 'Location 4',
                    url: 'https://linkedin.com/jobs/view/stats-job-4',
                    status: JobStatus.ERROR,
                    errorMessage: 'Application failed'
                })
            ];

            // Store all test jobs
            for (const job of jobs) {
                await jobRepository.create(job);
            }

            // Get application statistics
            const stats = await jobRepository.getApplicationStats();

            expect(stats.total).toBe(4);
            expect(stats.applied).toBe(2);
            expect(stats.skipped).toBe(1);
            expect(stats.errors).toBe(1);
        });

        it('should handle database connection errors gracefully', async () => {
            // Disconnect database to simulate connection error
            await databaseService.disconnect();

            // Try to perform database operation - may return null or throw error
            try {
                const result = await jobRepository.findById('non-existent-job');
                // If it returns null, that's acceptable behavior
                expect(result).toBeNull();
            } catch (error) {
                // If it throws an error, that's also acceptable for disconnected state
                expect(error).toBeTruthy();
            }

            // Reconnect for cleanup
            await databaseService.connect();
        });

        it('should maintain data integrity during concurrent operations', async () => {
            const testJobs = createTestJobs(10);

            // Perform concurrent database operations
            const createPromises = testJobs.map(job => jobRepository.create(job));
            await Promise.all(createPromises);

            // Verify all jobs were created
            const stats = await jobRepository.getApplicationStats();
            expect(stats.total).toBe(10);

            // Perform concurrent updates
            const updatePromises = testJobs.map(job =>
                jobRepository.markAsApplied(job.id)
            );
            await Promise.all(updatePromises);

            // Verify all jobs were updated
            const updatedStats = await jobRepository.getApplicationStats();
            expect(updatedStats.applied).toBe(10);
        });
    });
});

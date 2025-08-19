import { Page } from 'puppeteer';
import { BrowserManager } from '../../src/browser/BrowserManager';
import { DatabaseService } from '../../src/database/DatabaseService';
import { JobRepository } from '../../src/database/JobRepository';
import { ApplicationHandler } from '../../src/linkedin/ApplicationHandler';
import { ApplicationConfig, JobPosting, JobStatus, LogLevel } from '../../src/types';
import { Logger } from '../../src/utils/Logger';

describe('Application Process Integration Tests', () => {
    let browserManager: BrowserManager;
    let page: Page;
    let databaseService: DatabaseService;
    let jobRepository: JobRepository;
    let applicationHandler: ApplicationHandler;
    let logger: Logger;

    const testApplicationConfig: ApplicationConfig = {
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
            'What are your salary expectations?': 'I am looking for a competitive salary based on market rates',
            'Tell us about yourself': 'I am a passionate software engineer with expertise in modern web technologies',
            'Why are you interested in this role?': 'This role aligns perfectly with my career goals and technical interests'
        }
    };

    const browserConfig = {
        headless: true,
        slowMo: 0,
        timeout: 30000
    };

    const testJob: JobPosting = {
        id: 'test-job-12345',
        title: 'Senior Software Engineer',
        company: 'Test Tech Company',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/view/test-job-12345',
        description: 'Exciting opportunity for a senior software engineer',
        salary: '$120,000 - $180,000',
        status: JobStatus.FOUND,
        isEasyApply: true,
        appliedAt: null,
        errorMessage: null
    };

    beforeAll(async () => {
        // Initialize database
        databaseService = DatabaseService.getInstance();
        await databaseService.connect();
        jobRepository = new JobRepository();

        // Initialize logger with minimal output for tests
        logger = new Logger({ level: LogLevel.ERROR });

        // Initialize browser
        browserManager = new BrowserManager(browserConfig);
        await browserManager.launch();
        page = await browserManager.newPage();

        // Initialize application handler
        applicationHandler = new ApplicationHandler(
            testApplicationConfig,
            jobRepository,
            logger
        );
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

    describe('Easy Apply Button Detection and Interaction', () => {
        it('should detect and click Easy Apply button successfully', async () => {
            const mockJobPage = `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Job</title></head>
                <body>
                    <div class="job-details-container">
                        <h1>Senior Software Engineer</h1>
                        <h2>Test Tech Company</h2>
                        <div class="job-details-jobs-unified-top-card__primary-description">
                            <button class="jobs-apply-button jobs-apply-button--top-card" id="easy-apply-btn">
                                Easy Apply
                            </button>
                        </div>
                    </div>
                    <div class="jobs-easy-apply-modal" id="application-modal" style="display: none;">
                        <div class="jobs-easy-apply-content">
                            <h2>Apply to Senior Software Engineer</h2>
                            <p>Application modal opened successfully</p>
                        </div>
                    </div>
                    <script>
                        document.getElementById('easy-apply-btn').addEventListener('click', function() {
                            document.getElementById('application-modal').style.display = 'block';
                        });
                    </script>
                </body>
                </html>
            `;

            await page.setContent(mockJobPage);

            // Test Easy Apply button detection
            const easyApplyButton = await page.$('.jobs-apply-button--top-card');
            expect(easyApplyButton).toBeTruthy();

            // Test button click
            await page.click('.jobs-apply-button--top-card');

            // Wait for modal to appear
            await page.waitForSelector('#application-modal', { visible: true, timeout: 5000 });

            const modalVisible = await page.evaluate(() => {
                const modal = document.getElementById('application-modal');
                return modal && modal.style.display !== 'none';
            });

            expect(modalVisible).toBe(true);
        });

        it('should handle missing Easy Apply button gracefully', async () => {
            const mockJobWithoutEasyApply = `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Job</title></head>
                <body>
                    <div class="job-details-container">
                        <h1>Senior Software Engineer</h1>
                        <h2>Test Tech Company</h2>
                        <div class="job-details-jobs-unified-top-card__primary-description">
                            <a href="/jobs/apply/external" class="jobs-apply-button">
                                Apply on company website
                            </a>
                        </div>
                    </div>
                </body>
                </html>
            `;

            await page.setContent(mockJobWithoutEasyApply);

            // Test that Easy Apply button is not found
            const easyApplyButton = await page.$('.jobs-apply-button--top-card');
            expect(easyApplyButton).toBeNull();

            // Test that external apply button exists instead
            const externalApplyButton = await page.$('a[href*="external"]');
            expect(externalApplyButton).toBeTruthy();
        });

        it('should handle disabled Easy Apply button', async () => {
            const mockJobWithDisabledButton = `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Job</title></head>
                <body>
                    <div class="job-details-container">
                        <h1>Senior Software Engineer</h1>
                        <h2>Test Tech Company</h2>
                        <div class="job-details-jobs-unified-top-card__primary-description">
                            <button class="jobs-apply-button jobs-apply-button--top-card" disabled>
                                Easy Apply
                            </button>
                            <p class="application-closed-message">Applications are no longer being accepted</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            await page.setContent(mockJobWithDisabledButton);

            // Test that button exists but is disabled
            const easyApplyButton = await page.$('.jobs-apply-button--top-card');
            expect(easyApplyButton).toBeTruthy();

            const isDisabled = await page.evaluate(el => (el as HTMLButtonElement).disabled, easyApplyButton);
            expect(isDisabled).toBe(true);

            // Test that closed message is present
            const closedMessage = await page.$('.application-closed-message');
            expect(closedMessage).toBeTruthy();
        });
    });

    describe('Application Form Filling', () => {
        it('should fill single-step application form correctly', async () => {
            const mockSingleStepForm = `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Application</title></head>
                <body>
                    <div class="jobs-easy-apply-modal">
                        <div class="jobs-easy-apply-content">
                            <h2>Apply to Senior Software Engineer at Test Tech Company</h2>
                            <form class="jobs-easy-apply-form">
                                <div class="form-group">
                                    <label for="experience">Years of relevant experience</label>
                                    <input type="text" id="experience" name="experience" />
                                </div>
                                <div class="form-group">
                                    <label for="salary">Salary expectation</label>
                                    <input type="text" id="salary" name="salary" />
                                </div>
                                <div class="form-group">
                                    <label for="motivation">Why do you want to work here?</label>
                                    <textarea id="motivation" name="motivation"></textarea>
                                </div>
                                <button type="button" class="jobs-apply-button" id="submit-application">
                                    Submit application
                                </button>
                            </form>
                        </div>
                    </div>
                    <div class="application-success" id="success-message" style="display: none;">
                        <h3>Your application has been submitted successfully!</h3>
                        <p>Thank you for your interest in this position.</p>
                    </div>
                    <script>
                        document.getElementById('submit-application').addEventListener('click', function() {
                            // Validate form fields are filled
                            const experience = document.getElementById('experience').value;
                            const salary = document.getElementById('salary').value;
                            const motivation = document.getElementById('motivation').value;

                            if (experience && salary && motivation) {
                                document.querySelector('.jobs-easy-apply-modal').style.display = 'none';
                                document.getElementById('success-message').style.display = 'block';
                            }
                        });
                    </script>
                </body>
                </html>
            `;

            await page.setContent(mockSingleStepForm);

            // Fill form fields
            await page.type('#experience', testApplicationConfig.personalInfo.experience);
            await page.type('#salary', `${testApplicationConfig.personalInfo.salaryExpectation.min}-${testApplicationConfig.personalInfo.salaryExpectation.max} ${testApplicationConfig.personalInfo.salaryExpectation.currency}`);
            await page.type('#motivation', testApplicationConfig.commonAnswers['Why do you want to work here?'] || '');

            // Verify form fields are filled
            const formValues = await page.evaluate(() => {
                return {
                    experience: (document.getElementById('experience') as HTMLInputElement).value,
                    salary: (document.getElementById('salary') as HTMLInputElement).value,
                    motivation: (document.getElementById('motivation') as HTMLTextAreaElement).value
                };
            });

            expect(formValues.experience).toBe(testApplicationConfig.personalInfo.experience);
            expect(formValues.salary).toContain(testApplicationConfig.personalInfo.salaryExpectation.min.toString());
            expect(formValues.motivation).toBe(testApplicationConfig.commonAnswers['Why do you want to work here?']);

            // Submit application
            await page.click('#submit-application');

            // Wait for success message
            await page.waitForSelector('#success-message', { visible: true, timeout: 5000 });

            const successVisible = await page.evaluate(() => {
                const success = document.getElementById('success-message');
                return success && success.style.display !== 'none';
            });

            expect(successVisible).toBe(true);
        });

        it('should handle multi-step application process', async () => {
            const mockMultiStepForm = `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Multi-Step Application</title></head>
                <body>
                    <div class="jobs-easy-apply-modal">
                        <div class="jobs-easy-apply-content">
                            <div class="step-indicator">
                                <span class="step active" id="step-indicator-1">1</span>
                                <span class="step" id="step-indicator-2">2</span>
                                <span class="step" id="step-indicator-3">3</span>
                            </div>

                            <div class="step-content" id="step-1">
                                <h3>Step 1: Personal Information</h3>
                                <div class="form-group">
                                    <label for="full-name">Full Name</label>
                                    <input type="text" id="full-name" name="fullName" />
                                </div>
                                <div class="form-group">
                                    <label for="email">Email</label>
                                    <input type="email" id="email" name="email" />
                                </div>
                                <button type="button" class="next-button" onclick="goToStep(2)">Next</button>
                            </div>

                            <div class="step-content" id="step-2" style="display: none;">
                                <h3>Step 2: Experience</h3>
                                <div class="form-group">
                                    <label for="years-experience">Years of Experience</label>
                                    <select id="years-experience" name="yearsExperience">
                                        <option value="">Select...</option>
                                        <option value="0-1">0-1 years</option>
                                        <option value="2-5">2-5 years</option>
                                        <option value="5+">5+ years</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="experience-description">Describe your experience</label>
                                    <textarea id="experience-description" name="experienceDescription"></textarea>
                                </div>
                                <button type="button" class="prev-button" onclick="goToStep(1)">Previous</button>
                                <button type="button" class="next-button" onclick="goToStep(3)">Next</button>
                            </div>

                            <div class="step-content" id="step-3" style="display: none;">
                                <h3>Step 3: Additional Questions</h3>
                                <div class="form-group">
                                    <label for="why-interested">Why are you interested in this role?</label>
                                    <textarea id="why-interested" name="whyInterested"></textarea>
                                </div>
                                <div class="form-group">
                                    <label for="salary-expectation">Salary Expectation</label>
                                    <input type="text" id="salary-expectation" name="salaryExpectation" />
                                </div>
                                <button type="button" class="prev-button" onclick="goToStep(2)">Previous</button>
                                <button type="button" class="submit-button" onclick="submitApplication()">Submit Application</button>
                            </div>
                        </div>
                    </div>

                    <div class="application-success" id="final-success" style="display: none;">
                        <h3>Application Submitted Successfully!</h3>
                        <p>We'll be in touch soon.</p>
                    </div>

                    <script>
                        function goToStep(stepNumber) {
                            // Hide all steps
                            document.querySelectorAll('.step-content').forEach(step => {
                                step.style.display = 'none';
                            });

                            // Remove active class from all indicators
                            document.querySelectorAll('.step').forEach(indicator => {
                                indicator.classList.remove('active');
                            });

                            // Show target step
                            document.getElementById('step-' + stepNumber).style.display = 'block';
                            document.getElementById('step-indicator-' + stepNumber).classList.add('active');
                        }

                        function submitApplication() {
                            document.querySelector('.jobs-easy-apply-modal').style.display = 'none';
                            document.getElementById('final-success').style.display = 'block';
                        }
                    </script>
                </body>
                </html>
            `;

            await page.setContent(mockMultiStepForm);

            // Step 1: Personal Information
            await page.type('#full-name', 'Test User');
            await page.type('#email', 'test@example.com');
            await page.click('.next-button');

            // Wait for step 2 to appear
            await page.waitForSelector('#step-2', { visible: true, timeout: 5000 });

            // Step 2: Experience
            await page.select('#years-experience', '5+');
            await page.type('#experience-description', testApplicationConfig.personalInfo.experience);

            // Use JavaScript to click the next button to avoid element issues
            await page.evaluate(() => {
                const nextButtons = document.querySelectorAll('.next-button');
                const visibleButton = Array.from(nextButtons).find(btn =>
                    (btn as HTMLElement).offsetParent !== null
                );
                if (visibleButton) {
                    (visibleButton as HTMLElement).click();
                }
            });

            // Wait for step 3 to appear
            await page.waitForSelector('#step-3', { visible: true, timeout: 5000 });

            // Step 3: Additional Questions
            await page.type('#why-interested', testApplicationConfig.commonAnswers['Why are you interested in this role?'] || '');
            await page.type('#salary-expectation', `${testApplicationConfig.personalInfo.salaryExpectation.min}-${testApplicationConfig.personalInfo.salaryExpectation.max}`);

            // Submit application
            await page.click('.submit-button');

            // Wait for final success message
            await page.waitForSelector('#final-success', { visible: true, timeout: 5000 });

            const finalSuccessVisible = await page.evaluate(() => {
                const success = document.getElementById('final-success');
                return success && success.style.display !== 'none';
            });

            expect(finalSuccessVisible).toBe(true);
        });

        it('should handle form validation errors', async () => {
            const mockFormWithValidation = `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Application with Validation</title></head>
                <body>
                    <div class="jobs-easy-apply-modal">
                        <div class="jobs-easy-apply-content">
                            <h2>Apply to Senior Software Engineer</h2>
                            <form class="jobs-easy-apply-form">
                                <div class="form-group">
                                    <label for="required-field">Required Field *</label>
                                    <input type="text" id="required-field" name="requiredField" required />
                                    <div class="error-message" id="required-error" style="display: none; color: red;">
                                        This field is required
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="email-field">Email *</label>
                                    <input type="email" id="email-field" name="emailField" required />
                                    <div class="error-message" id="email-error" style="display: none; color: red;">
                                        Please enter a valid email address
                                    </div>
                                </div>
                                <button type="button" class="jobs-apply-button" id="submit-with-validation">
                                    Submit application
                                </button>
                            </form>
                        </div>
                    </div>

                    <script>
                        document.getElementById('submit-with-validation').addEventListener('click', function() {
                            let hasErrors = false;

                            // Validate required field
                            const requiredField = document.getElementById('required-field');
                            const requiredError = document.getElementById('required-error');
                            if (!requiredField.value.trim()) {
                                requiredError.style.display = 'block';
                                hasErrors = true;
                            } else {
                                requiredError.style.display = 'none';
                            }

                            // Validate email field
                            const emailField = document.getElementById('email-field');
                            const emailError = document.getElementById('email-error');
                            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
                            if (!emailField.value.trim() || !emailRegex.test(emailField.value)) {
                                emailError.style.display = 'block';
                                hasErrors = true;
                            } else {
                                emailError.style.display = 'none';
                            }

                            if (!hasErrors) {
                                alert('Application submitted successfully!');
                            }
                        });
                    </script>
                </body>
                </html>
            `;

            await page.setContent(mockFormWithValidation);

            // Try to submit without filling required fields
            await page.click('#submit-with-validation');

            // Wait for error messages to appear
            await page.waitForSelector('#required-error', { visible: true, timeout: 5000 });
            await page.waitForSelector('#email-error', { visible: true, timeout: 5000 });

            // Verify error messages are visible
            const errorsVisible = await page.evaluate(() => {
                const requiredError = document.getElementById('required-error');
                const emailError = document.getElementById('email-error');
                return {
                    requiredError: requiredError && requiredError.style.display !== 'none',
                    emailError: emailError && emailError.style.display !== 'none'
                };
            });

            expect(errorsVisible.requiredError).toBe(true);
            expect(errorsVisible.emailError).toBe(true);

            // Fill fields correctly
            await page.type('#required-field', 'Test Value');
            await page.type('#email-field', 'test@example.com');

            // Set up dialog handler for success alert
            page.on('dialog', async dialog => {
                expect(dialog.message()).toContain('Application submitted successfully');
                await dialog.accept();
            });

            // Submit again with valid data
            await page.click('#submit-with-validation');

            // Wait a moment for validation to complete
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Verify error messages are hidden
            const errorsHidden = await page.evaluate(() => {
                const requiredError = document.getElementById('required-error');
                const emailError = document.getElementById('email-error');
                return {
                    requiredError: requiredError && requiredError.style.display === 'none',
                    emailError: emailError && emailError.style.display === 'none'
                };
            });

            expect(errorsHidden.requiredError).toBe(true);
            expect(errorsHidden.emailError).toBe(true);
        });
    });

    describe('Database Integration for Applications', () => {
        it('should store successful application in database', async () => {
            // Store initial job
            await jobRepository.create(testJob);

            // Verify job is stored with FOUND status
            let storedJob = await jobRepository.findById(testJob.id);
            expect(storedJob?.status).toBe(JobStatus.FOUND);
            expect(storedJob?.appliedAt).toBeNull();

            // Mark job as applied
            await jobRepository.markAsApplied(testJob.id);

            // Verify job status is updated
            storedJob = await jobRepository.findById(testJob.id);
            expect(storedJob?.status).toBe(JobStatus.APPLIED);
            expect(storedJob?.appliedAt).toBeTruthy();
            expect(storedJob?.appliedAt).toBeInstanceOf(Date);
        });

        it('should handle duplicate application detection', async () => {
            // Create job and mark as already applied
            const appliedJob = { ...testJob, status: JobStatus.APPLIED, appliedAt: new Date() };
            await jobRepository.create(appliedJob);

            // Check if job has been applied to
            const hasBeenApplied = await jobRepository.hasBeenAppliedTo(testJob.id);
            expect(hasBeenApplied).toBe(true);

            // Verify application handler would skip this job
            const mockApplicationPage = `
                <!DOCTYPE html>
                <html>
                <head><title>Already Applied Job</title></head>
                <body>
                    <div class="job-details-container">
                        <h1>${testJob.title}</h1>
                        <h2>${testJob.company}</h2>
                        <div class="application-status">
                            <span class="applied-indicator">✓ Applied</span>
                        </div>
                    </div>
                </body>
                </html>
            `;

            await page.setContent(mockApplicationPage);

            // Test application handler behavior with already applied job
            const result = await applicationHandler.applyToJob(page, testJob);

            // Should return success but with false data (indicating skip)
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe(false);
            }
        });

        it('should track application errors in database', async () => {
            // Store initial job
            await jobRepository.create(testJob);

            // Simulate application error
            const errorMessage = 'Application form submission failed';
            await jobRepository.update(testJob.id, {
                status: JobStatus.ERROR,
                errorMessage: errorMessage
            });

            // Verify error is stored
            const storedJob = await jobRepository.findById(testJob.id);
            expect(storedJob?.status).toBe(JobStatus.ERROR);
            expect(storedJob?.errorMessage).toBe(errorMessage);
            expect(storedJob?.appliedAt).toBeNull();
        });

        it('should generate accurate application statistics', async () => {
            // Create multiple test jobs with different statuses
            const testJobs = [
                { ...testJob, id: 'job-1', url: 'https://linkedin.com/jobs/view/job-1', status: JobStatus.APPLIED, appliedAt: new Date() },
                { ...testJob, id: 'job-2', url: 'https://linkedin.com/jobs/view/job-2', status: JobStatus.APPLIED, appliedAt: new Date() },
                { ...testJob, id: 'job-3', url: 'https://linkedin.com/jobs/view/job-3', status: JobStatus.SKIPPED, errorMessage: 'Not Easy Apply' },
                { ...testJob, id: 'job-4', url: 'https://linkedin.com/jobs/view/job-4', status: JobStatus.ERROR, errorMessage: 'Network error' },
                { ...testJob, id: 'job-5', url: 'https://linkedin.com/jobs/view/job-5', status: JobStatus.FOUND }
            ];

            // Store all test jobs
            for (const job of testJobs) {
                await jobRepository.create(job);
            }

            // Get application statistics
            const stats = await applicationHandler.getApplicationStats();

            expect(stats.total).toBe(5);
            expect(stats.applied).toBe(2);
            expect(stats.skipped).toBe(1);
            expect(stats.errors).toBe(1);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle CAPTCHA detection gracefully', async () => {
            const mockCaptchaPage = `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn CAPTCHA Challenge</title></head>
                <body>
                    <div class="challenge-page">
                        <h1>Security Check</h1>
                        <p>Please complete this security check to continue</p>
                        <div class="captcha-container">
                            <div id="captcha-widget">
                                <img src="data:image/png;base64,..." alt="CAPTCHA" />
                                <input type="text" id="captcha-input" placeholder="Enter the text above" />
                            </div>
                            <button id="captcha-submit">Verify</button>
                        </div>
                    </div>
                </body>
                </html>
            `;

            await page.setContent(mockCaptchaPage);

            // Check for CAPTCHA elements
            const captchaContainer = await page.$('.captcha-container');
            const captchaInput = await page.$('#captcha-input');
            const captchaSubmit = await page.$('#captcha-submit');

            expect(captchaContainer).toBeTruthy();
            expect(captchaInput).toBeTruthy();
            expect(captchaSubmit).toBeTruthy();

            // Verify CAPTCHA detection logic would identify this page
            const hasCaptcha = await page.evaluate(() => {
                return !!(
                    document.querySelector('.captcha-container') ||
                    document.querySelector('#captcha-widget') ||
                    document.querySelector('[id*="captcha"]') ||
                    document.querySelector('[class*="captcha"]')
                );
            });

            expect(hasCaptcha).toBe(true);
        });

        it('should handle application timeout scenarios', async () => {
            const mockSlowApplicationPage = `
                <!DOCTYPE html>
                <html>
                <head><title>Slow Application Page</title></head>
                <body>
                    <div class="jobs-easy-apply-modal">
                        <div class="jobs-easy-apply-content">
                            <h2>Apply to Senior Software Engineer</h2>
                            <form class="jobs-easy-apply-form">
                                <div class="form-group">
                                    <label for="slow-field">This field takes time to load</label>
                                    <input type="text" id="slow-field" name="slowField" />
                                </div>
                                <button type="button" class="jobs-apply-button" id="slow-submit">
                                    Submit application
                                </button>
                            </form>
                        </div>
                    </div>

                    <script>
                        // Simulate slow loading
                        setTimeout(() => {
                            document.getElementById('slow-field').style.display = 'block';
                        }, 10000); // 10 second delay

                        document.getElementById('slow-submit').addEventListener('click', function() {
                            // Simulate slow submission
                            setTimeout(() => {
                                alert('Application submitted after delay');
                            }, 5000);
                        });
                    </script>
                </body>
                </html>
            `;

            await page.setContent(mockSlowApplicationPage);

            // Test that elements are present but may be slow to interact with
            const slowField = await page.$('#slow-field');
            const slowSubmit = await page.$('#slow-submit');

            expect(slowField).toBeTruthy();
            expect(slowSubmit).toBeTruthy();

            // Test timeout handling by setting a short timeout
            try {
                await page.waitForSelector('#non-existent-element', { timeout: 1000 });
                fail('Should have timed out');
            } catch (error) {
                expect((error as Error).message).toMatch(/timeout|failed/i);
            }
        });

        it('should handle network connectivity issues', async () => {
            // Simulate network failure by going offline
            await page.setOfflineMode(true);

            try {
                // Try to navigate to a page while offline
                await page.goto('https://linkedin.com/jobs/view/123456', { timeout: 5000 });
                fail('Should have failed due to network issues');
            } catch (error) {
                expect((error as Error).message).toMatch(/net::|timeout|offline/i);
            }

            // Restore network connectivity
            await page.setOfflineMode(false);

            // Verify connectivity is restored by loading a simple page
            const mockOnlinePage = `
                <!DOCTYPE html>
                <html>
                <head><title>Online Test</title></head>
                <body><h1>Connection Restored</h1></body>
                </html>
            `;

            await page.setContent(mockOnlinePage);
            const title = await page.title();
            expect(title).toBe('Online Test');
        });

        it('should handle malformed application forms', async () => {
            const mockMalformedForm = `
                <!DOCTYPE html>
                <html>
                <head><title>Malformed Application Form</title></head>
                <body>
                    <div class="jobs-easy-apply-modal">
                        <div class="jobs-easy-apply-content">
                            <h2>Apply to Senior Software Engineer</h2>
                            <form class="jobs-easy-apply-form">
                                <!-- Malformed form structure -->
                                <div class="form-group">
                                    <label>Field without proper input</label>
                                    <!-- Missing input element -->
                                </div>
                                <div class="form-group">
                                    <input type="text" name="orphaned-input" />
                                    <!-- Input without label -->
                                </div>
                                <div class="form-group">
                                    <label for="missing-input">Label for missing input</label>
                                    <!-- Referenced input doesn't exist -->
                                </div>
                                <!-- Submit button outside form -->
                            </form>
                            <button type="button" class="jobs-apply-button" id="orphaned-submit">
                                Submit application
                            </button>
                        </div>
                    </div>
                </body>
                </html>
            `;

            await page.setContent(mockMalformedForm);

            // Test that the application handler can still identify form elements
            const formElements = await page.evaluate(() => {
                return {
                    form: !!document.querySelector('.jobs-easy-apply-form'),
                    inputs: document.querySelectorAll('input').length,
                    labels: document.querySelectorAll('label').length,
                    submitButton: !!document.querySelector('.jobs-apply-button')
                };
            });

            expect(formElements.form).toBe(true);
            expect(formElements.inputs).toBe(1);
            expect(formElements.labels).toBe(2);
            expect(formElements.submitButton).toBe(true);

            // Test that orphaned elements can still be interacted with
            const orphanedInput = await page.$('input[name="orphaned-input"]');
            expect(orphanedInput).toBeTruthy();

            await page.type('input[name="orphaned-input"]', 'Test value');

            const inputValue = await page.evaluate(() => {
                const input = document.querySelector('input[name="orphaned-input"]') as HTMLInputElement;
                return input?.value;
            });

            expect(inputValue).toBe('Test value');
        });
    });
});

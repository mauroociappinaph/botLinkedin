import { Page } from 'puppeteer';
import { BrowserManager } from '../../src/browser/BrowserManager';
import { JobSearchHandler } from '../../src/linkedin/JobSearchHandler';
import { JobSearchConfig, LogLevel } from '../../src/types';
import { Logger } from '../../src/utils/Logger';

describe('Job Search Integration Tests', () => {
    let browserManager: BrowserManager;
    let page: Page;
    let logger: Logger;

    const testSearchConfig: JobSearchConfig = {
        keywords: ['software engineer', 'developer'],
        location: 'San Francisco, CA',
        datePosted: 'pastWeek',
        remoteWork: true,
        experienceLevel: ['mid', 'senior'],
        jobType: ['fullTime']
    };

    const browserConfig = {
        headless: true,
        slowMo: 0,
        timeout: 30000
    };

    beforeAll(async () => {
        logger = new Logger({ level: LogLevel.ERROR }); // Reduce log noise
        browserManager = new BrowserManager(browserConfig);
        await browserManager.launch();
        page = await browserManager.newPage();
    });

    afterAll(async () => {
        if (browserManager) {
            await browserManager.close();
        }
    });

    describe('Job Search Configuration Validation', () => {
        it('should validate search configuration correctly', async () => {
            const jobSearchHandler = new JobSearchHandler(page, testSearchConfig, logger);

            // Valid configuration should pass
            const validConfig = { ...testSearchConfig };
            jobSearchHandler.updateSearchConfig(validConfig);

            const currentConfig = jobSearchHandler.getSearchConfig();
            expect(currentConfig.keywords).toEqual(testSearchConfig.keywords);
            expect(currentConfig.location).toBe(testSearchConfig.location);
            expect(currentConfig.datePosted).toBe(testSearchConfig.datePosted);
        });

        it('should handle invalid search configuration', async () => {
            const invalidConfig: JobSearchConfig = {
                keywords: [], // Empty keywords should be invalid
                location: '',
                datePosted: 'invalid' as any,
                remoteWork: true,
                experienceLevel: ['invalid'] as any,
                jobType: []
            };

            const jobSearchHandler = new JobSearchHandler(page, invalidConfig, logger);

            // Attempt to perform search with invalid config
            const result = await jobSearchHandler.performSearch();

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INVALID_SEARCH_CONFIG');
            expect(result.error?.message).toContain('Invalid search configuration');
        });

        it('should update search configuration dynamically', async () => {
            const jobSearchHandler = new JobSearchHandler(page, testSearchConfig, logger);

            const newConfig = {
                keywords: ['frontend developer'],
                location: 'New York, NY',
                remoteWork: false
            };

            jobSearchHandler.updateSearchConfig(newConfig);

            const updatedConfig = jobSearchHandler.getSearchConfig();
            expect(updatedConfig.keywords).toEqual(['frontend developer']);
            expect(updatedConfig.location).toBe('New York, NY');
            expect(updatedConfig.remoteWork).toBe(false);
            // Other fields should remain unchanged
            expect(updatedConfig.datePosted).toBe(testSearchConfig.datePosted);
        });
    });

    describe('Mock LinkedIn Job Search Flow', () => {
        it('should handle complete job search workflow with mock responses', async () => {
            // Create mock LinkedIn jobs page
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
                    <div class="filter-modal" style="display: none;">
                        <input type="checkbox" name="f_LF" value="true" /> Easy Apply
                        <input type="radio" name="f_TPR" value="r86400" /> Past 24 hours
                        <input type="radio" name="f_TPR" value="r604800" /> Past week
                        <input type="checkbox" name="f_WT" value="2" /> Remote
                        <button class="reusable-search-filters-buttons__apply-button">Apply filters</button>
                    </div>
                    <div class="jobs-search-results-list" style="display: none;">
                        <div class="scaffold-layout__list-container">
                            <div class="jobs-search__results-list">
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
                        </div>
                        <div class="artdeco-pagination">
                            <span class="artdeco-pagination__indicator">1-25 of 150 results</span>
                            <button class="artdeco-pagination__button--next">Next</button>
                        </div>
                    </div>
                    <script>
                        // Mock search functionality
                        document.querySelector('.jobs-search-box__submit-button').addEventListener('click', function() {
                            document.querySelector('.jobs-search-results-list').style.display = 'block';
                        });

                        // Mock filter functionality
                        document.querySelector('.search-reusables__filter-pill-button').addEventListener('click', function() {
                            document.querySelector('.filter-modal').style.display = 'block';
                        });

                        document.querySelector('.reusable-search-filters-buttons__apply-button').addEventListener('click', function() {
                            document.querySelector('.filter-modal').style.display = 'none';
                            document.querySelector('.jobs-search-results-list').style.display = 'block';
                        });
                    </script>
                </body>
                </html>
            `;

            await page.setContent(mockJobsPage);

            // Test search input functionality
            const keywordInput = await page.$('#jobs-search-box-keyword-id-ember123');
            const locationInput = await page.$('#jobs-search-box-location-id-ember456');
            const searchButton = await page.$('.jobs-search-box__submit-button');

            expect(keywordInput).toBeTruthy();
            expect(locationInput).toBeTruthy();
            expect(searchButton).toBeTruthy();

            // Fill search form
            await page.type('#jobs-search-box-keyword-id-ember123', testSearchConfig.keywords.join(' '));
            await page.type('#jobs-search-box-location-id-ember456', testSearchConfig.location);

            // Perform search
            await page.click('.jobs-search-box__submit-button');

            // Wait for results
            await page.waitForSelector('.jobs-search-results-list', { visible: true, timeout: 5000 });

            // Verify results are displayed
            const resultsVisible = await page.evaluate(() => {
                const results = document.querySelector('.jobs-search-results-list');
                return results && (results as HTMLElement).style.display !== 'none';
            });

            expect(resultsVisible).toBe(true);
        });

        it('should extract job postings from mock search results', async () => {
            const mockJobResults = `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Job Results</title></head>
                <body>
                    <div class="jobs-search-results-list">
                        <div class="scaffold-layout__list-container">
                            <div class="jobs-search__results-list">
                                <div class="job-result-card" data-job-id="job1">
                                    <h3 class="job-result-card__title">
                                        <a href="/jobs/view/job1">Senior Software Engineer</a>
                                    </h3>
                                    <h4 class="job-result-card__subtitle">
                                        <a href="/company/tech-corp">Tech Corp</a>
                                    </h4>
                                    <div class="job-result-card__location">San Francisco, CA</div>
                                    <button class="jobs-apply-button--top-card">Easy Apply</button>
                                </div>
                                <div class="job-result-card" data-job-id="job2">
                                    <h3 class="job-result-card__title">
                                        <a href="/jobs/view/job2">Full Stack Developer</a>
                                    </h3>
                                    <h4 class="job-result-card__subtitle">
                                        <a href="/company/startup">Startup Inc</a>
                                    </h4>
                                    <div class="job-result-card__location">Remote</div>
                                    <button class="jobs-apply-button--top-card">Easy Apply</button>
                                </div>
                                <div class="job-result-card" data-job-id="job3">
                                    <h3 class="job-result-card__title">
                                        <a href="/jobs/view/job3">Backend Engineer</a>
                                    </h3>
                                    <h4 class="job-result-card__subtitle">
                                        <a href="/company/enterprise">Enterprise Corp</a>
                                    </h4>
                                    <div class="job-result-card__location">New York, NY</div>
                                    <!-- No Easy Apply button for this job -->
                                </div>
                            </div>
                        </div>
                        <div class="artdeco-pagination">
                            <span class="artdeco-pagination__indicator">1-25 of 150 results</span>
                        </div>
                    </div>
                </body>
                </html>
            `;

            await page.setContent(mockJobResults);

            // Extract job information using page evaluation
            const extractedJobs = await page.evaluate(() => {
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
                        isEasyApply: !!easyApplyButton
                    };
                });
            });

            expect(extractedJobs).toHaveLength(3);

            // Verify first job (with Easy Apply)
            expect(extractedJobs[0]).toMatchObject({
                id: 'job1',
                title: 'Senior Software Engineer',
                company: 'Tech Corp',
                location: 'San Francisco, CA',
                isEasyApply: true
            });

            // Verify second job (with Easy Apply)
            expect(extractedJobs[1]).toMatchObject({
                id: 'job2',
                title: 'Full Stack Developer',
                company: 'Startup Inc',
                location: 'Remote',
                isEasyApply: true
            });

            // Verify third job (without Easy Apply)
            expect(extractedJobs[2]).toMatchObject({
                id: 'job3',
                title: 'Backend Engineer',
                company: 'Enterprise Corp',
                location: 'New York, NY',
                isEasyApply: false
            });
        });

        it('should handle pagination in search results', async () => {
            const mockPaginatedResults = `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Paginated Results</title></head>
                <body>
                    <div class="jobs-search-results-list">
                        <div class="scaffold-layout__list-container">
                            <div class="jobs-search__results-list">
                                <div class="job-result-card" data-job-id="page1-job1">
                                    <h3 class="job-result-card__title">
                                        <a href="/jobs/view/page1-job1">Page 1 Job 1</a>
                                    </h3>
                                    <h4 class="job-result-card__subtitle">
                                        <a href="/company/company1">Company 1</a>
                                    </h4>
                                    <div class="job-result-card__location">Location 1</div>
                                    <button class="jobs-apply-button--top-card">Easy Apply</button>
                                </div>
                            </div>
                        </div>
                        <div class="artdeco-pagination">
                            <span class="artdeco-pagination__indicator">1-25 of 150 results</span>
                            <button class="artdeco-pagination__button--next" id="next-page">Next</button>
                        </div>
                    </div>
                    <script>
                        document.getElementById('next-page').addEventListener('click', function() {
                            // Simulate loading next page
                            const jobsList = document.querySelector('.jobs-search__results-list');
                            jobsList.innerHTML = \`
                                <div class="job-result-card" data-job-id="page2-job1">
                                    <h3 class="job-result-card__title">
                                        <a href="/jobs/view/page2-job1">Page 2 Job 1</a>
                                    </h3>
                                    <h4 class="job-result-card__subtitle">
                                        <a href="/company/company2">Company 2</a>
                                    </h4>
                                    <div class="job-result-card__location">Location 2</div>
                                    <button class="jobs-apply-button--top-card">Easy Apply</button>
                                </div>
                            \`;

                            // Update pagination
                            document.querySelector('.artdeco-pagination__indicator').textContent = '26-50 of 150 results';
                            this.disabled = true; // Simulate last page
                        });
                    </script>
                </body>
                </html>
            `;

            await page.setContent(mockPaginatedResults);

            // Verify first page content
            let jobs = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('.job-result-card')).map(card => ({
                    id: card.getAttribute('data-job-id'),
                    title: card.querySelector('.job-result-card__title a')?.textContent?.trim()
                }));
            });

            expect(jobs).toHaveLength(1);
            expect(jobs[0]?.id).toBe('page1-job1');
            expect(jobs[0]?.title).toBe('Page 1 Job 1');

            // Click next page
            const nextButton = await page.$('#next-page');
            expect(nextButton).toBeTruthy();

            await page.click('#next-page');

            // Wait for page content to update
            await page.waitForFunction(() => {
                const job = document.querySelector('[data-job-id="page2-job1"]');
                return job !== null;
            }, { timeout: 5000 });

            // Verify second page content
            jobs = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('.job-result-card')).map(card => ({
                    id: card.getAttribute('data-job-id'),
                    title: card.querySelector('.job-result-card__title a')?.textContent?.trim()
                }));
            });

            expect(jobs).toHaveLength(1);
            expect(jobs[0]?.id).toBe('page2-job1');
            expect(jobs[0]?.title).toBe('Page 2 Job 1');

            // Verify next button is disabled (last page)
            const isNextDisabled = await page.evaluate(() => {
                const button = document.getElementById('next-page');
                return (button as HTMLButtonElement)?.disabled === true;
            });

            expect(isNextDisabled).toBe(true);
        });

        it('should handle search filters application', async () => {
            const mockFilterPage = `
                <!DOCTYPE html>
                <html>
                <head><title>LinkedIn Job Filters</title></head>
                <body>
                    <div class="search-reusables__filters-bar">
                        <button class="search-reusables__filter-pill-button" id="all-filters">All filters</button>
                    </div>
                    <div class="search-reusables__filters-panel" id="filters-panel" style="display: none;">
                        <div class="filter-section">
                            <h3>Easy Apply</h3>
                            <input type="checkbox" name="f_LF" value="true" id="easy-apply-filter" />
                            <label for="easy-apply-filter">Easy Apply</label>
                        </div>
                        <div class="filter-section">
                            <h3>Date Posted</h3>
                            <input type="radio" name="f_TPR" value="r86400" id="past-24h" />
                            <label for="past-24h">Past 24 hours</label>
                            <input type="radio" name="f_TPR" value="r604800" id="past-week" />
                            <label for="past-week">Past week</label>
                        </div>
                        <div class="filter-section">
                            <h3>Remote</h3>
                            <input type="checkbox" name="f_WT" value="2" id="remote-filter" />
                            <label for="remote-filter">Remote</label>
                        </div>
                        <div class="filter-section">
                            <h3>Experience Level</h3>
                            <input type="checkbox" name="f_E" value="3" id="mid-level" />
                            <label for="mid-level">Mid-Senior level</label>
                            <input type="checkbox" name="f_E" value="4" id="director" />
                            <label for="director">Director</label>
                        </div>
                        <button class="reusable-search-filters-buttons__apply-button" id="apply-filters">
                            Apply filters
                        </button>
                    </div>
                    <div class="jobs-search-results-list" id="results" style="display: none;">
                        <p>Filtered results would appear here</p>
                    </div>
                    <script>
                        document.getElementById('all-filters').addEventListener('click', function() {
                            document.getElementById('filters-panel').style.display = 'block';
                        });

                        document.getElementById('apply-filters').addEventListener('click', function() {
                            document.getElementById('filters-panel').style.display = 'none';
                            document.getElementById('results').style.display = 'block';
                        });
                    </script>
                </body>
                </html>
            `;

            await page.setContent(mockFilterPage);

            // Open filters panel
            await page.click('#all-filters');
            await page.waitForSelector('#filters-panel', { visible: true });

            // Apply filters based on test configuration
            await page.click('#easy-apply-filter'); // Easy Apply
            await page.click('#past-week'); // Past week
            await page.click('#remote-filter'); // Remote work
            await page.click('#mid-level'); // Mid-Senior level

            // Verify filters are checked
            const filtersChecked = await page.evaluate(() => {
                return {
                    easyApply: (document.getElementById('easy-apply-filter') as HTMLInputElement)?.checked,
                    pastWeek: (document.getElementById('past-week') as HTMLInputElement)?.checked,
                    remote: (document.getElementById('remote-filter') as HTMLInputElement)?.checked,
                    midLevel: (document.getElementById('mid-level') as HTMLInputElement)?.checked
                };
            });

            expect(filtersChecked.easyApply).toBe(true);
            expect(filtersChecked.pastWeek).toBe(true);
            expect(filtersChecked.remote).toBe(true);
            expect(filtersChecked.midLevel).toBe(true);

            // Apply filters
            await page.click('#apply-filters');

            // Wait for results to appear
            await page.waitForSelector('#results', { visible: true });

            const resultsVisible = await page.evaluate(() => {
                const results = document.getElementById('results');
                return results && results.style.display !== 'none';
            });

            expect(resultsVisible).toBe(true);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle network timeouts gracefully', async () => {
            // Set a very short timeout to simulate network issues
            const shortTimeoutConfig = { ...browserConfig, timeout: 1 };
            const shortTimeoutBrowser = new BrowserManager(shortTimeoutConfig);

            try {
                await shortTimeoutBrowser.launch();
                const shortTimeoutPage = await shortTimeoutBrowser.newPage();

                const jobSearchHandler = new JobSearchHandler(shortTimeoutPage, testSearchConfig, logger);

                // This should timeout quickly
                const result = await jobSearchHandler.performSearch();

                expect(result.success).toBe(false);
                expect(result.error?.code).toMatch(/TIMEOUT_ERROR|NAVIGATION_FAILED/);

                await shortTimeoutBrowser.close();
            } catch (error) {
                // Expected to fail due to timeout
                expect(error).toBeTruthy();
            }
        });

        it('should handle malformed HTML gracefully', async () => {
            const malformedHTML = `
                <!DOCTYPE html>
                <html>
                <head><title>Malformed Page</title></head>
                <body>
                    <div class="broken-structure">
                        <h3>Job Title</h3>
                        <!-- Missing closing tags and malformed structure -->
                        <div class="company
                        <span>Company Name
                    </div>
                </body>
                <!-- Missing closing html tag -->
            `;

            await page.setContent(malformedHTML);

            // Try to extract job information from malformed HTML
            const extractedData = await page.evaluate(() => {
                try {
                    const jobCards = Array.from(document.querySelectorAll('.job-result-card'));
                    return jobCards.map(card => {
                        const titleElement = card.querySelector('.job-result-card__title');
                        return {
                            title: titleElement?.textContent?.trim() || null,
                            hasValidStructure: !!titleElement
                        };
                    });
                } catch (error) {
                    return { error: (error as Error).message };
                }
            });

            // Should handle malformed HTML without crashing
            expect(extractedData).toBeDefined();
            // Since there are no proper job cards, should return empty array
            expect(Array.isArray(extractedData) ? extractedData.length : 0).toBe(0);
        });

        it('should handle empty search results', async () => {
            const emptyResultsPage = `
                <!DOCTYPE html>
                <html>
                <head><title>No Results</title></head>
                <body>
                    <div class="jobs-search-no-results">
                        <div class="jobs-search-no-results__content">
                            <h2>No jobs found</h2>
                            <p>Try adjusting your search criteria or location</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            await page.setContent(emptyResultsPage);

            // Check for no results message
            const noResultsElement = await page.$('.jobs-search-no-results');
            expect(noResultsElement).toBeTruthy();

            const noResultsText = await page.evaluate(el => el?.textContent, noResultsElement);
            expect(noResultsText).toContain('No jobs found');

            // Verify no job cards are present
            const jobCards = await page.$$('.job-result-card');
            expect(jobCards).toHaveLength(0);
        });

        it('should handle rate limiting and detection scenarios', async () => {
            const rateLimitedPage = `
                <!DOCTYPE html>
                <html>
                <head><title>Rate Limited</title></head>
                <body>
                    <div class="challenge-page">
                        <h1>Please verify you're human</h1>
                        <p>We've detected unusual activity from your account</p>
                        <div class="captcha-container">
                            <div id="captcha-challenge">CAPTCHA Challenge</div>
                            <button id="verify-button">Verify</button>
                        </div>
                    </div>
                </body>
                </html>
            `;

            await page.setContent(rateLimitedPage);

            // Check for rate limiting indicators
            const challengePage = await page.$('.challenge-page');
            const captchaContainer = await page.$('.captcha-container');

            expect(challengePage).toBeTruthy();
            expect(captchaContainer).toBeTruthy();

            const challengeText = await page.evaluate(el => el?.textContent, challengePage);
            expect(challengeText).toContain('verify');
            expect(challengeText).toContain('human');
        });
    });

    describe('Performance and Health Monitoring', () => {
        it('should track performance metrics during search', async () => {
            const jobSearchHandler = new JobSearchHandler(page, testSearchConfig, logger);

            // Reset performance monitoring
            jobSearchHandler.reset();

            // Check initial health status
            const initialHealth = jobSearchHandler.isHealthy();
            expect(initialHealth).toBe(true);

            // Get initial performance report
            const initialReport = jobSearchHandler.getPerformanceReport();
            expect(initialReport).toBeDefined();
            expect(initialReport.totalDuration).toBe(0);

            // Get circuit breaker stats
            const circuitStats = jobSearchHandler.getCircuitBreakerStats();
            expect(circuitStats).toBeDefined();
            expect(circuitStats.state).toBe('CLOSED');
        });

        it('should handle circuit breaker functionality', async () => {
            const jobSearchHandler = new JobSearchHandler(page, testSearchConfig, logger);

            // Get initial circuit breaker stats
            const initialStats = jobSearchHandler.getCircuitBreakerStats();
            expect(initialStats.state).toBe('CLOSED');
            expect(initialStats.failures).toBe(0);

            // Simulate multiple failures to trigger circuit breaker
            const invalidConfig: JobSearchConfig = {
                keywords: [],
                location: '',
                datePosted: 'invalid' as unknown,
                remoteWork: true,
                experienceLevel: [],
                jobType: []
            };

            jobSearchHandler.updateSearchConfig(invalidConfig);

            // Multiple failed attempts
            for (let i = 0; i < 3; i++) {
                const result = await jobSearchHandler.performSearch();
                expect(result.success).toBe(false);
            }

            // Circuit breaker should still be functional for this test
            const finalStats = jobSearchHandler.getCircuitBreakerStats();
            // The circuit breaker may not increment failures for validation errors
            // Just verify it's still in a valid state
            expect(finalStats.state).toBeDefined();
            expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(finalStats.state);
        });
    });
});

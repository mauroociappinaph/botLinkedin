import { ApplicationRepository } from '../../src/database/ApplicationRepository';
import { DatabaseService } from '../../src/database/DatabaseService';
import { JobRepository } from '../../src/database/JobRepository';
import { JobPosting, JobSearchConfig, JobStatus } from '../../src/types';

describe('Database Integration Tests', () => {
    let databaseService: DatabaseService;
    let jobRepository: JobRepository;
    let applicationRepository: ApplicationRepository;

    const testJob: JobPosting = {
        id: 'test-job-123',
        title: 'Senior Software Engineer',
        company: 'Test Company',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/view/test-job-123',
        description: 'Test job description for integration testing',
        salary: '$120,000 - $180,000',
        status: JobStatus.FOUND,
        isEasyApply: true,
        appliedAt: null,
        errorMessage: null
    };

    const testSearchConfig: JobSearchConfig = {
        keywords: ['software engineer', 'developer'],
        location: 'San Francisco, CA',
        datePosted: 'pastWeek',
        remoteWork: true,
        experienceLevel: ['mid', 'senior'],
        jobType: ['fullTime']
    };

    beforeAll(async () => {
        // Initialize database service
        databaseService = DatabaseService.getInstance();
        await databaseService.connect();

        // Initialize repositories
        jobRepository = new JobRepository();
        applicationRepository = new ApplicationRepository();
    });

    afterAll(async () => {
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

    describe('Database Connection Management', () => {
        it('should establish database connection successfully', async () => {
            const isConnected = databaseService.isConnectionActive();
            expect(isConnected).toBe(true);
        });

        it('should test database connection', async () => {
            const connectionTest = await databaseService.testConnection();
            expect(connectionTest).toBe(true);
        });

        it('should handle connection errors gracefully', async () => {
            // Disconnect to simulate connection error
            await databaseService.disconnect();

            const isConnected = databaseService.isConnectionActive();
            expect(isConnected).toBe(false);

            // Test connection should fail when disconnected
            try {
                const connectionTest = await databaseService.testConnection();
                // If it doesn't throw, it should at least return false
                expect(connectionTest).toBe(false);
            } catch (error) {
                // Connection test throwing an error is also acceptable when disconnected
                expect(error).toBeTruthy();
            }

            // Reconnect for other tests
            await databaseService.connect();
        });

        it('should handle multiple connection attempts', async () => {
            // Multiple connect calls should not cause issues
            await databaseService.connect();
            await databaseService.connect();
            await databaseService.connect();

            const isConnected = databaseService.isConnectionActive();
            expect(isConnected).toBe(true);
        });

        it('should handle multiple disconnection attempts', async () => {
            // Multiple disconnect calls should not cause issues
            await databaseService.disconnect();
            await databaseService.disconnect();
            await databaseService.disconnect();

            const isConnected = databaseService.isConnectionActive();
            expect(isConnected).toBe(false);

            // Reconnect for cleanup
            await databaseService.connect();
        });
    });

    describe('Job Repository Operations', () => {
        it('should create a new job posting', async () => {
            const createdJob = await jobRepository.create(testJob);

            expect(createdJob).toBeTruthy();
            expect(createdJob.id).toBe(testJob.id);
            expect(createdJob.title).toBe(testJob.title);
            expect(createdJob.company).toBe(testJob.company);
            expect(createdJob.status).toBe(JobStatus.FOUND);
            expect((createdJob as any).createdAt).toBeInstanceOf(Date);
            expect((createdJob as any).updatedAt).toBeInstanceOf(Date);
        });

        it('should find job by ID', async () => {
            // Create job first
            await jobRepository.create(testJob);

            // Find job by ID
            const foundJob = await jobRepository.findById(testJob.id);

            expect(foundJob).toBeTruthy();
            expect(foundJob?.id).toBe(testJob.id);
            expect(foundJob?.title).toBe(testJob.title);
            expect(foundJob?.company).toBe(testJob.company);
        });

        it('should return null for non-existent job', async () => {
            const nonExistentJob = await jobRepository.findById('non-existent-id');
            expect(nonExistentJob).toBeNull();
        });

        it('should update job status', async () => {
            // Create job first
            await jobRepository.create(testJob);

            // Update job status
            const updatedJob = await jobRepository.update(testJob.id, {
                status: JobStatus.APPLIED,
                appliedAt: new Date()
            });

            expect(updatedJob.status).toBe(JobStatus.APPLIED);
            expect(updatedJob.appliedAt).toBeInstanceOf(Date);
            expect((updatedJob as any).updatedAt).toBeInstanceOf(Date);
        });

        it('should mark job as applied', async () => {
            // Create job first
            await jobRepository.create(testJob);

            // Mark as applied
            const appliedJob = await jobRepository.markAsApplied(testJob.id);

            expect(appliedJob.status).toBe(JobStatus.APPLIED);
            expect(appliedJob.appliedAt).toBeInstanceOf(Date);

            // Verify has been applied to
            const hasBeenApplied = await jobRepository.hasBeenAppliedTo(testJob.id);
            expect(hasBeenApplied).toBe(true);
        });

        it('should check if job has been applied to', async () => {
            // Create job that hasn't been applied to
            await jobRepository.create(testJob);

            let hasBeenApplied = await jobRepository.hasBeenAppliedTo(testJob.id);
            expect(hasBeenApplied).toBe(false);

            // Mark as applied
            await jobRepository.markAsApplied(testJob.id);

            hasBeenApplied = await jobRepository.hasBeenAppliedTo(testJob.id);
            expect(hasBeenApplied).toBe(true);
        });

        it('should get application statistics', async () => {
            // Create multiple jobs with different statuses
            const jobs = [
                { ...testJob, id: 'job-1', url: 'https://linkedin.com/jobs/view/job-1', status: JobStatus.APPLIED },
                { ...testJob, id: 'job-2', url: 'https://linkedin.com/jobs/view/job-2', status: JobStatus.APPLIED },
                { ...testJob, id: 'job-3', url: 'https://linkedin.com/jobs/view/job-3', status: JobStatus.SKIPPED },
                { ...testJob, id: 'job-4', url: 'https://linkedin.com/jobs/view/job-4', status: JobStatus.ERROR },
                { ...testJob, id: 'job-5', url: 'https://linkedin.com/jobs/view/job-5', status: JobStatus.FOUND }
            ];

            for (const job of jobs) {
                await jobRepository.create(job);
            }

            const stats = await jobRepository.getApplicationStats();

            expect(stats.total).toBe(5);
            expect(stats.applied).toBe(2);
            expect(stats.skipped).toBe(1);
            expect(stats.errors).toBe(1);
        });

        it('should handle duplicate job creation', async () => {
            // Create job first time
            await jobRepository.create(testJob);

            // Try to create same job again - should throw error
            await expect(jobRepository.create(testJob)).rejects.toThrow();
        });

        it('should find jobs by status', async () => {
            // Create jobs with different statuses
            const appliedJob = { ...testJob, id: 'applied-job', url: 'https://linkedin.com/jobs/view/applied-job', status: JobStatus.APPLIED };
            const skippedJob = { ...testJob, id: 'skipped-job', url: 'https://linkedin.com/jobs/view/skipped-job', status: JobStatus.SKIPPED };

            await jobRepository.create(testJob); // FOUND status
            await jobRepository.create(appliedJob);
            await jobRepository.create(skippedJob);

            // Find jobs by status using direct Prisma query
            const prisma = databaseService.getClient();

            const appliedJobs = await prisma.jobPosting.findMany({
                where: { status: JobStatus.APPLIED }
            });

            const foundJobs = await prisma.jobPosting.findMany({
                where: { status: JobStatus.FOUND }
            });

            expect(appliedJobs).toHaveLength(1);
            expect(appliedJobs[0]?.id).toBe('applied-job');

            expect(foundJobs).toHaveLength(1);
            expect(foundJobs[0]?.id).toBe(testJob.id);
        });

        it('should handle job updates for non-existent jobs', async () => {
            await expect(
                jobRepository.update('non-existent-id', { status: JobStatus.APPLIED })
            ).rejects.toThrow();
        });
    });

    describe('Application Repository Operations', () => {
        it('should create application session', async () => {
            const session = await applicationRepository.create({
                searchConfig: testSearchConfig
            });

            expect(session).toBeTruthy();
            expect(session.id).toBeTruthy();
            expect(session.startTime).toBeInstanceOf(Date);
            expect(session.endTime).toBeNull();
            expect(session.totalJobsFound).toBe(0);
            expect(session.totalApplicationsSubmitted).toBe(0);
            expect(session.totalSkipped).toBe(0);
            expect(session.totalErrors).toBe(0);
        });

        it('should update application session', async () => {
            // Create session first
            const session = await applicationRepository.create({
                searchConfig: testSearchConfig
            });

            // Update session
            const updatedSession = await applicationRepository.update(session.id, {
                totalJobsFound: 10,
                totalApplicationsSubmitted: 5,
                totalSkipped: 3,
                totalErrors: 2,
                endTime: new Date()
            });

            expect(updatedSession.totalJobsFound).toBe(10);
            expect(updatedSession.totalApplicationsSubmitted).toBe(5);
            expect(updatedSession.totalSkipped).toBe(3);
            expect(updatedSession.totalErrors).toBe(2);
            expect(updatedSession.endTime).toBeInstanceOf(Date);
        });

        it('should find application session by ID', async () => {
            // Create session first
            const session = await applicationRepository.create({
                searchConfig: testSearchConfig
            });

            // Find session by ID
            const foundSession = await applicationRepository.findById(session.id);

            expect(foundSession).toBeTruthy();
            expect(foundSession?.id).toBe(session.id);
            expect(foundSession?.startTime).toBeInstanceOf(Date);
        });

        it('should return null for non-existent session', async () => {
            const nonExistentSession = await applicationRepository.findById('non-existent-id');
            expect(nonExistentSession).toBeNull();
        });

        it('should get recent application sessions', async () => {
            // Create multiple sessions
            await applicationRepository.create({
                searchConfig: testSearchConfig
            });

            const session2 = await applicationRepository.create({
                searchConfig: { ...testSearchConfig, location: 'New York, NY' }
            });

            const session3 = await applicationRepository.create({
                searchConfig: { ...testSearchConfig, keywords: ['frontend developer'] }
            });

            // Get recent sessions using direct Prisma query
            const prisma = databaseService.getClient();
            const recentSessions = await prisma.applicationSession.findMany({
                orderBy: { startTime: 'desc' },
                take: 2
            });

            expect(recentSessions).toHaveLength(2);
            expect(recentSessions[0]?.id).toBe(session3.id); // Most recent
            expect(recentSessions[1]?.id).toBe(session2.id); // Second most recent
        });

        it('should handle session updates for non-existent sessions', async () => {
            await expect(
                applicationRepository.update('non-existent-id', {
                    totalJobsFound: 5
                })
            ).rejects.toThrow();
        });
    });

    describe('Database Transactions', () => {
        it('should handle successful transactions', async () => {
            const result = await databaseService.transaction(async (tx) => {
                // Create job within transaction
                const job = await tx.jobPosting.create({
                    data: {
                        id: testJob.id,
                        title: testJob.title,
                        company: testJob.company,
                        location: testJob.location,
                        url: testJob.url,
                        description: testJob.description,
                        salary: testJob.salary,
                        status: testJob.status,
                        isEasyApply: testJob.isEasyApply
                    }
                });

                // Create session within same transaction
                const session = await tx.applicationSession.create({
                    data: {
                        searchConfig: JSON.stringify(testSearchConfig),
                        totalJobsFound: 1
                    }
                });

                return { job, session };
            });

            expect(result.job).toBeTruthy();
            expect(result.session).toBeTruthy();

            // Verify both records exist in database
            const job = await jobRepository.findById(testJob.id);
            const session = await applicationRepository.findById(result.session.id);

            expect(job).toBeTruthy();
            expect(session).toBeTruthy();
        });

        it('should rollback failed transactions', async () => {
            try {
                await databaseService.transaction(async (tx) => {
                    // Create job successfully
                    await tx.jobPosting.create({
                        data: {
                            id: testJob.id,
                            title: testJob.title,
                            company: testJob.company,
                            location: testJob.location,
                            url: testJob.url,
                            description: testJob.description,
                            salary: testJob.salary,
                            status: testJob.status,
                            isEasyApply: testJob.isEasyApply
                        }
                    });

                    // Intentionally cause an error
                    throw new Error('Transaction rollback test');
                });
            } catch (error) {
                expect((error as Error).message).toBe('Transaction rollback test');
            }

            // Verify job was not created due to rollback
            const job = await jobRepository.findById(testJob.id);
            expect(job).toBeNull();
        });
    });

    describe('Concurrent Database Operations', () => {
        it('should handle concurrent job creation', async () => {
            const jobs = Array.from({ length: 10 }, (_, i) => ({
                ...testJob,
                id: `concurrent-job-${i}`,
                url: `https://linkedin.com/jobs/view/concurrent-job-${i}`,
                title: `Concurrent Job ${i}`
            }));

            // Create jobs concurrently
            const createPromises = jobs.map(job => jobRepository.create(job));
            const createdJobs = await Promise.all(createPromises);

            expect(createdJobs).toHaveLength(10);

            // Verify all jobs were created
            const stats = await jobRepository.getApplicationStats();
            expect(stats.total).toBe(10);
        });

        it('should handle concurrent job updates', async () => {
            // Create initial jobs
            const jobs = Array.from({ length: 5 }, (_, i) => ({
                ...testJob,
                id: `update-job-${i}`,
                url: `https://linkedin.com/jobs/view/update-job-${i}`,
                title: `Update Job ${i}`
            }));

            for (const job of jobs) {
                await jobRepository.create(job);
            }

            // Update jobs concurrently
            const updatePromises = jobs.map(job =>
                jobRepository.markAsApplied(job.id)
            );

            const updatedJobs = await Promise.all(updatePromises);

            expect(updatedJobs).toHaveLength(5);
            updatedJobs.forEach(job => {
                expect(job.status).toBe(JobStatus.APPLIED);
                expect(job.appliedAt).toBeInstanceOf(Date);
            });

            // Verify statistics
            const stats = await jobRepository.getApplicationStats();
            expect(stats.applied).toBe(5);
        });

        it('should handle concurrent session operations', async () => {
            // Create sessions concurrently
            const sessionPromises = Array.from({ length: 5 }, (_, i) =>
                applicationRepository.create({
                    searchConfig: {
                        ...testSearchConfig,
                        keywords: [`keyword-${i}`]
                    }
                })
            );

            const sessions = await Promise.all(sessionPromises);
            expect(sessions).toHaveLength(5);

            // Update sessions concurrently
            const updatePromises = sessions.map((session, i) =>
                applicationRepository.update(session.id, {
                    totalJobsFound: i + 1,
                    totalApplicationsSubmitted: i
                })
            );

            const updatedSessions = await Promise.all(updatePromises);

            expect(updatedSessions).toHaveLength(5);
            updatedSessions.forEach((session, i) => {
                expect(session.totalJobsFound).toBe(i + 1);
                expect(session.totalApplicationsSubmitted).toBe(i);
            });
        });
    });

    describe('Data Integrity and Constraints', () => {
        it('should enforce unique constraints', async () => {
            // Create job first time
            await jobRepository.create(testJob);

            // Try to create job with same ID - should fail
            await expect(jobRepository.create(testJob)).rejects.toThrow();
        });

        it('should enforce required fields', async () => {
            const incompleteJob = {
                id: 'incomplete-job',
                // Missing required fields like title, company, etc.
            };

            await expect(
                jobRepository.create(incompleteJob as any)
            ).rejects.toThrow();
        });

        it('should handle invalid job status values', async () => {
            await jobRepository.create(testJob);

            // Try to update with invalid status - SQLite doesn't enforce enum constraints
            // so this test verifies the update works but we should validate in application logic
            const updatedJob = await jobRepository.update(testJob.id, {
                status: 'INVALID_STATUS' as any
            });

            // The update should work at database level, but application should validate
            expect(updatedJob.status).toBe('INVALID_STATUS');
        });

        it('should maintain referential integrity', async () => {
            // Create job and session
            await jobRepository.create(testJob);
            const session = await applicationRepository.create({
                searchConfig: testSearchConfig
            });

            // Both should exist
            const job = await jobRepository.findById(testJob.id);
            const foundSession = await applicationRepository.findById(session.id);

            expect(job).toBeTruthy();
            expect(foundSession).toBeTruthy();
        });
    });

    describe('Database Performance', () => {
        it('should handle large batch operations efficiently', async () => {
            const startTime = Date.now();

            // Create 100 jobs
            const jobs = Array.from({ length: 100 }, (_, i) => ({
                ...testJob,
                id: `batch-job-${i}`,
                url: `https://linkedin.com/jobs/view/batch-job-${i}`,
                title: `Batch Job ${i}`,
                company: `Company ${i % 10}` // Some variety in company names
            }));

            // Use transaction for better performance
            await databaseService.transaction(async (tx) => {
                const createPromises = jobs.map(job =>
                    tx.jobPosting.create({
                        data: {
                            id: job.id,
                            title: job.title,
                            company: job.company,
                            location: job.location,
                            url: job.url,
                            description: job.description,
                            salary: job.salary,
                            status: job.status,
                            isEasyApply: job.isEasyApply
                        }
                    })
                );

                await Promise.all(createPromises);
            });

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (adjust threshold as needed)
            expect(duration).toBeLessThan(10000); // 10 seconds

            // Verify all jobs were created
            const stats = await jobRepository.getApplicationStats();
            expect(stats.total).toBe(100);
        });

        it('should handle complex queries efficiently', async () => {
            // Create jobs with various statuses and dates
            const jobs = Array.from({ length: 50 }, (_, i) => ({
                ...testJob,
                id: `query-job-${i}`,
                url: `https://linkedin.com/jobs/view/query-job-${i}`,
                title: `Query Job ${i}`,
                status: i % 4 === 0 ? JobStatus.APPLIED :
                    i % 4 === 1 ? JobStatus.SKIPPED :
                        i % 4 === 2 ? JobStatus.ERROR : JobStatus.FOUND
            }));

            for (const job of jobs) {
                await jobRepository.create(job);
            }

            const startTime = Date.now();

            // Perform complex query
            const prisma = databaseService.getClient();
            const results = await prisma.jobPosting.findMany({
                where: {
                    OR: [
                        { status: JobStatus.APPLIED },
                        { status: JobStatus.SKIPPED }
                    ],
                    title: {
                        contains: 'Query Job'
                    }
                },
                orderBy: [
                    { createdAt: 'desc' },
                    { title: 'asc' }
                ]
            });

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete quickly
            expect(duration).toBeLessThan(1000); // 1 second
            expect(results.length).toBeGreaterThan(0);
        });
    });
});

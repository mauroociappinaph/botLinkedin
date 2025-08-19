import { PrismaClient } from '@prisma/client';
import { DatabaseService } from '../../../src/database/DatabaseService';
import { JobRepository } from '../../../src/database/JobRepository';
import { JobStatus } from '../../../src/types';

// Mock DatabaseService
jest.mock('../../../src/database/DatabaseService');

describe('JobRepository', () => {
    let jobRepository: JobRepository;
    let mockPrisma: jest.Mocked<PrismaClient>;
    let mockDatabaseService: jest.Mocked<DatabaseService>;

    const mockJob = {
        id: 'job-123',
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        url: 'https://linkedin.com/jobs/123',
        description: 'Great job opportunity',
        status: JobStatus.FOUND,
        appliedAt: null,
        salary: '$100k-150k',
        isEasyApply: true,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock Prisma client methods
        mockPrisma = {
            jobPosting: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
                count: jest.fn(),
            },
        } as any;

        // Mock DatabaseService
        mockDatabaseService = {
            getInstance: jest.fn().mockReturnValue({
                getClient: jest.fn().mockReturnValue(mockPrisma)
            }),
            getClient: jest.fn().mockReturnValue(mockPrisma)
        } as any;

        (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDatabaseService);

        jobRepository = new JobRepository();
    });

    describe('findById', () => {
        it('should find job by ID successfully', async () => {
            mockPrisma.jobPosting.findUnique.mockResolvedValue(mockJob);

            const result = await jobRepository.findById('job-123');

            expect(result).toEqual(mockJob);
            expect(mockPrisma.jobPosting.findUnique).toHaveBeenCalledWith({
                where: { id: 'job-123' }
            });
        });

        it('should return null when job not found', async () => {
            mockPrisma.jobPosting.findUnique.mockResolvedValue(null);

            const result = await jobRepository.findById('nonexistent');

            expect(result).toBeNull();
        });

        it('should throw error on database failure', async () => {
            mockPrisma.jobPosting.findUnique.mockRejectedValue(new Error('DB Error'));

            await expect(jobRepository.findById('job-123')).rejects.toThrow(
                'Failed to find job by ID: Error: DB Error'
            );
        });
    });

    describe('findAll', () => {
        const mockJobs = [mockJob, { ...mockJob, id: 'job-456', title: 'Senior Engineer' }];

        it('should find all jobs without filters', async () => {
            mockPrisma.jobPosting.findMany.mockResolvedValue(mockJobs);

            const result = await jobRepository.findAll();

            expect(result).toEqual(mockJobs);
            expect(mockPrisma.jobPosting.findMany).toHaveBeenCalledWith({
                where: {},
                orderBy: { createdAt: 'desc' }
            });
        });

        it('should apply status filter', async () => {
            mockPrisma.jobPosting.findMany.mockResolvedValue([mockJob]);

            const result = await jobRepository.findAll({ status: JobStatus.APPLIED });

            expect(result).toEqual([mockJob]);
            expect(mockPrisma.jobPosting.findMany).toHaveBeenCalledWith({
                where: { status: JobStatus.APPLIED },
                orderBy: { createdAt: 'desc' }
            });
        });

        it('should apply company filter', async () => {
            mockPrisma.jobPosting.findMany.mockResolvedValue([mockJob]);

            const result = await jobRepository.findAll({ company: 'Tech' });

            expect(result).toEqual([mockJob]);
            expect(mockPrisma.jobPosting.findMany).toHaveBeenCalledWith({
                where: {
                    company: {
                        contains: 'Tech',
                        mode: 'insensitive'
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        });

        it('should apply pagination', async () => {
            mockPrisma.jobPosting.findMany.mockResolvedValue([mockJob]);

            const result = await jobRepository.findAll({ limit: 10, offset: 5 });

            expect(result).toEqual([mockJob]);
            expect(mockPrisma.jobPosting.findMany).toHaveBeenCalledWith({
                where: {},
                take: 10,
                skip: 5,
                orderBy: { createdAt: 'desc' }
            });
        });

        it('should throw error on database failure', async () => {
            mockPrisma.jobPosting.findMany.mockRejectedValue(new Error('DB Error'));

            await expect(jobRepository.findAll()).rejects.toThrow(
                'Failed to find jobs: Error: DB Error'
            );
        });
    });

    describe('create', () => {
        const newJobData = {
            id: 'job-789',
            title: 'Frontend Developer',
            company: 'Startup Inc',
            location: 'Remote',
            url: 'https://linkedin.com/jobs/789',
            status: JobStatus.FOUND,
            isEasyApply: true
        };

        it('should create job successfully', async () => {
            const createdJob = { ...newJobData, createdAt: new Date(), updatedAt: new Date() };
            mockPrisma.jobPosting.create.mockResolvedValue(createdJob);

            const result = await jobRepository.create(newJobData);

            expect(result).toEqual(createdJob);
            expect(mockPrisma.jobPosting.create).toHaveBeenCalledWith({
                data: newJobData
            });
        });

        it('should throw error on creation failure', async () => {
            mockPrisma.jobPosting.create.mockRejectedValue(new Error('Creation failed'));

            await expect(jobRepository.create(newJobData)).rejects.toThrow(
                'Failed to create job: Error: Creation failed'
            );
        });
    });

    describe('update', () => {
        const updates = { status: JobStatus.APPLIED, appliedAt: new Date() };

        it('should update job successfully', async () => {
            const updatedJob = { ...mockJob, ...updates };
            mockPrisma.jobPosting.update.mockResolvedValue(updatedJob);

            const result = await jobRepository.update('job-123', updates);

            expect(result).toEqual(updatedJob);
            expect(mockPrisma.jobPosting.update).toHaveBeenCalledWith({
                where: { id: 'job-123' },
                data: updates
            });
        });

        it('should throw error on update failure', async () => {
            mockPrisma.jobPosting.update.mockRejectedValue(new Error('Update failed'));

            await expect(jobRepository.update('job-123', updates)).rejects.toThrow(
                'Failed to update job: Error: Update failed'
            );
        });
    });

    describe('delete', () => {
        it('should delete job successfully', async () => {
            mockPrisma.jobPosting.delete.mockResolvedValue(mockJob);

            const result = await jobRepository.delete('job-123');

            expect(result).toBe(true);
            expect(mockPrisma.jobPosting.delete).toHaveBeenCalledWith({
                where: { id: 'job-123' }
            });
        });

        it('should return false on deletion failure', async () => {
            mockPrisma.jobPosting.delete.mockRejectedValue(new Error('Delete failed'));

            const result = await jobRepository.delete('job-123');

            expect(result).toBe(false);
        });
    });

    describe('hasBeenAppliedTo', () => {
        it('should return true for applied job', async () => {
            mockPrisma.jobPosting.findUnique.mockResolvedValue({ status: JobStatus.APPLIED });

            const result = await jobRepository.hasBeenAppliedTo('job-123');

            expect(result).toBe(true);
            expect(mockPrisma.jobPosting.findUnique).toHaveBeenCalledWith({
                where: { id: 'job-123' },
                select: { status: true }
            });
        });

        it('should return false for non-applied job', async () => {
            mockPrisma.jobPosting.findUnique.mockResolvedValue({ status: JobStatus.FOUND });

            const result = await jobRepository.hasBeenAppliedTo('job-123');

            expect(result).toBe(false);
        });

        it('should return false when job not found', async () => {
            mockPrisma.jobPosting.findUnique.mockResolvedValue(null);

            const result = await jobRepository.hasBeenAppliedTo('nonexistent');

            expect(result).toBe(false);
        });

        it('should return false on database error', async () => {
            mockPrisma.jobPosting.findUnique.mockRejectedValue(new Error('DB Error'));

            const result = await jobRepository.hasBeenAppliedTo('job-123');

            expect(result).toBe(false);
        });
    });

    describe('markAsApplied', () => {
        it('should mark job as applied successfully', async () => {
            const appliedJob = { ...mockJob, status: JobStatus.APPLIED, appliedAt: new Date() };
            mockPrisma.jobPosting.update.mockResolvedValue(appliedJob);

            const result = await jobRepository.markAsApplied('job-123');

            expect(result).toEqual(appliedJob);
            expect(mockPrisma.jobPosting.update).toHaveBeenCalledWith({
                where: { id: 'job-123' },
                data: {
                    status: JobStatus.APPLIED,
                    appliedAt: expect.any(Date)
                }
            });
        });

        it('should throw error on marking failure', async () => {
            mockPrisma.jobPosting.update.mockRejectedValue(new Error('Update failed'));

            await expect(jobRepository.markAsApplied('job-123')).rejects.toThrow(
                'Failed to mark job as applied: Error: Update failed'
            );
        });
    });

    describe('getJobsByStatus', () => {
        const appliedJobs = [
            { ...mockJob, status: JobStatus.APPLIED },
            { ...mockJob, id: 'job-456', status: JobStatus.APPLIED }
        ];

        it('should get jobs by status with count', async () => {
            mockPrisma.jobPosting.findMany.mockResolvedValue(appliedJobs);
            mockPrisma.jobPosting.count.mockResolvedValue(2);

            const result = await jobRepository.getJobsByStatus(JobStatus.APPLIED);

            expect(result).toEqual({
                jobs: appliedJobs,
                count: 2
            });
            expect(mockPrisma.jobPosting.findMany).toHaveBeenCalledWith({
                where: { status: JobStatus.APPLIED },
                orderBy: { createdAt: 'desc' }
            });
            expect(mockPrisma.jobPosting.count).toHaveBeenCalledWith({
                where: { status: JobStatus.APPLIED }
            });
        });

        it('should throw error on database failure', async () => {
            mockPrisma.jobPosting.findMany.mockRejectedValue(new Error('DB Error'));

            await expect(jobRepository.getJobsByStatus(JobStatus.APPLIED)).rejects.toThrow(
                'Failed to get jobs by status: Error: DB Error'
            );
        });
    });

    describe('getApplicationStats', () => {
        it('should get application statistics', async () => {
            mockPrisma.jobPosting.count
                .mockResolvedValueOnce(100) // total
                .mockResolvedValueOnce(75)  // applied
                .mockResolvedValueOnce(20)  // skipped
                .mockResolvedValueOnce(5);  // errors

            const result = await jobRepository.getApplicationStats();

            expect(result).toEqual({
                total: 100,
                applied: 75,
                skipped: 20,
                errors: 5
            });

            expect(mockPrisma.jobPosting.count).toHaveBeenCalledTimes(4);
            expect(mockPrisma.jobPosting.count).toHaveBeenNthCalledWith(1);
            expect(mockPrisma.jobPosting.count).toHaveBeenNthCalledWith(2, { where: { status: JobStatus.APPLIED } });
            expect(mockPrisma.jobPosting.count).toHaveBeenNthCalledWith(3, { where: { status: JobStatus.SKIPPED } });
            expect(mockPrisma.jobPosting.count).toHaveBeenNthCalledWith(4, { where: { status: JobStatus.ERROR } });
        });

        it('should throw error on database failure', async () => {
            mockPrisma.jobPosting.count.mockRejectedValue(new Error('Count failed'));

            await expect(jobRepository.getApplicationStats()).rejects.toThrow(
                'Failed to get application stats: Error: Count failed'
            );
        });
    });
});

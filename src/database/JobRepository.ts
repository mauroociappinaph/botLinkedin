import { PrismaClient } from '@prisma/client';
import { JobPosting, JobStatus } from '../types';
import { DatabaseService } from './DatabaseService';

/**
 * Repository for managing job posting data
 * Provides CRUD operations and business logic for job-related database operations
 */
export class JobRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = DatabaseService.getInstance().getClient();
  }

  /**
   * Find job by LinkedIn job ID
   */
  async findById(jobId: string): Promise<JobPosting | null> {
    try {
      const job = await this.prisma.jobPosting.findUnique({
        where: { id: jobId },
      });
      return job;
    } catch (error) {
      throw new Error(`Failed to find job by ID: ${error}`);
    }
  }

  /**
   * Find all jobs with optional filtering
   */
  async findAll(filters?: {
    status?: JobStatus;
    company?: string;
    limit?: number;
    offset?: number;
  }): Promise<JobPosting[]> {
    try {
      const where: any = {};

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.company) {
        where.company = {
          contains: filters.company,
          mode: 'insensitive',
        };
      }

      return await this.prisma.jobPosting.findMany({
        where,
        ...(filters?.limit && { take: filters.limit }),
        ...(filters?.offset && { skip: filters.offset }),
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      throw new Error(`Failed to find jobs: ${error}`);
    }
  }

  /**
   * Create new job posting
   */
  async create(
    jobData: Omit<JobPosting, 'createdAt' | 'updatedAt'>
  ): Promise<JobPosting> {
    try {
      return await this.prisma.jobPosting.create({
        data: jobData,
      });
    } catch (error) {
      throw new Error(`Failed to create job: ${error}`);
    }
  }

  /**
   * Update existing job posting
   */
  async update(
    jobId: string,
    updates: Partial<JobPosting>
  ): Promise<JobPosting> {
    try {
      return await this.prisma.jobPosting.update({
        where: { id: jobId },
        data: updates,
      });
    } catch (error) {
      throw new Error(`Failed to update job: ${error}`);
    }
  }

  /**
   * Delete job posting
   */
  async delete(jobId: string): Promise<boolean> {
    try {
      await this.prisma.jobPosting.delete({
        where: { id: jobId },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if job has already been applied to
   */
  async hasBeenAppliedTo(jobId: string): Promise<boolean> {
    try {
      const job = await this.prisma.jobPosting.findUnique({
        where: { id: jobId },
        select: { status: true },
      });

      return job?.status === JobStatus.APPLIED;
    } catch {
      return false;
    }
  }

  /**
   * Mark job as applied
   */
  async markAsApplied(jobId: string): Promise<JobPosting> {
    try {
      return await this.prisma.jobPosting.update({
        where: { id: jobId },
        data: {
          status: JobStatus.APPLIED,
          appliedAt: new Date(),
        },
      });
    } catch (error) {
      throw new Error(`Failed to mark job as applied: ${error}`);
    }
  }

  /**
   * Get jobs by status with count
   */
  async getJobsByStatus(
    status: JobStatus
  ): Promise<{ jobs: JobPosting[]; count: number }> {
    try {
      const [jobs, count] = await Promise.all([
        this.prisma.jobPosting.findMany({
          where: { status },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.jobPosting.count({
          where: { status },
        }),
      ]);

      return { jobs, count };
    } catch (error) {
      throw new Error(`Failed to get jobs by status: ${error}`);
    }
  }

  /**
   * Get application statistics
   */
  async getApplicationStats(): Promise<{
    total: number;
    applied: number;
    skipped: number;
    errors: number;
  }> {
    try {
      const [total, applied, skipped, errors] = await Promise.all([
        this.prisma.jobPosting.count(),
        this.prisma.jobPosting.count({ where: { status: JobStatus.APPLIED } }),
        this.prisma.jobPosting.count({ where: { status: JobStatus.SKIPPED } }),
        this.prisma.jobPosting.count({ where: { status: JobStatus.ERROR } }),
      ]);

      return { total, applied, skipped, errors };
    } catch (error) {
      throw new Error(`Failed to get application stats: ${error}`);
    }
  }
}

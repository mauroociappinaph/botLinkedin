import { PrismaClient } from '@prisma/client';
import { ApplicationSession, JobSearchConfig } from '../types';
import { DatabaseService } from './DatabaseService';

/**
 * Repository for managing application session data
 * Tracks bot execution sessions and provides session-related operations
 */
export class ApplicationRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = DatabaseService.getInstance().getClient();
  }

  /**
   * Find session by ID
   */
  async findById(sessionId: string): Promise<ApplicationSession | null> {
    try {
      const session = await this.prisma.applicationSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) return null;

      // Convert searchConfig from JSON string back to object
      return {
        ...session,
        searchConfig: JSON.parse(session.searchConfig),
      };
    } catch (error) {
      throw new Error(`Failed to find session by ID: ${error}`);
    }
  }

  /**
   * Find all sessions with optional pagination
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
  }): Promise<ApplicationSession[]> {
    try {
      const sessions = await this.prisma.applicationSession.findMany({
        ...(options?.limit && { take: options.limit }),
        ...(options?.offset && { skip: options.offset }),
        orderBy: { startTime: 'desc' },
      });

      // Convert searchConfig from JSON string back to object for each session
      return sessions.map((session) => ({
        ...session,
        searchConfig: JSON.parse(session.searchConfig),
      }));
    } catch (error) {
      throw new Error(`Failed to find sessions: ${error}`);
    }
  }

  /**
   * Create new application session
   */
  async create(sessionData: {
    searchConfig: JobSearchConfig;
  }): Promise<ApplicationSession> {
    try {
      const session = await this.prisma.applicationSession.create({
        data: {
          id: this.generateSessionId(),
          startTime: new Date(),
          totalJobsFound: 0,
          totalApplicationsSubmitted: 0,
          totalSkipped: 0,
          totalErrors: 0,
          searchConfig: JSON.stringify(sessionData.searchConfig),
        },
      });

      // Convert back to ApplicationSession format
      return {
        ...session,
        searchConfig: JSON.parse(session.searchConfig),
      };
    } catch (error) {
      throw new Error(`Failed to create session: ${error}`);
    }
  }

  /**
   * Update existing session
   */
  async update(
    sessionId: string,
    updates: Partial<ApplicationSession>
  ): Promise<ApplicationSession> {
    try {
      // Convert searchConfig to JSON string if present and create proper update data
      const updateData: any = {};

      if (updates.startTime) updateData.startTime = updates.startTime;
      if (updates.endTime !== undefined) updateData.endTime = updates.endTime;
      if (updates.totalJobsFound !== undefined)
        updateData.totalJobsFound = updates.totalJobsFound;
      if (updates.totalApplicationsSubmitted !== undefined)
        updateData.totalApplicationsSubmitted =
          updates.totalApplicationsSubmitted;
      if (updates.totalSkipped !== undefined)
        updateData.totalSkipped = updates.totalSkipped;
      if (updates.totalErrors !== undefined)
        updateData.totalErrors = updates.totalErrors;
      if (updates.searchConfig)
        updateData.searchConfig = JSON.stringify(updates.searchConfig);

      const session = await this.prisma.applicationSession.update({
        where: { id: sessionId },
        data: updateData,
      });

      // Convert searchConfig back to object
      return {
        ...session,
        searchConfig: JSON.parse(session.searchConfig),
      };
    } catch (error) {
      throw new Error(`Failed to update session: ${error}`);
    }
  }

  /**
   * Delete session
   */
  async delete(sessionId: string): Promise<boolean> {
    try {
      await this.prisma.applicationSession.delete({
        where: { id: sessionId },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * End current session
   */
  async endSession(sessionId: string): Promise<ApplicationSession> {
    try {
      const session = await this.prisma.applicationSession.update({
        where: { id: sessionId },
        data: {
          endTime: new Date(),
        },
      });

      // Convert searchConfig from JSON string back to object
      return {
        ...session,
        searchConfig: JSON.parse(session.searchConfig),
      };
    } catch (error) {
      throw new Error(`Failed to end session: ${error}`);
    }
  }

  /**
   * Update session statistics
   */
  async updateStats(
    sessionId: string,
    stats: {
      totalJobsFound?: number;
      totalApplicationsSubmitted?: number;
      totalSkipped?: number;
      totalErrors?: number;
    }
  ): Promise<ApplicationSession> {
    try {
      const session = await this.prisma.applicationSession.update({
        where: { id: sessionId },
        data: stats,
      });

      // Convert searchConfig from JSON string back to object
      return {
        ...session,
        searchConfig: JSON.parse(session.searchConfig),
      };
    } catch (error) {
      throw new Error(`Failed to update session stats: ${error}`);
    }
  }

  /**
   * Increment session counters
   */
  async incrementCounters(
    sessionId: string,
    counters: {
      jobsFound?: number;
      applicationsSubmitted?: number;
      skipped?: number;
      errors?: number;
    }
  ): Promise<ApplicationSession> {
    try {
      const session = await this.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const updatedSession = await this.prisma.applicationSession.update({
        where: { id: sessionId },
        data: {
          totalJobsFound: session.totalJobsFound + (counters.jobsFound || 0),
          totalApplicationsSubmitted:
            session.totalApplicationsSubmitted +
            (counters.applicationsSubmitted || 0),
          totalSkipped: session.totalSkipped + (counters.skipped || 0),
          totalErrors: session.totalErrors + (counters.errors || 0),
        },
      });

      // Convert searchConfig from JSON string back to object
      return {
        ...updatedSession,
        searchConfig: JSON.parse(updatedSession.searchConfig),
      };
    } catch (error) {
      throw new Error(`Failed to increment session counters: ${error}`);
    }
  }

  /**
   * Get active (ongoing) sessions
   */
  async getActiveSessions(): Promise<ApplicationSession[]> {
    try {
      const sessions = await this.prisma.applicationSession.findMany({
        where: {
          endTime: null,
        },
        orderBy: { startTime: 'desc' },
      });

      // Convert searchConfig from JSON string back to object for each session
      return sessions.map((session) => ({
        ...session,
        searchConfig: JSON.parse(session.searchConfig),
      }));
    } catch (error) {
      throw new Error(`Failed to get active sessions: ${error}`);
    }
  }

  /**
   * Get session summary statistics
   */
  async getSessionSummary(sessionId: string): Promise<{
    session: ApplicationSession;
    duration: number;
    successRate: number;
  } | null> {
    try {
      const session = await this.findById(sessionId);
      if (!session) {
        return null;
      }

      const endTime = session.endTime || new Date();
      const duration = endTime.getTime() - session.startTime.getTime();
      const successRate =
        session.totalJobsFound > 0
          ? (session.totalApplicationsSubmitted / session.totalJobsFound) * 100
          : 0;

      return {
        session,
        duration,
        successRate,
      };
    } catch (error) {
      throw new Error(`Failed to get session summary: ${error}`);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `session_${timestamp}_${randomStr}`;
  }
}

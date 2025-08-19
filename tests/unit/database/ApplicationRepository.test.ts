import { PrismaClient } from '@prisma/client';
import { ApplicationRepository } from '../../../src/database/ApplicationRepository';
import { DatabaseService } from '../../../src/database/DatabaseService';
import { JobSearchConfig } from '../../../src/types';

// Mock DatabaseService
jest.mock('../../../src/database/DatabaseService');

describe('ApplicationRepository', () => {
    let applicationRepository: ApplicationRepository;
    let mockPrisma: jest.Mocked<PrismaClient>;
    let mockDatabaseService: jest.Mocked<DatabaseService>;

    const mockSearchConfig: JobSearchConfig = {
        keywords: ['software engineer'],
        location: 'San Francisco, CA',
        datePosted: 'pastWeek',
        remoteWork: true,
        experienceLevel: ['mid'],
        jobType: ['fullTime']
    };

    const mockSession = {
        id: 'session_123',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: null,
        totalJobsFound: 10,
        totalApplicationsSubmitted: 5,
        totalSkipped: 3,
        totalErrors: 2,
        searchConfig: JSON.stringify(mockSearchConfig)
    };

    const mockSessionObject = {
        ...mockSession,
        searchConfig: mockSearchConfig
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock Prisma client methods
        mockPrisma = {
            applicationSession: {
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

        applicationRepository = new ApplicationRepository();
    });

    describe('findById', () => {
        it('should find session by ID successfully', async () => {
            mockPrisma.applicationSession.findUnique.mockResolvedValue(mockSession);

            const result = await applicationRepository.findById('session_123');

            expect(result).toEqual(mockSessionObject);
            expect(mockPrisma.applicationSession.findUnique).toHaveBeenCalledWith({
                where: { id: 'session_123' }
            });
        });

        it('should return null when session not found', async () => {
            mockPrisma.applicationSession.findUnique.mockResolvedValue(null);

            const result = await applicationRepository.findById('nonexistent');

            expect(result).toBeNull();
        });

        it('should throw error on database failure', async () => {
            mockPrisma.applicationSession.findUnique.mockRejectedValue(new Error('DB Error'));

            await expect(applicationRepository.findById('session_123')).rejects.toThrow(
                'Failed to find session by ID: Error: DB Error'
            );
        });
    });

    describe('findAll', () => {
        const mockSessions = [mockSession, { ...mockSession, id: 'session_456' }];
        const mockSessionObjects = mockSessions.map(session => ({
            ...session,
            searchConfig: mockSearchConfig
        }));

        it('should find all sessions without pagination', async () => {
            mockPrisma.applicationSession.findMany.mockResolvedValue(mockSessions);

            const result = await applicationRepository.findAll();

            expect(result).toEqual(mockSessionObjects);
            expect(mockPrisma.applicationSession.findMany).toHaveBeenCalledWith({
                orderBy: { startTime: 'desc' }
            });
        });

        it('should apply pagination options', async () => {
            mockPrisma.applicationSession.findMany.mockResolvedValue([mockSession]);

            const result = await applicationRepository.findAll({ limit: 10, offset: 5 });

            expect(result).toEqual([mockSessionObject]);
            expect(mockPrisma.applicationSession.findMany).toHaveBeenCalledWith({
                take: 10,
                skip: 5,
                orderBy: { startTime: 'desc' }
            });
        });

        it('should throw error on database failure', async () => {
            mockPrisma.applicationSession.findMany.mockRejectedValue(new Error('DB Error'));

            await expect(applicationRepository.findAll()).rejects.toThrow(
                'Failed to find sessions: Error: DB Error'
            );
        });
    });

    describe('create', () => {
        it('should create session successfully', async () => {
            const createdSession = {
                ...mockSession,
                id: expect.stringMatching(/^session_/),
                startTime: expect.any(Date)
            };

            mockPrisma.applicationSession.create.mockResolvedValue(createdSession);

            const result = await applicationRepository.create({ searchConfig: mockSearchConfig });

            expect(result.searchConfig).toEqual(mockSearchConfig);
            expect(result.id).toMatch(/^session_/);
            expect(mockPrisma.applicationSession.create).toHaveBeenCalledWith({
                data: {
                    id: expect.stringMatching(/^session_/),
                    startTime: expect.any(Date),
                    totalJobsFound: 0,
                    totalApplicationsSubmitted: 0,
                    totalSkipped: 0,
                    totalErrors: 0,
                    searchConfig: JSON.stringify(mockSearchConfig)
                }
            });
        });

        it('should throw error on creation failure', async () => {
            mockPrisma.applicationSession.create.mockRejectedValue(new Error('Creation failed'));

            await expect(applicationRepository.create({ searchConfig: mockSearchConfig })).rejects.toThrow(
                'Failed to create session: Error: Creation failed'
            );
        });
    });

    describe('update', () => {
        const updates = {
            totalJobsFound: 15,
            totalApplicationsSubmitted: 8,
            endTime: new Date('2024-01-01T12:00:00Z')
        };

        it('should update session successfully', async () => {
            const updatedSession = { ...mockSession, ...updates };
            mockPrisma.applicationSession.update.mockResolvedValue(updatedSession);

            const result = await applicationRepository.update('session_123', updates);

            expect(result.searchConfig).toEqual(mockSearchConfig);
            expect(result.totalJobsFound).toBe(15);
            expect(result.totalApplicationsSubmitted).toBe(8);
            expect(mockPrisma.applicationSession.update).toHaveBeenCalledWith({
                where: { id: 'session_123' },
                data: {
                    totalJobsFound: 15,
                    totalApplicationsSubmitted: 8,
                    endTime: updates.endTime
                }
            });
        });

        it('should handle searchConfig updates', async () => {
            const newSearchConfig = { ...mockSearchConfig, location: 'New York, NY' };
            const updatesWithConfig = { searchConfig: newSearchConfig };
            const updatedSession = {
                ...mockSession,
                searchConfig: JSON.stringify(newSearchConfig)
            };

            mockPrisma.applicationSession.update.mockResolvedValue(updatedSession);

            const result = await applicationRepository.update('session_123', updatesWithConfig);

            expect(result.searchConfig).toEqual(newSearchConfig);
            expect(mockPrisma.applicationSession.update).toHaveBeenCalledWith({
                where: { id: 'session_123' },
                data: {
                    searchConfig: JSON.stringify(newSearchConfig)
                }
            });
        });

        it('should throw error on update failure', async () => {
            mockPrisma.applicationSession.update.mockRejectedValue(new Error('Update failed'));

            await expect(applicationRepository.update('session_123', updates)).rejects.toThrow(
                'Failed to update session: Error: Update failed'
            );
        });
    });

    describe('delete', () => {
        it('should delete session successfully', async () => {
            mockPrisma.applicationSession.delete.mockResolvedValue(mockSession);

            const result = await applicationRepository.delete('session_123');

            expect(result).toBe(true);
            expect(mockPrisma.applicationSession.delete).toHaveBeenCalledWith({
                where: { id: 'session_123' }
            });
        });

        it('should return false on deletion failure', async () => {
            mockPrisma.applicationSession.delete.mockRejectedValue(new Error('Delete failed'));

            const result = await applicationRepository.delete('session_123');

            expect(result).toBe(false);
        });
    });

    describe('endSession', () => {
        it('should end session successfully', async () => {
            const endedSession = { ...mockSession, endTime: new Date() };
            mockPrisma.applicationSession.update.mockResolvedValue(endedSession);

            const result = await applicationRepository.endSession('session_123');

            expect(result.searchConfig).toEqual(mockSearchConfig);
            expect(result.endTime).toBeDefined();
            expect(mockPrisma.applicationSession.update).toHaveBeenCalledWith({
                where: { id: 'session_123' },
                data: {
                    endTime: expect.any(Date)
                }
            });
        });

        it('should throw error on end session failure', async () => {
            mockPrisma.applicationSession.update.mockRejectedValue(new Error('End failed'));

            await expect(applicationRepository.endSession('session_123')).rejects.toThrow(
                'Failed to end session: Error: End failed'
            );
        });
    });

    describe('updateStats', () => {
        const stats = {
            totalJobsFound: 20,
            totalApplicationsSubmitted: 12,
            totalSkipped: 5,
            totalErrors: 3
        };

        it('should update session statistics', async () => {
            const updatedSession = { ...mockSession, ...stats };
            mockPrisma.applicationSession.update.mockResolvedValue(updatedSession);

            const result = await applicationRepository.updateStats('session_123', stats);

            expect(result.searchConfig).toEqual(mockSearchConfig);
            expect(result.totalJobsFound).toBe(20);
            expect(mockPrisma.applicationSession.update).toHaveBeenCalledWith({
                where: { id: 'session_123' },
                data: stats
            });
        });

        it('should throw error on stats update failure', async () => {
            mockPrisma.applicationSession.update.mockRejectedValue(new Error('Stats update failed'));

            await expect(applicationRepository.updateStats('session_123', stats)).rejects.toThrow(
                'Failed to update session stats: Error: Stats update failed'
            );
        });
    });

    describe('incrementCounters', () => {
        it('should increment session counters successfully', async () => {
            // Mock findById to return current session
            mockPrisma.applicationSession.findUnique.mockResolvedValue(mockSession);

            const incrementedSession = {
                ...mockSession,
                totalJobsFound: 12, // 10 + 2
                totalApplicationsSubmitted: 7, // 5 + 2
                totalSkipped: 4, // 3 + 1
                totalErrors: 3 // 2 + 1
            };
            mockPrisma.applicationSession.update.mockResolvedValue(incrementedSession);

            const result = await applicationRepository.incrementCounters('session_123', {
                jobsFound: 2,
                applicationsSubmitted: 2,
                skipped: 1,
                errors: 1
            });

            expect(result.totalJobsFound).toBe(12);
            expect(result.totalApplicationsSubmitted).toBe(7);
            expect(result.totalSkipped).toBe(4);
            expect(result.totalErrors).toBe(3);
            expect(mockPrisma.applicationSession.update).toHaveBeenCalledWith({
                where: { id: 'session_123' },
                data: {
                    totalJobsFound: 12,
                    totalApplicationsSubmitted: 7,
                    totalSkipped: 4,
                    totalErrors: 3
                }
            });
        });

        it('should throw error when session not found', async () => {
            mockPrisma.applicationSession.findUnique.mockResolvedValue(null);

            await expect(applicationRepository.incrementCounters('nonexistent', { jobsFound: 1 }))
                .rejects.toThrow('Failed to increment session counters: Error: Session not found');
        });

        it('should throw error on increment failure', async () => {
            mockPrisma.applicationSession.findUnique.mockResolvedValue(mockSession);
            mockPrisma.applicationSession.update.mockRejectedValue(new Error('Increment failed'));

            await expect(applicationRepository.incrementCounters('session_123', { jobsFound: 1 }))
                .rejects.toThrow('Failed to increment session counters: Error: Increment failed');
        });
    });

    describe('getActiveSessions', () => {
        const activeSessions = [
            mockSession,
            { ...mockSession, id: 'session_456' }
        ];
        const activeSessionObjects = activeSessions.map(session => ({
            ...session,
            searchConfig: mockSearchConfig
        }));

        it('should get active sessions successfully', async () => {
            mockPrisma.applicationSession.findMany.mockResolvedValue(activeSessions);

            const result = await applicationRepository.getActiveSessions();

            expect(result).toEqual(activeSessionObjects);
            expect(mockPrisma.applicationSession.findMany).toHaveBeenCalledWith({
                where: { endTime: null },
                orderBy: { startTime: 'desc' }
            });
        });

        it('should throw error on database failure', async () => {
            mockPrisma.applicationSession.findMany.mockRejectedValue(new Error('DB Error'));

            await expect(applicationRepository.getActiveSessions()).rejects.toThrow(
                'Failed to get active sessions: Error: DB Error'
            );
        });
    });

    describe('getSessionSummary', () => {
        it('should get session summary for completed session', async () => {
            const completedSession = {
                ...mockSession,
                endTime: new Date('2024-01-01T12:00:00Z')
            };
            mockPrisma.applicationSession.findUnique.mockResolvedValue(completedSession);

            const result = await applicationRepository.getSessionSummary('session_123');

            expect(result).toBeDefined();
            expect(result!.session.searchConfig).toEqual(mockSearchConfig);
            expect(result!.duration).toBe(2 * 60 * 60 * 1000); // 2 hours in milliseconds
            expect(result!.successRate).toBe(50); // 5/10 * 100
        });

        it('should calculate summary for active session using current time', async () => {
            const activeSession = { ...mockSession, endTime: null };
            mockPrisma.applicationSession.findUnique.mockResolvedValue(activeSession);

            const result = await applicationRepository.getSessionSummary('session_123');

            expect(result).toBeDefined();
            expect(result!.session.searchConfig).toEqual(mockSearchConfig);
            expect(result!.duration).toBeGreaterThan(0);
            expect(result!.successRate).toBe(50); // 5/10 * 100
        });

        it('should return null when session not found', async () => {
            mockPrisma.applicationSession.findUnique.mockResolvedValue(null);

            const result = await applicationRepository.getSessionSummary('nonexistent');

            expect(result).toBeNull();
        });

        it('should handle zero jobs found', async () => {
            const sessionWithNoJobs = { ...mockSession, totalJobsFound: 0, totalApplicationsSubmitted: 0 };
            mockPrisma.applicationSession.findUnique.mockResolvedValue(sessionWithNoJobs);

            const result = await applicationRepository.getSessionSummary('session_123');

            expect(result!.successRate).toBe(0);
        });

        it('should throw error on database failure', async () => {
            mockPrisma.applicationSession.findUnique.mockRejectedValue(new Error('DB Error'));

            await expect(applicationRepository.getSessionSummary('session_123')).rejects.toThrow(
                'Failed to get session summary: Error: DB Error'
            );
        });
    });
});

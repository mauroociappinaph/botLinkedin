import { promises as fs } from 'fs';
import { join } from 'path';
import { ConfigLoader } from '../../../src/config/ConfigLoader';

// Mock fs module
jest.mock('fs', () => ({
    promises: {
        access: jest.fn(),
        readFile: jest.fn(),
        stat: jest.fn(),
        constants: {
            R_OK: 4,
        },
    },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigLoader', () => {
    const testConfigPath = join(process.cwd(), 'test-config.json');
    const validConfig = {
        linkedin: {
            email: 'test@example.com',
            password: 'password123'
        },
        search: {
            keywords: ['software engineer'],
            location: 'San Francisco',
            datePosted: 'pastWeek',
            remoteWork: true,
            experienceLevel: ['mid'],
            jobType: ['fullTime']
        },
        application: {
            personalInfo: {
                experience: 'Senior developer with 5 years experience',
                salaryExpectation: {
                    min: 100000,
                    max: 150000,
                    currency: 'USD'
                }
            },
            commonAnswers: {
                'Why do you want to work here?': 'Great company culture'
            }
        },
        browser: {
            headless: true,
            slowMo: 100,
            timeout: 30000
        },
        delays: {
            minPageLoad: 1000,
            maxPageLoad: 3000,
            minTyping: 50,
            maxTyping: 150
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('load', () => {
        it('should load and parse valid configuration', async () => {
            mockFs.stat.mockResolvedValue({ size: 1000 } as any);
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify(validConfig));

            const result = await ConfigLoader.load(testConfigPath);

            expect(mockFs.stat).toHaveBeenCalledWith(testConfigPath);
            expect(mockFs.access).toHaveBeenCalledWith(testConfigPath, mockFs.constants.R_OK);
            expect(mockFs.readFile).toHaveBeenCalledWith(testConfigPath, 'utf-8');
            expect(result).toEqual(validConfig);
        });

        it('should throw error when config file does not exist', async () => {
            const error = new Error('ENOENT') as any;
            error.code = 'ENOENT';
            mockFs.stat.mockRejectedValue(error);

            await expect(ConfigLoader.load(testConfigPath)).rejects.toThrow(
                `Configuration file not found at: ${testConfigPath}`
            );
        });

        it('should throw error for invalid JSON', async () => {
            mockFs.stat.mockResolvedValue({ size: 1000 } as any);
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue('{ invalid json }');

            await expect(ConfigLoader.load(testConfigPath)).rejects.toThrow(
                'Invalid JSON in configuration file'
            );
        });

        it('should use default path when no path provided', async () => {
            mockFs.stat.mockResolvedValue({ size: 1000 } as any);
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify(validConfig));

            await ConfigLoader.load();

            expect(mockFs.stat).toHaveBeenCalledWith(ConfigLoader.getDefaultPath());
        });
    });

    describe('exists', () => {
        it('should return true when file exists', async () => {
            mockFs.access.mockResolvedValue(undefined);

            const result = await ConfigLoader.exists(testConfigPath);

            expect(result).toBe(true);
            expect(mockFs.access).toHaveBeenCalledWith(testConfigPath);
        });

        it('should return false when file does not exist', async () => {
            mockFs.access.mockRejectedValue(new Error('ENOENT'));

            const result = await ConfigLoader.exists(testConfigPath);

            expect(result).toBe(false);
        });
    });

    describe('getDefaultPath', () => {
        it('should return correct default path', () => {
            const expectedPath = join(process.cwd(), 'config.json');
            expect(ConfigLoader.getDefaultPath()).toBe(expectedPath);
        });
    });
});

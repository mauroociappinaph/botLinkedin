import { Page } from 'puppeteer';
import { SessionManager } from '../../../src/browser/SessionManager';
import { BotConfig, LogLevel } from '../../../src/types';
import { Logger } from '../../../src/utils/Logger';

// Mock dependencies
jest.mock('../../../src/utils/DelayUtils');
jest.mock('fs', () => ({
    promises: {
        writeFile: jest.fn(),
        readFile: jest.fn(),
        access: jest.fn(),
        unlink: jest.fn(),
    },
}));

describe('SessionManager', () => {
    let sessionManager: SessionManager;
    let mockPage: jest.Mocked<Page>;
    let logger: Logger;
    let config: BotConfig['linkedin'];
    let delayConfig: BotConfig['delays'];

    beforeEach(() => {
        // Setup mock page
        mockPage = {
            goto: jest.fn(),
            waitForSelector: jest.fn(),
            click: jest.fn(),
            type: jest.fn(),
            $: jest.fn(),
            url: jest.fn().mockReturnValue('https://linkedin.com/feed'),
            cookies: jest.fn().mockResolvedValue([]),
            setCookie: jest.fn(),
            evaluate: jest.fn(),
        } as any;

        logger = new Logger(LogLevel.DEBUG);
        config = {
            email: 'test@example.com',
            password: 'testpassword',
        };
        delayConfig = {
            minPageLoad: 1000,
            maxPageLoad: 2000,
            minTyping: 50,
            maxTyping: 100,
        };

        sessionManager = new SessionManager(config, delayConfig, logger, './test-cookies.json');
        sessionManager.setPage(mockPage);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('setPage', () => {
        it('should set the page instance', () => {
            const newMockPage = {} as Page;
            sessionManager.setPage(newMockPage);
            expect(sessionManager.getSessionData()).toBeNull(); // Should not affect session data
        });
    });

    describe('isLoggedIn', () => {
        it('should return true when logged in elements are found', async () => {
            mockPage.waitForSelector.mockResolvedValueOnce({} as any);

            const result = await sessionManager.isLoggedIn();

            expect(result).toBe(true);
            expect(mockPage.waitForSelector).toHaveBeenCalledWith(
                'nav[aria-label="Primary Navigation"]',
                { timeout: 2000 }
            );
        });

        it('should return true when URL indicates logged in state', async () => {
            mockPage.waitForSelector.mockRejectedValue(new Error('Not found'));
            mockPage.url.mockReturnValue('https://linkedin.com/feed');

            const result = await sessionManager.isLoggedIn();

            expect(result).toBe(true);
        });

        it('should return false when not logged in', async () => {
            mockPage.waitForSelector.mockRejectedValue(new Error('Not found'));
            mockPage.url.mockReturnValue('https://linkedin.com/login');

            const result = await sessionManager.isLoggedIn();

            expect(result).toBe(false);
        });

        it('should handle errors gracefully', async () => {
            mockPage.waitForSelector.mockRejectedValue(new Error('Network error'));
            mockPage.url.mockImplementation(() => {
                throw new Error('Page error');
            });

            const result = await sessionManager.isLoggedIn();

            expect(result).toBe(false);
        });
    });

    describe('isSessionExpired', () => {
        it('should return true when no session data exists', () => {
            const result = sessionManager.isSessionExpired();
            expect(result).toBe(true);
        });

        it('should return true when session is expired', () => {
            // Create expired session data by manipulating internal state
            const expiredTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
            (sessionManager as any).sessionData = {
                isLoggedIn: true,
                lastActivity: expiredTime,
                sessionId: 'test-session',
                cookies: []
            };

            const result = sessionManager.isSessionExpired();
            expect(result).toBe(true);
        });
    });

    describe('getSessionData', () => {
        it('should return null when no session exists', () => {
            const result = sessionManager.getSessionData();
            expect(result).toBeNull();
        });
    });

    describe('setSessionTimeout', () => {
        it('should update session timeout', () => {
            const newTimeout = 60000; // 1 minute
            sessionManager.setSessionTimeout(newTimeout);

            expect(sessionManager.getSessionTimeout()).toBe(newTimeout);
        });
    });

    describe('validateSession', () => {
        it('should return false when page is not set', async () => {
            sessionManager.setPage(null as any);

            const result = await sessionManager.validateSession();

            expect(result).toBe(false);
        });
    });

    describe('cleanup', () => {
        it('should complete cleanup without errors', async () => {
            await expect(sessionManager.cleanup()).resolves.toBeUndefined();
        });
    });
});

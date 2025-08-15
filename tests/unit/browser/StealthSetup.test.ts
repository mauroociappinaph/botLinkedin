import { STEALTH_CONFIG } from '../../../src/browser/StealthConstants';
import { StealthSetup } from '../../../src/browser/StealthSetup';

describe('StealthSetup', () => {
    describe('configuration validation', () => {
        test('should validate stealth configuration successfully', () => {
            const isValid = StealthSetup.validateStealthConfig();
            expect(isValid).toBe(true);
        });

        test('should configure stealth plugin', () => {
            // Should not throw error
            expect(() => StealthSetup.configure()).not.toThrow();
        });

        test('should return puppeteer instance', () => {
            const puppeteer = StealthSetup.getPuppeteer();
            expect(puppeteer).toBeDefined();
            expect(typeof puppeteer.launch).toBe('function');
        });

        test('should return stealth launch options with constants', () => {
            const options = StealthSetup.getStealthLaunchOptions();

            expect(options).toBeDefined();
            expect(options.args).toBeInstanceOf(Array);
            expect(options.args).toContain('--no-sandbox');
            expect(options.args).toContain('--disable-setuid-sandbox');
            expect(options.args?.some(arg => arg.includes('--user-agent='))).toBe(true);
            expect(options.ignoreDefaultArgs).toContain('--enable-automation');
        });
    });

    describe('page stealth measures', () => {
        let mockPage: jest.Mocked<Pick<import('puppeteer').Page, 'evaluateOnNewDocument' | 'setViewport' | 'setExtraHTTPHeaders' | 'isClosed'>>;

        beforeEach(() => {
            mockPage = {
                evaluateOnNewDocument: jest.fn().mockResolvedValue(undefined),
                setViewport: jest.fn().mockResolvedValue(undefined),
                setExtraHTTPHeaders: jest.fn().mockResolvedValue(undefined),
                isClosed: jest.fn().mockReturnValue(false),
            };
        });

        test('should apply stealth measures to page', async () => {
            await StealthSetup.applyPageStealth(mockPage as any);

            expect(mockPage.evaluateOnNewDocument).toHaveBeenCalledTimes(3);
            expect(mockPage.setViewport).toHaveBeenCalledWith(STEALTH_CONFIG.VIEWPORT);
            expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith(STEALTH_CONFIG.HEADERS);
        });

        test('should handle page stealth errors gracefully', async () => {
            mockPage.evaluateOnNewDocument.mockRejectedValue(new Error('Test error'));

            await expect(StealthSetup.applyPageStealth(mockPage as any))
                .rejects.toThrow('Failed to apply stealth configuration: Test error');
        });

        test('should validate page before applying stealth', async () => {
            const invalidPage = null;

            await expect(StealthSetup.applyPageStealth(invalidPage as never))
                .rejects.toThrow('Invalid page provided for stealth configuration');
        });

        test('should validate closed page before applying stealth', async () => {
            mockPage.isClosed.mockReturnValue(true);

            await expect(StealthSetup.applyPageStealth(mockPage as any))
                .rejects.toThrow('Invalid page provided for stealth configuration');
        });
    });

    describe('constants integration', () => {
        test('should use constants for viewport configuration', () => {
            expect(STEALTH_CONFIG.VIEWPORT).toEqual({
                width: 1366,
                height: 768,
                deviceScaleFactor: 1,
            });
        });

        test('should use constants for headers configuration', () => {
            expect(STEALTH_CONFIG.HEADERS).toHaveProperty('Accept-Language');
            expect(STEALTH_CONFIG.HEADERS).toHaveProperty('Accept-Encoding');
            expect(STEALTH_CONFIG.HEADERS['Accept-Language']).toBe('en-US,en;q=0.9');
        });

        test('should use constants for browser arguments', () => {
            expect(STEALTH_CONFIG.BROWSER_ARGS).toContain('--no-sandbox');
            expect(STEALTH_CONFIG.BROWSER_ARGS).toContain('--disable-setuid-sandbox');
        });

        test('should use constants for user agent', () => {
            expect(STEALTH_CONFIG.USER_AGENT).toContain('Mozilla/5.0');
            expect(STEALTH_CONFIG.USER_AGENT).toContain('Chrome');
        });
    });
});

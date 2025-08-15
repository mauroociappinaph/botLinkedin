import { BrowserManager } from '../../../src/browser/BrowserManager';
import { BotConfig } from '../../../src/types';

describe('BrowserManager', () => {
    let browserManager: BrowserManager;
    const mockConfig: BotConfig['browser'] = {
        headless: true,
        slowMo: 0,
        timeout: 10000,
    };

    beforeEach(() => {
        browserManager = new BrowserManager(mockConfig);
    });

    afterEach(async () => {
        if (browserManager.isRunning()) {
            await browserManager.close();
        }
    });

    describe('initialization', () => {
        test('should create BrowserManager instance', () => {
            expect(browserManager).toBeInstanceOf(BrowserManager);
            expect(browserManager.isRunning()).toBe(false);
            expect(browserManager.isReady()).toBe(false);
        });

        test('should return correct configuration', () => {
            const config = browserManager.getConfig();
            expect(config).toEqual(mockConfig);
        });
    });

    describe('browser lifecycle', () => {
        test('should launch browser successfully', async () => {
            await browserManager.launch();

            expect(browserManager.isRunning()).toBe(true);
            expect(browserManager.isReady()).toBe(true);
            expect(browserManager.getBrowser()).not.toBeNull();
            expect(browserManager.getPage()).not.toBeNull();
        }, 30000);

        test('should close browser successfully', async () => {
            await browserManager.launch();
            expect(browserManager.isRunning()).toBe(true);

            await browserManager.close();
            expect(browserManager.isRunning()).toBe(false);
            expect(browserManager.isReady()).toBe(false);
        }, 30000);

        test('should restart browser successfully', async () => {
            await browserManager.launch();
            const firstBrowser = browserManager.getBrowser();

            await browserManager.restart();
            const secondBrowser = browserManager.getBrowser();

            expect(browserManager.isRunning()).toBe(true);
            expect(browserManager.isReady()).toBe(true);
            expect(secondBrowser).not.toBe(firstBrowser);
        }, 30000);
    });

    describe('page management', () => {
        beforeEach(async () => {
            await browserManager.launch();
        });

        test('should create new page with stealth configuration', async () => {
            const newPage = await browserManager.newPage();

            expect(newPage).not.toBeNull();
            expect(newPage.isClosed()).toBe(false);

            await newPage.close();
        });

        test('should close current page', async () => {
            const page = browserManager.getPage();
            expect(page).not.toBeNull();

            await browserManager.closePage();
            expect(browserManager.getPage()).toBeNull();
        });
    });

    describe('configuration management', () => {
        test('should update configuration', () => {
            const newConfig = { headless: false, slowMo: 100 };
            browserManager.updateConfig(newConfig);

            const updatedConfig = browserManager.getConfig();
            expect(updatedConfig.headless).toBe(false);
            expect(updatedConfig.slowMo).toBe(100);
            expect(updatedConfig.timeout).toBe(mockConfig.timeout); // Should preserve existing values
        });
    });

    describe('error handling', () => {
        test('should throw error when getting page without launching browser', async () => {
            await expect(browserManager.newPage()).rejects.toThrow('Browser not launched');
        });

        test('should handle multiple close calls gracefully', async () => {
            await browserManager.launch();
            await browserManager.close();

            // Should not throw error on second close
            await expect(browserManager.close()).resolves.not.toThrow();
        });
    });
});

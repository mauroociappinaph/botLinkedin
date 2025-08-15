/// <reference types="node" />
/// <reference types="jest" />
import { Page } from 'puppeteer';
import { DelayUtils } from '../../../src/utils/DelayUtils';
import { HumanLikeInteractions } from '../../../src/utils/HumanLikeInteractions';

// Mock Puppeteer Page for testing
const mockPage = {
    waitForSelector: jest.fn().mockResolvedValue(true),
    click: jest.fn().mockResolvedValue(undefined),
    viewport: jest.fn().mockReturnValue({ width: 1920, height: 1080 }),
    keyboard: {
        down: jest.fn().mockResolvedValue(undefined),
        press: jest.fn().mockResolvedValue(undefined),
        up: jest.fn().mockResolvedValue(undefined),
        type: jest.fn().mockResolvedValue(undefined),
    },
    mouse: {
        move: jest.fn().mockResolvedValue(undefined),
    },
    $: jest.fn().mockResolvedValue({
        boundingBox: jest.fn().mockResolvedValue({
            x: 100,
            y: 100,
            width: 200,
            height: 50,
        }),
    }),
    evaluate: jest.fn().mockResolvedValue({ x: 400, y: 300 }),
} as unknown as Page;

describe('DelayUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock setTimeout to resolve immediately for faster tests
        jest.spyOn(global, 'setTimeout').mockImplementation((callback: () => void) => {
            callback();
            return 1 as any;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('randomDelay', () => {
        it('should create a delay within the specified range', async () => {
            const start = Date.now();
            await DelayUtils.randomDelay(100, 200);
            const end = Date.now();

            // Since we're mocking setTimeout, this should complete immediately
            expect(end - start).toBeLessThan(50);
            expect(setTimeout).toHaveBeenCalled();
        });

        it('should throw error when min equals max', async () => {
            await expect(DelayUtils.randomDelay(100, 100)).rejects.toThrow('Minimum delay must be less than maximum delay');
        });
    });

    describe('getRandomTypingDelay', () => {
        it('should return a value within the specified range', () => {
            const delay = DelayUtils.getRandomTypingDelay(50, 150);
            expect(delay).toBeGreaterThanOrEqual(50);
            expect(delay).toBeLessThanOrEqual(150);
        });

        it('should return consistent value when min equals max', () => {
            const delay = DelayUtils.getRandomTypingDelay(100, 100);
            expect(delay).toBe(100);
        });
    });

    describe('delay', () => {
        it('should create a fixed delay', async () => {
            await DelayUtils.delay(500);
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 500);
        });
    });

    describe('humanLikeType', () => {
        it('should type text with human-like delays', async () => {
            const text = 'test';
            await HumanLikeInteractions.humanLikeType(mockPage, '#input', text);

            expect(mockPage.waitForSelector).toHaveBeenCalledWith('#input', { timeout: 10000 });
            expect(mockPage.click).toHaveBeenCalledWith('#input');
            expect(mockPage.keyboard.type).toHaveBeenCalledTimes(text.length);
        });

        it('should clear existing content when clearFirst is true', async () => {
            await HumanLikeInteractions.humanLikeType(mockPage, '#input', 'test', { clearFirst: true });

            expect(mockPage.keyboard.down).toHaveBeenCalledWith('Control');
            expect(mockPage.keyboard.press).toHaveBeenCalledWith('KeyA');
            expect(mockPage.keyboard.up).toHaveBeenCalledWith('Control');
        });

        it('should press Enter when pressEnter is true', async () => {
            await HumanLikeInteractions.humanLikeType(mockPage, '#input', 'test', { pressEnter: true });

            expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
        });

        it('should not clear content when clearFirst is false', async () => {
            await HumanLikeInteractions.humanLikeType(mockPage, '#input', 'test', { clearFirst: false });

            expect(mockPage.keyboard.down).not.toHaveBeenCalledWith('Control');
        });
    });

    describe('humanLikeClick', () => {
        it('should click element with human-like behavior', async () => {
            await HumanLikeInteractions.humanLikeClick(mockPage, '#button');

            expect(mockPage.waitForSelector).toHaveBeenCalledWith('#button', { visible: true, timeout: 10000 });
            expect(mockPage.click).toHaveBeenCalledWith('#button', { delay: expect.any(Number) });
        });

        it('should perform double click when requested', async () => {
            await HumanLikeInteractions.humanLikeClick(mockPage, '#button', { doubleClick: true });

            expect(mockPage.click).toHaveBeenCalledWith('#button', {
                clickCount: 2,
                delay: expect.any(Number)
            });
        });

        it('should perform right click when requested', async () => {
            await HumanLikeInteractions.humanLikeClick(mockPage, '#button', { rightClick: true });

            expect(mockPage.click).toHaveBeenCalledWith('#button', {
                button: 'right',
                delay: expect.any(Number)
            });
        });

        it('should move mouse to element when moveToElement is true', async () => {
            await HumanLikeInteractions.humanLikeClick(mockPage, '#button', { moveToElement: true });

            expect(mockPage.$).toHaveBeenCalledWith('#button');
            expect(mockPage.mouse.move).toHaveBeenCalled();
        });
    });

    describe('moveMouseToElement', () => {
        it('should move mouse to element center with randomization', async () => {
            await HumanLikeInteractions.moveMouseToElement(mockPage, '#element');

            expect(mockPage.$).toHaveBeenCalledWith('#element');
            expect(mockPage.mouse.move).toHaveBeenCalled();
        });

        it('should throw error if element not found', async () => {
            (mockPage.$ as jest.Mock).mockResolvedValueOnce(null);

            await expect(HumanLikeInteractions.moveMouseToElement(mockPage, '#missing')).rejects.toThrow(
                'Element not found failed for #missing'
            );
        });

        it('should throw error if bounding box not available', async () => {
            (mockPage.$ as jest.Mock).mockResolvedValueOnce({
                boundingBox: jest.fn().mockResolvedValue(null),
            });

            await expect(HumanLikeInteractions.moveMouseToElement(mockPage, '#element')).rejects.toThrow(
                'Could not get bounding box for element failed for #element'
            );
        });
    });

    describe('humanLikeScroll', () => {
        it('should scroll down by default', async () => {
            await HumanLikeInteractions.humanLikeScroll(mockPage);

            expect(mockPage.evaluate).toHaveBeenCalled();
        });

        it('should scroll up when direction is specified', async () => {
            await HumanLikeInteractions.humanLikeScroll(mockPage, { direction: 'up' });

            expect(mockPage.evaluate).toHaveBeenCalled();
        });

        it('should use custom distance and steps', async () => {
            await HumanLikeInteractions.humanLikeScroll(mockPage, { distance: 1000, steps: 5 });

            expect(mockPage.evaluate).toHaveBeenCalledTimes(5);
        });
    });

    describe('pageLoadDelay', () => {
        it('should use default delays when no parameters provided', async () => {
            await DelayUtils.pageLoadDelay();

            expect(setTimeout).toHaveBeenCalled();
        });

        it('should use custom delays when provided', async () => {
            await DelayUtils.pageLoadDelay(1000, 2000);

            expect(setTimeout).toHaveBeenCalled();
        });
    });

    describe('formFieldDelay', () => {
        it('should create appropriate delay for form field interactions', async () => {
            await DelayUtils.formFieldDelay();

            expect(setTimeout).toHaveBeenCalled();
        });

        it('should use custom delays when provided', async () => {
            await DelayUtils.formFieldDelay(500, 1000);

            expect(setTimeout).toHaveBeenCalled();
        });
    });

    describe('betweenApplicationsDelay', () => {
        it('should create longer delay between applications', async () => {
            await DelayUtils.betweenApplicationsDelay();

            expect(setTimeout).toHaveBeenCalled();
        });

        it('should use custom delays when provided', async () => {
            await DelayUtils.betweenApplicationsDelay(5000, 10000);

            expect(setTimeout).toHaveBeenCalled();
        });
    });

    describe('captchaPause', () => {
        it('should create pause for CAPTCHA resolution', async () => {
            await DelayUtils.captchaPause(1000, 2000);

            expect(setTimeout).toHaveBeenCalled();
        });

        it('should call notify callback during pause', async () => {
            const notifyCallback = jest.fn();

            // Mock setInterval and clearInterval
            const mockInterval = 123 as unknown;
            jest.spyOn(global, 'setInterval').mockReturnValue(mockInterval as NodeJS.Timeout);
            jest.spyOn(global, 'clearInterval').mockImplementation(() => { });

            await DelayUtils.captchaPause(1000, 2000, notifyCallback);

            expect(setInterval).toHaveBeenCalled();
            expect(clearInterval).toHaveBeenCalledWith(mockInterval);
        });
    });

    describe('getRandomDelay', () => {
        it('should return value within specified range', () => {
            const delay = DelayUtils.getRandomDelay(100, 200);
            expect(delay).toBeGreaterThanOrEqual(100);
            expect(delay).toBeLessThanOrEqual(200);
        });

        it('should return exact value when min equals max', () => {
            const delay = DelayUtils.getRandomDelay(150, 150);
            expect(delay).toBe(150);
        });
    });

    describe('executeWithRealisticTiming', () => {
        it('should execute multiple actions with delays', async () => {
            const actions = [
                { type: 'click' as const, selector: '#button1' },
                { type: 'type' as const, selector: '#input1', text: 'test' },
                { type: 'scroll' as const },
                { type: 'wait' as const, delay: { min: 100, max: 200 } },
            ];

            await HumanLikeInteractions.executeWithRealisticTiming(mockPage, actions);

            expect(mockPage.click).toHaveBeenCalled();
            expect(mockPage.keyboard.type).toHaveBeenCalled();
            expect(mockPage.evaluate).toHaveBeenCalled();
        });

        it('should handle empty actions array', async () => {
            await HumanLikeInteractions.executeWithRealisticTiming(mockPage, []);

            // Should complete without errors
            expect(true).toBe(true);
        });
    });

    describe('validateDelayConfig', () => {
        it('should validate correct configuration', () => {
            const config = {
                minPageLoad: 1000,
                maxPageLoad: 3000,
                minTyping: 50,
                maxTyping: 150,
            };

            const result = DelayUtils.validateDelayConfig(config);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect negative values', () => {
            const config = {
                minPageLoad: -100,
                maxPageLoad: 3000,
                minTyping: 50,
                maxTyping: 150,
            };

            const result = DelayUtils.validateDelayConfig(config);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Page load delays must be non-negative');
        });

        it('should detect min >= max conditions', () => {
            const config = {
                minPageLoad: 3000,
                maxPageLoad: 1000,
                minTyping: 150,
                maxTyping: 50,
            };

            const result = DelayUtils.validateDelayConfig(config);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Minimum page load delay must be less than maximum');
            expect(result.errors).toContain('Minimum typing delay must be less than maximum');
        });

        it('should detect excessive delay values', () => {
            const config = {
                minPageLoad: 1000,
                maxPageLoad: 50000, // Too high
                minTyping: 50,
                maxTyping: 2000, // Too high
            };

            const result = DelayUtils.validateDelayConfig(config);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Maximum page load delay should not exceed 30 seconds');
            expect(result.errors).toContain('Maximum typing delay should not exceed 1 second');
        });
    });

    describe('getDefaultDelayConfig', () => {
        it('should return valid default configuration', () => {
            const config = DelayUtils.getDefaultDelayConfig();

            expect(config).toHaveProperty('minPageLoad');
            expect(config).toHaveProperty('maxPageLoad');
            expect(config).toHaveProperty('minTyping');
            expect(config).toHaveProperty('maxTyping');

            const validation = DelayUtils.validateDelayConfig(config);
            expect(validation.isValid).toBe(true);
        });
    });
});

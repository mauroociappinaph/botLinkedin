/// <reference types="node" />
/// <reference types="jest" />
import { Page } from 'puppeteer';
import { HumanLikeInteractions } from '../../../src/utils/HumanLikeInteractions';
import { MockPageBuilder, TEST_CONSTANTS, TimerMockUtils } from '../../utils/MockPageBuilder';

describe('HumanLikeInteractions', () => {
    let mockPage: Page;

    beforeEach(() => {
        jest.clearAllMocks();
        TimerMockUtils.setupTimeoutMock();
        mockPage = new MockPageBuilder().build();
    });

    afterEach(() => {
        TimerMockUtils.restoreAllTimers();
    });

    describe('humanLikeType', () => {
        it('should type text with human-like delays', async () => {
            const text = 'test';
            await HumanLikeInteractions.humanLikeType(mockPage, '#input', text);

            expect(mockPage.waitForSelector).toHaveBeenCalledWith('#input', { timeout: TEST_CONSTANTS.DEFAULT_TIMEOUT });
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

            expect(mockPage.waitForSelector).toHaveBeenCalledWith('#button', { visible: true, timeout: TEST_CONSTANTS.DEFAULT_TIMEOUT });
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
            const pageWithNoElement = new MockPageBuilder().withElementNotFound().build();

            await expect(HumanLikeInteractions.moveMouseToElement(pageWithNoElement, '#missing')).rejects.toThrow(
                'Element not found failed for #missing'
            );
        });

        it('should throw error if bounding box not available', async () => {
            const pageWithNoBoundingBox = new MockPageBuilder().withNoBoundingBox().build();

            await expect(HumanLikeInteractions.moveMouseToElement(pageWithNoBoundingBox, '#element')).rejects.toThrow(
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
});

/// <reference types="node" />
/// <reference types="jest" />
import { Keyboard, Mouse, Page } from 'puppeteer';

// Test constants
export const TEST_CONSTANTS = {
    VIEWPORT: { width: 1920, height: 1080 },
    ELEMENT_BOUNDS: { x: 100, y: 100, width: 200, height: 50 },
    MOUSE_POSITION: { x: 400, y: 300 },
    TIMEOUT_THRESHOLD: 50,
    DEFAULT_TIMEOUT: 10000,
} as const;

// Mock builder for flexible page mock creation
export class MockPageBuilder {
    private mockPage: jest.Mocked<Partial<Page>>;

    constructor() {
        this.mockPage = {
            waitForSelector: jest.fn().mockResolvedValue(true),
            click: jest.fn().mockResolvedValue(undefined),
            viewport: jest.fn().mockReturnValue(TEST_CONSTANTS.VIEWPORT),
            keyboard: this.createMockKeyboard(),
            mouse: this.createMockMouse(),
            $: jest.fn().mockResolvedValue({
                boundingBox: jest.fn().mockResolvedValue(TEST_CONSTANTS.ELEMENT_BOUNDS),
            }),
            evaluate: jest.fn().mockResolvedValue(TEST_CONSTANTS.MOUSE_POSITION),
        };
    }

    private createMockKeyboard(): jest.Mocked<Keyboard> {
        return {
            down: jest.fn().mockResolvedValue(undefined),
            press: jest.fn().mockResolvedValue(undefined),
            up: jest.fn().mockResolvedValue(undefined),
            type: jest.fn().mockResolvedValue(undefined),
            sendCharacter: jest.fn().mockResolvedValue(undefined),
        } as jest.Mocked<Keyboard>;
    }

    private createMockMouse(): jest.Mocked<Mouse> {
        return {
            move: jest.fn().mockResolvedValue(undefined),
            click: jest.fn().mockResolvedValue(undefined),
            down: jest.fn().mockResolvedValue(undefined),
            up: jest.fn().mockResolvedValue(undefined),
            wheel: jest.fn().mockResolvedValue(undefined),
            drag: jest.fn().mockResolvedValue(undefined),
            dragAndDrop: jest.fn().mockResolvedValue(undefined),
            dragOver: jest.fn().mockResolvedValue(undefined),
            dragEnter: jest.fn().mockResolvedValue(undefined),
            drop: jest.fn().mockResolvedValue(undefined),
            reset: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<Mouse>;
    }

    withElementNotFound(): this {
        this.mockPage.$ = jest.fn().mockResolvedValue(null);
        return this;
    }

    withNoBoundingBox(): this {
        this.mockPage.$ = jest.fn().mockResolvedValue({
            boundingBox: jest.fn().mockResolvedValue(null),
        });
        return this;
    }

    withCustomEvaluate<T>(result: T): this {
        this.mockPage.evaluate = jest.fn().mockResolvedValue(result);
        return this;
    }

    build(): Page {
        return this.mockPage as unknown as Page;
    }
}

// Timer mock utilities
export class TimerMockUtils {
    static setupTimeoutMock(): void {
        jest.spyOn(global, 'setTimeout').mockImplementation((callback: () => void) => {
            callback();
            return 1 as unknown as NodeJS.Timeout;
        });
    }

    static setupIntervalMock(): { mockInterval: NodeJS.Timeout; clearIntervalSpy: jest.SpyInstance } {
        const mockInterval = 123 as unknown as NodeJS.Timeout;
        jest.spyOn(global, 'setInterval').mockReturnValue(mockInterval);
        const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => { });

        return { mockInterval, clearIntervalSpy };
    }

    static restoreAllTimers(): void {
        jest.restoreAllMocks();
    }
}

# Test Utilities

This directory contains shared test utilities and mock builders for the LinkedIn Job Bot test suite.

## MockPageBuilder

A flexible builder pattern for creating Puppeteer Page mocks with consistent behavior across tests.

### Usage

```typescript
import { MockPageBuilder, TEST_CONSTANTS } from '../../utils/MockPageBuilder';

// Basic page mock
const mockPage = new MockPageBuilder().build();

// Page mock with element not found
const pageWithNoElement = new MockPageBuilder()
    .withElementNotFound()
    .build();

// Page mock with no bounding box
const pageWithNoBoundingBox = new MockPageBuilder()
    .withNoBoundingBox()
    .build();

// Page mock with custom evaluate result
const pageWithCustomResult = new MockPageBuilder()
    .withCustomEvaluate({ x: 500, y: 400 })
    .build();
```

### Features

- **Consistent Mocking**: All Page mocks have the same base structure
- **Flexible Configuration**: Builder pattern allows customization for specific test scenarios
- **Type Safety**: Properly typed mocks that satisfy Puppeteer's Page interface
- **Complete Mock Coverage**: Includes all necessary methods for keyboard, mouse, and page interactions

## TimerMockUtils

Utilities for mocking JavaScript timers in tests.

### Usage

```typescript
import { TimerMockUtils } from '../../utils/MockPageBuilder';

describe('MyComponent', () => {
    beforeEach(() => {
        TimerMockUtils.setupTimeoutMock();
    });

    afterEach(() => {
        TimerMockUtils.restoreAllTimers();
    });

    it('should handle intervals', () => {
        const { mockInterval, clearIntervalSpy } = TimerMockUtils.setupIntervalMock();

        // Your test code here

        expect(clearIntervalSpy).toHaveBeenCalledWith(mockInterval);
    });
});
```

## TEST_CONSTANTS

Shared constants used across test files to maintain consistency.

```typescript
export const TEST_CONSTANTS = {
    VIEWPORT: { width: 1920, height: 1080 },
    ELEMENT_BOUNDS: { x: 100, y: 100, width: 200, height: 50 },
    MOUSE_POSITION: { x: 400, y: 300 },
    TIMEOUT_THRESHOLD: 50,
    DEFAULT_TIMEOUT: 10000,
} as const;
```

## Test File Structure

The test suite is organized into focused, single-responsibility test files:

- `DelayUtils.test.ts` - Tests for delay and timing utilities
- `HumanLikeInteractions.test.ts` - Tests for human-like browser interactions
- `InteractionError.test.ts` - Tests for interaction error handling
- `InteractionValidator.test.ts` - Tests for interaction validation

## Best Practices

1. **Use Builder Pattern**: Leverage MockPageBuilder for consistent page mocks
2. **Extract Constants**: Use TEST_CONSTANTS for shared values
3. **Mock Timers Properly**: Use TimerMockUtils for consistent timer mocking
4. **Single Responsibility**: Keep test files focused on one class/module
5. **Type Safety**: Maintain proper TypeScript typing throughout tests

## Adding New Test Utilities

When adding new test utilities:

1. Add them to this directory
2. Export them from the appropriate file
3. Update this README with usage examples
4. Ensure proper TypeScript typing
5. Follow the established patterns for consistency

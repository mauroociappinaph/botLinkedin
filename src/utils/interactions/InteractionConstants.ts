/**
 * Constants for human-like interactions
 */
export class InteractionConstants {
    // Default retry configuration
    static readonly RETRY_CONFIG = {
        DEFAULT_RETRIES: 3,
        RETRY_DELAY: { min: 1000, max: 3000 },
        BACKOFF_MULTIPLIER: 1.5,
    } as const;

    // Interaction timing constants
    static readonly INTERACTION_DELAYS = {
        CLEAR_FIELD: { min: 50, max: 100 },
        PRE_ENTER: { min: 200, max: 500 },
        PRE_CLICK: { min: 100, max: 300 },
        POST_ACTION: { min: 200, max: 800 },
        DEFAULT_VIEWPORT: { width: 800, height: 600 },
        SCROLL_STEPS: { min: 2, max: 4 },
        DEFAULT_SCROLL_DISTANCE: 500,
        RANDOMIZATION_OFFSET: 20,
        MOUSE_STEPS_MIN: 3,
        MOUSE_STEPS_MAX: 7,
        MOUSE_MOVEMENT_VARIANCE: 0.5,
        PROGRESS_CALCULATION_BASE: 1,
    } as const;

    static readonly TIMEOUTS = {
        ELEMENT_WAIT: 10000,
    } as const;
}

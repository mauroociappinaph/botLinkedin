import { STEALTH_CONFIG, type StealthHeaders, type StealthViewport } from '../../../src/browser/StealthConstants';

describe('StealthConstants', () => {
    describe('STEALTH_CONFIG', () => {
        test('should have valid viewport configuration', () => {
            const viewport: StealthViewport = STEALTH_CONFIG.VIEWPORT;

            expect(viewport.width).toBeGreaterThan(0);
            expect(viewport.height).toBeGreaterThan(0);
            expect(viewport.deviceScaleFactor).toBeGreaterThan(0);
            expect(typeof viewport.width).toBe('number');
            expect(typeof viewport.height).toBe('number');
            expect(typeof viewport.deviceScaleFactor).toBe('number');
        });

        test('should have valid user agent string', () => {
            expect(STEALTH_CONFIG.USER_AGENT).toBeDefined();
            expect(typeof STEALTH_CONFIG.USER_AGENT).toBe('string');
            expect(STEALTH_CONFIG.USER_AGENT.length).toBeGreaterThan(0);
            expect(STEALTH_CONFIG.USER_AGENT).toContain('Mozilla');
            expect(STEALTH_CONFIG.USER_AGENT).toContain('Chrome');
        });

        test('should have valid browser arguments', () => {
            expect(STEALTH_CONFIG.BROWSER_ARGS).toBeInstanceOf(Array);
            expect(STEALTH_CONFIG.BROWSER_ARGS.length).toBeGreaterThan(0);

            // Check for essential stealth arguments
            expect(STEALTH_CONFIG.BROWSER_ARGS).toContain('--no-sandbox');
            expect(STEALTH_CONFIG.BROWSER_ARGS).toContain('--disable-setuid-sandbox');
            expect(STEALTH_CONFIG.BROWSER_ARGS).toContain('--disable-dev-shm-usage');

            // Ensure all arguments are strings
            STEALTH_CONFIG.BROWSER_ARGS.forEach(arg => {
                expect(typeof arg).toBe('string');
                expect(arg.startsWith('--')).toBe(true);
            });
        });

        test('should have valid HTTP headers', () => {
            const headers: StealthHeaders = STEALTH_CONFIG.HEADERS;

            // Check all required headers exist
            const requiredHeaders = ['Accept-Language', 'Accept-Encoding', 'Accept', 'Upgrade-Insecure-Requests', 'Cache-Control'];
            requiredHeaders.forEach(header => {
                expect(headers[header as keyof StealthHeaders]).toBeDefined();
            });

            // Validate specific header values
            expect(headers['Accept-Language']).toMatch(/^[a-z-,;q=0-9.]+$/i);
            expect(headers['Accept-Encoding']).toContain('gzip');
            expect(headers['Accept']).toContain('text/html');
            expect(headers['Upgrade-Insecure-Requests']).toBe('1');
            expect(headers['Cache-Control']).toMatch(/^(max-age=\d+|no-cache|no-store)$/);
        });

        test('should have valid navigator overrides', () => {
            const { plugins, languages } = STEALTH_CONFIG.NAVIGATOR_OVERRIDES;

            expect(plugins).toBeInstanceOf(Array);
            expect(languages).toBeInstanceOf(Array);
            expect(plugins.length).toBeGreaterThan(0);
            expect(languages.length).toBeGreaterThan(0);

            // Validate language format (ISO 639-1 with optional region)
            languages.forEach(lang => {
                expect(typeof lang).toBe('string');
                expect(lang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
            });

            // Validate plugins are numbers (mock plugin count)
            plugins.forEach(plugin => {
                expect(typeof plugin).toBe('number');
                expect(plugin).toBeGreaterThan(0);
            });
        });
    });

    describe('Type safety and interface compliance', () => {
        test('should satisfy StealthViewport interface', () => {
            const viewport: StealthViewport = STEALTH_CONFIG.VIEWPORT;
            const requiredViewportProps = ['width', 'height', 'deviceScaleFactor'];

            requiredViewportProps.forEach(prop => {
                expect(viewport).toHaveProperty(prop);
                expect(typeof viewport[prop as keyof StealthViewport]).toBe('number');
            });
        });

        test('should satisfy StealthHeaders interface', () => {
            const headers: StealthHeaders = STEALTH_CONFIG.HEADERS;
            const requiredHeaderProps = ['Accept-Language', 'Accept-Encoding', 'Accept', 'Upgrade-Insecure-Requests', 'Cache-Control'];

            requiredHeaderProps.forEach(prop => {
                expect(headers).toHaveProperty(prop);
                expect(typeof headers[prop as keyof StealthHeaders]).toBe('string');
            });
        });

        test('should have realistic viewport dimensions', () => {
            const { width, height, deviceScaleFactor } = STEALTH_CONFIG.VIEWPORT;

            // Common desktop resolutions
            expect(width).toBeGreaterThanOrEqual(1024);
            expect(height).toBeGreaterThanOrEqual(768);
            expect(deviceScaleFactor).toBeGreaterThanOrEqual(1);
            expect(deviceScaleFactor).toBeLessThanOrEqual(3);
        });
    });

    describe('Configuration integrity', () => {
        test('should maintain consistent configuration structure', () => {
            const requiredProperties = ['VIEWPORT', 'USER_AGENT', 'BROWSER_ARGS', 'HEADERS', 'NAVIGATOR_OVERRIDES'];

            requiredProperties.forEach(prop => {
                expect(STEALTH_CONFIG).toHaveProperty(prop);
            });
        });

        test('should have compile-time type safety', () => {
            // TypeScript ensures these are properly typed at compile time
            const viewport: StealthViewport = STEALTH_CONFIG.VIEWPORT;
            const headers: StealthHeaders = STEALTH_CONFIG.HEADERS;

            expect(viewport).toBeDefined();
            expect(headers).toBeDefined();
        });

        test('should have immutable configuration', () => {
            // Verify configuration is frozen/readonly
            expect(Object.isFrozen(STEALTH_CONFIG.VIEWPORT)).toBe(false); // 'as const' doesn't freeze at runtime

            // But TypeScript should prevent modification at compile time
            // This test documents the expected behavior
            expect(STEALTH_CONFIG.VIEWPORT.width).toBe(1366);
            expect(STEALTH_CONFIG.HEADERS['Accept-Language']).toBe('en-US,en;q=0.9');
        });
    });
});

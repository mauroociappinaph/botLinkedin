/**
 * Constants for stealth browser configuration
 * Centralizes all stealth-related configuration values
 */

export interface StealthViewport {
  width: number;
  height: number;
  deviceScaleFactor: number;
}

export interface StealthHeaders {
  'Accept-Language': string;
  'Accept-Encoding': string;
  Accept: string;
  'Upgrade-Insecure-Requests': string;
  'Cache-Control': string;
}

export const STEALTH_CONFIG = {
  VIEWPORT: {
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
  } as const satisfies StealthViewport,

  USER_AGENT:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' as const,

  BROWSER_ARGS: [
    // Security and sandbox
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',

    // Performance optimizations
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',

    // Automation detection avoidance
    '--no-first-run',
    '--no-zygote',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection',
    '--disable-features=VizDisplayCompositor',
  ] as const,

  HEADERS: {
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
  } as const satisfies StealthHeaders,

  NAVIGATOR_OVERRIDES: {
    plugins: [1, 2, 3, 4, 5], // Mock plugin array to appear more realistic
    languages: ['en-US', 'en'], // Standard language preferences
  } as const,
} as const;

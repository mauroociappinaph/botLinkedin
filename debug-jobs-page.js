const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Add stealth plugin
puppeteerExtra.use(StealthPlugin());

/**
 * Configuration constants for the LinkedIn debug tool
 */
const CONFIG = {
  TIMEOUTS: {
    PAGE_LOAD: 30000,
    ELEMENT_WAIT: 2000,
    LOGIN_CHECK: 2000,
    PAGE_SETTLE: 3000
  },
  BROWSER: {
    HEADLESS: false,
    SLOW_MO: 100,
    ARGS: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  },
  FILES: {
    COOKIES: './cookies.json',
    SCREENSHOT: 'jobs-page-debug.png'
  },
  URLS: {
    LINKEDIN_JOBS: 'https://www.linkedin.com/jobs/'
  }
};

/**
 * Selectors for different LinkedIn elements
 */
const SELECTORS = {
  SEARCH_INPUT: [
    'input[aria-label="Search by title, skill, or company"]',
    'input[placeholder*="Search"]',
    'input[name="keywords"]',
    '.jobs-search-box__text-input input',
    '.search-global-typeahead__input',
    'input[data-test-id="jobs-search-box-keyword-id-ember"]',
    '.jobs-search-box__text-input',
    'input[placeholder="Search jobs"]',
    '.jobs-search-box input',
    '.search-jobs-typeahead input',
    'input[placeholder*="title"]',
    'input[placeholder*="skill"]',
    'input[placeholder*="company"]',
    '.jobs-search-box input[type="text"]',
    '.search-typeahead input',
    'input.jobs-search-box__text-input',
    '[data-test-id*="search"] input',
    '.artdeco-typeahead__input'
  ],
  LOCATION_INPUT: [
    'input[aria-label="City, state, zip code, or \\"remote\\""]',
    'input[placeholder*="location"]',
    'input[name="location"]',
    'input[data-test-id="jobs-search-box-location-id-ember"]',
    'input[placeholder="City, state, or zip code"]',
    '.jobs-search-box input[placeholder*="City"]'
  ],
  LOGIN_INDICATORS: [
    'nav[aria-label="Primary Navigation"]',
    '.global-nav__me',
    '.feed-identity-module',
    '[data-test-global-nav-me]'
  ],
  PAGE_STRUCTURE: [
    '.jobs-search-box',
    '.search-container',
    '[data-test-id*="jobs-search"]'
  ]
};

/**
 * Logger utility for consistent output formatting
 */
class DebugLogger {
  static info(message, data = null) {
    console.log(`ℹ️  ${message}`);
    if (data) console.log(data);
  }

  static success(message) {
    console.log(`✅ ${message}`);
  }

  static warning(message) {
    console.log(`⚠️  ${message}`);
  }

  static error(message, error = null) {
    console.error(`❌ ${message}`);
    if (error) console.error(error);
  }

  static section(title) {
    console.log(`\n🔍 ${title}`);
  }
}

/**
 * Session management utilities
 */
class SessionManager {
  /**
   * Load existing session cookies if available
   * @param {import('puppeteer').Page} page - Puppeteer page instance
   * @returns {Promise<boolean>} - True if session was loaded
   */
  static async loadSession(page) {
    try {
      if (!fs.existsSync(CONFIG.FILES.COOKIES)) {
        return false;
      }

      DebugLogger.info('Loading saved session...');
      const cookiesData = fs.readFileSync(CONFIG.FILES.COOKIES, 'utf-8');
      const sessionData = JSON.parse(cookiesData);

      if (sessionData.cookies && Array.isArray(sessionData.cookies)) {
        for (const cookie of sessionData.cookies) {
          await page.setCookie(cookie);
        }
        return true;
      }
      return false;
    } catch (error) {
      DebugLogger.warning('Failed to load session, continuing without saved cookies');
      return false;
    }
  }

  /**
   * Check if user is logged into LinkedIn
   * @param {import('puppeteer').Page} page - Puppeteer page instance
   * @returns {Promise<boolean>} - True if logged in
   */
  static async checkLoginStatus(page) {
    // Check for login indicator elements
    for (const selector of SELECTORS.LOGIN_INDICATORS) {
      try {
        await page.waitForSelector(selector, { timeout: CONFIG.TIMEOUTS.LOGIN_CHECK });
        return true;
      } catch {
        // Continue checking other selectors
      }
    }

    // Check URL patterns as fallback
    const currentUrl = page.url();
    const loggedInUrls = ['linkedin.com/feed', 'linkedin.com/in/', 'linkedin.com/jobs'];
    return loggedInUrls.some(url => currentUrl.includes(url)) && !currentUrl.includes('/login');
  }
}

/**
 * Element detection utilities
 */
class ElementDetector {
  /**
   * Find and analyze elements using provided selectors
   * @param {import('puppeteer').Page} page - Puppeteer page instance
   * @param {string[]} selectors - Array of CSS selectors to check
   * @param {string} elementType - Description of element type for logging
   * @returns {Promise<boolean>} - True if any element was found
   */
  static async findElements(page, selectors, elementType) {
    let foundElement = false;

    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          DebugLogger.success(`Found ${elementType}: ${selector}`);
          foundElement = true;

          // Get detailed element information
          const details = await this.getElementDetails(page, element);
          this.logElementDetails(details);
        }
      } catch (error) {
        // Continue checking other selectors
      }
    }

    if (!foundElement) {
      DebugLogger.error(`No ${elementType} found with known selectors`);
    }

    return foundElement;
  }

  /**
   * Get detailed information about an element
   * @param {import('puppeteer').Page} page - Puppeteer page instance
   * @param {import('puppeteer').ElementHandle} element - Element to analyze
   * @returns {Promise<Object>} - Element details
   */
  static async getElementDetails(page, element) {
    return await page.evaluate(el => ({
      placeholder: el.placeholder || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      className: el.className || '',
      id: el.id || '',
      name: el.name || '',
      type: el.type || ''
    }), element);
  }

  /**
   * Log element details in a formatted way
   * @param {Object} details - Element details object
   */
  static logElementDetails(details) {
    if (details.placeholder) console.log(`   - Placeholder: "${details.placeholder}"`);
    if (details.ariaLabel) console.log(`   - Aria-label: "${details.ariaLabel}"`);
    if (details.className) console.log(`   - Class: "${details.className}"`);
    if (details.id) console.log(`   - ID: "${details.id}"`);
    if (details.name) console.log(`   - Name: "${details.name}"`);
    if (details.type) console.log(`   - Type: "${details.type}"`);
  }

  /**
   * Analyze all input elements on the page
   * @param {import('puppeteer').Page} page - Puppeteer page instance
   */
  static async analyzeAllInputs(page) {
    try {
      DebugLogger.section('Analyzing all input elements on the page...');

      const allInputs = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(input => ({
          type: input.type,
          placeholder: input.placeholder,
          ariaLabel: input.getAttribute('aria-label'),
          className: input.className,
          id: input.id,
          name: input.name
        }));
      });

      DebugLogger.info('All input elements found:');
      allInputs.forEach((input, index) => {
        console.log(`${index + 1}. Type: ${input.type}, Placeholder: "${input.placeholder}", Aria-label: "${input.ariaLabel}", Class: "${input.className}", ID: "${input.id}", Name: "${input.name}"`);
      });
    } catch (error) {
      DebugLogger.error('Failed to analyze input elements', error);
    }
  }
}

/**
 * Page analysis utilities
 */
class PageAnalyzer {
  /**
   * Take a screenshot for debugging purposes
   * @param {import('puppeteer').Page} page - Puppeteer page instance
   */
  static async takeScreenshot(page) {
    try {
      await page.screenshot({ path: CONFIG.FILES.SCREENSHOT, fullPage: true });
      DebugLogger.success(`Screenshot saved as ${CONFIG.FILES.SCREENSHOT}`);
    } catch (error) {
      DebugLogger.error('Failed to take screenshot', error);
    }
  }

  /**
   * Log basic page information
   * @param {import('puppeteer').Page} page - Puppeteer page instance
   */
  static async logPageInfo(page) {
    try {
      const url = page.url();
      const title = await page.title();

      DebugLogger.info(`Current URL: ${url}`);
      DebugLogger.info(`Page title: ${title}`);
    } catch (error) {
      DebugLogger.error('Failed to get page information', error);
    }
  }

  /**
   * Analyze page structure elements
   * @param {import('puppeteer').Page} page - Puppeteer page instance
   */
  static async analyzePageStructure(page) {
    DebugLogger.section('Analyzing page structure...');

    const structureChecks = [
      { selector: '.jobs-search-box', name: 'Jobs search box' },
      { selector: '.search-container', name: 'Search container' },
      { selector: '[data-test-id*="jobs-search"]', name: 'Jobs search element' }
    ];

    for (const check of structureChecks) {
      try {
        const element = await page.$(check.selector);
        const status = element ? '✅ Found' : '❌ Not found';
        console.log(`${check.name}: ${status}`);
      } catch (error) {
        console.log(`${check.name}: ❌ Error checking`);
      }
    }
  }
}

/**
 * Handle the case when user is not logged in
 */
async function handleLoginRequired() {
  DebugLogger.warning('Not logged in. Please log in manually and run the script again.');
  DebugLogger.info('Keeping browser open for manual login...');
  await new Promise(() => {}); // Keep open indefinitely
}

/**
 * Analyze search-related elements on the page
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 */
async function analyzeSearchElements(page) {
  // Check for search input elements
  DebugLogger.section('Checking for search input elements...');
  const foundSearchInput = await ElementDetector.findElements(
    page,
    SELECTORS.SEARCH_INPUT,
    'search input'
  );

  if (!foundSearchInput) {
    await ElementDetector.analyzeAllInputs(page);
  }

  // Check for location input elements
  DebugLogger.section('Checking for location input elements...');
  await ElementDetector.findElements(
    page,
    SELECTORS.LOCATION_INPUT,
    'location input'
  );
}

/**
 * Keep browser open for manual inspection
 */
async function keepBrowserOpen() {
  DebugLogger.info('Keeping browser open for manual inspection...');
  DebugLogger.info('Press Ctrl+C to close when done');
  await new Promise(() => {}); // Keep open indefinitely
}

/**
 * Main debugging function with improved structure and error handling
 */
async function debugJobsPage() {
  DebugLogger.info('Debugging LinkedIn Jobs Page Structure...');

  let browser;
  let page;

  try {
    // Launch browser with configuration
    browser = await puppeteerExtra.launch({
      headless: CONFIG.BROWSER.HEADLESS,
      slowMo: CONFIG.BROWSER.SLOW_MO,
      args: CONFIG.BROWSER.ARGS
    });

    page = await browser.newPage();

    // Load existing session
    await SessionManager.loadSession(page);

    // Navigate to LinkedIn jobs page
    DebugLogger.info('Navigating to LinkedIn jobs page...');
    await page.goto(CONFIG.URLS.LINKEDIN_JOBS, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.TIMEOUTS.PAGE_LOAD
    });

    // Wait for page to settle
    await new Promise(resolve => setTimeout(resolve, CONFIG.TIMEOUTS.PAGE_SETTLE));

    // Log basic page information
    await PageAnalyzer.logPageInfo(page);

    // Check login status
    const isLoggedIn = await SessionManager.checkLoginStatus(page);
    const loginStatus = isLoggedIn ? '✅ Logged in' : '❌ Not logged in';
    DebugLogger.info(`Login status: ${loginStatus}`);

    if (!isLoggedIn) {
      await handleLoginRequired();
      return;
    }

    // Take screenshot for analysis
    await PageAnalyzer.takeScreenshot(page);

    // Analyze search elements
    await analyzeSearchElements(page);

    // Analyze page structure
    await PageAnalyzer.analyzePageStructure(page);

    // Keep browser open for manual inspection
    await keepBrowserOpen();

  } catch (error) {
    DebugLogger.error('Error during debugging:', error);
  } finally {
    // Cleanup is handled by process signals
  }
}

// Legacy function for backward compatibility
async function checkLoginStatus(page) {
  return SessionManager.checkLoginStatus(page);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  DebugLogger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  DebugLogger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the debugging process
debugJobsPage().catch(console.error);

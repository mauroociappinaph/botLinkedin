/**
 * LinkedIn Debug Tool
 *
 * A comprehensive debugging tool for LinkedIn automation that:
 * - Tests login functionality with stealth measures
 * - Validates page structure and selectors
 * - Handles CAPTCHA and manual intervention scenarios
 * - Provides detailed logging and error reporting
 *
 * @author LinkedIn Job Bot
 * @version 1.0.0
 */

const puppeteer = require('puppeteer');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin
puppeteerExtra.use(StealthPlugin());

/**
 * Utility function for sleeping/delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Masks sensitive data for logging
 * @param {string} data - Data to mask
 * @returns {string} - Masked data
 */
const maskSensitiveData = (data) => {
  if (!data || data.length <= 4) return '***';
  return data.substring(0, 2) + '*'.repeat(data.length - 4) + data.substring(data.length - 2);
};

// Configuration constants
const CONFIG = {
  TIMEOUTS: {
    PAGE_LOAD: 30000,
    ELEMENT_WAIT: 2000,
    LOGIN_WAIT: 3000,
    SELECTOR_TIMEOUT: 2000
  },
  DELAYS: {
    FORM_FILL: 500,
    TYPING: 100,
    LOGIN_RESPONSE: 3000
  },
  SELECTORS: {
    USERNAME: [
      '#username',
      'input[name="session_key"]',
      'input[type="email"]',
      'input[autocomplete="username"]'
    ],
    PASSWORD: [
      '#password',
      'input[name="session_password"]',
      'input[type="password"]',
      'input[autocomplete="current-password"]'
    ],
    SEARCH: [
      'input[aria-label="Search by title, skill, or company"]',
      'input[placeholder*="Search"]',
      'input[name="keywords"]',
      '.jobs-search-box__text-input input',
      '.search-global-typeahead__input',
      'input[data-test-id="jobs-search-box-keyword-id-ember"]',
      '.jobs-search-box__text-input',
      'input[placeholder="Search jobs"]',
      '.jobs-search-box input',
      '.search-jobs-typeahead input'
    ],
    LOCATION: [
      'input[aria-label="City, state, zip code, or \\"remote\\""]',
      'input[placeholder*="location"]',
      'input[name="location"]',
      '.jobs-search-box__text-input input[placeholder*="location"]',
      'input[data-test-id="jobs-search-box-location-id-ember"]',
      'input[placeholder="City, state, or zip code"]',
      '.jobs-search-box input[placeholder*="City"]',
      '.search-jobs-typeahead input[placeholder*="location"]'
    ],
    ERRORS: [
      '.alert--error',
      '.form__input--error',
      '.login-form__error-message',
      '[data-test-id="error-message"]',
      '.error-message'
    ],
    LOGIN_SUCCESS: [
      'nav[aria-label="Primary Navigation"]',
      '.global-nav__me',
      '.feed-identity-module',
      '[data-test-global-nav-me]'
    ]
  },
  LOGIN_SUCCESS_URLS: [
    'linkedin.com/feed',
    'linkedin.com/in/',
    'linkedin.com/jobs'
  ],
  BROWSER_ARGS: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu'
  ]
};

/**
 * Checks if any element from the provided selectors exists on the page
 * @param {Object} page - Puppeteer page instance
 * @param {string[]} selectors - Array of CSS selectors to check
 * @param {string} elementType - Description of the element type for logging
 * @returns {Promise<boolean>} - True if element found, false otherwise
 */
async function findElement(page, selectors, elementType) {
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
      console.log(`✅ ${elementType} found: ${selector}`);
      return true;
    } catch (e) {
      console.log(`❌ ${elementType} not found: ${selector}`);
    }
  }
  return false;
}

/**
 * Takes a debug screenshot and logs the action
 * @param {Object} page - Puppeteer page instance
 * @param {string} filename - Screenshot filename
 */
async function takeDebugScreenshot(page, filename) {
  try {
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`📸 Screenshot saved as ${filename}`);
  } catch (error) {
    console.error(`❌ Failed to take screenshot: ${error.message}`);
  }
}

/**
 * Logs current page information for debugging
 * @param {Object} page - Puppeteer page instance
 */
async function logPageInfo(page) {
  try {
    console.log('Current page URL:', page.url());
    console.log('Page title:', await page.title());
  } catch (error) {
    console.error(`❌ Failed to get page info: ${error.message}`);
  }
}

/**
 * Checks for login form elements on the current page
 * @param {Object} page - Puppeteer page instance
 * @returns {Promise<{usernameFound: boolean, passwordFound: boolean}>}
 */
async function checkLoginElements(page) {
  console.log('📍 Step 2: Checking for login form elements...');

  const usernameFound = await findElement(page, CONFIG.SELECTORS.USERNAME, 'Username field');
  const passwordFound = await findElement(page, CONFIG.SELECTORS.PASSWORD, 'Password field');

  if (!usernameFound || !passwordFound) {
    console.log('❌ Login form elements not found. LinkedIn might have changed their structure.');
    await logPageInfo(page);
    await takeDebugScreenshot(page, 'linkedin-login-debug.png');
  }

  return { usernameFound, passwordFound };
}

/**
 * Checks for job search elements on the current page
 * @param {Object} page - Puppeteer page instance
 * @returns {Promise<{searchFound: boolean, locationFound: boolean}>}
 */
async function checkJobSearchElements(page) {
  console.log('📍 Step 4: Checking for job search elements...');

  const searchFound = await findElement(page, CONFIG.SELECTORS.SEARCH, 'Search input');
  const locationFound = await findElement(page, CONFIG.SELECTORS.LOCATION, 'Location input');

  if (!searchFound || !locationFound) {
    console.log('❌ Job search elements not found. LinkedIn might require login or changed their structure.');
    await logPageInfo(page);
    await takeDebugScreenshot(page, 'linkedin-jobs-debug.png');
  }

  return { searchFound, locationFound };
}

/**
 * Checks for error messages on the current page
 * @param {Object} page - Puppeteer page instance
 */
async function checkForErrors(page) {
  for (const selector of CONFIG.SELECTORS.ERRORS) {
    try {
      const errorElement = await page.$(selector);
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        console.log(`⚠️ Error message found: ${errorText}`);
      }
    } catch (e) {
      // Continue checking other selectors
    }
  }
}

/**
 * Checks page content and redirects
 * @param {Object} page - Puppeteer page instance
 */
async function checkPageContent(page) {
  console.log('📍 Step 5: Checking page content...');

  // Check if we're redirected to login
  const currentUrl = page.url();
  if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
    console.log('🔒 Page redirected to login/checkpoint - authentication required');
  }

  // Check for any error messages
  await checkForErrors(page);
}

/**
 * Sets up graceful shutdown handling
 * @param {Object} browser - Puppeteer browser instance
 */
function setupGracefulShutdown(browser) {
  const cleanup = async () => {
    console.log('\n🔄 Shutting down gracefully...');
    try {
      await browser.close();
      console.log('✅ Browser closed successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during cleanup:', error.message);
      process.exit(1);
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

/**
 * Attempts to login with credentials from .env file
 * @param {Object} page - Puppeteer page instance
 * @returns {Promise<boolean>} - True if login successful
 */
/**
 * Validates login credentials from environment
 * @returns {{email: string, password: string} | null} - Credentials or null if invalid
 */
function validateCredentials() {
  require('dotenv').config();
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    console.log('⚠️ LinkedIn credentials not found in .env file');
    console.log('Please add LINKEDIN_EMAIL and LINKEDIN_PASSWORD to your .env file');
    return null;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.log('⚠️ Invalid email format in .env file');
    return null;
  }

  return { email, password };
}

/**
 * Fills login form with credentials
 * @param {Object} page - Puppeteer page instance
 * @param {string} email - Email address
 * @param {string} password - Password
 * @returns {Promise<void>}
 */
async function fillLoginForm(page, email, password) {
  console.log(`🔑 Filling login form for: ${maskSensitiveData(email)}`);

  // Fill username
  await page.click('#username', { clickCount: 3 });
  await page.type('#username', email, { delay: CONFIG.DELAYS.TYPING });
  await sleep(CONFIG.DELAYS.FORM_FILL);

  // Fill password
  await page.click('#password', { clickCount: 3 });
  await page.type('#password', password, { delay: CONFIG.DELAYS.TYPING });
  await sleep(CONFIG.DELAYS.FORM_FILL);
}

async function attemptLogin(page) {
  console.log('📍 Step 3: Attempting login...');

  const credentials = validateCredentials();
  if (!credentials) {
    return false;
  }

  try {
    await fillLoginForm(page, credentials.email, credentials.password);

    // Submit form
    await page.click('button[type="submit"]');
    console.log('🔑 Login form submitted, waiting for response...');

    // Wait for navigation or login indicators
    await sleep(CONFIG.DELAYS.LOGIN_RESPONSE);

    // Check if login was successful
    const loginSuccess = await checkLoginSuccess(page);
    if (loginSuccess) {
      console.log('✅ Login successful!');
      return true;
    } else {
      console.log('❌ Login failed or requires manual intervention');
      await checkForErrors(page);
      return false;
    }

  } catch (error) {
    console.error('❌ Login attempt failed:', {
      message: error.message,
      stack: error.stack,
      url: page.url()
    });
    return false;
  }
}

/**
 * Checks if login was successful by looking for logged-in indicators
 * @param {Object} page - Puppeteer page instance
 * @returns {Promise<boolean>} - True if logged in
 */
async function checkLoginSuccess(page) {
  // Check for login success selectors
  for (const selector of CONFIG.SELECTORS.LOGIN_SUCCESS) {
    try {
      await page.waitForSelector(selector, { timeout: CONFIG.TIMEOUTS.SELECTOR_TIMEOUT });
      console.log(`✅ Login success indicator found: ${selector}`);
      return true;
    } catch {
      // Continue checking other selectors
    }
  }

  // Check URL patterns
  const currentUrl = page.url();
  const urlMatch = CONFIG.LOGIN_SUCCESS_URLS.some(url => currentUrl.includes(url));

  if (urlMatch) {
    console.log(`✅ Login success detected via URL: ${currentUrl}`);
    return true;
  }

  console.log(`❌ No login success indicators found. Current URL: ${currentUrl}`);
  return false;
}

/**
 * Main debug function for LinkedIn page structure analysis
 */
async function debugLinkedIn() {
  const startTime = Date.now();
  console.log('🔍 Starting LinkedIn Debug Session...');

  let browser;
  try {
    browser = await puppeteerExtra.launch({
      headless: false,
      slowMo: 100,
      args: CONFIG.BROWSER_ARGS
    });

    setupGracefulShutdown(browser);
    const page = await browser.newPage();

    // Step 1: Navigate to LinkedIn login
    console.log('📍 Step 1: Navigating to LinkedIn login...');
    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'networkidle2',
      timeout: CONFIG.TIMEOUTS.PAGE_LOAD
    });

    // Step 2: Check login elements
    await checkLoginElements(page);

    // Step 3: Attempt login
    const loginSuccess = await attemptLogin(page);

    if (!loginSuccess) {
      console.log('⚠️ Login failed. You may need to:');
      console.log('   1. Check your credentials in .env file');
      console.log('   2. Solve CAPTCHA manually if present');
      console.log('   3. Complete 2FA if required');
      console.log('🔄 Keeping browser open for manual login...');
      console.log('After logging in manually, the script will continue checking job search elements');

      // Wait for manual intervention
      console.log('Press Enter after you have logged in manually...');
      try {
        await waitForUserInput();
      } catch (inputError) {
        console.warn('⚠️ Input handling error:', inputError.message);
        console.log('Continuing with automated checks...');
      }
    }

    // Step 4: Navigate to jobs page
    console.log('📍 Step 4: Navigating to jobs page...');
    await page.goto('https://www.linkedin.com/jobs/', {
      waitUntil: 'networkidle2',
      timeout: CONFIG.TIMEOUTS.PAGE_LOAD
    });

    // Step 5: Check job search elements
    await checkJobSearchElements(page);

    // Step 6: Check page content
    await checkPageContent(page);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`✅ Debug session completed in ${duration}s`);
    console.log('🔄 Keeping browser open for manual inspection...');
    console.log('Press Ctrl+C to close when done');

    // Keep browser open for manual inspection with proper signal handling
    await new Promise((resolve) => {
      // This will be resolved by the signal handlers
      process.once('SIGINT', resolve);
      process.once('SIGTERM', resolve);
    });

  } catch (error) {
    console.error('❌ Debug session failed:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      url: browser ? 'Available in browser context' : 'Browser not available'
    });

    // Take screenshot if possible for debugging
    if (browser) {
      try {
        const pages = await browser.pages();
        if (pages.length > 0) {
          await pages[0].screenshot({
            path: `debug-error-${Date.now()}.png`,
            fullPage: true
          });
          console.log('📸 Error screenshot saved for debugging');
        }
      } catch (screenshotError) {
        console.warn('⚠️ Could not take error screenshot:', screenshotError.message);
      }
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log('✅ Browser closed successfully');
      } catch (closeError) {
        console.error('❌ Error closing browser:', closeError.message);
      }
    }
  }
}

/**
 * Waits for user input (Enter key) to continue
 * @returns {Promise<void>}
 */
async function waitForUserInput() {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let isResolved = false;

    const cleanup = () => {
      if (stdin.isTTY) {
        try {
          stdin.setRawMode(false);
        } catch (error) {
          console.warn('Warning: Could not reset raw mode:', error.message);
        }
      }
      stdin.pause();
      stdin.removeListener('data', onData);
      stdin.removeListener('error', onError);
    };

    const onData = (key) => {
      if (isResolved) return;

      if (key === '\r' || key === '\n' || key === '\u0003') { // Enter or Ctrl+C
        isResolved = true;
        cleanup();
        resolve();
      }
    };

    const onError = (error) => {
      if (isResolved) return;

      isResolved = true;
      cleanup();
      reject(error);
    };

    try {
      if (stdin.isTTY) {
        stdin.setRawMode(true);
      }
      stdin.resume();
      stdin.setEncoding('utf8');
      stdin.on('data', onData);
      stdin.on('error', onError);
    } catch (error) {
      reject(error);
    }

    // Timeout after 5 minutes
    setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        console.log('\n⏰ Input timeout reached, continuing...');
        resolve();
      }
    }, 300000);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

debugLinkedIn().catch((error) => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});

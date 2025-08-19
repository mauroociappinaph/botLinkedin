const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

// Configuration constants
const CONFIG = {
    LINKEDIN_JOBS_URL: 'https://www.linkedin.com/jobs/',
    SCREENSHOT_PATH: 'search-button-debug.png',
    BROWSER_OPTIONS: {
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    },
    SEARCH_KEYWORDS: ['search', 'buscar', 'submit']
};

/**
 * Extracts button information from the page
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @returns {Promise<Array>} Array of button information objects
 */
async function extractButtonInfo(page) {
    return await page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button'));
        return allButtons.map((button, index) => ({
            index: index + 1,
            text: button.textContent?.trim() || '',
            ariaLabel: button.getAttribute('aria-label') || '',
            className: button.className || '',
            id: button.id || '',
            type: button.type || '',
            disabled: button.disabled,
            visible: button.offsetParent !== null,
            selector: button.className
                ? `.${button.className.split(' ').join('.')}`
                : `button:nth-child(${index + 1})`
        }));
    });
}

/**
 * Filters buttons that might be search buttons
 * @param {Array} buttons - Array of button objects
 * @returns {Array} Filtered array of potential search buttons
 */
function filterSearchButtons(buttons) {
    return buttons.filter(button => {
        const textLower = button.text.toLowerCase();
        const ariaLower = button.ariaLabel.toLowerCase();
        const classLower = button.className.toLowerCase();

        return CONFIG.SEARCH_KEYWORDS.some(keyword =>
            textLower.includes(keyword) ||
            ariaLower.includes(keyword) ||
            classLower.includes(keyword)
        );
    });
}

/**
 * Logs button information in a structured format
 * @param {Array} buttons - Array of button objects
 * @param {string} title - Title for the log section
 */
function logButtons(buttons, title) {
    console.log(`\n${title}`);
    buttons.forEach(button => {
        console.log(`${button.index}. Button:`);
        console.log(`   - Text: "${button.text}"`);
        console.log(`   - Aria-label: "${button.ariaLabel}"`);
        console.log(`   - Class: "${button.className}"`);
        console.log(`   - ID: "${button.id}"`);
        console.log(`   - Type: "${button.type}"`);
        console.log(`   - Disabled: ${button.disabled}`);
        console.log(`   - Visible: ${button.visible}`);
        console.log(`   - Suggested selector: "${button.selector}"`);
        console.log('');
    });
}

/**
 * Takes a screenshot of the current page
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 */
async function takeScreenshot(page) {
    await page.screenshot({ path: CONFIG.SCREENSHOT_PATH, fullPage: true });
    console.log(`📸 Screenshot saved as ${CONFIG.SCREENSHOT_PATH}`);
}

/**
 * Waits for user interruption (Ctrl+C)
 */
function waitForUserInterruption() {
    console.log('🔄 Keeping browser open for manual inspection...');
    console.log('Press Ctrl+C to close');

    return new Promise((resolve) => {
        process.on('SIGINT', () => {
            console.log('\n👋 Closing browser...');
            resolve();
        });
    });
}

/**
 * Main debugging function for LinkedIn search buttons
 */
async function debugSearchButton() {
    console.log('🔍 Searching for search buttons on LinkedIn...');

    let browser;
    try {
        browser = await puppeteer.launch(CONFIG.BROWSER_OPTIONS);
        const page = await browser.newPage();

        // Navigate to LinkedIn jobs page
        console.log('🌐 Navigating to LinkedIn jobs page...');
        await page.goto(CONFIG.LINKEDIN_JOBS_URL, { waitUntil: 'networkidle2' });

        console.log('📍 Page loaded, searching for buttons...');

        // Extract all button information
        const buttons = await extractButtonInfo(page);

        // Log all buttons found
        logButtons(buttons, '🔍 All buttons found:');

        // Filter and log potential search buttons
        const searchButtons = filterSearchButtons(buttons);
        logButtons(searchButtons, '🎯 Potential search buttons:');

        // Take screenshot for visual reference
        await takeScreenshot(page);

        // Keep browser open for manual inspection
        await waitForUserInterruption();

    } catch (error) {
        console.error('❌ Error during debugging:', error.message);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            console.log('✅ Browser closed successfully');
        }
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the debug function
debugSearchButton().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

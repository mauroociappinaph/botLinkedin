import { BrowserManager } from '../src/browser/BrowserManager';
import { SessionManager } from '../src/browser/SessionManager';
import { BotConfig, LogLevel } from '../src/types';
import { Logger } from '../src/utils/Logger';

/**
 * Example demonstrating SessionManager usage with BrowserManager
 * This shows how to implement LinkedIn login with session persistence
 */
async function sessionManagementExample() {
    // Example configuration (replace with actual values)
    const config: BotConfig = {
        linkedin: {
            email: 'your-email@example.com',
            password: 'your-password',
        },
        search: {
            keywords: ['software engineer'],
            location: 'United States',
            datePosted: 'pastWeek',
            remoteWork: true,
            experienceLevel: ['entry'],
            jobType: ['fullTime'],
        },
        application: {
            personalInfo: {
                experience: '3 years of experience',
                salaryExpectation: {
                    min: 70000,
                    max: 100000,
                    currency: 'USD',
                },
            },
            commonAnswers: {},
        },
        browser: {
            headless: false, // Set to true for headless mode
            slowMo: 100,
            timeout: 30000,
        },
        delays: {
            minPageLoad: 2000,
            maxPageLoad: 5000,
            minTyping: 50,
            maxTyping: 150,
        },
    };

    const logger = new Logger(LogLevel.INFO);
    const browserManager = new BrowserManager(config.browser);
    const sessionManager = new SessionManager(
        config.linkedin,
        config.delays,
        logger,
        './session-cookies.json'
    );

    try {
        console.log('🚀 Starting LinkedIn session management example...');

        // Launch browser
        await browserManager.launch();
        console.log('✅ Browser launched successfully');

        // Get page and set it in session manager
        const page = browserManager.getPage();
        if (!page) {
            throw new Error('Failed to get page from browser manager');
        }

        sessionManager.setPage(page);
        console.log('✅ Page set in session manager');

        // Attempt login (will try to restore session first)
        console.log('🔐 Attempting LinkedIn login...');
        const loginSuccess = await sessionManager.login();

        if (loginSuccess) {
            console.log('✅ Login successful!');

            // Validate session
            const sessionValid = await sessionManager.validateSession();
            console.log(`📊 Session validation: ${sessionValid ? 'Valid' : 'Invalid'}`);

            // Get session data
            const sessionData = sessionManager.getSessionData();
            if (sessionData) {
                console.log('📋 Session Info:');
                console.log(`  - Logged in: ${sessionData.isLoggedIn}`);
                console.log(`  - Last activity: ${sessionData.lastActivity}`);
                console.log(`  - Session ID: ${sessionData.sessionId}`);
            }

            // Demonstrate session timeout handling
            console.log('⏰ Session timeout: ' + sessionManager.getSessionTimeout() + 'ms');

            // Save session for future use
            await sessionManager.saveSession();
            console.log('💾 Session saved successfully');

        } else {
            console.log('❌ Login failed');
        }

    } catch (error) {
        console.error('💥 Error in session management example:', error);
    } finally {
        // Cleanup
        await sessionManager.cleanup();
        await browserManager.close();
        console.log('🧹 Cleanup completed');
    }
}

// Run the example if this file is executed directly
if (require.main === module) {
    sessionManagementExample().catch(console.error);
}

export { sessionManagementExample };

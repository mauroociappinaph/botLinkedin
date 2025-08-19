/**
 * LinkedIn Login Fix Test Script
 *
 * Tests the LinkedIn automation service with improved error handling,
 * logging, and resource management.
 *
 * @author LinkedIn Job Bot
 * @version 1.0.0
 */

const path = require('path');
const fs = require('fs');

// Configuration
const CONFIG = {
  TIMEOUT_MS: 300000, // 5 minutes
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 5000,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

/**
 * Enhanced logger with timestamps and levels
 */
class TestLogger {
  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const emoji = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      debug: '🔍'
    }[level] || 'ℹ️';

    console.log(`[${timestamp}] ${emoji} ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  static info(message, data) { this.log('info', message, data); }
  static success(message, data) { this.log('success', message, data); }
  static warning(message, data) { this.log('warning', message, data); }
  static error(message, data) { this.log('error', message, data); }
  static debug(message, data) { this.log('debug', message, data); }
}

/**
 * Validates that required files and dependencies exist
 * @returns {Promise<boolean>} True if validation passes
 */
async function validateEnvironment() {
  TestLogger.info('🔍 Validating environment...');

  const requiredFiles = [
    './dist/linkedin/LinkedInService.js',
    './config.json',
    './.env'
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      TestLogger.error(`Required file missing: ${file}`);
      return false;
    }
  }

  // Check if TypeScript is compiled
  const distPath = path.resolve('./dist');
  if (!fs.existsSync(distPath)) {
    TestLogger.error('TypeScript not compiled. Run "npm run build" first.');
    return false;
  }

  TestLogger.success('Environment validation passed');
  return true;
}

/**
 * Loads the LinkedIn service with error handling
 * @returns {Promise<Object|null>} LinkedInService instance or null
 */
async function loadLinkedInService() {
  try {
    TestLogger.info('📦 Loading LinkedIn service...');
    const { LinkedInService } = require('./dist/linkedin/LinkedInService');
    TestLogger.success('LinkedIn service loaded successfully');
    return LinkedInService;
  } catch (error) {
    TestLogger.error('Failed to load LinkedIn service', {
      error: error.message,
      stack: error.stack,
      suggestion: 'Ensure TypeScript is compiled with "npm run build"'
    });
    return null;
  }
}

/**
 * Executes the LinkedIn service test with timeout and retry logic
 * @param {Object} LinkedInService - The service class
 * @returns {Promise<Object>} Test results
 */
async function executeServiceTest(LinkedInService) {
  let service = null;
  let attempt = 0;
  const maxAttempts = CONFIG.RETRY_ATTEMPTS;
  const startTime = Date.now();

  while (attempt < maxAttempts) {
    attempt++;
    TestLogger.info(`🚀 Starting LinkedIn service test (attempt ${attempt}/${maxAttempts})...`);

    try {
      service = new LinkedInService();

      // Set up timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Service test timeout')), CONFIG.TIMEOUT_MS);
      });

      // Execute service start with timeout
      const result = await Promise.race([
        service.start(),
        timeoutPromise
      ]);

      if (result.success) {
        TestLogger.success('LinkedIn service started successfully!');

        // Get and display statistics
        const stats = await service.getStats();
        TestLogger.info('📊 Service Statistics:', stats);

        return {
          success: true,
          attempt,
          stats,
          duration: Date.now() - startTime
        };
      } else {
        TestLogger.warning(`Service failed on attempt ${attempt}`, {
          error: result.error?.message,
          code: result.error?.code,
          recoverable: result.error?.recoverable
        });

        // If error is not recoverable, don't retry
        if (result.error && !result.error.recoverable) {
          TestLogger.error('Non-recoverable error detected, stopping retries');
          break;
        }
      }
    } catch (error) {
      TestLogger.error(`Service test failed on attempt ${attempt}`, {
        error: error.message,
        type: error.constructor.name,
        stack: CONFIG.LOG_LEVEL === 'debug' ? error.stack : undefined
      });

      // Handle specific error types
      if (error.message.includes('timeout')) {
        TestLogger.warning('Service operation timed out');
      } else if (error.message.includes('CAPTCHA')) {
        TestLogger.warning('CAPTCHA challenge detected - manual intervention required');
        break; // Don't retry CAPTCHA errors
      }
    } finally {
      // Cleanup service instance
      if (service) {
        try {
          await service.stop();
          TestLogger.info('Service stopped successfully');
        } catch (cleanupError) {
          TestLogger.warning('Error during service cleanup', {
            error: cleanupError.message
          });
        }
        service = null;
      }
    }

    // Wait before retry (except on last attempt)
    if (attempt < maxAttempts) {
      TestLogger.info(`⏳ Waiting ${CONFIG.RETRY_DELAY_MS}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY_MS));
    }
  }

  return {
    success: false,
    attempts: attempt,
    error: 'All retry attempts exhausted'
  };
}

/**
 * Main test function with comprehensive error handling
 */
async function testLoginFix() {
  const startTime = Date.now();

  TestLogger.info('🔧 LinkedIn Login Fix Test Started');
  TestLogger.info('Configuration:', CONFIG);

  try {
    // Step 1: Validate environment
    const isValidEnvironment = await validateEnvironment();
    if (!isValidEnvironment) {
      throw new Error('Environment validation failed');
    }

    // Step 2: Load LinkedIn service
    const LinkedInService = await loadLinkedInService();
    if (!LinkedInService) {
      throw new Error('Failed to load LinkedIn service');
    }

    // Step 3: Execute service test
    const testResult = await executeServiceTest(LinkedInService);

    // Step 4: Report results
    const totalDuration = Date.now() - startTime;

    if (testResult.success) {
      TestLogger.success('🎉 LinkedIn Login Fix Test PASSED', {
        duration: `${totalDuration}ms`,
        attempts: testResult.attempt,
        stats: testResult.stats
      });
      process.exit(0);
    } else {
      TestLogger.error('💥 LinkedIn Login Fix Test FAILED', {
        duration: `${totalDuration}ms`,
        attempts: testResult.attempts,
        error: testResult.error
      });
      process.exit(1);
    }

  } catch (error) {
    const totalDuration = Date.now() - startTime;

    TestLogger.error('💥 Test execution failed', {
      duration: `${totalDuration}ms`,
      error: error.message,
      type: error.constructor.name,
      stack: CONFIG.LOG_LEVEL === 'debug' ? error.stack : undefined
    });

    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
  const cleanup = (signal) => {
    TestLogger.info(`\n🔄 Received ${signal}, shutting down gracefully...`);
    process.exit(0);
  };

  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  TestLogger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString()
  });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  TestLogger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// Setup and run
setupGracefulShutdown();
testLoginFix().catch((error) => {
  TestLogger.error('Fatal error in main execution', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

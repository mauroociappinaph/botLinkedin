// Main entry point for LinkedIn Job Bot
import { LinkedInBotCLI } from './cli';

// Export all modules for library usage
export * from './browser';
export * from './cli';
export * from './config';
export * from './database';
export * from './linkedin';
export * from './types';
export * from './utils';

/**
 * Main entry point function
 * Implements Requirements: 9.2, 7.3, 7.4
 */
async function main(): Promise<void> {
  const cli = new LinkedInBotCLI();
  await cli.run();
}

// Execute CLI if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Main entry point for LinkedIn Job Bot
// This will be implemented in later tasks

export * from './browser';
export * from './config';
export * from './database';
export * from './linkedin';
export * from './types';
export * from './utils';

// Main function will be implemented in task 11.2
async function main(): Promise<void> {
    console.log('LinkedIn Job Bot - Entry point created');
    console.log('Implementation will be completed in subsequent tasks');
}

if (require.main === module) {
    main().catch(console.error);
}

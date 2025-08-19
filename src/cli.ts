#!/usr/bin/env node

import * as process from 'process';
import { ConfigLoader, ConfigValidator } from './config';
import { LinkedInService } from './linkedin';
import { LogLevel, Logger } from './utils';

/**
 * CLI entry point for LinkedIn Job Application Bot
 * Implements Requirements: 9.2, 7.3, 7.4
 */
class LinkedInBotCLI {
    private logger: Logger;
    private linkedInService?: LinkedInService;
    private isShuttingDown: boolean = false;

    constructor() {
        this.logger = new Logger({
            level: LogLevel.INFO,
            enableFileLogging: true,
            logDirectory: './logs',
            maxFileSize: 10, // 10MB
        });

        this.setupSignalHandlers();
    }

    /**
     * Main CLI execution method
     */
    public async run(): Promise<void> {
        try {
            this.displayWelcomeMessage();

            // Parse command line arguments
            const args = this.parseArguments();

            // Validate configuration before starting
            await this.validateConfiguration(args.configPath);

            // Initialize and start the LinkedIn service
            this.linkedInService = new LinkedInService(args.configPath);

            this.displayStartMessage();

            // Start the bot with progress monitoring
            const result = await this.runWithProgressMonitoring();

            if (result.success) {
                this.displaySuccessMessage();
                process.exit(0);
            } else {
                this.displayErrorMessage(result.error?.message || 'Unknown error');
                process.exit(1);
            }

        } catch (error) {
            this.handleCLIError(error);
            process.exit(1);
        }
    }

    /**
     * Parses command line arguments
     */
    private parseArguments(): { configPath?: string | undefined; help: boolean } {
        const args = process.argv.slice(2);
        let configPath: string | undefined;
        let help = false;

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            switch (arg) {
                case '--config':
                case '-c':
                    configPath = args[i + 1];
                    i++; // Skip next argument as it's the config path
                    break;

                case '--help':
                case '-h':
                    help = true;
                    break;

                default:
                    if (arg && arg.startsWith('-')) {
                        console.error(`Unknown option: ${arg}`);
                        this.displayHelp();
                        process.exit(1);
                    }
                    break;
            }
        }

        if (help) {
            this.displayHelp();
            process.exit(0);
        }

        return { configPath, help };
    }

    /**
     * Validates configuration before starting the bot
     */
    private async validateConfiguration(configPath?: string): Promise<void> {
        try {
            console.log('🔍 Validating configuration...');

            // Load configuration
            const config = ConfigLoader.load(configPath);

            // Validate configuration
            const validation = ConfigValidator.validate(config);

            if (!validation.isValid) {
                console.error('❌ Configuration validation failed:');
                validation.errors.forEach(error => {
                    console.error(`   • ${error}`);
                });
                throw new Error('Invalid configuration');
            }

            if (validation.warnings.length > 0) {
                console.warn('⚠️  Configuration warnings:');
                validation.warnings.forEach(warning => {
                    console.warn(`   • ${warning}`);
                });
            }

            console.log('✅ Configuration validated successfully');

        } catch (error) {
            if (error instanceof Error && error.message.includes('ENOENT')) {
                console.error('❌ Configuration file not found');
                console.log('💡 Run the bot once to generate a default config.json file');
            } else {
                console.error('❌ Configuration validation failed:', error instanceof Error ? error.message : 'Unknown error');
            }
            throw error;
        }
    }

    /**
     * Runs the bot with progress monitoring and statistics display
     */
    private async runWithProgressMonitoring() {
        // Start progress monitoring
        const progressInterval = this.startProgressMonitoring();

        try {
            // Execute the bot
            const result = await this.linkedInService!.start();

            // Stop progress monitoring
            clearInterval(progressInterval);

            // Display final statistics
            await this.displayFinalStatistics();

            return result;

        } catch (error) {
            clearInterval(progressInterval);
            throw error;
        }
    }

    /**
     * Starts progress monitoring with periodic statistics display
     */
    private startProgressMonitoring(): NodeJS.Timeout {
        let lastStats = { jobsProcessed: 0, applicationsSubmitted: 0 };

        return setInterval(async () => {
            if (this.isShuttingDown || !this.linkedInService) return;

            try {
                const stats = await this.linkedInService.getStats();

                // Only display if there's progress
                if (stats.jobsProcessed > lastStats.jobsProcessed ||
                    stats.applicationsSubmitted > lastStats.applicationsSubmitted) {

                    console.log(`📊 Progress: ${stats.jobsProcessed} jobs processed, ${stats.applicationsSubmitted} applications submitted, ${stats.duplicatesSkipped} duplicates skipped`);

                    lastStats = {
                        jobsProcessed: stats.jobsProcessed,
                        applicationsSubmitted: stats.applicationsSubmitted,
                    };
                }

            } catch (error) {
                // Silently handle stats errors during monitoring
            }
        }, 30000); // Update every 30 seconds
    }

    /**
     * Displays final execution statistics
     */
    private async displayFinalStatistics(): Promise<void> {
        if (!this.linkedInService) return;

        try {
            const stats = await this.linkedInService.getStats();

            console.log('\n📈 Final Statistics:');
            console.log(`   Jobs Processed: ${stats.jobsProcessed}`);
            console.log(`   Applications Submitted: ${stats.applicationsSubmitted}`);
            console.log(`   Duplicates Skipped: ${stats.duplicatesSkipped}`);
            console.log(`   Errors Encountered: ${stats.errorsEncountered}`);

            if (stats.sessionId) {
                console.log(`   Session ID: ${stats.sessionId}`);
            }

        } catch (error) {
            console.warn('⚠️  Could not retrieve final statistics');
        }
    }

    /**
     * Sets up signal handlers for graceful shutdown
     */
    private setupSignalHandlers(): void {
        const handleShutdown = async (signal: string) => {
            if (this.isShuttingDown) {
                console.log('\n🚨 Force shutdown requested');
                process.exit(1);
            }

            this.isShuttingDown = true;
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            console.log('   Press Ctrl+C again to force quit');

            try {
                if (this.linkedInService) {
                    await this.linkedInService.stop();
                }
                console.log('✅ Shutdown completed successfully');
                process.exit(0);
            } catch (error) {
                console.error('❌ Error during shutdown:', error instanceof Error ? error.message : 'Unknown error');
                process.exit(1);
            }
        };

        process.on('SIGINT', () => handleShutdown('SIGINT'));
        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
        process.on('SIGUSR2', () => handleShutdown('SIGUSR2')); // For nodemon
    }

    /**
     * Handles CLI-specific errors
     */
    private handleCLIError(error: unknown): void {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        console.error('❌ LinkedIn Job Bot failed to start:');
        console.error(`   ${errorMessage}`);

        if (error instanceof Error && error.stack) {
            this.logger.error('CLI Error Details', {
                error: errorMessage,
                stack: error.stack
            });
        }

        console.log('\n💡 Troubleshooting tips:');
        console.log('   • Check your config.json file exists and is valid');
        console.log('   • Ensure you have a stable internet connection');
        console.log('   • Verify your LinkedIn credentials are correct');
        console.log('   • Check the logs directory for detailed error information');
    }

    /**
     * Displays welcome message
     */
    private displayWelcomeMessage(): void {
        console.log('🤖 LinkedIn Job Application Bot');
        console.log('================================');
        console.log('Automated job application system for LinkedIn Easy Apply positions\n');
    }

    /**
     * Displays start message
     */
    private displayStartMessage(): void {
        console.log('🚀 Starting LinkedIn Job Application Bot...');
        console.log('   • Browser will launch and navigate to LinkedIn');
        console.log('   • Bot will search for jobs matching your criteria');
        console.log('   • Applications will be submitted automatically');
        console.log('   • Progress will be displayed every 30 seconds');
        console.log('   • Press Ctrl+C to stop gracefully\n');
    }

    /**
     * Displays success message
     */
    private displaySuccessMessage(): void {
        console.log('\n🎉 LinkedIn Job Application Bot completed successfully!');
        console.log('   Check the logs directory for detailed execution logs');
        console.log('   Review the database for application history');
    }

    /**
     * Displays error message
     */
    private displayErrorMessage(error: string): void {
        console.log('\n💥 LinkedIn Job Application Bot encountered an error:');
        console.log(`   ${error}`);
        console.log('   Check the logs directory for detailed error information');
    }

    /**
     * Displays help information
     */
    private displayHelp(): void {
        console.log('LinkedIn Job Application Bot - Help');
        console.log('==================================\n');

        console.log('Usage:');
        console.log('  npm start                    Start with default config.json');
        console.log('  npm start -- --config path   Start with custom config file');
        console.log('  npm start -- --help          Show this help message\n');

        console.log('Options:');
        console.log('  -c, --config <path>         Path to configuration file');
        console.log('  -h, --help                  Show help information\n');

        console.log('Examples:');
        console.log('  npm start');
        console.log('  npm start -- --config ./my-config.json');
        console.log('  npm start -- --help\n');

        console.log('Configuration:');
        console.log('  The bot requires a config.json file with LinkedIn credentials,');
        console.log('  search parameters, and application settings. A template will be');
        console.log('  generated on first run if the file doesn\'t exist.\n');

        console.log('For more information, visit: https://github.com/your-repo/linkedin-job-bot');
    }
}

/**
 * Main CLI execution
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

export { LinkedInBotCLI };

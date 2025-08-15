import { BotConfig } from '../types';

/**
 * Default configuration template for the LinkedIn Job Bot
 * This serves as a reference and can be used to generate config.json
 */
export const DEFAULT_CONFIG: BotConfig = {
  linkedin: {
    email: 'your-email@example.com',
    password: 'your-password',
  },
  search: {
    keywords: ['software engineer', 'developer', 'programmer'],
    location: 'United States',
    datePosted: 'pastWeek',
    remoteWork: true,
    experienceLevel: ['entry', 'associate', 'mid'],
    jobType: ['fullTime', 'contract'],
    salaryRange: {
      min: 60000,
      max: 120000,
    },
  },
  application: {
    personalInfo: {
      experience:
        '3 years of software development experience with JavaScript, TypeScript, and Node.js',
      salaryExpectation: {
        min: 70000,
        max: 100000,
        currency: 'USD',
      },
    },
    commonAnswers: {
      'Why are you interested in this role?':
        'I am passionate about software development and excited about the opportunity to contribute to your team.',
      'What are your salary expectations?':
        'I am looking for a competitive salary in the range of $70,000 - $100,000.',
      'Are you authorized to work in the US?': 'Yes',
      'Do you require sponsorship?': 'No',
      'How many years of experience do you have?': '3',
      'Are you willing to relocate?': 'Yes',
      'What is your notice period?': '2 weeks',
    },
  },
  browser: {
    headless: false,
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

/**
 * Generates a configuration file with default values
 * @param outputPath Path where to save the config file
 * @returns Promise that resolves when file is written
 */
export async function generateDefaultConfig(
  outputPath: string = './config.json'
): Promise<void> {
  const { promises: fs } = await import('fs');

  const configJson = JSON.stringify(DEFAULT_CONFIG, null, 2);
  await fs.writeFile(outputPath, configJson, 'utf-8');
}

/**
 * Gets the default configuration object
 * @returns Default configuration
 */
export function getDefaultConfig(): BotConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Deep clone to prevent mutations
}

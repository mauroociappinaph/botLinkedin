# LinkedIn Job Application Bot

A Node.js automation tool that streamlines job applications on LinkedIn by targeting "Easy Apply" positions. The bot intelligently searches for relevant jobs, automatically fills application forms, and maintains a comprehensive database to prevent duplicate applications.

## Features

- **Smart Job Targeting**: Focuses exclusively on LinkedIn "Easy Apply" positions
- **Intelligent Form Filling**: Automatically completes application forms with pre-configured personal information
- **Duplicate Prevention**: Maintains SQLite database to track applied positions
- **Stealth Operation**: Uses anti-detection techniques to maintain account safety
- **CAPTCHA Handling**: Pauses for manual intervention when challenges appear
- **Comprehensive Logging**: Detailed activity tracking and session reporting

## Project Structure

```
src/
├── types/          # TypeScript interfaces and type definitions
├── config/         # Configuration management
├── database/       # Database services and repositories
├── browser/        # Browser automation and session management
├── linkedin/       # LinkedIn-specific automation logic
├── utils/          # Utility functions and helpers
└── index.ts        # Main entry point

tests/
├── unit/           # Unit tests
└── integration/    # Integration tests

prisma/
└── schema.prisma   # Database schema
```

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Browser Automation**: Puppeteer with stealth plugin
- **Database**: SQLite with Prisma ORM
- **Testing**: Jest
- **Code Quality**: ESLint, Prettier

## Development Commands

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start development with watch mode
npm run dev

# Run tests
npm test

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate
```

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Generate Prisma client: `npm run prisma:generate`
4. Run database migrations: `npm run prisma:migrate`
5. Build the project: `npm run build`

## Configuration

Create a `config.json` file in the project root with your LinkedIn credentials and job search preferences:

```json
{
  "linkedin": {
    "email": "your-email@example.com",
    "password": "your-password"
  },
  "search": {
    "keywords": ["software engineer", "developer"],
    "location": "San Francisco, CA",
    "datePosted": "pastWeek",
    "remoteWork": true,
    "experienceLevel": ["entry", "associate"],
    "jobType": ["fullTime"]
  },
  "application": {
    "personalInfo": {
      "experience": "3 years",
      "salaryExpectation": {
        "min": 80000,
        "max": 120000,
        "currency": "USD"
      }
    },
    "commonAnswers": {
      "Why do you want to work here?": "I'm passionate about the company's mission and believe my skills would be a great fit.",
      "Are you authorized to work in the US?": "Yes"
    }
  },
  "browser": {
    "headless": false,
    "slowMo": 100,
    "timeout": 30000
  },
  "delays": {
    "minPageLoad": 2000,
    "maxPageLoad": 5000,
    "minTyping": 50,
    "maxTyping": 150
  }
}
```

## Usage

### Command Line Interface

```bash
# Start the bot with default config.json
npm start

# Start with custom configuration file
npm start -- --config ./my-config.json

# Show help information
npm start -- --help

# Development mode (with TypeScript compilation)
npm run bot:dev

# Build and run
npm run bot
```

### CLI Options

- `-c, --config <path>`: Path to configuration file
- `-h, --help`: Show help information

### Example Commands

```bash
# Basic usage
npm start

# Custom config
npm start -- --config ./configs/production.json

# Development with auto-reload
npm run dev
```

## Monitoring and Logs

The bot provides real-time progress updates and comprehensive logging:

- **Progress Updates**: Displays statistics every 30 seconds during execution
- **File Logging**: Detailed logs saved to `./logs` directory
- **Database Tracking**: All applications tracked in SQLite database
- **Session Reports**: Summary statistics at completion

## Graceful Shutdown

The bot supports graceful shutdown:
- Press `Ctrl+C` once for graceful shutdown
- Press `Ctrl+C` twice for immediate termination
- All progress is saved and can be resumed

## Implementation Status

This project implements a complete LinkedIn job application automation system with:
- ✅ Configuration management and validation
- ✅ Browser automation with stealth capabilities
- ✅ Job search and filtering
- ✅ Application form automation
- ✅ Database tracking and duplicate prevention
- ✅ Comprehensive logging and error handling
- ✅ CLI interface with progress monitoring

## License

MIT

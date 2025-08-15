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
4. Build the project: `npm run build`

## Implementation Status

This project is currently in development. The basic project structure and dependencies have been set up. Individual components will be implemented according to the task list in the specification.

## License

MIT

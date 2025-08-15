# Technology Stack & Build System

## Core Technologies

- **Runtime**: Node.js with TypeScript for type safety and maintainability
- **Browser Automation**: Puppeteer with puppeteer-extra-plugin-stealth for LinkedIn interaction
- **Database**: SQLite with Prisma ORM for job tracking and duplicate prevention
- **Configuration**: JSON-based configuration with schema validation

## Key Dependencies

```json
{
  "puppeteer": "Browser automation",
  "puppeteer-extra-plugin-stealth": "Anti-detection measures",
  "prisma": "Database ORM and migrations",
  "sqlite3": "Local database storage",
  "typescript": "Type safety and development experience"
}
```

## Project Structure

- TypeScript with strict mode enabled
- Modular architecture following Single Responsibility Principle
- Barrel exports for clean imports
- Prisma for database schema management and migrations

## Common Commands

### Development
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Build TypeScript
npm run build

# Start development with watch mode
npm run dev
```

### Database Management
```bash
# Create new migration
npx prisma migrate dev --name <migration_name>

# Reset database
npx prisma migrate reset

# View database in browser
npx prisma studio
```

### Testing
```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run all tests with coverage
npm run test:coverage
```

## Build Configuration

- TypeScript strict mode for enhanced type checking
- ESLint and Prettier for code quality and formatting
- Jest for unit and integration testing
- Nodemon for development hot reloading

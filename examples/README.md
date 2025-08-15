# Logger Examples

This directory contains examples demonstrating the enhanced Logger functionality.

## Features Demonstrated

### 1. Log Formatting Options

The Logger now supports two output formats:

- **Plain Text** (`LogFormat.PLAIN`): Human-readable format with timestamps
- **JSON** (`LogFormat.JSON`): Structured JSON format for log aggregation systems

```typescript
import { Logger, LogFormat } from '../src/utils/Logger';
import { LogLevel } from '../src/types';

// Plain text logger
const plainLogger = Logger.createDebugLogger(LogFormat.PLAIN);
plainLogger.info('Hello world', { user: 'john' });
// Output: [2024-01-15T10:30:00.000Z] INFO: Hello world {"user":"john"}

// JSON logger
const jsonLogger = Logger.createJsonLogger(LogLevel.INFO);
jsonLogger.info('Hello world', { user: 'john' });
// Output: {"timestamp":"2024-01-15T10:30:00.000Z","level":"INFO","message":"Hello world","context":{"user":"john"}}
```

### 2. Runtime Configuration

Log level and format can be changed at runtime:

```typescript
const logger = new Logger({ level: LogLevel.ERROR, format: LogFormat.PLAIN });

// Change log level
logger.setLogLevel(LogLevel.DEBUG);

// Change format
logger.setFormat(LogFormat.JSON);

// Check current settings
console.log(logger.getLogLevel()); // LogLevel.DEBUG
console.log(logger.getFormat());   // LogFormat.JSON
```

### 3. Performance Optimization

Check if a log level is enabled before expensive operations:

```typescript
const logger = new Logger({ level: LogLevel.WARN, format: LogFormat.PLAIN });

if (logger.isLevelEnabled(LogLevel.DEBUG)) {
  // This expensive operation only runs if DEBUG logging is enabled
  const expensiveData = performExpensiveOperation();
  logger.debug('Debug data', expensiveData);
}
```

### 4. Factory Methods

Convenient factory methods for common configurations:

```typescript
// Development logger with DEBUG level and plain format
const devLogger = Logger.createDebugLogger();

// Production logger with INFO level and JSON format (safer default)
const prodLogger = Logger.createProductionLogger();

// Error-only logger for critical production environments
const errorLogger = Logger.createErrorOnlyLogger();

// Custom JSON logger
const jsonLogger = Logger.createJsonLogger(LogLevel.INFO);

// Fully custom logger
const customLogger = Logger.create({
  level: LogLevel.WARN,
  format: LogFormat.JSON
});
```

## Running the Demo

```bash
# Install dependencies
npm install

# Run the logger demonstration
npx ts-node examples/logger-demo.ts
```

## Backward Compatibility

The Logger maintains backward compatibility with the original constructor:

```typescript
// Old way (still works)
const logger = new Logger(LogLevel.INFO);

// New way
const logger = new Logger({ level: LogLevel.INFO, format: LogFormat.PLAIN });
```

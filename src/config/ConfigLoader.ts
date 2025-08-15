import { promises as fs, readFileSync } from 'fs';
import { resolve } from 'path';
import { BotConfig } from '../types';

export class ConfigLoader {
  private static readonly CONFIG_FILE_NAME = 'config.json';
  private static readonly DEFAULT_CONFIG_PATH = resolve(
    process.cwd(),
    ConfigLoader.CONFIG_FILE_NAME
  );

  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

  /**
   * Validates basic configuration structure
   * @param config Configuration object to validate
   * @throws Error if configuration is invalid
   */
  private static validateBasicStructure(
    config: unknown
  ): asserts config is BotConfig {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration file must contain a valid JSON object');
    }
  }

  /**
   * Loads and parses the configuration file
   * @param configPath Optional path to config file, defaults to ./config.json
   * @returns Parsed configuration object
   * @throws Error if file doesn't exist or contains invalid JSON
   */
  static async load(configPath?: string): Promise<BotConfig> {
    const filePath = resolve(configPath || ConfigLoader.DEFAULT_CONFIG_PATH);

    try {
      // Check if file exists and is readable
      const stats = await fs.stat(filePath);

      // Check file size to prevent loading extremely large files
      if (stats.size > ConfigLoader.MAX_FILE_SIZE) {
        throw new Error(
          `Configuration file is too large (${stats.size} bytes). Maximum allowed size is ${ConfigLoader.MAX_FILE_SIZE} bytes.`
        );
      }

      await fs.access(filePath, fs.constants.R_OK);
    } catch (error) {
      const nodeError = error as { code?: string };
      if (nodeError.code === 'ENOENT') {
        throw new Error(
          `Configuration file not found at: ${filePath}. Please create a config.json file or run the setup command.`
        );
      }
      if (nodeError.code === 'EACCES') {
        throw new Error(
          `Permission denied reading configuration file at: ${filePath}`
        );
      }
      if (error instanceof Error && error.message.includes('too large')) {
        throw error; // Re-throw file size errors
      }
      throw new Error(`Cannot access configuration file at: ${filePath}`);
    }

    try {
      // Read and parse the configuration file
      const configContent = await fs.readFile(filePath, 'utf-8');

      if (!configContent.trim()) {
        throw new Error('Configuration file is empty');
      }

      const config = JSON.parse(configContent) as BotConfig;

      // Basic structure validation
      ConfigLoader.validateBasicStructure(config);

      return config;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${error.message}`);
      }
      if (
        error instanceof Error &&
        error.message.includes('Configuration file')
      ) {
        throw error; // Re-throw our custom errors
      }
      throw new Error(
        `Failed to read configuration file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Loads configuration synchronously (for testing purposes)
   * @param configPath Optional path to config file
   * @returns Parsed configuration object
   */
  static loadSync(configPath?: string): BotConfig {
    const filePath = resolve(configPath || ConfigLoader.DEFAULT_CONFIG_PATH);

    try {
      const configContent = readFileSync(filePath, 'utf-8');

      if (!configContent.trim()) {
        throw new Error('Configuration file is empty');
      }

      const config = JSON.parse(configContent) as BotConfig;

      // Basic structure validation
      ConfigLoader.validateBasicStructure(config);

      return config;
    } catch (error: unknown) {
      const nodeError = error as { code?: string };
      if (nodeError.code === 'ENOENT') {
        throw new Error(`Configuration file not found at: ${filePath}`);
      }
      if (nodeError.code === 'EACCES') {
        throw new Error(
          `Permission denied reading configuration file at: ${filePath}`
        );
      }
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${error.message}`);
      }
      if (
        error instanceof Error &&
        error.message.includes('Configuration file')
      ) {
        throw error; // Re-throw our custom errors
      }
      throw new Error(
        `Failed to read configuration file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Checks if configuration file exists
   * @param configPath Optional path to config file
   * @returns True if file exists, false otherwise
   */
  static async exists(configPath?: string): Promise<boolean> {
    const filePath = resolve(configPath || ConfigLoader.DEFAULT_CONFIG_PATH);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets the default configuration file path
   * @returns Default config file path
   */
  static getDefaultPath(): string {
    return ConfigLoader.DEFAULT_CONFIG_PATH;
  }
}

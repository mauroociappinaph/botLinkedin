export enum BooleanOperator {
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
}

export interface BooleanSearchConfig {
  enabled: boolean;
  expression: string;
  fallbackKeywords?: string[];
  validateSyntax?: boolean;
}

export interface BooleanSearchTerm {
  term: string;
  operator?: BooleanOperator;
  isPhrase: boolean;
  isNegated: boolean;
  isRequired: boolean;
}

export interface BooleanSearchValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  parsedTerms: BooleanSearchTerm[];
}

interface Logger {
  debug?(message: string): void;
  info?(message: string): void;
  warn?(message: string): void;
  error?(message: string): void;
}

export class BooleanSearchBuilder {
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  public buildSearchQuery(config: BooleanSearchConfig): string {
    if (!config.enabled || !config.expression?.trim()) {
      this.logger?.debug(
        'Boolean search disabled or empty expression, using fallback keywords'
      );
      return config.fallbackKeywords?.join(' OR ') || '';
    }

    const validation = this.validateBooleanExpression(config.expression);
    if (!validation.isValid) {
      this.logger?.warn(
        `Invalid boolean expression: ${validation.errors.join(', ')}`
      );
      return config.fallbackKeywords?.join(' OR ') || '';
    }

    this.logger?.debug(`Built boolean search query: ${config.expression}`);
    return config.expression;
  }

  public validateBooleanExpression(
    expression: string
  ): BooleanSearchValidation {
    const result: BooleanSearchValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      parsedTerms: [],
    };

    if (!expression?.trim()) {
      result.isValid = false;
      result.errors.push('Expression cannot be empty');
      return result;
    }

    try {
      result.parsedTerms = this.parseSearchTerms(expression);
      this.validateSyntax(expression, result);
      result.isValid = result.errors.length === 0;
    } catch (error) {
      result.isValid = false;
      result.errors.push(
        'Validation error: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      );
    }

    return result;
  }

  private validateSyntax(
    expression: string,
    result: BooleanSearchValidation
  ): void {
    if (!this.areParenthesesBalanced(expression)) {
      result.errors.push('Unbalanced parentheses in expression');
    }

    const invalidSequences = this.findInvalidOperatorSequences(expression);
    if (invalidSequences.length > 0) {
      result.errors.push(
        'Invalid operator sequences: ' + invalidSequences.join(', ')
      );
    }

    const phraseValidation = this.validateQuotedPhrases(expression);
    if (!phraseValidation.isValid) {
      result.errors.push(...phraseValidation.errors);
    }
  }

  private validateQuotedPhrases(expression: string): {
    isValid: boolean;
    errors: string[];
  } {
    const result = { isValid: true, errors: [] as string[] };

    const phrases = expression.match(/"([^"]+)"/g) || [];

    for (const phrase of phrases) {
      const content = phrase.slice(1, -1);

      if (content.trim().length === 0) {
        result.errors.push('Empty quoted phrase found');
      }
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  private areParenthesesBalanced(expression: string): boolean {
    let balance = 0;

    for (const char of expression) {
      if (char === '(') balance++;
      if (char === ')') balance--;
      if (balance < 0) return false;
    }

    return balance === 0;
  }

  private findInvalidOperatorSequences(expression: string): string[] {
    const invalid: string[] = [];
    const operators = Object.values(BooleanOperator);

    const words = expression.split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      const current = words[i]?.toUpperCase() || '';
      const next = words[i + 1]?.toUpperCase() || '';

      if (
        operators.includes(current as BooleanOperator) &&
        operators.includes(next as BooleanOperator)
      ) {
        invalid.push(`${current} ${next}`);
      }
    }

    return invalid;
  }

  private parseSearchTerms(expression: string): BooleanSearchTerm[] {
    const terms: BooleanSearchTerm[] = [];
    const operators = Object.values(BooleanOperator);

    // Handle quoted phrases first
    const quotedPhrases = expression.match(/"[^"]+"/g) || [];
    let processedExpression = expression;

    // Replace quoted phrases with placeholders to avoid splitting them
    const phraseMap = new Map<string, string>();
    quotedPhrases.forEach((phrase, index) => {
      const placeholder = `__PHRASE_${index}__`;
      phraseMap.set(placeholder, phrase);
      processedExpression = processedExpression.replace(phrase, placeholder);
    });

    const words = processedExpression
      .split(/\s+/)
      .filter((word) => word.trim());

    for (const word of words) {
      if (!word || operators.includes(word.toUpperCase() as BooleanOperator))
        continue;

      let actualTerm = word;
      let isPhrase = false;

      // Check if this is a phrase placeholder
      if (phraseMap.has(word)) {
        actualTerm = phraseMap.get(word)!;
        isPhrase = true;
      }

      terms.push({
        term: actualTerm.replace(/^[+-]/, '').replace(/^"|"$/g, '').trim(),
        isPhrase,
        isNegated: word.startsWith('-'),
        isRequired: word.startsWith('+'),
      });
    }

    return terms;
  }

  public static getExamples(): Record<string, string> {
    return {
      'Basic AND search': 'React developer AND remote',
      'OR with multiple terms': 'JavaScript OR TypeScript OR Node.js',
    };
  }
}

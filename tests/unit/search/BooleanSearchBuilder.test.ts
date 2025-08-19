import { BooleanSearchBuilder } from '../../../src/search/BooleanSearchBuilder';
import { Logger } from '../../../src/utils/Logger';

describe('BooleanSearchBuilder', () => {
    let builder: BooleanSearchBuilder;
    let mockLogger: jest.Mocked<Logger>;

    beforeEach(() => {
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        } as any;
        builder = new BooleanSearchBuilder(mockLogger);
    });

    describe('buildSearchQuery', () => {
        it('should return fallback query when boolean search is disabled', () => {
            const config = {
                enabled: false,
                expression: 'test AND query',
                fallbackKeywords: ['keyword1', 'keyword2'],
            };

            const result = builder.buildSearchQuery(config);
            expect(result).toBe('keyword1 OR keyword2');
        });

        it('should return fallback query when expression is empty', () => {
            const config = {
                enabled: true,
                expression: '',
                fallbackKeywords: ['keyword1', 'keyword2'],
            };

            const result = builder.buildSearchQuery(config);
            expect(result).toBe('keyword1 OR keyword2');
        });

        it('should build valid boolean query', () => {
            const config = {
                enabled: true,
                expression: 'React AND developer',
                fallbackKeywords: ['React', 'developer'],
            };

            const result = builder.buildSearchQuery(config);
            expect(result).toBe('React AND developer');
        });

        it('should optimize query for LinkedIn', () => {
            const config = {
                enabled: true,
                expression: 'react and developer or javascript',
                fallbackKeywords: ['React'],
            };

            const result = builder.buildSearchQuery(config);
            expect(result).toBe('react AND developer OR javascript');
        });

        it('should convert NOT to minus sign', () => {
            const config = {
                enabled: true,
                expression: 'developer NOT junior',
                fallbackKeywords: ['developer'],
            };

            const result = builder.buildSearchQuery(config);
            expect(result).toBe('developer -junior');
        });

        it('should handle quoted phrases', () => {
            const config = {
                enabled: true,
                expression: '"React developer" AND remote',
                fallbackKeywords: ['React'],
            };

            const result = builder.buildSearchQuery(config);
            expect(result).toBe('"React developer" AND remote');
        });

        it('should use fallback on invalid expression', () => {
            const config = {
                enabled: true,
                expression: 'invalid (( expression',
                fallbackKeywords: ['fallback'],
                validateSyntax: true,
            };

            const result = builder.buildSearchQuery(config);
            expect(result).toBe('fallback');
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Invalid boolean expression, using fallback',
                expect.any(Object)
            );
        });
    });

    describe('validateBooleanExpression', () => {
        it('should validate empty expression as invalid', () => {
            const result = builder.validateBooleanExpression('');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Expression cannot be empty');
        });

        it('should validate simple valid expression', () => {
            const result = builder.validateBooleanExpression('React AND developer');
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect unbalanced parentheses', () => {
            const result = builder.validateBooleanExpression('(React AND developer');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Unbalanced parentheses in expression');
        });

        it('should detect invalid operator sequences', () => {
            const result = builder.validateBooleanExpression('React AND OR developer');
            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('Invalid operator sequences'))).toBe(true);
        });

        it('should validate quoted phrases', () => {
            const result = builder.validateBooleanExpression('"React developer" AND remote');
            expect(result.isValid).toBe(true);
            expect(result.parsedTerms.some(term => term.isPhrase && term.term === 'React developer')).toBe(true);
        });

        it('should detect empty quoted phrases', () => {
            const result = builder.validateBooleanExpression('React AND ""');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Empty quoted phrase found');
        });

        it('should detect too long expressions', () => {
            const longExpression = 'a'.repeat(1001);
            const result = builder.validateBooleanExpression(longExpression);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('Expression too long'))).toBe(true);
        });

        it('should warn about reserved terms', () => {
            const result = builder.validateBooleanExpression('developer AND site:linkedin.com');
            expect(result.warnings).toContain('Reserved terms detected: site:');
        });

        it('should parse terms correctly', () => {
            const result = builder.validateBooleanExpression('"React developer" AND remote OR -junior');
            expect(result.isValid).toBe(true);
            expect(result.parsedTerms).toHaveLength(3);

            const phraseterm = result.parsedTerms.find(t => t.isPhrase);
            expect(phraseterm?.term).toBe('React developer');

            const negatedTerm = result.parsedTerms.find(t => t.isNegated);
            expect(negatedTerm?.term).toBe('junior');
        });
    });

    describe('complex expressions', () => {
        it('should handle complex nested expressions', () => {
            const expression = '(React OR Vue OR Angular) AND ("senior developer" OR "lead developer") AND remote AND -junior';
            const result = builder.validateBooleanExpression(expression);
            expect(result.isValid).toBe(true);
        });

        it('should handle multilingual expressions', () => {
            const expression = '("desarrollador frontend" OR "frontend developer") AND ("remoto" OR "remote")';
            const result = builder.validateBooleanExpression(expression);
            expect(result.isValid).toBe(true);
        });

        it('should handle required terms', () => {
            const expression = '+remote +developer React OR Vue';
            const result = builder.validateBooleanExpression(expression);
            expect(result.isValid).toBe(true);

            const requiredTerms = result.parsedTerms.filter(t => t.isRequired);
            expect(requiredTerms).toHaveLength(2);
        });
    });

    describe('getExamples', () => {
        it('should return example expressions', () => {
            const examples = BooleanSearchBuilder.getExamples();
            expect(Object.keys(examples)).toHaveLength(8);
            expect(examples['Basic AND search']).toBe('"React developer" AND remote');
            expect(examples['Complex expression']).toBe('("full stack" OR "fullstack") AND (React OR Vue) AND -intern');
        });
    });

    describe('edge cases', () => {
        it('should handle expressions with only operators', () => {
            const result = builder.validateBooleanExpression('AND OR NOT');
            expect(result.isValid).toBe(false);
        });

        it('should handle expressions with special characters', () => {
            const result = builder.validateBooleanExpression('C++ AND developer');
            expect(result.isValid).toBe(true);
        });

        it('should handle very long phrases', () => {
            const longPhrase = '"' + 'a'.repeat(101) + '"';
            const result = builder.validateBooleanExpression(longPhrase);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('Phrase too long'))).toBe(true);
        });

        it('should handle expressions with numbers', () => {
            const result = builder.validateBooleanExpression('React AND "3+ years" AND developer');
            expect(result.isValid).toBe(true);
        });
    });
});

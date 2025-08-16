import { FormFiller } from '../../../src/linkedin/FormFiller';
import { ApplicationConfig } from '../../../src/types';

// Mock dependencies
jest.mock('../../../src/utils/Logger');

describe('FormFiller', () => {
    let formFiller: FormFiller;
    let mockApplicationConfig: ApplicationConfig;

    beforeEach(() => {
        mockApplicationConfig = {
            personalInfo: {
                experience: '3 years of software development experience with JavaScript and TypeScript',
                salaryExpectation: {
                    min: 70000,
                    max: 100000,
                    currency: 'USD',
                },
            },
            commonAnswers: {
                'Are you authorized to work in the US?': 'Yes',
                'Do you require sponsorship?': 'No',
                'Are you willing to relocate?': 'Yes',
                'What is your notice period?': '2 weeks',
                'How many years of experience do you have?': '3',
            },
        };

        formFiller = new FormFiller(mockApplicationConfig);
    });

    describe('constructor', () => {
        it('should initialize with application config', () => {
            expect(formFiller).toBeDefined();
        });
    });

    describe('updateConfig', () => {
        it('should update the configuration', () => {
            const newConfig: ApplicationConfig = {
                ...mockApplicationConfig,
                personalInfo: {
                    ...mockApplicationConfig.personalInfo,
                    experience: '5 years of experience',
                },
            };

            expect(() => {
                formFiller.updateConfig(newConfig);
            }).not.toThrow();
        });
    });

    describe('getValueForField', () => {
        it('should return experience for experience-related fields', () => {
            // Access private method for testing
            const getValue = (formFiller as unknown as { getValueForField: (field: string) => string | null }).getValueForField.bind(formFiller);

            expect(getValue('tell us about your experience')).toBe(mockApplicationConfig.personalInfo.experience);
            expect(getValue('describe your background')).toBe(mockApplicationConfig.personalInfo.experience);
        });

        it('should return salary information for salary fields', () => {
            const getValue = (formFiller as unknown as { getValueForField: (field: string) => string | null }).getValueForField.bind(formFiller);

            const salaryValue = getValue('salary expectation');
            expect(salaryValue).toContain('70000');
            expect(salaryValue).toContain('100000');
            expect(salaryValue).toContain('USD');
        });

        it('should return years of experience for years fields', () => {
            const getValue = (formFiller as unknown as { getValueForField: (field: string) => string | null }).getValueForField.bind(formFiller);

            expect(getValue('years of experience')).toBe('3');
            expect(getValue('how many years experience')).toBe('3');
        });

        it('should return common answers for matching questions', () => {
            const getValue = (formFiller as unknown as { getValueForField: (field: string) => string | null }).getValueForField.bind(formFiller);

            expect(getValue('authorized to work')).toBe('Yes');
            expect(getValue('require sponsorship')).toBe('No');
            expect(getValue('willing to relocate')).toBe('Yes');
            expect(getValue('notice period')).toBe('2 weeks');
        });

        it('should return null for unrecognized fields', () => {
            const getValue = (formFiller as unknown as { getValueForField: (field: string) => string | null }).getValueForField.bind(formFiller);

            expect(getValue('random field name')).toBeNull();
            expect(getValue('unrecognized question')).toBeNull();
        });
    });

    describe('getNumericValueForField', () => {
        it('should return numeric salary for salary fields', () => {
            const getNumericValue = (formFiller as unknown as { getNumericValueForField: (field: string) => number | null }).getNumericValueForField.bind(formFiller);

            expect(getNumericValue('salary expectation')).toBe(70000);
            expect(getNumericValue('expected salary')).toBe(70000);
        });

        it('should return years as number for experience fields', () => {
            const getNumericValue = (formFiller as unknown as { getNumericValueForField: (field: string) => number | null }).getNumericValueForField.bind(formFiller);

            expect(getNumericValue('years of experience')).toBe(3);
            expect(getNumericValue('total experience')).toBe(3);
        });

        it('should return null for non-numeric fields', () => {
            const getNumericValue = (formFiller as unknown as { getNumericValueForField: (field: string) => number | null }).getNumericValueForField.bind(formFiller);

            expect(getNumericValue('random field')).toBeNull();
        });
    });

    describe('matchesPattern', () => {
        it('should correctly match patterns', () => {
            const matchesPattern = (formFiller as unknown as { matchesPattern: (text: string, patterns: string[]) => boolean }).matchesPattern.bind(formFiller);

            expect(matchesPattern('tell us about your experience', ['experience', 'background'])).toBe(true);
            expect(matchesPattern('salary expectation', ['salary', 'compensation'])).toBe(true);
            expect(matchesPattern('random text', ['experience', 'salary'])).toBe(false);
        });
    });
});

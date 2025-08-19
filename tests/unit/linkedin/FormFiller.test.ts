import { ElementHandle, Page } from 'puppeteer';
import { FormFiller } from '../../../src/linkedin/FormFiller';
import { ApplicationConfig, LogLevel } from '../../../src/types';
import { DelayUtils } from '../../../src/utils/DelayUtils';
import { Logger } from '../../../src/utils/Logger';

// Mock dependencies
jest.mock('../../../src/utils/DelayUtils');
jest.mock('../../../src/utils/Logger');

describe('FormFiller', () => {
    let formFiller: FormFiller;
    let mockPage: jest.Mocked<Page>;
    let mockElement: jest.Mocked<ElementHandle>;
    let mockLogger: jest.Mocked<Logger>;

    const mockConfig: ApplicationConfig = {
        personalInfo: {
            experience: 'Senior software engineer with 5 years of experience in React and Node.js',
            salaryExpectation: {
                min: 100000,
                max: 150000,
                currency: 'USD'
            }
        },
        commonAnswers: {
            'Are you authorized to work in the US?': 'Yes',
            'Do you require sponsorship?': 'No',
            'Are you willing to relocate?': 'Yes',
            'What is your notice period?': '2 weeks'
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock Logger
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        } as any;
        (Logger as jest.Mock).mockImplementation(() => mockLogger);

        // Mock DelayUtils
        (DelayUtils.formFieldDelay as jest.Mock).mockResolvedValue(undefined);
        (DelayUtils.randomDelay as jest.Mock).mockResolvedValue(undefined);
        (DelayUtils.getRandomTypingDelay as jest.Mock).mockReturnValue(100);

        // Mock ElementHandle
        mockElement = {
            $: jest.fn(),
            click: jest.fn(),
            type: jest.fn(),
            select: jest.fn(),
            evaluate: jest.fn()
        } as any;

        // Mock Page
        mockPage = {
            $: jest.fn(),
            $$: jest.fn(),
            waitForSelector: jest.fn(),
            keyboard: {
                press: jest.fn(),
                down: jest.fn(),
                up: jest.fn(),
                type: jest.fn()
            },
            mouse: {
                move: jest.fn(),
                click: jest.fn()
            }
        } as any;

        formFiller = new FormFiller(mockConfig);
    });

    describe('constructor', () => {
        it('should initialize with config and logger', () => {
            expect(Logger).toHaveBeenCalledWith(LogLevel.INFO);
            expect(formFiller).toBeInstanceOf(FormFiller);
        });
    });

    describe('fillApplicationForm', () => {
        it('should fill form sections and return count', async () => {
            const mockFormSections = [mockElement, mockElement];
            mockPage.$.mockResolvedValue(mockFormSections as any);

            // Mock fillFormSection to return 2 fields filled per section
            jest.spyOn(formFiller as any, 'fillFormSection')
                .mockResolvedValueOnce(2)
                .mockResolvedValueOnce(1);

            const result = await formFiller.fillApplicationForm(mockPage);

            expect(result).toBe(3); // 2 + 1
            expect(mockLogger.info).toHaveBeenCalledWith('Filled 3 form fields');
        });

        it('should handle errors gracefully and return 0', async () => {
            mockPage.$.mockRejectedValue(new Error('Page error'));

            const result = await formFiller.fillApplicationForm(mockPage);

            expect(result).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error filling application form')
            );
        });

        it('should handle empty form sections', async () => {
            mockPage.$.mockResolvedValue([]);

            const result = await formFiller.fillApplicationForm(mockPage);

            expect(result).toBe(0);
        });
    });

    describe('field detection and filling', () => {
        beforeEach(() => {
            // Mock getFieldLabel to return test labels
            jest.spyOn(formFiller as any, 'getFieldLabel')
                .mockResolvedValue('experience');
        });

        it('should fill text input fields', async () => {
            const mockTextInput = { ...mockElement };
            mockElement.$.mockResolvedValue(mockTextInput);

            jest.spyOn(formFiller as any, 'fillTextInput')
                .mockResolvedValue(true);

            const result = await (formFiller as any).fillFormElement(mockPage, mockElement);

            expect(result).toBe(true);
        });

        it('should fill number input fields', async () => {
            const mockNumberInput = { ...mockElement };
            mockElement.$
                .mockResolvedValueOnce(null) // no text input
                .mockResolvedValueOnce(mockNumberInput); // number input found

            jest.spyOn(formFiller as any, 'fillNumberInput')
                .mockResolvedValue(true);

            const result = await (formFiller as any).fillFormElement(mockPage, mockElement);

            expect(result).toBe(true);
        });

        it('should fill textarea fields', async () => {
            const mockTextarea = { ...mockElement };
            mockElement.$
                .mockResolvedValueOnce(null) // no text input
                .mockResolvedValueOnce(null) // no number input
                .mockResolvedValueOnce(mockTextarea); // textarea found

            jest.spyOn(formFiller as any, 'fillTextarea')
                .mockResolvedValue(true);

            const result = await (formFiller as any).fillFormElement(mockPage, mockElement);

            expect(result).toBe(true);
        });

        it('should return false when no fillable elements found', async () => {
            mockElement.$.mockResolvedValue(null);

            const result = await (formFiller as any).fillFormElement(mockPage, mockElement);

            expect(result).toBe(false);
        });
    });

    describe('getFieldLabel', () => {
        it('should extract label from label element', async () => {
            const mockLabelElement = { ...mockElement };
            mockLabelElement.evaluate.mockResolvedValue('Experience Level');
            mockElement.$.mockResolvedValue(mockLabelElement);

            const result = await (formFiller as any).getFieldLabel(mockElement);

            expect(result).toBe('experience level');
        });

        it('should extract label from aria-label attribute', async () => {
            const mockInput = { ...mockElement };
            mockInput.evaluate
                .mockResolvedValueOnce('Years of Experience') // aria-label
                .mockResolvedValueOnce(null); // placeholder

            mockElement.$
                .mockResolvedValueOnce(null) // no label element
                .mockResolvedValueOnce(mockInput); // input found

            const result = await (formFiller as any).getFieldLabel(mockElement);

            expect(result).toBe('years of experience');
        });

        it('should extract label from placeholder attribute', async () => {
            const mockInput = { ...mockElement };
            mockInput.evaluate
                .mockResolvedValueOnce(null) // no aria-label
                .mockResolvedValueOnce('Enter your salary expectation'); // placeholder

            mockElement.$
                .mockResolvedValueOnce(null) // no label element
                .mockResolvedValueOnce(mockInput); // input found

            const result = await (formFiller as any).getFieldLabel(mockElement);

            expect(result).toBe('enter your salary expectation');
        });

        it('should return null when no label found', async () => {
            mockElement.$.mockResolvedValue(null);

            const result = await (formFiller as any).getFieldLabel(mockElement);

            expect(result).toBeNull();
        });
    });

    describe('getValueForField', () => {
        it('should return years from experience for years fields', () => {
            const result = (formFiller as any).getValueForField('years of experience');
            expect(result).toBe('5'); // extracted from "5 years of experience"
        });

        it('should return salary range for salary fields', () => {
            const result = (formFiller as any).getValueForField('salary expectation');
            expect(result).toBe('100000-150000 USD');
        });

        it('should return experience text for general experience fields', () => {
            const result = (formFiller as any).getValueForField('tell us about your experience');
            expect(result).toBe(mockConfig.personalInfo.experience);
        });

        it('should return common answers for matching questions', () => {
            const result = (formFiller as any).getValueForField('are you authorized to work');
            expect(result).toBe('Yes');
        });

        it('should return work authorization answer for authorization fields', () => {
            const result = (formFiller as any).getValueForField('work authorization required');
            expect(result).toBe('Yes');
        });

        it('should return sponsorship answer for sponsorship fields', () => {
            const result = (formFiller as any).getValueForField('do you need visa sponsorship');
            expect(result).toBe('No');
        });

        it('should return relocation answer for relocation fields', () => {
            const result = (formFiller as any).getValueForField('willing to relocate');
            expect(result).toBe('Yes');
        });

        it('should return notice period for notice fields', () => {
            const result = (formFiller as any).getValueForField('notice period required');
            expect(result).toBe('2 weeks');
        });

        it('should return null for unrecognized fields', () => {
            const result = (formFiller as any).getValueForField('unknown field type');
            expect(result).toBeNull();
        });
    });

    describe('getNumericValueForField', () => {
        it('should return minimum salary for salary fields', () => {
            const result = (formFiller as any).getNumericValueForField('expected salary');
            expect(result).toBe(100000);
        });

        it('should return years of experience for years fields', () => {
            const result = (formFiller as any).getNumericValueForField('years of experience');
            expect(result).toBe(5);
        });

        it('should return default years when no match in experience text', () => {
            const configWithoutYears = {
                ...mockConfig,
                personalInfo: {
                    ...mockConfig.personalInfo,
                    experience: 'Experienced software engineer'
                }
            };
            const formFillerWithoutYears = new FormFiller(configWithoutYears);

            const result = (formFillerWithoutYears as any).getNumericValueForField('years of experience');
            expect(result).toBe(3);
        });

        it('should return null for unrecognized numeric fields', () => {
            const result = (formFiller as any).getNumericValueForField('unknown numeric field');
            expect(result).toBeNull();
        });
    });

    describe('fillTextInput', () => {
        it('should fill text input successfully', async () => {
            jest.spyOn(formFiller as any, 'getValueForField').mockReturnValue('test value');
            jest.spyOn(formFiller as any, 'typeWithDelay').mockResolvedValue(undefined);

            const result = await (formFiller as any).fillTextInput(mockPage, mockElement, 'experience');

            expect(result).toBe(true);
            expect(mockElement.click).toHaveBeenCalledWith({ clickCount: 3 });
            expect(DelayUtils.randomDelay).toHaveBeenCalledWith(100, 300);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Filled text input "experience" with value: test value'
            );
        });

        it('should return false when no value available', async () => {
            jest.spyOn(formFiller as any, 'getValueForField').mockReturnValue(null);

            const result = await (formFiller as any).fillTextInput(mockPage, mockElement, 'unknown');

            expect(result).toBe(false);
            expect(mockElement.click).not.toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            jest.spyOn(formFiller as any, 'getValueForField').mockReturnValue('test');
            mockElement.click.mockRejectedValue(new Error('Click failed'));

            const result = await (formFiller as any).fillTextInput(mockPage, mockElement, 'test');

            expect(result).toBe(false);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Error filling text input')
            );
        });
    });

    describe('fillNumberInput', () => {
        it('should fill number input successfully', async () => {
            jest.spyOn(formFiller as any, 'getNumericValueForField').mockReturnValue(100000);

            const result = await (formFiller as any).fillNumberInput(mockPage, mockElement, 'salary');

            expect(result).toBe(true);
            expect(mockElement.click).toHaveBeenCalledWith({ clickCount: 3 });
            expect(mockElement.type).toHaveBeenCalledWith('100000', { delay: 100 });
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Filled number input "salary" with value: 100000'
            );
        });

        it('should return false when no numeric value available', async () => {
            jest.spyOn(formFiller as any, 'getNumericValueForField').mockReturnValue(null);

            const result = await (formFiller as any).fillNumberInput(mockPage, mockElement, 'unknown');

            expect(result).toBe(false);
        });
    });

    describe('updateConfig', () => {
        it('should update configuration', () => {
            const newConfig: ApplicationConfig = {
                ...mockConfig,
                personalInfo: {
                    ...mockConfig.personalInfo,
                    experience: 'Updated experience'
                }
            };

            formFiller.updateConfig(newConfig);

            expect(mockLogger.debug).toHaveBeenCalledWith('Form filler configuration updated');
        });
    });

    describe('getUnfilledFields', () => {
        it('should return list of unfilled fields', async () => {
            const mockFormElements = [mockElement, mockElement];
            mockPage.$.mockResolvedValue(mockFormElements);

            jest.spyOn(formFiller as any, 'getFieldLabel')
                .mockResolvedValueOnce('known field')
                .mockResolvedValueOnce('unknown field');

            jest.spyOn(formFiller as any, 'getValueForField')
                .mockReturnValueOnce('some value')
                .mockReturnValueOnce(null);

            const result = await formFiller.getUnfilledFields(mockPage);

            expect(result).toEqual(['unknown field']);
        });

        it('should handle errors and return empty array', async () => {
            mockPage.$.mockRejectedValue(new Error('Page error'));

            const result = await formFiller.getUnfilledFields(mockPage);

            expect(result).toEqual([]);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error getting unfilled fields')
            );
        });
    });

    describe('field pattern matching', () => {
        it('should match experience patterns correctly', () => {
            const matchesPattern = (formFiller as any).matchesPattern.bind(formFiller);

            expect(matchesPattern('tell us about your experience', ['experience', 'background'])).toBe(true);
            expect(matchesPattern('describe your background', ['experience', 'background'])).toBe(true);
            expect(matchesPattern('unrelated field', ['experience', 'background'])).toBe(false);
        });

        it('should prioritize years of experience over general experience', () => {
            const getValue = (formFiller as any).getValueForField.bind(formFiller);

            // Years of experience should return numeric value
            expect(getValue('how many years of experience')).toBe('5');

            // General experience should return full text
            expect(getValue('describe your experience')).toBe(mockConfig.personalInfo.experience);
        });
    });
});

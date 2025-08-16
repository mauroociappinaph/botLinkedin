import { ElementHandle, Page } from 'puppeteer';
import { ApplicationConfig, LogLevel } from '../types';
import { DelayUtils } from '../utils/DelayUtils';
import { Logger } from '../utils/Logger';

/**
 * Handles automatic form filling for LinkedIn job applications
 * Fills experience fields, salary expectations, and common questions
 */
export class FormFiller {
  private config: ApplicationConfig;
  private logger: Logger;

  // Form field selectors for LinkedIn Easy Apply
  private static readonly FORM_SELECTORS = {
    // Text inputs
    TEXT_INPUT: 'input[type="text"]',
    EMAIL_INPUT: 'input[type="email"]',
    PHONE_INPUT: 'input[type="tel"]',
    NUMBER_INPUT: 'input[type="number"]',

    // Textareas
    TEXTAREA: 'textarea',

    // Select dropdowns
    SELECT: 'select',
    DROPDOWN_BUTTON: '[role="combobox"]',
    DROPDOWN_OPTION: '[role="option"]',

    // Radio buttons and checkboxes
    RADIO_INPUT: 'input[type="radio"]',
    CHECKBOX_INPUT: 'input[type="checkbox"]',

    // Common field patterns
    EXPERIENCE_FIELD: '[data-test-text-entity-list-form-component]',
    SALARY_FIELD: 'input[data-test-numeric-text-input]',
    YEARS_EXPERIENCE: 'input[aria-label*="years"]',

    // Form sections and containers
    FORM_SECTION: '.jobs-easy-apply-form-section__grouping',
    FORM_ELEMENT: '.jobs-easy-apply-form-element',
    FIELD_LABEL: '.jobs-easy-apply-form-element__label',

    // File upload
    FILE_INPUT: 'input[type="file"]',
    UPLOAD_BUTTON: '[data-test-file-upload-drop-zone]',
  } as const;

  // Common field patterns and their corresponding config keys
  private static readonly FIELD_PATTERNS = {
    // Experience related
    experience: [
      'experience',
      'background',
      'summary',
      'about',
      'describe yourself',
      'tell us about',
    ],

    // Salary related
    salary: [
      'salary',
      'compensation',
      'expected salary',
      'salary expectation',
      'desired salary',
      'pay',
    ],

    // Years of experience
    yearsExperience: [
      'years of experience',
      'years experience',
      'how many years',
      'experience in years',
      'total experience',
    ],

    // Authorization questions
    workAuthorization: [
      'authorized to work',
      'work authorization',
      'legally authorized',
      'eligible to work',
      'work permit',
    ],

    // Sponsorship questions
    sponsorship: [
      'sponsorship',
      'visa sponsorship',
      'require sponsorship',
      'need sponsorship',
      'h1b',
    ],

    // Relocation questions
    relocation: [
      'relocate',
      'relocation',
      'willing to move',
      'move to',
      'relocating',
    ],

    // Notice period
    noticePeriod: [
      'notice period',
      'availability',
      'start date',
      'when can you start',
      'notice',
    ],
  } as const;

  constructor(config: ApplicationConfig) {
    this.config = config;
    this.logger = new Logger(LogLevel.INFO);
  }

  /**
   * Fills all form fields in the current application step
   * @param page Puppeteer page instance
   * @returns Promise resolving to number of fields filled
   */
  async fillApplicationForm(page: Page): Promise<number> {
    try {
      this.logger.debug('Starting form filling process');

      let fieldsFilledCount = 0;

      // Get all form sections
      const formSections = await page.$$(
        FormFiller.FORM_SELECTORS.FORM_SECTION
      );

      for (const section of formSections) {
        const sectionFieldsCount = await this.fillFormSection(page, section);
        fieldsFilledCount += sectionFieldsCount;
      }

      this.logger.info(`Filled ${fieldsFilledCount} form fields`);
      return fieldsFilledCount;
    } catch (error) {
      this.logger.error(`Error filling application form: ${error}`);
      return 0;
    }
  }

  /**
   * Fills fields in a specific form section
   */
  private async fillFormSection(
    page: Page,
    section: ElementHandle
  ): Promise<number> {
    try {
      let fieldsFilledCount = 0;

      // Get all form elements in this section
      const formElements = await section.$$(
        FormFiller.FORM_SELECTORS.FORM_ELEMENT
      );

      for (const element of formElements) {
        const filled = await this.fillFormElement(page, element);
        if (filled) {
          fieldsFilledCount++;
          await DelayUtils.formFieldDelay(500, 1500);
        }
      }

      return fieldsFilledCount;
    } catch (error) {
      this.logger.debug(`Error filling form section: ${error}`);
      return 0;
    }
  }

  /**
   * Fills a single form element
   */
  private async fillFormElement(
    page: Page,
    element: ElementHandle
  ): Promise<boolean> {
    try {
      // Get the field label to understand what we're filling
      const label = await this.getFieldLabel(element);
      if (!label) {
        return false;
      }

      this.logger.debug(`Processing field with label: ${label}`);

      // Determine field type and fill accordingly
      const textInput = await element.$(
        'input[type="text"], input[type="email"], input[type="tel"]'
      );
      if (textInput) {
        return await this.fillTextInput(page, textInput, label);
      }

      const numberInput = await element.$('input[type="number"]');
      if (numberInput) {
        return await this.fillNumberInput(page, numberInput, label);
      }

      const textarea = await element.$('textarea');
      if (textarea) {
        return await this.fillTextarea(page, textarea, label);
      }

      const select = await element.$('select');
      if (select) {
        return await this.fillSelect(page, select, label);
      }

      const dropdown = await element.$('[role="combobox"]');
      if (dropdown) {
        return await this.fillDropdown(page, dropdown, label);
      }

      const radio = await element.$('input[type="radio"]');
      if (radio) {
        return await this.fillRadioButton(page, element, label);
      }

      const checkbox = await element.$('input[type="checkbox"]');
      if (checkbox) {
        return await this.fillCheckbox(page, checkbox, label);
      }

      return false;
    } catch (error) {
      this.logger.debug(`Error filling form element: ${error}`);
      return false;
    }
  }

  /**
   * Gets the label text for a form element
   */
  private async getFieldLabel(element: ElementHandle): Promise<string | null> {
    try {
      // Try to find label element
      const labelElement = await element.$(
        FormFiller.FORM_SELECTORS.FIELD_LABEL
      );
      if (labelElement) {
        const labelText = await labelElement.evaluate((el) =>
          el.textContent?.trim()
        );
        if (labelText) {
          return labelText.toLowerCase();
        }
      }

      // Try to find aria-label or placeholder
      const input = await element.$('input, textarea, select');
      if (input) {
        const ariaLabel = await input.evaluate((el) =>
          el.getAttribute('aria-label')
        );
        if (ariaLabel) {
          return ariaLabel.toLowerCase();
        }

        const placeholder = await input.evaluate((el) =>
          el.getAttribute('placeholder')
        );
        if (placeholder) {
          return placeholder.toLowerCase();
        }
      }

      return null;
    } catch (error) {
      this.logger.debug(`Error getting field label: ${error}`);
      return null;
    }
  }

  /**
   * Fills a text input field
   */
  private async fillTextInput(
    page: Page,
    input: ElementHandle,
    label: string
  ): Promise<boolean> {
    try {
      const value = this.getValueForField(label);
      if (!value) {
        return false;
      }

      // Clear existing value
      await input.click({ clickCount: 3 });
      await DelayUtils.randomDelay(100, 300);

      // Type new value with human-like speed
      await this.typeWithDelay(page, input, value);

      this.logger.debug(`Filled text input "${label}" with value: ${value}`);
      return true;
    } catch (error) {
      this.logger.debug(`Error filling text input: ${error}`);
      return false;
    }
  }

  /**
   * Fills a number input field
   */
  private async fillNumberInput(
    _page: Page,
    input: ElementHandle,
    label: string
  ): Promise<boolean> {
    try {
      const value = this.getNumericValueForField(label);
      if (value === null) {
        return false;
      }

      // Clear existing value
      await input.click({ clickCount: 3 });
      await DelayUtils.randomDelay(100, 300);

      // Type numeric value
      await input.type(value.toString(), {
        delay: DelayUtils.getRandomTypingDelay(50, 150),
      });

      this.logger.debug(`Filled number input "${label}" with value: ${value}`);
      return true;
    } catch (error) {
      this.logger.debug(`Error filling number input: ${error}`);
      return false;
    }
  }

  /**
   * Fills a textarea field
   */
  private async fillTextarea(
    page: Page,
    textarea: ElementHandle,
    label: string
  ): Promise<boolean> {
    try {
      const value = this.getValueForField(label);
      if (!value) {
        return false;
      }

      // Clear existing value
      await textarea.click({ clickCount: 3 });
      await DelayUtils.randomDelay(100, 300);

      // Type value with human-like speed
      await this.typeWithDelay(page, textarea, value);

      this.logger.debug(
        `Filled textarea "${label}" with value: ${value.substring(0, 50)}...`
      );
      return true;
    } catch (error) {
      this.logger.debug(`Error filling textarea: ${error}`);
      return false;
    }
  }

  /**
   * Fills a select dropdown
   */
  private async fillSelect(
    _page: Page,
    select: ElementHandle,
    label: string
  ): Promise<boolean> {
    try {
      const value = this.getValueForField(label);
      if (!value) {
        return false;
      }

      // Get all options
      const options = await select.$$('option');

      for (const option of options) {
        const optionText = await option.evaluate((el) =>
          el.textContent?.toLowerCase().trim()
        );
        const optionValue = await option.evaluate((el) =>
          el.value?.toLowerCase().trim()
        );

        if (
          optionText?.includes(value.toLowerCase()) ||
          optionValue?.includes(value.toLowerCase())
        ) {
          const optionValueAttr = await option.evaluate((el) => el.value);
          await select.select(optionValueAttr);

          this.logger.debug(
            `Selected option "${optionText}" for field "${label}"`
          );
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.debug(`Error filling select: ${error}`);
      return false;
    }
  }

  /**
   * Fills a custom dropdown (role="combobox")
   */
  private async fillDropdown(
    page: Page,
    dropdown: ElementHandle,
    label: string
  ): Promise<boolean> {
    try {
      const value = this.getValueForField(label);
      if (!value) {
        return false;
      }

      // Click to open dropdown
      await dropdown.click();
      await DelayUtils.randomDelay(500, 1000);

      // Look for matching options
      const options = await page.$$(FormFiller.FORM_SELECTORS.DROPDOWN_OPTION);

      for (const option of options) {
        const optionText = await option.evaluate((el) =>
          el.textContent?.toLowerCase().trim()
        );

        if (optionText?.includes(value.toLowerCase())) {
          await option.click();

          this.logger.debug(
            `Selected dropdown option "${optionText}" for field "${label}"`
          );
          return true;
        }
      }

      // Close dropdown if no match found
      await page.keyboard.press('Escape');
      return false;
    } catch (error) {
      this.logger.debug(`Error filling dropdown: ${error}`);
      return false;
    }
  }

  /**
   * Fills radio button based on label
   */
  private async fillRadioButton(
    _page: Page,
    container: ElementHandle,
    label: string
  ): Promise<boolean> {
    try {
      const value = this.getValueForField(label);
      if (!value) {
        return false;
      }

      // Get all radio buttons in this container
      const radioButtons = await container.$$('input[type="radio"]');

      for (const radio of radioButtons) {
        // Check the label or value of this radio button
        const radioLabel = await radio.evaluate((el) => {
          const label =
            el.nextElementSibling?.textContent || el.getAttribute('aria-label');
          return label?.toLowerCase().trim();
        });

        if (
          radioLabel?.includes(value.toLowerCase()) ||
          (value.toLowerCase() === 'yes' && radioLabel?.includes('yes')) ||
          (value.toLowerCase() === 'no' && radioLabel?.includes('no'))
        ) {
          await radio.click();

          this.logger.debug(
            `Selected radio button "${radioLabel}" for field "${label}"`
          );
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.debug(`Error filling radio button: ${error}`);
      return false;
    }
  }

  /**
   * Fills checkbox based on configuration
   */
  private async fillCheckbox(
    _page: Page,
    checkbox: ElementHandle,
    label: string
  ): Promise<boolean> {
    try {
      const value = this.getValueForField(label);
      if (!value) {
        return false;
      }

      const shouldCheck =
        value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
      const isChecked = await checkbox.evaluate((el) => (el as any).checked);

      if (shouldCheck !== isChecked) {
        await checkbox.click();

        this.logger.debug(
          `${shouldCheck ? 'Checked' : 'Unchecked'} checkbox for field "${label}"`
        );
        return true;
      }

      return false;
    } catch (error) {
      this.logger.debug(`Error filling checkbox: ${error}`);
      return false;
    }
  }

  /**
   * Types text with human-like delays
   */
  private async typeWithDelay(
    _page: Page,
    element: ElementHandle,
    text: string
  ): Promise<void> {
    await element.type(text, {
      delay: DelayUtils.getRandomTypingDelay(
        this.config.personalInfo.salaryExpectation.min || 50,
        this.config.personalInfo.salaryExpectation.max || 150
      ),
    });
  }

  /**
   * Gets the appropriate value for a field based on its label
   */
  private getValueForField(label: string): string | null {
    const lowerLabel = label.toLowerCase();

    // Check years of experience FIRST (more specific than general experience)
    if (
      this.matchesPattern(lowerLabel, FormFiller.FIELD_PATTERNS.yearsExperience)
    ) {
      // Extract years from experience text (simple heuristic)
      const match =
        this.config.personalInfo.experience.match(/(\d+)\s*years?/i);
      return match?.[1] ?? '3';
    }

    // Check salary fields
    if (this.matchesPattern(lowerLabel, FormFiller.FIELD_PATTERNS.salary)) {
      const { min, max, currency } = this.config.personalInfo.salaryExpectation;
      return `${min}-${max} ${currency}`;
    }

    // Check experience fields (general experience, after years check)
    if (this.matchesPattern(lowerLabel, FormFiller.FIELD_PATTERNS.experience)) {
      return this.config.personalInfo.experience;
    }

    // Check common answers
    for (const [question, answer] of Object.entries(
      this.config.commonAnswers
    )) {
      if (
        lowerLabel.includes(question.toLowerCase()) ||
        question.toLowerCase().includes(lowerLabel)
      ) {
        return answer;
      }
    }

    // Check specific patterns
    if (
      this.matchesPattern(
        lowerLabel,
        FormFiller.FIELD_PATTERNS.workAuthorization
      )
    ) {
      return (
        this.config.commonAnswers['Are you authorized to work in the US?'] ||
        'Yes'
      );
    }

    if (
      this.matchesPattern(lowerLabel, FormFiller.FIELD_PATTERNS.sponsorship)
    ) {
      return this.config.commonAnswers['Do you require sponsorship?'] || 'No';
    }

    if (this.matchesPattern(lowerLabel, FormFiller.FIELD_PATTERNS.relocation)) {
      return this.config.commonAnswers['Are you willing to relocate?'] || 'Yes';
    }

    if (
      this.matchesPattern(lowerLabel, FormFiller.FIELD_PATTERNS.noticePeriod)
    ) {
      return (
        this.config.commonAnswers['What is your notice period?'] || '2 weeks'
      );
    }

    return null;
  }

  /**
   * Gets numeric value for salary or years fields
   */
  private getNumericValueForField(label: string): number | null {
    const lowerLabel = label.toLowerCase();

    // Salary fields
    if (this.matchesPattern(lowerLabel, FormFiller.FIELD_PATTERNS.salary)) {
      // Return minimum salary as default
      return this.config.personalInfo.salaryExpectation.min;
    }

    // Years of experience
    if (
      this.matchesPattern(lowerLabel, FormFiller.FIELD_PATTERNS.yearsExperience)
    ) {
      const match =
        this.config.personalInfo.experience.match(/(\d+)\s*years?/i);
      return match?.[1] ? parseInt(match[1], 10) : 3;
    }

    return null;
  }

  /**
   * Checks if a label matches any pattern in the given array
   */
  private matchesPattern(label: string, patterns: readonly string[]): boolean {
    return patterns.some((pattern) => label.includes(pattern));
  }

  /**
   * Updates the configuration for form filling
   */
  updateConfig(config: ApplicationConfig): void {
    this.config = config;
    this.logger.debug('Form filler configuration updated');
  }

  /**
   * Gets fields that couldn't be filled (for logging purposes)
   */
  async getUnfilledFields(page: Page): Promise<string[]> {
    try {
      const unfilledFields: string[] = [];
      const formElements = await page.$$(
        FormFiller.FORM_SELECTORS.FORM_ELEMENT
      );

      for (const element of formElements) {
        const label = await this.getFieldLabel(element);
        if (label) {
          const value = this.getValueForField(label);
          if (!value) {
            unfilledFields.push(label);
          }
        }
      }

      return unfilledFields;
    } catch (error) {
      this.logger.error(`Error getting unfilled fields: ${error}`);
      return [];
    }
  }
}

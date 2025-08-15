// Core type definitions for the LinkedIn Job Bot

// Enums for better type safety and maintainability
export enum DatePosted {
    PAST_24H = 'past24h',
    PAST_WEEK = 'pastWeek',
    PAST_MONTH = 'pastMonth',
    ANY = 'any'
}

export enum ExperienceLevel {
    INTERNSHIP = 'internship',
    ENTRY = 'entry',
    ASSOCIATE = 'associate',
    MID = 'mid',
    DIRECTOR = 'director',
    EXECUTIVE = 'executive'
}

export enum JobType {
    FULL_TIME = 'fullTime',
    PART_TIME = 'partTime',
    CONTRACT = 'contract',
    TEMPORARY = 'temporary',
    VOLUNTEER = 'volunteer',
    INTERNSHIP = 'internship'
}

export enum JobStatus {
    FOUND = 'found',
    APPLIED = 'applied',
    SKIPPED = 'skipped',
    ERROR = 'error'
}

export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error'
}

export enum CaptchaType {
    RECAPTCHA = 'recaptcha',
    IMAGE = 'image',
    AUDIO = 'audio',
    UNKNOWN = 'unknown'
}

export enum FormFieldType {
    TEXT = 'text',
    SELECT = 'select',
    RADIO = 'radio',
    CHECKBOX = 'checkbox',
    TEXTAREA = 'textarea'
}

export interface JobSearchConfig {
    keywords: string[];
    location: string;
    datePosted: DatePosted;
    remoteWork: boolean;
    experienceLevel: ExperienceLevel[];
    jobType: JobType[];
    salaryRange?: {
        min?: number;
        max?: number;
    };
}

export interface ApplicationConfig {
    personalInfo: {
        experience: string;
        salaryExpectation: {
            min: number;
            max: number;
            currency: string;
        };
    };
    commonAnswers: Record<string, string>;
}

export interface BotConfig {
    linkedin: {
        email: string;
        password: string;
    };
    search: JobSearchConfig;
    application: ApplicationConfig;
    browser: {
        headless: boolean;
        slowMo: number;
        timeout: number;
    };
    delays: {
        minPageLoad: number;
        maxPageLoad: number;
        minTyping: number;
        maxTyping: number;
    };
}

export interface JobPosting {
    id: string;
    title: string;
    company: string;
    location: string;
    url: string;
    description?: string;
    appliedAt?: Date;
    status: JobStatus;
    errorMessage?: string;
    salary?: string;
    isEasyApply: boolean;
}

export interface ApplicationSession {
    id: string;
    startTime: Date;
    endTime?: Date;
    totalJobsFound: number;
    totalApplicationsSubmitted: number;
    totalSkipped: number;
    totalErrors: number;
    searchConfig: JobSearchConfig;
}

export interface DatabaseModels {
    JobPosting: JobPosting;
    ApplicationSession: ApplicationSession;
}

export interface BrowserSession {
    isLoggedIn: boolean;
    lastActivity: Date;
    sessionId?: string;
    cookies?: any[];
}

export interface CaptchaChallenge {
    detected: boolean;
    type: CaptchaType;
    timestamp: Date;
    resolved: boolean;
}
export interface BotError {
    code: string;
    message: string;
    timestamp: Date;
    context?: Record<string, any>;
    recoverable: boolean;
}

export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
    context?: Record<string, any>;
    jobId?: string;
    sessionId?: string;
}

export interface BotStats {
    sessionId: string;
    startTime: Date;
    endTime?: Date;
    jobsProcessed: number;
    applicationsSubmitted: number;
    duplicatesSkipped: number;
    errorsEncountered: number;
    captchasChallenged: number;
}

export interface FormField {
    selector: string;
    type: FormFieldType;
    value: string;
    required: boolean;
    filled: boolean;
}

export interface ApplicationForm {
    fields: FormField[];
    isMultiStep: boolean;
    currentStep: number;
    totalSteps: number;
    completed: boolean;
}
// Generic types for repository patterns and service responses
export interface Repository<T> {
    findById(id: string): Promise<T | null>;
    findAll(): Promise<T[]>;
    create(data: Omit<T, 'id'>): Promise<T>;
    update(id: string, data: Partial<T>): Promise<T>;
    delete(id: string): Promise<boolean>;
}

export interface ServiceResponse<T> {
    success: boolean;
    data?: T;
    error?: BotError;
    message?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

export interface SearchResult<T> {
    results: T[];
    totalCount: number;
    searchTime: number;
    filters: Record<string, any>;
}

// Validation schema types (for future Zod integration)
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

export interface ValidationError {
    field: string;
    message: string;
    code: string;
    value?: any;
}

// Event system types
export interface BotEvent<T = any> {
    type: string;
    timestamp: Date;
    data: T;
    sessionId: string;
}

export interface EventHandler<T = any> {
    handle(event: BotEvent<T>): Promise<void>;
}

// Configuration validation types
export interface ConfigValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

// Browser automation types
export interface BrowserAction {
    type: 'click' | 'type' | 'wait' | 'navigate' | 'scroll';
    selector?: string;
    value?: string;
    timeout?: number;
}

export interface BrowserActionResult {
    success: boolean;
    error?: string;
    duration: number;
    screenshot?: string;
}

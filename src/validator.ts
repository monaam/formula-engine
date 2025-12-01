import { FormulaEngine } from './formula-engine';
import { EvaluationContext } from './types';
import { Decimal } from './decimal-utils';

// ============================================================================
// Validation Types
// ============================================================================

export enum ValidationRuleType {
  REQUIRED = 'REQUIRED',
  RANGE = 'RANGE',
  PATTERN = 'PATTERN',
  CUSTOM = 'CUSTOM',
  CROSS_FIELD = 'CROSS_FIELD',
}

export interface BaseValidationRule {
  type: ValidationRuleType;
  field: string;
  message?: string;
  when?: string; // Conditional - only validate when this expression is true
}

export interface RequiredRule extends BaseValidationRule {
  type: ValidationRuleType.REQUIRED;
  allowEmpty?: boolean; // Allow empty strings (default: false)
  allowZero?: boolean; // Allow zero values (default: true)
}

export interface RangeRule extends BaseValidationRule {
  type: ValidationRuleType.RANGE;
  min?: number | string; // Can be expression like "$otherField"
  max?: number | string;
  exclusive?: boolean; // Use < > instead of <= >=
}

export interface PatternRule extends BaseValidationRule {
  type: ValidationRuleType.PATTERN;
  pattern: string; // Regex pattern
  flags?: string; // Regex flags (e.g., 'i' for case-insensitive)
}

export interface CustomRule extends BaseValidationRule {
  type: ValidationRuleType.CUSTOM;
  expression: string; // Formula expression that should return true for valid
}

export interface CrossFieldRule extends BaseValidationRule {
  type: ValidationRuleType.CROSS_FIELD;
  expression: string; // Expression involving multiple fields
  dependsOn: string[]; // Fields this rule depends on
}

export type ValidationRule =
  | RequiredRule
  | RangeRule
  | PatternRule
  | CustomRule
  | CrossFieldRule;

export interface ValidationError {
  field: string;
  rule: ValidationRuleType;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// Validator Class
// ============================================================================

export class Validator {
  private engine: FormulaEngine;
  private rules: ValidationRule[] = [];

  constructor(engine?: FormulaEngine) {
    this.engine = engine || new FormulaEngine({ strictMode: false });
  }

  /**
   * Add a validation rule
   */
  addRule(rule: ValidationRule): this {
    this.rules.push(rule);
    return this;
  }

  /**
   * Add multiple validation rules
   */
  addRules(rules: ValidationRule[]): this {
    this.rules.push(...rules);
    return this;
  }

  /**
   * Clear all rules
   */
  clearRules(): this {
    this.rules = [];
    return this;
  }

  /**
   * Validate data against all rules
   */
  validate(data: Record<string, unknown>, context?: EvaluationContext): ValidationResult {
    const errors: ValidationError[] = [];
    const evalContext: EvaluationContext = {
      variables: { ...data },
      extra: context?.extra,
      collections: context?.collections,
    };

    for (const rule of this.rules) {
      // Check conditional validation
      if (rule.when) {
        const whenResult = this.engine.evaluate(rule.when, evalContext);
        if (!whenResult.success || !this.toBoolean(whenResult.value)) {
          continue; // Skip this rule
        }
      }

      const error = this.validateRule(rule, data, evalContext);
      if (error) {
        errors.push(error);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a single rule
   */
  private validateRule(
    rule: ValidationRule,
    data: Record<string, unknown>,
    context: EvaluationContext
  ): ValidationError | null {
    switch (rule.type) {
      case ValidationRuleType.REQUIRED:
        return this.validateRequired(rule, data);

      case ValidationRuleType.RANGE:
        return this.validateRange(rule, data, context);

      case ValidationRuleType.PATTERN:
        return this.validatePattern(rule, data);

      case ValidationRuleType.CUSTOM:
        return this.validateCustom(rule, context);

      case ValidationRuleType.CROSS_FIELD:
        return this.validateCrossField(rule, context);

      default:
        return null;
    }
  }

  /**
   * Validate REQUIRED rule
   */
  private validateRequired(rule: RequiredRule, data: Record<string, unknown>): ValidationError | null {
    const value = this.getFieldValue(data, rule.field);

    // Check null/undefined
    if (value === null || value === undefined) {
      return this.createError(rule, value, `${rule.field} is required`);
    }

    // Check empty string
    if (!rule.allowEmpty && typeof value === 'string' && value.trim() === '') {
      return this.createError(rule, value, `${rule.field} cannot be empty`);
    }

    // Check empty array
    if (Array.isArray(value) && value.length === 0) {
      return this.createError(rule, value, `${rule.field} cannot be empty`);
    }

    // Check zero (unless allowed)
    if (rule.allowZero === false) {
      const numValue = this.toNumber(value);
      if (numValue === 0) {
        return this.createError(rule, value, `${rule.field} cannot be zero`);
      }
    }

    return null;
  }

  /**
   * Validate RANGE rule
   */
  private validateRange(
    rule: RangeRule,
    data: Record<string, unknown>,
    context: EvaluationContext
  ): ValidationError | null {
    const value = this.getFieldValue(data, rule.field);

    if (value === null || value === undefined) {
      return null; // Let REQUIRED rule handle this
    }

    const numValue = this.toNumber(value);
    if (numValue === null) {
      return this.createError(rule, value, `${rule.field} must be a number`);
    }

    // Resolve min/max (could be expressions)
    let min: number | null = null;
    let max: number | null = null;

    if (rule.min !== undefined) {
      if (typeof rule.min === 'string' && rule.min.includes('$')) {
        const result = this.engine.evaluate(rule.min, context);
        min = result.success ? this.toNumber(result.value) : null;
      } else {
        min = typeof rule.min === 'number' ? rule.min : parseFloat(rule.min);
      }
    }

    if (rule.max !== undefined) {
      if (typeof rule.max === 'string' && rule.max.includes('$')) {
        const result = this.engine.evaluate(rule.max, context);
        max = result.success ? this.toNumber(result.value) : null;
      } else {
        max = typeof rule.max === 'number' ? rule.max : parseFloat(rule.max);
      }
    }

    // Check range
    if (min !== null) {
      const minViolation = rule.exclusive ? numValue <= min : numValue < min;
      if (minViolation) {
        const op = rule.exclusive ? '>' : '>=';
        return this.createError(rule, value, `${rule.field} must be ${op} ${min}`);
      }
    }

    if (max !== null) {
      const maxViolation = rule.exclusive ? numValue >= max : numValue > max;
      if (maxViolation) {
        const op = rule.exclusive ? '<' : '<=';
        return this.createError(rule, value, `${rule.field} must be ${op} ${max}`);
      }
    }

    return null;
  }

  /**
   * Validate PATTERN rule
   */
  private validatePattern(rule: PatternRule, data: Record<string, unknown>): ValidationError | null {
    const value = this.getFieldValue(data, rule.field);

    if (value === null || value === undefined) {
      return null; // Let REQUIRED rule handle this
    }

    const strValue = String(value);
    const regex = new RegExp(rule.pattern, rule.flags);

    if (!regex.test(strValue)) {
      return this.createError(rule, value, `${rule.field} format is invalid`);
    }

    return null;
  }

  /**
   * Validate CUSTOM rule
   */
  private validateCustom(rule: CustomRule, context: EvaluationContext): ValidationError | null {
    const result = this.engine.evaluate(rule.expression, context);

    if (!result.success) {
      return this.createError(rule, null, `Validation error: ${result.error?.message}`);
    }

    if (!this.toBoolean(result.value)) {
      return this.createError(rule, context.variables[rule.field], `${rule.field} is invalid`);
    }

    return null;
  }

  /**
   * Validate CROSS_FIELD rule
   */
  private validateCrossField(rule: CrossFieldRule, context: EvaluationContext): ValidationError | null {
    // Check if all dependent fields exist
    for (const dep of rule.dependsOn) {
      if (!(dep in context.variables)) {
        return null; // Skip if dependencies not present
      }
    }

    const result = this.engine.evaluate(rule.expression, context);

    if (!result.success) {
      return this.createError(rule, null, `Validation error: ${result.error?.message}`);
    }

    if (!this.toBoolean(result.value)) {
      return this.createError(
        rule,
        null,
        rule.message || `Cross-field validation failed for ${rule.field}`
      );
    }

    return null;
  }

  /**
   * Get nested field value using dot notation
   */
  private getFieldValue(data: Record<string, unknown>, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = data;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      if (typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Convert value to number
   */
  private toNumber(value: unknown): number | null {
    if (value instanceof Decimal) {
      return value.toNumber();
    }
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    }
    return null;
  }

  /**
   * Convert value to boolean
   */
  private toBoolean(value: unknown): boolean {
    if (value instanceof Decimal) {
      return !value.isZero();
    }
    return Boolean(value);
  }

  /**
   * Create validation error
   */
  private createError(
    rule: ValidationRule,
    value: unknown,
    defaultMessage: string
  ): ValidationError {
    return {
      field: rule.field,
      rule: rule.type,
      message: rule.message || defaultMessage,
      value,
    };
  }
}

// ============================================================================
// Builder Pattern for Fluent API
// ============================================================================

export class ValidationBuilder {
  private rules: ValidationRule[] = [];

  /**
   * Add a required field validation
   */
  required(field: string, options?: Partial<Omit<RequiredRule, 'type' | 'field'>>): this {
    this.rules.push({
      type: ValidationRuleType.REQUIRED,
      field,
      ...options,
    });
    return this;
  }

  /**
   * Add a range validation
   */
  range(field: string, options: Omit<RangeRule, 'type' | 'field'>): this {
    this.rules.push({
      type: ValidationRuleType.RANGE,
      field,
      ...options,
    });
    return this;
  }

  /**
   * Add minimum value validation
   */
  min(field: string, min: number | string, options?: { exclusive?: boolean; message?: string }): this {
    this.rules.push({
      type: ValidationRuleType.RANGE,
      field,
      min,
      ...options,
    });
    return this;
  }

  /**
   * Add maximum value validation
   */
  max(field: string, max: number | string, options?: { exclusive?: boolean; message?: string }): this {
    this.rules.push({
      type: ValidationRuleType.RANGE,
      field,
      max,
      ...options,
    });
    return this;
  }

  /**
   * Add pattern validation
   */
  pattern(field: string, pattern: string, options?: { flags?: string; message?: string }): this {
    this.rules.push({
      type: ValidationRuleType.PATTERN,
      field,
      pattern,
      ...options,
    });
    return this;
  }

  /**
   * Add email validation
   */
  email(field: string, options?: { message?: string }): this {
    return this.pattern(field, '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', {
      message: options?.message || `${field} must be a valid email address`,
    });
  }

  /**
   * Add custom expression validation
   */
  custom(field: string, expression: string, options?: { message?: string; when?: string }): this {
    this.rules.push({
      type: ValidationRuleType.CUSTOM,
      field,
      expression,
      ...options,
    });
    return this;
  }

  /**
   * Add cross-field validation
   */
  crossField(
    field: string,
    expression: string,
    dependsOn: string[],
    options?: { message?: string; when?: string }
  ): this {
    this.rules.push({
      type: ValidationRuleType.CROSS_FIELD,
      field,
      expression,
      dependsOn,
      ...options,
    });
    return this;
  }

  /**
   * Build the rules array
   */
  build(): ValidationRule[] {
    return [...this.rules];
  }

  /**
   * Create a validator with these rules
   */
  toValidator(engine?: FormulaEngine): Validator {
    const validator = new Validator(engine);
    validator.addRules(this.rules);
    return validator;
  }
}

/**
 * Create a new validation builder
 */
export function validate(): ValidationBuilder {
  return new ValidationBuilder();
}

import { ValueType } from './types';

export type ErrorCategory = 'PARSE' | 'VALIDATION' | 'EVALUATION' | 'CONFIGURATION';

export abstract class FormulaEngineError extends Error {
  abstract readonly code: string;
  abstract readonly category: ErrorCategory;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ============================================================================
// Parse Errors
// ============================================================================

export class SyntaxError extends FormulaEngineError {
  readonly code = 'PARSE_SYNTAX_ERROR';
  readonly category: ErrorCategory = 'PARSE';

  constructor(
    message: string,
    public position: number,
    public line: number,
    public column: number,
    public expression: string
  ) {
    super(`${message} at line ${line}, column ${column}`);
  }
}

export class UnexpectedTokenError extends FormulaEngineError {
  readonly code = 'PARSE_UNEXPECTED_TOKEN';
  readonly category: ErrorCategory = 'PARSE';

  constructor(
    public token: string,
    public expected: string[],
    public position: number
  ) {
    super(`Unexpected token '${token}', expected one of: ${expected.join(', ')}`);
  }
}

export class UnterminatedStringError extends FormulaEngineError {
  readonly code = 'PARSE_UNTERMINATED_STRING';
  readonly category: ErrorCategory = 'PARSE';

  constructor(position: number) {
    super(`Unterminated string starting at position ${position}`);
  }
}

export class InvalidNumberError extends FormulaEngineError {
  readonly code = 'PARSE_INVALID_NUMBER';
  readonly category: ErrorCategory = 'PARSE';

  constructor(value: string, position: number) {
    super(`Invalid number '${value}' at position ${position}`);
  }
}

// ============================================================================
// Validation Errors
// ============================================================================

export class CircularDependencyError extends FormulaEngineError {
  readonly code = 'VALIDATION_CIRCULAR_DEPENDENCY';
  readonly category: ErrorCategory = 'VALIDATION';

  constructor(
    public cycle: string[],
    public involvedFormulas: string[]
  ) {
    super(`Circular dependency detected: ${cycle.join(' → ')}`);
  }
}

export class UndefinedVariableError extends FormulaEngineError {
  readonly code = 'VALIDATION_UNDEFINED_VARIABLE';
  readonly category: ErrorCategory = 'VALIDATION';

  constructor(
    public variableName: string,
    public expression: string
  ) {
    super(`Undefined variable: ${variableName}`);
  }
}

export class UndefinedFunctionError extends FormulaEngineError {
  readonly code = 'VALIDATION_UNDEFINED_FUNCTION';
  readonly category: ErrorCategory = 'VALIDATION';

  constructor(public functionName: string) {
    super(`Undefined function: ${functionName}`);
  }
}

export class DuplicateFormulaError extends FormulaEngineError {
  readonly code = 'VALIDATION_DUPLICATE_FORMULA';
  readonly category: ErrorCategory = 'VALIDATION';

  constructor(public formulaId: string) {
    super(`Duplicate formula ID: ${formulaId}`);
  }
}

// ============================================================================
// Evaluation Errors
// ============================================================================

export class DivisionByZeroError extends FormulaEngineError {
  readonly code = 'EVAL_DIVISION_BY_ZERO';
  readonly category: ErrorCategory = 'EVALUATION';

  constructor() {
    super('Division by zero');
  }
}

export class TypeMismatchError extends FormulaEngineError {
  readonly code = 'EVAL_TYPE_MISMATCH';
  readonly category: ErrorCategory = 'EVALUATION';

  constructor(
    public expected: ValueType | ValueType[] | string,
    public actual: ValueType | string,
    public context: string
  ) {
    const expectedStr = Array.isArray(expected) ? expected.join(' or ') : expected;
    super(`Type mismatch: expected ${expectedStr}, got ${actual} in ${context}`);
  }
}

export class ArgumentCountError extends FormulaEngineError {
  readonly code = 'EVAL_ARGUMENT_COUNT';
  readonly category: ErrorCategory = 'EVALUATION';

  constructor(
    public functionName: string,
    public expected: { min: number; max: number },
    public actual: number
  ) {
    const expectedStr = expected.min === expected.max
      ? `${expected.min}`
      : expected.max === -1
        ? `at least ${expected.min}`
        : `${expected.min}-${expected.max}`;
    super(`Function ${functionName} expects ${expectedStr} arguments, got ${actual}`);
  }
}

export class InvalidOperationError extends FormulaEngineError {
  readonly code = 'EVAL_INVALID_OPERATION';
  readonly category: ErrorCategory = 'EVALUATION';

  constructor(
    public operator: string,
    public operandTypes: string[]
  ) {
    super(`Cannot apply operator '${operator}' to types: ${operandTypes.join(', ')}`);
  }
}

export class PropertyAccessError extends FormulaEngineError {
  readonly code = 'EVAL_PROPERTY_ACCESS';
  readonly category: ErrorCategory = 'EVALUATION';

  constructor(
    public property: string,
    public objectType: string
  ) {
    super(`Cannot access property '${property}' on ${objectType}`);
  }
}

export class IndexAccessError extends FormulaEngineError {
  readonly code = 'EVAL_INDEX_ACCESS';
  readonly category: ErrorCategory = 'EVALUATION';

  constructor(
    public index: unknown,
    public objectType: string
  ) {
    super(`Cannot use index '${index}' on ${objectType}`);
  }
}

// ============================================================================
// Decimal Errors
// ============================================================================

export class DecimalError extends FormulaEngineError {
  readonly code: string = 'DECIMAL_ERROR';
  readonly category: ErrorCategory = 'EVALUATION';

  constructor(message: string) {
    super(message);
  }
}

export class DecimalOverflowError extends DecimalError {
  override readonly code: string = 'DECIMAL_OVERFLOW';

  constructor(public value: string, public maxExponent: number) {
    super(`Decimal overflow: exponent exceeds ${maxExponent}`);
  }
}

export class DecimalUnderflowError extends DecimalError {
  override readonly code: string = 'DECIMAL_UNDERFLOW';

  constructor(public value: string, public minExponent: number) {
    super(`Decimal underflow: exponent below ${minExponent}`);
  }
}

export class DecimalDivisionByZeroError extends DecimalError {
  override readonly code: string = 'DECIMAL_DIVISION_BY_ZERO';

  constructor() {
    super('Division by zero');
  }
}

export class InvalidDecimalError extends DecimalError {
  override readonly code: string = 'INVALID_DECIMAL';

  constructor(public input: string) {
    super(`Invalid decimal value: "${input}"`);
  }
}

// ============================================================================
// Configuration Errors
// ============================================================================

export class ConfigurationError extends FormulaEngineError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly category: ErrorCategory = 'CONFIGURATION';

  constructor(message: string) {
    super(message);
  }
}

// ============================================================================
// Security Errors
// ============================================================================

export class SecurityError extends FormulaEngineError {
  readonly code: string = 'SECURITY_ERROR';
  readonly category: ErrorCategory = 'EVALUATION';

  constructor(message: string) {
    super(message);
  }
}

export class MaxIterationsError extends SecurityError {
  override readonly code: string = 'MAX_ITERATIONS_EXCEEDED';

  constructor(limit: number) {
    super(`Maximum iterations exceeded: ${limit}`);
  }
}

export class MaxRecursionError extends SecurityError {
  override readonly code: string = 'MAX_RECURSION_EXCEEDED';

  constructor(limit: number) {
    super(`Maximum recursion depth exceeded: ${limit}`);
  }
}

export class MaxExpressionLengthError extends SecurityError {
  override readonly code: string = 'MAX_EXPRESSION_LENGTH_EXCEEDED';

  constructor(length: number, limit: number) {
    super(`Expression length ${length} exceeds maximum ${limit}`);
  }
}

// Concrete class for general errors
export class GeneralFormulaError extends FormulaEngineError {
  readonly code: string = 'GENERAL_ERROR';
  readonly category: ErrorCategory = 'EVALUATION';

  constructor(message: string) {
    super(message);
  }
}

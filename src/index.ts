// Main exports
export { FormulaEngine } from './formula-engine';

// Types
export {
  // Configuration
  FormulaEngineConfig,
  FormulaDefinition,
  EvaluationContext,
  FunctionDefinition,
  ArgumentType,
  FunctionImplementation,

  // Decimal
  DecimalConfig,
  DecimalRoundingMode,
  RoundingConfig,

  // Results
  EvaluationResult,
  EvaluationResultSet,
  EvaluateAllOptions,
  ValidationResult,
  CacheStats,

  // Error handling
  ErrorBehavior,
  SecurityConfig,

  // AST nodes
  ASTNode,
  DecimalLiteral,
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  NullLiteral,
  ArrayLiteral,
  ObjectLiteral,
  ObjectLiteralProperty,
  VariableReference,
  BinaryOperation,
  UnaryOperation,
  ConditionalExpression,
  FunctionCall,
  MemberAccess,
  IndexAccess,

  // Graph
  DependencyGraph,

  // Values
  ValueType,
  FormulaValue,
} from './types';

// Components (for advanced usage)
export { Parser } from './parser';
export { Lexer } from './lexer';
export { Evaluator } from './evaluator';
export { DependencyExtractor } from './dependency-extractor';
export { DependencyGraph as DependencyGraphImpl, DependencyGraphBuilder } from './dependency-graph';
export { DecimalUtils, Decimal, DecimalLike } from './decimal-utils';
export { createBuiltInFunctions } from './functions';

// Errors
export {
  FormulaEngineError,
  GeneralFormulaError,
  ErrorCategory,

  // Parse errors
  SyntaxError,
  UnexpectedTokenError,
  UnterminatedStringError,
  InvalidNumberError,

  // Validation errors
  CircularDependencyError,
  UndefinedVariableError,
  UndefinedFunctionError,
  DuplicateFormulaError,

  // Evaluation errors
  DivisionByZeroError,
  TypeMismatchError,
  ArgumentCountError,
  InvalidOperationError,
  PropertyAccessError,
  IndexAccessError,

  // Decimal errors
  DecimalError,
  DecimalOverflowError,
  DecimalUnderflowError,
  DecimalDivisionByZeroError,
  InvalidDecimalError,

  // Configuration errors
  ConfigurationError,

  // Security errors
  SecurityError,
  MaxIterationsError,
  MaxRecursionError,
  MaxExpressionLengthError,
} from './errors';

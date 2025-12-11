import { Decimal } from 'decimal.js';

// ============================================================================
// Value Types
// ============================================================================

export type ValueType = 'number' | 'decimal' | 'string' | 'boolean' | 'array' | 'object' | 'null' | 'any';

export type FormulaValue = Decimal | number | string | boolean | null | FormulaValue[] | { [key: string]: FormulaValue };

// ============================================================================
// Decimal Configuration
// ============================================================================

export enum DecimalRoundingMode {
  CEIL = 'CEIL',
  FLOOR = 'FLOOR',
  DOWN = 'DOWN',
  UP = 'UP',
  HALF_UP = 'HALF_UP',
  HALF_DOWN = 'HALF_DOWN',
  HALF_EVEN = 'HALF_EVEN',
  HALF_ODD = 'HALF_ODD',
}

export interface DecimalConfig {
  precision?: number;
  roundingMode?: DecimalRoundingMode;
  divisionScale?: number;
  preserveTrailingZeros?: boolean;
  autoConvertFloats?: boolean;
  maxExponent?: number;
  minExponent?: number;
}

// ============================================================================
// Rounding Configuration
// ============================================================================

export interface RoundingConfig {
  mode: 'HALF_UP' | 'HALF_DOWN' | 'FLOOR' | 'CEIL' | 'NONE';
  precision: number;
}

// ============================================================================
// Error Behavior
// ============================================================================

export interface ErrorBehavior {
  type: 'THROW' | 'NULL' | 'ZERO' | 'DEFAULT' | 'SKIP';
  defaultValue?: unknown;
}

// ============================================================================
// Formula Definition
// ============================================================================

export interface FormulaDefinition {
  id: string;
  expression: string;
  dependencies?: string[];
  onError?: ErrorBehavior;
  defaultValue?: unknown;
  rounding?: RoundingConfig;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Evaluation Context
// ============================================================================

export interface EvaluationContext {
  variables: Record<string, unknown>;
  collections?: Record<string, unknown[]>;
  extra?: Record<string, unknown>;
}

// ============================================================================
// Engine Configuration
// ============================================================================

export interface OperatorDefinition {
  symbol: string;
  precedence: number;
  associativity: 'left' | 'right';
  handler: (left: unknown, right: unknown) => unknown;
}

export interface SecurityConfig {
  maxExpressionLength?: number;
  maxRecursionDepth?: number;
  maxIterations?: number;
  maxExecutionTime?: number;
  allowedFunctions?: string[];
  blockedFunctions?: string[];
}

export interface FormulaEngineConfig {
  enableCache?: boolean;
  maxCacheSize?: number;
  defaultErrorBehavior?: ErrorBehavior;
  defaultRounding?: RoundingConfig;
  variablePrefix?: string;
  contextPrefix?: string;
  strictMode?: boolean;
  operators?: OperatorDefinition[];
  functions?: FunctionDefinition[];
  decimal?: DecimalConfig;
  security?: SecurityConfig;
}

// ============================================================================
// AST Node Types
// ============================================================================

export interface DecimalLiteral {
  type: 'DecimalLiteral';
  value: string;
  raw: string;
}

export interface NumberLiteral {
  type: 'NumberLiteral';
  value: number;
}

export interface StringLiteral {
  type: 'StringLiteral';
  value: string;
}

export interface BooleanLiteral {
  type: 'BooleanLiteral';
  value: boolean;
}

export interface NullLiteral {
  type: 'NullLiteral';
}

export interface ArrayLiteral {
  type: 'ArrayLiteral';
  elements: ASTNode[];
}

export interface VariableReference {
  type: 'VariableReference';
  prefix: '$' | '@';
  name: string;
}

export interface BinaryOperation {
  type: 'BinaryOperation';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryOperation {
  type: 'UnaryOperation';
  operator: string;
  operand: ASTNode;
}

export interface ConditionalExpression {
  type: 'ConditionalExpression';
  condition: ASTNode;
  consequent: ASTNode;
  alternate: ASTNode;
}

export interface FunctionCall {
  type: 'FunctionCall';
  name: string;
  arguments: ASTNode[];
}

export interface MemberAccess {
  type: 'MemberAccess';
  object: ASTNode;
  property: string;
}

export interface IndexAccess {
  type: 'IndexAccess';
  object: ASTNode;
  index: ASTNode;
}

export type ASTNode =
  | DecimalLiteral
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | NullLiteral
  | ArrayLiteral
  | VariableReference
  | BinaryOperation
  | UnaryOperation
  | ConditionalExpression
  | FunctionCall
  | MemberAccess
  | IndexAccess;

// ============================================================================
// Function Definition
// ============================================================================

export interface ArgumentType {
  name: string;
  type: ValueType;
  required: boolean;
  default?: unknown;
}

export type FunctionImplementation = (
  args: unknown[],
  context: EvaluationContext,
  engine: unknown
) => unknown;

export interface FunctionDefinition {
  name: string;
  minArgs: number;
  maxArgs: number;
  argTypes?: ArgumentType[];
  returnType: ValueType;
  implementation: FunctionImplementation;
  description?: string;
}

// ============================================================================
// Dependency Graph
// ============================================================================

export interface DependencyGraph {
  nodes: Set<string>;
  edges: Map<string, Set<string>>;
  hasCycles(): boolean;
  getRoots(): Set<string>;
  getDependents(nodeId: string): Set<string>;
  getDependencies(nodeId: string): Set<string>;
  getTransitiveDependencies(nodeId: string): Set<string>;
  topologicalSort(): string[];
}

// ============================================================================
// Evaluation Results
// ============================================================================

export interface EvaluationResult {
  value: unknown;
  success: boolean;
  error?: Error;
  executionTimeMs: number;
  accessedVariables: Set<string>;
}

export interface EvaluationResultSet {
  results: Map<string, EvaluationResult>;
  success: boolean;
  errors: Error[];
  totalExecutionTimeMs: number;
  evaluationOrder: string[];
}

// ============================================================================
// Batch Evaluation Options
// ============================================================================

export interface EvaluateAllOptions {
  /**
   * When true, disables automatic intermediate rounding even if defaultRounding
   * is configured in the engine. Per-formula rounding configurations are still applied.
   * @default false
   */
  disableIntermediateRounding?: boolean;
}

// ============================================================================
// Validation Result
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: Error[];
  warnings: string[];
  dependencyGraph: DependencyGraph;
  evaluationOrder: string[];
}

// ============================================================================
// Cache Statistics
// ============================================================================

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

// ============================================================================
// Token Types
// ============================================================================

export enum TokenType {
  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
  NULL = 'NULL',

  // Identifiers and Variables
  IDENTIFIER = 'IDENTIFIER',
  VARIABLE = 'VARIABLE',
  CONTEXT_VAR = 'CONTEXT_VAR',

  // Operators
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  MULTIPLY = 'MULTIPLY',
  DIVIDE = 'DIVIDE',
  MODULO = 'MODULO',
  POWER = 'POWER',

  // Comparison
  EQ = 'EQ',
  NEQ = 'NEQ',
  LT = 'LT',
  GT = 'GT',
  LTE = 'LTE',
  GTE = 'GTE',

  // Logical
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',

  // Punctuation
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  COMMA = 'COMMA',
  DOT = 'DOT',
  QUESTION = 'QUESTION',
  COLON = 'COLON',

  // Special
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string | number | boolean | null;
  position: number;
  line: number;
  column: number;
}

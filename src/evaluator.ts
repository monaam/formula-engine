import {
  ASTNode,
  EvaluationContext,
  EvaluationResult,
  FunctionDefinition,
  FormulaEngineConfig,
  SecurityConfig,
} from './types';
import { DecimalUtils, Decimal } from './decimal-utils';
import {
  UndefinedVariableError,
  UndefinedFunctionError,
  DivisionByZeroError,
  InvalidOperationError,
  PropertyAccessError,
  IndexAccessError,
  ArgumentCountError,
  MaxIterationsError,
  MaxRecursionError,
} from './errors';
import { Parser } from './parser';

export class Evaluator {
  private parser: Parser;
  private decimalUtils: DecimalUtils;
  private functions: Map<string, FunctionDefinition>;
  private strictMode: boolean;
  private securityConfig: SecurityConfig;
  private recursionDepth: number = 0;
  private iterationCount: number = 0;
  private accessedVariables: Set<string> = new Set();

  constructor(
    decimalUtils: DecimalUtils,
    functions: Map<string, FunctionDefinition>,
    config?: FormulaEngineConfig
  ) {
    this.parser = new Parser();
    this.decimalUtils = decimalUtils;
    this.functions = functions;
    this.strictMode = config?.strictMode ?? true;
    this.securityConfig = config?.security ?? {};
  }

  /**
   * Evaluate an expression string
   */
  evaluate(expression: string, context: EvaluationContext): EvaluationResult {
    const startTime = Date.now();
    this.accessedVariables = new Set();
    this.recursionDepth = 0;
    this.iterationCount = 0;

    try {
      const ast = this.parser.parse(expression);
      const value = this.evaluateNode(ast, context);

      return {
        value,
        success: true,
        executionTimeMs: Date.now() - startTime,
        accessedVariables: new Set(this.accessedVariables),
      };
    } catch (error) {
      return {
        value: null,
        success: false,
        error: error as Error,
        executionTimeMs: Date.now() - startTime,
        accessedVariables: new Set(this.accessedVariables),
      };
    }
  }

  /**
   * Evaluate an AST node
   */
  evaluateNode(node: ASTNode, context: EvaluationContext): unknown {
    this.checkRecursionLimit();

    switch (node.type) {
      case 'DecimalLiteral':
        return this.decimalUtils.from(node.value);

      case 'NumberLiteral':
        return node.value;

      case 'StringLiteral':
        return node.value;

      case 'BooleanLiteral':
        return node.value;

      case 'NullLiteral':
        return null;

      case 'ArrayLiteral':
        return node.elements.map(el => this.evaluateNode(el, context));

      case 'VariableReference':
        return this.evaluateVariable(node.prefix, node.name, context);

      case 'BinaryOperation':
        return this.evaluateBinaryOperation(node, context);

      case 'UnaryOperation':
        return this.evaluateUnaryOperation(node, context);

      case 'ConditionalExpression':
        return this.evaluateConditional(node, context);

      case 'FunctionCall':
        return this.evaluateFunctionCall(node, context);

      case 'MemberAccess':
        return this.evaluateMemberAccess(node, context);

      case 'IndexAccess':
        return this.evaluateIndexAccess(node, context);

      default:
        throw new Error(`Unknown node type: ${(node as any).type}`);
    }
  }

  private checkRecursionLimit(): void {
    this.recursionDepth++;
    const limit = this.securityConfig.maxRecursionDepth ?? 100;
    if (this.recursionDepth > limit) {
      throw new MaxRecursionError(limit);
    }
  }

  private checkIterationLimit(): void {
    this.iterationCount++;
    const limit = this.securityConfig.maxIterations ?? 10000;
    if (this.iterationCount > limit) {
      throw new MaxIterationsError(limit);
    }
  }

  private evaluateVariable(
    prefix: '$' | '@',
    name: string,
    context: EvaluationContext
  ): unknown {
    this.accessedVariables.add(name);

    if (prefix === '$') {
      // Local variable
      if (name in context.variables) {
        const value = context.variables[name];
        return this.maybeConvertToDecimal(value);
      }

      // Check if it's a special iteration variable ($it)
      if (name === 'it' && context.extra && '_currentItem' in context.extra) {
        return context.extra._currentItem;
      }

      if (this.strictMode) {
        throw new UndefinedVariableError(name, '');
      }
      return null;
    } else {
      // Context variable (@)
      if (context.extra && name in context.extra) {
        return context.extra[name];
      }

      if (this.strictMode) {
        throw new UndefinedVariableError(`@${name}`, '');
      }
      return null;
    }
  }

  private maybeConvertToDecimal(value: unknown): unknown {
    if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
      return this.decimalUtils.from(value);
    }
    return value;
  }

  private evaluateBinaryOperation(
    node: { operator: string; left: ASTNode; right: ASTNode },
    context: EvaluationContext
  ): unknown {
    const { operator } = node;

    // Short-circuit evaluation for logical operators
    if (operator === '&&') {
      const left = this.evaluateNode(node.left, context);
      if (!this.toBool(left)) return false;
      return this.toBool(this.evaluateNode(node.right, context));
    }

    if (operator === '||') {
      const left = this.evaluateNode(node.left, context);
      if (this.toBool(left)) return true;
      return this.toBool(this.evaluateNode(node.right, context));
    }

    const left = this.evaluateNode(node.left, context);
    const right = this.evaluateNode(node.right, context);

    switch (operator) {
      // Arithmetic
      case '+':
        return this.add(left, right);
      case '-':
        return this.subtract(left, right);
      case '*':
        return this.multiply(left, right);
      case '/':
        return this.divide(left, right);
      case '%':
        return this.modulo(left, right);
      case '^':
        return this.power(left, right);

      // Comparison
      case '==':
        return this.equals(left, right);
      case '!=':
        return !this.equals(left, right);
      case '<':
        return this.lessThan(left, right);
      case '>':
        return this.greaterThan(left, right);
      case '<=':
        return this.lessThanOrEqual(left, right);
      case '>=':
        return this.greaterThanOrEqual(left, right);

      default:
        throw new InvalidOperationError(operator, [this.typeOf(left), this.typeOf(right)]);
    }
  }

  private evaluateUnaryOperation(
    node: { operator: string; operand: ASTNode },
    context: EvaluationContext
  ): unknown {
    const operand = this.evaluateNode(node.operand, context);

    switch (node.operator) {
      case '-':
        return this.negate(operand);
      case '!':
        return !this.toBool(operand);
      default:
        throw new InvalidOperationError(node.operator, [this.typeOf(operand)]);
    }
  }

  private evaluateConditional(
    node: { condition: ASTNode; consequent: ASTNode; alternate: ASTNode },
    context: EvaluationContext
  ): unknown {
    const condition = this.evaluateNode(node.condition, context);
    if (this.toBool(condition)) {
      return this.evaluateNode(node.consequent, context);
    }
    return this.evaluateNode(node.alternate, context);
  }

  private evaluateFunctionCall(
    node: { name: string; arguments: ASTNode[] },
    context: EvaluationContext
  ): unknown {
    const fnName = node.name.toUpperCase();
    const fn = this.functions.get(fnName);

    if (!fn) {
      throw new UndefinedFunctionError(fnName);
    }

    // Validate argument count
    if (node.arguments.length < fn.minArgs) {
      throw new ArgumentCountError(fnName, { min: fn.minArgs, max: fn.maxArgs }, node.arguments.length);
    }
    if (fn.maxArgs !== -1 && node.arguments.length > fn.maxArgs) {
      throw new ArgumentCountError(fnName, { min: fn.minArgs, max: fn.maxArgs }, node.arguments.length);
    }

    // Handle special functions that need AST nodes (for iteration)
    if (fnName === 'SUM' && node.arguments.length === 2) {
      return this.evaluateSumWithExpression(node.arguments, context);
    }
    if (fnName === 'FILTER') {
      return this.evaluateFilter(node.arguments, context);
    }
    if (fnName === 'MAP') {
      return this.evaluateMap(node.arguments, context);
    }

    // Evaluate arguments
    const args = node.arguments.map(arg => this.evaluateNode(arg, context));

    // Call the function
    return fn.implementation(args, context, this);
  }

  private evaluateSumWithExpression(args: ASTNode[], context: EvaluationContext): Decimal {
    const array = this.evaluateNode(args[0], context);
    if (!Array.isArray(array)) {
      throw new Error('SUM first argument must be an array');
    }

    const expression = args[1];
    let sum = this.decimalUtils.zero();

    for (const item of array) {
      this.checkIterationLimit();
      const itemContext: EvaluationContext = {
        ...context,
        extra: {
          ...context.extra,
          _currentItem: item,
        },
        variables: {
          ...context.variables,
          it: item,
        },
      };
      const value = this.evaluateNode(expression, itemContext);
      if (this.isNumeric(value)) {
        sum = this.decimalUtils.add(sum, this.toDecimal(value));
      }
    }

    return sum;
  }

  private evaluateFilter(args: ASTNode[], context: EvaluationContext): unknown[] {
    const array = this.evaluateNode(args[0], context);
    if (!Array.isArray(array)) {
      throw new Error('FILTER first argument must be an array');
    }

    const condition = args[1];
    const result: unknown[] = [];

    for (const item of array) {
      this.checkIterationLimit();
      const itemContext: EvaluationContext = {
        ...context,
        extra: {
          ...context.extra,
          _currentItem: item,
        },
        variables: {
          ...context.variables,
          it: item,
        },
      };
      const keep = this.evaluateNode(condition, itemContext);
      if (this.toBool(keep)) {
        result.push(item);
      }
    }

    return result;
  }

  private evaluateMap(args: ASTNode[], context: EvaluationContext): unknown[] {
    const array = this.evaluateNode(args[0], context);
    if (!Array.isArray(array)) {
      throw new Error('MAP first argument must be an array');
    }

    const expression = args[1];
    const result: unknown[] = [];

    for (const item of array) {
      this.checkIterationLimit();
      const itemContext: EvaluationContext = {
        ...context,
        extra: {
          ...context.extra,
          _currentItem: item,
        },
        variables: {
          ...context.variables,
          it: item,
        },
      };
      result.push(this.evaluateNode(expression, itemContext));
    }

    return result;
  }

  private evaluateMemberAccess(
    node: { object: ASTNode; property: string },
    context: EvaluationContext
  ): unknown {
    const object = this.evaluateNode(node.object, context);

    if (object === null || object === undefined) {
      if (this.strictMode) {
        throw new PropertyAccessError(node.property, 'null');
      }
      return null;
    }

    if (typeof object !== 'object') {
      throw new PropertyAccessError(node.property, typeof object);
    }

    const value = (object as Record<string, unknown>)[node.property];
    return this.maybeConvertToDecimal(value);
  }

  private evaluateIndexAccess(
    node: { object: ASTNode; index: ASTNode },
    context: EvaluationContext
  ): unknown {
    const object = this.evaluateNode(node.object, context);
    const index = this.evaluateNode(node.index, context);

    if (object === null || object === undefined) {
      if (this.strictMode) {
        throw new IndexAccessError(index, 'null');
      }
      return null;
    }

    if (Array.isArray(object)) {
      const idx = this.toNumber(index);
      if (idx < 0 || idx >= object.length) {
        return null;
      }
      return this.maybeConvertToDecimal(object[idx]);
    }

    if (typeof object === 'object') {
      const key = String(index);
      const value = (object as Record<string, unknown>)[key];
      return this.maybeConvertToDecimal(value);
    }

    throw new IndexAccessError(index, typeof object);
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  private isNumeric(value: unknown): boolean {
    return value instanceof Decimal || typeof value === 'number';
  }

  private toDecimal(value: unknown): Decimal {
    if (value instanceof Decimal) return value;
    if (typeof value === 'number') return this.decimalUtils.from(value);
    if (typeof value === 'string') return this.decimalUtils.from(value);
    throw new InvalidOperationError('toDecimal', [this.typeOf(value)]);
  }

  private toNumber(value: unknown): number {
    if (value instanceof Decimal) return value.toNumber();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value);
    throw new InvalidOperationError('toNumber', [this.typeOf(value)]);
  }

  private toBool(value: unknown): boolean {
    if (value instanceof Decimal) return !value.isZero();
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined) return false;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  private typeOf(value: unknown): string {
    if (value === null) return 'null';
    if (value instanceof Decimal) return 'decimal';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  private add(left: unknown, right: unknown): unknown {
    // String concatenation
    if (typeof left === 'string' || typeof right === 'string') {
      const leftStr = left instanceof Decimal ? left.toString() : String(left);
      const rightStr = right instanceof Decimal ? right.toString() : String(right);
      return leftStr + rightStr;
    }

    // Numeric addition
    if (this.isNumeric(left) && this.isNumeric(right)) {
      return this.decimalUtils.add(this.toDecimal(left), this.toDecimal(right));
    }

    throw new InvalidOperationError('+', [this.typeOf(left), this.typeOf(right)]);
  }

  private subtract(left: unknown, right: unknown): Decimal {
    if (!this.isNumeric(left) || !this.isNumeric(right)) {
      throw new InvalidOperationError('-', [this.typeOf(left), this.typeOf(right)]);
    }
    return this.decimalUtils.subtract(this.toDecimal(left), this.toDecimal(right));
  }

  private multiply(left: unknown, right: unknown): Decimal {
    if (!this.isNumeric(left) || !this.isNumeric(right)) {
      throw new InvalidOperationError('*', [this.typeOf(left), this.typeOf(right)]);
    }
    return this.decimalUtils.multiply(this.toDecimal(left), this.toDecimal(right));
  }

  private divide(left: unknown, right: unknown): Decimal {
    if (!this.isNumeric(left) || !this.isNumeric(right)) {
      throw new InvalidOperationError('/', [this.typeOf(left), this.typeOf(right)]);
    }
    const divisor = this.toDecimal(right);
    if (divisor.isZero()) {
      throw new DivisionByZeroError();
    }
    return this.decimalUtils.divide(this.toDecimal(left), divisor);
  }

  private modulo(left: unknown, right: unknown): Decimal {
    if (!this.isNumeric(left) || !this.isNumeric(right)) {
      throw new InvalidOperationError('%', [this.typeOf(left), this.typeOf(right)]);
    }
    const divisor = this.toDecimal(right);
    if (divisor.isZero()) {
      throw new DivisionByZeroError();
    }
    return this.decimalUtils.modulo(this.toDecimal(left), divisor);
  }

  private power(left: unknown, right: unknown): Decimal {
    if (!this.isNumeric(left) || !this.isNumeric(right)) {
      throw new InvalidOperationError('^', [this.typeOf(left), this.typeOf(right)]);
    }
    return this.decimalUtils.power(this.toDecimal(left), this.toNumber(right));
  }

  private negate(value: unknown): Decimal {
    if (!this.isNumeric(value)) {
      throw new InvalidOperationError('-', [this.typeOf(value)]);
    }
    return this.decimalUtils.negate(this.toDecimal(value));
  }

  private equals(left: unknown, right: unknown): boolean {
    if (left instanceof Decimal && right instanceof Decimal) {
      return left.equals(right);
    }
    if (left instanceof Decimal && typeof right === 'number') {
      return left.equals(this.decimalUtils.from(right));
    }
    if (typeof left === 'number' && right instanceof Decimal) {
      return this.decimalUtils.from(left).equals(right);
    }
    return left === right;
  }

  private lessThan(left: unknown, right: unknown): boolean {
    if (this.isNumeric(left) && this.isNumeric(right)) {
      return this.decimalUtils.lessThan(this.toDecimal(left), this.toDecimal(right));
    }
    if (typeof left === 'string' && typeof right === 'string') {
      return left < right;
    }
    throw new InvalidOperationError('<', [this.typeOf(left), this.typeOf(right)]);
  }

  private greaterThan(left: unknown, right: unknown): boolean {
    if (this.isNumeric(left) && this.isNumeric(right)) {
      return this.decimalUtils.greaterThan(this.toDecimal(left), this.toDecimal(right));
    }
    if (typeof left === 'string' && typeof right === 'string') {
      return left > right;
    }
    throw new InvalidOperationError('>', [this.typeOf(left), this.typeOf(right)]);
  }

  private lessThanOrEqual(left: unknown, right: unknown): boolean {
    if (this.isNumeric(left) && this.isNumeric(right)) {
      return this.decimalUtils.lessThanOrEqual(this.toDecimal(left), this.toDecimal(right));
    }
    if (typeof left === 'string' && typeof right === 'string') {
      return left <= right;
    }
    throw new InvalidOperationError('<=', [this.typeOf(left), this.typeOf(right)]);
  }

  private greaterThanOrEqual(left: unknown, right: unknown): boolean {
    if (this.isNumeric(left) && this.isNumeric(right)) {
      return this.decimalUtils.greaterThanOrEqual(this.toDecimal(left), this.toDecimal(right));
    }
    if (typeof left === 'string' && typeof right === 'string') {
      return left >= right;
    }
    throw new InvalidOperationError('>=', [this.typeOf(left), this.typeOf(right)]);
  }
}

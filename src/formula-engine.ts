import {
  FormulaEngineConfig,
  FormulaDefinition,
  EvaluationContext,
  EvaluationResult,
  EvaluationResultSet,
  ValidationResult,
  FunctionDefinition,
  ASTNode,
  CacheStats,
  DependencyGraph as IDependencyGraph,
} from './types';
import { Parser } from './parser';
import { Evaluator } from './evaluator';
import { DependencyExtractor } from './dependency-extractor';
import { DependencyGraph, DependencyGraphBuilder } from './dependency-graph';
import { DecimalUtils, Decimal } from './decimal-utils';
import { createBuiltInFunctions } from './functions';
import {
  FormulaEngineError,
  GeneralFormulaError,
  DuplicateFormulaError,
  MaxExpressionLengthError,
} from './errors';

export class FormulaEngine {
  private config: FormulaEngineConfig;
  private parser: Parser;
  private evaluator: Evaluator;
  private dependencyExtractor: DependencyExtractor;
  private graphBuilder: DependencyGraphBuilder;
  private decimalUtils: DecimalUtils;
  private functions: Map<string, FunctionDefinition>;

  // Caches
  private astCache: Map<string, ASTNode> = new Map();
  private dependencyCache: Map<string, Set<string>> = new Map();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(config?: FormulaEngineConfig) {
    this.config = {
      enableCache: true,
      maxCacheSize: 1000,
      strictMode: true,
      ...config,
    };

    this.decimalUtils = new DecimalUtils(this.config.decimal);
    this.functions = createBuiltInFunctions(this.decimalUtils);
    this.parser = new Parser();
    this.dependencyExtractor = new DependencyExtractor();
    this.graphBuilder = new DependencyGraphBuilder();
    this.evaluator = new Evaluator(this.decimalUtils, this.functions, this.config);

    // Register any custom functions from config
    if (this.config.functions) {
      for (const fn of this.config.functions) {
        this.registerFunction(fn);
      }
    }
  }

  /**
   * Parse an expression into an AST
   */
  parse(expression: string): ASTNode {
    this.checkExpressionLength(expression);

    if (this.config.enableCache) {
      const cached = this.astCache.get(expression);
      if (cached) {
        this.cacheHits++;
        return cached;
      }
      this.cacheMisses++;
    }

    const ast = this.parser.parse(expression);

    if (this.config.enableCache) {
      this.maybeEvictCache();
      this.astCache.set(expression, ast);
    }

    return ast;
  }

  /**
   * Extract variable dependencies from an expression
   */
  extractDependencies(expression: string): Set<string> {
    if (this.config.enableCache) {
      const cached = this.dependencyCache.get(expression);
      if (cached) {
        return new Set(cached);
      }
    }

    const deps = this.dependencyExtractor.extract(expression);

    if (this.config.enableCache) {
      this.dependencyCache.set(expression, new Set(deps));
    }

    return deps;
  }

  /**
   * Build a dependency graph from formula definitions
   */
  buildDependencyGraph(formulas: FormulaDefinition[]): IDependencyGraph {
    return this.graphBuilder.build(formulas);
  }

  /**
   * Get the evaluation order for formulas
   */
  getEvaluationOrder(formulas: FormulaDefinition[]): string[] {
    return this.graphBuilder.getEvaluationOrder(formulas);
  }

  /**
   * Validate formulas without evaluating
   */
  validate(formulas: FormulaDefinition[]): ValidationResult {
    const errors: FormulaEngineError[] = [];
    const warnings: string[] = [];

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const formula of formulas) {
      if (ids.has(formula.id)) {
        errors.push(new DuplicateFormulaError(formula.id));
      }
      ids.add(formula.id);
    }

    // Try to parse all expressions
    for (const formula of formulas) {
      try {
        this.parse(formula.expression);
      } catch (error) {
        if (error instanceof FormulaEngineError) {
          errors.push(error);
        } else {
          errors.push(new GeneralFormulaError(String(error)));
        }
      }
    }

    // Build dependency graph and check for cycles
    let dependencyGraph: IDependencyGraph = new DependencyGraph();
    let evaluationOrder: string[] = [];

    try {
      dependencyGraph = this.buildDependencyGraph(formulas);
      evaluationOrder = dependencyGraph.topologicalSort();
    } catch (error) {
      if (error instanceof FormulaEngineError) {
        errors.push(error);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      dependencyGraph,
      evaluationOrder,
    };
  }

  /**
   * Evaluate a single expression
   */
  evaluate(expression: string, context: EvaluationContext): EvaluationResult {
    this.checkExpressionLength(expression);
    const normalizedContext = this.normalizeContext(context);
    return this.evaluator.evaluate(expression, normalizedContext);
  }

  /**
   * Evaluate all formulas in dependency order
   */
  evaluateAll(
    formulas: FormulaDefinition[],
    context: EvaluationContext
  ): EvaluationResultSet {
    const startTime = Date.now();
    const results = new Map<string, EvaluationResult>();
    const errors: Error[] = [];

    // Get evaluation order
    let evaluationOrder: string[];
    try {
      evaluationOrder = this.getEvaluationOrder(formulas);
    } catch (error) {
      return {
        results,
        success: false,
        errors: [error as Error],
        totalExecutionTimeMs: Date.now() - startTime,
        evaluationOrder: [],
      };
    }

    // Create a map of formulas by ID
    const formulaMap = new Map<string, FormulaDefinition>();
    for (const formula of formulas) {
      formulaMap.set(formula.id, formula);
    }

    // Evaluate in order, merging results into context
    const workingContext: EvaluationContext = this.normalizeContext(context);

    for (const formulaId of evaluationOrder) {
      const formula = formulaMap.get(formulaId);
      if (!formula) continue;

      try {
        const result = this.evaluator.evaluate(formula.expression, workingContext);

        // Apply rounding if configured
        let value = result.value;
        if (formula.rounding && this.isDecimal(value)) {
          value = this.applyRounding(value as Decimal, formula.rounding);
        }

        // Handle errors based on formula config
        if (!result.success && formula.onError) {
          value = this.handleError(formula, result.error);
        }

        results.set(formulaId, {
          ...result,
          value,
        });

        // Merge result into context for subsequent formulas
        workingContext.variables[formulaId] = value;

        if (!result.success) {
          errors.push(result.error!);
        }
      } catch (error) {
        const evalResult: EvaluationResult = {
          value: null,
          success: false,
          error: error as Error,
          executionTimeMs: 0,
          accessedVariables: new Set(),
        };

        // Handle error based on formula config
        if (formula.onError) {
          evalResult.value = this.handleError(formula, error as Error);
        }

        results.set(formulaId, evalResult);
        errors.push(error as Error);

        // Still add to context (as null or default value) so dependent formulas can proceed
        workingContext.variables[formulaId] = evalResult.value;
      }
    }

    return {
      results,
      success: errors.length === 0,
      errors,
      totalExecutionTimeMs: Date.now() - startTime,
      evaluationOrder,
    };
  }

  /**
   * Register a custom function
   */
  registerFunction(definition: FunctionDefinition): void {
    const name = definition.name.toUpperCase();
    this.functions.set(name, definition);
  }

  /**
   * Register multiple custom functions
   */
  registerFunctions(definitions: FunctionDefinition[]): void {
    for (const definition of definitions) {
      this.registerFunction(definition);
    }
  }

  /**
   * Get registered function names
   */
  getRegisteredFunctions(): string[] {
    return Array.from(this.functions.keys());
  }

  /**
   * Clear the AST cache
   */
  clearCache(): void {
    this.astCache.clear();
    this.dependencyCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    const total = this.cacheHits + this.cacheMisses;
    return {
      size: this.astCache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0,
    };
  }

  /**
   * Get the decimal utilities instance
   */
  getDecimalUtils(): DecimalUtils {
    return this.decimalUtils;
  }

  /**
   * Create a Decimal from a value
   */
  createDecimal(value: string | number): Decimal {
    return this.decimalUtils.from(value);
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  private checkExpressionLength(expression: string): void {
    const maxLength = this.config.security?.maxExpressionLength ?? 10000;
    if (expression.length > maxLength) {
      throw new MaxExpressionLengthError(expression.length, maxLength);
    }
  }

  private normalizeContext(context: EvaluationContext): EvaluationContext {
    // Deep copy and convert numeric values to Decimal if autoConvertFloats is enabled
    const autoConvert = this.config.decimal?.autoConvertFloats ?? true;

    if (!autoConvert) {
      return { ...context };
    }

    const normalizedVariables: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(context.variables)) {
      normalizedVariables[key] = this.convertValue(value);
    }

    return {
      ...context,
      variables: normalizedVariables,
    };
  }

  private convertValue(value: unknown): unknown {
    if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
      return this.decimalUtils.from(value);
    }
    if (Array.isArray(value)) {
      return value.map(v => this.convertValue(v));
    }
    if (value !== null && typeof value === 'object') {
      const converted: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        converted[k] = this.convertValue(v);
      }
      return converted;
    }
    return value;
  }

  private isDecimal(value: unknown): boolean {
    return value instanceof Decimal;
  }

  private applyRounding(
    value: Decimal,
    config: { mode: string; precision: number }
  ): Decimal {
    if (config.mode === 'NONE') {
      return value;
    }
    return this.decimalUtils.round(value, config.precision, config.mode as any);
  }

  private handleError(formula: FormulaDefinition, _error?: Error): unknown {
    const behavior = formula.onError;
    if (!behavior) return null;

    switch (behavior.type) {
      case 'NULL':
        return null;
      case 'ZERO':
        return this.decimalUtils.zero();
      case 'DEFAULT':
        return behavior.defaultValue ?? formula.defaultValue ?? null;
      case 'SKIP':
        return undefined;
      case 'THROW':
      default:
        throw _error;
    }
  }

  private maybeEvictCache(): void {
    const maxSize = this.config.maxCacheSize ?? 1000;
    if (this.astCache.size >= maxSize) {
      // Simple FIFO eviction - remove first 10% of entries
      const toRemove = Math.ceil(maxSize * 0.1);
      const keys = Array.from(this.astCache.keys()).slice(0, toRemove);
      for (const key of keys) {
        this.astCache.delete(key);
        this.dependencyCache.delete(key);
      }
    }
  }
}

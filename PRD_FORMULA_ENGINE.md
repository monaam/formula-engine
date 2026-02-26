# PRD: Formula Engine - Configuration-Driven Expression Evaluation System

## Executive Summary

**Feature Name:** Formula Engine - Generic Expression Evaluation System
**Version:** 1.0
**Date:** November 27, 2025
**Author:** Engineering Team
**Status:** Draft

### Problem Statement

Applications frequently need to evaluate mathematical and logical expressions based on dynamic configurations. Current approaches typically:

1. **Hardcode formulas** in application code, requiring deployments for changes
2. **Lack dependency awareness**, leading to incorrect calculation order
3. **Provide no validation**, causing runtime errors from invalid expressions
4. **Couple tightly to business domains**, preventing reuse across contexts

### Proposed Solution

Create a **generic Formula Engine** that:

- Parses and evaluates expressions defined in configuration
- Automatically extracts variable dependencies from expressions
- Builds a dependency graph and determines correct evaluation order via topological sort
- Detects circular dependencies at configuration time
- Provides a clean, domain-agnostic API that accepts any context data

The engine is **completely independent of business logic** - it knows nothing about invoices, products, taxes, or any specific domain. All business concepts are passed as configuration.

---

## Goals & Objectives

### Primary Goals

1. **Complete Domain Independence:** Engine has zero knowledge of business concepts
2. **Configuration-Driven:** All formulas, variables, and behaviors defined externally
3. **Automatic Dependency Resolution:** Parse expressions to build dependency graphs
4. **Correct Evaluation Order:** Topological sort ensures dependencies calculated first
5. **Circular Dependency Detection:** Fail fast on invalid configurations
6. **Type Safety:** Full TypeScript support with generic types
7. **Extensibility:** Plugin system for custom functions and operators
8. **Decimal Precision:** Arbitrary-precision decimal arithmetic to avoid floating-point errors

### Success Metrics

- Zero business logic in the formula engine codebase
- Support for 50+ concurrent formula evaluations per second
- Sub-millisecond evaluation time for typical expression sets
- 100% detection rate for circular dependencies
- Comprehensive error messages for debugging
- Zero floating-point precision errors in financial calculations

---

## Scope

### In Scope

- Expression parsing and AST generation
- Dependency extraction from expressions
- Dependency graph construction
- Topological sorting for evaluation order
- Expression evaluation with context
- Built-in operators and functions
- Custom function registration
- Error handling and validation
- Caching of parsed expressions
- Arbitrary-precision decimal arithmetic

### Out of Scope

- Persistence of formulas (handled by consuming applications)
- UI for formula editing
- Domain-specific validations
- Async/remote data fetching within formulas

---

## Detailed Requirements

### 1. Core Architecture

#### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Formula Engine                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │    Parser    │───▶│  Dependency  │───▶│  Topological │       │
│  │              │    │   Extractor  │    │    Sorter    │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │     AST      │    │  Dependency  │    │  Evaluation  │       │
│  │    Cache     │    │    Graph     │    │    Order     │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                 │                │
│                                                 ▼                │
│                                          ┌──────────────┐       │
│                                          │   Evaluator  │       │
│                                          │              │       │
│                                          └──────────────┘       │
│                                                 │                │
│                                                 ▼                │
│                                          ┌──────────────┐       │
│                                          │   Results    │       │
│                                          │              │       │
│                                          └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 1.2 Core Components

```typescript
/**
 * Main Formula Engine class - completely domain-agnostic
 */
class FormulaEngine {
  // Configuration
  private config: FormulaEngineConfig;

  // Caches
  private astCache: Map<string, ASTNode>;
  private dependencyCache: Map<string, Set<string>>;

  // Registered functions
  private functions: Map<string, FormulaFunction>;

  // Methods
  parse(expression: string): ASTNode;
  extractDependencies(expression: string): Set<string>;
  buildDependencyGraph(formulas: FormulaDefinition[]): DependencyGraph;
  getEvaluationOrder(formulas: FormulaDefinition[]): string[];
  evaluate(expression: string, context: EvaluationContext): EvaluationResult;
  evaluateAll(formulas: FormulaDefinition[], context: EvaluationContext): Map<string, EvaluationResult>;

  // Extension points
  registerFunction(name: string, fn: FormulaFunction): void;
  registerOperator(operator: string, handler: OperatorHandler): void;
}
```

---

### 2. Configuration Interfaces

#### 2.1 Formula Definition

```typescript
/**
 * A single formula definition - the basic unit of configuration
 * The engine knows nothing about what these formulas represent
 */
interface FormulaDefinition {
  /** Unique identifier for this formula */
  id: string;

  /** The expression to evaluate */
  expression: string;

  /** Optional: Explicit dependencies (auto-extracted if not provided) */
  dependencies?: string[];

  /** Error handling behavior */
  onError?: ErrorBehavior;

  /** Default value when error occurs (if onError = 'DEFAULT') */
  defaultValue?: unknown;

  /** Rounding configuration (for numeric results) */
  rounding?: RoundingConfig;

  /** Optional metadata (passed through, not used by engine) */
  metadata?: Record<string, unknown>;
}

interface ErrorBehavior {
  type: 'THROW' | 'NULL' | 'ZERO' | 'DEFAULT' | 'SKIP';
  defaultValue?: unknown;
}

interface RoundingConfig {
  mode: 'HALF_UP' | 'HALF_DOWN' | 'FLOOR' | 'CEIL' | 'NONE';
  precision: number;
}
```

#### 2.2 Evaluation Context

```typescript
/**
 * Context provided to the engine for evaluation
 * Can contain any data structure - engine is agnostic
 */
interface EvaluationContext {
  /** Variables available for reference in expressions */
  variables: Record<string, unknown>;

  /** Optional: Arrays for aggregation functions */
  collections?: Record<string, unknown[]>;

  /** Optional: Additional context passed to custom functions */
  extra?: Record<string, unknown>;
}

// Example context (domain-specific, NOT part of engine):
const invoiceContext: EvaluationContext = {
  variables: {
    unitPrice: 100,
    quantity: 5,
    discountRate: 0.1,
    vatRate: 0.19,
  },
  collections: {
    lineItems: [
      { price: 100, qty: 2 },
      { price: 200, qty: 1 },
    ],
  },
};
```

#### 2.3 Engine Configuration

```typescript
/**
 * Configuration for the Formula Engine itself
 */
interface FormulaEngineConfig {
  /** Enable expression caching (default: true) */
  enableCache?: boolean;

  /** Maximum cache size (default: 1000) */
  maxCacheSize?: number;

  /** Default error behavior (default: THROW) */
  defaultErrorBehavior?: ErrorBehavior;

  /** Default rounding config */
  defaultRounding?: RoundingConfig;

  /** Variable reference prefix (default: '$') */
  variablePrefix?: string;

  /** Context variable prefix (default: '@') */
  contextPrefix?: string;

  /** Enable strict mode - fail on undefined variables (default: true) */
  strictMode?: boolean;

  /** Custom operators */
  operators?: OperatorDefinition[];

  /** Custom functions */
  functions?: FunctionDefinition[];

  /** Decimal arithmetic configuration */
  decimal?: DecimalConfig;
}

/**
 * Configuration for decimal arithmetic
 */
interface DecimalConfig {
  /** Default precision for decimal operations (default: 20) */
  precision?: number;

  /** Default rounding mode (default: HALF_UP) */
  roundingMode?: DecimalRoundingMode;

  /** Scale for division results (default: 10) */
  divisionScale?: number;

  /** Preserve trailing zeros in output (default: false) */
  preserveTrailingZeros?: boolean;

  /** Auto-convert JS numbers to Decimal (default: true) */
  autoConvertFloats?: boolean;

  /** Maximum exponent (default: 1000) */
  maxExponent?: number;

  /** Minimum exponent (default: -1000) */
  minExponent?: number;
}
```

---

### 3. Expression Language Specification

#### 3.1 Syntax Overview

The formula language is a simple, safe expression language designed for configuration-driven calculations.

```
Expression     := Term (('+' | '-') Term)*
Term           := Factor (('*' | '/' | '%') Factor)*
Factor         := Base ('^' Base)?
Base           := Unary | Primary
Unary          := ('-' | '!' | 'NOT') Base
Primary        := Number | String | Boolean | Variable | FunctionCall
               | ObjectLiteral | '(' Expression ')'
Variable       := '$' Identifier | '@' Identifier
FunctionCall   := Identifier '(' Arguments? ')'
Arguments      := Expression (',' Expression)*
ObjectLiteral  := '{' (Property (',' Property)*)? '}'
Property       := Identifier ':' Expression
Identifier     := [a-zA-Z_][a-zA-Z0-9_]*
```

#### 3.2 Data Types

| Type | Examples | Description |
|------|----------|-------------|
| Decimal | `42`, `3.14`, `-100.50`, `0.001` | Arbitrary-precision decimal (default for numbers) |
| Number | `42f`, `3.14f`, `1e6` | 64-bit floating point (explicit, use `f` suffix) |
| String | `"hello"`, `'world'` | UTF-8 strings |
| Boolean | `true`, `false` | Boolean values |
| Null | `null` | Null/undefined value |
| Array | `[1, 2, 3]` | Array literals |
| Object | `{ key: expr, ... }` | Inline object literals with unquoted identifier keys |

**Important:** By default, all numeric literals are parsed as `Decimal` for precision. Use the `f` suffix (e.g., `3.14f`) to explicitly use floating-point when performance is preferred over precision.

#### 3.3 Operators

**Arithmetic Operators:**

| Operator | Name | Example | Result |
|----------|------|---------|--------|
| `+` | Addition | `5 + 3` | `8` |
| `-` | Subtraction | `5 - 3` | `2` |
| `*` | Multiplication | `5 * 3` | `15` |
| `/` | Division | `6 / 3` | `2` |
| `%` | Modulo | `7 % 3` | `1` |
| `^` | Power | `2 ^ 3` | `8` |
| `-` (unary) | Negation | `-5` | `-5` |

**Comparison Operators:**

| Operator | Name | Example | Result |
|----------|------|---------|--------|
| `==` | Equal | `5 == 5` | `true` |
| `!=` | Not equal | `5 != 3` | `true` |
| `>` | Greater than | `5 > 3` | `true` |
| `<` | Less than | `5 < 3` | `false` |
| `>=` | Greater or equal | `5 >= 5` | `true` |
| `<=` | Less or equal | `5 <= 3` | `false` |

**Logical Operators:**

| Operator | Name | Example | Result |
|----------|------|---------|--------|
| `&&` / `AND` | Logical AND | `true && false` | `false` |
| `\|\|` / `OR` | Logical OR | `true \|\| false` | `true` |
| `!` / `NOT` | Logical NOT | `!true` | `false` |

**Conditional Operator:**

```
condition ? valueIfTrue : valueIfFalse
```

Example: `$quantity > 10 ? $unitPrice * 0.9 : $unitPrice`

#### 3.4 Variable References

**Local Variables (`$` prefix):**
- Reference values in `context.variables`
- Example: `$unitPrice`, `$quantity`, `$taxRate`

**Context Variables (`@` prefix):**
- Reference values in `context.extra`
- Example: `@currentDate`, `@userId`, `@locale`

**Nested Access:**
- Dot notation: `$product.price`, `$customer.address.city`
- Bracket notation: `$items[0]`, `$data["key"]`

#### 3.5 Built-in Functions

**Math Functions:**

| Function | Description | Example |
|----------|-------------|---------|
| `ABS(x)` | Absolute value | `ABS(-5)` → `5` |
| `ROUND(x, p?)` | Round to precision | `ROUND(3.456, 2)` → `3.46` |
| `FLOOR(x)` | Round down | `FLOOR(3.9)` → `3` |
| `CEIL(x)` | Round up | `CEIL(3.1)` → `4` |
| `MIN(a, b, ...)` | Minimum value | `MIN(5, 3, 8)` → `3` |
| `MAX(a, b, ...)` | Maximum value | `MAX(5, 3, 8)` → `8` |
| `POW(x, y)` | Power | `POW(2, 3)` → `8` |
| `SQRT(x)` | Square root | `SQRT(16)` → `4` |
| `LOG(x)` | Natural logarithm | `LOG(10)` → `2.302...` |
| `LOG10(x)` | Base-10 logarithm | `LOG10(100)` → `2` |

**Aggregation Functions:**

| Function | Description | Example |
|----------|-------------|---------|
| `SUM(arr)` | Sum of array | `SUM($items)` |
| `SUM(arr, expr)` | Sum with expression | `SUM($items, $it.price * $it.qty)` |
| `AVG(arr)` | Average | `AVG($scores)` |
| `COUNT(arr)` | Count elements | `COUNT($items)` |
| `PRODUCT(arr)` | Product of values | `PRODUCT($multipliers)` |
| `FILTER(arr, cond)` | Filter array | `FILTER($items, $it.active)` |
| `MAP(arr, expr)` | Transform array | `MAP($items, $it.price)` |

**String Functions:**

| Function | Description | Example |
|----------|-------------|---------|
| `LEN(s)` | String length | `LEN("hello")` → `5` |
| `UPPER(s)` | Uppercase | `UPPER("hello")` → `"HELLO"` |
| `LOWER(s)` | Lowercase | `LOWER("HELLO")` → `"hello"` |
| `TRIM(s)` | Trim whitespace | `TRIM("  hi  ")` → `"hi"` |
| `CONCAT(a, b, ...)` | Concatenate | `CONCAT("a", "b")` → `"ab"` |
| `SUBSTR(s, start, len?)` | Substring | `SUBSTR("hello", 1, 3)` → `"ell"` |

**Logical Functions:**

| Function | Description | Example |
|----------|-------------|---------|
| `IF(cond, t, f)` | Conditional | `IF($x > 5, "big", "small")` |
| `COALESCE(a, b, ...)` | First non-null | `COALESCE($a, $b, 0)` |
| `ISNULL(x)` | Check null | `ISNULL($value)` |
| `ISEMPTY(x)` | Check empty | `ISEMPTY($array)` |
| `DEFAULT(x, d)` | Default if null | `DEFAULT($x, 0)` |

**Type Functions:**

| Function | Description | Example |
|----------|-------------|---------|
| `NUMBER(x)` | Convert to number | `NUMBER("42")` → `42` |
| `STRING(x)` | Convert to string | `STRING(42)` → `"42"` |
| `BOOLEAN(x)` | Convert to boolean | `BOOLEAN(1)` → `true` |
| `TYPEOF(x)` | Get type name | `TYPEOF(42)` → `"number"` |

**Table/Lookup Functions:**

| Function | Description | Example |
|----------|-------------|---------|
| `LOOKUP(table, criteria, returnField)` | Multi-criteria exact-match lookup | `LOOKUP($rates, { region: "US" }, "rate")` |
| `RANGE(table, value, minField, maxField, returnField)` | Numeric band/tier resolution | `RANGE($tiers, $amount, "min", "max", "rate")` |

**`LOOKUP(table, criteria, returnField)`** — Multi-criteria exact-match lookup on a collection of objects.

| Parameter | Type | Description |
|---|---|---|
| `table` | Array of objects | The reference dataset, typically from `@context` or `$variable` |
| `criteria` | Object literal | Key-value pairs to match against each row (AND logic) |
| `returnField` | String | The field name to return from the first matching row |

Returns the value of `returnField` from the first row where every key in `criteria` equals the corresponding field in the row. Returns `0` if no match is found or if the table is null/undefined.

```
// Single-dimension lookup
LOOKUP(@tenant.shopRates, { class: @client.shopClass }, "redevance")

// Multi-dimension lookup (4 criteria)
LOOKUP(@tenant.cafeCoefficients, {
  type: @client.type,
  equipment: @client.equipment,
  zone: @client.zone,
  service: @client.service
}, "redevance")
```

**`RANGE(table, inputValue, minField, maxField, returnField)`** — Numeric band/tier resolution. Finds which range a value falls into and returns a field from the matching row.

| Parameter | Type | Description |
|---|---|---|
| `table` | Array of objects | The band/tier table |
| `inputValue` | Number | The value to classify into a band |
| `minField` | String | Field name for the lower bound (inclusive: `>=`) |
| `maxField` | String | Field name for the upper bound (exclusive: `<`). `null` = unbounded. |
| `returnField` | String | Field name to return from the matching row |

Returns the value of `returnField` from the first row where `min <= inputValue < max`. Returns `0` if no match is found or if the table is null/undefined.

```
// Room price to reference price band
RANGE(@tenant.roomPriceBands, @client.roomPrice, "min", "max", "referencePrice")

// Tax bracket resolution
RANGE($taxBrackets, $income, "min", "max", "taxRate")
```

---

### 4. Decimal Arithmetic System

#### 4.1 Why Decimal?

JavaScript's native `Number` type uses IEEE 754 floating-point representation, which cannot accurately represent many decimal fractions:

```javascript
// Floating-point precision problems:
0.1 + 0.2                    // 0.30000000000000004 (wrong!)
0.1 * 0.1                    // 0.010000000000000002 (wrong!)
1000.10 - 1000.00            // 0.09999999999990905 (wrong!)
19.99 * 100                  // 1998.9999999999998 (wrong!)

// With Decimal:
Decimal("0.1") + Decimal("0.2")   // 0.3 (correct!)
Decimal("0.1") * Decimal("0.1")   // 0.01 (correct!)
Decimal("1000.10") - Decimal("1000.00")  // 0.10 (correct!)
Decimal("19.99") * Decimal("100")        // 1999.00 (correct!)
```

For financial calculations, tax computations, and any domain requiring exact decimal representation, floating-point errors are unacceptable.

#### 4.2 Decimal Configuration

```typescript
interface DecimalConfig {
  /**
   * Default precision for decimal operations (significant digits)
   * Default: 20
   */
  precision: number;

  /**
   * Default rounding mode for decimal operations
   * Default: HALF_UP (banker's rounding alternative: HALF_EVEN)
   */
  roundingMode: DecimalRoundingMode;

  /**
   * Scale (decimal places) for division results
   * Default: 10
   */
  divisionScale: number;

  /**
   * Whether to preserve trailing zeros in display
   * Default: false
   */
  preserveTrailingZeros: boolean;

  /**
   * Maximum exponent allowed (for overflow protection)
   * Default: 1000
   */
  maxExponent: number;

  /**
   * Minimum exponent allowed (for underflow protection)
   * Default: -1000
   */
  minExponent: number;

  /**
   * Automatically convert floats to decimals in context
   * Default: true
   */
  autoConvertFloats: boolean;
}

enum DecimalRoundingMode {
  /** Round towards positive infinity */
  CEIL = 'CEIL',

  /** Round towards negative infinity */
  FLOOR = 'FLOOR',

  /** Round towards zero (truncate) */
  DOWN = 'DOWN',

  /** Round away from zero */
  UP = 'UP',

  /** Round to nearest, ties go away from zero (standard rounding) */
  HALF_UP = 'HALF_UP',

  /** Round to nearest, ties go towards zero */
  HALF_DOWN = 'HALF_DOWN',

  /** Round to nearest, ties go to even (banker's rounding) */
  HALF_EVEN = 'HALF_EVEN',

  /** Round to nearest, ties go to odd */
  HALF_ODD = 'HALF_ODD',
}
```

#### 4.3 Decimal Type Interface

```typescript
/**
 * Immutable arbitrary-precision decimal number
 * All operations return new Decimal instances
 */
interface Decimal {
  // Properties
  readonly value: string;           // String representation
  readonly precision: number;       // Total significant digits
  readonly scale: number;           // Digits after decimal point
  readonly sign: -1 | 0 | 1;        // Sign of the number
  readonly isZero: boolean;
  readonly isPositive: boolean;
  readonly isNegative: boolean;
  readonly isInteger: boolean;

  // Arithmetic operations (return new Decimal)
  add(other: DecimalLike): Decimal;
  subtract(other: DecimalLike): Decimal;
  multiply(other: DecimalLike): Decimal;
  divide(other: DecimalLike, scale?: number, roundingMode?: DecimalRoundingMode): Decimal;
  modulo(other: DecimalLike): Decimal;
  power(exponent: number): Decimal;
  negate(): Decimal;
  abs(): Decimal;

  // Comparison operations
  compareTo(other: DecimalLike): -1 | 0 | 1;
  equals(other: DecimalLike): boolean;
  greaterThan(other: DecimalLike): boolean;
  greaterThanOrEqual(other: DecimalLike): boolean;
  lessThan(other: DecimalLike): boolean;
  lessThanOrEqual(other: DecimalLike): boolean;

  // Rounding operations
  round(scale: number, mode?: DecimalRoundingMode): Decimal;
  floor(scale?: number): Decimal;
  ceil(scale?: number): Decimal;
  truncate(scale?: number): Decimal;

  // Conversion
  toNumber(): number;               // Convert to JS number (may lose precision)
  toString(): string;               // String representation
  toFixed(scale: number): string;   // Fixed decimal places
  toExponential(fractionDigits?: number): string;
  toJSON(): string;                 // For JSON serialization

  // Static factory methods
  static from(value: DecimalLike): Decimal;
  static fromNumber(value: number): Decimal;
  static fromString(value: string): Decimal;
  static zero(): Decimal;
  static one(): Decimal;
}

/** Types that can be converted to Decimal */
type DecimalLike = Decimal | string | number | bigint;
```

#### 4.4 Decimal Literals in Expressions

```typescript
// All numeric literals are Decimal by default
"100"                    // Decimal(100)
"3.14159"               // Decimal(3.14159)
"-0.001"                // Decimal(-0.001)
"1234567890.123456789"  // Decimal with full precision

// Explicit float suffix for performance-critical non-financial math
"3.14159f"              // JavaScript number (float)
"1e6"                   // Scientific notation → float
"1e6d"                  // Scientific notation → Decimal

// Decimal arithmetic in expressions
"$price * $quantity"                    // Decimal * Decimal → Decimal
"$price * 1.19"                         // Decimal * Decimal → Decimal
"ROUND($total, 2)"                      // Round Decimal to 2 places
"$amount / 3"                           // Decimal division with configured scale
```

#### 4.5 Decimal Functions

| Function | Description | Example | Result |
|----------|-------------|---------|--------|
| `DECIMAL(x)` | Convert to Decimal | `DECIMAL("123.45")` | `Decimal(123.45)` |
| `DECIMAL(x, scale)` | Convert with scale | `DECIMAL(10, 2)` | `Decimal(10.00)` |
| `ROUND(x, scale)` | Round to scale | `ROUND(3.456, 2)` | `Decimal(3.46)` |
| `ROUND(x, scale, mode)` | Round with mode | `ROUND(2.5, 0, "HALF_EVEN")` | `Decimal(2)` |
| `FLOOR(x, scale?)` | Round down | `FLOOR(3.9, 0)` | `Decimal(3)` |
| `CEIL(x, scale?)` | Round up | `CEIL(3.1, 0)` | `Decimal(4)` |
| `TRUNCATE(x, scale?)` | Truncate | `TRUNCATE(3.999, 2)` | `Decimal(3.99)` |
| `SCALE(x)` | Get scale | `SCALE(123.45)` | `2` |
| `PRECISION(x)` | Get precision | `PRECISION(123.45)` | `5` |
| `SIGN(x)` | Get sign | `SIGN(-5)` | `-1` |

#### 4.6 Rounding Mode Examples

```typescript
// Value: 2.5, rounding to 0 decimal places

ROUND(2.5, 0, "CEIL")       // 3   - Round towards +∞
ROUND(2.5, 0, "FLOOR")      // 2   - Round towards -∞
ROUND(2.5, 0, "DOWN")       // 2   - Round towards 0 (truncate)
ROUND(2.5, 0, "UP")         // 3   - Round away from 0
ROUND(2.5, 0, "HALF_UP")    // 3   - Ties go away from 0 (standard)
ROUND(2.5, 0, "HALF_DOWN")  // 2   - Ties go towards 0
ROUND(2.5, 0, "HALF_EVEN")  // 2   - Ties go to even (banker's)
ROUND(3.5, 0, "HALF_EVEN")  // 4   - Ties go to even (banker's)

// Negative numbers
ROUND(-2.5, 0, "HALF_UP")   // -3  - Away from zero
ROUND(-2.5, 0, "FLOOR")     // -3  - Towards -∞
ROUND(-2.5, 0, "CEIL")      // -2  - Towards +∞
```

#### 4.7 Division Behavior

Division requires special handling for scale (decimal places):

```typescript
interface DivisionConfig {
  /**
   * Default scale for division results
   * If the exact result has more decimals, it's rounded
   */
  defaultScale: number;  // Default: 10

  /**
   * Rounding mode for division
   */
  roundingMode: DecimalRoundingMode;  // Default: HALF_UP

  /**
   * Behavior when dividing by zero
   */
  onDivideByZero: 'THROW' | 'NULL' | 'INFINITY';
}

// Examples:
"10 / 3"                    // 3.3333333333 (10 decimal places by default)
"10 / 3 | ROUND(2)"         // 3.33 (pipe to round)
"DIVIDE(10, 3, 2)"          // 3.33 (specify scale in function)
"DIVIDE(10, 3, 4, 'FLOOR')" // 3.3333 (specify scale and rounding)
```

#### 4.8 Automatic Type Coercion

```typescript
// Context values are automatically converted to Decimal when autoConvertFloats is true
const context = {
  variables: {
    price: 19.99,        // number → Decimal(19.99)
    quantity: 5,         // number → Decimal(5)
    rate: "0.19",        // string → Decimal(0.19)
    discount: Decimal("10.00"),  // Already Decimal, kept as-is
  }
};

// Mixed operations
"$price * $quantity"        // Decimal * Decimal → Decimal
"$price + 100"              // Decimal + Decimal(100) → Decimal
"$price * 1.19"             // Decimal * Decimal(1.19) → Decimal
```

#### 4.9 Precision Preservation

```typescript
// Precision is preserved through operations
const a = Decimal("1.10");
const b = Decimal("1.20");
const sum = a.add(b);       // Decimal("2.30"), not "2.3"

// Configuration option for trailing zeros
const config = {
  decimal: {
    preserveTrailingZeros: true,  // "2.30" instead of "2.3"
  }
};

// Scale is the maximum of operand scales for add/subtract
Decimal("1.1").add(Decimal("2.22"));      // Scale 2: "3.32"
Decimal("1.100").add(Decimal("2.2"));     // Scale 3: "3.300"

// Multiplication: sum of scales (then can be trimmed)
Decimal("1.5").multiply(Decimal("2.5"));  // "3.75" (scale 1+1=2)
```

#### 4.10 Performance Considerations

```typescript
// Decimal operations are slower than native floats
// Use floats when:
// 1. Precision is not critical (physics, graphics, statistics)
// 2. Performance is paramount
// 3. Values will be rounded anyway

// Performance comparison (approximate):
// Float addition:   ~1 nanosecond
// Decimal addition: ~100-500 nanoseconds

// Optimization strategies:
interface PerformanceConfig {
  /**
   * Use native floats for intermediate calculations,
   * convert to Decimal only for final results
   */
  useFloatIntermediates: boolean;

  /**
   * Cache frequently used Decimal values
   */
  cacheCommonValues: boolean;

  /**
   * Common values to pre-cache
   */
  cachedValues: string[];  // e.g., ["0", "1", "0.19", "100"]
}
```

#### 4.11 Serialization

```typescript
// JSON serialization preserves precision
const result = {
  total: Decimal("1234567890.123456789")
};

JSON.stringify(result);
// '{"total":"1234567890.123456789"}'

// Configuration for serialization format
interface SerializationConfig {
  /**
   * How to serialize Decimal values
   */
  decimalFormat: 'STRING' | 'NUMBER' | 'OBJECT';

  /**
   * For OBJECT format, the property name
   */
  decimalProperty?: string;  // e.g., "$decimal"
}

// STRING format (default, safest):
// { "total": "1234567890.123456789" }

// NUMBER format (may lose precision!):
// { "total": 1234567890.123456789 }

// OBJECT format (explicit typing):
// { "total": { "$decimal": "1234567890.123456789" } }
```

#### 4.12 Error Handling for Decimals

```typescript
class DecimalError extends FormulaEngineError {
  code = 'DECIMAL_ERROR';
  category = 'EVALUATION';
}

class DecimalOverflowError extends DecimalError {
  code = 'DECIMAL_OVERFLOW';
  constructor(public value: string, public maxExponent: number) {
    super(`Decimal overflow: exponent exceeds ${maxExponent}`);
  }
}

class DecimalUnderflowError extends DecimalError {
  code = 'DECIMAL_UNDERFLOW';
  constructor(public value: string, public minExponent: number) {
    super(`Decimal underflow: exponent below ${minExponent}`);
  }
}

class DecimalDivisionByZeroError extends DecimalError {
  code = 'DECIMAL_DIVISION_BY_ZERO';
  constructor() {
    super('Division by zero');
  }
}

class InvalidDecimalError extends DecimalError {
  code = 'INVALID_DECIMAL';
  constructor(public input: string) {
    super(`Invalid decimal value: "${input}"`);
  }
}
```

#### 4.13 Implementation Recommendation

The Formula Engine should use a well-tested arbitrary-precision decimal library. Recommended options:

| Library | Pros | Cons |
|---------|------|------|
| **decimal.js** | Full-featured, well-tested, good docs | Larger bundle size |
| **big.js** | Lightweight, simple API | Fewer features |
| **bignumber.js** | By same author as decimal.js | Similar to decimal.js |
| **Custom** | Full control, minimal deps | Development effort |

**Recommended: `decimal.js`** for its comprehensive feature set and battle-tested reliability.

```typescript
// Example integration with decimal.js
import Decimal from 'decimal.js';

// Configure globally
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -1000,
  toExpPos: 1000,
});

// Wrap for Formula Engine
class FormulaDecimal {
  private value: Decimal;

  constructor(value: DecimalLike) {
    this.value = new Decimal(value);
  }

  add(other: DecimalLike): FormulaDecimal {
    return new FormulaDecimal(this.value.plus(other));
  }

  // ... other methods
}
```

---

### 5. Dependency Management

#### 5.1 Dependency Extraction

The engine automatically extracts dependencies by parsing expressions:

```typescript
interface DependencyExtractor {
  /**
   * Extract all variable references from an expression
   * @param expression - The formula expression
   * @returns Set of variable names (without prefix)
   */
  extract(expression: string): Set<string>;
}

// Example:
const expr = "$lineTotalHT + $productVAT - $discount";
const deps = extractor.extract(expr);
// Result: Set { "lineTotalHT", "productVAT", "discount" }
```

**Extraction Rules:**

1. **Simple variables:** `$varName` → extracts `varName`
2. **Nested variables:** `$product.price` → extracts `product`
3. **Array access:** `$items[0].price` → extracts `items`
4. **Function arguments:** `SUM($items, $it.price)` → extracts `items`
5. **Conditional branches:** `$a > 0 ? $b : $c` → extracts `a`, `b`, `c`

#### 5.2 Dependency Graph

```typescript
interface DependencyGraph {
  /** All nodes in the graph */
  nodes: Set<string>;

  /** Adjacency list: node → dependencies */
  edges: Map<string, Set<string>>;

  /** Check if graph has cycles */
  hasCycles(): boolean;

  /** Get nodes with no dependencies */
  getRoots(): Set<string>;

  /** Get all dependents of a node */
  getDependents(nodeId: string): Set<string>;

  /** Get all dependencies of a node */
  getDependencies(nodeId: string): Set<string>;

  /** Get the full dependency chain (transitive) */
  getTransitiveDependencies(nodeId: string): Set<string>;
}
```

**Graph Construction Example:**

```typescript
const formulas: FormulaDefinition[] = [
  { id: 'basePrice', expression: '$unitPrice * $quantity' },
  { id: 'discount', expression: '$basePrice * $discountRate' },
  { id: 'subtotal', expression: '$basePrice - $discount' },
  { id: 'vat', expression: '$subtotal * $vatRate' },
  { id: 'total', expression: '$subtotal + $vat' },
];

// Resulting graph:
// unitPrice ──┐
//             ├──▶ basePrice ──┬──▶ discount ──┐
// quantity ───┘               │               │
//                             └───────────────┴──▶ subtotal ──┬──▶ vat ──┐
// discountRate ──────────────────▶ discount                   │          │
// vatRate ────────────────────────────────────────────────────┼──▶ vat   │
//                                                             └──────────┴──▶ total
```

#### 5.3 Topological Sort

```typescript
interface TopologicalSorter {
  /**
   * Sort formulas in evaluation order
   * @param graph - The dependency graph
   * @returns Array of formula IDs in correct evaluation order
   * @throws CircularDependencyError if cycle detected
   */
  sort(graph: DependencyGraph): string[];
}

// Using Kahn's algorithm:
// 1. Find all nodes with no incoming edges (roots)
// 2. Remove roots from graph, add to result
// 3. Repeat until graph is empty
// 4. If nodes remain, there's a cycle

// Example output for above formulas:
// ['unitPrice', 'quantity', 'discountRate', 'vatRate', 'basePrice', 'discount', 'subtotal', 'vat', 'total']
```

#### 5.4 Circular Dependency Detection

```typescript
interface CircularDependencyError extends Error {
  /** The cycle that was detected */
  cycle: string[];

  /** All formulas involved in cycles */
  involvedFormulas: string[];
}

// Example:
// Formula A: $B + 1
// Formula B: $C + 1
// Formula C: $A + 1
//
// Throws: CircularDependencyError {
//   message: "Circular dependency detected: A → B → C → A",
//   cycle: ['A', 'B', 'C', 'A'],
//   involvedFormulas: ['A', 'B', 'C']
// }
```

---

### 6. Evaluation Engine

#### 6.1 Evaluation Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Expression │────▶│    Parse    │────▶│     AST     │────▶│  Evaluate   │
│   String    │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                               │                   │
                                               ▼                   ▼
                                        ┌─────────────┐     ┌─────────────┐
                                        │    Cache    │     │   Result    │
                                        │             │     │             │
                                        └─────────────┘     └─────────────┘
```

#### 6.2 AST Node Types

```typescript
type ASTNode =
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

interface DecimalLiteral {
  type: 'DecimalLiteral';
  value: string;  // String to preserve precision
  raw: string;    // Original text from expression
}

interface NumberLiteral {
  type: 'NumberLiteral';
  value: number;  // Native JS float (when explicitly requested)
}

interface VariableReference {
  type: 'VariableReference';
  prefix: '$' | '@';
  name: string;
}

interface BinaryOperation {
  type: 'BinaryOperation';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

interface FunctionCall {
  type: 'FunctionCall';
  name: string;
  arguments: ASTNode[];
}

// ... etc
```

#### 6.3 Evaluator Interface

```typescript
interface Evaluator {
  /**
   * Evaluate a single expression
   */
  evaluate(
    expression: string,
    context: EvaluationContext
  ): EvaluationResult;

  /**
   * Evaluate multiple formulas in dependency order
   */
  evaluateAll(
    formulas: FormulaDefinition[],
    context: EvaluationContext
  ): EvaluationResultSet;

  /**
   * Evaluate with incremental updates
   * Only re-evaluates affected formulas when context changes
   */
  evaluateIncremental(
    formulas: FormulaDefinition[],
    context: EvaluationContext,
    changedVariables: Set<string>,
    previousResults: EvaluationResultSet
  ): EvaluationResultSet;
}

interface EvaluationResult {
  /** The computed value */
  value: unknown;

  /** Whether evaluation succeeded */
  success: boolean;

  /** Error if evaluation failed */
  error?: EvaluationError;

  /** Execution time in milliseconds */
  executionTimeMs: number;

  /** Variables that were accessed during evaluation */
  accessedVariables: Set<string>;
}

interface EvaluationResultSet {
  /** Results keyed by formula ID */
  results: Map<string, EvaluationResult>;

  /** Overall success */
  success: boolean;

  /** All errors encountered */
  errors: EvaluationError[];

  /** Total execution time */
  totalExecutionTimeMs: number;

  /** Evaluation order that was used */
  evaluationOrder: string[];
}
```

#### 6.4 Evaluation Context Merging

During batch evaluation, computed results are merged into the context:

```typescript
// Initial context:
{
  variables: {
    unitPrice: 100,
    quantity: 5,
    discountRate: 0.1,
    vatRate: 0.19,
  }
}

// After evaluating 'basePrice = $unitPrice * $quantity':
{
  variables: {
    unitPrice: 100,
    quantity: 5,
    discountRate: 0.1,
    vatRate: 0.19,
    basePrice: 500,  // <-- Added
  }
}

// After evaluating 'discount = $basePrice * $discountRate':
{
  variables: {
    unitPrice: 100,
    quantity: 5,
    discountRate: 0.1,
    vatRate: 0.19,
    basePrice: 500,
    discount: 50,  // <-- Added
  }
}

// ... and so on
```

---

### 7. Custom Function Registration

#### 7.1 Function Definition Interface

```typescript
interface FunctionDefinition {
  /** Function name (case-insensitive) */
  name: string;

  /** Minimum number of arguments */
  minArgs: number;

  /** Maximum number of arguments (-1 for unlimited) */
  maxArgs: number;

  /** Argument type definitions */
  argTypes?: ArgumentType[];

  /** Return type */
  returnType: ValueType;

  /** The implementation */
  implementation: FunctionImplementation;

  /** Description for documentation */
  description?: string;
}

type FunctionImplementation = (
  args: unknown[],
  context: EvaluationContext,
  engine: FormulaEngine
) => unknown;

type ValueType = 'number' | 'string' | 'boolean' | 'array' | 'object' | 'any';

interface ArgumentType {
  name: string;
  type: ValueType;
  required: boolean;
  default?: unknown;
}
```

#### 7.2 Registration Example

```typescript
const engine = new FormulaEngine();

// Register a custom function
engine.registerFunction({
  name: 'DISCOUNT_TIER',
  minArgs: 2,
  maxArgs: 2,
  argTypes: [
    { name: 'amount', type: 'number', required: true },
    { name: 'tiers', type: 'array', required: true },
  ],
  returnType: 'number',
  description: 'Calculate discount based on amount and tier thresholds',
  implementation: (args, context) => {
    const [amount, tiers] = args as [number, Array<{ threshold: number; rate: number }>];

    // Find applicable tier
    const tier = tiers
      .filter(t => amount >= t.threshold)
      .sort((a, b) => b.threshold - a.threshold)[0];

    return tier ? amount * tier.rate : 0;
  },
});

// Usage in formula:
// DISCOUNT_TIER($totalAmount, @discountTiers)
```

---

### 8. Error Handling

#### 8.1 Error Types

```typescript
abstract class FormulaEngineError extends Error {
  abstract readonly code: string;
  abstract readonly category: ErrorCategory;
}

type ErrorCategory = 'PARSE' | 'VALIDATION' | 'EVALUATION' | 'CONFIGURATION';

// Parse errors
class SyntaxError extends FormulaEngineError {
  code = 'PARSE_SYNTAX_ERROR';
  category = 'PARSE';

  constructor(
    message: string,
    public position: number,
    public line: number,
    public column: number,
    public expression: string
  ) {
    super(message);
  }
}

class UnexpectedTokenError extends FormulaEngineError {
  code = 'PARSE_UNEXPECTED_TOKEN';
  category = 'PARSE';

  constructor(
    public token: string,
    public expected: string[],
    public position: number
  ) {
    super(`Unexpected token '${token}', expected one of: ${expected.join(', ')}`);
  }
}

// Validation errors
class CircularDependencyError extends FormulaEngineError {
  code = 'VALIDATION_CIRCULAR_DEPENDENCY';
  category = 'VALIDATION';

  constructor(
    public cycle: string[],
    public involvedFormulas: string[]
  ) {
    super(`Circular dependency detected: ${cycle.join(' → ')}`);
  }
}

class UndefinedVariableError extends FormulaEngineError {
  code = 'VALIDATION_UNDEFINED_VARIABLE';
  category = 'VALIDATION';

  constructor(
    public variableName: string,
    public expression: string
  ) {
    super(`Undefined variable: ${variableName}`);
  }
}

class UndefinedFunctionError extends FormulaEngineError {
  code = 'VALIDATION_UNDEFINED_FUNCTION';
  category = 'VALIDATION';

  constructor(
    public functionName: string
  ) {
    super(`Undefined function: ${functionName}`);
  }
}

// Evaluation errors
class DivisionByZeroError extends FormulaEngineError {
  code = 'EVAL_DIVISION_BY_ZERO';
  category = 'EVALUATION';
}

class TypeMismatchError extends FormulaEngineError {
  code = 'EVAL_TYPE_MISMATCH';
  category = 'EVALUATION';

  constructor(
    public expected: ValueType,
    public actual: ValueType,
    public context: string
  ) {
    super(`Type mismatch: expected ${expected}, got ${actual} in ${context}`);
  }
}

class ArgumentCountError extends FormulaEngineError {
  code = 'EVAL_ARGUMENT_COUNT';
  category = 'EVALUATION';

  constructor(
    public functionName: string,
    public expected: { min: number; max: number },
    public actual: number
  ) {
    super(
      `Function ${functionName} expects ${expected.min}-${expected.max} arguments, got ${actual}`
    );
  }
}
```

#### 8.2 Error Recovery

```typescript
interface ErrorRecoveryConfig {
  /** How to handle parse errors */
  onParseError: 'THROW' | 'SKIP' | 'DEFAULT';

  /** How to handle undefined variables */
  onUndefinedVariable: 'THROW' | 'NULL' | 'ZERO' | 'DEFAULT';

  /** How to handle division by zero */
  onDivisionByZero: 'THROW' | 'INFINITY' | 'NULL' | 'ZERO';

  /** How to handle type mismatches */
  onTypeMismatch: 'THROW' | 'COERCE' | 'NULL';

  /** Default values for recovery */
  defaults: {
    number: number;
    string: string;
    boolean: boolean;
    array: unknown[];
    object: Record<string, unknown>;
  };
}
```

---

### 9. API Reference

#### 9.1 FormulaEngine Class

```typescript
class FormulaEngine {
  /**
   * Create a new Formula Engine instance
   */
  constructor(config?: FormulaEngineConfig);

  /**
   * Parse an expression into an AST
   * @throws SyntaxError if expression is invalid
   */
  parse(expression: string): ASTNode;

  /**
   * Extract variable dependencies from an expression
   */
  extractDependencies(expression: string): Set<string>;

  /**
   * Build a dependency graph from formula definitions
   * @throws CircularDependencyError if cycles detected
   */
  buildDependencyGraph(formulas: FormulaDefinition[]): DependencyGraph;

  /**
   * Get the correct evaluation order for formulas
   * @throws CircularDependencyError if cycles detected
   */
  getEvaluationOrder(formulas: FormulaDefinition[]): string[];

  /**
   * Validate formulas without evaluating
   */
  validate(formulas: FormulaDefinition[]): ValidationResult;

  /**
   * Evaluate a single expression
   */
  evaluate(expression: string, context: EvaluationContext): EvaluationResult;

  /**
   * Evaluate all formulas in correct order
   */
  evaluateAll(
    formulas: FormulaDefinition[],
    context: EvaluationContext
  ): EvaluationResultSet;

  /**
   * Register a custom function
   */
  registerFunction(definition: FunctionDefinition): void;

  /**
   * Register multiple custom functions
   */
  registerFunctions(definitions: FunctionDefinition[]): void;

  /**
   * Get registered function names
   */
  getRegisteredFunctions(): string[];

  /**
   * Clear the AST cache
   */
  clearCache(): void;

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats;
}

interface ValidationResult {
  valid: boolean;
  errors: FormulaEngineError[];
  warnings: string[];
  dependencyGraph: DependencyGraph;
  evaluationOrder: string[];
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}
```

#### 9.2 Usage Examples

**Basic Evaluation:**

```typescript
const engine = new FormulaEngine();

const result = engine.evaluate('$a + $b * 2', {
  variables: { a: 10, b: 5 }
});

console.log(result.value); // 20
```

**Batch Evaluation with Dependencies:**

```typescript
const engine = new FormulaEngine();

const formulas: FormulaDefinition[] = [
  { id: 'gross', expression: '$unitPrice * $quantity' },
  { id: 'discount', expression: '$gross * $discountRate' },
  { id: 'net', expression: '$gross - $discount' },
  { id: 'tax', expression: '$net * $taxRate' },
  { id: 'total', expression: '$net + $tax' },
];

const context: EvaluationContext = {
  variables: {
    unitPrice: 100,
    quantity: 5,
    discountRate: 0.1,
    taxRate: 0.2,
  }
};

// Engine automatically:
// 1. Extracts dependencies from each formula
// 2. Builds dependency graph
// 3. Detects any circular dependencies
// 4. Determines correct evaluation order
// 5. Evaluates in order, merging results into context

const results = engine.evaluateAll(formulas, context);

console.log(results.evaluationOrder);
// ['gross', 'discount', 'net', 'tax', 'total']

console.log(results.results.get('total')?.value);
// 540 (gross=500, discount=50, net=450, tax=90, total=540)
```

**With Custom Functions:**

```typescript
const engine = new FormulaEngine();

// Register domain-specific function (but engine doesn't know it's domain-specific)
engine.registerFunction({
  name: 'TIERED_RATE',
  minArgs: 2,
  maxArgs: 2,
  implementation: (args) => {
    const [amount, tiers] = args as [number, Array<{ min: number; rate: number }>];
    const tier = [...tiers].reverse().find(t => amount >= t.min);
    return tier?.rate ?? 0;
  }
});

const result = engine.evaluate(
  'TIERED_RATE($amount, @tiers)',
  {
    variables: { amount: 15000 },
    extra: {
      tiers: [
        { min: 0, rate: 0.05 },
        { min: 10000, rate: 0.03 },
        { min: 50000, rate: 0.02 },
      ]
    }
  }
);

console.log(result.value); // 0.03
```

**Decimal Precision:**

```typescript
const engine = new FormulaEngine({
  decimal: {
    precision: 20,
    roundingMode: 'HALF_UP',
    divisionScale: 10,
  }
});

// Floating-point would fail here
const result = engine.evaluate('0.1 + 0.2', { variables: {} });
console.log(result.value.toString()); // "0.3" (exact!)

// Financial calculation
const invoice = engine.evaluateAll(
  [
    { id: 'subtotal', expression: '$price * $quantity' },
    { id: 'tax', expression: 'ROUND($subtotal * 0.19, 2)' },
    { id: 'total', expression: '$subtotal + $tax' },
  ],
  {
    variables: {
      price: "19.99",   // String preserves precision
      quantity: 3,
    }
  }
);

console.log(invoice.results.get('subtotal')?.value.toString()); // "59.97"
console.log(invoice.results.get('tax')?.value.toString());      // "11.39"
console.log(invoice.results.get('total')?.value.toString());    // "71.36"

// Division with explicit scale
const division = engine.evaluate('DIVIDE(10, 3, 4)', { variables: {} });
console.log(division.value.toString()); // "3.3333"

// Banker's rounding
const engineBanker = new FormulaEngine({
  decimal: { roundingMode: 'HALF_EVEN' }
});
console.log(engineBanker.evaluate('ROUND(2.5, 0)', { variables: {} }).value); // 2
console.log(engineBanker.evaluate('ROUND(3.5, 0)', { variables: {} }).value); // 4
```

**Validation Before Evaluation:**

```typescript
const engine = new FormulaEngine();

const formulas: FormulaDefinition[] = [
  { id: 'a', expression: '$b + 1' },
  { id: 'b', expression: '$c + 1' },
  { id: 'c', expression: '$a + 1' }, // Creates cycle!
];

const validation = engine.validate(formulas);

if (!validation.valid) {
  for (const error of validation.errors) {
    if (error instanceof CircularDependencyError) {
      console.error(`Circular dependency: ${error.cycle.join(' → ')}`);
    }
  }
}
```

---

### 10. Performance Considerations

#### 10.1 Caching Strategy

```typescript
interface CacheConfig {
  /** Enable AST caching */
  enableASTCache: boolean;

  /** Enable dependency cache */
  enableDependencyCache: boolean;

  /** Maximum AST cache entries */
  maxASTCacheSize: number;

  /** Cache eviction policy */
  evictionPolicy: 'LRU' | 'LFU' | 'FIFO';

  /** Cache TTL in milliseconds (0 = no expiration) */
  cacheTTL: number;
}
```

#### 10.2 Optimization Techniques

1. **Expression Normalization:** Normalize expressions before caching to improve hit rate
2. **Constant Folding:** Pre-compute constant sub-expressions during parsing
3. **Short-Circuit Evaluation:** For `&&` and `||` operators
4. **Lazy Collection Evaluation:** Don't materialize arrays until needed
5. **Result Memoization:** Cache intermediate results during batch evaluation

#### 10.3 Benchmarks (Target)

| Operation | Target | Notes |
|-----------|--------|-------|
| Parse simple expression | < 0.1ms | With cache hit |
| Parse complex expression | < 1ms | First parse |
| Evaluate simple expression | < 0.05ms | Cached AST |
| Evaluate 100 formulas | < 5ms | With dependencies |
| Build dependency graph (100 nodes) | < 1ms | |
| Topological sort (100 nodes) | < 0.5ms | |

---

### 11. Security Considerations

#### 11.1 Safe Evaluation

The formula engine is designed to be safe by default:

1. **No Code Execution:** Expressions cannot execute arbitrary code
2. **No File System Access:** No built-in functions access the filesystem
3. **No Network Access:** No HTTP/network capabilities
4. **No Global Access:** Cannot access global objects or prototypes
5. **Sandboxed Context:** Only provided variables are accessible
6. **Resource Limits:** Configurable limits on:
   - Maximum expression length
   - Maximum recursion depth
   - Maximum loop iterations (for array functions)
   - Maximum execution time

#### 11.2 Security Configuration

```typescript
interface SecurityConfig {
  /** Maximum expression length in characters */
  maxExpressionLength: number;  // Default: 10000

  /** Maximum recursion depth */
  maxRecursionDepth: number;  // Default: 100

  /** Maximum iterations for array functions */
  maxIterations: number;  // Default: 10000

  /** Maximum execution time in milliseconds */
  maxExecutionTime: number;  // Default: 5000

  /** Allowed function names (whitelist) */
  allowedFunctions?: string[];

  /** Blocked function names (blacklist) */
  blockedFunctions?: string[];
}
```

---

### 12. Testing Strategy

#### 12.1 Test Categories

1. **Parser Tests:** Valid/invalid syntax, edge cases, Unicode support
2. **Dependency Tests:** Extraction accuracy, graph construction, cycle detection
3. **Evaluation Tests:** All operators, all functions, type coercion
4. **Integration Tests:** Full pipeline with complex formula sets
5. **Performance Tests:** Benchmarks, stress tests, memory usage
6. **Security Tests:** Injection attempts, resource exhaustion

#### 12.2 Test Coverage Requirements

- Line coverage: > 95%
- Branch coverage: > 90%
- All built-in functions: 100%
- All operators: 100%
- All error paths: 100%

---

### 13. Implementation Phases

#### Phase 1: Core Engine (Week 1-2)

- [ ] Lexer and tokenizer
- [ ] Parser and AST generation
- [ ] Basic evaluator (arithmetic, comparisons, variables)
- [ ] Core built-in functions (math, logic)
- [ ] Basic error handling

#### Phase 2: Dependency Management (Week 3)

- [ ] Dependency extractor
- [ ] Dependency graph builder
- [ ] Topological sorter
- [ ] Circular dependency detection
- [ ] Batch evaluation with dependency resolution

#### Phase 3: Advanced Features (Week 4)

- [ ] Aggregation functions (SUM, AVG, etc.)
- [ ] Array manipulation functions
- [ ] String functions
- [ ] Custom function registration
- [ ] Expression caching

#### Phase 4: Optimization & Polish (Week 5)

- [ ] Performance optimization
- [ ] Comprehensive error messages
- [ ] Security hardening
- [ ] Documentation
- [ ] Comprehensive test suite

---

### 14. Appendix: Example Configurations

#### 14.1 Simple Calculator

```typescript
const calculatorFormulas: FormulaDefinition[] = [
  { id: 'sum', expression: '$a + $b' },
  { id: 'difference', expression: '$a - $b' },
  { id: 'product', expression: '$a * $b' },
  { id: 'quotient', expression: '$b != 0 ? $a / $b : null' },
];
```

#### 14.2 Financial Calculations

```typescript
const financialFormulas: FormulaDefinition[] = [
  { id: 'principal', expression: '$loanAmount' },
  { id: 'monthlyRate', expression: '$annualRate / 12' },
  { id: 'numPayments', expression: '$years * 12' },
  {
    id: 'monthlyPayment',
    expression: '$principal * $monthlyRate * POW(1 + $monthlyRate, $numPayments) / (POW(1 + $monthlyRate, $numPayments) - 1)'
  },
  { id: 'totalPayment', expression: '$monthlyPayment * $numPayments' },
  { id: 'totalInterest', expression: '$totalPayment - $principal' },
];
```

#### 14.3 Scoring System

```typescript
const scoringFormulas: FormulaDefinition[] = [
  { id: 'rawScore', expression: 'SUM($answers, IF($it.correct, $it.points, 0))' },
  { id: 'maxScore', expression: 'SUM($answers, $it.points)' },
  { id: 'percentage', expression: '$maxScore > 0 ? ($rawScore / $maxScore) * 100 : 0' },
  { id: 'grade', expression: 'IF($percentage >= 90, "A", IF($percentage >= 80, "B", IF($percentage >= 70, "C", IF($percentage >= 60, "D", "F"))))' },
  { id: 'passed', expression: '$percentage >= 60' },
];
```

---

## Glossary

| Term | Definition |
|------|------------|
| **AST** | Abstract Syntax Tree - tree representation of parsed expression |
| **Decimal** | Arbitrary-precision decimal number that avoids floating-point errors |
| **Dependency Graph** | Directed graph showing which formulas depend on others |
| **Precision** | Total number of significant digits in a Decimal value |
| **Scale** | Number of digits after the decimal point |
| **Rounding Mode** | Algorithm for rounding numbers (HALF_UP, HALF_EVEN, FLOOR, CEIL, etc.) |
| **Topological Sort** | Algorithm to order nodes so dependencies come before dependents |
| **Context** | The data environment in which expressions are evaluated |
| **Formula** | A named expression that can reference variables and other formulas |
| **Variable** | A named value in the evaluation context |

---

## References

1. Expression parsing: Pratt Parser / Recursive Descent
2. Topological sorting: Kahn's algorithm / DFS-based
3. Similar systems: Excel formulas, JSON Logic, Mathjs
4. Decimal arithmetic: decimal.js library, IEEE 754-2008 decimal floating-point

---

*End of PRD*

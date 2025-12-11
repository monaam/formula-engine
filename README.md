# Formula Engine

A configuration-driven expression evaluation system with automatic dependency resolution and arbitrary-precision decimal arithmetic.

## Features

- **Expression Parsing**: Parse mathematical and logical expressions into an AST
- **Automatic Dependency Resolution**: Extracts dependencies from expressions and evaluates formulas in correct order
- **Circular Dependency Detection**: Fails fast with helpful error messages when cycles are detected
- **Decimal Precision**: Uses arbitrary-precision arithmetic to avoid floating-point errors (e.g., `0.1 + 0.2 = 0.3`)
- **40+ Built-in Functions**: Math, string, logical, aggregation, and type functions
- **Custom Functions**: Register your own functions
- **Caching**: AST and dependency caching for improved performance
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install @the-trybe/formula-engine
```

## Quick Start

```typescript
import { FormulaEngine } from '@the-trybe/formula-engine';

const engine = new FormulaEngine();

// Evaluate a simple expression
const result = engine.evaluate('$price * $quantity', {
  variables: { price: 19.99, quantity: 3 }
});

console.log(result.value.toString()); // "59.97"
```

## Usage

### Single Expression Evaluation

```typescript
const engine = new FormulaEngine();

// Arithmetic
engine.evaluate('$a + $b * 2', { variables: { a: 10, b: 5 } });
// Result: 20

// Comparison
engine.evaluate('$score >= 90', { variables: { score: 85 } });
// Result: false

// Conditional (ternary)
engine.evaluate('$quantity > 10 ? $price * 0.9 : $price', {
  variables: { quantity: 15, price: 100 }
});
// Result: 90

// Function calls
engine.evaluate('ROUND($price * 1.19, 2)', { variables: { price: 99.99 } });
// Result: 118.99
```

### Batch Evaluation with Dependencies

The engine automatically determines the correct evaluation order:

```typescript
const formulas = [
  { id: 'gross', expression: '$unitPrice * $quantity' },
  { id: 'discount', expression: '$gross * $discountRate' },
  { id: 'net', expression: '$gross - $discount' },
  { id: 'tax', expression: '$net * $taxRate' },
  { id: 'total', expression: '$net + $tax' },
];

const context = {
  variables: {
    unitPrice: 100,
    quantity: 5,
    discountRate: 0.1,
    taxRate: 0.2,
  }
};

const results = engine.evaluateAll(formulas, context);

// Evaluation order: gross → discount → net → tax → total
console.log(results.results.get('total')?.value.toString()); // "540"
```

### Formula Definition Options

Each formula in `evaluateAll()` supports additional configuration options:

```typescript
interface FormulaDefinition {
  id: string;                    // Unique identifier for the formula
  expression: string;            // The expression to evaluate
  dependencies?: string[];       // Explicit dependencies (auto-detected if omitted)
  rounding?: RoundingConfig;     // Rounding configuration for the result
  onError?: ErrorBehavior;       // How to handle evaluation errors
  defaultValue?: unknown;        // Default value when using onError: 'DEFAULT'
  metadata?: Record<string, unknown>;  // Custom metadata (not used by engine)
}
```

#### Default Intermediate Rounding

For financial calculations, configure `defaultRounding` in the engine to automatically round all intermediate values in `evaluateAll()`:

```typescript
const engine = new FormulaEngine({
  defaultRounding: { mode: 'HALF_UP', precision: 2 }
});

const formulas = [
  { id: 'subtotal', expression: '$quantity * $unitPrice' },
  { id: 'tax', expression: '$subtotal * 0.0825' },  // Uses rounded subtotal
  { id: 'total', expression: '$subtotal + $tax' },
];

const results = engine.evaluateAll(formulas, {
  variables: { quantity: 3, unitPrice: 10.33 }
});

// subtotal = 30.99 (auto-rounded)
// tax = 2.56 (auto-rounded, calculated from rounded subtotal)
// total = 33.55
```

This ensures intermediate values are rounded before being used in dependent formulas, which is critical for financial/accounting calculations.

#### Disabling Intermediate Rounding

To disable the default intermediate rounding for specific batch evaluations, use the `disableIntermediateRounding` option:

```typescript
const results = engine.evaluateAll(formulas, context, {
  disableIntermediateRounding: true
});
// Raw unrounded values will propagate through dependencies
```

#### Per-Formula Rounding Override

Individual formulas can override the default rounding with their own `rounding` configuration:

```typescript
const engine = new FormulaEngine({
  defaultRounding: { mode: 'HALF_UP', precision: 2 }
});

const formulas = [
  // Override: use 4 decimal places for exchange rate
  { id: 'rate', expression: '1 / 3', rounding: { mode: 'HALF_UP', precision: 4 } },
  // Uses default 2 decimal rounding
  { id: 'amount', expression: '1000 * $rate' },
];

const results = engine.evaluateAll(formulas, { variables: {} });
// rate = 0.3333 (4 decimals from per-formula config)
// amount = 333.30 (2 decimals from default config)
```

**Rounding Modes:**
- `HALF_UP` - Round towards nearest neighbor, ties round up (standard rounding)
- `HALF_DOWN` - Round towards nearest neighbor, ties round down
- `FLOOR` - Round towards negative infinity
- `CEIL` - Round towards positive infinity
- `NONE` - No rounding applied

#### Error Handling Behavior

Control how errors are handled during batch evaluation:

```typescript
const formulas = [
  {
    id: 'ratio',
    expression: '$a / $b',
    onError: { type: 'ZERO' }  // Return 0 on division by zero
  },
  {
    id: 'result',
    expression: '$ratio * 100',  // Can continue with 0
  },
];

const results = engine.evaluateAll(formulas, {
  variables: { a: 10, b: 0 }
});
// ratio = 0 (instead of error)
// result = 0
```

**Error Behavior Types:**
- `THROW` - Propagate the error (default)
- `NULL` - Use `null` as the result
- `ZERO` - Use `0` as the result
- `DEFAULT` - Use `defaultValue` from the formula definition
- `SKIP` - Skip this formula (result is `undefined`)

### Decimal Precision

JavaScript floating-point math has precision issues:

```javascript
// Native JavaScript
0.1 + 0.2  // 0.30000000000000004 ❌

// Formula Engine
engine.evaluate('0.1 + 0.2', { variables: {} });
// Result: "0.3" ✓
```

### Context Variables

Use `$` for local variables and `@` for context variables:

```typescript
engine.evaluate('$price * (1 + @taxRate)', {
  variables: { price: 100 },
  extra: { taxRate: 0.19 }
});
// Result: 119
```

### Member and Index Access

```typescript
// Dot notation
engine.evaluate('$product.price * $product.quantity', {
  variables: {
    product: { price: 25, quantity: 4 }
  }
});

// Bracket notation
engine.evaluate('$items[0].name', {
  variables: {
    items: [{ name: 'Widget' }, { name: 'Gadget' }]
  }
});
```

### Array Functions

```typescript
// SUM with expression
engine.evaluate('SUM($items, $it.price * $it.qty)', {
  variables: {
    items: [
      { price: 10, qty: 2 },
      { price: 20, qty: 1 },
    ]
  }
});
// Result: 40

// FILTER
engine.evaluate('FILTER($numbers, $it > 5)', {
  variables: { numbers: [1, 3, 7, 9, 2] }
});
// Result: [7, 9]

// MAP
engine.evaluate('MAP($prices, $it * 1.1)', {
  variables: { prices: [100, 200, 300] }
});
// Result: [110, 220, 330]
```

### Custom Functions

```typescript
engine.registerFunction({
  name: 'DISCOUNT_TIER',
  minArgs: 2,
  maxArgs: 2,
  returnType: 'decimal',
  implementation: (args) => {
    const [amount, tiers] = args;
    const tier = tiers
      .filter(t => amount >= t.threshold)
      .sort((a, b) => b.threshold - a.threshold)[0];
    return tier ? amount * tier.rate : 0;
  }
});

engine.evaluate('DISCOUNT_TIER($total, @tiers)', {
  variables: { total: 150 },
  extra: {
    tiers: [
      { threshold: 0, rate: 0 },
      { threshold: 100, rate: 0.05 },
      { threshold: 200, rate: 0.10 },
    ]
  }
});
// Result: 7.5 (150 * 0.05)
```

### Validation

Validate formulas before evaluation:

```typescript
const formulas = [
  { id: 'a', expression: '$b + 1' },
  { id: 'b', expression: '$a + 1' }, // Circular!
];

const validation = engine.validate(formulas);

if (!validation.valid) {
  console.log(validation.errors);
  // CircularDependencyError: Circular dependency detected: a → b → a
}
```

## Built-in Functions

### Math Functions

| Function | Description | Example |
|----------|-------------|---------|
| `ABS(x)` | Absolute value | `ABS(-5)` → `5` |
| `ROUND(x, p?)` | Round to precision | `ROUND(3.456, 2)` → `3.46` |
| `FLOOR(x, p?)` | Round down | `FLOOR(3.9)` → `3` |
| `CEIL(x, p?)` | Round up | `CEIL(3.1)` → `4` |
| `TRUNCATE(x, p?)` | Truncate decimals | `TRUNCATE(3.999, 2)` → `3.99` |
| `MIN(a, b, ...)` | Minimum value | `MIN(5, 3, 8)` → `3` |
| `MAX(a, b, ...)` | Maximum value | `MAX(5, 3, 8)` → `8` |
| `POW(x, y)` | Power | `POW(2, 3)` → `8` |
| `SQRT(x)` | Square root | `SQRT(16)` → `4` |
| `LOG(x)` | Natural logarithm | `LOG(10)` → `2.302...` |
| `LOG10(x)` | Base-10 logarithm | `LOG10(100)` → `2` |
| `SIGN(x)` | Sign (-1, 0, 1) | `SIGN(-5)` → `-1` |

### String Functions

| Function | Description | Example |
|----------|-------------|---------|
| `LEN(s)` | String length | `LEN("hello")` → `5` |
| `UPPER(s)` | Uppercase | `UPPER("hello")` → `"HELLO"` |
| `LOWER(s)` | Lowercase | `LOWER("HELLO")` → `"hello"` |
| `TRIM(s)` | Trim whitespace | `TRIM("  hi  ")` → `"hi"` |
| `CONCAT(a, b, ...)` | Concatenate | `CONCAT("a", "b")` → `"ab"` |
| `SUBSTR(s, start, len?)` | Substring | `SUBSTR("hello", 1, 3)` → `"ell"` |
| `REPLACE(s, find, rep)` | Replace all | `REPLACE("aaa", "a", "b")` → `"bbb"` |
| `CONTAINS(s, sub)` | Contains check | `CONTAINS("hello", "ell")` → `true` |
| `STARTSWITH(s, pre)` | Starts with | `STARTSWITH("hello", "he")` → `true` |
| `ENDSWITH(s, suf)` | Ends with | `ENDSWITH("hello", "lo")` → `true` |

### Logical Functions

| Function | Description | Example |
|----------|-------------|---------|
| `IF(cond, t, f)` | Conditional | `IF(true, "yes", "no")` → `"yes"` |
| `COALESCE(a, b, ...)` | First non-null | `COALESCE(null, 5)` → `5` |
| `ISNULL(x)` | Check null | `ISNULL(null)` → `true` |
| `ISEMPTY(x)` | Check empty | `ISEMPTY([])` → `true` |
| `DEFAULT(x, d)` | Default if null | `DEFAULT(null, 0)` → `0` |
| `AND(a, b, ...)` | Logical AND | `AND(true, false)` → `false` |
| `OR(a, b, ...)` | Logical OR | `OR(true, false)` → `true` |
| `NOT(x)` | Logical NOT | `NOT(true)` → `false` |

### Aggregation Functions

| Function | Description | Example |
|----------|-------------|---------|
| `SUM(arr)` | Sum of array | `SUM([1, 2, 3])` → `6` |
| `SUM(arr, expr)` | Sum with expression | `SUM($items, $it.price)` |
| `AVG(arr)` | Average | `AVG([10, 20, 30])` → `20` |
| `COUNT(arr)` | Count elements | `COUNT([1, 2, 3])` → `3` |
| `PRODUCT(arr)` | Product of values | `PRODUCT([2, 3, 4])` → `24` |
| `FILTER(arr, cond)` | Filter array | `FILTER($arr, $it > 5)` |
| `MAP(arr, expr)` | Transform array | `MAP($arr, $it * 2)` |
| `FIRST(arr)` | First element | `FIRST([1, 2, 3])` → `1` |
| `LAST(arr)` | Last element | `LAST([1, 2, 3])` → `3` |

### Type Functions

| Function | Description | Example |
|----------|-------------|---------|
| `NUMBER(x)` | Convert to number | `NUMBER("42")` → `42` |
| `STRING(x)` | Convert to string | `STRING(42)` → `"42"` |
| `BOOLEAN(x)` | Convert to boolean | `BOOLEAN(1)` → `true` |
| `TYPEOF(x)` | Get type name | `TYPEOF(42)` → `"decimal"` |

## Configuration

```typescript
const engine = new FormulaEngine({
  // Enable expression caching (default: true)
  enableCache: true,

  // Maximum cache size (default: 1000)
  maxCacheSize: 1000,

  // Strict mode - fail on undefined variables (default: true)
  strictMode: true,

  // Decimal configuration
  decimal: {
    precision: 20,           // Significant digits
    roundingMode: 'HALF_UP', // Rounding mode
    divisionScale: 10,       // Decimal places for division
  },

  // Default rounding for evaluateAll() intermediate values
  // When set, all formula results in batch evaluation are rounded
  // before being used in dependent formulas
  defaultRounding: {
    mode: 'HALF_UP',         // Rounding mode
    precision: 2,            // Decimal places (e.g., 2 for currency)
  },

  // Security limits
  security: {
    maxExpressionLength: 10000,
    maxRecursionDepth: 100,
    maxIterations: 10000,
  },
});
```

## Error Handling

```typescript
const result = engine.evaluate('$a / $b', {
  variables: { a: 10, b: 0 }
});

if (!result.success) {
  console.log(result.error); // DivisionByZeroError
}
```

### Error Types

- **Parse Errors**: `SyntaxError`, `UnexpectedTokenError`, `UnterminatedStringError`
- **Validation Errors**: `CircularDependencyError`, `UndefinedVariableError`, `UndefinedFunctionError`
- **Evaluation Errors**: `DivisionByZeroError`, `TypeMismatchError`, `ArgumentCountError`

## API Reference

### FormulaEngine

```typescript
class FormulaEngine {
  constructor(config?: FormulaEngineConfig);

  // Parse expression to AST
  parse(expression: string): ASTNode;

  // Extract dependencies from expression
  extractDependencies(expression: string): Set<string>;

  // Build dependency graph
  buildDependencyGraph(formulas: FormulaDefinition[]): DependencyGraph;

  // Get evaluation order
  getEvaluationOrder(formulas: FormulaDefinition[]): string[];

  // Validate formulas
  validate(formulas: FormulaDefinition[]): ValidationResult;

  // Evaluate single expression
  evaluate(expression: string, context: EvaluationContext): EvaluationResult;

  // Evaluate all formulas in order (with optional rounding options)
  evaluateAll(formulas: FormulaDefinition[], context: EvaluationContext, options?: EvaluateAllOptions): EvaluationResultSet;

  // Register custom function
  registerFunction(definition: FunctionDefinition): void;

  // Cache management
  clearCache(): void;
  getCacheStats(): CacheStats;
}
```

## Development

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build
npm run build

# Lint
npm run lint
```

## License

MIT

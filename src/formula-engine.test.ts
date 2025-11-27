import { FormulaEngine } from './formula-engine';
import { FormulaDefinition, EvaluationContext } from './types';
import { Decimal } from './decimal-utils';
import {
  CircularDependencyError,
  DivisionByZeroError,
  UndefinedVariableError,
  UndefinedFunctionError,
} from './errors';

describe('FormulaEngine', () => {
  let engine: FormulaEngine;

  beforeEach(() => {
    engine = new FormulaEngine();
  });

  describe('Basic Evaluation', () => {
    it('should evaluate numeric literals', () => {
      const result = engine.evaluate('42', { variables: {} });

      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Decimal);
      expect((result.value as Decimal).toString()).toBe('42');
    });

    it('should evaluate string literals', () => {
      const result = engine.evaluate('"hello"', { variables: {} });

      expect(result.success).toBe(true);
      expect(result.value).toBe('hello');
    });

    it('should evaluate boolean literals', () => {
      expect(engine.evaluate('true', { variables: {} }).value).toBe(true);
      expect(engine.evaluate('false', { variables: {} }).value).toBe(false);
    });

    it('should evaluate null literal', () => {
      const result = engine.evaluate('null', { variables: {} });

      expect(result.value).toBe(null);
    });

    it('should evaluate variables', () => {
      const result = engine.evaluate('$price', {
        variables: { price: 100 },
      });

      expect(result.success).toBe(true);
      expect((result.value as Decimal).toNumber()).toBe(100);
    });

    it('should evaluate context variables', () => {
      const result = engine.evaluate('@userId', {
        variables: {},
        extra: { userId: 'user123' },
      });

      expect(result.value).toBe('user123');
    });
  });

  describe('Arithmetic Operations', () => {
    it('should evaluate addition', () => {
      const result = engine.evaluate('$a + $b', {
        variables: { a: 10, b: 5 },
      });

      expect((result.value as Decimal).toNumber()).toBe(15);
    });

    it('should evaluate subtraction', () => {
      const result = engine.evaluate('$a - $b', {
        variables: { a: 10, b: 5 },
      });

      expect((result.value as Decimal).toNumber()).toBe(5);
    });

    it('should evaluate multiplication', () => {
      const result = engine.evaluate('$a * $b', {
        variables: { a: 10, b: 5 },
      });

      expect((result.value as Decimal).toNumber()).toBe(50);
    });

    it('should evaluate division', () => {
      const result = engine.evaluate('$a / $b', {
        variables: { a: 10, b: 5 },
      });

      expect((result.value as Decimal).toNumber()).toBe(2);
    });

    it('should evaluate modulo', () => {
      const result = engine.evaluate('$a % $b', {
        variables: { a: 10, b: 3 },
      });

      expect((result.value as Decimal).toNumber()).toBe(1);
    });

    it('should evaluate power', () => {
      const result = engine.evaluate('$a ^ $b', {
        variables: { a: 2, b: 3 },
      });

      expect((result.value as Decimal).toNumber()).toBe(8);
    });

    it('should throw on division by zero', () => {
      const result = engine.evaluate('$a / $b', {
        variables: { a: 10, b: 0 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(DivisionByZeroError);
    });

    it('should handle operator precedence', () => {
      const result = engine.evaluate('$a + $b * $c', {
        variables: { a: 2, b: 3, c: 4 },
      });

      expect((result.value as Decimal).toNumber()).toBe(14); // 2 + (3*4) = 14
    });

    it('should handle parentheses', () => {
      const result = engine.evaluate('($a + $b) * $c', {
        variables: { a: 2, b: 3, c: 4 },
      });

      expect((result.value as Decimal).toNumber()).toBe(20); // (2+3)*4 = 20
    });
  });

  describe('Decimal Precision', () => {
    it('should handle 0.1 + 0.2 correctly', () => {
      const result = engine.evaluate('0.1 + 0.2', { variables: {} });

      expect((result.value as Decimal).toString()).toBe('0.3');
    });

    it('should handle financial calculations', () => {
      const result = engine.evaluate('$price * $quantity', {
        variables: { price: 19.99, quantity: 3 },
      });

      expect((result.value as Decimal).toString()).toBe('59.97');
    });

    it('should handle complex decimal calculations', () => {
      const result = engine.evaluate('1000.10 - 1000.00', { variables: {} });

      expect((result.value as Decimal).toString()).toBe('0.1');
    });
  });

  describe('Comparison Operations', () => {
    it('should evaluate equality', () => {
      expect(engine.evaluate('$a == $b', { variables: { a: 5, b: 5 } }).value).toBe(true);
      expect(engine.evaluate('$a == $b', { variables: { a: 5, b: 6 } }).value).toBe(false);
    });

    it('should evaluate inequality', () => {
      expect(engine.evaluate('$a != $b', { variables: { a: 5, b: 6 } }).value).toBe(true);
    });

    it('should evaluate less than', () => {
      expect(engine.evaluate('$a < $b', { variables: { a: 5, b: 6 } }).value).toBe(true);
      expect(engine.evaluate('$a < $b', { variables: { a: 6, b: 5 } }).value).toBe(false);
    });

    it('should evaluate greater than', () => {
      expect(engine.evaluate('$a > $b', { variables: { a: 6, b: 5 } }).value).toBe(true);
    });

    it('should evaluate less than or equal', () => {
      expect(engine.evaluate('$a <= $b', { variables: { a: 5, b: 5 } }).value).toBe(true);
      expect(engine.evaluate('$a <= $b', { variables: { a: 5, b: 6 } }).value).toBe(true);
    });

    it('should evaluate greater than or equal', () => {
      expect(engine.evaluate('$a >= $b', { variables: { a: 5, b: 5 } }).value).toBe(true);
    });
  });

  describe('Logical Operations', () => {
    it('should evaluate AND', () => {
      expect(engine.evaluate('$a && $b', { variables: { a: true, b: true } }).value).toBe(true);
      expect(engine.evaluate('$a && $b', { variables: { a: true, b: false } }).value).toBe(false);
    });

    it('should evaluate OR', () => {
      expect(engine.evaluate('$a || $b', { variables: { a: false, b: true } }).value).toBe(true);
      expect(engine.evaluate('$a || $b', { variables: { a: false, b: false } }).value).toBe(false);
    });

    it('should evaluate NOT', () => {
      expect(engine.evaluate('!$a', { variables: { a: true } }).value).toBe(false);
      expect(engine.evaluate('!$a', { variables: { a: false } }).value).toBe(true);
    });

    it('should short-circuit AND', () => {
      // If first operand is false, second shouldn't be evaluated
      const result = engine.evaluate('false && $undefined', { variables: {} });
      expect(result.value).toBe(false);
    });

    it('should short-circuit OR', () => {
      // If first operand is true, second shouldn't be evaluated
      const result = engine.evaluate('true || $undefined', { variables: {} });
      expect(result.value).toBe(true);
    });
  });

  describe('Conditional Expressions', () => {
    it('should evaluate ternary when true', () => {
      const result = engine.evaluate('$a > 5 ? "big" : "small"', {
        variables: { a: 10 },
      });

      expect(result.value).toBe('big');
    });

    it('should evaluate ternary when false', () => {
      const result = engine.evaluate('$a > 5 ? "big" : "small"', {
        variables: { a: 3 },
      });

      expect(result.value).toBe('small');
    });

    it('should handle nested ternary', () => {
      const result = engine.evaluate(
        '$score >= 90 ? "A" : ($score >= 80 ? "B" : "C")',
        { variables: { score: 85 } }
      );

      expect(result.value).toBe('B');
    });
  });

  describe('Built-in Functions', () => {
    describe('Math Functions', () => {
      it('should evaluate ABS', () => {
        expect((engine.evaluate('ABS(-5)', { variables: {} }).value as Decimal).toNumber()).toBe(5);
        expect((engine.evaluate('ABS(5)', { variables: {} }).value as Decimal).toNumber()).toBe(5);
      });

      it('should evaluate ROUND', () => {
        const result = engine.evaluate('ROUND(3.456, 2)', { variables: {} });
        expect((result.value as Decimal).toString()).toBe('3.46');
      });

      it('should evaluate FLOOR', () => {
        const result = engine.evaluate('FLOOR(3.9)', { variables: {} });
        expect((result.value as Decimal).toNumber()).toBe(3);
      });

      it('should evaluate CEIL', () => {
        const result = engine.evaluate('CEIL(3.1)', { variables: {} });
        expect((result.value as Decimal).toNumber()).toBe(4);
      });

      it('should evaluate MIN', () => {
        const result = engine.evaluate('MIN(5, 3, 8)', { variables: {} });
        expect((result.value as Decimal).toNumber()).toBe(3);
      });

      it('should evaluate MAX', () => {
        const result = engine.evaluate('MAX(5, 3, 8)', { variables: {} });
        expect((result.value as Decimal).toNumber()).toBe(8);
      });

      it('should evaluate POW', () => {
        const result = engine.evaluate('POW(2, 3)', { variables: {} });
        expect((result.value as Decimal).toNumber()).toBe(8);
      });

      it('should evaluate SQRT', () => {
        const result = engine.evaluate('SQRT(16)', { variables: {} });
        expect((result.value as Decimal).toNumber()).toBe(4);
      });
    });

    describe('String Functions', () => {
      it('should evaluate LEN', () => {
        expect(engine.evaluate('LEN("hello")', { variables: {} }).value).toBe(5);
      });

      it('should evaluate UPPER', () => {
        expect(engine.evaluate('UPPER("hello")', { variables: {} }).value).toBe('HELLO');
      });

      it('should evaluate LOWER', () => {
        expect(engine.evaluate('LOWER("HELLO")', { variables: {} }).value).toBe('hello');
      });

      it('should evaluate TRIM', () => {
        expect(engine.evaluate('TRIM("  hello  ")', { variables: {} }).value).toBe('hello');
      });

      it('should evaluate CONCAT', () => {
        expect(engine.evaluate('CONCAT("a", "b", "c")', { variables: {} }).value).toBe('abc');
      });

      it('should evaluate SUBSTR', () => {
        expect(engine.evaluate('SUBSTR("hello", 1, 3)', { variables: {} }).value).toBe('ell');
      });

      it('should evaluate CONTAINS', () => {
        expect(engine.evaluate('CONTAINS("hello", "ell")', { variables: {} }).value).toBe(true);
        expect(engine.evaluate('CONTAINS("hello", "xyz")', { variables: {} }).value).toBe(false);
      });
    });

    describe('Logical Functions', () => {
      it('should evaluate IF', () => {
        expect(engine.evaluate('IF(true, "yes", "no")', { variables: {} }).value).toBe('yes');
        expect(engine.evaluate('IF(false, "yes", "no")', { variables: {} }).value).toBe('no');
      });

      it('should evaluate COALESCE', () => {
        expect(engine.evaluate('COALESCE(null, null, 5)', { variables: {} }).value)
          .toBeInstanceOf(Decimal);
        expect((engine.evaluate('COALESCE(null, null, 5)', { variables: {} }).value as Decimal).toNumber())
          .toBe(5);
      });

      it('should evaluate ISNULL', () => {
        expect(engine.evaluate('ISNULL(null)', { variables: {} }).value).toBe(true);
        expect(engine.evaluate('ISNULL(5)', { variables: {} }).value).toBe(false);
      });

      it('should evaluate DEFAULT', () => {
        const result = engine.evaluate('DEFAULT(null, 10)', { variables: {} });
        expect((result.value as Decimal).toNumber()).toBe(10);
      });
    });

    describe('Type Functions', () => {
      it('should evaluate TYPEOF', () => {
        expect(engine.evaluate('TYPEOF(42)', { variables: {} }).value).toBe('decimal');
        expect(engine.evaluate('TYPEOF("hello")', { variables: {} }).value).toBe('string');
        expect(engine.evaluate('TYPEOF(true)', { variables: {} }).value).toBe('boolean');
        expect(engine.evaluate('TYPEOF(null)', { variables: {} }).value).toBe('null');
      });

      it('should evaluate STRING', () => {
        expect(engine.evaluate('STRING(42)', { variables: {} }).value).toBe('42');
      });

      it('should evaluate NUMBER', () => {
        const result = engine.evaluate('NUMBER("42")', { variables: {} });
        expect((result.value as Decimal).toNumber()).toBe(42);
      });
    });

    describe('Array Functions', () => {
      it('should evaluate COUNT', () => {
        expect(engine.evaluate('COUNT($arr)', { variables: { arr: [1, 2, 3, 4, 5] } }).value).toBe(5);
      });

      it('should evaluate FIRST', () => {
        const result = engine.evaluate('FIRST($arr)', { variables: { arr: [1, 2, 3] } });
        expect((result.value as Decimal).toNumber()).toBe(1);
      });

      it('should evaluate LAST', () => {
        const result = engine.evaluate('LAST($arr)', { variables: { arr: [1, 2, 3] } });
        expect((result.value as Decimal).toNumber()).toBe(3);
      });

      it('should evaluate SUM', () => {
        const result = engine.evaluate('SUM($arr)', { variables: { arr: [1, 2, 3, 4, 5] } });
        expect((result.value as Decimal).toNumber()).toBe(15);
      });

      it('should evaluate AVG', () => {
        const result = engine.evaluate('AVG($arr)', { variables: { arr: [10, 20, 30] } });
        expect((result.value as Decimal).toNumber()).toBe(20);
      });

      it('should evaluate SUM with expression', () => {
        const result = engine.evaluate('SUM($items, $it.price * $it.qty)', {
          variables: {
            items: [
              { price: 10, qty: 2 },
              { price: 20, qty: 1 },
            ],
          },
        });
        expect((result.value as Decimal).toNumber()).toBe(40);
      });

      it('should evaluate FILTER', () => {
        const result = engine.evaluate('FILTER($arr, $it > 2)', {
          variables: { arr: [1, 2, 3, 4, 5] },
        });
        expect(result.value).toEqual([
          expect.any(Decimal),
          expect.any(Decimal),
          expect.any(Decimal),
        ]);
      });

      it('should evaluate MAP', () => {
        const result = engine.evaluate('MAP($arr, $it * 2)', {
          variables: { arr: [1, 2, 3] },
        });
        expect((result.value as Decimal[])[0].toNumber()).toBe(2);
        expect((result.value as Decimal[])[1].toNumber()).toBe(4);
        expect((result.value as Decimal[])[2].toNumber()).toBe(6);
      });
    });
  });

  describe('Member Access', () => {
    it('should access object properties', () => {
      const result = engine.evaluate('$product.price', {
        variables: { product: { price: 100 } },
      });

      expect((result.value as Decimal).toNumber()).toBe(100);
    });

    it('should access nested properties', () => {
      const result = engine.evaluate('$customer.address.city', {
        variables: {
          customer: {
            address: { city: 'New York' },
          },
        },
      });

      expect(result.value).toBe('New York');
    });
  });

  describe('Index Access', () => {
    it('should access array by index', () => {
      const result = engine.evaluate('$items[1]', {
        variables: { items: [10, 20, 30] },
      });

      expect((result.value as Decimal).toNumber()).toBe(20);
    });

    it('should access object by key', () => {
      const result = engine.evaluate('$data["name"]', {
        variables: { data: { name: 'John' } },
      });

      expect(result.value).toBe('John');
    });
  });

  describe('Batch Evaluation', () => {
    it('should evaluate formulas in dependency order', () => {
      const formulas: FormulaDefinition[] = [
        { id: 'basePrice', expression: '$unitPrice * $quantity' },
        { id: 'discount', expression: '$basePrice * $discountRate' },
        { id: 'total', expression: '$basePrice - $discount' },
      ];

      const context: EvaluationContext = {
        variables: {
          unitPrice: 100,
          quantity: 5,
          discountRate: 0.1,
        },
      };

      const results = engine.evaluateAll(formulas, context);

      expect(results.success).toBe(true);
      expect(results.evaluationOrder).toEqual(['basePrice', 'discount', 'total']);
      expect((results.results.get('basePrice')?.value as Decimal).toNumber()).toBe(500);
      expect((results.results.get('discount')?.value as Decimal).toNumber()).toBe(50);
      expect((results.results.get('total')?.value as Decimal).toNumber()).toBe(450);
    });

    it('should detect circular dependencies', () => {
      const formulas: FormulaDefinition[] = [
        { id: 'a', expression: '$b + 1' },
        { id: 'b', expression: '$c + 1' },
        { id: 'c', expression: '$a + 1' },
      ];

      const results = engine.evaluateAll(formulas, { variables: {} });

      expect(results.success).toBe(false);
      expect(results.errors[0]).toBeInstanceOf(CircularDependencyError);
    });

    it('should handle complex dependency chains', () => {
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
        },
      };

      const results = engine.evaluateAll(formulas, context);

      expect(results.success).toBe(true);
      expect((results.results.get('gross')?.value as Decimal).toNumber()).toBe(500);
      expect((results.results.get('discount')?.value as Decimal).toNumber()).toBe(50);
      expect((results.results.get('net')?.value as Decimal).toNumber()).toBe(450);
      expect((results.results.get('tax')?.value as Decimal).toNumber()).toBe(90);
      expect((results.results.get('total')?.value as Decimal).toNumber()).toBe(540);
    });
  });

  describe('Validation', () => {
    it('should validate formulas without evaluating', () => {
      const formulas: FormulaDefinition[] = [
        { id: 'a', expression: '$b + 1' },
        { id: 'b', expression: '$c + 1' },
      ];

      const result = engine.validate(formulas);

      expect(result.valid).toBe(true);
      expect(result.evaluationOrder).toEqual(['b', 'a']);
    });

    it('should detect circular dependencies in validation', () => {
      const formulas: FormulaDefinition[] = [
        { id: 'a', expression: '$b + 1' },
        { id: 'b', expression: '$a + 1' },
      ];

      const result = engine.validate(formulas);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBeInstanceOf(CircularDependencyError);
    });

    it('should detect syntax errors in validation', () => {
      const formulas: FormulaDefinition[] = [
        { id: 'a', expression: '$b +' },
      ];

      const result = engine.validate(formulas);

      expect(result.valid).toBe(false);
    });
  });

  describe('Custom Functions', () => {
    it('should register and use custom functions', () => {
      engine.registerFunction({
        name: 'DOUBLE',
        minArgs: 1,
        maxArgs: 1,
        returnType: 'decimal',
        implementation: (args) => {
          const val = args[0] as Decimal;
          return val.times(2);
        },
      });

      const result = engine.evaluate('DOUBLE($x)', { variables: { x: 5 } });

      expect((result.value as Decimal).toNumber()).toBe(10);
    });

    it('should throw on undefined function', () => {
      const result = engine.evaluate('UNKNOWN($x)', { variables: { x: 5 } });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(UndefinedFunctionError);
    });
  });

  describe('Error Handling', () => {
    it('should handle undefined variables in strict mode', () => {
      const strictEngine = new FormulaEngine({ strictMode: true });
      const result = strictEngine.evaluate('$undefined', { variables: {} });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(UndefinedVariableError);
    });

    it('should return null for undefined variables in non-strict mode', () => {
      const lenientEngine = new FormulaEngine({ strictMode: false });
      const result = lenientEngine.evaluate('$undefined', { variables: {} });

      expect(result.success).toBe(true);
      expect(result.value).toBe(null);
    });

    it('should handle error behavior in batch evaluation', () => {
      const formulas: FormulaDefinition[] = [
        {
          id: 'result',
          expression: '$a / $b',
          onError: { type: 'ZERO' },
        },
      ];

      const results = engine.evaluateAll(formulas, {
        variables: { a: 10, b: 0 },
      });

      expect((results.results.get('result')?.value as Decimal).isZero()).toBe(true);
    });
  });

  describe('Caching', () => {
    it('should cache parsed expressions', () => {
      const expression = '$a + $b';

      // Parse twice
      engine.parse(expression);
      engine.parse(expression);

      const stats = engine.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should clear cache', () => {
      engine.parse('$a + $b');
      engine.clearCache();

      const stats = engine.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('String Concatenation', () => {
    it('should concatenate strings with + operator', () => {
      const result = engine.evaluate('"Hello" + " " + "World"', { variables: {} });
      expect(result.value).toBe('Hello World');
    });

    it('should concatenate string with number', () => {
      const result = engine.evaluate('"Value: " + $x', { variables: { x: 42 } });
      expect(result.value).toBe('Value: 42');
    });
  });
});

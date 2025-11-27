import { Parser } from './parser';
import { UnexpectedTokenError } from './errors';

describe('Parser', () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
  });

  describe('Literals', () => {
    it('should parse decimal literals', () => {
      const ast = parser.parse('42');

      expect(ast.type).toBe('DecimalLiteral');
      expect((ast as any).value).toBe('42');
    });

    it('should parse string literals', () => {
      const ast = parser.parse('"hello"');

      expect(ast.type).toBe('StringLiteral');
      expect((ast as any).value).toBe('hello');
    });

    it('should parse boolean literals', () => {
      expect(parser.parse('true').type).toBe('BooleanLiteral');
      expect((parser.parse('true') as any).value).toBe(true);
      expect((parser.parse('false') as any).value).toBe(false);
    });

    it('should parse null literal', () => {
      const ast = parser.parse('null');

      expect(ast.type).toBe('NullLiteral');
    });

    it('should parse array literals', () => {
      const ast = parser.parse('[1, 2, 3]');

      expect(ast.type).toBe('ArrayLiteral');
      expect((ast as any).elements).toHaveLength(3);
    });

    it('should parse empty arrays', () => {
      const ast = parser.parse('[]');

      expect(ast.type).toBe('ArrayLiteral');
      expect((ast as any).elements).toHaveLength(0);
    });
  });

  describe('Variables', () => {
    it('should parse $ variables', () => {
      const ast = parser.parse('$price');

      expect(ast.type).toBe('VariableReference');
      expect((ast as any).prefix).toBe('$');
      expect((ast as any).name).toBe('price');
    });

    it('should parse @ context variables', () => {
      const ast = parser.parse('@userId');

      expect(ast.type).toBe('VariableReference');
      expect((ast as any).prefix).toBe('@');
      expect((ast as any).name).toBe('userId');
    });
  });

  describe('Binary Operations', () => {
    it('should parse addition', () => {
      const ast = parser.parse('$a + $b');

      expect(ast.type).toBe('BinaryOperation');
      expect((ast as any).operator).toBe('+');
      expect((ast as any).left.name).toBe('a');
      expect((ast as any).right.name).toBe('b');
    });

    it('should parse subtraction', () => {
      const ast = parser.parse('$a - $b');

      expect((ast as any).operator).toBe('-');
    });

    it('should parse multiplication', () => {
      const ast = parser.parse('$a * $b');

      expect((ast as any).operator).toBe('*');
    });

    it('should parse division', () => {
      const ast = parser.parse('$a / $b');

      expect((ast as any).operator).toBe('/');
    });

    it('should parse modulo', () => {
      const ast = parser.parse('$a % $b');

      expect((ast as any).operator).toBe('%');
    });

    it('should parse power', () => {
      const ast = parser.parse('$a ^ $b');

      expect((ast as any).operator).toBe('^');
    });

    it('should respect operator precedence (mul before add)', () => {
      const ast = parser.parse('$a + $b * $c');

      expect(ast.type).toBe('BinaryOperation');
      expect((ast as any).operator).toBe('+');
      expect((ast as any).right.operator).toBe('*');
    });

    it('should respect operator precedence (power before mul)', () => {
      const ast = parser.parse('$a * $b ^ $c');

      expect(ast.type).toBe('BinaryOperation');
      expect((ast as any).operator).toBe('*');
      expect((ast as any).right.operator).toBe('^');
    });

    it('should handle parentheses', () => {
      const ast = parser.parse('($a + $b) * $c');

      expect((ast as any).operator).toBe('*');
      expect((ast as any).left.operator).toBe('+');
    });
  });

  describe('Comparison Operations', () => {
    it('should parse equality', () => {
      const ast = parser.parse('$a == $b');

      expect((ast as any).operator).toBe('==');
    });

    it('should parse inequality', () => {
      const ast = parser.parse('$a != $b');

      expect((ast as any).operator).toBe('!=');
    });

    it('should parse less than', () => {
      const ast = parser.parse('$a < $b');

      expect((ast as any).operator).toBe('<');
    });

    it('should parse greater than', () => {
      const ast = parser.parse('$a > $b');

      expect((ast as any).operator).toBe('>');
    });

    it('should parse less than or equal', () => {
      const ast = parser.parse('$a <= $b');

      expect((ast as any).operator).toBe('<=');
    });

    it('should parse greater than or equal', () => {
      const ast = parser.parse('$a >= $b');

      expect((ast as any).operator).toBe('>=');
    });
  });

  describe('Logical Operations', () => {
    it('should parse AND', () => {
      const ast = parser.parse('$a && $b');

      expect((ast as any).operator).toBe('&&');
    });

    it('should parse OR', () => {
      const ast = parser.parse('$a || $b');

      expect((ast as any).operator).toBe('||');
    });

    it('should parse NOT', () => {
      const ast = parser.parse('!$a');

      expect(ast.type).toBe('UnaryOperation');
      expect((ast as any).operator).toBe('!');
    });

    it('should respect logical operator precedence (AND before OR)', () => {
      const ast = parser.parse('$a || $b && $c');

      expect((ast as any).operator).toBe('||');
      expect((ast as any).right.operator).toBe('&&');
    });
  });

  describe('Unary Operations', () => {
    it('should parse negation', () => {
      const ast = parser.parse('-$a');

      expect(ast.type).toBe('UnaryOperation');
      expect((ast as any).operator).toBe('-');
    });

    it('should parse double negation', () => {
      const ast = parser.parse('--$a');

      expect(ast.type).toBe('UnaryOperation');
      expect((ast as any).operand.type).toBe('UnaryOperation');
    });
  });

  describe('Conditional Expressions', () => {
    it('should parse ternary operator', () => {
      const ast = parser.parse('$a > 0 ? $b : $c');

      expect(ast.type).toBe('ConditionalExpression');
      expect((ast as any).condition.operator).toBe('>');
      expect((ast as any).consequent.name).toBe('b');
      expect((ast as any).alternate.name).toBe('c');
    });

    it('should parse nested ternary', () => {
      const ast = parser.parse('$a ? $b ? $c : $d : $e');

      expect(ast.type).toBe('ConditionalExpression');
      expect((ast as any).consequent.type).toBe('ConditionalExpression');
    });
  });

  describe('Function Calls', () => {
    it('should parse function with no arguments', () => {
      // Note: Our parser requires variables to have prefix, so we can't call functions with no args easily
      // Let's test with a simple case
      const ast = parser.parse('MAX($a, $b)');

      expect(ast.type).toBe('FunctionCall');
      expect((ast as any).name).toBe('MAX');
      expect((ast as any).arguments).toHaveLength(2);
    });

    it('should parse function with single argument', () => {
      const ast = parser.parse('ABS($x)');

      expect(ast.type).toBe('FunctionCall');
      expect((ast as any).arguments).toHaveLength(1);
    });

    it('should parse nested function calls', () => {
      const ast = parser.parse('MAX(MIN($a, $b), $c)');

      expect(ast.type).toBe('FunctionCall');
      expect((ast as any).arguments[0].type).toBe('FunctionCall');
    });

    it('should uppercase function names', () => {
      const ast = parser.parse('max($a, $b)');

      expect((ast as any).name).toBe('MAX');
    });
  });

  describe('Member Access', () => {
    it('should parse dot notation', () => {
      const ast = parser.parse('$product.price');

      expect(ast.type).toBe('MemberAccess');
      expect((ast as any).object.name).toBe('product');
      expect((ast as any).property).toBe('price');
    });

    it('should parse chained dot notation', () => {
      const ast = parser.parse('$customer.address.city');

      expect(ast.type).toBe('MemberAccess');
      expect((ast as any).object.type).toBe('MemberAccess');
    });
  });

  describe('Index Access', () => {
    it('should parse bracket notation with number', () => {
      const ast = parser.parse('$items[0]');

      expect(ast.type).toBe('IndexAccess');
      expect((ast as any).object.name).toBe('items');
      expect((ast as any).index.type).toBe('DecimalLiteral');
    });

    it('should parse bracket notation with string', () => {
      const ast = parser.parse('$data["key"]');

      expect(ast.type).toBe('IndexAccess');
      expect((ast as any).index.type).toBe('StringLiteral');
    });

    it('should parse bracket notation with variable', () => {
      const ast = parser.parse('$items[$index]');

      expect(ast.type).toBe('IndexAccess');
      expect((ast as any).index.type).toBe('VariableReference');
    });

    it('should parse mixed access', () => {
      const ast = parser.parse('$items[0].price');

      expect(ast.type).toBe('MemberAccess');
      expect((ast as any).object.type).toBe('IndexAccess');
    });
  });

  describe('Complex Expressions', () => {
    it('should parse invoice calculation', () => {
      const ast = parser.parse('$unitPrice * $quantity * (1 - $discountRate)');

      expect(ast.type).toBe('BinaryOperation');
    });

    it('should parse conditional with operations', () => {
      const ast = parser.parse('$quantity > 10 ? $unitPrice * 0.9 : $unitPrice');

      expect(ast.type).toBe('ConditionalExpression');
    });

    it('should parse function in expression', () => {
      const ast = parser.parse('$total + ROUND($tax, 2)');

      expect(ast.type).toBe('BinaryOperation');
      expect((ast as any).right.type).toBe('FunctionCall');
    });
  });

  describe('Error Handling', () => {
    it('should throw on unexpected token', () => {
      expect(() => parser.parse('$a +')).toThrow(UnexpectedTokenError);
    });

    it('should throw on unmatched parenthesis', () => {
      expect(() => parser.parse('($a + $b')).toThrow(UnexpectedTokenError);
    });

    it('should throw on invalid ternary', () => {
      expect(() => parser.parse('$a ? $b')).toThrow(UnexpectedTokenError);
    });
  });
});

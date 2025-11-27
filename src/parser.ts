import { Lexer } from './lexer';
import { Token, TokenType, ASTNode } from './types';
import { SyntaxError, UnexpectedTokenError } from './errors';

// Operator precedence levels (higher = tighter binding)
const PRECEDENCE = {
  LOWEST: 1,
  TERNARY: 2,     // ? :
  OR: 3,          // || OR
  AND: 4,         // && AND
  EQUALITY: 5,    // == !=
  COMPARISON: 6,  // < > <= >=
  TERM: 7,        // + -
  FACTOR: 8,      // * / %
  POWER: 9,       // ^
  UNARY: 10,      // - ! NOT
  CALL: 11,       // function calls
  MEMBER: 12,     // . []
};

export class Parser {
  private tokens: Token[] = [];
  private current: number = 0;
  private expression: string = '';

  parse(expression: string): ASTNode {
    this.expression = expression;
    const lexer = new Lexer(expression);
    this.tokens = lexer.tokenize();
    this.current = 0;

    const ast = this.parseExpression(PRECEDENCE.LOWEST);

    if (!this.isAtEnd()) {
      const token = this.peek();
      throw new UnexpectedTokenError(
        String(token.value),
        ['end of expression'],
        token.position
      );
    }

    return ast;
  }

  private parseExpression(precedence: number): ASTNode {
    let left = this.parsePrefixExpression();

    while (!this.isAtEnd() && precedence < this.getPrecedence()) {
      left = this.parseInfixExpression(left);
    }

    return left;
  }

  private parsePrefixExpression(): ASTNode {
    const token = this.peek();

    switch (token.type) {
      case TokenType.NUMBER:
        return this.parseNumber();
      case TokenType.STRING:
        return this.parseString();
      case TokenType.BOOLEAN:
        return this.parseBoolean();
      case TokenType.NULL:
        return this.parseNull();
      case TokenType.VARIABLE:
        return this.parseVariable();
      case TokenType.CONTEXT_VAR:
        return this.parseContextVariable();
      case TokenType.IDENTIFIER:
        return this.parseIdentifierOrFunctionCall();
      case TokenType.LPAREN:
        return this.parseGroupedExpression();
      case TokenType.LBRACKET:
        return this.parseArrayLiteral();
      case TokenType.MINUS:
      case TokenType.NOT:
        return this.parseUnaryExpression();
      default:
        throw new UnexpectedTokenError(
          String(token.value),
          ['number', 'string', 'boolean', 'null', 'variable', 'identifier', '(', '[', '-', '!'],
          token.position
        );
    }
  }

  private parseInfixExpression(left: ASTNode): ASTNode {
    const token = this.peek();

    switch (token.type) {
      case TokenType.PLUS:
      case TokenType.MINUS:
      case TokenType.MULTIPLY:
      case TokenType.DIVIDE:
      case TokenType.MODULO:
      case TokenType.POWER:
      case TokenType.EQ:
      case TokenType.NEQ:
      case TokenType.LT:
      case TokenType.GT:
      case TokenType.LTE:
      case TokenType.GTE:
      case TokenType.AND:
      case TokenType.OR:
        return this.parseBinaryExpression(left);
      case TokenType.QUESTION:
        return this.parseTernaryExpression(left);
      case TokenType.DOT:
        return this.parseMemberAccess(left);
      case TokenType.LBRACKET:
        return this.parseIndexAccess(left);
      case TokenType.LPAREN:
        // This handles the case where we have an identifier followed by (
        // But actually this should be handled in parseIdentifierOrFunctionCall
        return left;
      default:
        return left;
    }
  }

  private parseNumber(): ASTNode {
    const token = this.advance();
    const value = token.value;

    if (typeof value === 'number') {
      // It's a float
      return {
        type: 'NumberLiteral',
        value: value,
      };
    } else {
      // It's a decimal (stored as string)
      return {
        type: 'DecimalLiteral',
        value: String(value),
        raw: String(value),
      };
    }
  }

  private parseString(): ASTNode {
    const token = this.advance();
    return {
      type: 'StringLiteral',
      value: String(token.value),
    };
  }

  private parseBoolean(): ASTNode {
    const token = this.advance();
    return {
      type: 'BooleanLiteral',
      value: token.value === true,
    };
  }

  private parseNull(): ASTNode {
    this.advance();
    return {
      type: 'NullLiteral',
    };
  }

  private parseVariable(): ASTNode {
    const token = this.advance();
    return {
      type: 'VariableReference',
      prefix: '$',
      name: String(token.value),
    };
  }

  private parseContextVariable(): ASTNode {
    const token = this.advance();
    return {
      type: 'VariableReference',
      prefix: '@',
      name: String(token.value),
    };
  }

  private parseIdentifierOrFunctionCall(): ASTNode {
    const token = this.advance();
    const name = String(token.value);

    // Check if it's a function call
    if (this.peek().type === TokenType.LPAREN) {
      return this.parseFunctionCall(name);
    }

    // Otherwise, check for keywords AND/OR/NOT used as standalone identifiers
    const upperName = name.toUpperCase();
    if (upperName === 'AND' || upperName === 'OR') {
      // These should be handled as operators, but if we reach here,
      // it means they were used in an invalid context
      throw new SyntaxError(
        `'${name}' cannot be used as an identifier`,
        token.position,
        token.line,
        token.column,
        this.expression
      );
    }

    // It's a bare identifier - could be a variable without prefix
    // For now, treat it as an error - require explicit prefix
    throw new SyntaxError(
      `Unknown identifier '${name}'. Variables must be prefixed with $ or @`,
      token.position,
      token.line,
      token.column,
      this.expression
    );
  }

  private parseFunctionCall(name: string): ASTNode {
    this.advance(); // consume '('
    const args: ASTNode[] = [];

    if (this.peek().type !== TokenType.RPAREN) {
      do {
        if (this.peek().type === TokenType.COMMA) {
          this.advance();
        }
        args.push(this.parseExpression(PRECEDENCE.LOWEST));
      } while (this.peek().type === TokenType.COMMA);
    }

    this.expect(TokenType.RPAREN, ')');

    return {
      type: 'FunctionCall',
      name: name.toUpperCase(), // Functions are case-insensitive
      arguments: args,
    };
  }

  private parseGroupedExpression(): ASTNode {
    this.advance(); // consume '('
    const expr = this.parseExpression(PRECEDENCE.LOWEST);
    this.expect(TokenType.RPAREN, ')');
    return expr;
  }

  private parseArrayLiteral(): ASTNode {
    this.advance(); // consume '['
    const elements: ASTNode[] = [];

    if (this.peek().type !== TokenType.RBRACKET) {
      do {
        if (this.peek().type === TokenType.COMMA) {
          this.advance();
        }
        elements.push(this.parseExpression(PRECEDENCE.LOWEST));
      } while (this.peek().type === TokenType.COMMA);
    }

    this.expect(TokenType.RBRACKET, ']');

    return {
      type: 'ArrayLiteral',
      elements,
    };
  }

  private parseUnaryExpression(): ASTNode {
    const token = this.advance();
    const operator = this.getOperatorSymbol(token.type);
    const operand = this.parseExpression(PRECEDENCE.UNARY);

    return {
      type: 'UnaryOperation',
      operator,
      operand,
    };
  }

  private parseBinaryExpression(left: ASTNode): ASTNode {
    const token = this.advance();
    const operator = this.getOperatorSymbol(token.type);
    const precedence = this.getTokenPrecedence(token.type);

    // Right associativity for power operator
    const nextPrecedence = token.type === TokenType.POWER ? precedence - 1 : precedence;
    const right = this.parseExpression(nextPrecedence);

    return {
      type: 'BinaryOperation',
      operator,
      left,
      right,
    };
  }

  private parseTernaryExpression(condition: ASTNode): ASTNode {
    this.advance(); // consume '?'
    const consequent = this.parseExpression(PRECEDENCE.LOWEST);
    this.expect(TokenType.COLON, ':');
    const alternate = this.parseExpression(PRECEDENCE.TERNARY - 1);

    return {
      type: 'ConditionalExpression',
      condition,
      consequent,
      alternate,
    };
  }

  private parseMemberAccess(object: ASTNode): ASTNode {
    this.advance(); // consume '.'
    const token = this.peek();

    if (token.type !== TokenType.IDENTIFIER && token.type !== TokenType.VARIABLE) {
      throw new UnexpectedTokenError(
        String(token.value),
        ['identifier'],
        token.position
      );
    }

    this.advance();
    const property = String(token.value);

    const node: ASTNode = {
      type: 'MemberAccess',
      object,
      property,
    };

    // Check for chained access
    if (this.peek().type === TokenType.DOT) {
      return this.parseMemberAccess(node);
    }
    if (this.peek().type === TokenType.LBRACKET) {
      return this.parseIndexAccess(node);
    }

    return node;
  }

  private parseIndexAccess(object: ASTNode): ASTNode {
    this.advance(); // consume '['
    const index = this.parseExpression(PRECEDENCE.LOWEST);
    this.expect(TokenType.RBRACKET, ']');

    const node: ASTNode = {
      type: 'IndexAccess',
      object,
      index,
    };

    // Check for chained access
    if (this.peek().type === TokenType.DOT) {
      return this.parseMemberAccess(node);
    }
    if (this.peek().type === TokenType.LBRACKET) {
      return this.parseIndexAccess(node);
    }

    return node;
  }

  private getPrecedence(): number {
    return this.getTokenPrecedence(this.peek().type);
  }

  private getTokenPrecedence(type: TokenType): number {
    switch (type) {
      case TokenType.OR:
        return PRECEDENCE.OR;
      case TokenType.AND:
        return PRECEDENCE.AND;
      case TokenType.EQ:
      case TokenType.NEQ:
        return PRECEDENCE.EQUALITY;
      case TokenType.LT:
      case TokenType.GT:
      case TokenType.LTE:
      case TokenType.GTE:
        return PRECEDENCE.COMPARISON;
      case TokenType.PLUS:
      case TokenType.MINUS:
        return PRECEDENCE.TERM;
      case TokenType.MULTIPLY:
      case TokenType.DIVIDE:
      case TokenType.MODULO:
        return PRECEDENCE.FACTOR;
      case TokenType.POWER:
        return PRECEDENCE.POWER;
      case TokenType.DOT:
      case TokenType.LBRACKET:
        return PRECEDENCE.MEMBER;
      case TokenType.QUESTION:
        return PRECEDENCE.TERNARY;
      default:
        return PRECEDENCE.LOWEST;
    }
  }

  private getOperatorSymbol(type: TokenType): string {
    switch (type) {
      case TokenType.PLUS: return '+';
      case TokenType.MINUS: return '-';
      case TokenType.MULTIPLY: return '*';
      case TokenType.DIVIDE: return '/';
      case TokenType.MODULO: return '%';
      case TokenType.POWER: return '^';
      case TokenType.EQ: return '==';
      case TokenType.NEQ: return '!=';
      case TokenType.LT: return '<';
      case TokenType.GT: return '>';
      case TokenType.LTE: return '<=';
      case TokenType.GTE: return '>=';
      case TokenType.AND: return '&&';
      case TokenType.OR: return '||';
      case TokenType.NOT: return '!';
      default: return '';
    }
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.tokens[this.current - 1];
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private expect(type: TokenType, expected: string): Token {
    if (this.peek().type === type) {
      return this.advance();
    }
    throw new UnexpectedTokenError(
      String(this.peek().value),
      [expected],
      this.peek().position
    );
  }
}

import { Lexer } from './lexer';
import { TokenType } from './types';
import { SyntaxError, UnterminatedStringError } from './errors';

describe('Lexer', () => {
  describe('Numbers', () => {
    it('should tokenize integers', () => {
      const lexer = new Lexer('42');
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('42');
    });

    it('should tokenize decimals', () => {
      const lexer = new Lexer('3.14159');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('3.14159');
    });

    it('should tokenize negative numbers as separate tokens', () => {
      const lexer = new Lexer('-5');
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(3);
      expect(tokens[0].type).toBe(TokenType.MINUS);
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].value).toBe('5');
    });

    it('should tokenize scientific notation as float', () => {
      const lexer = new Lexer('1e6');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe(1000000);
    });

    it('should tokenize float suffix', () => {
      const lexer = new Lexer('3.14f');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(typeof tokens[0].value).toBe('number');
    });
  });

  describe('Strings', () => {
    it('should tokenize double-quoted strings', () => {
      const lexer = new Lexer('"hello world"');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('hello world');
    });

    it('should tokenize single-quoted strings', () => {
      const lexer = new Lexer("'hello'");
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('hello');
    });

    it('should handle escape sequences', () => {
      const lexer = new Lexer('"line1\\nline2"');
      const tokens = lexer.tokenize();

      expect(tokens[0].value).toBe('line1\nline2');
    });

    it('should throw on unterminated strings', () => {
      const lexer = new Lexer('"unterminated');

      expect(() => lexer.tokenize()).toThrow(UnterminatedStringError);
    });
  });

  describe('Booleans and Null', () => {
    it('should tokenize true', () => {
      const lexer = new Lexer('true');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.BOOLEAN);
      expect(tokens[0].value).toBe(true);
    });

    it('should tokenize false', () => {
      const lexer = new Lexer('false');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.BOOLEAN);
      expect(tokens[0].value).toBe(false);
    });

    it('should tokenize null', () => {
      const lexer = new Lexer('null');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.NULL);
      expect(tokens[0].value).toBe(null);
    });
  });

  describe('Variables', () => {
    it('should tokenize $ variables', () => {
      const lexer = new Lexer('$price');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.VARIABLE);
      expect(tokens[0].value).toBe('price');
    });

    it('should tokenize @ context variables', () => {
      const lexer = new Lexer('@userId');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.CONTEXT_VAR);
      expect(tokens[0].value).toBe('userId');
    });

    it('should handle variables with underscores', () => {
      const lexer = new Lexer('$unit_price');
      const tokens = lexer.tokenize();

      expect(tokens[0].value).toBe('unit_price');
    });

    it('should handle variables with numbers', () => {
      const lexer = new Lexer('$var1');
      const tokens = lexer.tokenize();

      expect(tokens[0].value).toBe('var1');
    });
  });

  describe('Operators', () => {
    it('should tokenize arithmetic operators', () => {
      const lexer = new Lexer('+ - * / % ^');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.PLUS);
      expect(tokens[1].type).toBe(TokenType.MINUS);
      expect(tokens[2].type).toBe(TokenType.MULTIPLY);
      expect(tokens[3].type).toBe(TokenType.DIVIDE);
      expect(tokens[4].type).toBe(TokenType.MODULO);
      expect(tokens[5].type).toBe(TokenType.POWER);
    });

    it('should tokenize comparison operators', () => {
      const lexer = new Lexer('== != < > <= >=');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.EQ);
      expect(tokens[1].type).toBe(TokenType.NEQ);
      expect(tokens[2].type).toBe(TokenType.LT);
      expect(tokens[3].type).toBe(TokenType.GT);
      expect(tokens[4].type).toBe(TokenType.LTE);
      expect(tokens[5].type).toBe(TokenType.GTE);
    });

    it('should tokenize logical operators', () => {
      const lexer = new Lexer('&& || !');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.AND);
      expect(tokens[1].type).toBe(TokenType.OR);
      expect(tokens[2].type).toBe(TokenType.NOT);
    });

    it('should tokenize AND/OR/NOT keywords', () => {
      const lexer = new Lexer('AND OR NOT');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.AND);
      expect(tokens[1].type).toBe(TokenType.OR);
      expect(tokens[2].type).toBe(TokenType.NOT);
    });
  });

  describe('Punctuation', () => {
    it('should tokenize parentheses', () => {
      const lexer = new Lexer('()');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.LPAREN);
      expect(tokens[1].type).toBe(TokenType.RPAREN);
    });

    it('should tokenize brackets', () => {
      const lexer = new Lexer('[]');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.LBRACKET);
      expect(tokens[1].type).toBe(TokenType.RBRACKET);
    });

    it('should tokenize comma, dot, question, colon', () => {
      const lexer = new Lexer(', . ? :');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.COMMA);
      expect(tokens[1].type).toBe(TokenType.DOT);
      expect(tokens[2].type).toBe(TokenType.QUESTION);
      expect(tokens[3].type).toBe(TokenType.COLON);
    });
  });

  describe('Complex expressions', () => {
    it('should tokenize a math expression', () => {
      const lexer = new Lexer('$price * $quantity + 10');
      const tokens = lexer.tokenize();

      expect(tokens.map(t => t.type)).toEqual([
        TokenType.VARIABLE,
        TokenType.MULTIPLY,
        TokenType.VARIABLE,
        TokenType.PLUS,
        TokenType.NUMBER,
        TokenType.EOF,
      ]);
    });

    it('should tokenize function calls', () => {
      const lexer = new Lexer('MAX($a, $b)');
      const tokens = lexer.tokenize();

      expect(tokens.map(t => t.type)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.LPAREN,
        TokenType.VARIABLE,
        TokenType.COMMA,
        TokenType.VARIABLE,
        TokenType.RPAREN,
        TokenType.EOF,
      ]);
    });

    it('should tokenize ternary expression', () => {
      const lexer = new Lexer('$a > 0 ? $b : $c');
      const tokens = lexer.tokenize();

      expect(tokens.map(t => t.type)).toEqual([
        TokenType.VARIABLE,
        TokenType.GT,
        TokenType.NUMBER,
        TokenType.QUESTION,
        TokenType.VARIABLE,
        TokenType.COLON,
        TokenType.VARIABLE,
        TokenType.EOF,
      ]);
    });

    it('should handle whitespace correctly', () => {
      const lexer = new Lexer('  $a   +   $b  ');
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(4);
      expect(tokens[0].type).toBe(TokenType.VARIABLE);
      expect(tokens[1].type).toBe(TokenType.PLUS);
      expect(tokens[2].type).toBe(TokenType.VARIABLE);
    });
  });

  describe('Error handling', () => {
    it('should throw on invalid characters', () => {
      const lexer = new Lexer('$a # $b');

      expect(() => lexer.tokenize()).toThrow(SyntaxError);
    });

    it('should throw on lone ampersand', () => {
      const lexer = new Lexer('$a & $b');

      expect(() => lexer.tokenize()).toThrow(SyntaxError);
    });

    it('should throw on lone pipe', () => {
      const lexer = new Lexer('$a | $b');

      expect(() => lexer.tokenize()).toThrow(SyntaxError);
    });
  });
});

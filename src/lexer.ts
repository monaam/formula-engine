import { Token, TokenType } from './types';
import { SyntaxError, UnterminatedStringError, InvalidNumberError } from './errors';

const KEYWORDS: Record<string, TokenType> = {
  'true': TokenType.BOOLEAN,
  'false': TokenType.BOOLEAN,
  'null': TokenType.NULL,
  'AND': TokenType.AND,
  'OR': TokenType.OR,
  'NOT': TokenType.NOT,
};

export class Lexer {
  private input: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    this.tokens = [];
    this.position = 0;
    this.line = 1;
    this.column = 1;

    while (!this.isAtEnd()) {
      this.skipWhitespace();
      if (!this.isAtEnd()) {
        this.scanToken();
      }
    }

    this.tokens.push({
      type: TokenType.EOF,
      value: null,
      position: this.position,
      line: this.line,
      column: this.column,
    });

    return this.tokens;
  }

  private isAtEnd(): boolean {
    return this.position >= this.input.length;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.input[this.position];
  }

  private peekNext(): string {
    if (this.position + 1 >= this.input.length) return '\0';
    return this.input[this.position + 1];
  }

  private advance(): string {
    const char = this.input[this.position++];
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
        this.advance();
      } else {
        break;
      }
    }
  }

  private addToken(type: TokenType, value: string | number | boolean | null): void {
    this.tokens.push({
      type,
      value,
      position: this.position,
      line: this.line,
      column: this.column,
    });
  }

  private scanToken(): void {
    const startPosition = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    const char = this.advance();

    switch (char) {
      case '(':
        this.addToken(TokenType.LPAREN, '(');
        break;
      case ')':
        this.addToken(TokenType.RPAREN, ')');
        break;
      case '[':
        this.addToken(TokenType.LBRACKET, '[');
        break;
      case ']':
        this.addToken(TokenType.RBRACKET, ']');
        break;
      case ',':
        this.addToken(TokenType.COMMA, ',');
        break;
      case '.':
        this.addToken(TokenType.DOT, '.');
        break;
      case '?':
        this.addToken(TokenType.QUESTION, '?');
        break;
      case ':':
        this.addToken(TokenType.COLON, ':');
        break;
      case '+':
        this.addToken(TokenType.PLUS, '+');
        break;
      case '-':
        this.addToken(TokenType.MINUS, '-');
        break;
      case '*':
        this.addToken(TokenType.MULTIPLY, '*');
        break;
      case '/':
        this.addToken(TokenType.DIVIDE, '/');
        break;
      case '%':
        this.addToken(TokenType.MODULO, '%');
        break;
      case '^':
        this.addToken(TokenType.POWER, '^');
        break;
      case '=':
        if (this.peek() === '=') {
          this.advance();
          this.addToken(TokenType.EQ, '==');
        } else {
          throw new SyntaxError(
            `Unexpected character '${char}'`,
            startPosition,
            startLine,
            startColumn,
            this.input
          );
        }
        break;
      case '!':
        if (this.peek() === '=') {
          this.advance();
          this.addToken(TokenType.NEQ, '!=');
        } else {
          this.addToken(TokenType.NOT, '!');
        }
        break;
      case '<':
        if (this.peek() === '=') {
          this.advance();
          this.addToken(TokenType.LTE, '<=');
        } else {
          this.addToken(TokenType.LT, '<');
        }
        break;
      case '>':
        if (this.peek() === '=') {
          this.advance();
          this.addToken(TokenType.GTE, '>=');
        } else {
          this.addToken(TokenType.GT, '>');
        }
        break;
      case '&':
        if (this.peek() === '&') {
          this.advance();
          this.addToken(TokenType.AND, '&&');
        } else {
          throw new SyntaxError(
            `Unexpected character '${char}'`,
            startPosition,
            startLine,
            startColumn,
            this.input
          );
        }
        break;
      case '|':
        if (this.peek() === '|') {
          this.advance();
          this.addToken(TokenType.OR, '||');
        } else {
          throw new SyntaxError(
            `Unexpected character '${char}'`,
            startPosition,
            startLine,
            startColumn,
            this.input
          );
        }
        break;
      case '$':
        this.scanVariable();
        break;
      case '@':
        this.scanContextVariable();
        break;
      case '"':
      case "'":
        this.scanString(char);
        break;
      default:
        if (this.isDigit(char)) {
          this.scanNumber(char);
        } else if (this.isAlpha(char)) {
          this.scanIdentifier(char);
        } else {
          throw new SyntaxError(
            `Unexpected character '${char}'`,
            startPosition,
            startLine,
            startColumn,
            this.input
          );
        }
    }
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') ||
           (char >= 'A' && char <= 'Z') ||
           char === '_';
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  private scanVariable(): void {
    let name = '';
    while (!this.isAtEnd() && this.isAlphaNumeric(this.peek())) {
      name += this.advance();
    }
    if (name === '') {
      throw new SyntaxError(
        'Expected variable name after $',
        this.position,
        this.line,
        this.column,
        this.input
      );
    }
    this.addToken(TokenType.VARIABLE, name);
  }

  private scanContextVariable(): void {
    let name = '';
    while (!this.isAtEnd() && this.isAlphaNumeric(this.peek())) {
      name += this.advance();
    }
    if (name === '') {
      throw new SyntaxError(
        'Expected variable name after @',
        this.position,
        this.line,
        this.column,
        this.input
      );
    }
    this.addToken(TokenType.CONTEXT_VAR, name);
  }

  private scanString(quote: string): void {
    const startPosition = this.position - 1;
    let value = '';

    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance();
        if (!this.isAtEnd()) {
          const escaped = this.advance();
          switch (escaped) {
            case 'n': value += '\n'; break;
            case 't': value += '\t'; break;
            case 'r': value += '\r'; break;
            case '\\': value += '\\'; break;
            case '"': value += '"'; break;
            case "'": value += "'"; break;
            default: value += escaped;
          }
        }
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new UnterminatedStringError(startPosition);
    }

    this.advance(); // Consume closing quote
    this.addToken(TokenType.STRING, value);
  }

  private scanNumber(firstChar: string): void {
    const startPosition = this.position - 1;
    let numStr = firstChar;
    let isFloat = false;

    // Integer part
    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      numStr += this.advance();
    }

    // Decimal part
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      numStr += this.advance(); // consume '.'
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        numStr += this.advance();
      }
    }

    // Exponent part
    if (this.peek() === 'e' || this.peek() === 'E') {
      numStr += this.advance();
      if (this.peek() === '+' || this.peek() === '-') {
        numStr += this.advance();
      }
      if (!this.isDigit(this.peek())) {
        throw new InvalidNumberError(numStr, startPosition);
      }
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        numStr += this.advance();
      }
      isFloat = true; // Scientific notation is treated as float
    }

    // Check for float suffix 'f'
    if (this.peek() === 'f' || this.peek() === 'F') {
      this.advance();
      isFloat = true;
    }

    // Check for decimal suffix 'd'
    if (this.peek() === 'd' || this.peek() === 'D') {
      this.advance();
      isFloat = false;
    }

    if (isFloat) {
      const value = parseFloat(numStr);
      if (isNaN(value)) {
        throw new InvalidNumberError(numStr, startPosition);
      }
      this.addToken(TokenType.NUMBER, value);
    } else {
      // Store as string to preserve precision for Decimal
      this.addToken(TokenType.NUMBER, numStr);
    }
  }

  private scanIdentifier(firstChar: string): void {
    let name = firstChar;

    while (!this.isAtEnd() && this.isAlphaNumeric(this.peek())) {
      name += this.advance();
    }

    // Check if it's a keyword
    const keywordType = KEYWORDS[name] || KEYWORDS[name.toUpperCase()];
    if (keywordType) {
      if (keywordType === TokenType.BOOLEAN) {
        this.addToken(TokenType.BOOLEAN, name.toLowerCase() === 'true');
      } else if (keywordType === TokenType.NULL) {
        this.addToken(TokenType.NULL, null);
      } else {
        this.addToken(keywordType, name.toUpperCase());
      }
    } else {
      this.addToken(TokenType.IDENTIFIER, name);
    }
  }
}

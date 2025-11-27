import Decimal from 'decimal.js';
import { DecimalConfig, DecimalRoundingMode } from './types';
import { InvalidDecimalError, DecimalDivisionByZeroError } from './errors';

// Map our rounding modes to decimal.js rounding modes
const ROUNDING_MODE_MAP: Record<DecimalRoundingMode, Decimal.Rounding> = {
  [DecimalRoundingMode.CEIL]: Decimal.ROUND_CEIL,
  [DecimalRoundingMode.FLOOR]: Decimal.ROUND_FLOOR,
  [DecimalRoundingMode.DOWN]: Decimal.ROUND_DOWN,
  [DecimalRoundingMode.UP]: Decimal.ROUND_UP,
  [DecimalRoundingMode.HALF_UP]: Decimal.ROUND_HALF_UP,
  [DecimalRoundingMode.HALF_DOWN]: Decimal.ROUND_HALF_DOWN,
  [DecimalRoundingMode.HALF_EVEN]: Decimal.ROUND_HALF_EVEN,
  [DecimalRoundingMode.HALF_ODD]: Decimal.ROUND_HALF_CEIL, // decimal.js doesn't have HALF_ODD, use HALF_CEIL as approximation
};

export type DecimalLike = Decimal | string | number | bigint;

export interface DecimalUtilsConfig {
  precision: number;
  roundingMode: DecimalRoundingMode;
  divisionScale: number;
  maxExponent: number;
  minExponent: number;
}

const DEFAULT_CONFIG: DecimalUtilsConfig = {
  precision: 20,
  roundingMode: DecimalRoundingMode.HALF_UP,
  divisionScale: 10,
  maxExponent: 1000,
  minExponent: -1000,
};

export class DecimalUtils {
  private config: DecimalUtilsConfig;

  constructor(config?: Partial<DecimalConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Configure decimal.js globally
    Decimal.set({
      precision: this.config.precision,
      rounding: ROUNDING_MODE_MAP[this.config.roundingMode],
      toExpNeg: this.config.minExponent,
      toExpPos: this.config.maxExponent,
    });
  }

  /**
   * Create a Decimal from various input types
   */
  from(value: DecimalLike): Decimal {
    if (value instanceof Decimal) {
      return value;
    }

    try {
      if (typeof value === 'bigint') {
        return new Decimal(value.toString());
      }
      return new Decimal(value);
    } catch {
      throw new InvalidDecimalError(String(value));
    }
  }

  /**
   * Check if a value is a Decimal
   */
  isDecimal(value: unknown): value is Decimal {
    return value instanceof Decimal;
  }

  /**
   * Convert a value to Decimal if it's numeric
   */
  toDecimal(value: unknown): Decimal | unknown {
    if (value instanceof Decimal) {
      return value;
    }
    if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
      return new Decimal(value);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^-?\d+\.?\d*$/.test(trimmed) || /^-?\d*\.?\d+$/.test(trimmed)) {
        try {
          return new Decimal(trimmed);
        } catch {
          return value;
        }
      }
    }
    if (typeof value === 'bigint') {
      return new Decimal(value.toString());
    }
    return value;
  }

  /**
   * Addition
   */
  add(a: DecimalLike, b: DecimalLike): Decimal {
    return this.from(a).plus(this.from(b));
  }

  /**
   * Subtraction
   */
  subtract(a: DecimalLike, b: DecimalLike): Decimal {
    return this.from(a).minus(this.from(b));
  }

  /**
   * Multiplication
   */
  multiply(a: DecimalLike, b: DecimalLike): Decimal {
    return this.from(a).times(this.from(b));
  }

  /**
   * Division with scale
   */
  divide(a: DecimalLike, b: DecimalLike, scale?: number, roundingMode?: DecimalRoundingMode): Decimal {
    const divisor = this.from(b);
    if (divisor.isZero()) {
      throw new DecimalDivisionByZeroError();
    }

    const result = this.from(a).dividedBy(divisor);

    if (scale !== undefined) {
      const rounding = roundingMode
        ? ROUNDING_MODE_MAP[roundingMode]
        : ROUNDING_MODE_MAP[this.config.roundingMode];
      return result.toDecimalPlaces(scale, rounding);
    }

    return result.toDecimalPlaces(this.config.divisionScale, ROUNDING_MODE_MAP[this.config.roundingMode]);
  }

  /**
   * Modulo
   */
  modulo(a: DecimalLike, b: DecimalLike): Decimal {
    const divisor = this.from(b);
    if (divisor.isZero()) {
      throw new DecimalDivisionByZeroError();
    }
    return this.from(a).modulo(divisor);
  }

  /**
   * Power
   */
  power(base: DecimalLike, exponent: number): Decimal {
    return this.from(base).pow(exponent);
  }

  /**
   * Negation
   */
  negate(value: DecimalLike): Decimal {
    return this.from(value).negated();
  }

  /**
   * Absolute value
   */
  abs(value: DecimalLike): Decimal {
    return this.from(value).absoluteValue();
  }

  /**
   * Round to specified decimal places
   */
  round(value: DecimalLike, scale: number, roundingMode?: DecimalRoundingMode): Decimal {
    const rounding = roundingMode
      ? ROUNDING_MODE_MAP[roundingMode]
      : ROUNDING_MODE_MAP[this.config.roundingMode];
    return this.from(value).toDecimalPlaces(scale, rounding);
  }

  /**
   * Floor to specified decimal places
   */
  floor(value: DecimalLike, scale: number = 0): Decimal {
    return this.from(value).toDecimalPlaces(scale, Decimal.ROUND_FLOOR);
  }

  /**
   * Ceiling to specified decimal places
   */
  ceil(value: DecimalLike, scale: number = 0): Decimal {
    return this.from(value).toDecimalPlaces(scale, Decimal.ROUND_CEIL);
  }

  /**
   * Truncate to specified decimal places
   */
  truncate(value: DecimalLike, scale: number = 0): Decimal {
    return this.from(value).toDecimalPlaces(scale, Decimal.ROUND_DOWN);
  }

  /**
   * Square root
   */
  sqrt(value: DecimalLike): Decimal {
    return this.from(value).sqrt();
  }

  /**
   * Natural logarithm
   */
  ln(value: DecimalLike): Decimal {
    return this.from(value).ln();
  }

  /**
   * Base-10 logarithm
   */
  log10(value: DecimalLike): Decimal {
    return this.from(value).log(10);
  }

  /**
   * Comparison: returns -1, 0, or 1
   */
  compare(a: DecimalLike, b: DecimalLike): -1 | 0 | 1 {
    const result = this.from(a).comparedTo(this.from(b));
    return result as -1 | 0 | 1;
  }

  /**
   * Equality check
   */
  equals(a: DecimalLike, b: DecimalLike): boolean {
    return this.from(a).equals(this.from(b));
  }

  /**
   * Greater than
   */
  greaterThan(a: DecimalLike, b: DecimalLike): boolean {
    return this.from(a).greaterThan(this.from(b));
  }

  /**
   * Greater than or equal
   */
  greaterThanOrEqual(a: DecimalLike, b: DecimalLike): boolean {
    return this.from(a).greaterThanOrEqualTo(this.from(b));
  }

  /**
   * Less than
   */
  lessThan(a: DecimalLike, b: DecimalLike): boolean {
    return this.from(a).lessThan(this.from(b));
  }

  /**
   * Less than or equal
   */
  lessThanOrEqual(a: DecimalLike, b: DecimalLike): boolean {
    return this.from(a).lessThanOrEqualTo(this.from(b));
  }

  /**
   * Check if zero
   */
  isZero(value: DecimalLike): boolean {
    return this.from(value).isZero();
  }

  /**
   * Check if positive
   */
  isPositive(value: DecimalLike): boolean {
    return this.from(value).isPositive();
  }

  /**
   * Check if negative
   */
  isNegative(value: DecimalLike): boolean {
    return this.from(value).isNegative();
  }

  /**
   * Check if integer
   */
  isInteger(value: DecimalLike): boolean {
    return this.from(value).isInteger();
  }

  /**
   * Get sign: -1, 0, or 1
   */
  sign(value: DecimalLike): -1 | 0 | 1 {
    const d = this.from(value);
    if (d.isZero()) return 0;
    return d.isNegative() ? -1 : 1;
  }

  /**
   * Get precision (total significant digits)
   */
  precision(value: DecimalLike): number {
    return this.from(value).precision();
  }

  /**
   * Get scale (decimal places)
   */
  scale(value: DecimalLike): number {
    return this.from(value).decimalPlaces();
  }

  /**
   * Convert to JavaScript number (may lose precision)
   */
  toNumber(value: DecimalLike): number {
    return this.from(value).toNumber();
  }

  /**
   * Convert to string
   */
  toString(value: DecimalLike): string {
    return this.from(value).toString();
  }

  /**
   * Convert to fixed decimal places string
   */
  toFixed(value: DecimalLike, scale: number): string {
    return this.from(value).toFixed(scale);
  }

  /**
   * Minimum of values
   */
  min(...values: DecimalLike[]): Decimal {
    if (values.length === 0) {
      throw new Error('min requires at least one argument');
    }
    return Decimal.min(...values.map(v => this.from(v)));
  }

  /**
   * Maximum of values
   */
  max(...values: DecimalLike[]): Decimal {
    if (values.length === 0) {
      throw new Error('max requires at least one argument');
    }
    return Decimal.max(...values.map(v => this.from(v)));
  }

  /**
   * Sum of values
   */
  sum(values: DecimalLike[]): Decimal {
    return values.reduce<Decimal>((acc, v) => acc.plus(this.from(v)), new Decimal(0));
  }

  /**
   * Average of values
   */
  avg(values: DecimalLike[]): Decimal {
    if (values.length === 0) {
      throw new Error('avg requires at least one value');
    }
    return this.sum(values).dividedBy(values.length);
  }

  /**
   * Product of values
   */
  product(values: DecimalLike[]): Decimal {
    return values.reduce<Decimal>((acc, v) => acc.times(this.from(v)), new Decimal(1));
  }

  /**
   * Create zero
   */
  zero(): Decimal {
    return new Decimal(0);
  }

  /**
   * Create one
   */
  one(): Decimal {
    return new Decimal(1);
  }
}

// Export a default instance
export const decimalUtils = new DecimalUtils();

// Re-export Decimal type for convenience
export { Decimal };

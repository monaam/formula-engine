import { FunctionDefinition, EvaluationContext } from './types';
import { DecimalUtils, Decimal } from './decimal-utils';
import { ArgumentCountError, TypeMismatchError } from './errors';

type FnImpl = FunctionDefinition['implementation'];

// Helper to check if value is numeric (Decimal or number)
function isNumeric(value: unknown): value is Decimal | number {
  return value instanceof Decimal || typeof value === 'number';
}

// Helper to convert to Decimal
function toDecimal(value: unknown, utils: DecimalUtils): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === 'number') return utils.from(value);
  if (typeof value === 'string') return utils.from(value);
  throw new TypeMismatchError('number', typeof value, 'numeric conversion');
}

// Helper to convert value to number (for functions that return native numbers)
function toNumber(value: unknown): number {
  if (value instanceof Decimal) return value.toNumber();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  throw new TypeMismatchError('number', typeof value, 'numeric conversion');
}

export function createBuiltInFunctions(decimalUtils: DecimalUtils): Map<string, FunctionDefinition> {
  const functions = new Map<string, FunctionDefinition>();

  // ============================================================================
  // Math Functions
  // ============================================================================

  const ABS: FunctionDefinition = {
    name: 'ABS',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'decimal',
    description: 'Absolute value',
    implementation: (args) => {
      return decimalUtils.abs(toDecimal(args[0], decimalUtils));
    },
  };

  const ROUND: FunctionDefinition = {
    name: 'ROUND',
    minArgs: 1,
    maxArgs: 3,
    returnType: 'decimal',
    description: 'Round to precision',
    implementation: (args) => {
      const value = toDecimal(args[0], decimalUtils);
      const precision = args.length > 1 ? toNumber(args[1]) : 0;
      const mode = args.length > 2 ? String(args[2]) : undefined;
      return decimalUtils.round(value, precision, mode as any);
    },
  };

  const FLOOR: FunctionDefinition = {
    name: 'FLOOR',
    minArgs: 1,
    maxArgs: 2,
    returnType: 'decimal',
    description: 'Round down',
    implementation: (args) => {
      const value = toDecimal(args[0], decimalUtils);
      const scale = args.length > 1 ? toNumber(args[1]) : 0;
      return decimalUtils.floor(value, scale);
    },
  };

  const CEIL: FunctionDefinition = {
    name: 'CEIL',
    minArgs: 1,
    maxArgs: 2,
    returnType: 'decimal',
    description: 'Round up',
    implementation: (args) => {
      const value = toDecimal(args[0], decimalUtils);
      const scale = args.length > 1 ? toNumber(args[1]) : 0;
      return decimalUtils.ceil(value, scale);
    },
  };

  const TRUNCATE: FunctionDefinition = {
    name: 'TRUNCATE',
    minArgs: 1,
    maxArgs: 2,
    returnType: 'decimal',
    description: 'Truncate to precision',
    implementation: (args) => {
      const value = toDecimal(args[0], decimalUtils);
      const scale = args.length > 1 ? toNumber(args[1]) : 0;
      return decimalUtils.truncate(value, scale);
    },
  };

  const MIN: FunctionDefinition = {
    name: 'MIN',
    minArgs: 1,
    maxArgs: -1,
    returnType: 'decimal',
    description: 'Minimum value',
    implementation: (args) => {
      if (args.length === 1 && Array.isArray(args[0])) {
        return decimalUtils.min(...args[0].map(v => toDecimal(v, decimalUtils)));
      }
      return decimalUtils.min(...args.map(v => toDecimal(v, decimalUtils)));
    },
  };

  const MAX: FunctionDefinition = {
    name: 'MAX',
    minArgs: 1,
    maxArgs: -1,
    returnType: 'decimal',
    description: 'Maximum value',
    implementation: (args) => {
      if (args.length === 1 && Array.isArray(args[0])) {
        return decimalUtils.max(...args[0].map(v => toDecimal(v, decimalUtils)));
      }
      return decimalUtils.max(...args.map(v => toDecimal(v, decimalUtils)));
    },
  };

  const POW: FunctionDefinition = {
    name: 'POW',
    minArgs: 2,
    maxArgs: 2,
    returnType: 'decimal',
    description: 'Power',
    implementation: (args) => {
      const base = toDecimal(args[0], decimalUtils);
      const exp = toNumber(args[1]);
      return decimalUtils.power(base, exp);
    },
  };

  const SQRT: FunctionDefinition = {
    name: 'SQRT',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'decimal',
    description: 'Square root',
    implementation: (args) => {
      return decimalUtils.sqrt(toDecimal(args[0], decimalUtils));
    },
  };

  const LOG: FunctionDefinition = {
    name: 'LOG',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'decimal',
    description: 'Natural logarithm',
    implementation: (args) => {
      return decimalUtils.ln(toDecimal(args[0], decimalUtils));
    },
  };

  const LOG10: FunctionDefinition = {
    name: 'LOG10',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'decimal',
    description: 'Base-10 logarithm',
    implementation: (args) => {
      return decimalUtils.log10(toDecimal(args[0], decimalUtils));
    },
  };

  const SIGN: FunctionDefinition = {
    name: 'SIGN',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'number',
    description: 'Sign of number (-1, 0, or 1)',
    implementation: (args) => {
      return decimalUtils.sign(toDecimal(args[0], decimalUtils));
    },
  };

  const DECIMAL: FunctionDefinition = {
    name: 'DECIMAL',
    minArgs: 1,
    maxArgs: 2,
    returnType: 'decimal',
    description: 'Convert to Decimal',
    implementation: (args) => {
      const value = toDecimal(args[0], decimalUtils);
      if (args.length > 1) {
        const scale = toNumber(args[1]);
        return decimalUtils.round(value, scale);
      }
      return value;
    },
  };

  const SCALE: FunctionDefinition = {
    name: 'SCALE',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'number',
    description: 'Get scale (decimal places)',
    implementation: (args) => {
      return decimalUtils.scale(toDecimal(args[0], decimalUtils));
    },
  };

  const PRECISION: FunctionDefinition = {
    name: 'PRECISION',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'number',
    description: 'Get precision (significant digits)',
    implementation: (args) => {
      return decimalUtils.precision(toDecimal(args[0], decimalUtils));
    },
  };

  const DIVIDE: FunctionDefinition = {
    name: 'DIVIDE',
    minArgs: 2,
    maxArgs: 4,
    returnType: 'decimal',
    description: 'Division with scale and rounding',
    implementation: (args) => {
      const a = toDecimal(args[0], decimalUtils);
      const b = toDecimal(args[1], decimalUtils);
      const scale = args.length > 2 ? toNumber(args[2]) : undefined;
      const mode = args.length > 3 ? String(args[3]) : undefined;
      return decimalUtils.divide(a, b, scale, mode as any);
    },
  };

  // ============================================================================
  // Aggregation Functions
  // ============================================================================

  const SUM: FunctionDefinition = {
    name: 'SUM',
    minArgs: 1,
    maxArgs: 2,
    returnType: 'decimal',
    description: 'Sum of array values',
    implementation: (args, context, engine) => {
      const arr = args[0];
      if (!Array.isArray(arr)) {
        throw new TypeMismatchError('array', typeof arr, 'SUM');
      }

      if (args.length === 1) {
        // Simple sum
        return decimalUtils.sum(arr.map(v => toDecimal(v, decimalUtils)));
      }

      // Sum with expression - args[1] should be evaluated for each item
      // This is handled specially by the evaluator
      throw new Error('SUM with expression must be handled by evaluator');
    },
  };

  const AVG: FunctionDefinition = {
    name: 'AVG',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'decimal',
    description: 'Average of array values',
    implementation: (args) => {
      const arr = args[0];
      if (!Array.isArray(arr)) {
        throw new TypeMismatchError('array', typeof arr, 'AVG');
      }
      return decimalUtils.avg(arr.map(v => toDecimal(v, decimalUtils)));
    },
  };

  const COUNT: FunctionDefinition = {
    name: 'COUNT',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'number',
    description: 'Count of array elements',
    implementation: (args) => {
      const arr = args[0];
      if (!Array.isArray(arr)) {
        throw new TypeMismatchError('array', typeof arr, 'COUNT');
      }
      return arr.length;
    },
  };

  const PRODUCT: FunctionDefinition = {
    name: 'PRODUCT',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'decimal',
    description: 'Product of array values',
    implementation: (args) => {
      const arr = args[0];
      if (!Array.isArray(arr)) {
        throw new TypeMismatchError('array', typeof arr, 'PRODUCT');
      }
      return decimalUtils.product(arr.map(v => toDecimal(v, decimalUtils)));
    },
  };

  const FILTER: FunctionDefinition = {
    name: 'FILTER',
    minArgs: 2,
    maxArgs: 2,
    returnType: 'array',
    description: 'Filter array by condition',
    implementation: () => {
      // This must be handled by the evaluator to evaluate the condition expression
      throw new Error('FILTER must be handled by evaluator');
    },
  };

  const MAP: FunctionDefinition = {
    name: 'MAP',
    minArgs: 2,
    maxArgs: 2,
    returnType: 'array',
    description: 'Transform array elements',
    implementation: () => {
      // This must be handled by the evaluator to evaluate the transform expression
      throw new Error('MAP must be handled by evaluator');
    },
  };

  // ============================================================================
  // String Functions
  // ============================================================================

  const LEN: FunctionDefinition = {
    name: 'LEN',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'number',
    description: 'String length',
    implementation: (args) => {
      const str = String(args[0]);
      return str.length;
    },
  };

  const UPPER: FunctionDefinition = {
    name: 'UPPER',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'string',
    description: 'Uppercase string',
    implementation: (args) => {
      return String(args[0]).toUpperCase();
    },
  };

  const LOWER: FunctionDefinition = {
    name: 'LOWER',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'string',
    description: 'Lowercase string',
    implementation: (args) => {
      return String(args[0]).toLowerCase();
    },
  };

  const TRIM: FunctionDefinition = {
    name: 'TRIM',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'string',
    description: 'Trim whitespace',
    implementation: (args) => {
      return String(args[0]).trim();
    },
  };

  const CONCAT: FunctionDefinition = {
    name: 'CONCAT',
    minArgs: 1,
    maxArgs: -1,
    returnType: 'string',
    description: 'Concatenate strings',
    implementation: (args) => {
      return args.map(a => String(a)).join('');
    },
  };

  const SUBSTR: FunctionDefinition = {
    name: 'SUBSTR',
    minArgs: 2,
    maxArgs: 3,
    returnType: 'string',
    description: 'Substring',
    implementation: (args) => {
      const str = String(args[0]);
      const start = toNumber(args[1]);
      const len = args.length > 2 ? toNumber(args[2]) : undefined;
      return len !== undefined ? str.substr(start, len) : str.substr(start);
    },
  };

  const REPLACE: FunctionDefinition = {
    name: 'REPLACE',
    minArgs: 3,
    maxArgs: 3,
    returnType: 'string',
    description: 'Replace substring',
    implementation: (args) => {
      const str = String(args[0]);
      const search = String(args[1]);
      const replacement = String(args[2]);
      return str.split(search).join(replacement);
    },
  };

  const CONTAINS: FunctionDefinition = {
    name: 'CONTAINS',
    minArgs: 2,
    maxArgs: 2,
    returnType: 'boolean',
    description: 'Check if string contains substring',
    implementation: (args) => {
      const str = String(args[0]);
      const search = String(args[1]);
      return str.includes(search);
    },
  };

  const STARTSWITH: FunctionDefinition = {
    name: 'STARTSWITH',
    minArgs: 2,
    maxArgs: 2,
    returnType: 'boolean',
    description: 'Check if string starts with prefix',
    implementation: (args) => {
      return String(args[0]).startsWith(String(args[1]));
    },
  };

  const ENDSWITH: FunctionDefinition = {
    name: 'ENDSWITH',
    minArgs: 2,
    maxArgs: 2,
    returnType: 'boolean',
    description: 'Check if string ends with suffix',
    implementation: (args) => {
      return String(args[0]).endsWith(String(args[1]));
    },
  };

  // ============================================================================
  // Logical Functions
  // ============================================================================

  const IF: FunctionDefinition = {
    name: 'IF',
    minArgs: 3,
    maxArgs: 3,
    returnType: 'any',
    description: 'Conditional expression',
    implementation: (args) => {
      const condition = args[0];
      return condition ? args[1] : args[2];
    },
  };

  const COALESCE: FunctionDefinition = {
    name: 'COALESCE',
    minArgs: 1,
    maxArgs: -1,
    returnType: 'any',
    description: 'First non-null value',
    implementation: (args) => {
      for (const arg of args) {
        if (arg !== null && arg !== undefined) {
          return arg;
        }
      }
      return null;
    },
  };

  const ISNULL: FunctionDefinition = {
    name: 'ISNULL',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'boolean',
    description: 'Check if null',
    implementation: (args) => {
      return args[0] === null || args[0] === undefined;
    },
  };

  const ISEMPTY: FunctionDefinition = {
    name: 'ISEMPTY',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'boolean',
    description: 'Check if empty',
    implementation: (args) => {
      const val = args[0];
      if (val === null || val === undefined) return true;
      if (typeof val === 'string') return val.length === 0;
      if (Array.isArray(val)) return val.length === 0;
      if (typeof val === 'object') return Object.keys(val).length === 0;
      return false;
    },
  };

  const DEFAULT: FunctionDefinition = {
    name: 'DEFAULT',
    minArgs: 2,
    maxArgs: 2,
    returnType: 'any',
    description: 'Default value if null',
    implementation: (args) => {
      return args[0] !== null && args[0] !== undefined ? args[0] : args[1];
    },
  };

  const AND: FunctionDefinition = {
    name: 'AND',
    minArgs: 2,
    maxArgs: -1,
    returnType: 'boolean',
    description: 'Logical AND of all arguments',
    implementation: (args) => {
      return args.every(a => Boolean(a));
    },
  };

  const OR: FunctionDefinition = {
    name: 'OR',
    minArgs: 2,
    maxArgs: -1,
    returnType: 'boolean',
    description: 'Logical OR of all arguments',
    implementation: (args) => {
      return args.some(a => Boolean(a));
    },
  };

  const NOT: FunctionDefinition = {
    name: 'NOT',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'boolean',
    description: 'Logical NOT',
    implementation: (args) => {
      return !Boolean(args[0]);
    },
  };

  // ============================================================================
  // Type Functions
  // ============================================================================

  const NUMBER: FunctionDefinition = {
    name: 'NUMBER',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'decimal',
    description: 'Convert to number',
    implementation: (args) => {
      return toDecimal(args[0], decimalUtils);
    },
  };

  const STRING: FunctionDefinition = {
    name: 'STRING',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'string',
    description: 'Convert to string',
    implementation: (args) => {
      const val = args[0];
      if (val instanceof Decimal) {
        return val.toString();
      }
      return String(val);
    },
  };

  const BOOLEAN: FunctionDefinition = {
    name: 'BOOLEAN',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'boolean',
    description: 'Convert to boolean',
    implementation: (args) => {
      const val = args[0];
      if (typeof val === 'string') {
        return val.toLowerCase() === 'true' || val === '1';
      }
      if (val instanceof Decimal) {
        return !val.isZero();
      }
      return Boolean(val);
    },
  };

  const TYPEOF: FunctionDefinition = {
    name: 'TYPEOF',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'string',
    description: 'Get type name',
    implementation: (args) => {
      const val = args[0];
      if (val === null) return 'null';
      if (val instanceof Decimal) return 'decimal';
      if (Array.isArray(val)) return 'array';
      return typeof val;
    },
  };

  // ============================================================================
  // Array Functions
  // ============================================================================

  const FIRST: FunctionDefinition = {
    name: 'FIRST',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'any',
    description: 'First element of array',
    implementation: (args) => {
      const arr = args[0];
      if (!Array.isArray(arr)) {
        throw new TypeMismatchError('array', typeof arr, 'FIRST');
      }
      return arr.length > 0 ? arr[0] : null;
    },
  };

  const LAST: FunctionDefinition = {
    name: 'LAST',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'any',
    description: 'Last element of array',
    implementation: (args) => {
      const arr = args[0];
      if (!Array.isArray(arr)) {
        throw new TypeMismatchError('array', typeof arr, 'LAST');
      }
      return arr.length > 0 ? arr[arr.length - 1] : null;
    },
  };

  const REVERSE: FunctionDefinition = {
    name: 'REVERSE',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'array',
    description: 'Reverse array',
    implementation: (args) => {
      const arr = args[0];
      if (!Array.isArray(arr)) {
        throw new TypeMismatchError('array', typeof arr, 'REVERSE');
      }
      return [...arr].reverse();
    },
  };

  const SLICE: FunctionDefinition = {
    name: 'SLICE',
    minArgs: 2,
    maxArgs: 3,
    returnType: 'array',
    description: 'Slice array',
    implementation: (args) => {
      const arr = args[0];
      if (!Array.isArray(arr)) {
        throw new TypeMismatchError('array', typeof arr, 'SLICE');
      }
      const start = toNumber(args[1]);
      const end = args.length > 2 ? toNumber(args[2]) : undefined;
      return arr.slice(start, end);
    },
  };

  const INCLUDES: FunctionDefinition = {
    name: 'INCLUDES',
    minArgs: 2,
    maxArgs: 2,
    returnType: 'boolean',
    description: 'Check if array includes value',
    implementation: (args) => {
      const arr = args[0];
      if (!Array.isArray(arr)) {
        throw new TypeMismatchError('array', typeof arr, 'INCLUDES');
      }
      const value = args[1];
      return arr.some(item => {
        if (item instanceof Decimal && value instanceof Decimal) {
          return item.equals(value);
        }
        return item === value;
      });
    },
  };

  const INDEXOF: FunctionDefinition = {
    name: 'INDEXOF',
    minArgs: 2,
    maxArgs: 2,
    returnType: 'number',
    description: 'Find index of value in array',
    implementation: (args) => {
      const arr = args[0];
      if (!Array.isArray(arr)) {
        throw new TypeMismatchError('array', typeof arr, 'INDEXOF');
      }
      const value = args[1];
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (item instanceof Decimal && value instanceof Decimal) {
          if (item.equals(value)) return i;
        } else if (item === value) {
          return i;
        }
      }
      return -1;
    },
  };

  const FLATTEN: FunctionDefinition = {
    name: 'FLATTEN',
    minArgs: 1,
    maxArgs: 2,
    returnType: 'array',
    description: 'Flatten nested array',
    implementation: (args) => {
      const arr = args[0];
      if (!Array.isArray(arr)) {
        throw new TypeMismatchError('array', typeof arr, 'FLATTEN');
      }
      const depth = args.length > 1 ? toNumber(args[1]) : 1;
      return arr.flat(depth);
    },
  };

  // ============================================================================
  // Table/Lookup Functions
  // ============================================================================

  const LOOKUP: FunctionDefinition = {
    name: 'LOOKUP',
    minArgs: 3,
    maxArgs: 3,
    returnType: 'any',
    description: 'Multi-criteria exact-match lookup on array of objects',
    implementation: (args) => {
      const table = args[0];
      const criteria = args[1];
      const returnField = args[2];

      if (table === null || table === undefined) {
        return 0;
      }

      if (!Array.isArray(table)) {
        throw new TypeMismatchError('array', typeof table, 'LOOKUP');
      }

      if (typeof criteria !== 'object' || criteria === null || Array.isArray(criteria)) {
        throw new TypeMismatchError('object', typeof criteria, 'LOOKUP criteria');
      }

      if (typeof returnField !== 'string') {
        throw new TypeMismatchError('string', typeof returnField, 'LOOKUP returnField');
      }

      const criteriaObj = criteria as Record<string, unknown>;

      for (const row of table) {
        if (typeof row !== 'object' || row === null) continue;
        const rowObj = row as Record<string, unknown>;

        let match = true;
        for (const [key, value] of Object.entries(criteriaObj)) {
          const rowVal = rowObj[key];
          if (rowVal instanceof Decimal && value instanceof Decimal) {
            if (!rowVal.equals(value)) {
              match = false;
              break;
            }
          } else if (rowVal instanceof Decimal) {
            if (typeof value === 'number' && rowVal.toNumber() === value) continue;
            if (typeof value === 'string' && rowVal.toString() === value) continue;
            match = false;
            break;
          } else if (value instanceof Decimal) {
            if (typeof rowVal === 'number' && value.toNumber() === rowVal) continue;
            if (typeof rowVal === 'string' && value.toString() === rowVal) continue;
            match = false;
            break;
          } else if (rowVal !== value) {
            match = false;
            break;
          }
        }

        if (match) {
          const result = rowObj[returnField];
          return result !== undefined ? result : 0;
        }
      }

      return 0;
    },
  };

  const RANGE: FunctionDefinition = {
    name: 'RANGE',
    minArgs: 5,
    maxArgs: 5,
    returnType: 'any',
    description: 'Numeric band/tier resolution: min <= inputValue < max',
    implementation: (args) => {
      const table = args[0];
      const inputValue = args[1];
      const minField = args[2];
      const maxField = args[3];
      const returnField = args[4];

      if (table === null || table === undefined) {
        return 0;
      }

      if (!Array.isArray(table)) {
        throw new TypeMismatchError('array', typeof table, 'RANGE');
      }

      if (typeof minField !== 'string') {
        throw new TypeMismatchError('string', typeof minField, 'RANGE minField');
      }
      if (typeof maxField !== 'string') {
        throw new TypeMismatchError('string', typeof maxField, 'RANGE maxField');
      }
      if (typeof returnField !== 'string') {
        throw new TypeMismatchError('string', typeof returnField, 'RANGE returnField');
      }

      let inputNum: number;
      if (inputValue instanceof Decimal) {
        inputNum = inputValue.toNumber();
      } else if (typeof inputValue === 'number') {
        inputNum = inputValue;
      } else {
        throw new TypeMismatchError('number', typeof inputValue, 'RANGE inputValue');
      }

      for (const row of table) {
        if (typeof row !== 'object' || row === null) continue;
        const rowObj = row as Record<string, unknown>;

        const minVal = rowObj[minField];
        const maxVal = rowObj[maxField];

        let minNum: number;
        if (minVal instanceof Decimal) {
          minNum = minVal.toNumber();
        } else if (typeof minVal === 'number') {
          minNum = minVal;
        } else {
          continue;
        }

        if (inputNum < minNum) continue;

        if (maxVal !== null && maxVal !== undefined) {
          let maxNum: number;
          if (maxVal instanceof Decimal) {
            maxNum = maxVal.toNumber();
          } else if (typeof maxVal === 'number') {
            maxNum = maxVal;
          } else {
            continue;
          }
          if (inputNum >= maxNum) continue;
        }

        const result = rowObj[returnField];
        return result !== undefined ? result : 0;
      }

      return 0;
    },
  };

  // Register all functions
  const allFunctions = [
    // Math
    ABS, ROUND, FLOOR, CEIL, TRUNCATE, MIN, MAX, POW, SQRT, LOG, LOG10, SIGN, DECIMAL, SCALE, PRECISION, DIVIDE,
    // Aggregation
    SUM, AVG, COUNT, PRODUCT, FILTER, MAP,
    // String
    LEN, UPPER, LOWER, TRIM, CONCAT, SUBSTR, REPLACE, CONTAINS, STARTSWITH, ENDSWITH,
    // Logical
    IF, COALESCE, ISNULL, ISEMPTY, DEFAULT, AND, OR, NOT,
    // Type
    NUMBER, STRING, BOOLEAN, TYPEOF,
    // Array
    FIRST, LAST, REVERSE, SLICE, INCLUDES, INDEXOF, FLATTEN,
    // Table/Lookup
    LOOKUP, RANGE,
  ];

  for (const fn of allFunctions) {
    functions.set(fn.name, fn);
  }

  return functions;
}

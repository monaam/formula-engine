import { Validator, ValidationBuilder, validate, ValidationRuleType } from './validator';
import { FormulaEngine } from './formula-engine';

describe('Validator', () => {
  let validator: Validator;

  beforeEach(() => {
    validator = new Validator();
  });

  describe('REQUIRED validation', () => {
    it('should fail when field is null', () => {
      validator.addRule({
        type: ValidationRuleType.REQUIRED,
        field: 'name',
      });

      const result = validator.validate({ name: null });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('name');
      expect(result.errors[0].rule).toBe(ValidationRuleType.REQUIRED);
    });

    it('should fail when field is undefined', () => {
      validator.addRule({
        type: ValidationRuleType.REQUIRED,
        field: 'name',
      });

      const result = validator.validate({});

      expect(result.valid).toBe(false);
    });

    it('should fail when field is empty string', () => {
      validator.addRule({
        type: ValidationRuleType.REQUIRED,
        field: 'name',
      });

      const result = validator.validate({ name: '' });

      expect(result.valid).toBe(false);
    });

    it('should pass when field is empty string with allowEmpty', () => {
      validator.addRule({
        type: ValidationRuleType.REQUIRED,
        field: 'name',
        allowEmpty: true,
      });

      const result = validator.validate({ name: '' });

      expect(result.valid).toBe(true);
    });

    it('should pass when field has value', () => {
      validator.addRule({
        type: ValidationRuleType.REQUIRED,
        field: 'name',
      });

      const result = validator.validate({ name: 'John' });

      expect(result.valid).toBe(true);
    });

    it('should fail when zero is not allowed', () => {
      validator.addRule({
        type: ValidationRuleType.REQUIRED,
        field: 'quantity',
        allowZero: false,
      });

      const result = validator.validate({ quantity: 0 });

      expect(result.valid).toBe(false);
    });

    it('should pass when zero is allowed (default)', () => {
      validator.addRule({
        type: ValidationRuleType.REQUIRED,
        field: 'quantity',
      });

      const result = validator.validate({ quantity: 0 });

      expect(result.valid).toBe(true);
    });
  });

  describe('RANGE validation', () => {
    it('should fail when value is below min', () => {
      validator.addRule({
        type: ValidationRuleType.RANGE,
        field: 'age',
        min: 18,
      });

      const result = validator.validate({ age: 16 });

      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe(ValidationRuleType.RANGE);
    });

    it('should fail when value is above max', () => {
      validator.addRule({
        type: ValidationRuleType.RANGE,
        field: 'age',
        max: 100,
      });

      const result = validator.validate({ age: 150 });

      expect(result.valid).toBe(false);
    });

    it('should pass when value is in range', () => {
      validator.addRule({
        type: ValidationRuleType.RANGE,
        field: 'age',
        min: 18,
        max: 100,
      });

      const result = validator.validate({ age: 25 });

      expect(result.valid).toBe(true);
    });

    it('should handle exclusive range', () => {
      validator.addRule({
        type: ValidationRuleType.RANGE,
        field: 'value',
        min: 0,
        max: 10,
        exclusive: true,
      });

      expect(validator.validate({ value: 0 }).valid).toBe(false);
      expect(validator.validate({ value: 10 }).valid).toBe(false);
      expect(validator.validate({ value: 5 }).valid).toBe(true);
    });

    it('should handle expression-based min/max', () => {
      validator.addRule({
        type: ValidationRuleType.RANGE,
        field: 'endDate',
        min: '$startDate',
      });

      const result = validator.validate({ startDate: 10, endDate: 5 });

      expect(result.valid).toBe(false);
    });

    it('should skip validation for null values', () => {
      validator.addRule({
        type: ValidationRuleType.RANGE,
        field: 'age',
        min: 18,
      });

      const result = validator.validate({ age: null });

      expect(result.valid).toBe(true); // REQUIRED should handle null
    });
  });

  describe('PATTERN validation', () => {
    it('should fail when value does not match pattern', () => {
      validator.addRule({
        type: ValidationRuleType.PATTERN,
        field: 'zipCode',
        pattern: '^\\d{5}$',
      });

      const result = validator.validate({ zipCode: 'abc' });

      expect(result.valid).toBe(false);
    });

    it('should pass when value matches pattern', () => {
      validator.addRule({
        type: ValidationRuleType.PATTERN,
        field: 'zipCode',
        pattern: '^\\d{5}$',
      });

      const result = validator.validate({ zipCode: '12345' });

      expect(result.valid).toBe(true);
    });

    it('should support regex flags', () => {
      validator.addRule({
        type: ValidationRuleType.PATTERN,
        field: 'code',
        pattern: '^abc$',
        flags: 'i',
      });

      const result = validator.validate({ code: 'ABC' });

      expect(result.valid).toBe(true);
    });

    it('should validate email format', () => {
      validator.addRule({
        type: ValidationRuleType.PATTERN,
        field: 'email',
        pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
      });

      expect(validator.validate({ email: 'test@example.com' }).valid).toBe(true);
      expect(validator.validate({ email: 'invalid-email' }).valid).toBe(false);
    });
  });

  describe('CUSTOM validation', () => {
    it('should use formula expression for validation', () => {
      validator.addRule({
        type: ValidationRuleType.CUSTOM,
        field: 'quantity',
        expression: '$quantity > 0 && $quantity <= 100',
      });

      expect(validator.validate({ quantity: 50 }).valid).toBe(true);
      expect(validator.validate({ quantity: -5 }).valid).toBe(false);
      expect(validator.validate({ quantity: 150 }).valid).toBe(false);
    });

    it('should support complex expressions', () => {
      validator.addRule({
        type: ValidationRuleType.CUSTOM,
        field: 'discount',
        expression: '$discount >= 0 && $discount <= $maxDiscount',
      });

      expect(validator.validate({ discount: 10, maxDiscount: 20 }).valid).toBe(true);
      expect(validator.validate({ discount: 30, maxDiscount: 20 }).valid).toBe(false);
    });

    it('should support function calls', () => {
      validator.addRule({
        type: ValidationRuleType.CUSTOM,
        field: 'name',
        expression: 'LEN($name) >= 3 && LEN($name) <= 50',
      });

      expect(validator.validate({ name: 'Jo' }).valid).toBe(false);
      expect(validator.validate({ name: 'John' }).valid).toBe(true);
    });
  });

  describe('CROSS_FIELD validation', () => {
    it('should validate across multiple fields', () => {
      validator.addRule({
        type: ValidationRuleType.CROSS_FIELD,
        field: 'confirmPassword',
        expression: '$password == $confirmPassword',
        dependsOn: ['password', 'confirmPassword'],
        message: 'Passwords must match',
      });

      expect(validator.validate({
        password: 'secret',
        confirmPassword: 'secret'
      }).valid).toBe(true);

      const result = validator.validate({
        password: 'secret',
        confirmPassword: 'different'
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe('Passwords must match');
    });

    it('should validate date ranges', () => {
      validator.addRule({
        type: ValidationRuleType.CROSS_FIELD,
        field: 'endDate',
        expression: '$endDate > $startDate',
        dependsOn: ['startDate', 'endDate'],
        message: 'End date must be after start date',
      });

      expect(validator.validate({ startDate: 1, endDate: 10 }).valid).toBe(true);
      expect(validator.validate({ startDate: 10, endDate: 5 }).valid).toBe(false);
    });

    it('should skip if dependencies are missing', () => {
      validator.addRule({
        type: ValidationRuleType.CROSS_FIELD,
        field: 'endDate',
        expression: '$endDate > $startDate',
        dependsOn: ['startDate', 'endDate'],
      });

      const result = validator.validate({ endDate: 10 }); // missing startDate

      expect(result.valid).toBe(true); // Skipped
    });
  });

  describe('Conditional validation (when)', () => {
    it('should skip rule when condition is false', () => {
      validator.addRule({
        type: ValidationRuleType.REQUIRED,
        field: 'businessName',
        when: '$accountType == "business"',
      });

      const result = validator.validate({
        accountType: 'personal',
        businessName: null
      });

      expect(result.valid).toBe(true);
    });

    it('should apply rule when condition is true', () => {
      validator.addRule({
        type: ValidationRuleType.REQUIRED,
        field: 'businessName',
        when: '$accountType == "business"',
      });

      const result = validator.validate({
        accountType: 'business',
        businessName: null
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('Nested field validation', () => {
    it('should validate nested fields', () => {
      validator.addRule({
        type: ValidationRuleType.REQUIRED,
        field: 'address.city',
      });

      expect(validator.validate({
        address: { city: 'New York' }
      }).valid).toBe(true);

      expect(validator.validate({
        address: { city: null }
      }).valid).toBe(false);

      expect(validator.validate({
        address: {}
      }).valid).toBe(false);
    });
  });

  describe('Custom error messages', () => {
    it('should use custom message when provided', () => {
      validator.addRule({
        type: ValidationRuleType.REQUIRED,
        field: 'email',
        message: 'Please enter your email address',
      });

      const result = validator.validate({ email: null });

      expect(result.errors[0].message).toBe('Please enter your email address');
    });
  });

  describe('Multiple rules', () => {
    it('should validate all rules and collect all errors', () => {
      validator.addRules([
        { type: ValidationRuleType.REQUIRED, field: 'name' },
        { type: ValidationRuleType.REQUIRED, field: 'email' },
        { type: ValidationRuleType.RANGE, field: 'age', min: 18 },
      ]);

      const result = validator.validate({
        name: null,
        email: null,
        age: 16
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });
});

describe('ValidationBuilder', () => {
  it('should build rules with fluent API', () => {
    const rules = validate()
      .required('name')
      .required('email')
      .email('email')
      .range('age', { min: 18, max: 120 })
      .min('quantity', 1)
      .max('price', 10000)
      .pattern('phone', '^\\d{10}$')
      .custom('discount', '$discount <= $maxDiscount')
      .crossField('endDate', '$endDate > $startDate', ['startDate', 'endDate'])
      .build();

    expect(rules).toHaveLength(9);
  });

  it('should create validator with toValidator()', () => {
    const validator = validate()
      .required('name')
      .min('age', 18)
      .toValidator();

    const result = validator.validate({ name: 'John', age: 25 });

    expect(result.valid).toBe(true);
  });

  it('should use provided engine', () => {
    const engine = new FormulaEngine();
    engine.registerFunction({
      name: 'IS_VALID_SKU',
      minArgs: 1,
      maxArgs: 1,
      returnType: 'boolean',
      implementation: (args) => {
        const sku = String(args[0]);
        return /^[A-Z]{3}-\d{4}$/.test(sku);
      },
    });

    const validator = validate()
      .custom('sku', 'IS_VALID_SKU($sku)', { message: 'Invalid SKU format' })
      .toValidator(engine);

    expect(validator.validate({ sku: 'ABC-1234' }).valid).toBe(true);
    expect(validator.validate({ sku: 'invalid' }).valid).toBe(false);
  });
});

describe('Real-world validation scenarios', () => {
  it('should validate order form', () => {
    const validator = validate()
      .required('customerId')
      .required('items')
      .custom('items', 'COUNT($items) > 0', { message: 'Order must have at least one item' })
      .min('total', 0)
      .crossField('total', '$total == SUM($items, $it.price * $it.quantity)', ['items', 'total'], {
        message: 'Total does not match item sum',
      })
      .toValidator();

    const validOrder = {
      customerId: 'CUST-001',
      items: [
        { price: 10, quantity: 2 },
        { price: 20, quantity: 1 },
      ],
      total: 40,
    };

    expect(validator.validate(validOrder).valid).toBe(true);

    const invalidTotal = { ...validOrder, total: 100 };
    const result = validator.validate(invalidTotal);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message === 'Total does not match item sum')).toBe(true);
  });

  it('should validate user registration', () => {
    const validator = validate()
      .required('username')
      .pattern('username', '^[a-zA-Z0-9_]{3,20}$', {
        message: 'Username must be 3-20 alphanumeric characters'
      })
      .required('email')
      .email('email')
      .required('password')
      .custom('password', 'LEN($password) >= 8', {
        message: 'Password must be at least 8 characters'
      })
      .crossField('confirmPassword', '$password == $confirmPassword',
        ['password', 'confirmPassword'],
        { message: 'Passwords do not match' }
      )
      .required('age', { message: 'Age is required' })
      .range('age', { min: 13, message: 'Must be at least 13 years old' })
      .toValidator();

    const validUser = {
      username: 'john_doe',
      email: 'john@example.com',
      password: 'securepassword',
      confirmPassword: 'securepassword',
      age: 25,
    };

    expect(validator.validate(validUser).valid).toBe(true);

    // Test various invalid cases
    expect(validator.validate({ ...validUser, username: 'ab' }).valid).toBe(false);
    expect(validator.validate({ ...validUser, email: 'invalid' }).valid).toBe(false);
    expect(validator.validate({ ...validUser, password: 'short' }).valid).toBe(false);
    expect(validator.validate({ ...validUser, confirmPassword: 'different' }).valid).toBe(false);
    expect(validator.validate({ ...validUser, age: 10 }).valid).toBe(false);
  });

  it('should validate financial transaction', () => {
    const validator = validate()
      .required('amount')
      .min('amount', 0.01, { message: 'Amount must be positive' })
      .max('amount', '$dailyLimit', { message: 'Amount exceeds daily limit' })
      .required('fromAccount')
      .required('toAccount')
      .crossField('accounts', '$fromAccount != $toAccount',
        ['fromAccount', 'toAccount'],
        { message: 'Cannot transfer to the same account' }
      )
      .toValidator();

    const validTx = {
      amount: 100,
      dailyLimit: 1000,
      fromAccount: 'ACC-001',
      toAccount: 'ACC-002',
    };

    expect(validator.validate(validTx).valid).toBe(true);
    expect(validator.validate({ ...validTx, amount: 2000 }).valid).toBe(false);
    expect(validator.validate({ ...validTx, toAccount: 'ACC-001' }).valid).toBe(false);
  });
});

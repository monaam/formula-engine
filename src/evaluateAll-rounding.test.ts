/**
 * Tests for evaluateAll() batch evaluation rounding behavior
 *
 * Issue: evaluateAll() batch evaluation doesn't respect rounded intermediate values
 * in dependency chains when consumers need to round intermediate values for accuracy.
 *
 * @see https://github.com/monaam/formula-engine/issues/XX
 */

import { FormulaEngine } from './formula-engine';
import { FormulaDefinition, EvaluationContext, RoundingConfig } from './types';
import { Decimal } from './decimal-utils';

describe('evaluateAll() Intermediate Value Rounding', () => {
  let engine: FormulaEngine;

  beforeEach(() => {
    engine = new FormulaEngine();
  });

  describe('Current Behavior - Unrounded Intermediate Values', () => {
    it('should demonstrate the issue: unrounded values propagate through dependency chain', () => {
      // This test documents the current (problematic) behavior
      // In financial calculations, intermediate values should be rounded to cents

      const formulas: FormulaDefinition[] = [
        { id: '_discount1', expression: '127.5 * 0.15' },           // = 19.125
        { id: '_discountTotal', expression: '$_discount1' },        // = 19.125 (raw)
        { id: 'totalHt', expression: '127.5 - $_discountTotal' },   // = 108.375 (using raw)
      ];

      const results = engine.evaluateAll(formulas, { variables: {} });

      expect(results.success).toBe(true);

      // Current behavior: raw unrounded values propagate
      expect((results.results.get('_discount1')?.value as Decimal).toNumber()).toBe(19.125);
      expect((results.results.get('_discountTotal')?.value as Decimal).toNumber()).toBe(19.125);
      expect((results.results.get('totalHt')?.value as Decimal).toNumber()).toBe(108.375);

      // Expected for financial calculations:
      // _discount1 = 19.125 → round to 19.13
      // _discountTotal = 19.13
      // totalHt = 127.5 - 19.13 = 108.37
      //
      // But we get 108.375 instead of 108.37
    });

    it('should show accumulated rounding errors in complex financial chain', () => {
      // Multiple line items each with small rounding differences that accumulate
      const formulas: FormulaDefinition[] = [
        // Line item 1: quantity 3 at price 10.33
        { id: 'line1_subtotal', expression: '3 * 10.33' },          // = 30.99
        { id: 'line1_tax', expression: '$line1_subtotal * 0.0825' }, // = 2.556675 (should be 2.56)

        // Line item 2: quantity 7 at price 5.67
        { id: 'line2_subtotal', expression: '7 * 5.67' },           // = 39.69
        { id: 'line2_tax', expression: '$line2_subtotal * 0.0825' }, // = 3.274425 (should be 3.27)

        // Total tax should use rounded line item taxes
        { id: 'totalTax', expression: '$line1_tax + $line2_tax' },  // = 5.8311 (should be 5.83)

        // Grand total
        { id: 'grandTotal', expression: '$line1_subtotal + $line2_subtotal + $totalTax' },
      ];

      const results = engine.evaluateAll(formulas, { variables: {} });

      expect(results.success).toBe(true);

      // Raw calculated values (what we currently get)
      const line1Tax = (results.results.get('line1_tax')?.value as Decimal).toNumber();
      const line2Tax = (results.results.get('line2_tax')?.value as Decimal).toNumber();
      const totalTax = (results.results.get('totalTax')?.value as Decimal).toNumber();

      // These are NOT rounded to 2 decimal places as financial calculations require
      expect(line1Tax).toBeCloseTo(2.556675, 6);
      expect(line2Tax).toBeCloseTo(3.274425, 6);
      expect(totalTax).toBeCloseTo(5.8311, 4);

      // For proper financial calculation:
      // line1_tax should be 2.56 (rounded)
      // line2_tax should be 3.27 (rounded)
      // totalTax should be 2.56 + 3.27 = 5.83
      //
      // Difference of 0.0011 may seem small, but accumulates across many line items
    });

    it('should show discrepancy between batch and sequential evaluation with manual rounding', () => {
      // When evaluating sequentially with manual rounding between steps,
      // we get different results than batch evaluation

      const basePrice = 127.5;
      const discountRate = 0.15;

      // Sequential evaluation with rounding
      const discount1 = new Decimal(basePrice).times(discountRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const discountTotal = discount1; // Already rounded
      const totalHtSequential = new Decimal(basePrice).minus(discountTotal).toNumber();

      // Batch evaluation
      const formulas: FormulaDefinition[] = [
        { id: '_discount1', expression: `${basePrice} * ${discountRate}` },
        { id: '_discountTotal', expression: '$_discount1' },
        { id: 'totalHt', expression: `${basePrice} - $_discountTotal` },
      ];

      const results = engine.evaluateAll(formulas, { variables: {} });
      const totalHtBatch = (results.results.get('totalHt')?.value as Decimal).toNumber();

      // Sequential with rounding: 127.5 - 19.13 = 108.37
      expect(totalHtSequential).toBe(108.37);

      // Batch without intermediate rounding: 127.5 - 19.125 = 108.375
      expect(totalHtBatch).toBe(108.375);

      // They are NOT equal - this is the core issue
      expect(totalHtSequential).not.toBe(totalHtBatch);
    });
  });

  describe('Workaround - Per-Formula Rounding Configuration', () => {
    it('should apply rounding when configured on individual formulas', () => {
      // The existing rounding config on FormulaDefinition DOES work
      // but requires specifying it on every intermediate formula

      const roundConfig: RoundingConfig = { mode: 'HALF_UP', precision: 2 };

      const formulas: FormulaDefinition[] = [
        { id: '_discount1', expression: '127.5 * 0.15', rounding: roundConfig },
        { id: '_discountTotal', expression: '$_discount1', rounding: roundConfig },
        { id: 'totalHt', expression: '127.5 - $_discountTotal', rounding: roundConfig },
      ];

      const results = engine.evaluateAll(formulas, { variables: {} });

      expect(results.success).toBe(true);

      // With per-formula rounding configured, values ARE rounded
      expect((results.results.get('_discount1')?.value as Decimal).toNumber()).toBe(19.13);
      expect((results.results.get('_discountTotal')?.value as Decimal).toNumber()).toBe(19.13);
      expect((results.results.get('totalHt')?.value as Decimal).toNumber()).toBe(108.37);
    });

    it('should propagate rounded values to dependent formulas', () => {
      // Verify that rounded values (not raw) are used in subsequent calculations

      const roundConfig: RoundingConfig = { mode: 'HALF_UP', precision: 2 };

      const formulas: FormulaDefinition[] = [
        { id: 'line1_subtotal', expression: '3 * 10.33', rounding: roundConfig },
        { id: 'line1_tax', expression: '$line1_subtotal * 0.0825', rounding: roundConfig },

        { id: 'line2_subtotal', expression: '7 * 5.67', rounding: roundConfig },
        { id: 'line2_tax', expression: '$line2_subtotal * 0.0825', rounding: roundConfig },

        { id: 'totalTax', expression: '$line1_tax + $line2_tax', rounding: roundConfig },
        { id: 'grandTotal', expression: '$line1_subtotal + $line2_subtotal + $totalTax', rounding: roundConfig },
      ];

      const results = engine.evaluateAll(formulas, { variables: {} });

      expect(results.success).toBe(true);

      // All values should be properly rounded to 2 decimal places
      expect((results.results.get('line1_subtotal')?.value as Decimal).toNumber()).toBe(30.99);
      expect((results.results.get('line1_tax')?.value as Decimal).toNumber()).toBe(2.56);
      expect((results.results.get('line2_subtotal')?.value as Decimal).toNumber()).toBe(39.69);
      expect((results.results.get('line2_tax')?.value as Decimal).toNumber()).toBe(3.27);
      expect((results.results.get('totalTax')?.value as Decimal).toNumber()).toBe(5.83);
      expect((results.results.get('grandTotal')?.value as Decimal).toNumber()).toBe(76.51);
    });

    it('should be tedious to specify rounding on many formulas', () => {
      // This test documents why the feature request makes sense:
      // Having to specify rounding on every formula is verbose and error-prone

      const roundConfig: RoundingConfig = { mode: 'HALF_UP', precision: 2 };

      // In a real application, you might have 50+ formulas
      // Forgetting rounding on ANY intermediate formula breaks the chain
      const formulas: FormulaDefinition[] = [
        { id: 'unitPrice', expression: '$basePrice / $packageQty', rounding: roundConfig },
        { id: 'lineSubtotal', expression: '$unitPrice * $qty', rounding: roundConfig },
        { id: 'discountAmount', expression: '$lineSubtotal * $discountPct / 100', rounding: roundConfig },
        { id: 'afterDiscount', expression: '$lineSubtotal - $discountAmount', rounding: roundConfig },
        { id: 'taxableAmount', expression: '$afterDiscount', rounding: roundConfig },
        { id: 'stateTax', expression: '$taxableAmount * $stateTaxRate', rounding: roundConfig },
        { id: 'localTax', expression: '$taxableAmount * $localTaxRate', rounding: roundConfig },
        { id: 'totalTax', expression: '$stateTax + $localTax', rounding: roundConfig },
        { id: 'lineTotal', expression: '$afterDiscount + $totalTax', rounding: roundConfig },
        // ... many more formulas in a real system
      ];

      const context: EvaluationContext = {
        variables: {
          basePrice: 99.99,
          packageQty: 3,
          qty: 7,
          discountPct: 10,
          stateTaxRate: 0.0625,
          localTaxRate: 0.02,
        },
      };

      const results = engine.evaluateAll(formulas, context);
      expect(results.success).toBe(true);

      // Every formula needs rounding: { mode: 'HALF_UP', precision: 2 }
      // This is repetitive and easy to forget
      expect(formulas.every(f => f.rounding !== undefined)).toBe(true);
    });
  });

  describe('Expected Behavior - Global Intermediate Rounding (Feature Request)', () => {
    /**
     * These tests document the DESIRED behavior for the feature request.
     * They are currently skipped because the feature doesn't exist yet.
     *
     * Proposed API options:
     *
     * Option A: roundIntermediate callback
     * ```
     * engine.evaluateAll(formulas, context, {
     *   roundIntermediate: (value: number) =>
     *     new Decimal(value).toDecimalPlaces(2, ROUND_HALF_UP).toNumber()
     * });
     * ```
     *
     * Option B: onFormulaEvaluated callback
     * ```
     * engine.evaluateAll(formulas, context, {
     *   onFormulaEvaluated: (id, result, context) => {
     *     const rounded = round(result);
     *     context[id] = rounded;
     *     return rounded;
     *   }
     * });
     * ```
     *
     * Option C: intermediateRounding config
     * ```
     * engine.evaluateAll(formulas, context, {
     *   intermediateRounding: { mode: 'HALF_UP', precision: 2 }
     * });
     * ```
     */

    it.skip('should apply roundIntermediate callback to all formula results', () => {
      const formulas: FormulaDefinition[] = [
        { id: '_discount1', expression: '127.5 * 0.15' },
        { id: '_discountTotal', expression: '$_discount1' },
        { id: 'totalHt', expression: '127.5 - $_discountTotal' },
      ];

      // Proposed API - does not exist yet
      // const results = engine.evaluateAll(formulas, { variables: {} }, {
      //   roundIntermediate: (value: Decimal) =>
      //     value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      // });

      // Expected results with intermediate rounding:
      // expect((results.results.get('_discount1')?.value as Decimal).toNumber()).toBe(19.13);
      // expect((results.results.get('_discountTotal')?.value as Decimal).toNumber()).toBe(19.13);
      // expect((results.results.get('totalHt')?.value as Decimal).toNumber()).toBe(108.37);
    });

    it.skip('should support intermediateRounding config option', () => {
      const formulas: FormulaDefinition[] = [
        { id: 'line1_tax', expression: '30.99 * 0.0825' },
        { id: 'line2_tax', expression: '39.69 * 0.0825' },
        { id: 'totalTax', expression: '$line1_tax + $line2_tax' },
      ];

      // Proposed API - does not exist yet
      // const results = engine.evaluateAll(formulas, { variables: {} }, {
      //   intermediateRounding: { mode: 'HALF_UP', precision: 2 }
      // });

      // Expected results:
      // expect((results.results.get('line1_tax')?.value as Decimal).toNumber()).toBe(2.56);
      // expect((results.results.get('line2_tax')?.value as Decimal).toNumber()).toBe(3.27);
      // expect((results.results.get('totalTax')?.value as Decimal).toNumber()).toBe(5.83);
    });

    it.skip('should allow per-formula override of global intermediate rounding', () => {
      // Some formulas might need different precision (e.g., exchange rates need 4 decimals)
      const formulas: FormulaDefinition[] = [
        { id: 'exchangeRate', expression: '1 / 1.2345', rounding: { mode: 'HALF_UP', precision: 4 } },
        { id: 'convertedAmount', expression: '100 * $exchangeRate' }, // Uses global 2 decimal rounding
        { id: 'tax', expression: '$convertedAmount * 0.0825' },
      ];

      // Proposed API - does not exist yet
      // const results = engine.evaluateAll(formulas, { variables: {} }, {
      //   intermediateRounding: { mode: 'HALF_UP', precision: 2 }
      // });

      // Expected: formula-level rounding overrides global
      // expect((results.results.get('exchangeRate')?.value as Decimal).toNumber()).toBe(0.8101);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rounding mode NONE correctly', () => {
      const formulas: FormulaDefinition[] = [
        { id: 'calc', expression: '1 / 3', rounding: { mode: 'NONE', precision: 2 } },
      ];

      const results = engine.evaluateAll(formulas, { variables: {} });

      // NONE mode should not round
      const value = (results.results.get('calc')?.value as Decimal).toString();
      expect(value.length).toBeGreaterThan(5); // Not truncated to 2 decimals
    });

    it('should handle rounding with FLOOR mode', () => {
      const formulas: FormulaDefinition[] = [
        { id: 'calc', expression: '19.129', rounding: { mode: 'FLOOR', precision: 2 } },
      ];

      const results = engine.evaluateAll(formulas, { variables: {} });
      expect((results.results.get('calc')?.value as Decimal).toNumber()).toBe(19.12);
    });

    it('should handle rounding with CEIL mode', () => {
      const formulas: FormulaDefinition[] = [
        { id: 'calc', expression: '19.121', rounding: { mode: 'CEIL', precision: 2 } },
      ];

      const results = engine.evaluateAll(formulas, { variables: {} });
      expect((results.results.get('calc')?.value as Decimal).toNumber()).toBe(19.13);
    });

    it('should handle mixed rounding configurations in chain', () => {
      const formulas: FormulaDefinition[] = [
        { id: 'a', expression: '10.555', rounding: { mode: 'HALF_UP', precision: 2 } },   // 10.56
        { id: 'b', expression: '$a * 2', rounding: { mode: 'FLOOR', precision: 1 } },     // 21.1 (floor of 21.12)
        { id: 'c', expression: '$b + 0.99', rounding: { mode: 'CEIL', precision: 0 } },   // 23 (ceil of 22.09)
      ];

      const results = engine.evaluateAll(formulas, { variables: {} });

      expect((results.results.get('a')?.value as Decimal).toNumber()).toBe(10.56);
      expect((results.results.get('b')?.value as Decimal).toNumber()).toBe(21.1);
      expect((results.results.get('c')?.value as Decimal).toNumber()).toBe(23);
    });

    it('should propagate rounded value even when dependent formula has no rounding', () => {
      // If formula A has rounding, formula B that depends on A should see the rounded value
      const formulas: FormulaDefinition[] = [
        { id: 'a', expression: '19.125', rounding: { mode: 'HALF_UP', precision: 2 } },
        { id: 'b', expression: '$a * 2' }, // No rounding on b, but should use rounded a
      ];

      const results = engine.evaluateAll(formulas, { variables: {} });

      expect((results.results.get('a')?.value as Decimal).toNumber()).toBe(19.13);
      // b should be 19.13 * 2 = 38.26, NOT 19.125 * 2 = 38.25
      expect((results.results.get('b')?.value as Decimal).toNumber()).toBe(38.26);
    });

    it('should handle non-numeric results without rounding errors', () => {
      const formulas: FormulaDefinition[] = [
        { id: 'amount', expression: '19.125', rounding: { mode: 'HALF_UP', precision: 2 } },
        { id: 'label', expression: '"Total: " + STRING($amount)' },
        { id: 'isPositive', expression: '$amount > 0' },
      ];

      const results = engine.evaluateAll(formulas, { variables: {} });

      expect(results.success).toBe(true);
      expect((results.results.get('amount')?.value as Decimal).toNumber()).toBe(19.13);
      expect(results.results.get('label')?.value).toBe('Total: 19.13');
      expect(results.results.get('isPositive')?.value).toBe(true);
    });
  });

  describe('Real-World Financial Scenarios', () => {
    it('should calculate invoice with proper rounding for accounting', () => {
      const roundConfig: RoundingConfig = { mode: 'HALF_UP', precision: 2 };

      const formulas: FormulaDefinition[] = [
        // Line items
        { id: 'line1', expression: '$qty1 * $price1', rounding: roundConfig },
        { id: 'line2', expression: '$qty2 * $price2', rounding: roundConfig },
        { id: 'line3', expression: '$qty3 * $price3', rounding: roundConfig },

        // Subtotal
        { id: 'subtotal', expression: '$line1 + $line2 + $line3', rounding: roundConfig },

        // Discount (percentage)
        { id: 'discountAmount', expression: '$subtotal * $discountPct / 100', rounding: roundConfig },
        { id: 'afterDiscount', expression: '$subtotal - $discountAmount', rounding: roundConfig },

        // Tax calculations (separate state and local)
        { id: 'stateTax', expression: '$afterDiscount * 0.0625', rounding: roundConfig },
        { id: 'localTax', expression: '$afterDiscount * 0.0225', rounding: roundConfig },
        { id: 'totalTax', expression: '$stateTax + $localTax', rounding: roundConfig },

        // Final total
        { id: 'grandTotal', expression: '$afterDiscount + $totalTax', rounding: roundConfig },
      ];

      const context: EvaluationContext = {
        variables: {
          qty1: 3, price1: 29.99,   // 89.97
          qty2: 2, price2: 49.95,   // 99.90
          qty3: 5, price3: 9.99,    // 49.95
          discountPct: 15,          // 15% discount
        },
      };

      const results = engine.evaluateAll(formulas, context);

      expect(results.success).toBe(true);

      // Verify each step is properly rounded
      expect((results.results.get('line1')?.value as Decimal).toNumber()).toBe(89.97);
      expect((results.results.get('line2')?.value as Decimal).toNumber()).toBe(99.90);
      expect((results.results.get('line3')?.value as Decimal).toNumber()).toBe(49.95);
      expect((results.results.get('subtotal')?.value as Decimal).toNumber()).toBe(239.82);
      expect((results.results.get('discountAmount')?.value as Decimal).toNumber()).toBe(35.97); // 239.82 * 0.15 = 35.973 -> 35.97
      expect((results.results.get('afterDiscount')?.value as Decimal).toNumber()).toBe(203.85);
      expect((results.results.get('stateTax')?.value as Decimal).toNumber()).toBe(12.74); // 203.85 * 0.0625 = 12.740625 -> 12.74
      expect((results.results.get('localTax')?.value as Decimal).toNumber()).toBe(4.59); // 203.85 * 0.0225 = 4.586625 -> 4.59
      expect((results.results.get('totalTax')?.value as Decimal).toNumber()).toBe(17.33);
      expect((results.results.get('grandTotal')?.value as Decimal).toNumber()).toBe(221.18);
    });

    it('should handle currency conversion with proper intermediate rounding', () => {
      const roundConfig: RoundingConfig = { mode: 'HALF_UP', precision: 2 };

      const formulas: FormulaDefinition[] = [
        // Amount in USD
        { id: 'usdAmount', expression: '$baseAmount * $usdRate', rounding: roundConfig },

        // Convert USD to EUR (intermediate conversion)
        { id: 'eurAmount', expression: '$usdAmount * $eurRate', rounding: roundConfig },

        // Add VAT in EUR
        { id: 'vatAmount', expression: '$eurAmount * 0.20', rounding: roundConfig },
        { id: 'totalEur', expression: '$eurAmount + $vatAmount', rounding: roundConfig },
      ];

      const context: EvaluationContext = {
        variables: {
          baseAmount: 1000,
          usdRate: 1.0,     // 1:1 for simplicity
          eurRate: 0.92,    // USD to EUR
        },
      };

      const results = engine.evaluateAll(formulas, context);

      expect(results.success).toBe(true);
      expect((results.results.get('usdAmount')?.value as Decimal).toNumber()).toBe(1000);
      expect((results.results.get('eurAmount')?.value as Decimal).toNumber()).toBe(920);
      expect((results.results.get('vatAmount')?.value as Decimal).toNumber()).toBe(184);
      expect((results.results.get('totalEur')?.value as Decimal).toNumber()).toBe(1104);
    });

    it('should handle commission calculations with tiered rates', () => {
      const roundConfig: RoundingConfig = { mode: 'HALF_UP', precision: 2 };

      const formulas: FormulaDefinition[] = [
        // Base commission
        { id: 'baseCommission', expression: '$saleAmount * 0.05', rounding: roundConfig },

        // Bonus for exceeding threshold
        { id: 'bonusEligible', expression: '$saleAmount > 10000 ? ($saleAmount - 10000) * 0.02 : 0', rounding: roundConfig },

        // Total commission
        { id: 'totalCommission', expression: '$baseCommission + $bonusEligible', rounding: roundConfig },

        // Tax withholding
        { id: 'taxWithholding', expression: '$totalCommission * 0.22', rounding: roundConfig },

        // Net payout
        { id: 'netPayout', expression: '$totalCommission - $taxWithholding', rounding: roundConfig },
      ];

      const context: EvaluationContext = {
        variables: {
          saleAmount: 15750.50,
        },
      };

      const results = engine.evaluateAll(formulas, context);

      expect(results.success).toBe(true);
      // 15750.50 * 0.05 = 787.525 -> 787.53
      expect((results.results.get('baseCommission')?.value as Decimal).toNumber()).toBe(787.53);
      // (15750.50 - 10000) * 0.02 = 115.01
      expect((results.results.get('bonusEligible')?.value as Decimal).toNumber()).toBe(115.01);
      // 787.53 + 115.01 = 902.54
      expect((results.results.get('totalCommission')?.value as Decimal).toNumber()).toBe(902.54);
      // 902.54 * 0.22 = 198.5588 -> 198.56
      expect((results.results.get('taxWithholding')?.value as Decimal).toNumber()).toBe(198.56);
      // 902.54 - 198.56 = 703.98
      expect((results.results.get('netPayout')?.value as Decimal).toNumber()).toBe(703.98);
    });
  });
});

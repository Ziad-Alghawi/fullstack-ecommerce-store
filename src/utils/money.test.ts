import { it, expect, describe } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formats 1999 cents as €19.99 in English', () => {
    expect(formatMoney(1999, 'en-US')).toBe('€19.99');
  });

  it('displays 2 decimals', () => {
    expect(formatMoney(1090, 'en-US')).toBe('€10.90');
    expect(formatMoney(100, 'en-US')).toBe('€1.00');
  });

  it('formats zero', () => {
    expect(formatMoney(0, 'en-US')).toBe('€0.00');
  });

  it('puts the minus sign before the euro sign', () => {
    expect(formatMoney(-500, 'en-US')).toBe('-€5.00');
  });

  it('writes euros the German way, with the sign after the amount', () => {
    expect(formatMoney(2067, 'de-DE')).toBe('20,67 €');
    expect(formatMoney(123456, 'de-DE')).toBe('1.234,56 €');
    expect(formatMoney(-500, 'de-DE')).toBe('-5,00 €');
  });
});

import { it, expect, describe } from 'vitest';
import { formatDeliveryDate, formatDate } from './date';

describe('formatDeliveryDate', () => {
  it('shows the weekday, month and day', () => {
    expect(formatDeliveryDate(new Date(2025, 4, 18).getTime())).toBe('Sunday, May 18');
  });
});

describe('formatDate', () => {
  it('shows the month, day and year', () => {
    expect(formatDate(new Date(2025, 4, 18, 9).toISOString())).toBe('May 18, 2025');
  });
});

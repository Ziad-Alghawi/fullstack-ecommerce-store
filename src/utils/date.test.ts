import { it, expect, describe } from 'vitest';
import { formatDate, formatDateTime, formatDayAndMonth, formatDeliveryDate } from './date';

const may18 = new Date(2025, 4, 18, 9, 30);

describe('formatDeliveryDate', () => {
  it('shows the weekday, month and day', () => {
    expect(formatDeliveryDate(may18.getTime(), 'en-US')).toBe('Sunday, May 18');
    expect(formatDeliveryDate(may18.getTime(), 'de-DE')).toBe('Sonntag, 18. Mai');
  });
});

describe('formatDate', () => {
  it('shows the month, day and year', () => {
    expect(formatDate(may18.toISOString(), 'en-US')).toBe('May 18, 2025');
    expect(formatDate(may18.toISOString(), 'de-DE')).toBe('18. Mai 2025');
  });
});

describe('formatDayAndMonth', () => {
  it('shows the month and day', () => {
    expect(formatDayAndMonth(may18.getTime(), 'en-US')).toBe('May 18');
    expect(formatDayAndMonth(may18.getTime(), 'de-DE')).toBe('18. Mai');
  });
});

describe('formatDateTime', () => {
  it('shows the date and time, with a 24 hour clock in German', () => {
    expect(formatDateTime(may18.getTime(), 'en-US')).toMatch(/^May 18, 2025, 9:30\sAM$/);
    expect(formatDateTime(may18.getTime(), 'de-DE')).toBe('18.05.2025, 09:30');
  });
});

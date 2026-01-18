import { describe, it, expect } from 'vitest';
import {
  isValidTimezone,
  getSystemTimezone,
  toUserTime,
  toUtc,
  formatInUserTimezone,
  getStartOfDayUtc,
  getEndOfDayUtc,
  parseTimeString,
  formatTimeString,
  getTimezoneOffset,
  getTimezoneAbbreviation,
  formatForDisplay,
  getDurationMinutes,
  addMinutesToDate,
  isTimeBetween,
  COMMON_TIMEZONES,
} from '../timezone.js';

describe('Timezone Utilities', () => {
  describe('isValidTimezone', () => {
    it('returns true for valid timezone strings', () => {
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('America/Los_Angeles')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
    });

    it('returns false for invalid timezone strings', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      // Note: Some Node.js versions may accept 'EST' as a valid timezone
      // so we test with a clearly invalid string instead
      expect(isValidTimezone('Not_A_Real_Zone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
      expect(isValidTimezone('America/FakeCity')).toBe(false);
    });
  });

  describe('getSystemTimezone', () => {
    it('returns a string', () => {
      const tz = getSystemTimezone();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });

    it('returns a valid timezone', () => {
      const tz = getSystemTimezone();
      expect(isValidTimezone(tz)).toBe(true);
    });
  });

  describe('toUserTime', () => {
    it('converts UTC to Eastern time correctly', () => {
      // UTC time: 2024-01-15 17:00:00 UTC
      const utcDate = new Date('2024-01-15T17:00:00.000Z');
      const result = toUserTime(utcDate, 'America/New_York');

      // In winter, EST is UTC-5, so 17:00 UTC = 12:00 EST
      expect(result.getHours()).toBe(12);
    });

    it('converts UTC to Pacific time correctly', () => {
      const utcDate = new Date('2024-01-15T17:00:00.000Z');
      const result = toUserTime(utcDate, 'America/Los_Angeles');

      // In winter, PST is UTC-8, so 17:00 UTC = 09:00 PST
      expect(result.getHours()).toBe(9);
    });
  });

  describe('toUtc', () => {
    it('converts Eastern local time to UTC', () => {
      // Local Eastern time: 12:00 (noon)
      // Create a date object for noon in a specific zone
      const localDate = new Date('2024-01-15T12:00:00-05:00');
      const result = toUtc(localDate, 'America/New_York');

      // The result should be 17:00 UTC
      expect(result.getUTCHours()).toBe(17);
    });
  });

  describe('formatInUserTimezone', () => {
    it('formats date in user timezone', () => {
      const utcDate = new Date('2024-01-15T17:00:00.000Z');
      const result = formatInUserTimezone(utcDate, 'HH:mm', 'America/New_York');

      expect(result).toBe('12:00');
    });

    it('formats date with full pattern', () => {
      const utcDate = new Date('2024-01-15T17:00:00.000Z');
      const result = formatInUserTimezone(utcDate, 'yyyy-MM-dd HH:mm', 'America/New_York');

      expect(result).toBe('2024-01-15 12:00');
    });
  });

  describe('getStartOfDayUtc', () => {
    it('returns start of day in UTC for given timezone', () => {
      const date = new Date('2024-01-15T12:00:00-05:00');
      const result = getStartOfDayUtc(date, 'America/New_York');

      // Start of day in Eastern time should be 05:00 UTC (in winter)
      expect(result.getUTCHours()).toBe(5);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
    });
  });

  describe('getEndOfDayUtc', () => {
    it('returns end of day in UTC for given timezone', () => {
      const date = new Date('2024-01-15T12:00:00-05:00');
      const result = getEndOfDayUtc(date, 'America/New_York');

      // End of day (23:59:59) in Eastern time should be ~04:59 UTC next day
      expect(result.getUTCHours()).toBe(4);
      expect(result.getUTCMinutes()).toBe(59);
    });
  });

  describe('parseTimeString', () => {
    it('parses HH:mm string to Date', () => {
      const baseDate = new Date('2024-01-15T12:00:00-05:00');
      const result = parseTimeString('09:30', baseDate, 'America/New_York');

      expect(result.getUTCHours()).toBe(14); // 9:30 EST = 14:30 UTC
      expect(result.getUTCMinutes()).toBe(30);
    });

    it('throws for invalid time string', () => {
      const baseDate = new Date('2024-01-15T12:00:00-05:00');
      expect(() => parseTimeString('25:00', baseDate, 'America/New_York')).toThrow();
      expect(() => parseTimeString('12:60', baseDate, 'America/New_York')).toThrow();
      expect(() => parseTimeString('invalid', baseDate, 'America/New_York')).toThrow();
    });

    it('handles midnight', () => {
      const baseDate = new Date('2024-01-15T12:00:00-05:00');
      const result = parseTimeString('00:00', baseDate, 'America/New_York');

      expect(result.getUTCHours()).toBe(5); // 00:00 EST = 05:00 UTC
    });

    it('handles 23:59', () => {
      const baseDate = new Date('2024-01-15T12:00:00-05:00');
      const result = parseTimeString('23:59', baseDate, 'America/New_York');

      // 23:59 EST = 04:59 UTC next day
      expect(result.getUTCMinutes()).toBe(59);
    });
  });

  describe('formatTimeString', () => {
    it('formats Date to HH:mm string', () => {
      const date = new Date('2024-01-15T14:30:00.000Z'); // 9:30 EST
      const result = formatTimeString(date, 'America/New_York');

      expect(result).toBe('09:30');
    });
  });

  describe('getTimezoneOffset', () => {
    it('returns correct offset for Eastern time in winter', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const offset = getTimezoneOffset('America/New_York', date);

      expect(offset).toBe(-300); // UTC-5 = -300 minutes
    });

    it('returns different offset during DST', () => {
      const winterDate = new Date('2024-01-15T12:00:00Z');
      const summerDate = new Date('2024-07-15T12:00:00Z');

      const winterOffset = getTimezoneOffset('America/New_York', winterDate);
      const summerOffset = getTimezoneOffset('America/New_York', summerDate);

      expect(winterOffset).toBe(-300); // UTC-5
      expect(summerOffset).toBe(-240); // UTC-4
    });
  });

  describe('getTimezoneAbbreviation', () => {
    it('returns timezone abbreviation', () => {
      const winterDate = new Date('2024-01-15T12:00:00Z');
      const abbr = getTimezoneAbbreviation('America/New_York', winterDate);

      expect(abbr).toBe('EST');
    });

    it('returns EDT during summer', () => {
      const summerDate = new Date('2024-07-15T12:00:00Z');
      const abbr = getTimezoneAbbreviation('America/New_York', summerDate);

      expect(abbr).toBe('EDT');
    });
  });

  describe('formatForDisplay', () => {
    it('formats date for display without timezone', () => {
      const date = new Date('2024-01-15T17:30:00.000Z');
      const result = formatForDisplay(date, 'America/New_York', false);

      expect(result).toBe('2024-01-15 12:30');
    });

    it('formats date for display with timezone', () => {
      const date = new Date('2024-01-15T17:30:00.000Z');
      const result = formatForDisplay(date, 'America/New_York', true);

      expect(result).toContain('2024-01-15 12:30');
      expect(result).toContain('EST');
    });
  });

  describe('getDurationMinutes', () => {
    it('calculates duration between two dates', () => {
      const start = new Date('2024-01-15T09:00:00Z');
      const end = new Date('2024-01-15T10:30:00Z');

      expect(getDurationMinutes(start, end)).toBe(90);
    });

    it('handles zero duration', () => {
      const date = new Date('2024-01-15T09:00:00Z');
      expect(getDurationMinutes(date, date)).toBe(0);
    });
  });

  describe('addMinutesToDate', () => {
    it('adds minutes to a date', () => {
      const date = new Date('2024-01-15T09:00:00Z');
      const result = addMinutesToDate(date, 90);

      expect(result.getUTCHours()).toBe(10);
      expect(result.getUTCMinutes()).toBe(30);
    });

    it('handles negative minutes', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = addMinutesToDate(date, -90);

      expect(result.getUTCHours()).toBe(9);
      expect(result.getUTCMinutes()).toBe(0);
    });
  });

  describe('isTimeBetween', () => {
    it('returns true when time is within range', () => {
      const time = new Date('2024-01-15T15:00:00-05:00');
      const start = new Date('2024-01-15T09:00:00-05:00');
      const end = new Date('2024-01-15T17:00:00-05:00');

      expect(isTimeBetween(time, start, end, 'America/New_York')).toBe(true);
    });

    it('returns false when time is outside range', () => {
      const time = new Date('2024-01-15T08:00:00-05:00');
      const start = new Date('2024-01-15T09:00:00-05:00');
      const end = new Date('2024-01-15T17:00:00-05:00');

      expect(isTimeBetween(time, start, end, 'America/New_York')).toBe(false);
    });

    it('handles overnight ranges (e.g., 22:00 to 06:00)', () => {
      const time = new Date('2024-01-15T23:00:00-05:00');
      const start = new Date('2024-01-15T22:00:00-05:00');
      const end = new Date('2024-01-15T06:00:00-05:00');

      expect(isTimeBetween(time, start, end, 'America/New_York')).toBe(true);
    });

    it('handles early morning in overnight range', () => {
      const time = new Date('2024-01-15T04:00:00-05:00');
      const start = new Date('2024-01-15T22:00:00-05:00');
      const end = new Date('2024-01-15T06:00:00-05:00');

      expect(isTimeBetween(time, start, end, 'America/New_York')).toBe(true);
    });
  });

  describe('COMMON_TIMEZONES', () => {
    it('contains expected timezones', () => {
      expect(COMMON_TIMEZONES).toContain('America/New_York');
      expect(COMMON_TIMEZONES).toContain('America/Los_Angeles');
      expect(COMMON_TIMEZONES).toContain('Europe/London');
    });

    it('all timezones are valid', () => {
      for (const tz of COMMON_TIMEZONES) {
        expect(isValidTimezone(tz)).toBe(true);
      }
    });
  });
});

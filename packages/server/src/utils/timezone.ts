import {
  format,
  parse,
  startOfDay,
  endOfDay,
  setHours,
  setMinutes,
  isValid,
} from 'date-fns';
import {
  toZonedTime,
  fromZonedTime,
  formatInTimeZone,
} from 'date-fns-tz';

// Common timezone identifiers
export const COMMON_TIMEZONES = [
  'America/New_York',      // Eastern
  'America/Chicago',       // Central
  'America/Denver',        // Mountain
  'America/Los_Angeles',   // Pacific
  'America/Phoenix',       // Arizona (no DST)
  'America/Anchorage',     // Alaska
  'Pacific/Honolulu',      // Hawaii
  'Europe/London',         // UK
  'Europe/Paris',          // Central European
  'Europe/Berlin',         // Central European
  'Asia/Tokyo',            // Japan
  'Asia/Shanghai',         // China
  'Asia/Dubai',            // UAE
  'Australia/Sydney',      // Australia Eastern
  'Pacific/Auckland',      // New Zealand
] as const;

export type CommonTimezone = typeof COMMON_TIMEZONES[number];

// Validate timezone string
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

// Get user's system timezone
export function getSystemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Convert UTC date to user's timezone
export function toUserTime(utcDate: Date, timezone: string): Date {
  return toZonedTime(utcDate, timezone);
}

// Convert user's local time to UTC
export function toUtc(localDate: Date, timezone: string): Date {
  return fromZonedTime(localDate, timezone);
}

// Format date in user's timezone
export function formatInUserTimezone(
  date: Date,
  formatStr: string,
  timezone: string
): string {
  return formatInTimeZone(date, timezone, formatStr);
}

// Get start of day in user's timezone (as UTC)
export function getStartOfDayUtc(date: Date, timezone: string): Date {
  const zonedDate = toZonedTime(date, timezone);
  const startOfDayZoned = startOfDay(zonedDate);
  return fromZonedTime(startOfDayZoned, timezone);
}

// Get end of day in user's timezone (as UTC)
export function getEndOfDayUtc(date: Date, timezone: string): Date {
  const zonedDate = toZonedTime(date, timezone);
  const endOfDayZoned = endOfDay(zonedDate);
  return fromZonedTime(endOfDayZoned, timezone);
}

// Parse time string (HH:mm) to Date in user's timezone
export function parseTimeString(
  timeStr: string,
  baseDate: Date,
  timezone: string
): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);

  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time string: ${timeStr}`);
  }

  const zonedBase = toZonedTime(baseDate, timezone);
  const zonedStart = startOfDay(zonedBase);
  const withTime = setMinutes(setHours(zonedStart, hours), minutes);
  return fromZonedTime(withTime, timezone);
}

// Format time to HH:mm string in user's timezone
export function formatTimeString(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'HH:mm');
}

// Get current time in user's timezone
export function getCurrentTimeInTimezone(timezone: string): Date {
  return toZonedTime(new Date(), timezone);
}

// Calculate time difference between UTC and timezone (in minutes)
export function getTimezoneOffset(timezone: string, date: Date = new Date()): number {
  const utcDate = date;
  const zonedDate = toZonedTime(utcDate, timezone);

  // Get the difference in minutes
  const utcMinutes = utcDate.getUTCHours() * 60 + utcDate.getUTCMinutes();
  const localMinutes = zonedDate.getHours() * 60 + zonedDate.getMinutes();

  // Handle day boundary
  let diff = localMinutes - utcMinutes;
  if (diff > 720) diff -= 1440; // More than 12 hours means we crossed midnight
  if (diff < -720) diff += 1440;

  return diff;
}

// Get timezone abbreviation (e.g., EST, PST)
export function getTimezoneAbbreviation(timezone: string, date: Date = new Date()): string {
  return formatInTimeZone(date, timezone, 'zzz');
}

// Check if date is during daylight saving time
export function isDST(timezone: string, date: Date = new Date()): boolean {
  const january = new Date(date.getFullYear(), 0, 1);
  const july = new Date(date.getFullYear(), 6, 1);

  const janOffset = getTimezoneOffset(timezone, january);
  const julOffset = getTimezoneOffset(timezone, july);
  const currentOffset = getTimezoneOffset(timezone, date);

  // If current offset equals the larger offset, we're in DST
  // (In the northern hemisphere, DST = summer = larger offset)
  return currentOffset === Math.max(janOffset, julOffset);
}

// Get next DST transition date (or null if timezone doesn't observe DST)
export function getNextDSTTransition(timezone: string): Date | null {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Check each day for the next year for offset changes
  let lastOffset = getTimezoneOffset(timezone, now);

  for (let days = 1; days <= 366; days++) {
    const checkDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const newOffset = getTimezoneOffset(timezone, checkDate);

    if (newOffset !== lastOffset) {
      // Found a transition - refine to find exact time
      // (For simplicity, just return the day)
      return startOfDay(checkDate);
    }

    lastOffset = newOffset;
  }

  return null; // No DST transition found
}

// Parse ISO date string and validate
export function parseISODate(dateStr: string): Date {
  const date = new Date(dateStr);
  if (!isValid(date)) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }
  return date;
}

// Format for API responses (ISO 8601)
export function toISOString(date: Date): string {
  return date.toISOString();
}

// Format for display with timezone
export function formatForDisplay(
  date: Date,
  timezone: string,
  includeTimezone: boolean = false
): string {
  const pattern = includeTimezone ? 'yyyy-MM-dd HH:mm zzz' : 'yyyy-MM-dd HH:mm';
  return formatInTimeZone(date, timezone, pattern);
}

// Calculate duration between two dates in minutes
export function getDurationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

// Add minutes to a date
export function addMinutesToDate(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

// Check if time is between two times (handles overnight spans)
export function isTimeBetween(
  time: Date,
  start: Date,
  end: Date,
  timezone: string
): boolean {
  const zonedTime = toZonedTime(time, timezone);
  const zonedStart = toZonedTime(start, timezone);
  const zonedEnd = toZonedTime(end, timezone);

  const timeMinutes = zonedTime.getHours() * 60 + zonedTime.getMinutes();
  const startMinutes = zonedStart.getHours() * 60 + zonedStart.getMinutes();
  const endMinutes = zonedEnd.getHours() * 60 + zonedEnd.getMinutes();

  if (startMinutes <= endMinutes) {
    // Normal range (e.g., 09:00 to 17:00)
    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  } else {
    // Overnight range (e.g., 22:00 to 06:00)
    return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
  }
}

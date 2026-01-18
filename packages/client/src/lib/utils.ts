import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a time string (HH:mm) to 12-hour format with AM/PM
 * @param time - Time in HH:mm format (e.g., "19:30")
 * @param use24Hour - If true, keep 24-hour format (optional, defaults to false)
 * @returns Formatted time string (e.g., "7:30 PM" or "19:30")
 */
export function formatTimeString(time: string | null | undefined, use24Hour = false): string {
  if (!time) return '';

  const [hoursStr, minutesStr] = time.split(':');
  const hours = parseInt(hoursStr || '0', 10);
  const minutes = minutesStr || '00';

  if (use24Hour) {
    return time;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12; // Convert 0 to 12 for midnight

  return `${displayHours}:${minutes} ${period}`;
}

/**
 * Format a time range (HH:mm - HH:mm) to 12-hour format
 */
export function formatTimeRange(start: string | null | undefined, end: string | null | undefined, use24Hour = false): string {
  if (!start && !end) return '';
  if (!start) return formatTimeString(end, use24Hour);
  if (!end) return formatTimeString(start, use24Hour);
  return `${formatTimeString(start, use24Hour)} - ${formatTimeString(end, use24Hour)}`;
}

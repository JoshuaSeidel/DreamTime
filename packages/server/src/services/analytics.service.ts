import {
  startOfDay,
  endOfDay,
  subDays,
  format,
  differenceInMinutes,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { prisma } from '../config/database.js';
import { InviteStatus, SessionType, SessionState } from '../types/enums.js';

// Response types
export interface DailySleepSummary {
  date: string;
  totalSleepMinutes: number;
  napCount: number;
  napMinutes: number;
  nightSleepMinutes: number;
  averageNapLength: number | null;
  longestNap: number | null;
  shortestNap: number | null;
  firstNapStart: string | null;
  lastNapEnd: string | null;
  bedtime: string | null;
  wakeTime: string | null;
  cryingMinutes: number | null;
}

export interface WeeklySleepSummary {
  weekStart: string;
  weekEnd: string;
  avgTotalSleepMinutes: number;
  avgNapCount: number;
  avgNapMinutes: number;
  avgNightSleepMinutes: number;
  avgNapLength: number | null;
  avgBedtime: string | null;
  avgWakeTime: string | null;
  daysWithData: number;
  dailyBreakdown: DailySleepSummary[];
}

export interface SleepTrend {
  period: '7d' | '30d';
  dataPoints: {
    date: string;
    totalSleepMinutes: number;
    napMinutes: number;
    nightSleepMinutes: number;
    napCount: number;
  }[];
  averages: {
    totalSleepMinutes: number;
    napMinutes: number;
    nightSleepMinutes: number;
    napCount: number;
  };
  trends: {
    totalSleep: 'increasing' | 'decreasing' | 'stable';
    napCount: 'increasing' | 'decreasing' | 'stable';
    napLength: 'increasing' | 'decreasing' | 'stable';
  };
}

export interface AnalyticsSummary {
  daily: DailySleepSummary;
  weekly: WeeklySleepSummary;
  trends: {
    sevenDay: SleepTrend;
    thirtyDay: SleepTrend;
  };
  insights: string[];
}

// Verify child access
async function verifyChildAccess(userId: string, childId: string): Promise<void> {
  const relation = await prisma.childCaregiver.findUnique({
    where: {
      childId_userId: { childId, userId },
    },
  });

  if (!relation || relation.status !== InviteStatus.ACCEPTED) {
    throw new Error('Child not found');
  }
}

// Helper to get sessions for a date range
async function getSessionsInRange(
  childId: string,
  startDate: Date,
  endDate: Date
) {
  return prisma.sleepSession.findMany({
    where: {
      childId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      state: SessionState.COMPLETED,
    },
    orderBy: { createdAt: 'asc' },
  });
}

// Format time for display (HH:mm)
function formatTime(date: Date | null, timezone: string): string | null {
  if (!date) return null;
  const zonedDate = toZonedTime(date, timezone);
  return format(zonedDate, 'HH:mm');
}

// Calculate average time from array of dates
function calculateAverageTime(times: Date[], timezone: string): string | null {
  if (times.length === 0) return null;

  let totalMinutes = 0;
  for (const time of times) {
    const zonedTime = toZonedTime(time, timezone);
    totalMinutes += zonedTime.getHours() * 60 + zonedTime.getMinutes();
  }

  const avgMinutes = Math.round(totalMinutes / times.length);
  const hours = Math.floor(avgMinutes / 60);
  const minutes = avgMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Get daily sleep summary
export async function getDailySummary(
  userId: string,
  childId: string,
  date: string,
  timezone: string
): Promise<DailySleepSummary> {
  await verifyChildAccess(userId, childId);

  const targetDate = new Date(date);
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);

  const sessions = await getSessionsInRange(childId, dayStart, dayEnd);

  let totalSleepMinutes = 0;
  let napMinutes = 0;
  let nightSleepMinutes = 0;
  let napCount = 0;
  let cryingMinutes = 0;
  const napLengths: number[] = [];
  let firstNapStart: Date | null = null;
  let lastNapEnd: Date | null = null;
  let bedtime: Date | null = null;
  let wakeTime: Date | null = null;

  for (const session of sessions) {
    const sleepMins = session.sleepMinutes ?? 0;
    totalSleepMinutes += sleepMins;

    if (session.cryingMinutes) {
      cryingMinutes += session.cryingMinutes;
    }

    if (session.sessionType === SessionType.NAP) {
      napCount++;
      napMinutes += sleepMins;
      if (sleepMins > 0) {
        napLengths.push(sleepMins);
      }

      if (session.putDownAt && (!firstNapStart || session.putDownAt < firstNapStart)) {
        firstNapStart = session.putDownAt;
      }
      if (session.wokeUpAt && (!lastNapEnd || session.wokeUpAt > lastNapEnd)) {
        lastNapEnd = session.wokeUpAt;
      }
    } else if (session.sessionType === SessionType.NIGHT_SLEEP) {
      nightSleepMinutes += sleepMins;
      if (session.putDownAt) {
        bedtime = session.putDownAt;
      }
      if (session.wokeUpAt) {
        wakeTime = session.wokeUpAt;
      }
    }
  }

  return {
    date,
    totalSleepMinutes,
    napCount,
    napMinutes,
    nightSleepMinutes,
    averageNapLength: napLengths.length > 0
      ? Math.round(napLengths.reduce((a, b) => a + b, 0) / napLengths.length)
      : null,
    longestNap: napLengths.length > 0 ? Math.max(...napLengths) : null,
    shortestNap: napLengths.length > 0 ? Math.min(...napLengths) : null,
    firstNapStart: formatTime(firstNapStart, timezone),
    lastNapEnd: formatTime(lastNapEnd, timezone),
    bedtime: formatTime(bedtime, timezone),
    wakeTime: formatTime(wakeTime, timezone),
    cryingMinutes: cryingMinutes > 0 ? cryingMinutes : null,
  };
}

// Get weekly sleep summary
export async function getWeeklySummary(
  userId: string,
  childId: string,
  weekOf: string,
  timezone: string
): Promise<WeeklySleepSummary> {
  await verifyChildAccess(userId, childId);

  const targetDate = new Date(weekOf);
  const weekStart = startOfWeek(targetDate, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(targetDate, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const dailyBreakdown: DailySleepSummary[] = [];

  let totalSleepSum = 0;
  let napCountSum = 0;
  let napMinutesSum = 0;
  let nightSleepSum = 0;
  const napLengths: number[] = [];
  const bedtimes: Date[] = [];
  const wakeTimes: Date[] = [];
  let daysWithData = 0;

  for (const day of days) {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dailySummary = await getDailySummary(userId, childId, dateStr, timezone);
    dailyBreakdown.push(dailySummary);

    if (dailySummary.totalSleepMinutes > 0) {
      daysWithData++;
      totalSleepSum += dailySummary.totalSleepMinutes;
      napCountSum += dailySummary.napCount;
      napMinutesSum += dailySummary.napMinutes;
      nightSleepSum += dailySummary.nightSleepMinutes;

      if (dailySummary.averageNapLength) {
        napLengths.push(dailySummary.averageNapLength);
      }

      // Parse times back to dates for averaging
      if (dailySummary.bedtime) {
        const parts = dailySummary.bedtime.split(':').map(Number);
        const h = parts[0] ?? 0;
        const m = parts[1] ?? 0;
        const bedtimeDate = new Date(day);
        bedtimeDate.setHours(h, m, 0, 0);
        bedtimes.push(bedtimeDate);
      }

      if (dailySummary.wakeTime) {
        const parts = dailySummary.wakeTime.split(':').map(Number);
        const h = parts[0] ?? 0;
        const m = parts[1] ?? 0;
        const wakeDate = new Date(day);
        wakeDate.setHours(h, m, 0, 0);
        wakeTimes.push(wakeDate);
      }
    }
  }

  return {
    weekStart: format(weekStart, 'yyyy-MM-dd'),
    weekEnd: format(weekEnd, 'yyyy-MM-dd'),
    avgTotalSleepMinutes: daysWithData > 0 ? Math.round(totalSleepSum / daysWithData) : 0,
    avgNapCount: daysWithData > 0 ? Math.round((napCountSum / daysWithData) * 10) / 10 : 0,
    avgNapMinutes: daysWithData > 0 ? Math.round(napMinutesSum / daysWithData) : 0,
    avgNightSleepMinutes: daysWithData > 0 ? Math.round(nightSleepSum / daysWithData) : 0,
    avgNapLength: napLengths.length > 0
      ? Math.round(napLengths.reduce((a, b) => a + b, 0) / napLengths.length)
      : null,
    avgBedtime: calculateAverageTime(bedtimes, timezone),
    avgWakeTime: calculateAverageTime(wakeTimes, timezone),
    daysWithData,
    dailyBreakdown,
  };
}

// Calculate trend direction
function calculateTrendDirection(
  values: number[]
): 'increasing' | 'decreasing' | 'stable' {
  if (values.length < 3) return 'stable';

  // Compare first half average to second half average
  const midpoint = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, midpoint);
  const secondHalf = values.slice(midpoint);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (percentChange > 10) return 'increasing';
  if (percentChange < -10) return 'decreasing';
  return 'stable';
}

// Get sleep trends
export async function getSleepTrends(
  userId: string,
  childId: string,
  period: '7d' | '30d',
  timezone: string
): Promise<SleepTrend> {
  await verifyChildAccess(userId, childId);

  const daysBack = period === '7d' ? 7 : 30;
  const endDate = new Date();
  const startDate = subDays(endDate, daysBack);

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const dataPoints: SleepTrend['dataPoints'] = [];

  let totalSleepSum = 0;
  let napMinutesSum = 0;
  let nightSleepSum = 0;
  let napCountSum = 0;
  let daysWithData = 0;

  const totalSleepValues: number[] = [];
  const napCountValues: number[] = [];
  const napLengthValues: number[] = [];

  for (const day of days) {
    const dateStr = format(day, 'yyyy-MM-dd');
    const summary = await getDailySummary(userId, childId, dateStr, timezone);

    dataPoints.push({
      date: dateStr,
      totalSleepMinutes: summary.totalSleepMinutes,
      napMinutes: summary.napMinutes,
      nightSleepMinutes: summary.nightSleepMinutes,
      napCount: summary.napCount,
    });

    if (summary.totalSleepMinutes > 0) {
      daysWithData++;
      totalSleepSum += summary.totalSleepMinutes;
      napMinutesSum += summary.napMinutes;
      nightSleepSum += summary.nightSleepMinutes;
      napCountSum += summary.napCount;

      totalSleepValues.push(summary.totalSleepMinutes);
      napCountValues.push(summary.napCount);
      if (summary.averageNapLength) {
        napLengthValues.push(summary.averageNapLength);
      }
    }
  }

  return {
    period,
    dataPoints,
    averages: {
      totalSleepMinutes: daysWithData > 0 ? Math.round(totalSleepSum / daysWithData) : 0,
      napMinutes: daysWithData > 0 ? Math.round(napMinutesSum / daysWithData) : 0,
      nightSleepMinutes: daysWithData > 0 ? Math.round(nightSleepSum / daysWithData) : 0,
      napCount: daysWithData > 0 ? Math.round((napCountSum / daysWithData) * 10) / 10 : 0,
    },
    trends: {
      totalSleep: calculateTrendDirection(totalSleepValues),
      napCount: calculateTrendDirection(napCountValues),
      napLength: calculateTrendDirection(napLengthValues),
    },
  };
}

// Generate insights based on data
function generateInsights(
  daily: DailySleepSummary,
  weekly: WeeklySleepSummary,
  sevenDayTrend: SleepTrend,
  thirtyDayTrend: SleepTrend
): string[] {
  const insights: string[] = [];

  // Daily insights
  if (daily.napCount === 0 && daily.date === format(new Date(), 'yyyy-MM-dd')) {
    insights.push('No naps recorded today yet');
  }

  if (daily.shortestNap && daily.shortestNap < 30) {
    insights.push(`Short nap today (${daily.shortestNap} min) - may need earlier bedtime`);
  }

  if (daily.cryingMinutes && daily.cryingMinutes > 30) {
    insights.push(`Extended crying today (${daily.cryingMinutes} min) - consider schedule adjustment`);
  }

  // Weekly comparisons
  if (weekly.avgNapCount > 0) {
    if (daily.napCount > weekly.avgNapCount + 0.5) {
      insights.push('More naps than usual today');
    } else if (daily.napCount < weekly.avgNapCount - 0.5 && daily.napCount > 0) {
      insights.push('Fewer naps than usual today');
    }
  }

  // Trend insights
  if (sevenDayTrend.trends.totalSleep === 'decreasing') {
    insights.push('Total sleep time trending down over the past week');
  } else if (sevenDayTrend.trends.totalSleep === 'increasing') {
    insights.push('Total sleep time improving over the past week');
  }

  if (sevenDayTrend.trends.napCount === 'decreasing') {
    insights.push('Nap count decreasing - may be transitioning to fewer naps');
  }

  if (thirtyDayTrend.trends.napLength === 'increasing') {
    insights.push('Nap lengths have been improving over the past month');
  }

  // Add positive insight if things are stable
  if (insights.length === 0 && weekly.daysWithData >= 5) {
    insights.push('Sleep patterns looking consistent this week');
  }

  return insights;
}

// Get full analytics summary
export async function getAnalyticsSummary(
  userId: string,
  childId: string,
  date: string,
  timezone: string
): Promise<AnalyticsSummary> {
  await verifyChildAccess(userId, childId);

  const [daily, weekly, sevenDay, thirtyDay] = await Promise.all([
    getDailySummary(userId, childId, date, timezone),
    getWeeklySummary(userId, childId, date, timezone),
    getSleepTrends(userId, childId, '7d', timezone),
    getSleepTrends(userId, childId, '30d', timezone),
  ]);

  const insights = generateInsights(daily, weekly, sevenDay, thirtyDay);

  return {
    daily,
    weekly,
    trends: {
      sevenDay,
      thirtyDay,
    },
    insights,
  };
}

// Get comparison between two date ranges
export async function getComparison(
  userId: string,
  childId: string,
  period1Start: string,
  period1End: string,
  period2Start: string,
  period2End: string,
  timezone: string
): Promise<{
  period1: { start: string; end: string; avgTotalSleep: number; avgNapCount: number };
  period2: { start: string; end: string; avgTotalSleep: number; avgNapCount: number };
  changes: {
    totalSleepChange: number;
    totalSleepChangePercent: number;
    napCountChange: number;
  };
}> {
  await verifyChildAccess(userId, childId);

  // Get summaries for both periods
  const p1Days = eachDayOfInterval({
    start: new Date(period1Start),
    end: new Date(period1End)
  });
  const p2Days = eachDayOfInterval({
    start: new Date(period2Start),
    end: new Date(period2End)
  });

  let p1TotalSleep = 0, p1NapCount = 0, p1Count = 0;
  let p2TotalSleep = 0, p2NapCount = 0, p2Count = 0;

  for (const day of p1Days) {
    const summary = await getDailySummary(userId, childId, format(day, 'yyyy-MM-dd'), timezone);
    if (summary.totalSleepMinutes > 0) {
      p1TotalSleep += summary.totalSleepMinutes;
      p1NapCount += summary.napCount;
      p1Count++;
    }
  }

  for (const day of p2Days) {
    const summary = await getDailySummary(userId, childId, format(day, 'yyyy-MM-dd'), timezone);
    if (summary.totalSleepMinutes > 0) {
      p2TotalSleep += summary.totalSleepMinutes;
      p2NapCount += summary.napCount;
      p2Count++;
    }
  }

  const avgP1Sleep = p1Count > 0 ? p1TotalSleep / p1Count : 0;
  const avgP2Sleep = p2Count > 0 ? p2TotalSleep / p2Count : 0;
  const avgP1Naps = p1Count > 0 ? p1NapCount / p1Count : 0;
  const avgP2Naps = p2Count > 0 ? p2NapCount / p2Count : 0;

  const sleepChange = avgP2Sleep - avgP1Sleep;
  const sleepChangePercent = avgP1Sleep > 0 ? (sleepChange / avgP1Sleep) * 100 : 0;

  return {
    period1: {
      start: period1Start,
      end: period1End,
      avgTotalSleep: Math.round(avgP1Sleep),
      avgNapCount: Math.round(avgP1Naps * 10) / 10,
    },
    period2: {
      start: period2Start,
      end: period2End,
      avgTotalSleep: Math.round(avgP2Sleep),
      avgNapCount: Math.round(avgP2Naps * 10) / 10,
    },
    changes: {
      totalSleepChange: Math.round(sleepChange),
      totalSleepChangePercent: Math.round(sleepChangePercent),
      napCountChange: Math.round((avgP2Naps - avgP1Naps) * 10) / 10,
    },
  };
}

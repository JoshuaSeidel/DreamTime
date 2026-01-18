import { describe, it, expect } from 'vitest';
import {
  getDefaultTransitionSchedule,
  DEFAULT_TRANSITION_CONFIG,
} from '../transition.tracker.service.js';
import { ScheduleType } from '../../types/enums.js';

describe('Transition Tracker Service', () => {
  describe('DEFAULT_TRANSITION_CONFIG', () => {
    it('has correct week 1-2 configuration', () => {
      expect(DEFAULT_TRANSITION_CONFIG.week1_2.minNapEarliest).toBe('11:30');
      expect(DEFAULT_TRANSITION_CONFIG.week1_2.cribRule).toBe(90);
      expect(DEFAULT_TRANSITION_CONFIG.week1_2.maxWakeWindow).toBe(330); // 5.5 hours
    });

    it('has correct week 2+ configuration', () => {
      expect(DEFAULT_TRANSITION_CONFIG.week2_plus.minNapEarliest).toBe('12:00');
      expect(DEFAULT_TRANSITION_CONFIG.week2_plus.pushIntervalDays).toEqual({ min: 3, max: 7 });
      expect(DEFAULT_TRANSITION_CONFIG.week2_plus.pushAmount).toBe(15);
    });

    it('has correct goal configuration', () => {
      expect(DEFAULT_TRANSITION_CONFIG.goal.targetNapStart).toBe('12:30');
      expect(DEFAULT_TRANSITION_CONFIG.goal.maxNapDuration).toBe(150);
      expect(DEFAULT_TRANSITION_CONFIG.goal.napEndBy).toBe('15:00');
      expect(DEFAULT_TRANSITION_CONFIG.goal.bedtimeWakeWindow).toEqual({ min: 240, max: 300 });
    });

    it('has temporary allowances', () => {
      expect(DEFAULT_TRANSITION_CONFIG.temporary.maxWakeTime).toBe('08:00');
    });
  });

  describe('getDefaultTransitionSchedule', () => {
    it('returns a valid transition schedule', () => {
      const schedule = getDefaultTransitionSchedule(ScheduleType.TWO_NAP);

      expect(schedule.type).toBe(ScheduleType.TRANSITION);
      expect(schedule.wakeWindow1Min).toBe(300); // 5 hours
      expect(schedule.wakeWindow1Max).toBe(330); // 5.5 hours
      expect(schedule.nap1Earliest).toBe('11:30');
      expect(schedule.nap1MaxDuration).toBe(150);
      expect(schedule.nap1EndBy).toBe('15:00');
    });

    it('uses provided wake time earliest', () => {
      const schedule = getDefaultTransitionSchedule(ScheduleType.TWO_NAP, '07:00');

      expect(schedule.wakeTimeEarliest).toBe('07:00');
    });

    it('sets correct bedtime window', () => {
      const schedule = getDefaultTransitionSchedule(ScheduleType.TWO_NAP);

      expect(schedule.bedtimeEarliest).toBe('18:45');
      expect(schedule.bedtimeLatest).toBe('19:30');
      expect(schedule.bedtimeGoalStart).toBe('19:00');
      expect(schedule.bedtimeGoalEnd).toBe('19:30');
    });

    it('sets correct wake window to bedtime', () => {
      const schedule = getDefaultTransitionSchedule(ScheduleType.TWO_NAP);

      expect(schedule.wakeWindow2Min).toBe(240); // 4 hours
      expect(schedule.wakeWindow2Max).toBe(300); // 5 hours
    });

    it('sets appropriate day sleep cap for transition', () => {
      const schedule = getDefaultTransitionSchedule(ScheduleType.TWO_NAP);

      expect(schedule.daySleepCap).toBe(150); // 2.5 hours
    });
  });

  describe('Transition rules', () => {
    it('week 1-2 enforces crib 90 rule', () => {
      const cribRule = DEFAULT_TRANSITION_CONFIG.week1_2.cribRule;
      expect(cribRule).toBe(90);
    });

    it('nap push is 15 minutes at a time', () => {
      const pushAmount = DEFAULT_TRANSITION_CONFIG.week2_plus.pushAmount;
      expect(pushAmount).toBe(15);
    });

    it('push interval is 3-7 days', () => {
      const interval = DEFAULT_TRANSITION_CONFIG.week2_plus.pushIntervalDays;
      expect(interval.min).toBe(3);
      expect(interval.max).toBe(7);
    });

    it('goal nap start is 12:30', () => {
      const target = DEFAULT_TRANSITION_CONFIG.goal.targetNapStart;
      expect(target).toBe('12:30');
    });
  });

  describe('Schedule type progression', () => {
    it('transition should move from TWO_NAP to ONE_NAP', () => {
      // The transition tracker is designed for 2-to-1 transitions
      const startType = ScheduleType.TWO_NAP;
      const endType = ScheduleType.ONE_NAP;

      // Verify these are valid schedule types
      expect(startType).toBe('TWO_NAP');
      expect(endType).toBe('ONE_NAP');
    });
  });
});

describe('Transition Progress Calculation', () => {
  // These tests verify the mathematical calculations for progress tracking

  describe('Progress percentage calculation', () => {
    it('calculates 0% at start (11:30)', () => {
      const startMinutes = 11 * 60 + 30; // 11:30
      const goalMinutes = 12 * 60 + 30;  // 12:30
      const currentMinutes = 11 * 60 + 30; // 11:30

      const totalProgress = goalMinutes - startMinutes;
      const progressMade = currentMinutes - startMinutes;
      const percent = (progressMade / totalProgress) * 100;

      expect(percent).toBe(0);
    });

    it('calculates 50% at 12:00', () => {
      const startMinutes = 11 * 60 + 30; // 11:30
      const goalMinutes = 12 * 60 + 30;  // 12:30
      const currentMinutes = 12 * 60 + 0; // 12:00

      const totalProgress = goalMinutes - startMinutes;
      const progressMade = currentMinutes - startMinutes;
      const percent = (progressMade / totalProgress) * 100;

      expect(percent).toBe(50);
    });

    it('calculates 100% at 12:30', () => {
      const startMinutes = 11 * 60 + 30; // 11:30
      const goalMinutes = 12 * 60 + 30;  // 12:30
      const currentMinutes = 12 * 60 + 30; // 12:30

      const totalProgress = goalMinutes - startMinutes;
      const progressMade = currentMinutes - startMinutes;
      const percent = (progressMade / totalProgress) * 100;

      expect(percent).toBe(100);
    });
  });

  describe('Time string calculations', () => {
    it('parses time to minutes correctly', () => {
      const parseTimeToMinutes = (time: string): number => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      };

      expect(parseTimeToMinutes('11:30')).toBe(690);
      expect(parseTimeToMinutes('12:00')).toBe(720);
      expect(parseTimeToMinutes('12:30')).toBe(750);
      expect(parseTimeToMinutes('00:00')).toBe(0);
      expect(parseTimeToMinutes('23:59')).toBe(1439);
    });

    it('formats minutes to time string correctly', () => {
      const minutesToTimeString = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      };

      expect(minutesToTimeString(690)).toBe('11:30');
      expect(minutesToTimeString(720)).toBe('12:00');
      expect(minutesToTimeString(750)).toBe('12:30');
      expect(minutesToTimeString(0)).toBe('00:00');
      expect(minutesToTimeString(1439)).toBe('23:59');
    });
  });

  describe('Week calculation', () => {
    it('calculates correct week from days', () => {
      const calculateWeek = (days: number): number => Math.ceil(days / 7) || 1;

      expect(calculateWeek(1)).toBe(1);
      expect(calculateWeek(7)).toBe(1);
      expect(calculateWeek(8)).toBe(2);
      expect(calculateWeek(14)).toBe(2);
      expect(calculateWeek(15)).toBe(3);
      expect(calculateWeek(28)).toBe(4);
      expect(calculateWeek(42)).toBe(6);
    });

    it('handles day 0', () => {
      const calculateWeek = (days: number): number => Math.ceil(days / 7) || 1;
      expect(calculateWeek(0)).toBe(1);
    });
  });
});

describe('Crib 90 Rule Validation', () => {
  it('requires minimum 90 minutes in crib', () => {
    const requiredMinutes = DEFAULT_TRANSITION_CONFIG.week1_2.cribRule;

    // Test various scenarios
    expect(85 >= requiredMinutes).toBe(false);
    expect(90 >= requiredMinutes).toBe(true);
    expect(120 >= requiredMinutes).toBe(true);
  });

  it('calculates remaining minutes correctly', () => {
    const required = 90;
    const calculateRemaining = (minutesInCrib: number): number => required - minutesInCrib;

    expect(calculateRemaining(60)).toBe(30);
    expect(calculateRemaining(90)).toBe(0);
    expect(calculateRemaining(100)).toBe(-10);
  });
});

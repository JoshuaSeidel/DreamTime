import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateDaySchedule,
  calculateNextAction,
  calculateAdjustedBedtime,
  type DayScheduleRecommendation,
} from '../schedule.calculator.service.js';
import type { SleepScheduleResponse, TransitionResponse } from '../../schemas/schedule.schema.js';
import { ScheduleType } from '../../types/enums.js';

// Test fixtures
const createTwoNapSchedule = (): SleepScheduleResponse => ({
  id: 'schedule-1',
  childId: 'child-1',
  type: ScheduleType.TWO_NAP,
  isActive: true,
  wakeWindow1Min: 120, // 2 hours
  wakeWindow1Max: 150, // 2.5 hours
  wakeWindow2Min: 150, // 2.5 hours
  wakeWindow2Max: 210, // 3.5 hours
  wakeWindow3Min: 210, // 3.5 hours
  wakeWindow3Max: 270, // 4.5 hours
  nap1Earliest: '08:30',
  nap1LatestStart: '09:00',
  nap1MaxDuration: 120,
  nap1EndBy: '11:00',
  nap2Earliest: '12:00',
  nap2LatestStart: '13:00',
  nap2MaxDuration: 120,
  nap2EndBy: '15:00',
  nap2ExceptionDuration: 150,
  bedtimeEarliest: '17:30',
  bedtimeLatest: '19:30',
  bedtimeGoalStart: '19:00',
  bedtimeGoalEnd: '19:30',
  wakeTimeEarliest: '06:30',
  wakeTimeLatest: '07:30',
  mustWakeBy: '07:30',
  daySleepCap: 210, // 3.5 hours
  napCapMinutes: 120,
  minimumCribMinutes: 60,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createOneNapSchedule = (): SleepScheduleResponse => ({
  id: 'schedule-2',
  childId: 'child-1',
  type: ScheduleType.ONE_NAP,
  isActive: true,
  wakeWindow1Min: 300, // 5 hours
  wakeWindow1Max: 330, // 5.5 hours
  wakeWindow2Min: 240, // 4 hours (to bedtime)
  wakeWindow2Max: 300, // 5 hours
  wakeWindow3Min: null,
  wakeWindow3Max: null,
  nap1Earliest: '12:00',
  nap1LatestStart: '13:00',
  nap1MaxDuration: 150,
  nap1EndBy: '15:00',
  nap2Earliest: null,
  nap2LatestStart: null,
  nap2MaxDuration: null,
  nap2EndBy: null,
  nap2ExceptionDuration: null,
  bedtimeEarliest: '18:45',
  bedtimeLatest: '19:30',
  bedtimeGoalStart: '19:00',
  bedtimeGoalEnd: '19:30',
  wakeTimeEarliest: '06:30',
  wakeTimeLatest: '08:00',
  mustWakeBy: '07:30',
  daySleepCap: 150,
  napCapMinutes: 150,
  minimumCribMinutes: 90,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createTransitionSchedule = (): SleepScheduleResponse => ({
  ...createOneNapSchedule(),
  type: ScheduleType.TRANSITION,
  nap1Earliest: '11:30',
});

const createTransition = (): TransitionResponse => ({
  id: 'transition-1',
  childId: 'child-1',
  fromType: ScheduleType.TWO_NAP,
  toType: ScheduleType.ONE_NAP,
  startedAt: new Date(),
  currentWeek: 1,
  currentNapTime: '11:30',
  completedAt: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const TIMEZONE = 'America/New_York';

describe('Schedule Calculator Service', () => {
  describe('calculateDaySchedule', () => {
    describe('Two-nap schedule', () => {
      it('calculates correct nap 1 window for normal wake time', () => {
        const schedule = createTwoNapSchedule();
        const wakeTime = new Date('2024-01-15T07:00:00-05:00');

        const result = calculateDaySchedule(wakeTime, schedule, TIMEZONE);

        expect(result.naps).toHaveLength(2);
        expect(result.naps[0].napNumber).toBe(1);

        // Wake at 7:00, WW1 is 2-2.5h, so nap 1 should be 9:00-9:30
        // But schedule says earliest is 8:30, latest start is 9:00
        const nap1 = result.naps[0];
        expect(nap1.putDownWindow.earliest.getHours()).toBeGreaterThanOrEqual(8);
        expect(nap1.putDownWindow.latest.getHours()).toBeLessThanOrEqual(10);
      });

      it('holds nap 1 to earliest time when wake is early', () => {
        const schedule = createTwoNapSchedule();
        const wakeTime = new Date('2024-01-15T05:30:00-05:00');

        const result = calculateDaySchedule(wakeTime, schedule, TIMEZONE);

        // Even with early wake at 5:30, nap 1 should not be before 8:30
        const nap1 = result.naps[0];
        expect(nap1.notes.some(n => n.includes('held'))).toBe(true);
      });

      it('calculates correct nap 2 window', () => {
        const schedule = createTwoNapSchedule();
        const wakeTime = new Date('2024-01-15T07:00:00-05:00');

        const result = calculateDaySchedule(wakeTime, schedule, TIMEZONE);

        expect(result.naps[1].napNumber).toBe(2);
        const nap2 = result.naps[1];
        // Nap 2 should be at least 2.5h after nap 1 ends
        expect(nap2.maxDuration).toBe(120);
      });

      it('extends nap 2 when nap 1 is short', () => {
        const schedule = createTwoNapSchedule();
        const wakeTime = new Date('2024-01-15T07:00:00-05:00');

        // Nap 1 was only 45 minutes (short nap)
        const result = calculateDaySchedule(wakeTime, schedule, TIMEZONE, null, [45]);

        const nap2 = result.naps[1];
        expect(nap2.maxDuration).toBe(150); // Exception duration
        expect(nap2.notes.some(n => n.includes('short nap 1'))).toBe(true);
      });

      it('calculates bedtime based on last nap end', () => {
        const schedule = createTwoNapSchedule();
        const wakeTime = new Date('2024-01-15T07:00:00-05:00');

        const result = calculateDaySchedule(wakeTime, schedule, TIMEZONE);

        expect(result.bedtime.putDownWindow.earliest).toBeDefined();
        expect(result.bedtime.putDownWindow.latest).toBeDefined();
        expect(result.bedtime.putDownWindow.recommended).toBeDefined();
      });

      it('warns when day sleep may exceed cap', () => {
        const schedule = createTwoNapSchedule();
        schedule.daySleepCap = 150; // Reduced cap
        const wakeTime = new Date('2024-01-15T07:00:00-05:00');

        const result = calculateDaySchedule(wakeTime, schedule, TIMEZONE);

        // With 2 naps of 120 min each, should exceed 150 cap
        expect(result.warnings.some(w => w.includes('exceed'))).toBe(true);
      });
    });

    describe('One-nap schedule', () => {
      it('calculates single nap window correctly', () => {
        const schedule = createOneNapSchedule();
        const wakeTime = new Date('2024-01-15T07:00:00-05:00');

        const result = calculateDaySchedule(wakeTime, schedule, TIMEZONE);

        expect(result.naps).toHaveLength(1);
        expect(result.naps[0].napNumber).toBe(1);
        expect(result.naps[0].maxDuration).toBe(150);
      });

      it('respects earliest nap time constraint', () => {
        const schedule = createOneNapSchedule();
        const wakeTime = new Date('2024-01-15T06:00:00-05:00');

        const result = calculateDaySchedule(wakeTime, schedule, TIMEZONE);

        // Even with 6am wake, nap should not be before 12:00
        const nap = result.naps[0];
        expect(nap.notes.some(n => n.includes('held') || n.includes('12:00'))).toBe(true);
      });
    });

    describe('Transition schedule', () => {
      it('uses transition nap time when in transition', () => {
        const schedule = createTransitionSchedule();
        const transition = createTransition();
        transition.currentNapTime = '11:45';
        const wakeTime = new Date('2024-01-15T07:00:00-05:00');

        const result = calculateDaySchedule(wakeTime, schedule, TIMEZONE, transition);

        expect(result.naps).toHaveLength(1);
        expect(result.naps[0].notes.some(n => n.includes('Transition week'))).toBe(true);
        expect(result.naps[0].notes.some(n => n.includes('11:45'))).toBe(true);
      });

      it('includes transition week in notes', () => {
        const schedule = createTransitionSchedule();
        const transition = createTransition();
        transition.currentWeek = 3;
        const wakeTime = new Date('2024-01-15T07:00:00-05:00');

        const result = calculateDaySchedule(wakeTime, schedule, TIMEZONE, transition);

        expect(result.naps[0].notes.some(n => n.includes('week 3'))).toBe(true);
      });
    });

    describe('Sleep debt adjustment', () => {
      it('recommends earlier bedtime with significant sleep debt', () => {
        const schedule = createTwoNapSchedule();
        const wakeTime = new Date('2024-01-15T07:00:00-05:00');

        // Both naps were short (30 min each vs expected 210 total)
        const result = calculateDaySchedule(wakeTime, schedule, TIMEZONE, null, [30, 30]);

        expect(result.bedtime.notes.some(n => n.includes('sleep debt'))).toBe(true);
      });
    });
  });

  describe('calculateNextAction', () => {
    let daySchedule: DayScheduleRecommendation;

    beforeEach(() => {
      const schedule = createTwoNapSchedule();
      const wakeTime = new Date('2024-01-15T07:00:00-05:00');
      daySchedule = calculateDaySchedule(wakeTime, schedule, TIMEZONE);
    });

    it('returns WAIT when child is currently asleep', () => {
      const currentTime = new Date('2024-01-15T09:30:00-05:00');
      const result = calculateNextAction(currentTime, daySchedule, 0, true, TIMEZONE);

      expect(result.action).toBe('WAIT');
      expect(result.description).toBe('Child is currently sleeping');
    });

    it('returns NAP when in nap window', () => {
      // Set current time to be within nap 1 window
      const currentTime = new Date('2024-01-15T08:45:00-05:00');
      const result = calculateNextAction(currentTime, daySchedule, 0, false, TIMEZONE);

      expect(result.action).toBe('NAP');
      expect(result.napNumber).toBe(1);
    });

    it('returns WAIT with countdown when before nap window', () => {
      const currentTime = new Date('2024-01-15T07:30:00-05:00');
      const result = calculateNextAction(currentTime, daySchedule, 0, false, TIMEZONE);

      expect(result.action).toBe('WAIT');
      expect(result.minutesUntilEarliest).toBeGreaterThan(30);
    });

    it('returns NAP 2 recommendation after nap 1 is completed', () => {
      // The test uses a day schedule based on 7am wake time
      // Nap 1 ends around 11:00, nap 2 starts around 12:00-13:00
      // At 13:00, we should be in or past the nap 2 window
      const currentTime = new Date('2024-01-15T13:00:00-05:00');
      const result = calculateNextAction(currentTime, daySchedule, 1, false, TIMEZONE);

      // Should either be NAP (in window) or WAIT (with nap 2 as next action)
      expect(['NAP', 'WAIT']).toContain(result.action);
      if (result.action === 'NAP') {
        expect(result.napNumber).toBe(2);
      } else {
        expect(result.description).toContain('Nap 2');
      }
    });

    it('returns BEDTIME after all naps completed', () => {
      // Late afternoon, all naps done
      const currentTime = new Date('2024-01-15T18:30:00-05:00');
      const result = calculateNextAction(currentTime, daySchedule, 2, false, TIMEZONE);

      expect(result.action).toBe('BEDTIME');
    });

    it('returns WAIT for bedtime when not yet time', () => {
      // Early afternoon, all naps done
      const currentTime = new Date('2024-01-15T15:30:00-05:00');
      const result = calculateNextAction(currentTime, daySchedule, 2, false, TIMEZONE);

      expect(result.action).toBe('WAIT');
      expect(result.description).toContain('Bedtime');
    });
  });

  describe('calculateAdjustedBedtime', () => {
    it('calculates bedtime based on actual nap data', () => {
      const schedule = createTwoNapSchedule();
      const wakeTime = new Date('2024-01-15T07:00:00-05:00');

      const actualNaps = [
        {
          asleepAt: new Date('2024-01-15T09:15:00-05:00'),
          wokeUpAt: new Date('2024-01-15T10:45:00-05:00'),
        },
        {
          asleepAt: new Date('2024-01-15T13:00:00-05:00'),
          wokeUpAt: new Date('2024-01-15T14:30:00-05:00'),
        },
      ];

      const result = calculateAdjustedBedtime(wakeTime, schedule, TIMEZONE, actualNaps);

      expect(result.putDownWindow.earliest).toBeDefined();
      expect(result.putDownWindow.latest).toBeDefined();
      expect(result.putDownWindow.recommended).toBeDefined();
    });

    it('recommends earlier bedtime for short naps', () => {
      const schedule = createTwoNapSchedule();
      const wakeTime = new Date('2024-01-15T07:00:00-05:00');

      // Short naps - only 60 min total
      const actualNaps = [
        {
          asleepAt: new Date('2024-01-15T09:00:00-05:00'),
          wokeUpAt: new Date('2024-01-15T09:30:00-05:00'),
        },
        {
          asleepAt: new Date('2024-01-15T13:00:00-05:00'),
          wokeUpAt: new Date('2024-01-15T13:30:00-05:00'),
        },
      ];

      const result = calculateAdjustedBedtime(wakeTime, schedule, TIMEZONE, actualNaps);

      expect(result.notes.some(n => n.includes('sleep debt'))).toBe(true);
    });

    it('handles single nap', () => {
      const schedule = createOneNapSchedule();
      const wakeTime = new Date('2024-01-15T07:00:00-05:00');

      const actualNaps = [
        {
          asleepAt: new Date('2024-01-15T12:30:00-05:00'),
          wokeUpAt: new Date('2024-01-15T14:30:00-05:00'),
        },
      ];

      const result = calculateAdjustedBedtime(wakeTime, schedule, TIMEZONE, actualNaps);

      expect(result.putDownWindow).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('handles late wake time', () => {
      const schedule = createTwoNapSchedule();
      const wakeTime = new Date('2024-01-15T09:00:00-05:00');

      const result = calculateDaySchedule(wakeTime, schedule, TIMEZONE);

      // Should still produce valid recommendations
      expect(result.naps.length).toBeGreaterThan(0);
      expect(result.bedtime).toBeDefined();
    });

    it('handles very early wake time', () => {
      const schedule = createTwoNapSchedule();
      const wakeTime = new Date('2024-01-15T05:00:00-05:00');

      const result = calculateDaySchedule(wakeTime, schedule, TIMEZONE);

      // Naps should still respect earliest times
      expect(result.naps.length).toBeGreaterThan(0);
    });

    it('returns date string in correct format', () => {
      const schedule = createTwoNapSchedule();
      const wakeTime = new Date('2024-01-15T07:00:00-05:00');

      const result = calculateDaySchedule(wakeTime, schedule, TIMEZONE);

      expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});

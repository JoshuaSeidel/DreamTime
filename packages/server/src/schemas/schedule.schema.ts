import { z } from 'zod';
import { ScheduleType } from '../types/enums.js';

// Time format HH:mm
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const timeSchema = z.string().regex(timeRegex, 'Time must be in HH:mm format');

export const createScheduleSchema = z.object({
  type: z.enum([
    ScheduleType.THREE_NAP,
    ScheduleType.TWO_NAP,
    ScheduleType.ONE_NAP,
    ScheduleType.TRANSITION,
  ] as const),

  // Wake windows (in minutes)
  wakeWindow1Min: z.number().int().min(30).max(480),
  wakeWindow1Max: z.number().int().min(30).max(480),
  wakeWindow2Min: z.number().int().min(30).max(480).optional(),
  wakeWindow2Max: z.number().int().min(30).max(480).optional(),
  wakeWindow3Min: z.number().int().min(30).max(480).optional(),
  wakeWindow3Max: z.number().int().min(30).max(480).optional(),

  // Nap 1 constraints
  nap1Earliest: timeSchema.optional(),
  nap1LatestStart: timeSchema.optional(),
  nap1MaxDuration: z.number().int().min(15).max(240).optional(),
  nap1EndBy: timeSchema.optional(),

  // Nap 2 constraints
  nap2Earliest: timeSchema.optional(),
  nap2LatestStart: timeSchema.optional(),
  nap2MaxDuration: z.number().int().min(15).max(240).optional(),
  nap2EndBy: timeSchema.optional(),
  nap2ExceptionDuration: z.number().int().min(15).max(240).optional(),

  // Bedtime constraints
  bedtimeEarliest: timeSchema,
  bedtimeLatest: timeSchema,
  bedtimeGoalStart: timeSchema.optional(),
  bedtimeGoalEnd: timeSchema.optional(),

  // Wake time constraints
  wakeTimeEarliest: timeSchema,
  wakeTimeLatest: timeSchema,

  // Sleep caps
  daySleepCap: z.number().int().min(0).max(720),

  // Crib time settings (for naps only - not applicable to bedtime)
  minimumCribMinutes: z.number().int().min(30).max(180).default(60),

  // Notification settings (lead time in minutes before event)
  napReminderMinutes: z.number().int().min(5).max(120).default(30),
  bedtimeReminderMinutes: z.number().int().min(5).max(120).default(30),
  wakeDeadlineReminderMinutes: z.number().int().min(5).max(60).default(15),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;

export const updateScheduleSchema = createScheduleSchema.partial().required({
  type: true,
});

export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;

// Transition schema
export const startTransitionSchema = z.object({
  fromType: z.enum([ScheduleType.TWO_NAP] as const),
  toType: z.enum([ScheduleType.ONE_NAP] as const),
  startNapTime: timeSchema, // Initial target single nap time
});

export type StartTransitionInput = z.infer<typeof startTransitionSchema>;

export const progressTransitionSchema = z.object({
  newNapTime: timeSchema.optional(), // Push nap time later
  currentWeek: z.number().int().min(1).max(12).optional(),
  notes: z.string().max(500).optional(),
  complete: z.boolean().optional(),
});

export type ProgressTransitionInput = z.infer<typeof progressTransitionSchema>;

// Response types
export interface SleepScheduleResponse {
  id: string;
  childId: string;
  type: string;
  isActive: boolean;

  wakeWindow1Min: number;
  wakeWindow1Max: number;
  wakeWindow2Min: number | null;
  wakeWindow2Max: number | null;
  wakeWindow3Min: number | null;
  wakeWindow3Max: number | null;

  nap1Earliest: string | null;
  nap1LatestStart: string | null;
  nap1MaxDuration: number | null;
  nap1EndBy: string | null;

  nap2Earliest: string | null;
  nap2LatestStart: string | null;
  nap2MaxDuration: number | null;
  nap2EndBy: string | null;
  nap2ExceptionDuration: number | null;

  bedtimeEarliest: string;
  bedtimeLatest: string;
  bedtimeGoalStart: string | null;
  bedtimeGoalEnd: string | null;

  wakeTimeEarliest: string;
  wakeTimeLatest: string;
  mustWakeBy: string;

  daySleepCap: number;
  napCapMinutes: number;

  minimumCribMinutes: number;

  // Notification settings
  napReminderMinutes: number;
  bedtimeReminderMinutes: number;
  wakeDeadlineReminderMinutes: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface TransitionResponse {
  id: string;
  childId: string;
  fromType: string;
  toType: string;
  startedAt: Date;
  currentWeek: number;
  currentNapTime: string;
  completedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

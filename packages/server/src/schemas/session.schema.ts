import { z } from 'zod';
import { SessionType, SessionState, NapLocation } from '../types/enums.js';

export const createSessionSchema = z.object({
  sessionType: z.enum([SessionType.NAP, SessionType.NIGHT_SLEEP] as const),
  napNumber: z.number().int().min(1).max(3).optional(),
  putDownAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const updateSessionSchema = z.object({
  // State transition events
  event: z.enum(['fell_asleep', 'woke_up', 'out_of_crib']).optional(),

  // Direct field updates (for corrections)
  putDownAt: z.string().datetime().optional(),
  asleepAt: z.string().datetime().optional(),
  wokeUpAt: z.string().datetime().optional(),
  outOfCribAt: z.string().datetime().optional(),

  cryingMinutes: z.number().int().min(0).max(180).optional(),
  notes: z.string().max(500).optional(),
});

export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

export const listSessionsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sessionType: z.enum([SessionType.NAP, SessionType.NIGHT_SLEEP] as const).optional(),
  state: z.enum([
    SessionState.PENDING,
    SessionState.ASLEEP,
    SessionState.AWAKE,
    SessionState.COMPLETED,
  ] as const).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;

// Schema for creating ad-hoc naps (car, stroller, etc.) - logged after they happen
export const createAdHocSessionSchema = z.object({
  location: z.enum([
    NapLocation.CAR,
    NapLocation.STROLLER,
    NapLocation.CARRIER,
    NapLocation.SWING,
    NapLocation.PLAYPEN,
    NapLocation.OTHER,
  ] as const),
  asleepAt: z.string().datetime(),
  wokeUpAt: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

export type CreateAdHocSessionInput = z.infer<typeof createAdHocSessionSchema>;

export interface SleepSessionResponse {
  id: string;
  childId: string;
  sessionType: string;
  state: string;
  napNumber: number | null;

  // Ad-hoc nap fields
  isAdHoc: boolean;
  location: string;

  putDownAt: Date | null;
  asleepAt: Date | null;
  wokeUpAt: Date | null;
  outOfCribAt: Date | null;

  cryingMinutes: number | null;
  notes: string | null;

  // Duration calculations
  totalMinutes: number | null;      // Total time in crib (putDown to outOfCrib)
  sleepMinutes: number | null;      // Actual sleep time (asleep to wokeUp)
  settlingMinutes: number | null;   // Time to fall asleep (putDown to asleep)
  postWakeMinutes: number | null;   // Time awake in crib after waking (wokeUp to outOfCrib)
  awakeCribMinutes: number | null;  // Total awake time in crib (settling + postWake)
  qualifiedRestMinutes: number | null; // For crib: (awakeCribTime ÷ 2) + sleepMinutes
                                       // For ad-hoc: <15min = 0, else sleepMinutes ÷ 2

  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedSessions {
  sessions: SleepSessionResponse[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

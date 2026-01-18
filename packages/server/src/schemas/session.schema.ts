import { z } from 'zod';
import { SessionType, SessionState } from '../types/enums.js';

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

export interface SleepSessionResponse {
  id: string;
  childId: string;
  sessionType: string;
  state: string;
  napNumber: number | null;

  putDownAt: Date | null;
  asleepAt: Date | null;
  wokeUpAt: Date | null;
  outOfCribAt: Date | null;

  cryingMinutes: number | null;
  notes: string | null;

  totalMinutes: number | null;
  sleepMinutes: number | null;

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

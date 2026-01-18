import { z } from 'zod';
import { Role, InviteStatus } from '../types/enums.js';

export const createChildSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Birth date must be in YYYY-MM-DD format')
    .transform((str) => new Date(str)),
  photoUrl: z.string().url().optional(),
});

export type CreateChildInput = z.input<typeof createChildSchema>;

export const updateChildSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Birth date must be in YYYY-MM-DD format')
    .transform((str) => new Date(str))
    .optional(),
  photoUrl: z.string().url().nullable().optional(),
});

export type UpdateChildInput = z.input<typeof updateChildSchema>;

export const shareChildSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum([Role.CAREGIVER, Role.VIEWER] as const).default(Role.CAREGIVER),
});

export type ShareChildInput = z.infer<typeof shareChildSchema>;

export interface ChildWithRole {
  id: string;
  name: string;
  birthDate: Date;
  photoUrl: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChildDetail extends ChildWithRole {
  caregivers: CaregiverInfo[];
}

export interface CaregiverInfo {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  status: string;
  invitedAt: Date;
  acceptedAt: Date | null;
}

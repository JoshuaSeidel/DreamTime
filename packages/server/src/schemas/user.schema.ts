import { z } from 'zod';

// Timezone validation - basic check for common format
const timezoneRegex = /^[A-Za-z]+\/[A-Za-z_]+$/;

export const updateUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  timezone: z
    .string()
    .regex(timezoneRegex, 'Invalid timezone format (e.g., America/New_York)')
    .optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * @fileoverview Defines the Zod schema and TypeScript type for an attendance request.
 * This is used to validate the input for the attendance-related AI flows.
 */

import { z } from 'zod';

export const AttendanceRequestSchema = z.object({
  attended: z.number().describe('The number of periods the user has attended.'),
  total: z.number().describe('The total number of periods that have occurred.'),
  requiredPercentage: z.number().describe('The minimum required attendance percentage.'),
});

export type AttendanceRequest = z.infer<typeof AttendanceRequestSchema>;

    
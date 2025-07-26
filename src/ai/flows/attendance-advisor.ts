// src/ai/flows/attendance-advisor.ts
'use server';

/**
 * @fileOverview AI-powered attendance advisor flow.
 *
 * This file defines a Genkit flow that provides personalized attendance
 * recommendations, including suggestions for balancing study and well-being.
 *
 * - attendanceAdvisor - A function that provides attendance advice.
 * - AttendanceAdvisorInput - The input type for the attendanceAdvisor function.
 * - AttendanceAdvisorOutput - The return type for the attendanceAdvisor function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AttendanceAdvisorInputSchema = z.object({
  attendedPeriods: z.number().describe('The number of periods the student has attended.'),
  totalPeriods: z.number().describe('The total number of periods so far.'),
  startDate: z.string().describe('The start date of the attendance period (YYYY-MM-DD).'),
  endDate: z.string().describe('The end date of the attendance period (YYYY-MM-DD).'),
});
export type AttendanceAdvisorInput = z.infer<typeof AttendanceAdvisorInputSchema>;

const AttendanceAdvisorOutputSchema = z.object({
  recommendation: z.string().describe('Personalized recommendation on how many periods to attend in the future.'),
});
export type AttendanceAdvisorOutput = z.infer<typeof AttendanceAdvisorOutputSchema>;

export async function attendanceAdvisor(input: AttendanceAdvisorInput): Promise<AttendanceAdvisorOutput> {
  return attendanceAdvisorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'attendanceAdvisorPrompt',
  input: {schema: AttendanceAdvisorInputSchema},
  output: {schema: AttendanceAdvisorOutputSchema},
  prompt: `You are an AI attendance advisor for university students. Your goal is to provide personalized recommendations on how many periods to attend in the future, including suggestions for balancing study and well-being.

  Current Attendance:
  - Attended Periods: {{attendedPeriods}}
  - Total Periods: {{totalPeriods}}
  - Start Date: {{startDate}}
  - End Date: {{endDate}}

  Based on this information, provide a recommendation to the student. Consider suggesting a well-being activity (e.g., taking a break, exercising) only if it will not reduce attendance below 75%. Be concise and encouraging.

  Recommendation:`,
});

const attendanceAdvisorFlow = ai.defineFlow(
  {
    name: 'attendanceAdvisorFlow',
    inputSchema: AttendanceAdvisorInputSchema,
    outputSchema: AttendanceAdvisorOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

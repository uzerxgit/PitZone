
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
  prompt: `You are an AI attendance advisor for university students. Your goal is to provide personalized, actionable, and encouraging recommendations.

  Current Attendance Details:
  - Attended Periods: {{attendedPeriods}}
  - Total Periods: {{totalPeriods}}
  - Start Date: {{startDate}}
  - End Date: {{endDate}}

  Based on this information, provide a recommendation to the student.
  - If attendance is already low (below 75%), provide a clear, encouraging plan to improve it. Suggest how many classes they need to attend consecutively to get back on track.
  - If attendance is high, suggest how many periods they can miss while staying above 75%. You can also recommend a well-being activity (e.g., taking a break, exercising) if they have a comfortable buffer.
  - Always be concise, positive, and motivating.

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

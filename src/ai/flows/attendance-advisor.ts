
'use server';
/**
 * @fileOverview An AI flow for providing attendance advice.
 *
 * This file defines a Genkit flow that takes a user's attendance data
 * and provides personalized advice on how to manage their attendance.
 *
 * - getAttendanceAdvice - The main function that provides the advice.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { AttendanceRequest, AttendanceRequestSchema } from '@/ai/schemas/attendance-request';


const attendanceAdvisorFlow = ai.defineFlow(
  {
    name: 'attendanceAdvisorFlow',
    inputSchema: AttendanceRequestSchema,
    outputSchema: z.string(),
  },
  async (request) => {
    const prompt = `You are an intelligent and friendly AI assistant for an attendance calculator application. Your goal is to provide personalized, actionable advice to a user based on their current attendance.

    Current Situation:
    - Periods Attended: ${request.attended}
    - Total Periods: ${request.total}
    - Required Attendance Percentage: ${request.requiredPercentage}%

    Your Task:
    Analyze the user's situation and provide a clear, concise, and helpful recommendation.

    - If the user's attendance is below the required percentage:
      - Calculate the current percentage.
      - Determine how many periods they are short of the target.
      - Provide an encouraging and actionable plan to help them improve. Be specific. For example: "You are currently at X%. To reach the required ${request.requiredPercentage}%, you need to attend the next Y periods without fail."
    
    - If the user's attendance is comfortably above the required percentage:
      - Calculate how many periods they can afford to miss (their "buffer").
      - Let them know exactly how many periods they can miss.
      - If they have a significant buffer (e.g., more than 10 periods), suggest a well-being activity they could do with a day off, like "Your attendance is looking great! You can miss up to X periods. Maybe it's a good time to take a day for that hobby you love."

    - If the user's attendance is just at or slightly above the required percentage:
      - Congratulate them on being on track.
      - Advise them to be cautious and mention how many periods they can miss (if any).
      
    Keep the tone friendly, supportive, and slightly informal. Use bold markdown for key numbers and percentages to make them stand out.
    `;
    
    const llmResponse = await ai.generate({
      prompt,
      model: 'googleai/gemini-pro',
      config: {
        temperature: 0.5,
      },
    });
    
    return llmResponse.text;
  }
);

export async function getAttendanceAdvice(request: AttendanceRequest): Promise<string> {
    return await attendanceAdvisorFlow(request);
}

    
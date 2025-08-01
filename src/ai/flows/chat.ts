
'use server';
/**
 * @fileOverview A conversational AI flow for the attendance calculator chatbot.
 *
 * This file defines a Genkit flow that powers a chatbot to answer user questions
 * about their attendance, the app's features, and related topics.
 *
 * - chat - The main function that handles the conversational exchange.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const chatFlow = ai.defineFlow(
  {
    name: 'chatFlow',
    inputSchema: z.object({
        question: z.string(),
        context: z.string(),
    }),
    outputSchema: z.string(),
  },
  async ({question, context}) => {
    const prompt = `You are an intelligent and friendly AI assistant for an attendance calculator application called "AttendWell". Your goal is to help users understand their attendance and the app's features.

    Here is the user's current situation:
    ${context}

    The user has asked the following question: "${question}"

    Please provide a clear, concise, and helpful response. Be conversational and encouraging.
    - If the user asks about a feature (like "Leave Simulation" or "Project Future"), explain how it works in simple terms.
    - If the user asks for advice based on their attendance, use the provided context to give a relevant and actionable recommendation.
    - If the question is unclear, ask for clarification.
    - Do not make up features that don't exist. The main features are: Attendance Calculation, Leave Simulation (Apply Leave vs. Project Future), and Customization of periods/percentage.
    - Keep the tone friendly and supportive.
    - If the user's attendance is below the required percentage, provide an encouraging and actionable plan to help them improve.
    - If the user's attendance is high, let them know how many periods they can miss. If they have a comfortable buffer, suggest a well-being activity (e.g., "take a day off for a hobby you enjoy!").
    `;
    
    const llmResponse = await ai.generate({
      prompt,
      model: 'googleai/gemini-pro',
      config: {
        temperature: 0.5,
      },
    });
    
    return llmResponse.text();
  }
);


export async function chat(question: string, context: string): Promise<string> {
    return await chatFlow({question, context});
}

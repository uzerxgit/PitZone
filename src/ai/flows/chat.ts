
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

// No specific schema is needed for input/output as it's a free-form chat.

export async function chat(question: string, context: string): Promise<string> {
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
        const prompt = `You are an intelligent and friendly AI assistant for an attendance calculator application called "PitZone". Your goal is to help users understand their attendance and the app's features.

        Here is the user's current situation:
        ${context}

        The user has asked the following question: "${question}"

        Please provide a clear, concise, and helpful response. Be conversational and encouraging.
        - If the user asks about a feature (like "Leave Simulation" or "Project Future"), explain how it works in simple terms.
        - If the user asks for advice based on their attendance, use the provided context to give a relevant and actionable recommendation.
        - If the question is unclear, ask for clarification.
        - Do not make up features that don't exist. The main features are: Attendance Calculation, Leave Simulation (Apply Leave vs. Project Future), and Customization of periods/percentage.
        - Keep the tone friendly and supportive.
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

    const response = await chatFlow({question, context});
    return response;
}

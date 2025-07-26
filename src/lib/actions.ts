
'use server';

import { attendanceAdvisor, AttendanceAdvisorInput } from "@/ai/flows/attendance-advisor";

export async function getAttendanceAdvice(input: AttendanceAdvisorInput): Promise<string> {
    try {
        const result = await attendanceAdvisor(input);
        return result.recommendation;
    } catch (error) {
        console.error("Error getting AI attendance advice:", error);
        return "Sorry, I couldn't generate advice at this moment. Please try again later.";
    }
}

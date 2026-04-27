/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Resource, Task, AllocationReport } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
 
export async function generateAllocation(resources: Resource[], tasks: Task[]): Promise<AllocationReport> {
  const models = ["gemini-3-flash-preview", "gemini-3.1-pro-preview", "gemini-2.0-flash"];
  let lastError: any = null;

  for (const modelName of models) {
    try {
      const prompt = `
        As an expert resource manager, analyze the following lists of resources and tasks.
        Assign the best resource to each task based on skills, availability, and priority.
        
        Resources: ${JSON.stringify(resources)}
        Tasks: ${JSON.stringify(tasks)}
        
        Rules:
        1. Match skills.
        2. Prioritize high priority.
        3. Efficiency score must be between 0 and 1 (decimal).
        4. Provide 3 specific AI suggestions for future optimization (e.g., hiring needs, training, or workflow shifts).
      `;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              allocations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: { type: Type.STRING },
                    resourceId: { type: Type.STRING },
                    reasoning: { type: Type.STRING },
                    confidence: { type: Type.NUMBER }
                  },
                  required: ["taskId", "resourceId", "reasoning", "confidence"]
                }
              },
              summary: { type: Type.STRING },
              efficiencyScore: { type: Type.NUMBER },
              aiSuggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["allocations", "summary", "efficiencyScore", "aiSuggestions"]
          }
        }
      });

      const jsonStr = response.text?.trim();
      if (!jsonStr) {
        throw new Error("No response from Gemini");
      }
      return JSON.parse(jsonStr) as AllocationReport;
    } catch (error: any) {
      lastError = error;
      const isQuota = error.message?.includes('429') || 
                      error.message?.toLowerCase().includes('quota') || 
                      error.status === 429 ||
                      error.status === 503 ||
                      error.message?.toLowerCase().includes('demand') ||
                      error.message?.toLowerCase().includes('overloaded');
      
      if (isQuota) {
        console.warn(`Model ${modelName} hit quota/load limits. Trying next model...`);
        continue; // Try next model
      }
      // If it's not a quota error, stop and report
      break;
    }
  }

  // If we get here, all models failed
  console.error("Gemini AI API Error (All Models Failed):", {
    message: lastError?.message,
    status: lastError?.status,
    details: lastError?.details
  });
  throw lastError;
}

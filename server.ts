import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: isProduction ? "production" : "development" });
  });

  app.post("/api/analyze", async (req, res) => {
    const { resources, tasks } = req.body;

    if (!resources || !tasks) {
      return res.status(400).json({ error: "Resources and tasks are required" });
    }

    const models = ["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview", "gemini-3.1-pro-preview", "gemini-2.0-flash"];
    let lastError: any = null;

    for (const modelName of models) {
      console.log(`Attempting allocation with model: ${modelName}`);
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
          4. Provide 3 specific AI suggestions for future optimization.
          
          Return the result strictly as JSON according to the specified schema.
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

        const jsonStr = response.text;
        if (!jsonStr) {
          throw new Error("Empty response from model");
        }
        
        const data = JSON.parse(jsonStr.trim());
        return res.json(data);
      } catch (error: any) {
        lastError = error;
        const errorMessage = error.message?.toLowerCase() || '';
        const status = error.status || error.code || 0;
        
        console.warn(`Error during ${modelName} call:`, { status, errorMessage });

        const isTransient = 
          status === 429 || 
          status === 503 || 
          status === 500 ||
          status === 504 ||
          errorMessage.includes('429') || 
          errorMessage.includes('quota') || 
          errorMessage.includes('demand') ||
          errorMessage.includes('overloaded') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('server error') ||
          errorMessage.includes('busy') ||
          error.name === 'SyntaxError';
        
        if (isTransient) {
          console.warn(`Model ${modelName} hit transient error. Trying next model in 1.5s...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          continue; 
        }
        
        console.error(`Permanent error with ${modelName}:`, error);
        break; 
      }
    }

    const finalError = lastError || new Error("Failed to generate allocation after retries");
    return res.status(500).json({ 
      error: finalError.message || "Internal Server Error",
      details: finalError.details || null,
      status: finalError.status || finalError.code || 500
    });
  });

  // Vite middleware for development
  if (!isProduction) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: process.cwd(),
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    console.log(`Production mode: Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

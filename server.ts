import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini Setup (Server-side)
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  // API Route for AI Allocation
  app.post("/api/allocate", async (req, res) => {
    const { resources, tasks } = req.body;

    if (!resources || !tasks) {
      return res.status(400).json({ error: "Missing data" });
    }

    const prompt = `
      As an expert resource manager, analyze the following lists of resources and tasks.
      Assign the best resource to each task based on skills, availability, and priority.
      
      Resources: ${JSON.stringify(resources)}
      Tasks: ${JSON.stringify(tasks)}
      
      Rules:
      1. Match skills.
      2. Prioritize high priority.
      3. Efficiency score must be between 0 and 1 (decimal).
    `;

    try {
      const result = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
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
              efficiencyScore: { type: Type.NUMBER }
            },
            required: ["allocations", "summary", "efficiencyScore"]
          }
        }
      });

      const responseText = result.text;
      if (!responseText) {
        throw new Error("No response text from Gemini");
      }
      res.json(JSON.parse(responseText));
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "AI allocation failed" });
    }
  });

  // Vite middleware or static serving
  console.log(`Mode: ${isProduction ? "production" : "development"}`);
  
  if (isProduction) {
    // When bundled into dist/server.js, __dirname is dist/
    const distPath = __dirname;
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

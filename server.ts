import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini Setup
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
      
      Return JSON:
      {
        "allocations": [{ "taskId": "string", "resourceId": "string", "reasoning": "string", "confidence": number }],
        "summary": "string",
        "efficiencyScore": number
      }
    `;

    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              allocations: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    taskId: { type: SchemaType.STRING },
                    resourceId: { type: SchemaType.STRING },
                    reasoning: { type: SchemaType.STRING },
                    confidence: { type: SchemaType.NUMBER }
                  },
                  required: ["taskId", "resourceId", "reasoning", "confidence"]
                }
              },
              summary: { type: SchemaType.STRING },
              efficiencyScore: { type: SchemaType.NUMBER }
            },
            required: ["allocations", "summary", "efficiencyScore"]
          }
        }
      });

      res.json(JSON.parse(result.response.text()));
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "AI allocation failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
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

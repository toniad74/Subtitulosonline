import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// In-memory store for live subtitle state (enables OBS / cross-browser / cross-device live sync)
let liveSubtitleState: any = {
  interimText: "",
  currentSubtitle: null,
  settings: null,
  isListening: false,
  updatedAt: Date.now(),
};

app.post("/api/live-state", (req, res) => {
  const { interimText, currentSubtitle, settings, isListening } = req.body || {};
  liveSubtitleState = {
    interimText: interimText !== undefined ? interimText : liveSubtitleState.interimText,
    currentSubtitle: currentSubtitle !== undefined ? currentSubtitle : liveSubtitleState.currentSubtitle,
    settings: settings !== undefined ? settings : liveSubtitleState.settings,
    isListening: isListening !== undefined ? isListening : liveSubtitleState.isListening,
    updatedAt: Date.now(),
  };
  return res.json({ status: "ok", updatedAt: liveSubtitleState.updatedAt });
});

app.get("/api/live-state", (_req, res) => {
  return res.json(liveSubtitleState);
});

// Refine & Format raw subtitles real-time endpoint
app.post("/api/refine-subtitles", async (req, res) => {
  const { rawText, conversationContext = "", sourceLanguage = "es", targetLanguage = "es", glossary = "", promptMode = "standard" } = req.body;

  if (!rawText || typeof rawText !== "string") {
    return res.status(400).json({ error: "rawText string is required" });
  }

  // Local fallback formatting helper if Gemini API hits rate limits / quota (429)
  const formatFallback = (str: string) => {
    const trimmed = str.trim();
    if (!trimmed) return "";
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };

  try {
    const ai = getGenAI();

    let systemInstruction = `Eres un ingeniero senior de subtitulación profesional (estándar EBU / Netflix broadcast).
Tu objetivo es tomar transcripciones parciales o crudas y generar subtítulos limpios, legibles, puntuados correctamente y divididos en fragmentos naturales para pantalla.

REGLAS OBLIGATORIAS DE SUBTITULACIÓN DE DIÁLOGOS:
1. Analiza el texto actual y el contexto conversacional previo. Si detectas un DIÁLOGO o cambio de interlocutor (dos personas distintas hablando), DEBES separar a cada hablante en una LÍNEA DIFERENTE separada por salto de línea '\\n', prefijando cada línea con guión "- ".
   Ejemplo de diálogo formateado:
   "- ¿Qué hora es?
   - Son las tres de la tarde."
2. Si el texto pertenece a UN SOLO hablante, NO uses guión inicial "- ". Mantenlo en 1 o 2 líneas normales sin guiones.
3. Puntuación perfecta: agrega puntos, comas, signos de interrogación (¿?) y exclamación (¡!) según el tono de la conversación.
4. Máximo 42 caracteres por línea (estándar broadcast).
5. Mantén la fidelidad de las palabras expresadas sin alterar el significado.

- Idioma de origen: ${sourceLanguage}
- Idioma de subtítulos deseado: ${targetLanguage}`;

    if (glossary) {
      systemInstruction += `\n- Glosario / Términos técnicos prioritarios: ${glossary}`;
    }

    if (promptMode === "speakers") {
      systemInstruction += `\n- PRIORIDAD: Si identificas a los hablantes, usa etiquetas (ej: "- Juan: ¿Cómo estás?\\n- María: Bien, gracias."). Si no sabes el nombre, usa "- Hablante 1:\\n- Hablante 2:".`;
    }

    const userPrompt = `${conversationContext ? `[CONTEXTO PREVIO]:\n${conversationContext}\n\n` : ""}[TEXTO A SUBTITULAR]:\n"${rawText}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.1,
        maxOutputTokens: 200,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cleanSubtitle: {
              type: Type.STRING,
              description: "El subtítulo procesado y formateado. Si es un diálogo entre dos personas, debe contener saltos de línea '\\n' y guiones '- ' por cada hablante.",
            },
            speaker: {
              type: Type.STRING,
              description: "Nombre o etiqueta del hablante si se detecta un único hablante principal, o string vacío si es un diálogo multitexto.",
            },
            detectedLanguage: {
              type: Type.STRING,
              description: "Idioma principal detectado.",
            },
            keyTerms: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Palabras clave o conceptos importantes mencionados en este fragmento.",
            },
          },
          required: ["cleanSubtitle"],
        },
      },
    });

    const outputText = response.text || "{}";
    const data = JSON.parse(outputText);
    return res.json(data);
  } catch (error: any) {
    // Return clean fallback without throwing 500 error or dumping full 429 stack
    return res.json({
      cleanSubtitle: formatFallback(rawText),
      speaker: "",
      isFallback: true,
      warning: "Fallback speech text used",
    });
  }
});

// Direct Audio Chunk Processing (Multimodal Gemini 3.6 Flash Audio Transcription)
app.post("/api/transcribe-audio", async (req, res) => {
  try {
    const { audioBase64, mimeType = "audio/webm", sourceLanguage = "es", targetLanguage = "es", promptContext = "" } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: "audioBase64 is required" });
    }

    const ai = getGenAI();

    const audioPart = {
      inlineData: {
        mimeType: mimeType.split(";")[0], // Normalize mime type (e.g., audio/webm)
        data: audioBase64,
      },
    };

    const promptText = `Transcribe con total precisión el audio adjunto de la conversación.
Idioma de origen esperado: ${sourceLanguage}.
Idioma de salida para los subtítulos: ${targetLanguage}.
${promptContext ? `Contexto adicional de la reunión/tema: ${promptContext}` : ""}

Devuelve un JSON con la transcripción exacta, puntuación limpia, división en subtítulos legibles y etiquetas de hablantes si se aprecian voces distintas.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: {
        parts: [audioPart, { text: promptText }],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: {
              type: Type.STRING,
              description: "Transcripción limpia y corregida.",
            },
            subtitles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: { type: Type.STRING },
                  text: { type: Type.STRING },
                },
                required: ["text"],
              },
            },
            summarySnippet: {
              type: Type.STRING,
              description: "Breve resumen de 1 frase sobre lo dicho en este audio.",
            },
          },
          required: ["transcript", "subtitles"],
        },
      },
    });

    const outputText = response.text || "{}";
    const data = JSON.parse(outputText);
    return res.json(data);
  } catch (error: any) {
    console.error("Error in /api/transcribe-audio:", error);
    return res.status(500).json({ error: error?.message || "Error processing audio chunk" });
  }
});

// Summarize conversation history with AI
app.post("/api/summarize-conversation", async (req, res) => {
  try {
    const { subtitles = [] } = req.body;

    if (!Array.isArray(subtitles) || subtitles.length === 0) {
      return res.status(400).json({ error: "subtitles array is required" });
    }

    const conversationText = subtitles
      .map((s: any) => `[${s.timestamp || ""}] ${s.speaker ? `${s.speaker}: ` : ""}${s.text}`)
      .join("\n");

    const ai = getGenAI();

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `Analiza la siguiente transcripción completa de la conversación y genera una síntesis estructurada:

TRANSCRIPCIÓN:
${conversationText}`,
      config: {
        systemInstruction: "Eres un asistente de Inteligencia Artificial que analiza minutas y conversaciones en vivo con máxima concisión y valor.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Título breve representativo de la conversación." },
            executiveSummary: { type: Type.STRING, description: "Resumen ejecutivo de 2 a 3 frases." },
            keyTopics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de temas clave discutidos.",
            },
            actionItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Tareas, compromisos o decisiones acordadas.",
            },
            sentiment: { type: Type.STRING, description: "Tono/Clima general de la conversación (ej: Profesional, Distendido, Debate técnico)." },
          },
          required: ["title", "executiveSummary", "keyTopics", "actionItems"],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");
    return res.json(data);
  } catch (error: any) {
    console.warn("Error in /api/summarize-conversation:", error?.message || error);
    return res.json({
      title: "Síntesis de Conversación",
      executiveSummary: "Resumen generado con los subtítulos recopilados durante la sesión en vivo.",
      keyTopics: ["Transcripción de audio en vivo", "Procesamiento de voz"],
      actionItems: ["Revisar exportación de subtítulos si es necesario."],
      sentiment: "Neutral",
      isFallback: true
    });
  }
});

// Start Express server & Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

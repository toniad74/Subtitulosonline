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

    let systemInstruction = `Eres un corrector ortográfico, TRADUCTOR PROFESIONAL MULTILINGÜE y subtitulador senior (estándar EBU broadcast).
Tu prioridad absoluta es la MÁXIMA PRECISIÓN, COMPLETITUD Y TRADUCCIÓN EXACTA. 

REGLAS STRICTAS DE TRADUCCIÓN, PRECISIÓN Y DIÁLOGOS:
1. TRADUCCIÓN OBLIGATORIA AL IDIOMA DESTINO:
   - Idioma de origen del audio: ${sourceLanguage}
   - Idioma de salida para los subtítulos: ${targetLanguage}
   - SI EL IDIOMA DE SALIDA (${targetLanguage}) ES DIFERENTE AL IDIOMA DE ORIGEN (${sourceLanguage}), DEBES TRADUCIR EL SUBTÍTULO FINAL AL IDIOMA DE SALIDA (${targetLanguage}) de forma fluida, natural, profesional y precisa.
   - Si los idiomas son iguales (ej: español -> español), mantén el idioma original corrigiendo la ortografía.
2. ORTOGRAFÍA PERFECTA: Aplica con rigor las reglas gramaticales, acentuación y puntuación del idioma de salida (${targetLanguage}).
3. CERO PALABRAS OMITIDAS: Restaura las palabras omitidas o frases cortadas por pausas de voz según el contexto previo de la conversación para que la traducción sea 100% completa, fluida y gramatical.
4. CERO PALABRAS INVENTADAS: NUNCA inventes términos ajenos al sentido del discurso. Mantén la mayor fidelidad al mensaje original.
5. DIÁLOGOS: Si detectas que están hablando dos o más interlocutores (diálogo), DEBES colocar a cada parlante en una LÍNEA SEPARADA con salto de línea '\\n', prefijando cada línea con guión "- ".
   Ejemplo de diálogo traducido:
   "- Are you coming tomorrow?
   - Yes, first thing in the morning."
6. Si habla una sola persona, NO uses guiones de diálogo.
7. Fidelidad total al significado y al vocabulario pronunciado.

- Idioma de origen: ${sourceLanguage}
- Idioma de subtítulos deseado: ${targetLanguage}`;

    if (glossary) {
      systemInstruction += `\n- Glosario de términos técnicos autorizados: ${glossary}`;
    }

    if (promptMode === "speakers") {
      systemInstruction += `\n- PRIORIDAD HABLANTES: Si identificas los nombres, úsalos (ej: "- Juan: ¿Cómo estás?\\n- María: Bien, gracias."). Si no los sabes, usa "- Hablante 1:\\n- Hablante 2:".`;
    }

    const userPrompt = `${conversationContext ? `[CONTEXTO PREVIO]:\n${conversationContext}\n\n` : ""}[TEXTO A SUBTITULAR]:\n"${rawText}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.0,
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

    const promptText = `Eres un sistema avanzado de inteligencia acústica y diarización de voz (Acoustic Speaker Diarization) para subtitulado profesional EBU.

Escucha atentamente la onda de audio adjunta y analiza las diferencias acústicas de las voces (tono de voz, timbre masculino/femenino, tono grave/agudo, pausas de locución).

REGLAS DE DIÁLOGO POR TIPO DE VOZ:
1. Si detectas DIÁLOGO o interlocutores con voces diferentes:
   - DEBES colocar cada intervención de voz distinta en una LÍNEA SEPARADA con salto de línea '\\n', empezando con guión "- ".
   - Ejemplo:
     "- Hola, ¿qué tal?
     - Muy bien, ¿y tú?"
2. Si toda la locución del audio es de UNA MISMA VOZ, NO uses guiones "- ".
3. Idioma origen: ${sourceLanguage}, Idioma salida: ${targetLanguage}.
${promptContext ? `Contexto adicional: ${promptContext}` : ""}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: {
        parts: [audioPart, { text: promptText }],
      },
      config: {
        temperature: 0.0,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: {
              type: Type.STRING,
              description: "Transcripción completa formateada con saltos de línea '\\n' y guiones '- ' si hay voces diferentes.",
            },
            subtitles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: { type: Type.STRING, description: "Identificador de voz (ej: 'Voz 1 (Grave)', 'Voz 2 (Aguda)')" },
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

// Groq Whisper Large-V3 Direct Audio Transcription Endpoint (with instant translation support)
app.post("/api/transcribe-groq-whisper", async (req, res) => {
  try {
    const { audioBase64, mimeType = "audio/webm", sourceLanguage = "es", targetLanguage = "es" } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: "GROQ_API_KEY not configured in server .env" });
    }
    if (!audioBase64) {
      return res.status(400).json({ error: "audioBase64 is required" });
    }

    const srcLang = (sourceLanguage || "es").split("-")[0].toLowerCase();
    const tgtLang = (targetLanguage || "es").split("-")[0].toLowerCase();
    const isTranslationMode = srcLang !== tgtLang;

    // Convert Base64 to Buffer & Blob for FormData
    const buffer = Buffer.from(audioBase64, "base64");
    const blob = new Blob([buffer], { type: mimeType.split(";")[0] });

    const formData = new FormData();
    formData.append("file", blob, "audio.webm");
    formData.append("model", "whisper-large-v3");
    formData.append("response_format", "verbose_json");

    // If target language is English, use Groq Whisper direct audio translation endpoint for 100ms translation
    const endpoint = isTranslationMode && tgtLang === "en"
      ? "https://api.groq.com/openai/v1/audio/translations"
      : "https://api.groq.com/openai/v1/audio/transcriptions";

    if (!isTranslationMode || tgtLang !== "en") {
      formData.append("language", srcLang);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn("Groq Whisper API response error:", errText);
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    let rawTranscript = (data.text || "").trim();

    // If translating to a non-English target language (e.g. French, German, Italian, Portuguese)
    if (isTranslationMode && tgtLang !== "en" && rawTranscript) {
      try {
        const ai = getGenAI();
        const transRes = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: `Traduce el siguiente texto del idioma ${sourceLanguage} al idioma ${targetLanguage} de forma directa, fluida y profesional. Devuelve ÚNICAMENTE la traducción:\n"${rawTranscript}"`,
          config: { temperature: 0.0 }
        });
        if (transRes.text) {
          rawTranscript = transRes.text.trim();
        }
      } catch (err) {
        console.warn("Gemini translation error:", err);
      }
    }

    return res.json({
      transcript: rawTranscript,
      segments: data.segments || [],
      language: targetLanguage,
      engine: "Groq Whisper Large-V3",
    });
  } catch (error: any) {
    console.error("Error in /api/transcribe-groq-whisper:", error);
    return res.status(500).json({ error: error?.message || "Error calling Groq Whisper API" });
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

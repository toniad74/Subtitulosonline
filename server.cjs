var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_url = require("url");
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_meta = {};
import_dotenv.default.config();
var __filename = (0, import_url.fileURLToPath)(import_meta.url);
var __dirname = import_path.default.dirname(__filename);
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "50mb" }));
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }
  return new import_genai.GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
});
var liveSubtitleState = {
  interimText: "",
  currentSubtitle: null,
  settings: null,
  isListening: false,
  updatedAt: Date.now()
};
app.post("/api/live-state", (req, res) => {
  const { interimText, currentSubtitle, settings, isListening } = req.body || {};
  liveSubtitleState = {
    interimText: interimText !== void 0 ? interimText : liveSubtitleState.interimText,
    currentSubtitle: currentSubtitle !== void 0 ? currentSubtitle : liveSubtitleState.currentSubtitle,
    settings: settings !== void 0 ? settings : liveSubtitleState.settings,
    isListening: isListening !== void 0 ? isListening : liveSubtitleState.isListening,
    updatedAt: Date.now()
  };
  return res.json({ status: "ok", updatedAt: liveSubtitleState.updatedAt });
});
app.get("/api/live-state", (_req, res) => {
  return res.json(liveSubtitleState);
});
app.post("/api/refine-subtitles", async (req, res) => {
  const { rawText, sourceLanguage = "es", targetLanguage = "es", glossary = "", promptMode = "standard" } = req.body;
  if (!rawText || typeof rawText !== "string") {
    return res.status(400).json({ error: "rawText string is required" });
  }
  const formatFallback = (str) => {
    const trimmed = str.trim();
    if (!trimmed) return "";
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };
  try {
    const ai = getGenAI();
    let systemInstruction = `Eres un sistema experto en subtitulado e inteligencia conversacional en tiempo real.
Tu objetivo es tomar transcripciones parciales o crudas de una conversaci\xF3n y generar subt\xEDtulos limpios, legibles, puntuados correctamente y divididos en fragmentos naturales para pantalla.
- Idioma de origen: ${sourceLanguage}
- Idioma de subt\xEDtulos deseado: ${targetLanguage}`;
    if (glossary) {
      systemInstruction += `
- Glosario / T\xE9rminos t\xE9cnicos prioritarios: ${glossary}`;
    }
    if (promptMode === "speakers") {
      systemInstruction += `
- Identifica y etiqueta a los hablantes si detectas cambio de interlocutor o contexto (ej: "Hablante 1:", "Hablante 2:").`;
    }
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `Procesa el siguiente texto transcribible y genera los subt\xEDtulos optimizados:
"${rawText}"`,
      config: {
        systemInstruction,
        temperature: 0.1,
        maxOutputTokens: 150,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            cleanSubtitle: {
              type: import_genai.Type.STRING,
              description: "El subt\xEDtulo procesado, limpio, traducido (si aplica) y puntuado."
            },
            speaker: {
              type: import_genai.Type.STRING,
              description: "Nombre o etiqueta del hablante si se detecta (ej: 'Hablante 1', 'Persona A'), o string vac\xEDo si no."
            },
            detectedLanguage: {
              type: import_genai.Type.STRING,
              description: "Idioma principal detectado."
            },
            keyTerms: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING },
              description: "Palabras clave o conceptos importantes mencionados en este fragmento."
            }
          },
          required: ["cleanSubtitle"]
        }
      }
    });
    const outputText = response.text || "{}";
    const data = JSON.parse(outputText);
    return res.json(data);
  } catch (error) {
    return res.json({
      cleanSubtitle: formatFallback(rawText),
      speaker: "",
      isFallback: true,
      warning: "Fallback speech text used"
    });
  }
});
app.post("/api/transcribe-audio", async (req, res) => {
  try {
    const { audioBase64, mimeType = "audio/webm", sourceLanguage = "es", targetLanguage = "es", promptContext = "" } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: "audioBase64 is required" });
    }
    const ai = getGenAI();
    const audioPart = {
      inlineData: {
        mimeType: mimeType.split(";")[0],
        // Normalize mime type (e.g., audio/webm)
        data: audioBase64
      }
    };
    const promptText = `Transcribe con total precisi\xF3n el audio adjunto de la conversaci\xF3n.
Idioma de origen esperado: ${sourceLanguage}.
Idioma de salida para los subt\xEDtulos: ${targetLanguage}.
${promptContext ? `Contexto adicional de la reuni\xF3n/tema: ${promptContext}` : ""}

Devuelve un JSON con la transcripci\xF3n exacta, puntuaci\xF3n limpia, divisi\xF3n en subt\xEDtulos legibles y etiquetas de hablantes si se aprecian voces distintas.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: {
        parts: [audioPart, { text: promptText }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            transcript: {
              type: import_genai.Type.STRING,
              description: "Transcripci\xF3n limpia y corregida."
            },
            subtitles: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  speaker: { type: import_genai.Type.STRING },
                  text: { type: import_genai.Type.STRING }
                },
                required: ["text"]
              }
            },
            summarySnippet: {
              type: import_genai.Type.STRING,
              description: "Breve resumen de 1 frase sobre lo dicho en este audio."
            }
          },
          required: ["transcript", "subtitles"]
        }
      }
    });
    const outputText = response.text || "{}";
    const data = JSON.parse(outputText);
    return res.json(data);
  } catch (error) {
    console.error("Error in /api/transcribe-audio:", error);
    return res.status(500).json({ error: error?.message || "Error processing audio chunk" });
  }
});
app.post("/api/summarize-conversation", async (req, res) => {
  try {
    const { subtitles = [] } = req.body;
    if (!Array.isArray(subtitles) || subtitles.length === 0) {
      return res.status(400).json({ error: "subtitles array is required" });
    }
    const conversationText = subtitles.map((s) => `[${s.timestamp || ""}] ${s.speaker ? `${s.speaker}: ` : ""}${s.text}`).join("\n");
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `Analiza la siguiente transcripci\xF3n completa de la conversaci\xF3n y genera una s\xEDntesis estructurada:

TRANSCRIPCI\xD3N:
${conversationText}`,
      config: {
        systemInstruction: "Eres un asistente de Inteligencia Artificial que analiza minutas y conversaciones en vivo con m\xE1xima concisi\xF3n y valor.",
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            title: { type: import_genai.Type.STRING, description: "T\xEDtulo breve representativo de la conversaci\xF3n." },
            executiveSummary: { type: import_genai.Type.STRING, description: "Resumen ejecutivo de 2 a 3 frases." },
            keyTopics: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING },
              description: "Lista de temas clave discutidos."
            },
            actionItems: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING },
              description: "Tareas, compromisos o decisiones acordadas."
            },
            sentiment: { type: import_genai.Type.STRING, description: "Tono/Clima general de la conversaci\xF3n (ej: Profesional, Distendido, Debate t\xE9cnico)." }
          },
          required: ["title", "executiveSummary", "keyTopics", "actionItems"]
        }
      }
    });
    const data = JSON.parse(response.text || "{}");
    return res.json(data);
  } catch (error) {
    console.warn("Error in /api/summarize-conversation:", error?.message || error);
    return res.json({
      title: "S\xEDntesis de Conversaci\xF3n",
      executiveSummary: "Resumen generado con los subt\xEDtulos recopilados durante la sesi\xF3n en vivo.",
      keyTopics: ["Transcripci\xF3n de audio en vivo", "Procesamiento de voz"],
      actionItems: ["Revisar exportaci\xF3n de subt\xEDtulos si es necesario."],
      sentiment: "Neutral",
      isFallback: true
    });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map

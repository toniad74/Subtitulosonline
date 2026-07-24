/**
 * Client-side Gemini API wrapper for multimodal audio transcription.
 * This runs entirely in the browser — no backend server needed.
 * The API key is stored in localStorage and never leaves the user's machine.
 */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/** Get stored API key from localStorage */
export function getGeminiApiKey(): string | null {
  return localStorage.getItem("gemini_api_key");
}

/** Save API key to localStorage */
export function setGeminiApiKey(key: string) {
  localStorage.setItem("gemini_api_key", key.trim());
}

/** Check if API key is configured */
export function hasGeminiApiKey(): boolean {
  const key = getGeminiApiKey();
  return !!key && key.length > 10;
}

/**
 * Transcribe audio using Gemini multimodal API directly from browser.
 * Sends audio as inline base64 data and receives structured transcription.
 */
export async function transcribeAudioWithGemini(
  audioBase64: string,
  mimeType: string = "audio/webm",
  sourceLanguage: string = "es",
  targetLanguage: string = "es",
  glossary: string = ""
): Promise<{ transcript: string; speaker?: string } | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const systemPrompt = `Eres un transcriptor de audio profesional de subtitulado broadcast (estándar EBU/Netflix).
Transcribe EXACTAMENTE lo que se dice en el audio adjunto con ortografía perfecta RAE.

REGLAS:
1. Ortografía perfecta. Tildes, signos ¿? ¡! correctos.
2. Si hay diálogo (voces diferentes), separa con salto de línea y guión "- " cada hablante.
3. Si es una sola voz, NO uses guiones.
4. NO inventes palabras. Si no se entiende algo, omítelo.
5. Si el audio está en silencio o no hay voz, responde con un string vacío.
${glossary ? `6. Glosario: ${glossary}` : ""}
Idioma: ${sourceLanguage} → ${targetLanguage}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType.split(";")[0],
                  data: audioBase64,
                },
              },
              {
                text: systemPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.0,
          maxOutputTokens: 300,
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.warn("Gemini API error:", response.status, errBody);
      return null;
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    // Skip empty or silence responses
    if (!text || text === '""' || text === "''") return null;

    return { transcript: text };
  } catch (err) {
    console.warn("Gemini client transcription error:", err);
    return null;
  }
}

/**
 * Client-side AI Service — calls Gemini & Groq APIs directly from the browser.
 * No server required. Works on GitHub Pages and any static hosting.
 */

// ─── Gemini API (Refinement + Translation) ───

interface GeminiRefineResult {
  cleanSubtitle: string;
  speaker?: string;
  detectedLanguage?: string;
  keyTerms?: string[];
  isFallback?: boolean;
}

export async function refineWithGemini(
  apiKey: string,
  rawText: string,
  sourceLanguage: string,
  targetLanguage: string,
  conversationContext: string = "",
  glossary: string = "",
  showSpeakers: boolean = false
): Promise<GeminiRefineResult> {
  if (!apiKey || !rawText.trim()) {
    return { cleanSubtitle: rawText.trim(), isFallback: true };
  }

  const srcLang = (sourceLanguage || "es").split("-")[0].toLowerCase();
  const tgtLang = (targetLanguage || "es").split("-")[0].toLowerCase();
  const isTranslation = srcLang !== tgtLang;

  let systemInstruction = `You are a professional multilingual translator and broadcast subtitle editor (EBU standard).

STRICT RULES:
1. MANDATORY TRANSLATION: Source language = ${sourceLanguage}, Target language = ${targetLanguage}.
   ${isTranslation ? `You MUST translate the subtitle into ${targetLanguage}. NEVER return text in ${sourceLanguage}.` : `Keep the original language, correcting grammar and spelling.`}
2. PERFECT GRAMMAR: Apply strict grammar, accents, and punctuation rules for ${targetLanguage}.
3. ZERO OMITTED WORDS: Restore any words cut off by speech pauses using conversation context.
4. ZERO INVENTED WORDS: Never invent terms outside the meaning of the discourse.
5. DIALOGUE: If multiple speakers, place each on a separate line with "- " prefix and "\\n" line breaks.
6. Single speaker: do NOT use dialogue dashes.`;

  if (glossary) {
    systemInstruction += `\nAuthorized glossary: ${glossary}`;
  }
  if (showSpeakers) {
    systemInstruction += `\nIdentify speakers by name if possible, otherwise use "Speaker 1", "Speaker 2".`;
  }

  let userPrompt = conversationContext ? `[PREVIOUS CONTEXT]:\n${conversationContext}\n\n` : "";
  if (isTranslation) {
    userPrompt += `[INSTRUCTION]: TRANSLATE the following text from ${sourceLanguage} to ${targetLanguage}. Return ONLY the translation in ${targetLanguage}.\n\n`;
  }
  userPrompt += `[TEXT TO SUBTITLE]:\n"${rawText}"`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 300,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                cleanSubtitle: {
                  type: "STRING",
                  description: `The final subtitle. ${isTranslation ? `MUST be translated into ${targetLanguage}. NEVER return ${sourceLanguage} text.` : "Corrected and formatted."}`,
                },
                speaker: { type: "STRING", description: "Speaker label or empty." },
                detectedLanguage: { type: "STRING", description: "Detected source language." },
              },
              required: ["cleanSubtitle"],
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[clientAI/Gemini] HTTP ${response.status}:`, errText);
      return { cleanSubtitle: rawText.trim(), isFallback: true };
    }

    const json = await response.json();
    const textContent = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      console.warn("[clientAI/Gemini] Empty response from Gemini");
      return { cleanSubtitle: rawText.trim(), isFallback: true };
    }

    const parsed = JSON.parse(textContent);
    console.log(`[clientAI/Gemini] translate=${isTranslation} result="${(parsed.cleanSubtitle || '').substring(0, 80)}"`);
    return {
      cleanSubtitle: parsed.cleanSubtitle || rawText.trim(),
      speaker: parsed.speaker || "",
      detectedLanguage: parsed.detectedLanguage || sourceLanguage,
      isFallback: false,
    };
  } catch (err) {
    console.error("[clientAI/Gemini] Error:", err);
    return { cleanSubtitle: rawText.trim(), isFallback: true };
  }
}

// ─── Groq Whisper Large-V3 (Audio Transcription + Translation) ───

interface GroqWhisperResult {
  transcript: string;
  language?: string;
}

export async function transcribeWithGroqWhisper(
  apiKey: string,
  audioBlob: Blob,
  sourceLanguage: string,
  targetLanguage: string
): Promise<GroqWhisperResult> {
  if (!apiKey) {
    return { transcript: "" };
  }

  const srcLang = (sourceLanguage || "es").split("-")[0].toLowerCase();
  const tgtLang = (targetLanguage || "es").split("-")[0].toLowerCase();
  const isTranslation = srcLang !== tgtLang && tgtLang === "en";

  // Whisper translations endpoint only translates to English
  const endpoint = isTranslation
    ? "https://api.groq.com/openai/v1/audio/translations"
    : "https://api.groq.com/openai/v1/audio/transcriptions";

  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "verbose_json");

  if (!isTranslation) {
    formData.append("language", srcLang);
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[clientAI/Groq] HTTP ${response.status}:`, errText);
      return { transcript: "" };
    }

    const data = await response.json();
    console.log(`[clientAI/Groq] transcript="${(data.text || '').substring(0, 80)}"`);
    return {
      transcript: (data.text || "").trim(),
      language: data.language || sourceLanguage,
    };
  } catch (err) {
    console.error("[clientAI/Groq] Error:", err);
    return { transcript: "" };
  }
}

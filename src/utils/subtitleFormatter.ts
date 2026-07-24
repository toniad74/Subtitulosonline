/**
 * Utility for Senior Subtitling Standards (EBU N19 / Netflix Broadcast Guidelines)
 * 
 * Rules:
 * 1. Speaker Differentiation: When dialogue exists, each speaker MUST be rendered on a separate line prefixed with '- '.
 * 2. Automatic Dialogue Detection: Detects both explicit (- / \n / Speaker tags) and implicit dialogue patterns (Question + Answer, sentence boundaries).
 * 3. Line bounds: Max 2 lines per subtitle block.
 */

export function formatProfessionalSubtitles(
  text: string,
  maxWordsPerLine: number = 10,
  maxLines: number = 2
): string[] {
  if (!text || !text.trim()) return [];
  const clean = text.trim();

  // 1. EXPLICIT DIALOGUE MARKERS: hyphens (-), newlines (\n), or speaker tags [Speaker]: or Hablante 1:
  const hasExplicitDialogue = /^(?:-\s+|\[[^\]]+\]:|Hablante\s+\d+:)/i.test(clean) || 
                              /\s+-\s+/.test(clean) || 
                              /\n/.test(clean) ||
                              /(?:\[[^\]]+\]:|Hablante\s+\d+:)/i.test(clean);

  if (hasExplicitDialogue) {
    let rawSegments: string[] = [];

    if (clean.includes("\n")) {
      rawSegments = clean.split("\n").map((s) => s.trim()).filter(Boolean);
    } else if (/\s+-\s+/.test(clean) || clean.startsWith("-")) {
      rawSegments = clean
        .split(/(?=\s+-\s+)|^(?=-\s+)/)
        .map((s) => s.replace(/^\s*-\s*/, "").trim())
        .filter(Boolean)
        .map((s) => `- ${s}`);
    } else {
      rawSegments = clean
        .split(/(?=\[[^\]]+\]:|Hablante\s+\d+:)/i)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const lines: string[] = [];
    for (const segment of rawSegments) {
      let line = segment;
      if (!line.startsWith("-") && !line.startsWith("[")) {
        line = `- ${line}`;
      }
      lines.push(line);
    }

    return lines.slice(-maxLines);
  }

  // 2. IMPLICIT DIALOGUE DETECTION (Raw transcription without explicit hyphens)
  // Detect Question + Answer or Question + Response or Conversational Turn Shifts
  // Examples: "¿Qué tal estás? Muy bien" | "Hola. Hola, ¿cómo estás?" | "¿Vas a venir? Sí, ahora voy"
  let implicitParts: string[] = [];

  // A. Split on question mark followed by text
  if (clean.includes("?") || clean.includes("¿")) {
    const match = clean.match(/^([^\n?]+[?])\s+(.+)$/i);
    if (match && match[1].trim() && match[2].trim()) {
      implicitParts = [match[1].trim(), match[2].trim()];
    }
  }

  // B. Split on exclamation mark followed by text
  if (implicitParts.length === 0 && (clean.includes("!") || clean.includes("¡"))) {
    const match = clean.match(/^([^\n!]+[!])\s+(.+)$/i);
    if (match && match[1].trim() && match[2].trim()) {
      implicitParts = [match[1].trim(), match[2].trim()];
    }
  }

  // C. Split on conversational sentence boundary followed by response words (sí, no, hola, bien, gracias, etc.)
  if (implicitParts.length === 0) {
    const responsePattern = /([.?!])\s+(?=\b(?:sí|no|hola|bien|gracias|claro|vale|bueno|qué|cómo|cuándo|dónde|por qué|quién)\b)/i;
    const match = clean.match(responsePattern);
    if (match && match.index) {
      const firstPart = clean.slice(0, match.index + 1).trim();
      const secondPart = clean.slice(match.index + 1).trim();
      if (firstPart && secondPart) {
        implicitParts = [firstPart, secondPart];
      }
    }
  }

  // If implicit dialogue pattern was found, format both speakers onto separate lines with hyphens
  if (implicitParts.length >= 2) {
    return [
      `- ${implicitParts[0]}`,
      `- ${implicitParts[1]}`
    ].slice(-maxLines);
  }

  // 3. SINGLE SPEAKER FALLBACK: Smart EBU Line-Wrapping & Rebalancing
  // Avoids isolated 1-word orphan lines (e.g., rebalances 11 words into 6 + 5 instead of 10 + 1)
  const words = clean.split(/\s+/);

  if (words.length <= maxWordsPerLine) {
    return [clean];
  }

  // If sentence has 2 parts divided by a period/punctuation, check if they form 2 natural balanced lines
  const sentenceMatch = clean.match(/^(.+?[.!?])\s+(.+)$/);
  if (sentenceMatch) {
    const part1 = sentenceMatch[1].trim();
    const part2 = sentenceMatch[2].trim();
    const part1Words = part1.split(/\s+/).length;
    const part2Words = part2.split(/\s+/).length;

    // Avoid leaving a 1-word orphan line on either side
    if (part1Words >= 2 && part2Words >= 2 && part1Words <= maxWordsPerLine + 3 && part2Words <= maxWordsPerLine + 3) {
      return [part1, part2].slice(-maxLines);
    }
  }

  // Rebalance line division so neither line has a single isolated word
  const totalWords = words.length;
  let bestSplit = Math.ceil(totalWords / 2);

  // Search for punctuation (comma, semicolon) or conjunction near the midpoint to split naturally
  for (let i = Math.max(2, bestSplit - 3); i <= Math.min(totalWords - 2, bestSplit + 3); i++) {
    const prevWord = words[i - 1];
    if (/[,;:]$/.test(prevWord) || /^(?:y|o|u|e|que|si|cuando|pero|porque|para|de|con|en|del|al|como|donde|mientras|aunque|sino)$/i.test(words[i])) {
      bestSplit = i;
      break;
    }
  }

  // Ensure neither line has fewer than 2 words if total >= 4
  if (totalWords >= 4) {
    if (bestSplit < 2) bestSplit = 2;
    if (totalWords - bestSplit < 2) bestSplit = totalWords - 2;
  }

  const line1 = words.slice(0, bestSplit).join(" ");
  const line2 = words.slice(bestSplit).join(" ");
  return [line1, line2].slice(-maxLines);
}

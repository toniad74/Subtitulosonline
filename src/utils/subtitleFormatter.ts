/**
 * Utility for Senior Subtitling Standards (EBU N19 / Netflix Broadcast Guidelines)
 * 
 * Rules:
 * 1. Speaker Differentiation: When dialogue exists, each speaker MUST be rendered on a separate line.
 * 2. Dialogue Prefixing: Dialogue lines start with a hyphen '- ' or speaker tag.
 * 3. Line bounds: Max 2 lines per subtitle block.
 */

export function formatProfessionalSubtitles(
  text: string,
  maxWordsPerLine: number = 10,
  maxLines: number = 2
): string[] {
  if (!text || !text.trim()) return [];
  const clean = text.trim();

  // Detect dialogue markers: hyphens (-), newlines, or speaker tags [Speaker]: or Hablante 1:
  const hasDialogue = /^(?:-\s+|\[[^\]]+\]:|Hablante\s+\d+:)/i.test(clean) || 
                      /\s+-\s+/.test(clean) || 
                      /\n/.test(clean) ||
                      /(?:\[[^\]]+\]:|Hablante\s+\d+:)/i.test(clean);

  if (hasDialogue) {
    // Split by newlines or dialogue hyphens/speaker tags
    let rawSegments: string[] = [];

    if (clean.includes("\n")) {
      rawSegments = clean.split("\n").map((s) => s.trim()).filter(Boolean);
    } else if (/\s+-\s+/.test(clean) || clean.startsWith("-")) {
      // Split on hyphens
      rawSegments = clean
        .split(/(?=\s+-\s+)|^(?=-\s+)/)
        .map((s) => s.replace(/^\s*-\s*/, "").trim())
        .filter(Boolean)
        .map((s) => `- ${s}`);
    } else {
      // Split on speaker tags
      rawSegments = clean
        .split(/(?=\[[^\]]+\]:|Hablante\s+\d+:)/i)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // Format each segment into its own distinct line
    const lines: string[] = [];
    for (const segment of rawSegments) {
      let line = segment;
      // If dialogue segment doesn't start with hyphen or tag, add hyphen prefix
      if (!line.startsWith("-") && !line.startsWith("[")) {
        line = `- ${line}`;
      }
      lines.push(line);
    }

    return lines.slice(-maxLines);
  }

  // Single speaker fallback: word-wrapping to maxWordsPerLine
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += maxWordsPerLine) {
    lines.push(words.slice(i, i + maxWordsPerLine).join(" "));
  }

  return lines.slice(-maxLines);
}

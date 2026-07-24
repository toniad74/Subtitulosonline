import { SubtitleItem } from "../types";

function formatSrtTimestamp(secondsTotal: number): string {
  const hrs = Math.floor(secondsTotal / 3600);
  const mins = Math.floor((secondsTotal % 3600) / 60);
  const secs = Math.floor(secondsTotal % 60);
  const millis = Math.floor((secondsTotal % 1) * 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, "0");
  const padMs = (n: number) => String(n).padStart(3, "0");

  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${padMs(millis)}`;
}

export function exportToSRT(subtitles: SubtitleItem[]): string {
  if (subtitles.length === 0) return "";

  const baseTime = subtitles[0].createdAt;

  return subtitles
    .map((sub, index) => {
      const startSec = (sub.createdAt - baseTime) / 1000;
      const endSec = startSec + Math.max(2, sub.text.length * 0.08); // Estimate duration based on word count
      const startStr = formatSrtTimestamp(startSec);
      const endStr = formatSrtTimestamp(endSec);

      const speakerPrefix = sub.speaker ? `[${sub.speaker}] ` : "";
      return `${index + 1}\n${startStr} --> ${endStr}\n${speakerPrefix}${sub.text}\n`;
    })
    .join("\n");
}

export function exportToVTT(subtitles: SubtitleItem[]): string {
  if (subtitles.length === 0) return "WEBVTT\n\n";

  const srtContent = exportToSRT(subtitles);
  const vttContent = srtContent.replace(/,/g, ".");
  return `WEBVTT - Subtítulos en Tiempo Real IA\n\n${vttContent}`;
}

export function exportToTXT(subtitles: SubtitleItem[]): string {
  return subtitles
    .map((sub) => {
      const timeStr = `[${sub.timestamp}]`;
      const speakerStr = sub.speaker ? `${sub.speaker}: ` : "";
      return `${timeStr} ${speakerStr}${sub.text}`;
    })
    .join("\n\n");
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

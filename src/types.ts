export interface AudioDeviceOption {
  deviceId: string;
  label: string;
  groupId: string;
  isDefault?: boolean;
}

export interface SubtitleItem {
  id: string;
  timestamp: string; // e.g. "10:14:02"
  rawText: string;
  text: string;
  speaker?: string;
  confidence?: number;
  isFinal: boolean;
  isAIRefined?: boolean;
  detectedLanguage?: string;
  keyTerms?: string[];
  createdAt: number; // Date.now()
}

export type SubtitleDisplayStyle = 'cinema' | 'glass' | 'neon' | 'light' | 'minimal';

export interface SubtitleSettings {
  sourceLanguage: string; // 'es-ES', 'en-US', etc.
  targetLanguage: string; // 'es', 'en', 'fr', 'de', 'it', 'pt', etc.
  fontSize: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  fontFamily: string;
  displayStyle: SubtitleDisplayStyle;
  overlayPosition: 'bottom' | 'center' | 'top';
  showSpeakers: boolean;
  showTimestamps: boolean;
  aiAutoRefine: boolean; // Auto-refine with Gemini
  glossary: string; // Technical terms / names
  bgOpacity: number; // 0 to 100
  bgColor: string; // Background color hex (e.g. '#0a0a0c')
  textColor: string; // Text color hex (e.g. '#ffffff', '#facc15')
  textBorder: boolean; // Enable text border/stroke
  textBorderSize: 'thin' | 'medium' | 'thick'; // Border thickness
  textBorderColor: string; // Border color hex (e.g. '#000000')
  autoScroll: boolean;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  maxWordsPerLine: number; // Max words per line (e.g. 10)
  maxLines: number; // Max lines per subtitle screen (e.g. 2)
  showInterim: boolean; // Whether to show word-by-word interim text or only complete phrases
}

export interface ConversationSummary {
  title: string;
  executiveSummary: string;
  keyTopics: string[];
  actionItems: string[];
  sentiment?: string;
}

export interface AudioInputStats {
  volume: number; // 0 to 100
  isClipping: boolean;
  peakDb: number;
}

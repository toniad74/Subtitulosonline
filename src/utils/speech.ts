// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface SpeechHandlerCallbacks {
  onInterimResult: (text: string) => void;
  onFinalResult: (text: string, confidence: number) => void;
  onError: (error: string) => void;
  onStatusChange: (isListening: boolean) => void;
}

export class SpeechRecognitionService {
  private recognition: any = null;
  private isListening = false;
  private shouldKeepListening = false;
  private language = "es-ES";
  private callbacks: SpeechHandlerCallbacks | null = null;
  public isSupported = false;

  constructor() {
    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      this.isSupported = true;
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 3;
      this.setupListeners();
    } else {
      this.isSupported = false;
    }
  }

  private setupListeners() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.callbacks?.onStatusChange(true);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.callbacks?.onStatusChange(false);

      // Ultra-fast auto restart for seamless continuous speech listening
      // Minimal delay to avoid losing words between recognition cycles
      if (this.shouldKeepListening) {
        setTimeout(() => {
          if (this.shouldKeepListening) {
            try {
              this.recognition.start();
            } catch (e) {
              console.warn("Speech recognition restart failed:", e);
              // Retry once more after a short delay
              setTimeout(() => {
                if (this.shouldKeepListening) {
                  try { this.recognition.start(); } catch (_) {}
                }
              }, 100);
            }
          }
        }, 10);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error === "no-speech") {
        // Safe to ignore, loop will handle
        return;
      }
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.shouldKeepListening = false;
        this.callbacks?.onError("Permiso de micrófono denegado o no disponible en el navegador.");
        return;
      }
      this.callbacks?.onError(`Error de reconocimiento: ${event.error}`);
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";
      let confidence = 0.9;

      // Accumulate ALL results from index 0 to build the complete transcript
      // This prevents losing words that were previously interim and not yet final
      for (let i = 0; i < event.results.length; ++i) {
        // Pick the best alternative (highest confidence)
        let bestAlt = event.results[i][0];
        for (let a = 1; a < event.results[i].length; a++) {
          if (event.results[i][a].confidence > bestAlt.confidence) {
            bestAlt = event.results[i][a];
          }
        }
        const transcript = bestAlt.transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
          if (bestAlt.confidence) {
            confidence = Math.max(confidence, bestAlt.confidence);
          }
        } else {
          interimTranscript += transcript;
        }
      }

      // Always emit interim even if it seems short — every word matters
      if (interimTranscript.trim()) {
        this.callbacks?.onInterimResult(interimTranscript);
      }

      if (finalTranscript.trim()) {
        this.callbacks?.onFinalResult(finalTranscript.trim(), confidence);
      }
    };
  }

  public setLanguage(lang: string) {
    this.language = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public start(callbacks: SpeechHandlerCallbacks, lang = "es-ES") {
    if (!this.isSupported) {
      callbacks.onError("Este navegador no admite Web Speech API de forma nativa. Puedes usar el modo de Audio Chunk con IA.");
      return;
    }

    this.callbacks = callbacks;
    this.setLanguage(lang);
    this.shouldKeepListening = true;

    try {
      if (this.isListening) {
        this.recognition.stop();
      }
      this.recognition.start();
    } catch (err: any) {
      console.error("Failed to start speech recognition:", err);
      // Retry after delay
      setTimeout(() => {
        try {
          this.recognition.start();
        } catch (e) {
          callbacks.onError("No se pudo iniciar el servicio de voz.");
        }
      }, 500);
    }
  }

  public stop() {
    this.shouldKeepListening = false;
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn("Error stopping recognition:", e);
      }
    }
    this.isListening = false;
    this.callbacks?.onStatusChange(false);
  }
}

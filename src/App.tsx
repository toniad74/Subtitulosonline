import React, { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "./components/Header";
import { AudioDeviceSelector } from "./components/AudioDeviceSelector";
import { AudioVisualizer } from "./components/AudioVisualizer";
import { LiveSubtitleCard } from "./components/LiveSubtitleCard";
import { AISettingsPanel } from "./components/AISettingsPanel";
import { AISummaryModal } from "./components/AISummaryModal";
import { OverlayView } from "./components/OverlayView";
import {
  getAudioInputDevices,
  getAudioStream,
  calculateAudioLevel,
  blobToBase64,
} from "./utils/audio";
import { SpeechRecognitionService } from "./utils/speech";
import {
  exportToSRT,
  exportToVTT,
  exportToTXT,
  downloadFile,
} from "./utils/exporter";
import {
  AudioDeviceOption,
  SubtitleItem,
  SubtitleSettings,
} from "./types";
import { HostPeerManager, getSavedRoomId } from "./utils/peerSync";
import { MqttPublisher, getSavedTopic } from "./utils/mqttSync";
import { Radio, Mic, Sparkles, Volume2, ShieldCheck, Download, Trash2, Info } from "lucide-react";

const DEFAULT_SETTINGS: SubtitleSettings = {
  sourceLanguage: "es-ES",
  targetLanguage: "es-ES",
  fontSize: "lg",
  fontFamily: "montserrat",
  displayStyle: "cinema",
  borderRadius: "lg",
  overlayPosition: "bottom",
  showSpeakers: true,
  showTimestamps: true,
  aiAutoRefine: true,
  glossary: "",
  bgOpacity: 90,
  bgColor: "#0a0a0c",
  textColor: "#ffffff",
  textBorder: true,
  textBorderSize: "medium",
  textBorderColor: "#000000",
  autoScroll: true,
  noiseSuppression: false,
  echoCancellation: false,
  autoGainControl: true,
  maxWordsPerLine: 10,
  maxLines: 2,
  showInterim: true,
  silenceTimeoutMs: 2000,
};

export default function App() {
  // Application State
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleItem | null>(null);
  const [interimText, setInterimText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isAIRefining, setIsAIRefining] = useState(false);

  // Audio Device State
  const [devices, setDevices] = useState<AudioDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("default");
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Modals & Panels
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // User Settings
  const [settings, setSettings] = useState<SubtitleSettings>(() => {
    const saved = localStorage.getItem("subtitle_app_settings");
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // Services & Audio Context Refs
  const speechServiceRef = useRef<SpeechRecognitionService | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelIntervalRef = useRef<number | null>(null);
  const silenceTimeoutRef = useRef<number | null>(null);
  const commitTimeoutRef = useRef<number | null>(null);
  const latestInterimRef = useRef<string>("");
  const lastRefineTimeRef = useRef<number>(0);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const hostPeerRef = useRef<HostPeerManager | null>(null);
  const [connectedPeersCount, setConnectedPeersCount] = useState<number>(0);
  const [roomId, setRoomId] = useState<string>(() => getSavedRoomId());

  // WebRTC PeerJS Host Initialization for vMix / OBS remote sync
  useEffect(() => {
    hostPeerRef.current = new HostPeerManager(roomId, (count) => {
      setConnectedPeersCount(count);
    });
    return () => {
      if (hostPeerRef.current) {
        hostPeerRef.current.destroy();
      }
    };
  }, [roomId]);

  const mqttPubRef = useRef<MqttPublisher | null>(null);
  const [mqttTopic] = useState<string>(() => getSavedTopic());

  // MQTT WebSockets Publisher Initialization for vMix / OBS remote sync
  useEffect(() => {
    mqttPubRef.current = new MqttPublisher(mqttTopic);
    return () => {
      if (mqttPubRef.current) {
        mqttPubRef.current.destroy();
      }
    };
  }, [mqttTopic]);

  // Persistent BroadcastChannel for real-time OBS / tab syncing
  useEffect(() => {
    if ("BroadcastChannel" in window) {
      bcRef.current = new BroadcastChannel("scribe_subtitles_channel");
    }
    return () => {
      if (bcRef.current) {
        bcRef.current.close();
      }
    };
  }, []);

const ensurePeriod = (str: string): string => {
  const trimmed = str.trim();
  if (!trimmed) return "";

  // If already ends with punctuation (. ? ! … : , -), preserve as is
  if (/[.?!…:,\-]$/.test(trimmed)) {
    return trimmed;
  }

  // Do NOT force a period on short fragments (< 4 words) unless it's a clear short response (Sí, No, Claro, Vale, Gracias)
  const words = trimmed.split(/\s+/);
  if (words.length < 4) {
    const isStandaloneResponse = /^(?:sí|si|no|claro|vale|perfecto|entendido|gracias|bueno|hola|adiós)$/i.test(trimmed);
    if (!isStandaloneResponse) {
      return trimmed;
    }
  }

  // If phrase ends with a conjunction/preposition/linking word, do NOT add a period
  const trailingIncomplete = /\b(?:y|o|u|e|que|si|cuando|pero|porque|para|de|con|en|del|al|como|donde|mientras|aunque|ni|sino|así|también|además|luego|entonces)\s*$/i.test(trimmed);
  if (trailingIncomplete) {
    return trimmed;
  }

  return `${trimmed}.`;
};

  // Helper to deduplicate overlap words between consecutive subtitles
  const deduplicateSubtitleText = (newText: string, lastText?: string): string => {
    if (!lastText || !newText) return newText.trim();
    const newWords = newText.trim().split(/\s+/);
    const lastWords = lastText.trim().replace(/[.?!…:]$/g, "").split(/\s+/);

    // Find if new text starts with trailing words of the previous subtitle
    let overlapCount = 0;
    const maxCheck = Math.min(newWords.length, lastWords.length, 6);
    for (let len = maxCheck; len > 0; len--) {
      const lastTail = lastWords.slice(-len).join(" ").toLowerCase();
      const newHead = newWords.slice(0, len).join(" ").toLowerCase();
      if (lastTail === newHead) {
        overlapCount = len;
        break;
      }
    }

    if (overlapCount > 0) {
      const remainingWords = newWords.slice(overlapCount);
      return remainingWords.join(" ").trim();
    }

    return newText.trim();
  };

  // Helper to reset silence timer
  const resetSilenceTimers = () => {
    if (silenceTimeoutRef.current) {
      window.clearTimeout(silenceTimeoutRef.current);
    }

    // Quita el subtítulo en pantalla tras el tiempo configurado de silencio (2.0s por defecto)
    silenceTimeoutRef.current = window.setTimeout(() => {
      setInterimText("");
      setCurrentSubtitle(null);
      latestInterimRef.current = "";
    }, settings.silenceTimeoutMs || 2000);
  };

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem("subtitle_app_settings", JSON.stringify(settings));
  }, [settings]);

  // Helper to send live state to backend server for OBS/vMix live sync
  const sendLiveStateToServer = useCallback((payload: any) => {
    fetch("/api/live-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, []);

  // Broadcast live state to overlay tabs/windows/OBS in real-time
  useEffect(() => {
    const payload = {
      interimText,
      currentSubtitle,
      settings,
      isListening,
    };
    try {
      localStorage.setItem("scribe_live_state", JSON.stringify(payload));
      if (bcRef.current) {
        bcRef.current.postMessage(payload);
      }
    } catch (e) {}

    sendLiveStateToServer(payload);
    hostPeerRef.current?.broadcast(payload);
    mqttPubRef.current?.publish(payload);
  }, [interimText, currentSubtitle, settings, isListening, sendLiveStateToServer]);

  // Load available audio input devices on startup
  const refreshDevices = useCallback(async () => {
    const availableDevices = await getAudioInputDevices();
    setDevices(availableDevices);
    if (availableDevices.length > 0 && selectedDeviceId === "default") {
      const defaultDev = availableDevices.find((d) => d.isDefault) || availableDevices[0];
      setSelectedDeviceId(defaultDev.deviceId);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  // Initialize Speech Recognition Service
  useEffect(() => {
    speechServiceRef.current = new SpeechRecognitionService();
  }, []);

  // Update speech service language when settings change
  useEffect(() => {
    if (speechServiceRef.current) {
      speechServiceRef.current.setLanguage(settings.sourceLanguage);
    }
  }, [settings.sourceLanguage]);

  // Handle AI Refinement of raw subtitle
  const refineSubtitleWithAI = async (rawItem: SubtitleItem) => {
    const srcLang = (settings.sourceLanguage || "es").split("-")[0].toLowerCase();
    const tgtLang = (settings.targetLanguage || "es").split("-")[0].toLowerCase();
    const isTranslationMode = srcLang !== tgtLang;

    if ((!settings.aiAutoRefine && !isTranslationMode) || !rawItem.rawText.trim()) return;

    // Minimal rate limit (200ms) only to prevent duplicate burst events
    const now = Date.now();
    if (now - lastRefineTimeRef.current < 200) {
      return;
    }
    lastRefineTimeRef.current = now;

    setIsAIRefining(true);
    try {
      // Build conversation context from recent subtitles so AI can detect speaker changes
      const recentContext = subtitles
        .slice(-5)
        .map((s) => s.rawText || s.text)
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/refine-subtitles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: rawItem.rawText,
          conversationContext: recentContext,
          sourceLanguage: settings.sourceLanguage,
          targetLanguage: settings.targetLanguage,
          glossary: settings.glossary,
          promptMode: settings.showSpeakers ? "speakers" : "standard",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const refinedSubtitle: SubtitleItem = {
          ...rawItem,
          text: data.cleanSubtitle || rawItem.text,
          speaker: data.speaker || rawItem.speaker,
          isAIRefined: !data.isFallback,
          detectedLanguage: data.detectedLanguage,
          keyTerms: data.keyTerms,
        };

        // Update in history
        setSubtitles((prev) =>
          prev.map((s) => (s.id === rawItem.id ? refinedSubtitle : s))
        );

        // Update active subtitle if still showing
        setCurrentSubtitle((prev) => (prev?.id === rawItem.id ? refinedSubtitle : prev));
      }
    } catch (err) {
      // Quiet fail
    } finally {
      setIsAIRefining(false);
    }
  };

  // Start Audio Stream & Audio Level Analyser
  const setupAudioStream = async (deviceId: string) => {
    // Stop existing audio tracks & context
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
    }
    if (levelIntervalRef.current) {
      window.clearInterval(levelIntervalRef.current);
    }

    try {
      const stream = await getAudioStream(deviceId, {
        noiseSuppression: settings.noiseSuppression,
        echoCancellation: settings.echoCancellation,
        autoGainControl: settings.autoGainControl,
      });

      setActiveStream(stream);

      // Create AudioContext and Analyser for visualizer & level meter
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      const analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 64;

      sourceNode.connect(analyserNode);
      setAnalyser(analyserNode);

      // Level meter interval
      levelIntervalRef.current = window.setInterval(() => {
        const level = calculateAudioLevel(analyserNode);
        setAudioLevel(level);
      }, 80);

      return stream;
    } catch (err) {
      console.error("Failed to setup audio stream:", err);
      return null;
    }
  };

  // Process audio chunk with Groq Whisper Large-V3 endpoint
  const processAudioChunkWithGroqWhisper = useCallback(
    async (audioBase64: string, mimeType: string) => {
      try {
        const res = await fetch("/api/transcribe-groq-whisper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64,
            mimeType,
            sourceLanguage: settings.sourceLanguage,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawTranscript = data.transcript || "";

          if (rawTranscript && rawTranscript.trim()) {
            const cleanedRaw = rawTranscript.trim();

            setSubtitles((prev) => {
              const lastSub = prev[prev.length - 1];
              const cleanedText = deduplicateSubtitleText(cleanedRaw, lastSub?.rawText || lastSub?.text);

              if (!cleanedText || cleanedText.length < 2) {
                return prev;
              }

              const formattedText = ensurePeriod(cleanedText);

              const now = new Date();
              const timeString = now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

              const newItem: SubtitleItem = {
                id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                timestamp: timeString,
                rawText: cleanedText,
                text: formattedText,
                confidence: 0.99,
                isFinal: true,
                isAIRefined: true,
                createdAt: Date.now(),
              };

              setCurrentSubtitle(newItem);
              resetSilenceTimers();
              refineSubtitleWithAI(newItem);
              return [...prev, newItem];
            });
          }
        }
      } catch (err) {
        console.warn("Groq Whisper transcription error:", err);
      }
    },
    [settings.sourceLanguage]
  );

  // Start continuous audio chunk recorder for direct stream Whisper transcription
  const startAudioChunkRecorder = (stream: MediaStream) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }

    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 1000) {
          try {
            const base64 = await blobToBase64(e.data);
            if (base64) {
              processAudioChunkWithGroqWhisper(base64, options?.mimeType || "audio/webm");
            }
          } catch (err) {
            console.warn("Error converting audio chunk to base64:", err);
          }
        }
      };

      // Slice audio every 3.5 seconds for direct Whisper Large-V3 transcription
      recorder.start(3500);
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn("Could not start MediaRecorder for Whisper:", err);
    }
  };

  const stopAudioChunkRecorder = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    mediaRecorderRef.current = null;
  };

  // Toggle Listening State
  const handleToggleListening = async () => {
    if (isListening) {
      // Stop listening
      if (speechServiceRef.current) {
        speechServiceRef.current.stop();
      }
      stopAudioChunkRecorder();
      setIsListening(false);
      setInterimText("");
      setCurrentSubtitle(null);
      setAudioLevel(0);
      if (levelIntervalRef.current) {
        window.clearInterval(levelIntervalRef.current);
      }
      if (silenceTimeoutRef.current) {
        window.clearTimeout(silenceTimeoutRef.current);
      }
      if (commitTimeoutRef.current) {
        window.clearTimeout(commitTimeoutRef.current);
      }
      latestInterimRef.current = "";
    } else {
      // Start listening
      const stream = await setupAudioStream(selectedDeviceId);
      if (!stream) {
        alert("No se pudo acceder al dispositivo de entrada de audio seleccionado. Revisa los permisos.");
        return;
      }

      // Start Groq Whisper Large-V3 audio chunk recorder for direct stream audio capture
      startAudioChunkRecorder(stream);

      if (!speechServiceRef.current) {
        speechServiceRef.current = new SpeechRecognitionService();
      }

      if (speechServiceRef.current) {
        speechServiceRef.current.start(
          {
            onInterimResult: (text) => {
              latestInterimRef.current = text;
              setInterimText(text);
              resetSilenceTimers();
            },
            onFinalResult: (text, confidence) => {
              latestInterimRef.current = "";
              setInterimText("");

              // Deduplicate leading words that might overlap with the previous subtitle
              setSubtitles((prev) => {
                const lastSub = prev[prev.length - 1];
                const cleanedRaw = deduplicateSubtitleText(text, lastSub?.rawText || lastSub?.text);

                if (!cleanedRaw || cleanedRaw.length < 2) {
                  // Fully duplicated phrase or single artifact character, skip creating empty/loose subtitle
                  return prev;
                }

                const formattedText = ensurePeriod(cleanedRaw);

                const now = new Date();
                const timeString = now.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });

                const newItem: SubtitleItem = {
                  id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                  timestamp: timeString,
                  rawText: cleanedRaw,
                  text: formattedText,
                  confidence,
                  isFinal: true,
                  createdAt: Date.now(),
                };

                setCurrentSubtitle(newItem);
                resetSilenceTimers();
                refineSubtitleWithAI(newItem);

                return [...prev, newItem];
              });
            },
            onError: (errMsg) => {
              console.warn("Speech recognition error:", errMsg);
            },
            onStatusChange: (status) => {
              setIsListening(status);
            },
          },
          settings.sourceLanguage
        );
      }
    }
  };

  // Change selected device
  const handleSelectDevice = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (isListening) {
      await setupAudioStream(deviceId);
    }
  };

  // Update subtitle item in history
  const handleUpdateSubtitle = (id: string, newText: string) => {
    setSubtitles((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text: newText } : s))
    );
    if (currentSubtitle?.id === id) {
      setCurrentSubtitle((prev) => (prev ? { ...prev, text: newText } : null));
    }
  };

  // Delete subtitle item from history
  const handleDeleteSubtitle = (id: string) => {
    setSubtitles((prev) => prev.filter((s) => s.id !== id));
    if (currentSubtitle?.id === id) {
      setCurrentSubtitle(null);
    }
  };

  // Clear all subtitles
  const handleClearAll = () => {
    if (confirm("¿Estás seguro de borrar todo el historial de subtítulos?")) {
      setSubtitles([]);
      setCurrentSubtitle(null);
      setInterimText("");
    }
  };

  // Export subtitles
  const handleExport = () => {
    if (subtitles.length === 0) return;

    const srtContent = exportToSRT(subtitles);
    downloadFile(srtContent, `subtitulos_conversacion_${Date.now()}.srt`, "text/plain");
  };

  // Get selected device display label
  const selectedDeviceObj = devices.find((d) => d.deviceId === selectedDeviceId);
  const selectedDeviceLabel = selectedDeviceObj?.label || "Micrófono predeterminado";

  // Render standalone Overlay / Chroma Key view if URL contains ?mode=overlay or #overlay
  const isOverlayMode = typeof window !== "undefined" && (
    window.location.search.includes("mode=overlay") ||
    window.location.search.includes("overlay=true") ||
    window.location.hash.includes("overlay")
  );

  if (isOverlayMode) {
    return <OverlayView initialPayload={{ interimText, currentSubtitle, settings, isListening }} />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-[#E0E0E6] flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header Navigation */}
      <Header
        isListening={isListening}
        onToggleListening={handleToggleListening}
        selectedDeviceLabel={selectedDeviceLabel}
        onOpenAudioSettings={() => setIsAudioModalOpen(true)}
        onOpenAISettings={() => setIsAIModalOpen(true)}
        onExport={handleExport}
        subtitleCount={subtitles.length}
        audioLevel={audioLevel}
        settings={settings}
      />

      {/* Main App Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Top Control Bar: Audio Device Banner & Visualizer */}
        <div className="bg-[#0E0E12] border border-[#1F1F23] rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#6B6B76] font-bold">
                  Fuente de Audio Configurada
                </p>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  {selectedDeviceLabel}
                  <button
                    onClick={() => setIsAudioModalOpen(true)}
                    className="text-xs text-indigo-400 hover:underline font-normal"
                  >
                    (Cambiar)
                  </button>
                </h3>
              </div>
            </div>

            {/* Audio Visualizer Canvas */}
            <div className="w-full sm:w-72">
              <AudioVisualizer analyser={analyser} isListening={isListening} />
            </div>
          </div>
        </div>

        {/* Live Subtitle Screen Display (Primary Hero Overlay) */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1 text-xs text-[#6B6B76]">
            <span className="font-bold uppercase tracking-wider text-[10px] text-gray-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Pantalla de Subtitulado en Vivo
            </span>
            <span className="hidden sm:inline">
              Estilo: <strong className="capitalize text-slate-200">{settings.displayStyle}</strong> | Formato:{" "}
              <strong className="text-slate-200">{settings.maxWordsPerLine} p/línea, máx {settings.maxLines} líns.</strong>
            </span>
          </div>

          <LiveSubtitleCard
            currentSubtitle={currentSubtitle}
            interimText={interimText}
            isListening={isListening}
            isAIRefining={isAIRefining}
            settings={settings}
            onUpdateSettings={(newSt) => setSettings((prev) => ({ ...prev, ...newSt }))}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1F1F23] bg-[#0E0E12] py-4 px-4 text-center text-xs text-[#6B6B76]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© ScribeAI • Subtítulos en Tiempo Real con Gemini 3.6 Flash</p>
          <div className="flex items-center gap-4 font-medium">
            <button
              onClick={() => setIsAudioModalOpen(true)}
              className="hover:text-white transition"
            >
              Configurar Audio
            </button>
            <button
              onClick={() => setIsAIModalOpen(true)}
              className="hover:text-white transition"
            >
              Ajustes IA
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AudioDeviceSelector
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onSelectDevice={handleSelectDevice}
        onRefreshDevices={refreshDevices}
        audioLevel={audioLevel}
        settings={settings}
        onUpdateSettings={(newSt) => setSettings((prev) => ({ ...prev, ...newSt }))}
        activeStream={activeStream}
      />

      <AISettingsPanel
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        settings={settings}
        onUpdateSettings={(newSt) => setSettings((prev) => ({ ...prev, ...newSt }))}
      />

      <AISummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        subtitles={subtitles}
      />
    </div>
  );
}

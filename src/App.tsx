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
import { Radio, Mic, Sparkles, Volume2, ShieldCheck, Download, Trash2, Info } from "lucide-react";

const DEFAULT_SETTINGS: SubtitleSettings = {
  sourceLanguage: "es-ES",
  targetLanguage: "es-ES",
  fontSize: "lg",
  fontFamily: "montserrat",
  displayStyle: "cinema",
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
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  maxWordsPerLine: 10,
  maxLines: 2,
  showInterim: true,
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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelIntervalRef = useRef<number | null>(null);
  const silenceTimeoutRef = useRef<number | null>(null);
  const commitTimeoutRef = useRef<number | null>(null);
  const latestInterimRef = useRef<string>("");
  const lastRefineTimeRef = useRef<number>(0);
  const bcRef = useRef<BroadcastChannel | null>(null);

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

  // Helper to reset silence and commit timers
  const resetSilenceTimers = () => {
    if (silenceTimeoutRef.current) {
      window.clearTimeout(silenceTimeoutRef.current);
    }
    if (commitTimeoutRef.current) {
      window.clearTimeout(commitTimeoutRef.current);
    }

    // Auto-commit interim text after 1s of pause if WebSpeech API hasn't fired isFinal
    commitTimeoutRef.current = window.setTimeout(() => {
      if (latestInterimRef.current.trim()) {
        const textToCommit = latestInterimRef.current.trim();
        latestInterimRef.current = "";
        setInterimText("");

        const now = new Date();
        const timeString = now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const newItem: SubtitleItem = {
          id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          timestamp: timeString,
          rawText: textToCommit,
          text: textToCommit,
          confidence: 0.9,
          isFinal: true,
          createdAt: Date.now(),
        };

        setCurrentSubtitle(newItem);
        setSubtitles((prev) => [...prev, newItem]);
        refineSubtitleWithAI(newItem);
      }
    }, 1000);

    // Quita el subtítulo completamente tras 3 segundos de silencio sin locución
    silenceTimeoutRef.current = window.setTimeout(() => {
      setInterimText("");
      setCurrentSubtitle(null);
      latestInterimRef.current = "";
    }, 3000);
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
    if (!settings.aiAutoRefine || !rawItem.rawText.trim()) return;

    // Rate-limit AI calls (at most once every 2.5 seconds) to avoid Gemini API quota exhaustion
    const now = Date.now();
    if (now - lastRefineTimeRef.current < 2500) {
      return;
    }
    lastRefineTimeRef.current = now;

    setIsAIRefining(true);
    try {
      const res = await fetch("/api/refine-subtitles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: rawItem.rawText,
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

  // Toggle Listening State
  const handleToggleListening = async () => {
    if (isListening) {
      // Stop listening
      if (speechServiceRef.current) {
        speechServiceRef.current.stop();
      }
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
              if (commitTimeoutRef.current) {
                window.clearTimeout(commitTimeoutRef.current);
              }

              const now = new Date();
              const timeString = now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

              const newItem: SubtitleItem = {
                id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                timestamp: timeString,
                rawText: text,
                text: text,
                confidence,
                isFinal: true,
                createdAt: Date.now(),
              };

              setCurrentSubtitle(newItem);
              setSubtitles((prev) => [...prev, newItem]);
              resetSilenceTimers();

              // Trigger AI refinement in background
              refineSubtitleWithAI(newItem);
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
        onOpenSummary={() => setIsSummaryModalOpen(true)}
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

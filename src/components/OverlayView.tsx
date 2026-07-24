import React, { useState, useEffect, useRef } from "react";
import { SubtitleItem, SubtitleSettings } from "../types";
import { Copy, Check, ExternalLink, RefreshCw, Eye, Sparkles, Monitor, ArrowLeft, Mic, MicOff, Play } from "lucide-react";
import { SpeechRecognitionService } from "../utils/speech";

import { ClientPeerManager, getSavedRoomId, OverlayStatePayload } from "../utils/peerSync";
import { MqttSubscriber, getSavedTopic } from "../utils/mqttSync";

const hexToRgba = (hex: string, opacity: number = 90) => {
  if (!hex) return `rgba(10, 10, 12, ${opacity / 100})`;
  let c = hex.replace("#", "");
  if (c.length === 3) {
    c = c.split("").map((x) => x + x).join("");
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(10, 10, 12, ${opacity / 100})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
};

const fontFamilyMap: Record<string, string> = {
  inter: "'Inter', sans-serif",
  oswald: "'Oswald', sans-serif",
  montserrat: "'Montserrat', sans-serif",
  playfair: "'Playfair Display', serif",
  firacode: "'Fira Code', monospace",
  quicksand: "'Quicksand', sans-serif",
  caveat: "'Caveat', cursive",
};

const fontSizeClasses: Record<string, string> = {
  sm: "text-lg sm:text-xl font-medium",
  md: "text-xl sm:text-2xl font-semibold",
  lg: "text-2xl sm:text-3xl font-bold",
  xl: "text-3xl sm:text-4xl font-extrabold",
  "2xl": "text-4xl sm:text-5xl font-extrabold",
  "3xl": "text-5xl sm:text-6xl font-black",
};

export const OverlayView: React.FC<{
  initialPayload?: OverlayStatePayload;
}> = ({ initialPayload }) => {
  const [interimText, setInterimText] = useState<string>(initialPayload?.interimText || "");
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleItem | null>(initialPayload?.currentSubtitle || null);
  const [settings, setSettings] = useState<SubtitleSettings>(initialPayload?.settings || {
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
  });
  const [isListening, setIsListening] = useState<boolean>(initialPayload?.isListening ?? true);

  // Outer Chroma Background mode: 'green' | 'transparent' | 'blue' | 'black'
  const [outerBg, setOuterBg] = useState<"green" | "transparent" | "blue" | "black">(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("chroma");
    if (mode === "transparent") return "transparent";
    if (mode === "blue") return "blue";
    if (mode === "black") return "black";
    return "green"; // Default to green chroma key for OBS/vMix compatibility
  });

  const [showSilenceHint, setShowSilenceHint] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLocalListening, setIsLocalListening] = useState(false);
  const speechServiceRef = useRef<SpeechRecognitionService | null>(null);

  const localSilenceTimerRef = useRef<number | null>(null);

  const resetLocalSilenceTimer = () => {
    if (localSilenceTimerRef.current) {
      window.clearTimeout(localSilenceTimerRef.current);
    }
    localSilenceTimerRef.current = window.setTimeout(() => {
      setInterimText("");
      setCurrentSubtitle(null);
    }, 3000);
  };

  // Standalone speech recognition toggle for this overlay window
  const handleToggleLocalListening = () => {
    if (isLocalListening) {
      if (speechServiceRef.current) {
        speechServiceRef.current.stop();
      }
      setIsLocalListening(false);
      if (localSilenceTimerRef.current) {
        window.clearTimeout(localSilenceTimerRef.current);
      }
    } else {
      if (!speechServiceRef.current) {
        speechServiceRef.current = new SpeechRecognitionService();
      }
      speechServiceRef.current.start(
        {
          onInterimResult: (text) => {
            setInterimText(text);
            resetLocalSilenceTimer();
          },
          onFinalResult: (text, conf) => {
            setInterimText("");
            setCurrentSubtitle({
              id: `sub-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              rawText: text,
              text: text,
              confidence: conf,
              isFinal: true,
              createdAt: Date.now(),
            });
            resetLocalSilenceTimer();
          },
          onError: (err) => console.warn(err),
          onStatusChange: (status) => setIsLocalListening(status),
        },
        settings.sourceLanguage || "es-ES"
      );
    }
  };

  // Test subtitle generator
  const handleTestSubtitle = () => {
    setInterimText("");
    setCurrentSubtitle({
      id: `demo-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      rawText: "Subtítulo de prueba en vivo para OBS.",
      text: "Subtítulo de prueba en vivo para OBS sobre pastilla de fondo con tipografía elegida.",
      speaker: "Demostración",
      confidence: 1,
      isFinal: true,
      createdAt: Date.now(),
    });
    resetLocalSilenceTimer();
  };

  // Apply outer background color to body & html element dynamically
  useEffect(() => {
    const colorMap = {
      transparent: "transparent",
      green: "#00FF00",
      blue: "#0000FF",
      black: "#000000",
    };
    const targetColor = colorMap[outerBg];
    document.body.style.backgroundColor = targetColor;
    document.documentElement.style.backgroundColor = targetColor;

    return () => {
      document.body.style.backgroundColor = "";
      document.documentElement.style.backgroundColor = "";
    };
  }, [outerBg]);

  // Auto-hide toolbar after inactivity
  useEffect(() => {
    let timer: number;
    const handleMouseMove = () => {
      setShowControls(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setShowControls(false);
      }, 3500);
    };

    window.addEventListener("mousemove", handleMouseMove);
    timer = window.setTimeout(() => setShowControls(false), 3500);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.clearTimeout(timer);
    };
  }, []);

  // Listen to MQTT WebSockets, BroadcastChannel, localStorage, and WebRTC PeerJS for multi-tab & vMix/OBS live sync
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetRoom = params.get("room") || getSavedRoomId();
    const targetTopic = params.get("topic") || getSavedTopic();

    // 0. MQTT WebSockets Sync (Ultra fast & 100% reliable for vMix across any network/browser)
    const mqttSub = new MqttSubscriber(targetTopic, (payload) => {
      if (payload.interimText !== undefined) setInterimText(payload.interimText);
      if (payload.currentSubtitle !== undefined) setCurrentSubtitle(payload.currentSubtitle);
      if (payload.settings) setSettings(payload.settings);
      if (payload.isListening !== undefined) setIsListening(payload.isListening);
    });

    // 1. WebRTC PeerJS Sync
    const clientPeer = new ClientPeerManager(
      targetRoom,
      (payload) => {
        if (payload.interimText !== undefined) setInterimText(payload.interimText);
        if (payload.currentSubtitle !== undefined) setCurrentSubtitle(payload.currentSubtitle);
        if (payload.settings) setSettings(payload.settings);
        if (payload.isListening !== undefined) setIsListening(payload.isListening);
      }
    );

    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel("scribe_subtitles_channel");
      bc.onmessage = (event) => {
        if (event.data) {
          if (event.data.interimText !== undefined) setInterimText(event.data.interimText);
          if (event.data.currentSubtitle !== undefined) setCurrentSubtitle(event.data.currentSubtitle);
          if (event.data.settings) setSettings(event.data.settings);
          if (event.data.isListening !== undefined) setIsListening(event.data.isListening);
        }
      };
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "scribe_live_state" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.interimText !== undefined) setInterimText(parsed.interimText);
          if (parsed.currentSubtitle !== undefined) setCurrentSubtitle(parsed.currentSubtitle);
          if (parsed.settings) setSettings(parsed.settings);
          if (parsed.isListening !== undefined) setIsListening(parsed.isListening);
        } catch (err) {
          console.error("Storage sync error", err);
        }
      }
    };

    window.addEventListener("storage", handleStorage);

    // Initial read from localStorage
    const stored = localStorage.getItem("scribe_live_state");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.interimText !== undefined) setInterimText(parsed.interimText);
        if (parsed.currentSubtitle !== undefined) setCurrentSubtitle(parsed.currentSubtitle);
        if (parsed.settings) setSettings(parsed.settings);
        if (parsed.isListening !== undefined) setIsListening(parsed.isListening);
      } catch (err) {}
    }

    // Server HTTP polling loop
    let lastFetchedTime = 0;
    const pollServerState = async () => {
      try {
        const res = await fetch("/api/live-state");
        if (res.ok) {
          const data = await res.json();
          if (data && data.updatedAt && data.updatedAt > lastFetchedTime) {
            lastFetchedTime = data.updatedAt;
            if (data.interimText !== undefined) setInterimText(data.interimText);
            if (data.currentSubtitle !== undefined) setCurrentSubtitle(data.currentSubtitle);
            if (data.settings) setSettings(data.settings);
            if (data.isListening !== undefined) setIsListening(data.isListening);
          }
        }
      } catch (err) {}
    };

    const pollInterval = window.setInterval(pollServerState, 200);

    return () => {
      mqttSub.destroy();
      clientPeer.destroy();
      if (bc) bc.close();
      window.removeEventListener("storage", handleStorage);
      window.clearInterval(pollInterval);
    };
  }, []);

  // Compute active text
  const activeText = interimText || currentSubtitle?.text || "";
  const isInterim = !!interimText;

  // Format into lines bounded by maxWordsPerLine
  const formatSubtitleLines = (text: string, maxWords: number = 10, maxLines: number = 2) => {
    if (!text) return [];
    const words = text.trim().split(/\s+/);
    if (words.length === 0 || words[0] === "") return [];

    const lines: string[] = [];
    let currentLine: string[] = [];

    for (const word of words) {
      currentLine.push(word);
      if (currentLine.length >= maxWords) {
        lines.push(currentLine.join(" "));
        currentLine = [];
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine.join(" "));
    }

    return lines.slice(-maxLines);
  };

  const formattedLines = formatSubtitleLines(
    activeText,
    settings.maxWordsPerLine || 10,
    settings.maxLines || 2
  );

  // Text Styling (Color, Border, Shadow, Font)
  const getTextStyle = (): React.CSSProperties => {
    const textColor = settings.textColor || "#ffffff";
    const borderColor = settings.textBorderColor || "#000000";
    const hasBorder = settings.textBorder ?? true;
    const borderSize = settings.textBorderSize || "medium";
    const fontCss = fontFamilyMap[settings.fontFamily || "montserrat"] || "'Montserrat', sans-serif";

    let textShadow = "none";
    let webkitTextStroke = "none";

    if (hasBorder) {
      if (borderSize === "thin") {
        textShadow = `-1px -1px 0 ${borderColor}, 1px -1px 0 ${borderColor}, -1px 1px 0 ${borderColor}, 1px 1px 0 ${borderColor}, 0 2px 4px rgba(0,0,0,0.8)`;
        webkitTextStroke = `0.5px ${borderColor}`;
      } else if (borderSize === "thick") {
        textShadow = `-3px -3px 0 ${borderColor}, 3px -3px 0 ${borderColor}, -3px 3px 0 ${borderColor}, 3px 3px 0 ${borderColor}, 0 -3px 0 ${borderColor}, 0 3px 0 ${borderColor}, -3px 0 0 ${borderColor}, 3px 0 0 ${borderColor}, 0 4px 10px rgba(0,0,0,0.95)`;
        webkitTextStroke = `1.5px ${borderColor}`;
      } else {
        textShadow = `-2px -2px 0 ${borderColor}, 2px -2px 0 ${borderColor}, -2px 2px 0 ${borderColor}, 2px 2px 0 ${borderColor}, 0 2px 5px rgba(0,0,0,0.85)`;
        webkitTextStroke = `1px ${borderColor}`;
      }
    }

    return {
      color: textColor,
      fontFamily: fontCss,
      textShadow,
      WebkitTextStroke: webkitTextStroke,
    };
  };

  // Outer page background class/style
  const outerBgClasses = {
    transparent: "bg-transparent",
    green: "bg-[#00FF00]",
    blue: "bg-[#0000FF]",
    black: "bg-[#000000]",
  };

  // Auto-fitting Pill Background Style
  const pillStyle: React.CSSProperties = {
    backgroundColor: hexToRgba(settings.bgColor || "#0a0a0c", settings.bgOpacity ?? 90),
  };

  // Vertical position class
  const verticalPositionClass = {
    top: "items-start pt-12 sm:pt-16",
    center: "items-center",
    bottom: "items-end pb-12 sm:pb-16",
  }[settings.overlayPosition || "bottom"];

  const handleCopyOverlayUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const targetRoom = params.get("room") || getSavedRoomId();
    const baseUrl = `${window.location.origin}${window.location.pathname}?mode=overlay&chroma=${outerBg}&room=${targetRoom}`;
    navigator.clipboard.writeText(baseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className={`fixed inset-0 w-screen h-screen flex justify-center px-6 transition-colors duration-300 select-none overflow-hidden ${
        outerBgClasses[outerBg]
      } ${verticalPositionClass}`}
    >
      {/* Floating Toolbar (Auto-hides on inactivity) */}
      <div
        className={`fixed top-4 right-4 z-50 flex items-center gap-2 bg-[#0E0E12]/95 backdrop-blur-md p-2 rounded-xl border border-white/10 text-xs text-white shadow-2xl transition-all duration-300 ${
          showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        {/* Chroma Key Outer Background Switcher */}
        <div className="flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-white/10">
          <span className="text-[10px] text-slate-300 font-bold px-1 uppercase hidden sm:inline">Fondo Pantalla:</span>
          <button
            onClick={() => setOuterBg("green")}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition ${
              outerBg === "green" ? "bg-emerald-500 text-black shadow" : "text-slate-300 hover:text-white"
            }`}
            title="Fondo Verde Croma (#00FF00) - Ideal para filtro Croma Key en OBS / vMix"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#00FF00] border border-black/40" />
            Verde Croma
          </button>
          <button
            onClick={() => setOuterBg("transparent")}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
              outerBg === "transparent" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
            title="Fondo Transparente - Para fuente de navegador con transparencia alfa en OBS"
          >
            Transparente
          </button>
          <button
            onClick={() => setOuterBg("blue")}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition ${
              outerBg === "blue" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
            title="Fondo Azul (#0000FF)"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#0000FF] border border-black/50" />
            Azul
          </button>
          <button
            onClick={() => setOuterBg("black")}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition ${
              outerBg === "black" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
            }`}
            title="Fondo Negro (#000000)"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-black border border-white/30" />
            Negro
          </button>
        </div>

        {/* Test Subtitle Button */}
        <button
          onClick={handleTestSubtitle}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition shadow"
          title="Ver cómo queda un subtítulo de prueba sobre la pastilla"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-200" />
          <span>Probar Subtítulo</span>
        </button>

        {/* Local Mic Toggle Button */}
        <button
          onClick={handleToggleLocalListening}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition shadow ${
            isLocalListening
              ? "bg-red-600 hover:bg-red-500 text-white animate-pulse"
              : "bg-emerald-600 hover:bg-emerald-500 text-white"
          }`}
          title="Escuchar micrófono directamente en esta ventana de OBS"
        >
          {isLocalListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          <span>{isLocalListening ? "Detener Micro" : "Activar Micro"}</span>
        </button>

        {/* Toggle Silence Hint */}
        <button
          onClick={() => setShowSilenceHint(!showSilenceHint)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${
            showSilenceHint
              ? "bg-indigo-600/80 text-white border-indigo-400"
              : "bg-black/40 text-slate-400 border-white/10 hover:text-white"
          }`}
          title="Mostrar u ocultar la pastilla informativa 'Esperando voz...' cuando nadie habla"
        >
          {showSilenceHint ? "Aviso Silencio: SÍ" : "Aviso Silencio: NO"}
        </button>

        {/* Copy OBS URL */}
        <button
          onClick={handleCopyOverlayUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition shadow"
          title="Copiar URL pública sin autenticación (ais-pre-...) para vMix / OBS Studio"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "¡URL Pública Copiada!" : "Copiar URL OBS / vMix"}</span>
        </button>

        {/* Back to main app */}
        <button
          onClick={() => {
            window.location.search = "";
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white rounded-lg transition"
          title="Volver a la aplicación principal"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Volver</span>
        </button>
      </div>

      {/* Main Subtitle Box ("Pastilla que encaje al subtitulo") */}
      <div className="w-full flex justify-center text-center my-auto max-w-5xl">
        {formattedLines.length > 0 ? (
          <div
            style={{
              ...pillStyle,
              ...getTextStyle(),
            }}
            className={`inline-block px-8 py-4 sm:px-10 sm:py-5 rounded-3xl shadow-2xl backdrop-blur-md transition-all duration-150 max-w-[92vw] text-center ${
              fontSizeClasses[settings.fontSize || "lg"]
            }`}
          >
            <div className="flex flex-col items-center justify-center gap-1">
              {formattedLines.map((lineText, idx) => (
                <p key={idx} className="m-0 p-0 tracking-wide text-center leading-snug">
                  {idx === 0 && currentSubtitle?.speaker && !isInterim && settings.showSpeakers && (
                    <span className="font-bold text-indigo-400 mr-2">[{currentSubtitle.speaker}]:</span>
                  )}
                  {lineText}
                  {idx === formattedLines.length - 1 && isInterim && (
                    <span className="inline-block w-2 h-5 bg-indigo-400 ml-1.5 animate-pulse rounded-full align-middle" />
                  )}
                </p>
              ))}
            </div>
          </div>
        ) : showSilenceHint ? (
          /* Subtle listening status hint if enabled */
          <div
            style={pillStyle}
            className="inline-block px-6 py-2.5 rounded-full text-slate-300/80 text-sm font-medium border border-white/10 backdrop-blur-md shadow-lg"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isListening ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
              <span>{isListening ? "Esperando voz..." : "Transcripción pausada"}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

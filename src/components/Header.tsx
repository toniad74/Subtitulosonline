import React, { useState } from "react";
import { Mic, MicOff, Settings, Sparkles, FileText, Download, Volume2, Radio, Tv, ExternalLink, Check, Copy } from "lucide-react";
import { AudioDeviceOption, SubtitleSettings } from "../types";
import { getSavedRoomId } from "../utils/peerSync";

interface HeaderProps {
  isListening: boolean;
  onToggleListening: () => void;
  selectedDeviceLabel: string;
  onOpenAudioSettings: () => void;
  onOpenAISettings: () => void;
  onOpenSummary: () => void;
  onExport: () => void;
  subtitleCount: number;
  audioLevel: number;
  settings: SubtitleSettings;
}

export const Header: React.FC<HeaderProps> = ({
  isListening,
  onToggleListening,
  selectedDeviceLabel,
  onOpenAudioSettings,
  onOpenAISettings,
  onOpenSummary,
  onExport,
  subtitleCount,
  audioLevel,
  settings,
}) => {
  const [copiedObs, setCopiedObs] = useState(false);
  const [showObsHelp, setShowObsHelp] = useState(false);

  const getOverlayUrl = () => {
    const roomId = getSavedRoomId();
    return `${window.location.origin}${window.location.pathname}?mode=overlay&chroma=green&room=${roomId}`;
  };

  const handleOpenOverlay = () => {
    window.open(getOverlayUrl(), "_blank");
  };

  const handleCopyObsUrl = (urlToCopy: string) => {
    navigator.clipboard.writeText(urlToCopy);
    setCopiedObs(true);
    setTimeout(() => setCopiedObs(false), 2000);
  };
  return (
    <header className="sticky top-0 z-40 bg-[#0E0E12]/90 backdrop-blur-md border-b border-[#1F1F23] text-[#E0E0E6] px-4 py-3 shadow-2xl">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Logo & Status */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-xl shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">
                Subtítulos IA en Vivo
              </h1>
              <p className="text-[11px] text-[#6B6B76] hidden sm:block font-medium">
                ScribeAI • Transcripción en tiempo real
              </p>
            </div>
          </div>

          {/* Quick status pill */}
          <div className="flex items-center gap-2 bg-[#16161D] px-3 py-1.5 rounded-full border border-[#2A2A32] text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isListening ? "bg-emerald-400 animate-ping" : "bg-[#6B6B76]"
              }`}
            />
            <span className="font-medium text-gray-300">
              {isListening ? "Escuchando" : "Detenido"}
            </span>
            {isListening && audioLevel > 0 && (
              <div className="flex items-center gap-0.5 ml-1">
                {[1, 2, 3].map((bar) => (
                  <span
                    key={bar}
                    className="w-1 bg-indigo-400 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(4, Math.min(16, (audioLevel / 100) * 16 * (bar / 2)))}px`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Audio device shortcut & Main controls */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-center md:justify-end">
          {/* Active Audio Input Button */}
          <button
            onClick={onOpenAudioSettings}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#16161D] hover:bg-[#1F1F26] text-gray-300 hover:text-white rounded-lg border border-[#2A2A32] transition text-xs max-w-[200px] truncate"
            title="Configurar entrada de audio"
          >
            <Radio className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">{selectedDeviceLabel || "Dispositivo de audio"}</span>
          </button>

          {/* AI Settings Button */}
          <button
            onClick={onOpenAISettings}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#16161D] hover:bg-[#1F1F26] text-gray-300 hover:text-white rounded-lg border border-[#2A2A32] transition text-xs"
            title="Ajustes de IA e Idioma"
          >
            <Settings className="w-3.5 h-3.5 text-[#6B6B76]" />
            <span>IA: {settings.targetLanguage.toUpperCase()}</span>
          </button>

          {/* OBS / Chroma Key Overlay Button */}
          <div className="flex items-center rounded-lg border border-purple-500/30 bg-purple-500/10 p-0.5 text-purple-300 text-xs">
            <button
              onClick={handleOpenOverlay}
              className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-purple-500/20 rounded-md transition font-medium"
              title="Abrir ventana limpia de subtítulos en vivo"
            >
              <Tv className="w-3.5 h-3.5 text-purple-400" />
              <span>Modo OBS / Chroma</span>
            </button>
            <button
              onClick={() => setShowObsHelp(true)}
              className="px-2 py-1 hover:bg-purple-500/20 rounded-md transition text-purple-200 border-l border-purple-500/20 font-bold"
              title="Ver enlace y ayuda de configuración para vMix y OBS Studio"
            >
              vMix / OBS ➔
            </button>
          </div>

          {/* Modal de Ayuda para vMix / OBS */}
          {showObsHelp && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setShowObsHelp(false)}>
              <div className="bg-[#12121A] border border-[#2B2B38] rounded-2xl max-w-md w-full p-5 text-left shadow-2xl text-gray-200 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-[#2B2B38] pb-3">
                  <div className="flex items-center gap-2">
                    <Tv className="w-5 h-5 text-purple-400 shrink-0" />
                    <h3 className="font-bold text-white text-sm">Conexión con vMix y OBS</h3>
                  </div>
                  <button
                    onClick={() => setShowObsHelp(false)}
                    className="text-gray-400 hover:text-white text-xl font-bold px-2 py-0.5 shrink-0"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 text-xs leading-relaxed text-gray-300">
                  <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-xl space-y-2">
                    <p className="font-bold text-purple-300 text-xs">URL para vMix / OBS</p>
                    <p className="text-[11px]">Añade un <strong>Web Browser Input</strong> con este enlace:</p>
                    <div className="flex flex-col gap-2 bg-[#0A0A0F] p-2 rounded-lg border border-[#2B2B38]">
                      <span className="font-mono text-[10px] text-purple-200 break-all leading-tight">{getOverlayUrl()}</span>
                      <button
                        onClick={() => handleCopyObsUrl(getOverlayUrl())}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold text-xs w-full transition"
                      >
                        {copiedObs ? "¡URL Copiada!" : "Copiar URL"}
                      </button>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-gray-300 pt-1 text-[11px]">
                      <li>Señal en <strong>tiempo real por WebRTC</strong> entre tu navegador y vMix.</li>
                      <li>En vMix, aplica filtro <strong>Chroma Key</strong> (Verde <code className="text-emerald-300">#00FF00</code>).</li>
                    </ul>
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    onClick={() => setShowObsHelp(false)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Summary button */}
          <button
            onClick={onOpenSummary}
            disabled={subtitleCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-lg transition text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Resumen IA</span>
          </button>

          {/* Export */}
          <button
            onClick={onExport}
            disabled={subtitleCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#16161D] hover:bg-[#1F1F26] border border-[#2A2A32] text-gray-300 hover:text-white rounded-lg transition text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar subtítulos (.srt, .txt, .vtt)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar ({subtitleCount})</span>
          </button>

          {/* Record Toggle Button */}
          <button
            onClick={onToggleListening}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs tracking-wider transition shadow-lg active:scale-95 ${
              isListening
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30"
                : "bg-white hover:bg-gray-200 text-black shadow-white/10"
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4 animate-bounce" />
                <span>DETENER SESIÓN</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>INICIAR SUBTÍTULOS</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

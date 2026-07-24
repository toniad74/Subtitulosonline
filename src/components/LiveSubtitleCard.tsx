import React, { useState } from "react";
import { Sparkles, User, Maximize2, Minimize2, Copy, Check, Palette, Type, SquareDot } from "lucide-react";
import { SubtitleItem, SubtitleSettings, SubtitleDisplayStyle } from "../types";
import { formatProfessionalSubtitles } from "../utils/subtitleFormatter";

interface LiveSubtitleCardProps {
  currentSubtitle: SubtitleItem | null;
  interimText: string;
  isListening: boolean;
  isAIRefining: boolean;
  settings: SubtitleSettings;
  onUpdateSettings: (newSettings: Partial<SubtitleSettings>) => void;
}

const hexToRgba = (hex: string, opacity: number = 100) => {
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

export const LiveSubtitleCard: React.FC<LiveSubtitleCardProps> = ({
  currentSubtitle,
  interimText,
  isListening,
  isAIRefining,
  settings,
  onUpdateSettings,
}) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const showPartial = settings.showInterim ?? true;
  const activeText = interimText || currentSubtitle?.text || "";
  const activeSpeaker = interimText ? undefined : currentSubtitle?.speaker;
  const isInterim = !!interimText;

  const formattedLines = formatProfessionalSubtitles(
    activeText,
    settings.maxWordsPerLine || 10,
    settings.maxLines || 2
  );

  const handleCopy = () => {
    if (!activeText) return;
    navigator.clipboard.writeText(activeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Font size mapping
  const fontSizeClasses = {
    sm: "text-base sm:text-lg",
    md: "text-lg sm:text-xl",
    lg: "text-xl sm:text-2xl",
    xl: "text-2xl sm:text-3xl font-semibold",
    "2xl": "text-3xl sm:text-4xl font-bold",
    "3xl": "text-4xl sm:text-5xl font-extrabold tracking-tight",
  };

  const fontFamilyMap: Record<SubtitleSettings["fontFamily"], { name: string; fontCss: string }> = {
    inter: { name: "Inter (Limpia)", fontCss: "'Inter', sans-serif" },
    oswald: { name: "Oswald (Cine)", fontCss: "'Oswald', sans-serif" },
    montserrat: { name: "Montserrat (Moderna)", fontCss: "'Montserrat', sans-serif" },
    playfair: { name: "Playfair (Elegante)", fontCss: "'Playfair Display', serif" },
    firacode: { name: "Fira Code (Mono)", fontCss: "'Fira Code', monospace" },
    quicksand: { name: "Quicksand (Suave)", fontCss: "'Quicksand', sans-serif" },
    caveat: { name: "Caveat (Manuscrita)", fontCss: "'Caveat', cursive" },
  };

  // Subtitle text styling (Color + Border/Stroke + Shadow + Font)
  const getTextStyle = (): React.CSSProperties => {
    const textColor = settings.textColor || "#ffffff";
    const borderColor = settings.textBorderColor || "#000000";
    const hasBorder = settings.textBorder ?? true;
    const borderSize = settings.textBorderSize || "medium";
    const fontCss = fontFamilyMap[settings.fontFamily || "montserrat"]?.fontCss || "'Montserrat', sans-serif";

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
        // medium
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

  // Dynamic Background Style
  const cardBgStyle: React.CSSProperties = {
    backgroundColor: hexToRgba(settings.bgColor || "#0a0a0c", settings.bgOpacity ?? 90),
  };

  return (
    <div
      style={cardBgStyle}
      className={`relative w-full transition-all duration-300 rounded-2xl border border-white/10 p-6 flex flex-col justify-between min-h-[180px] sm:min-h-[220px] shadow-2xl backdrop-blur-md ${
        isExpanded ? "min-h-[340px]" : ""
      }`}
    >
      {/* Subtitle Card Header Bar */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 font-semibold tracking-wider text-[11px] uppercase text-white">
            <span
              className={`w-2 h-2 rounded-full ${
                isListening ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
              }`}
            />
            {isListening ? "Subtítulos en Vivo" : "En Espera"}
          </span>

          {isAIRefining && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 animate-pulse text-[11px]">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Procesando IA Gemini...
            </span>
          )}

          {activeSpeaker && settings.showSpeakers && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-600 text-white font-medium text-[11px]">
              <User className="w-3 h-3" />
              {activeSpeaker}
            </span>
          )}
        </div>

        {/* Quick Customization Toolbar */}
        <div className="flex items-center gap-2 opacity-90 hover:opacity-100 transition flex-wrap justify-end">
          {/* Quick Font Selector */}
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/10 text-white" title="Tipografía del Subtítulo">
            <Type className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={settings.fontFamily || "montserrat"}
              onChange={(e) => onUpdateSettings({ fontFamily: e.target.value as any })}
              className="bg-transparent text-white text-[11px] font-medium border-0 focus:outline-none cursor-pointer pr-1"
            >
              <option value="montserrat" className="bg-[#16161D] text-white">Montserrat</option>
              <option value="oswald" className="bg-[#16161D] text-white">Oswald (Cine)</option>
              <option value="inter" className="bg-[#16161D] text-white">Inter</option>
              <option value="playfair" className="bg-[#16161D] text-white">Playfair (Serif)</option>
              <option value="firacode" className="bg-[#16161D] text-white">Fira Code (Mono)</option>
              <option value="quicksand" className="bg-[#16161D] text-white">Quicksand</option>
              <option value="caveat" className="bg-[#16161D] text-white">Caveat (Manuscrita)</option>
            </select>
          </div>

          {/* Quick Color Picker: Background */}
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/10 text-white" title="Color de Fondo">
            <span className="text-[10px] font-medium text-slate-300 hidden md:inline">Fondo:</span>
            <input
              type="color"
              value={settings.bgColor || "#0a0a0c"}
              onChange={(e) => onUpdateSettings({ bgColor: e.target.value })}
              className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0"
            />
          </div>

          {/* Quick Color Picker: Subtitle Text */}
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/10 text-white" title="Color de Texto del Subtítulo">
            <span className="text-[10px] font-medium text-slate-300 hidden md:inline">Texto:</span>
            <input
              type="color"
              value={settings.textColor || "#ffffff"}
              onChange={(e) => onUpdateSettings({ textColor: e.target.value })}
              className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0"
            />
          </div>

          {/* Quick Toggle: Text Border */}
          <button
            onClick={() => onUpdateSettings({ textBorder: !settings.textBorder })}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition ${
              settings.textBorder
                ? "bg-indigo-600 text-white border-indigo-400 shadow"
                : "bg-black/40 text-slate-400 border-white/10 hover:text-white"
            }`}
            title={settings.textBorder ? "Quitar borde al texto" : "Añadir borde al texto"}
          >
            <Type className="w-3 h-3" />
            <span className="hidden sm:inline">{settings.textBorder ? "Borde SÍ" : "Borde NO"}</span>
          </button>

          {/* Font Size controls */}
          <div className="flex items-center bg-black/40 rounded-lg border border-white/10 p-0.5 text-white">
            <button
              onClick={() => {
                const sizes: SubtitleSettings["fontSize"][] = ["sm", "md", "lg", "xl", "2xl", "3xl"];
                const currentIndex = sizes.indexOf(settings.fontSize);
                if (currentIndex > 0) onUpdateSettings({ fontSize: sizes[currentIndex - 1] });
              }}
              className="px-1.5 py-0.5 hover:bg-white/10 rounded transition text-xs font-bold"
              title="Reducir tamaño"
            >
              A-
            </button>
            <button
              onClick={() => {
                const sizes: SubtitleSettings["fontSize"][] = ["sm", "md", "lg", "xl", "2xl", "3xl"];
                const currentIndex = sizes.indexOf(settings.fontSize);
                if (currentIndex < sizes.length - 1) onUpdateSettings({ fontSize: sizes[currentIndex + 1] });
              }}
              className="px-1.5 py-0.5 hover:bg-white/10 rounded transition text-sm font-bold"
              title="Aumentar tamaño"
            >
              A+
            </button>
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            disabled={!activeText}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white transition disabled:opacity-30"
            title="Copiar texto actual"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Expand toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white transition"
            title="Expandir vista"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Central Subtitle Text Area */}
      <div className="my-auto py-4 px-2 text-center flex flex-col items-center justify-center min-h-[120px]">
        {formattedLines.length > 0 ? (
          <div
            style={getTextStyle()}
            className={`${fontSizeClasses[settings.fontSize]} leading-relaxed transition-all duration-150 flex flex-col items-center justify-center gap-1.5 font-sans`}
          >
            {formattedLines.map((lineText, idx) => (
              <p key={idx} className="m-0 p-0 text-center tracking-wide">
                {idx === 0 && activeSpeaker && settings.showSpeakers && (
                  <span className="font-bold text-indigo-400 mr-2 drop-shadow-sm">[{activeSpeaker}]:</span>
                )}
                {lineText}
                {idx === formattedLines.length - 1 && isInterim && (
                  <span className="inline-block w-2 h-5 bg-indigo-400 ml-1.5 animate-pulse align-middle" />
                )}
              </p>
            ))}
          </div>
        ) : (
          <div className="py-6 min-h-[60px]" />
        )}
      </div>

      {/* Subtitle Footer Bar */}
      <div className="flex items-center justify-between text-[11px] pt-3 border-t border-white/10 text-slate-300">
        <span>
          {currentSubtitle?.timestamp ? `Hora: ${currentSubtitle.timestamp}` : "Tiempo real"}
        </span>
        <span className="hidden sm:inline">
          Formato: {settings.maxWordsPerLine || 10} p/línea • Máx {settings.maxLines || 2} líneas {settings.aiAutoRefine ? "• Refinado IA ✨" : ""}
        </span>
      </div>
    </div>
  );
};


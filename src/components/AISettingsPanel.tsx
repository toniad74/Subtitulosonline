import React, { useState } from "react";
import { Sparkles, Globe, BookOpen, Users, Sliders, X, Check, Brain, AlignLeft, Palette, Type, Laptop, SquareDot, Key } from "lucide-react";
import { SubtitleSettings } from "../types";
import { DEFAULT_FONTS, getInstalledSystemFonts, FontOption } from "../utils/fonts";
import { getGeminiApiKey, setGeminiApiKey } from "../utils/geminiClient";

interface AISettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SubtitleSettings;
  onUpdateSettings: (newSettings: Partial<SubtitleSettings>) => void;
}

const LANGUAGES = [
  { code: "es-ES", label: "Español (España)" },
  { code: "ca-ES", label: "Català (Catalán)" },
  { code: "es-MX", label: "Español (Latinoamérica)" },
  { code: "en-US", label: "English (US / UK)" },
  { code: "fr-FR", label: "Français (Francia)" },
  { code: "de-DE", label: "Deutsch (Alemania)" },
  { code: "it-IT", label: "Italiano (Italia)" },
  { code: "pt-BR", label: "Português (Brasil / Portugal)" },
  { code: "zh-CN", label: "中文 (Chino Simplificado)" },
  { code: "ja-JP", label: "日本語 (Japonés)" },
];

export const AISettingsPanel: React.FC<AISettingsPanelProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [apiKey, setApiKey] = useState(() => getGeminiApiKey() || "");
  if (!isOpen) return null;

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    setGeminiApiKey(key);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#0E0E12] border border-[#1F1F23] rounded-2xl w-full max-w-xl text-[#E0E0E6] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F1F23] bg-[#0A0A0C]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">Configuración de Inteligencia Artificial</h2>
              <p className="text-xs text-[#6B6B76]">
                Ajusta idiomas, refinado contextual y separación de hablantes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#6B6B76] hover:text-white rounded-lg hover:bg-[#16161D] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Languages Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Source Audio Language */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-[#6B6B76] font-bold flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                Idioma del Audio (Escuchado)
              </label>
              <select
                value={settings.sourceLanguage}
                onChange={(e) => onUpdateSettings({ sourceLanguage: e.target.value })}
                className="w-full bg-[#16161D] border border-[#2A2A32] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Subtitle Language */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-[#6B6B76] font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Idioma Subtítulo (Traducción IA)
              </label>
              <select
                value={settings.targetLanguage}
                onChange={(e) => onUpdateSettings({ targetLanguage: e.target.value })}
                className="w-full bg-[#16161D] border border-[#2A2A32] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* AI Auto-Refine Toggle */}
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white">Refinado Inteligente en Tiempo Real</span>
              </div>
              <input
                type="checkbox"
                checked={settings.aiAutoRefine}
                onChange={(e) => onUpdateSettings({ aiAutoRefine: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-[#2A2A32] focus:ring-indigo-500 bg-[#0E0E12]"
              />
            </div>
            <p className="text-[11px] text-[#E0E0E6] leading-relaxed">
              Utiliza Gemini para corregir la puntuación, unir frases naturales, eliminar repeticiones de la voz y traducir automáticamente los subtítulos.
            </p>
          </div>

          {/* Gemini API Key Card */}
          <div className="p-4 bg-[#16161D] border border-indigo-500/30 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-white">Clave API de Google Gemini (Gratuita)</span>
            </div>
            <p className="text-[11px] text-[#A0A0AB] leading-relaxed">
              Introduce tu clave API de Gemini para habilitar la transcripción directa del audio del sistema y vMix en el navegador.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="password"
                placeholder="Pega aquí tu Gemini API Key (AIzaSy...)"
                value={apiKey}
                onChange={(e) => handleSaveApiKey(e.target.value)}
                className="flex-1 bg-[#0E0E12] border border-[#2A2A32] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
              {apiKey && (
                <span className="text-[10px] text-emerald-400 font-bold px-2 py-1 bg-emerald-500/10 rounded border border-emerald-500/20 shrink-0 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Configurada
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-500 pt-0.5">
              ¿No tienes clave? Obtén una gratis en <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Google AI Studio</a>.
            </p>
          </div>

          {/* Speaker Identification Toggle */}
          <div className="p-4 bg-[#16161D] border border-[#2A2A32] rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#6B6B76]" />
                <span className="text-xs font-bold text-white">Identificación e Intercalado de Hablantes</span>
              </div>
              <input
                type="checkbox"
                checked={settings.showSpeakers}
                onChange={(e) => onUpdateSettings({ showSpeakers: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-[#2A2A32] focus:ring-indigo-500 bg-[#0E0E12]"
              />
            </div>
            <p className="text-[11px] text-[#6B6B76]">
              Muestra etiquetas distintivas (ej: Hablante 1, Hablante 2) cuando se detecte cambio de turno conversacional.
            </p>
          </div>

          {/* Subtitle Line & Length Constraints */}
          <div className="p-4 bg-[#16161D] border border-[#2A2A32] rounded-xl space-y-4">
            <div className="flex items-center gap-2">
              <AlignLeft className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-white">Formato y Visualización de Frases</span>
            </div>
            
            {/* Show Interim Toggle */}
            <div className="flex items-center justify-between pt-1 pb-2 border-b border-[#2A2A32]">
              <div>
                <p className="text-xs font-medium text-white">Modo Frases Completas</p>
                <p className="text-[10px] text-[#6B6B76]">
                  {settings.showInterim 
                    ? "Construye el texto palabra por palabra mientras se habla." 
                    : "Muestra la frase completa únicamente al terminar de hablar."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ showInterim: !settings.showInterim })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  !settings.showInterim ? "bg-indigo-600" : "bg-[#2A2A32]"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    !settings.showInterim ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Max words per line */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="text-[10px] uppercase tracking-widest text-[#6B6B76] font-bold">
                    Palabras por línea
                  </label>
                  <span className="font-mono text-indigo-400 text-xs font-bold">{settings.maxWordsPerLine || 10} palabras</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={20}
                  step={1}
                  value={settings.maxWordsPerLine || 10}
                  onChange={(e) => onUpdateSettings({ maxWordsPerLine: Number(e.target.value) })}
                  className="w-full accent-indigo-500 bg-[#0E0E12] cursor-pointer"
                />
              </div>

              {/* Max lines per block */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="text-[10px] uppercase tracking-widest text-[#6B6B76] font-bold">
                    Máximo de líneas
                  </label>
                  <span className="font-mono text-indigo-400 text-xs font-bold">{settings.maxLines || 2} líneas</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  value={settings.maxLines || 2}
                  onChange={(e) => onUpdateSettings({ maxLines: Number(e.target.value) })}
                  className="w-full accent-indigo-500 bg-[#0E0E12] cursor-pointer"
                />
              </div>
            </div>
            <p className="text-[10px] text-[#6B6B76]">
              Ajusta la densidad en pantalla. Por defecto: máximo 10 palabras por línea y 2 líneas simultáneas.
            </p>

            {/* Silence clearing timeout control */}
            <div className="space-y-1.5 pt-3 border-t border-[#2A2A32]">
              <div className="flex justify-between items-center text-xs">
                <span className="text-xs font-medium text-white flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  Limpieza automática tras silencio
                </span>
                <span className="font-mono text-indigo-400 font-bold">{((settings.silenceTimeoutMs || 2000) / 1000).toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={1000}
                max={4000}
                step={500}
                value={settings.silenceTimeoutMs || 2000}
                onChange={(e) => onUpdateSettings({ silenceTimeoutMs: Number(e.target.value) })}
                className="w-full accent-indigo-500 bg-[#0E0E12] cursor-pointer"
              />
              <p className="text-[10px] text-[#6B6B76]">
                Tiempo en segundos antes de limpiar la pantalla cuando dejas de hablar (1.0s ultra rápido, 2.0s estándar).
              </p>
            </div>
          </div>

          {/* Visual Customization: Background Color, Subtitle Color, Typography, and Border */}
          <div className="p-4 bg-[#16161D] border border-[#2A2A32] rounded-xl space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-white">Diseño Visual: Color, Borde y Tipografía</span>
            </div>

            {/* Typography / Font Family Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-widest text-[#6B6B76] font-bold flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-indigo-400" />
                  Fuente / Tipografía del Subtítulo
                </label>
              </div>

              {/* Font Selector Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                {DEFAULT_FONTS.map((font) => {
                  const isSelected = (settings.fontFamily || "montserrat") === font.id;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => onUpdateSettings({ fontFamily: font.id })}
                      className={`p-2 rounded-lg border text-left transition flex flex-col justify-between ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500/20 text-white shadow"
                          : "border-[#2A2A32] bg-[#0E0E12] text-slate-300 hover:border-slate-600 hover:text-white"
                      }`}
                    >
                      <span className="text-sm font-semibold truncate" style={{ fontFamily: font.fontCss }}>
                        Subtítulo Aa
                      </span>
                      <span className="text-[10px] text-[#6B6B76] mt-1 font-sans truncate">{font.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pill Shape / Border Radius Selection */}
            <div className="space-y-2 pt-2 border-t border-[#2A2A32]">
              <label className="text-[10px] uppercase tracking-widest text-[#6B6B76] font-bold flex items-center gap-1.5">
                <SquareDot className="w-3.5 h-3.5 text-indigo-400" />
                Forma de las Esquinas de la Pastilla
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: "none", name: "Rectas", desc: "0px (Ángulo 90°)" },
                  { id: "sm", name: "Suaves", desc: "8px (Ligero)" },
                  { id: "md", name: "Redondeadas", desc: "16px (Estándar)" },
                  { id: "lg", name: "Amplias", desc: "24px (Curvo)" },
                  { id: "full", name: "Ovalada", desc: "Píldora Total" },
                ].map((shape) => {
                  const isSelected = (settings.borderRadius || "lg") === shape.id;
                  return (
                    <button
                      key={shape.id}
                      type="button"
                      onClick={() => onUpdateSettings({ borderRadius: shape.id as any })}
                      className={`p-2 rounded-lg border text-center transition flex flex-col items-center justify-center ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500/20 text-white shadow"
                          : "border-[#2A2A32] bg-[#0E0E12] text-slate-300 hover:border-slate-600 hover:text-white"
                      }`}
                    >
                      <span className="text-xs font-bold">{shape.name}</span>
                      <span className="text-[9px] text-[#6B6B76] mt-0.5">{shape.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Background Color & Opacity */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-xs font-medium text-white">Color de Fondo del Cuadro</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.bgColor || "#0a0a0c"}
                    onChange={(e) => onUpdateSettings({ bgColor: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="font-mono text-[11px] text-indigo-300 font-bold uppercase">{settings.bgColor || "#0a0a0c"}</span>
                </div>
              </div>
              {/* Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { name: "Noche", color: "#0a0a0c" },
                  { name: "Negro Puro", color: "#000000" },
                  { name: "Azul Cine", color: "#0f172a" },
                  { name: "Verde Croma", color: "#00ff00" },
                  { name: "Púrpura", color: "#1e1b4b" },
                  { name: "Blanco", color: "#ffffff" },
                ].map((preset) => (
                  <button
                    key={preset.color}
                    type="button"
                    onClick={() => onUpdateSettings({ bgColor: preset.color })}
                    className={`px-2 py-1 rounded text-[10px] font-medium border flex items-center gap-1.5 transition ${
                      settings.bgColor === preset.color
                        ? "border-indigo-500 bg-indigo-500/20 text-white"
                        : "border-[#2A2A32] text-[#6B6B76] hover:text-white"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: preset.color }} />
                    {preset.name}
                  </button>
                ))}
              </div>

              {/* Opacity Slider */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-[#6B6B76] font-bold uppercase">Opacidad / Transparencia del Fondo</span>
                  <span className="font-mono text-indigo-400 font-bold">
                    {(settings.bgOpacity ?? 90) === 0 ? "0% (Sin Fondo / Texto Flotante)" : `${settings.bgOpacity ?? 90}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={settings.bgOpacity ?? 90}
                  onChange={(e) => onUpdateSettings({ bgOpacity: Number(e.target.value) })}
                  className="w-full accent-indigo-500 bg-[#0E0E12] cursor-pointer"
                />
                {/* Opacity Presets */}
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  {[
                    { label: "🚫 Sin Fondo (0%)", val: 0 },
                    { label: "50% Transparente", val: 50 },
                    { label: "75% Traslúcido", val: 75 },
                    { label: "90% Estándar", val: 90 },
                    { label: "100% Opaco", val: 100 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => onUpdateSettings({ bgOpacity: preset.val })}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                        (settings.bgOpacity ?? 90) === preset.val
                          ? "border-indigo-500 bg-indigo-500/20 text-white shadow"
                          : "border-[#2A2A32] text-[#6B6B76] hover:text-white"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-[#2A2A32] pt-3 space-y-2">
              {/* Subtitle Text Color */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-xs font-medium text-white">Color del Texto del Subtítulo</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.textColor || "#ffffff"}
                    onChange={(e) => onUpdateSettings({ textColor: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="font-mono text-[11px] text-indigo-300 font-bold uppercase">{settings.textColor || "#ffffff"}</span>
                </div>
              </div>
              {/* Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { name: "Blanco", color: "#ffffff" },
                  { name: "Amarillo TV", color: "#facc15" },
                  { name: "Cian Neón", color: "#22d3ee" },
                  { name: "Verde Neón", color: "#4ade80" },
                  { name: "Rosa / Magenta", color: "#f43f5e" },
                  { name: "Negro", color: "#000000" },
                ].map((preset) => (
                  <button
                    key={preset.color}
                    type="button"
                    onClick={() => onUpdateSettings({ textColor: preset.color })}
                    className={`px-2 py-1 rounded text-[10px] font-medium border flex items-center gap-1.5 transition ${
                      settings.textColor === preset.color
                        ? "border-indigo-500 bg-indigo-500/20 text-white"
                        : "border-[#2A2A32] text-[#6B6B76] hover:text-white"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: preset.color }} />
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Subtitle Text Border / Outline */}
            <div className="border-t border-[#2A2A32] pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-indigo-400" />
                    Borde / Contorno de Texto
                  </p>
                  <p className="text-[10px] text-[#6B6B76]">Añade un borde alrededor de las letras para máxima legibilidad.</p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ textBorder: !settings.textBorder })}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.textBorder ? "bg-indigo-600" : "bg-[#2A2A32]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.textBorder ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {settings.textBorder && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Thickness */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-[#6B6B76] font-bold">
                      Grosor del Borde
                    </label>
                    <div className="flex gap-1">
                      {[
                        { id: "thin", label: "Fino" },
                        { id: "medium", label: "Medio" },
                        { id: "thick", label: "Grueso" },
                      ].map((size) => (
                        <button
                          key={size.id}
                          type="button"
                          onClick={() => onUpdateSettings({ textBorderSize: size.id as any })}
                          className={`flex-1 py-1 rounded text-[10px] font-medium border transition ${
                            (settings.textBorderSize || "medium") === size.id
                              ? "bg-indigo-600 border-indigo-500 text-white"
                              : "bg-[#0E0E12] border-[#2A2A32] text-[#6B6B76] hover:text-white"
                          }`}
                        >
                          {size.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Border Color */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-[#6B6B76] font-bold">
                      Color del Borde
                    </label>
                    <div className="flex items-center gap-2 bg-[#0E0E12] border border-[#2A2A32] rounded-lg px-2 py-1">
                      <input
                        type="color"
                        value={settings.textBorderColor || "#000000"}
                        onChange={(e) => onUpdateSettings({ textBorderColor: e.target.value })}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                      />
                      <span className="font-mono text-[11px] text-white font-bold uppercase">
                        {settings.textBorderColor || "#000000"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Technical Glossary / Prompt Hints */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-[#6B6B76] font-bold flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              Glosario Personalizado / Nombres / Términos Técnicos
            </label>
            <textarea
              rows={3}
              value={settings.glossary}
              onChange={(e) => onUpdateSettings({ glossary: e.target.value })}
              placeholder="Ej: Nombres de los participantes (Ana, Roberto), Siglas técnicas (IA, SaaS, Next.js, API, Docker), Contexto de la reunión."
              className="w-full bg-[#16161D] border border-[#2A2A32] rounded-xl p-3 text-xs text-white placeholder-[#6B6B76] focus:outline-none focus:border-indigo-500 transition"
            />
            <p className="text-[10px] text-[#6B6B76]">
              Le enseña a la IA el vocabulario clave para garantizar que no cometa errores ortográficos en marcas o nombres propios.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#0A0A0C] border-t border-[#1F1F23] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white hover:bg-gray-200 text-black font-bold text-xs rounded-xl shadow-lg transition"
          >
            APLICAR AJUSTES
          </button>
        </div>
      </div>
    </div>
  );
};

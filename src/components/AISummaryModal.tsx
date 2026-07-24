import React, { useState, useEffect } from "react";
import { Sparkles, FileText, CheckCircle2, ListChecks, MessageSquare, X, Copy, Check, Download, Loader2 } from "lucide-react";
import { SubtitleItem, ConversationSummary } from "../types";

interface AISummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtitles: SubtitleItem[];
}

export const AISummaryModal: React.FC<AISummaryModalProps> = ({ isOpen, onClose, subtitles }) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && subtitles.length > 0) {
      generateSummary();
    }
  }, [isOpen]);

  const generateSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/summarize-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtitles }),
      });

      if (!res.ok) {
        throw new Error("Error generando el resumen con IA");
      }

      const data = await res.json();
      setSummary(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No se pudo generar el resumen");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!summary) return;
    const text = `# ${summary.title}\n\n## Resumen Ejecutivo\n${summary.executiveSummary}\n\n## Temas Clave\n${summary.keyTopics.map((t) => `- ${t}`).join("\n")}\n\n## Acciones / Compromisos\n${summary.actionItems.map((a) => `- ${a}`).join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#0E0E12] border border-[#1F1F23] rounded-2xl w-full max-w-2xl text-[#E0E0E6] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F1F23] bg-[#0A0A0C]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-lg text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">Síntesis de la Conversación (IA)</h2>
              <p className="text-xs text-[#6B6B76]">Generado automáticamente por Gemini 3.6 Flash</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#6B6B76] hover:text-white rounded-lg hover:bg-[#16161D] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
              <p className="text-sm font-medium text-gray-300">
                Analizando {subtitles.length} fragmentos de conversación...
              </p>
              <p className="text-xs text-[#6B6B76]">
                Extrayendo decisiones, temas clave y resumen ejecutivo
              </p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-xs text-center space-y-2">
              <p className="font-semibold">{error}</p>
              <button
                onClick={generateSummary}
                className="px-3 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded-lg font-medium"
              >
                Reintentar
              </button>
            </div>
          ) : summary ? (
            <div className="space-y-6">
              {/* Title & Sentiment */}
              <div className="p-4 bg-[#16161D] rounded-xl border border-[#2A2A32] space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-indigo-300">{summary.title}</h3>
                  {summary.sentiment && (
                    <span className="text-[11px] bg-[#0E0E12] text-[#E0E0E6] px-2.5 py-0.5 rounded-full border border-[#2A2A32]">
                      Clima: {summary.sentiment}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{summary.executiveSummary}</p>
              </div>

              {/* Key Topics */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-[#6B6B76] flex items-center gap-1.5 uppercase tracking-widest">
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                  Temas Clave Discutidos
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {summary.keyTopics.map((topic, i) => (
                    <div
                      key={i}
                      className="p-3 bg-[#16161D] border border-[#2A2A32] rounded-xl text-xs text-gray-200 flex items-start gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                      <span>{topic}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Items */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-[#6B6B76] flex items-center gap-1.5 uppercase tracking-widest">
                  <ListChecks className="w-4 h-4 text-emerald-400" />
                  Acuerdos y Tareas Pendientes
                </h4>
                <div className="space-y-1.5">
                  {summary.actionItems.map((item, i) => (
                    <div
                      key={i}
                      className="p-3 bg-emerald-950/20 border border-emerald-800/30 rounded-xl text-xs text-emerald-200 flex items-start gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#0A0A0C] border-t border-[#1F1F23] flex justify-between items-center">
          <button
            onClick={generateSummary}
            disabled={loading}
            className="px-3 py-1.5 text-xs text-[#6B6B76] hover:text-white transition"
          >
            Regenerar
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!summary}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#16161D] hover:bg-[#1F1F26] text-gray-200 border border-[#2A2A32] rounded-xl text-xs transition disabled:opacity-40"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copiado" : "Copiar Informe"}</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-white hover:bg-gray-200 text-black font-bold text-xs rounded-xl shadow-lg transition"
            >
              CERRAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

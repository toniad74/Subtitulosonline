import React, { useState, useRef, useEffect } from "react";
import { Search, Copy, Check, Trash2, Edit2, ArrowDown, User, Clock, FileText } from "lucide-react";
import { SubtitleItem, SubtitleSettings } from "../types";

interface SubtitleHistoryProps {
  subtitles: SubtitleItem[];
  onUpdateSubtitle: (id: string, newText: string) => void;
  onDeleteSubtitle: (id: string) => void;
  onClearAll: () => void;
  settings: SubtitleSettings;
}

export const SubtitleHistory: React.FC<SubtitleHistoryProps> = ({
  subtitles,
  onUpdateSubtitle,
  onDeleteSubtitle,
  onClearAll,
  settings,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new subtitles if enabled
  useEffect(() => {
    if (settings.autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [subtitles, settings.autoScroll]);

  const filteredSubtitles = subtitles.filter(
    (s) =>
      s.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.speaker && s.speaker.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleStartEdit = (item: SubtitleItem) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const handleSaveEdit = (id: string) => {
    if (editText.trim()) {
      onUpdateSubtitle(id, editText.trim());
    }
    setEditingId(null);
  };

  const handleCopyAll = () => {
    const fullText = subtitles
      .map((s) => `[${s.timestamp}] ${s.speaker ? `${s.speaker}: ` : ""}${s.text}`)
      .join("\n");
    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopySingle = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-[#0E0E12] border border-[#1F1F23] rounded-2xl p-5 flex flex-col h-[500px] shadow-2xl text-[#E0E0E6]">
      {/* Header & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-4 border-b border-[#1F1F23]">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-white flex items-center gap-2">
              Historial de Conversación
              <span className="text-xs font-mono text-indigo-400 bg-[#16161D] border border-[#2A2A32] px-2 py-0.5 rounded-full">
                {subtitles.length}
              </span>
            </h2>
            <p className="text-xs text-[#6B6B76]">Transcripción acumulada con marcas de tiempo</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleCopyAll}
            disabled={subtitles.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#16161D] hover:bg-[#1F1F26] text-gray-300 rounded-lg text-xs transition border border-[#2A2A32] disabled:opacity-40"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAll ? "Copiado" : "Copiar Todo"}</span>
          </button>

          <button
            onClick={onClearAll}
            disabled={subtitles.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/40 text-rose-300 rounded-lg text-xs transition disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="my-3 relative">
        <Search className="w-4 h-4 text-[#6B6B76] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar en la conversación..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-[#16161D] border border-[#2A2A32] rounded-xl text-xs text-white placeholder-[#6B6B76] focus:outline-none focus:border-indigo-500 transition"
        />
      </div>

      {/* Subtitle List */}
      <div ref={containerRef} className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
        {filteredSubtitles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#6B6B76] text-xs space-y-2 py-10">
            <Clock className="w-8 h-8 opacity-40" />
            <p>{searchTerm ? "No se encontraron coincidencias de búsqueda." : "Aún no hay subtítulos guardados."}</p>
          </div>
        ) : (
          filteredSubtitles.map((sub) => (
            <div
              key={sub.id}
              className="p-3.5 bg-[#16161D] hover:bg-[#1F1F26] border border-[#2A2A32] rounded-xl transition group flex flex-col space-y-2"
            >
              <div className="flex items-center justify-between text-[11px] text-[#6B6B76]">
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-[#0E0E12] px-2 py-0.5 rounded text-indigo-400 font-medium border border-[#2A2A32]">
                    {sub.timestamp}
                  </span>
                  {sub.speaker && (
                    <span className="flex items-center gap-1 text-indigo-400 font-medium">
                      <User className="w-3 h-3" />
                      {sub.speaker}
                    </span>
                  )}
                  {sub.isAIRefined && (
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                      IA ✨
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => handleCopySingle(sub.id, sub.text)}
                    className="p-1 text-[#6B6B76] hover:text-white rounded hover:bg-[#2A2A32]"
                    title="Copiar frase"
                  >
                    {copiedId === sub.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => handleStartEdit(sub)}
                    className="p-1 text-[#6B6B76] hover:text-white rounded hover:bg-[#2A2A32]"
                    title="Editar subtítulo"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onDeleteSubtitle(sub.id)}
                    className="p-1 text-[#6B6B76] hover:text-rose-400 rounded hover:bg-[#2A2A32]"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Editable or static text */}
              {editingId === sub.id ? (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="flex-1 px-3 py-1 bg-[#0E0E12] border border-indigo-500 rounded text-xs text-white focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(sub.id)}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-2.5 py-1 bg-[#2A2A32] hover:bg-gray-700 text-slate-300 rounded text-xs"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-200 leading-relaxed font-sans">{sub.text}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { Mic, Monitor, Volume2, Sliders, Check, RefreshCw, AlertCircle, X, ShieldCheck, Play, Square, ExternalLink } from "lucide-react";
import { AudioDeviceOption, SubtitleSettings } from "../types";
import { SYSTEM_AUDIO_DEVICE_ID, getSystemAudioStream } from "../utils/audio";

interface AudioDeviceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  devices: AudioDeviceOption[];
  selectedDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
  onRefreshDevices: () => void;
  audioLevel: number;
  settings: SubtitleSettings;
  onUpdateSettings: (newSettings: Partial<SubtitleSettings>) => void;
  activeStream: MediaStream | null;
}

export const AudioDeviceSelector: React.FC<AudioDeviceSelectorProps> = ({
  isOpen,
  onClose,
  devices,
  selectedDeviceId,
  onSelectDevice,
  onRefreshDevices,
  audioLevel,
  settings,
  onUpdateSettings,
  activeStream,
}) => {
  const [isTestRecording, setIsTestRecording] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  if (!isOpen) return null;

  const handleDeviceItemClick = async (deviceId: string) => {
    if (deviceId === SYSTEM_AUDIO_DEVICE_ID) {
      try {
        // Trigger getSystemAudioStream directly inside user click handler to guarantee browser popup window
        await getSystemAudioStream();
        onSelectDevice(deviceId);
        onClose();
      } catch (err: any) {
        alert(err.message || "No se seleccionó ninguna fuente de audio del sistema.");
      }
    } else {
      onSelectDevice(deviceId);
    }
  };

  const handleStartTest = () => {
    if (!activeStream) return;
    try {
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(activeStream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setTestAudioUrl(url);
        setIsTestRecording(false);
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsTestRecording(true);

      // Stop test after 4 seconds automatically
      setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, 4000);
    } catch (err) {
      console.error("Test record failed:", err);
    }
  };

  const handleStopTest = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#0E0E12] border border-[#1F1F23] rounded-2xl w-full max-w-xl text-[#E0E0E6] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F1F23] bg-[#0A0A0C]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">Configuración de Audio</h2>
              <p className="text-xs text-[#6B6B76]">
                Selecciona micrófono, cable virtual o audio del sistema
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
          {/* Device Selection Dropdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-widest text-[#6B6B76] font-bold flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-indigo-400" />
                Dispositivo de Entrada Detectado
              </label>
              <button
                onClick={onRefreshDevices}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Actualizar lista</span>
              </button>
            </div>

            {devices.length === 0 ? (
              <div className="p-4 bg-amber-950/30 border border-amber-800/40 rounded-xl text-amber-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">No se han detectado dispositivos de audio.</p>
                  <p className="text-[#6B6B76] mt-1">
                    Asegúrate de conceder permisos de micrófono al navegador y tener un dispositivo conectado.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {devices.map((device) => {
                  const isSelected = selectedDeviceId === device.deviceId;
                  const isSystemAudio = device.deviceId === SYSTEM_AUDIO_DEVICE_ID;
                  const DeviceIcon = isSystemAudio ? Monitor : Mic;
                  return (
                    <button
                      key={device.deviceId}
                      onClick={() => handleDeviceItemClick(device.deviceId)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left border transition ${
                        isSelected
                          ? isSystemAudio
                            ? "bg-emerald-500/10 border-emerald-500 text-white shadow-md"
                            : "bg-indigo-500/10 border-indigo-500 text-white shadow-md"
                          : "bg-[#16161D] border-[#2A2A32] text-gray-300 hover:border-indigo-500/50"
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate pr-2">
                        <div
                          className={`p-2 rounded-lg ${
                            isSelected
                              ? isSystemAudio
                                ? "bg-emerald-600 text-white"
                                : "bg-indigo-600 text-white"
                              : "bg-[#2A2A32] text-[#6B6B76]"
                          }`}
                        >
                          <DeviceIcon className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-medium truncate">{device.label}</p>
                          <p className="text-[11px] text-[#6B6B76] font-mono truncate">
                            {isSystemAudio
                              ? "getDisplayMedia • Captura de escritorio"
                              : `USB Audio • ${device.deviceId ? device.deviceId.slice(0, 16) + "..." : "Predeterminado"}`
                            }
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className={`${isSystemAudio ? "bg-emerald-500" : "bg-indigo-500"} text-white p-1 rounded-full shrink-0`}>
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* App Audio Capture Guide Card */}
            <div className="p-4 bg-[#16161D] border border-indigo-500/30 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-indigo-400">
                <Monitor className="w-4 h-4" />
                <span className="text-xs font-bold text-white">¿Cómo capturar el audio de cualquier programa del PC?</span>
              </div>
              <p className="text-[11px] text-[#A0A0AB] leading-relaxed">
                Para subtitular <strong>YouTube, Zoom, Teams, Spotify, VLC, juegos o cualquier aplicación</strong> de tu ordenador:
              </p>
              <div className="bg-[#0E0E12] p-3 rounded-lg border border-[#2A2A32] space-y-2 text-[11px] text-gray-300">
                <div className="flex items-start gap-2">
                  <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">Paso 1</span>
                  <span>Selecciona arriba la opción <strong>"🖥️ Audio del Sistema (Escritorio)"</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">Paso 2</span>
                  <span>En la ventana emergente del navegador, elige la pestaña o ventana del programa deseado (o toda la pantalla).</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">Paso 3</span>
                  <span>En la ventana emergente, elige la pestaña <strong>"Toda la pantalla"</strong> o <strong>"Pestaña de Chrome"</strong> (donde aparece la casilla de audio abajo a la izquierda).</span>
                </div>
              </div>
              <p className="text-[10px] text-[#6B6B76] italic">
                * Nota: Si tu versión de Windows o navegador no incluye la casilla de audio en la ventana elegida, la aplicación usará automáticamente tu entrada de audio del sistema (Mezcla Estéreo, NDI o Cable Virtual).
              </p>

              <button
                onClick={() => handleDeviceItemClick(SYSTEM_AUDIO_DEVICE_ID)}
                className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg"
              >
                <Monitor className="w-4 h-4" />
                <span>🖥️ ABRIR SELECCIÓN DE PANTALLA Y AUDIO AHORA</span>
              </button>
            </div>
          </div>

          {/* Real-time Audio Level VU Meter */}
          <div className="space-y-2 bg-[#16161D] p-4 rounded-xl border border-[#2A2A32]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                Medidor de Nivel de Audio (VU)
              </span>
              <span className="text-indigo-400 font-mono">{audioLevel}%</span>
            </div>

            {/* Progress Bar with Color Zones */}
            <div className="w-full bg-[#0E0E12] h-4 rounded-full overflow-hidden p-0.5 relative border border-[#2A2A32]">
              <div
                className="h-full rounded-full transition-all duration-75 bg-indigo-500"
                style={{ width: `${audioLevel}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[#6B6B76] font-mono">
              <span>Silencio</span>
              <span>Óptimo (30-70%)</span>
              <span className="text-rose-400">Saturación</span>
            </div>
          </div>

          {/* Quick Mic Test */}
          <div className="p-4 bg-[#16161D] rounded-xl border border-[#2A2A32] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300">Prueba de Grabación Rápida (4s)</span>
              {isTestRecording ? (
                <button
                  onClick={handleStopTest}
                  className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium transition"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>Detener</span>
                </button>
              ) : (
                <button
                  onClick={handleStartTest}
                  disabled={!activeStream}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-gray-200 text-black rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-black" />
                  <span>Probar Mic</span>
                </button>
              )}
            </div>

            {isTestRecording && (
              <div className="p-2 bg-rose-950/40 border border-rose-800/40 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>Grabando prueba de audio... Habla para probar.</span>
              </div>
            )}

            {testAudioUrl && !isTestRecording && (
              <div className="space-y-1">
                <p className="text-[11px] text-[#6B6B76]">Escucha cómo suena tu micrófono:</p>
                <audio src={testAudioUrl} controls className="w-full h-8 bg-[#0E0E12] rounded-lg" />
              </div>
            )}
          </div>

          {/* Hardware Audio Filters & Processing */}
          <div className="space-y-3 pt-2 border-t border-[#1F1F23]">
            <h3 className="text-[10px] uppercase tracking-widest text-[#6B6B76] font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              Filtros de Procesamiento de Audio
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center justify-between p-3 bg-[#16161D] border border-[#2A2A32] rounded-xl cursor-pointer hover:border-indigo-500 transition">
                <span className="text-xs font-medium text-gray-300">Cancelación Ruido</span>
                <input
                  type="checkbox"
                  checked={settings.noiseSuppression}
                  onChange={(e) => onUpdateSettings({ noiseSuppression: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-[#2A2A32] focus:ring-indigo-500 bg-[#0E0E12]"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[#16161D] border border-[#2A2A32] rounded-xl cursor-pointer hover:border-indigo-500 transition">
                <span className="text-xs font-medium text-gray-300">Cancelación Eco</span>
                <input
                  type="checkbox"
                  checked={settings.echoCancellation}
                  onChange={(e) => onUpdateSettings({ echoCancellation: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-[#2A2A32] focus:ring-indigo-500 bg-[#0E0E12]"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[#16161D] border border-[#2A2A32] rounded-xl cursor-pointer hover:border-indigo-500 transition">
                <span className="text-xs font-medium text-gray-300">Ganancia Auto</span>
                <input
                  type="checkbox"
                  checked={settings.autoGainControl}
                  onChange={(e) => onUpdateSettings({ autoGainControl: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-[#2A2A32] focus:ring-indigo-500 bg-[#0E0E12]"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#0A0A0C] border-t border-[#1F1F23] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white hover:bg-gray-200 text-black font-bold text-xs rounded-xl shadow-lg transition"
          >
            GUARDAR Y CONTINUAR
          </button>
        </div>
      </div>
    </div>
  );
};

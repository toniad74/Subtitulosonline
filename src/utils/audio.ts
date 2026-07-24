import { AudioDeviceOption } from "../types";

/** Special device ID for system audio capture */
export const SYSTEM_AUDIO_DEVICE_ID = "__system_audio__";

/**
 * Get available audio input devices (microphones, lines in, virtual cables)
 * Includes a special "System Audio" option for desktop audio capture
 */
export async function getAudioInputDevices(): Promise<AudioDeviceOption[]> {
  try {
    // Request permission first to get labels on Chrome/Firefox
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop temporary track
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      console.warn("User permission for microphone pending or denied");
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((d) => d.kind === "audioinput");

    const deviceOptions: AudioDeviceOption[] = audioInputs.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Entrada de audio ${index + 1}`,
      groupId: device.groupId,
      isDefault: device.deviceId === "default" || index === 0,
    }));

    // Add system audio option (getDisplayMedia with audio)
    // Only available in Chromium-based browsers
    if (typeof navigator.mediaDevices.getDisplayMedia === "function") {
      deviceOptions.push({
        deviceId: SYSTEM_AUDIO_DEVICE_ID,
        label: "🖥️ Audio del Sistema (Escritorio)",
        groupId: "system",
        isDefault: false,
      });
    }

    return deviceOptions;
  } catch (err) {
    console.error("Error enumerating audio devices:", err);
    return [];
  }
}

/**
 * Get MediaStream for selected device with constraints
 */
export async function getAudioStream(
  deviceId?: string,
  constraints: {
    noiseSuppression?: boolean;
    echoCancellation?: boolean;
    autoGainControl?: boolean;
  } = {}
): Promise<MediaStream> {
  // System audio capture via getDisplayMedia
  if (deviceId === SYSTEM_AUDIO_DEVICE_ID) {
    return await getSystemAudioStream();
  }

  const audioConstraints: MediaTrackConstraints = {
    noiseSuppression: constraints.noiseSuppression ?? true,
    echoCancellation: constraints.echoCancellation ?? true,
    autoGainControl: constraints.autoGainControl ?? true,
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48000 },
    sampleSize: { ideal: 16 },
  };

  if (deviceId && deviceId !== "default") {
    audioConstraints.deviceId = { exact: deviceId };
  }

  return await navigator.mediaDevices.getUserMedia({
    audio: audioConstraints,
  });
}

/**
 * Capture system/desktop audio using getDisplayMedia.
 * The user will see a browser prompt to select a tab/window/screen to share audio from.
 * Returns a MediaStream with ONLY audio tracks (video tracks are stopped immediately).
 */
export async function getSystemAudioStream(): Promise<MediaStream> {
  try {
    // Standard getDisplayMedia invocation for max cross-browser compatibility
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true, // Required by Web standard, discarded immediately
      audio: true, // Captures system / tab / app audio output
    });

    // Stop video tracks immediately — we only want audio from computer apps
    displayStream.getVideoTracks().forEach((track) => track.stop());

    const audioTracks = displayStream.getAudioTracks();
    if (audioTracks.length === 0) {
      displayStream.getTracks().forEach((t) => t.stop());
      throw new Error(
        "No se capturó audio del sistema. Al seleccionar la pantalla en la ventana del navegador, debes activar la casilla 'Compartir audio del sistema' (abajo a la izquierda)."
      );
    }

    return new MediaStream(audioTracks);
  } catch (err: any) {
    console.error("getDisplayMedia error:", err);
    if (err.name === "NotAllowedError") {
      throw new Error("Selección cancelada o denegada por el usuario.");
    }
    throw new Error(`Error al capturar audio del sistema: ${err.message || err}`);
  }
}

/**
 * Helper to compute audio RMS volume (0-100)
 */
export function calculateAudioLevel(analyser: AnalyserNode): number {
  const buffer = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(buffer);

  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i];
  }
  const average = sum / buffer.length;
  return Math.min(100, Math.round((average / 255) * 100 * 2));
}

/**
 * Convert Blob to Base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

import { AudioDeviceOption } from "../types";

/**
 * Get available audio input devices (microphones, lines in, virtual cables)
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

    return audioInputs.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Entrada de audio ${index + 1}`,
      groupId: device.groupId,
      isDefault: device.deviceId === "default" || index === 0,
    }));
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

import React, { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isListening: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyser, isListening }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (!isListening || !analyser) {
        // Draw idle wave line
        ctx.beginPath();
        ctx.strokeStyle = "rgba(99, 102, 241, 0.25)";
        ctx.lineWidth = 2;
        const midY = height / 2;
        ctx.moveTo(0, midY);
        for (let x = 0; x < width; x += 10) {
          ctx.lineTo(x, midY + Math.sin(x * 0.05 + Date.now() * 0.002) * 2);
        }
        ctx.stroke();
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;

        // Gradient for active equalizer
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, "rgba(99, 102, 241, 0.8)"); // Indigo
        gradient.addColorStop(0.5, "rgba(168, 85, 247, 0.8)"); // Purple
        gradient.addColorStop(1, "rgba(236, 72, 153, 0.9)"); // Pink

        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

        x += barWidth;
        if (x > width) break;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyser, isListening]);

  return (
    <div className="w-full h-12 bg-slate-950/80 rounded-xl overflow-hidden border border-slate-800/80 flex items-center justify-center p-1 relative">
      <canvas ref={canvasRef} width={600} height={48} className="w-full h-full" />
      {!isListening && (
        <span className="absolute text-[11px] text-slate-500 font-medium pointer-events-none">
          Presiona "Iniciar Subtítulos" para comenzar
        </span>
      )}
    </div>
  );
};

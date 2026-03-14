import { useEffect, useRef, useState, RefObject } from "react";

interface VoiceModeAvatarProps {
  remoteStream: RefObject<MediaStream | null>;
  className?: string;
}

/**
 * Displays a stylized avatar with live audio waveform bars
 * when the partner is in voice-only mode.
 */
const VoiceModeAvatar = ({ remoteStream, className = "" }: VoiceModeAvatarProps) => {
  const [levels, setLevels] = useState<number[]>(Array(12).fill(0.1));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const stream = remoteStream.current;
    if (!stream) return;

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);
      // Pick 12 evenly spaced bins
      const barCount = 12;
      const step = Math.floor(dataArray.length / barCount);
      const newLevels: number[] = [];
      for (let i = 0; i < barCount; i++) {
        const val = dataArray[i * step] / 255;
        newLevels.push(Math.max(0.08, val));
      }
      setLevels(newLevels);
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      audioCtx.close();
    };
  }, [remoteStream.current]);

  return (
    <div className={`absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex flex-col items-center justify-center ${className}`}>
      {/* Avatar circle */}
      <div className="relative mb-4">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-pink-500/30 to-purple-600/30 border-2 border-pink-500/40 flex items-center justify-center shadow-lg shadow-pink-500/20">
          <span className="text-5xl md:text-6xl">🎙️</span>
        </div>
        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-full border-2 border-pink-400/30 animate-ping" />
      </div>

      {/* Voice Mode badge */}
      <div className="bg-pink-600/80 backdrop-blur-sm text-white text-xs md:text-sm font-black px-4 py-1.5 rounded-full mb-4 shadow-lg">
        🎙️ VOICE MODE
      </div>

      {/* Audio waveform bars */}
      <div className="flex items-end gap-1 h-12 md:h-16">
        {levels.map((level, i) => (
          <div
            key={i}
            className="w-2 md:w-2.5 rounded-full bg-gradient-to-t from-pink-500 to-purple-400 transition-all duration-75"
            style={{ height: `${level * 100}%`, minHeight: "4px" }}
          />
        ))}
      </div>
    </div>
  );
};

export default VoiceModeAvatar;

import React, { useRef, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Waves,
  Radio,
  Sliders,
  Volume2,
  Zap
} from 'lucide-react';
import type { Language } from '../i18n.js';
import { translations } from '../i18n.js';

interface WebAudioVisualizerProps {
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  audioElement?: HTMLAudioElement | null;
  isPlaying: boolean;
  songTitle?: string;
  lang?: Language;
  variant?: 'compact' | 'full';
}

type VisualizerMode = 'bars' | 'wave' | 'mirror';

// Global cache to prevent creating duplicate MediaElementAudioSourceNode on the same audio element
const audioSourceNodes = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();
let globalAudioContext: AudioContext | null = null;

export const WebAudioVisualizer: React.FC<WebAudioVisualizerProps> = ({
  audioRef,
  audioElement,
  isPlaying,
  lang = 'km',
  variant = 'full'
}) => {
  const t = translations[lang];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [mode, setMode] = useState<VisualizerMode>('bars');
  const [gainBoost, setGainBoost] = useState<number>(1.2);
  const [frequencyBands, setFrequencyBands] = useState({
    subBass: 0,
    bass: 0,
    mid: 0,
    presence: 0,
    brilliance: 0
  });
  const [peakDb, setPeakDb] = useState<number>(-48);
  const [isAudioConnected, setIsAudioConnected] = useState(false);

  // Peak tracking for falling peak caps in spectrum mode
  const peaksRef = useRef<number[]>([]);
  const lastMeterUpdateRef = useRef<number>(0);

  // Get active audio element from either audioRef or audioElement prop
  const currentAudioEl = audioElement || audioRef?.current || null;

  // Initialize and connect Web Audio API
  useEffect(() => {
    if (!currentAudioEl) return;

    const initAudioGraph = () => {
      try {
        if (!globalAudioContext) {
          const AudioContextClass =
            window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContextClass) {
            console.warn('Web Audio API is not supported in this browser.');
            return;
          }
          globalAudioContext = new AudioContextClass();
        }

        const ctx = globalAudioContext;

        if (ctx.state === 'suspended' && isPlaying) {
          ctx.resume().catch(() => {});
        }

        if (!analyserRef.current) {
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256; // 128 frequency bins
          analyser.smoothingTimeConstant = 0.8;
          analyserRef.current = analyser;
        }

        const analyser = analyserRef.current;

        // Connect media element if not already connected
        let sourceNode = audioSourceNodes.get(currentAudioEl);
        if (!sourceNode) {
          sourceNode = ctx.createMediaElementSource(currentAudioEl);
          audioSourceNodes.set(currentAudioEl, sourceNode);
        }

        try {
          sourceNode.connect(analyser);
          analyser.connect(ctx.destination);
          setIsAudioConnected(true);
        } catch {
          // Already connected or destination linked
          setIsAudioConnected(true);
        }
      } catch (err) {
        console.warn('Web Audio visualizer connection note:', err);
      }
    };

    if (isPlaying) {
      initAudioGraph();
    }
  }, [isPlaying, currentAudioEl]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    let idleAngle = 0;

    const render = () => {
      if (!running) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const analyser = analyserRef.current;
      const hasLiveAudio =
        analyser &&
        isPlaying &&
        globalAudioContext &&
        globalAudioContext.state === 'running';

      if (hasLiveAudio) {
        const bufferLength = analyser.frequencyBinCount;
        const freqData = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(freqData);

        // Compute Multi-Band Frequency Energy
        // Bins roughly:
        // 0-2: Sub-Bass (20-60 Hz)
        // 3-9: Bass (60-250 Hz)
        // 10-35: Mid (250-2000 Hz)
        // 36-75: Presence (2-6 kHz)
        // 76-120: Brilliance (6-16 kHz)
        let subSum = 0, bassSum = 0, midSum = 0, presSum = 0, brillSum = 0;
        let maxVal = 0;

        for (let i = 0; i < bufferLength; i++) {
          const val = freqData[i];
          if (val > maxVal) maxVal = val;

          if (i <= 2) subSum += val;
          else if (i <= 9) bassSum += val;
          else if (i <= 35) midSum += val;
          else if (i <= 75) presSum += val;
          else if (i <= 120) brillSum += val;
        }

        const subNorm = Math.min(100, Math.round(((subSum / 3) / 255) * 100 * gainBoost));
        const bassNorm = Math.min(100, Math.round(((bassSum / 7) / 255) * 100 * gainBoost));
        const midNorm = Math.min(100, Math.round(((midSum / 26) / 255) * 100 * gainBoost));
        const presNorm = Math.min(100, Math.round(((presSum / 40) / 255) * 100 * gainBoost));
        const brillNorm = Math.min(100, Math.round(((brillSum / 45) / 255) * 100 * gainBoost));

        // Throttle meter state updates to ~100ms to avoid overwhelming React render cycle
        const now = performance.now();
        if (now - lastMeterUpdateRef.current > 100) {
          lastMeterUpdateRef.current = now;
          setFrequencyBands({
            subBass: subNorm,
            bass: bassNorm,
            mid: midNorm,
            presence: presNorm,
            brilliance: brillNorm
          });

          // Approximate dB level
          const currentDb = maxVal > 0 ? Math.round(20 * Math.log10(maxVal / 255)) : -48;
          setPeakDb(currentDb);
        }

        // MODE 1: SPECTRUM BARS (FFT)
        if (mode === 'bars') {
          const barCount = 46;
          const spacing = 3;
          const barWidth = Math.max(2, (width - (barCount - 1) * spacing) / barCount);

          if (peaksRef.current.length !== barCount) {
            peaksRef.current = new Array(barCount).fill(0);
          }

          for (let i = 0; i < barCount; i++) {
            // Pick frequency bin with logarithmic curvature
            const binIndex = Math.min(
              bufferLength - 1,
              Math.floor(Math.pow(i / barCount, 1.4) * (bufferLength - 10))
            );
            const raw = (freqData[binIndex] || 0) * gainBoost;
            const norm = Math.min(1, raw / 255);
            const barHeight = Math.max(3, norm * (height - 12));

            // Peak falling gravity
            if (barHeight > peaksRef.current[i]) {
              peaksRef.current[i] = barHeight;
            } else {
              peaksRef.current[i] = Math.max(0, peaksRef.current[i] - 1.5);
            }

            const x = i * (barWidth + spacing);
            const y = height - barHeight;

            // Gradient: Amber -> Orange -> Emerald -> Cyan
            const grad = ctx.createLinearGradient(0, height, 0, 0);
            grad.addColorStop(0, '#b45309'); // amber-700
            grad.addColorStop(0.35, '#f59e0b'); // amber-500
            grad.addColorStop(0.7, '#f97316'); // orange-500
            grad.addColorStop(0.9, '#10b981'); // emerald-500
            grad.addColorStop(1, '#06b6d4'); // cyan-500

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
            ctx.fill();

            // Draw floating peak cap
            const peakY = height - peaksRef.current[i];
            ctx.fillStyle = '#fef08a'; // yellow-200
            ctx.fillRect(x, Math.max(0, peakY - 2.5), barWidth, 2);
          }
        }
        // MODE 2: OSCILLOSCOPE TIME DOMAIN WAVEFORM
        else if (mode === 'wave') {
          const timeData = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(timeData);

          // Background subtle grid lines
          ctx.strokeStyle = '#262626';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, height / 2);
          ctx.lineTo(width, height / 2);
          ctx.stroke();

          // Outer Glow Wave
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = '#f59e0b';
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 12;
          ctx.beginPath();

          const sliceWidth = width / timeData.length;
          let x = 0;

          for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i] / 128.0 - 1.0) * gainBoost + 1.0;
            const y = (v * height) / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
            x += sliceWidth;
          }

          ctx.stroke();

          // Inner Bright Cyan Wave core
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#e0f2fe';
          ctx.shadowBlur = 0;
          ctx.stroke();
        }
        // MODE 3: STEREO MIRROR WAVEFORM (SYMMETRICAL)
        else if (mode === 'mirror') {
          const barCount = 44;
          const spacing = 3;
          const barWidth = Math.max(2, (width - (barCount - 1) * spacing) / barCount);
          const centerY = height / 2;

          for (let i = 0; i < barCount; i++) {
            const binIndex = Math.min(
              bufferLength - 1,
              Math.floor(Math.pow(i / barCount, 1.3) * (bufferLength - 12))
            );
            const raw = (freqData[binIndex] || 0) * gainBoost;
            const norm = Math.min(1, raw / 255);
            const halfHeight = Math.max(2, (norm * height) / 2.2);

            const x = i * (barWidth + spacing);
            const yTop = centerY - halfHeight;
            const totalH = halfHeight * 2;

            const grad = ctx.createLinearGradient(0, yTop, 0, yTop + totalH);
            grad.addColorStop(0, '#06b6d4');
            grad.addColorStop(0.3, '#f59e0b');
            grad.addColorStop(0.5, '#fef08a');
            grad.addColorStop(0.7, '#f59e0b');
            grad.addColorStop(1, '#06b6d4');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(x, yTop, barWidth, totalH, [2, 2, 2, 2]);
            ctx.fill();
          }

          // Center horizon laser line
          ctx.strokeStyle = '#ffffff80';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, centerY);
          ctx.lineTo(width, centerY);
          ctx.stroke();
        }
      } else {
        // IDLE RESTING STATE (Gently pulsating harmonic waves)
        idleAngle += 0.04;
        const barCount = 46;
        const spacing = 3;
        const barWidth = Math.max(2, (width - (barCount - 1) * spacing) / barCount);

        for (let i = 0; i < barCount; i++) {
          const sine1 = Math.sin(i * 0.25 + idleAngle);
          const sine2 = Math.cos(i * 0.15 - idleAngle * 0.8);
          const idleH = Math.max(4, (sine1 + sine2 + 2) * 3 + (isPlaying ? 8 : 4));

          const x = i * (barWidth + spacing);
          const y = height - idleH;

          ctx.fillStyle = isPlaying ? '#78350f' : '#262626';
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, idleH, [2, 2, 0, 0]);
          ctx.fill();
        }

        // Reset frequency band meters when idle (only once)
        if (!isPlaying && lastMeterUpdateRef.current !== 0) {
          lastMeterUpdateRef.current = 0;
          setFrequencyBands({
            subBass: 0,
            bass: 0,
            mid: 0,
            presence: 0,
            brilliance: 0
          });
          setPeakDb(-48);
        }
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isPlaying, mode, gainBoost]);

  // Crisp Canvas Resize with Retina DevicePixelRatio
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      id="visual-audio-waveform-analyzer"
      className="w-full rounded-2xl bg-gradient-to-b from-neutral-950 via-neutral-900/90 to-neutral-950 border-2 border-amber-500/30 p-4 sm:p-5 shadow-2xl relative overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute top-0 right-1/4 w-72 h-32 bg-amber-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Top Header: Title, Real-Time Status, & Mode Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{t.waveformAnalyzer}</span>
              {isPlaying && (
                <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  LIVE
                </span>
              )}
            </h3>
            <p className="text-[11px] font-mono text-neutral-400">
              Web Audio API • 48,000 Hz • 128 FFT Bins • Peak {peakDb} dB
            </p>
          </div>
        </div>

        {/* Controls: Mode Switcher & Gain Boost */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center p-1 bg-neutral-950 border border-neutral-800 rounded-xl">
            <button
              type="button"
              id="analyzer-mode-bars-btn"
              onClick={() => setMode('bars')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                mode === 'bars'
                  ? 'bg-amber-500 text-neutral-950 shadow-md font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="FFT Frequency Spectrum Bars"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.analyzerModeBars}</span>
            </button>

            <button
              type="button"
              id="analyzer-mode-wave-btn"
              onClick={() => setMode('wave')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                mode === 'wave'
                  ? 'bg-amber-500 text-neutral-950 shadow-md font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Oscilloscope Time-Domain Wave"
            >
              <Waves className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.analyzerModeWave}</span>
            </button>

            <button
              type="button"
              id="analyzer-mode-mirror-btn"
              onClick={() => setMode('mirror')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                mode === 'mirror'
                  ? 'bg-amber-500 text-neutral-950 shadow-md font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Stereo Mirror Symmetrical Wave"
            >
              <Radio className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.analyzerModeMirror}</span>
            </button>
          </div>

          {/* Gain Boost toggle */}
          <button
            type="button"
            id="analyzer-boost-toggle-btn"
            onClick={() => setGainBoost((prev) => (prev === 1.0 ? 1.4 : prev === 1.4 ? 1.8 : 1.0))}
            className="px-2 py-1 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-amber-500/40 text-neutral-300 text-[11px] font-mono flex items-center gap-1 transition-colors"
            title="Audio Sensitivity Boost"
          >
            <Sliders className="w-3 h-3 text-amber-400" />
            <span>{gainBoost.toFixed(1)}x</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Waveform Viewport */}
      <div
        ref={containerRef}
        className="w-full h-24 sm:h-28 relative overflow-hidden rounded-2xl bg-neutral-950 border border-neutral-800 shadow-inner"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Frequency Range Indicators along the bottom */}
        <div className="absolute bottom-1 left-2 right-2 flex justify-between text-[9px] font-mono text-neutral-600 pointer-events-none select-none">
          <span>20 Hz</span>
          <span>100 Hz</span>
          <span>500 Hz</span>
          <span>2 kHz</span>
          <span>8 kHz</span>
          <span>20 kHz</span>
        </div>

        {!isPlaying && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none p-4 text-center">
            <span className="text-xs font-mono text-amber-300/90 bg-neutral-950/80 px-3 py-1.5 rounded-xl border border-amber-500/30 flex items-center gap-2 shadow-lg">
              <Volume2 className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>{t.pressPlayToAnalyze}</span>
            </span>
          </div>
        )}
      </div>

      {/* Real-Time Frequency Band Monitors (Sub, Bass, Mid, Presence, Brilliance) */}
      <div className="grid grid-cols-5 gap-2 mt-3 pt-3 border-t border-neutral-800/80">
        {/* Sub-Bass */}
        <div className="bg-neutral-950/90 border border-neutral-800/90 rounded-xl p-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono mb-1">
            <span>{t.subBass}</span>
            <span className="text-amber-400 font-bold">{frequencyBands.subBass}%</span>
          </div>
          <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-75 rounded-full"
              style={{ width: `${frequencyBands.subBass}%` }}
            />
          </div>
          <span className="text-[9px] text-neutral-600 font-mono mt-1 text-center">20-60Hz</span>
        </div>

        {/* Bass */}
        <div className="bg-neutral-950/90 border border-neutral-800/90 rounded-xl p-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono mb-1">
            <span>{t.bass}</span>
            <span className="text-orange-400 font-bold">{frequencyBands.bass}%</span>
          </div>
          <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-75 rounded-full"
              style={{ width: `${frequencyBands.bass}%` }}
            />
          </div>
          <span className="text-[9px] text-neutral-600 font-mono mt-1 text-center">60-250Hz</span>
        </div>

        {/* Mid */}
        <div className="bg-neutral-950/90 border border-neutral-800/90 rounded-xl p-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono mb-1">
            <span>{t.mid}</span>
            <span className="text-emerald-400 font-bold">{frequencyBands.mid}%</span>
          </div>
          <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-75 rounded-full"
              style={{ width: `${frequencyBands.mid}%` }}
            />
          </div>
          <span className="text-[9px] text-neutral-600 font-mono mt-1 text-center">250-2kHz</span>
        </div>

        {/* Presence */}
        <div className="bg-neutral-950/90 border border-neutral-800/90 rounded-xl p-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono mb-1">
            <span>{t.presence}</span>
            <span className="text-sky-400 font-bold">{frequencyBands.presence}%</span>
          </div>
          <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-sky-400 transition-all duration-75 rounded-full"
              style={{ width: `${frequencyBands.presence}%` }}
            />
          </div>
          <span className="text-[9px] text-neutral-600 font-mono mt-1 text-center">2-6kHz</span>
        </div>

        {/* Brilliance */}
        <div className="bg-neutral-950/90 border border-neutral-800/90 rounded-xl p-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono mb-1">
            <span>{t.brilliance}</span>
            <span className="text-violet-400 font-bold">{frequencyBands.brilliance}%</span>
          </div>
          <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-violet-400 transition-all duration-75 rounded-full"
              style={{ width: `${frequencyBands.brilliance}%` }}
            />
          </div>
          <span className="text-[9px] text-neutral-600 font-mono mt-1 text-center">6-20kHz</span>
        </div>
      </div>
    </div>
  );
};

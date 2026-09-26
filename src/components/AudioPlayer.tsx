import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, FastForward } from 'lucide-react';
import type { SongInfo } from '../types.js';
import { WebAudioVisualizer } from './WebAudioVisualizer.js';

interface AudioPlayerProps {
  song: SongInfo;
  onAudioElement?: (el: HTMLAudioElement | null) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  showEmbeddedVisualizer?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  song,
  onAudioElement,
  onPlayStateChange,
  onTimeUpdate,
  showEmbeddedVisualizer = false
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(song.duration || 0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);

  const streamUrl = `/api/song/stream/${song.id}`;

  const onAudioElementRef = useRef(onAudioElement);
  onAudioElementRef.current = onAudioElement;

  // Notify parent of audio element instance
  useEffect(() => {
    if (audioRef.current && onAudioElementRef.current) {
      onAudioElementRef.current(audioRef.current);
    }
  }, [song.id]);

  useEffect(() => {
    return () => {
      onAudioElementRef.current?.(null);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPlayStateChange?.(false);
      setCurrentTime(0);
      audioRef.current.load();
    }
  }, [song.id]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPlayStateChange?.(false);
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          onPlayStateChange?.(true);
        })
        .catch((err) => console.warn('Playback error:', err));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      const dur = audioRef.current.duration || duration || song.duration || 0;
      setCurrentTime(cur);
      if (!duration && audioRef.current.duration) {
        setDuration(audioRef.current.duration);
      }
      onTimeUpdate?.(cur, dur);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    onTimeUpdate?.(time, duration || song.duration || 0);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
    if (val === 0) setIsMuted(true);
    else setIsMuted(false);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.muted = false;
      setIsMuted(false);
    } else {
      audioRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const cycleSpeed = () => {
    const rates = [1, 1.25, 1.5, 0.8];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 shadow-xl">
      <audio
        ref={audioRef}
        src={streamUrl}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            const dur = audioRef.current.duration || song.duration || 0;
            setDuration(dur);
            audioRef.current.volume = volume;
            onAudioElement?.(audioRef.current);
            onTimeUpdate?.(audioRef.current.currentTime, dur);
          }
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
          onPlayStateChange?.(true);
        }}
        onPause={() => {
          setIsPlaying(false);
          onPlayStateChange?.(false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
          onPlayStateChange?.(false);
        }}
      />

      {/* Optional Embedded Visualizer */}
      {showEmbeddedVisualizer && (
        <WebAudioVisualizer audioRef={audioRef} isPlaying={isPlaying} />
      )}

      {/* Progress Slider */}
      <div className="relative mb-3 group">
        <input
          id="audio-scrub-slider"
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400 focus:outline-none"
        />
        <div className="flex justify-between items-center text-xs font-mono text-neutral-400 mt-1.5">
          <span>{formatTime(currentTime)}</span>
          <span className="text-neutral-500">
            {isBuffering ? 'Buffering...' : `Total: ${formatTime(duration)}`}
          </span>
        </div>
      </div>

      {/* Player Controls */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="play-pause-btn"
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 flex items-center justify-center shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-neutral-950" />
            ) : (
              <Play className="w-5 h-5 fill-neutral-950 ml-0.5" />
            )}
          </button>

          <button
            type="button"
            id="replay-10s-btn"
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = Math.max(0, currentTime - 10);
              }
            }}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            title="Rewind 10s"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            id="forward-10s-btn"
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = Math.min(duration, currentTime + 10);
              }
            }}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            title="Forward 10s"
          >
            <FastForward className="w-4 h-4" />
          </button>
        </div>

        {/* Volume & Speed Controls */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            id="playback-rate-btn"
            onClick={cycleSpeed}
            className="text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-amber-300 transition-colors"
            title="Playback Speed"
          >
            {playbackRate}x
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              id="mute-toggle-btn"
              onClick={toggleMute}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              id="volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400 focus:outline-none"
              title="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

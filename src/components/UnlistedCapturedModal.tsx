import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Check,
  Link as LinkIcon,
  ExternalLink,
  Sparkles,
  Lock,
  Clock,
  Music,
  Radio,
  FileAudio,
  Loader2,
  Share2
} from 'lucide-react';
import { ProfileSongItem, AudioFormat } from '../types';
import { translations } from '../i18n';

interface UnlistedCapturedModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: ProfileSongItem | null;
  lang: 'km' | 'en';
  onOpenInFullStudio: (songId: string) => void;
  onDownload: (song: ProfileSongItem, format: AudioFormat) => void;
  isDownloadingMp3?: boolean;
  isDownloadingWav?: boolean;
  downloadPercent?: number;
}

export const UnlistedCapturedModal: React.FC<UnlistedCapturedModalProps> = ({
  isOpen,
  onClose,
  song,
  lang,
  onOpenInFullStudio,
  onDownload,
  isDownloadingMp3 = false,
  isDownloadingWav = false,
  downloadPercent
}) => {
  const t = translations[lang];
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAudioUrl, setCopiedAudioUrl] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      setCurrentTime(0);
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [isOpen, song?.id]);

  if (!isOpen || !song) return null;

  const audioStreamUrl = `/api/song/stream/${song.id}?format=m4a`;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.warn('Audio play error:', err));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (!duration && audioRef.current.duration) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || song.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCopyLink = async () => {
    try {
      const sunoUrl = `https://suno.com/song/${song.id}`;
      await navigator.clipboard.writeText(sunoUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const handleCopyAudioUrl = async () => {
    try {
      const streamUrl = song.audioUrl || `${window.location.origin}/api/song/stream/${song.id}?format=m4a`;
      await navigator.clipboard.writeText(streamUrl);
      setCopiedAudioUrl(true);
      setTimeout(() => setCopiedAudioUrl(false), 2000);
    } catch {}
  };

  return (
    <div
      id="unlisted-captured-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-neutral-950 border border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-amber-950/40 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        {/* Hidden Audio Element */}
        <audio
          ref={audioRef}
          src={audioStreamUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          preload="metadata"
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-neutral-800 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold tracking-wide">
                  {t.capturedUnlistedModalBadge}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" />
                  {t.unlistedStreamReady}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                {t.capturedUnlistedModalTitle}
              </h3>
            </div>
          </div>

          <button
            type="button"
            id="close-unlisted-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-850 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Info */}
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5 mb-5 relative z-10">
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shrink-0 border-2 border-amber-500/40 shadow-xl bg-neutral-900 group">
            <img
              src={song.imageUrl}
              alt={song.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={togglePlay}
              className="absolute inset-0 bg-black/40 hover:bg-black/20 flex items-center justify-center transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center justify-center shadow-lg transition-transform hover:scale-105">
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-neutral-950" />
                ) : (
                  <Play className="w-6 h-6 fill-neutral-950 ml-0.5" />
                )}
              </div>
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-lg sm:text-xl font-bold text-white leading-snug break-words">
              {song.title}
            </h4>

            <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-400 font-mono mt-2">
              <span className="flex items-center gap-1 text-amber-300">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(song.duration)}
              </span>
              <span>•</span>
              {song.modelName && (
                <>
                  <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 text-[10px]">
                    {song.modelName}
                  </span>
                  <span>•</span>
                </>
              )}
              <span className="text-neutral-500">ID: {song.id.slice(0, 12)}...</span>
            </div>

            {song.tags && (
              <p className="text-xs text-neutral-300 bg-neutral-900/80 border border-neutral-800/80 rounded-xl p-2.5 mt-2.5 line-clamp-2">
                <span className="text-amber-400/90 font-semibold mr-1.5">Style / Tags:</span>
                {song.tags}
              </p>
            )}
          </div>
        </div>

        {/* Audio Player Controller Bar */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 mb-5 relative z-10">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="modal-audio-play-btn"
                onClick={togglePlay}
                className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center justify-center shadow-md transition-all shrink-0"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-neutral-950" />
                ) : (
                  <Play className="w-5 h-5 fill-neutral-950 ml-0.5" />
                )}
              </button>

              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>{isPlaying ? 'Now Streaming Audio' : 'Preview Decrypted Audio'}</span>
                </p>
                <p className="text-[10px] text-neutral-400 font-mono">
                  {formatTime(currentTime)} / {formatTime(duration || song.duration || 0)}
                </p>
              </div>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={toggleMute}
                className="text-neutral-400 hover:text-neutral-200 p-1"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 sm:w-20 accent-amber-500 h-1 rounded-lg cursor-pointer bg-neutral-800"
              />
            </div>
          </div>

          {/* Scrubber Range */}
          <input
            type="range"
            min="0"
            max={duration || song.duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer transition-all"
          />
        </div>

        {/* Prompt / Lyrics Preview if available */}
        {song.prompt && (
          <div className="mb-5 bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-3.5 relative z-10">
            <h5 className="text-xs font-bold text-amber-300 mb-1 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5" />
              <span>Prompt / Lyrics</span>
            </h5>
            <p className="text-xs text-neutral-300 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed bg-black/40 p-2.5 rounded-xl border border-neutral-800">
              {song.prompt}
            </p>
          </div>
        )}

        {/* Direct Action Link Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5 relative z-10">
          <button
            type="button"
            id="copy-unlisted-suno-link-btn"
            onClick={handleCopyLink}
            className="px-3.5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-200 text-xs font-semibold flex items-center justify-between border border-neutral-800 transition-colors"
          >
            <span className="flex items-center gap-2 truncate">
              <LinkIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">https://suno.com/song/{song.id.slice(0, 8)}...</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-mono shrink-0 ml-2">
              {copiedLink ? (
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <Check className="w-3 h-3" />
                  Copied
                </span>
              ) : (
                'Copy Link'
              )}
            </span>
          </button>

          <button
            type="button"
            id="copy-direct-audio-link-btn"
            onClick={handleCopyAudioUrl}
            className="px-3.5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-200 text-xs font-semibold flex items-center justify-between border border-neutral-800 transition-colors"
          >
            <span className="flex items-center gap-2 truncate">
              <FileAudio className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate">{t.copyDirectAudioUrl}</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 text-[10px] font-mono shrink-0 ml-2">
              {copiedAudioUrl ? (
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <Check className="w-3 h-3" />
                  Copied
                </span>
              ) : (
                'Copy Stream'
              )}
            </span>
          </button>
        </div>

        {/* Download Buttons Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t border-neutral-800 relative z-10">
          <button
            type="button"
            id="modal-dl-mp3-btn"
            onClick={() => onDownload(song, 'mp3')}
            disabled={isDownloadingMp3}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-75"
          >
            {isDownloadingMp3 ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
                <span>Downloading MP3 ({downloadPercent ? `${downloadPercent}%` : '...'})</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download MP3 (320kbps)</span>
              </>
            )}
          </button>

          <button
            type="button"
            id="modal-dl-wav-btn"
            onClick={() => onDownload(song, 'wav')}
            disabled={isDownloadingWav}
            className="flex-1 py-3 px-4 rounded-xl bg-sky-950 hover:bg-sky-900 text-sky-200 border border-sky-500/40 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-75"
          >
            {isDownloadingWav ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                <span>Downloading WAV ({downloadPercent ? `${downloadPercent}%` : '...'})</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-sky-400" />
                <span>Download WAV (24-bit Lossless)</span>
              </>
            )}
          </button>

          <button
            type="button"
            id="modal-open-full-studio-btn"
            onClick={() => {
              onClose();
              onOpenInFullStudio(song.id);
            }}
            className="px-4 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0"
          >
            <ExternalLink className="w-4 h-4 text-amber-400" />
            <span>{t.openInFullStudio}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

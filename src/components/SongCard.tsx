import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Download,
  Music,
  User,
  Clock,
  Cpu,
  FileText,
  Tag,
  Code2,
  Check,
  Copy,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Radio,
  FileAudio,
  Volume2,
  ListMusic,
  ArrowLeft,
  Heart,
  FolderArchive,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Search,
  AlignLeft
} from 'lucide-react';
import type { SongInfo, AudioFormat, FavoriteSongItem } from '../types.js';
import type { Language } from '../i18n.js';
import { translations } from '../i18n.js';
import { AudioPlayer } from './AudioPlayer.js';
import { WebAudioVisualizer } from './WebAudioVisualizer.js';
import { SynchronizedLyrics } from './SynchronizedLyrics.js';
import { ModelBadge } from './ModelBadge.js';
import { downloadWithSmoothStream, downloadBatchZipViaForm } from '../utils/downloadHelper.js';
import { recordZipDownload } from '../utils/zipHistoryStorage.js';

interface SongCardProps {
  song: SongInfo;
  lang: Language;
  onSelectProfile?: (handle: string) => void;
  onBackToPlaylist?: () => void;
  playlistName?: string;
  isFavorite?: boolean;
  onToggleFavorite?: (songId: string, isFav: boolean) => void;
  onAddToQueue?: (song: SongInfo) => void;
  isInQueue?: boolean;
  onOpenQueueManager?: () => void;
}

export const SongCard: React.FC<SongCardProps> = ({
  song,
  lang,
  onSelectProfile,
  onBackToPlaylist,
  playlistName,
  isFavorite: propIsFavorite,
  onToggleFavorite,
  onAddToQueue,
  isInQueue = false,
  onOpenQueueManager
}) => {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<'lyrics' | 'tags' | 'tech'>('lyrics');
  const [copied, setCopied] = useState(false);
  const [downloadedLyrics, setDownloadedLyrics] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<AudioFormat | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadStatusText, setDownloadStatusText] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccessFormat, setDownloadSuccessFormat] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState<'both' | 'mp3' | 'wav' | null>(null);
  const [wavBitDepth, setWavBitDepth] = useState<16 | 24>(16);
  const [testingWavAudio, setTestingWavAudio] = useState(false);
  const [testAudioError, setTestAudioError] = useState<string | null>(null);
  const wavAudioRef = useRef<HTMLAudioElement | null>(null);
  const playerAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(song.duration || 0);

  // Expandable lyrics container state in song details
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(false);
  const [lyricsSearch, setLyricsSearch] = useState('');
  const [lyricsViewMode, setLyricsViewMode] = useState<'formatted' | 'raw'>('formatted');

  // Parse prompt into clean lines
  const lyricLines = useMemo(() => {
    if (!song.prompt || typeof song.prompt !== 'string') return [];
    return song.prompt
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }, [song.prompt]);

  // Filter lines by search term if active
  const filteredLyricLines = useMemo(() => {
    if (!lyricsSearch.trim()) return lyricLines;
    const q = lyricsSearch.toLowerCase();
    return lyricLines.filter((line) => line.toLowerCase().includes(q));
  }, [lyricLines, lyricsSearch]);

  // Reset playback time and lyrics search when song changes
  useEffect(() => {
    setPlaybackTime(0);
    setPlaybackDuration(song.duration || 0);
    setLyricsSearch('');
  }, [song.id, song.duration]);

  // Synchronize playback progress when testing WAV audio
  useEffect(() => {
    if (!testingWavAudio || !wavAudioRef.current) return;
    const el = wavAudioRef.current;

    const handleAudioSync = () => {
      setPlaybackTime(el.currentTime);
      if (el.duration && !isNaN(el.duration) && isFinite(el.duration) && el.duration > 0) {
        setPlaybackDuration(el.duration);
      }
    };

    el.addEventListener('timeupdate', handleAudioSync);
    el.addEventListener('seeking', handleAudioSync);
    el.addEventListener('seeked', handleAudioSync);

    return () => {
      el.removeEventListener('timeupdate', handleAudioSync);
      el.removeEventListener('seeking', handleAudioSync);
      el.removeEventListener('seeked', handleAudioSync);
    };
  }, [testingWavAudio]);

  const handleSeekLyrics = (seconds: number) => {
    const el = testingWavAudio ? wavAudioRef.current : playerAudioRef.current;
    if (el) {
      el.currentTime = seconds;
      setPlaybackTime(seconds);
      if (el.paused) {
        el.play().catch((err) => console.warn('Play on seek error:', err));
      }
    }
  };

  const handlePlayerAudioElement = useCallback((el: HTMLAudioElement | null) => {
    playerAudioRef.current = el;
  }, []);
  const [isFavorite, setIsFavorite] = useState<boolean>(() => {
    if (propIsFavorite !== undefined) return propIsFavorite;
    try {
      const stored =
        localStorage.getItem('suno_favorites') ||
        localStorage.getItem('suno_downloader_favorites');
      if (stored) {
        const list: FavoriteSongItem[] = JSON.parse(stored);
        return list.some((item) => item.id === song.id);
      }
    } catch {}
    return false;
  });

  useEffect(() => {
    if (propIsFavorite !== undefined) {
      setIsFavorite(propIsFavorite);
      return;
    }
    const checkFavorite = () => {
      try {
        const stored =
          localStorage.getItem('suno_favorites') ||
          localStorage.getItem('suno_downloader_favorites');
        if (stored) {
          const list: FavoriteSongItem[] = JSON.parse(stored);
          setIsFavorite(list.some((item) => item.id === song.id));
        } else {
          setIsFavorite(false);
        }
      } catch {
        setIsFavorite(false);
      }
    };
    checkFavorite();

    window.addEventListener('suno-favorites-updated', checkFavorite);
    window.addEventListener('storage', checkFavorite);
    return () => {
      window.removeEventListener('suno-favorites-updated', checkFavorite);
      window.removeEventListener('storage', checkFavorite);
    };
  }, [song.id, propIsFavorite]);

  const handleToggleFavorite = () => {
    try {
      const stored =
        localStorage.getItem('suno_favorites') ||
        localStorage.getItem('suno_downloader_favorites');
      let list: FavoriteSongItem[] = stored ? JSON.parse(stored) : [];
      const exists = list.some((item) => item.id === song.id);
      const nextFav = !exists;

      if (exists) {
        list = list.filter((item) => item.id !== song.id);
      } else {
        const newItem: FavoriteSongItem = {
          id: song.id,
          title: song.title,
          displayName: song.displayName,
          handle: song.handle,
          imageUrl: song.imageUrl,
          duration: song.duration,
          sourceUrl: song.sourceUrl,
          tags: song.tags,
          savedAt: Date.now()
        };
        list = [newItem, ...list];
      }

      localStorage.setItem('suno_favorites', JSON.stringify(list));
      localStorage.setItem('suno_downloader_favorites', JSON.stringify(list));
      setIsFavorite(nextFav);

      window.dispatchEvent(new Event('suno-favorites-updated'));
      if (onToggleFavorite) {
        onToggleFavorite(song.id, nextFav);
      }
    } catch (err) {
      console.warn('Failed to update favorites in localStorage:', err);
    }
  };

  // Stop test audio when song changes
  useEffect(() => {
    if (wavAudioRef.current) {
      wavAudioRef.current.pause();
      wavAudioRef.current.src = '';
      wavAudioRef.current = null;
      setTestingWavAudio(false);
      setTestAudioError(null);
    }
  }, [song.id]);

  const handleTestWav = () => {
    if (testingWavAudio && wavAudioRef.current) {
      wavAudioRef.current.pause();
      setTestingWavAudio(false);
      return;
    }

    if (wavAudioRef.current) {
      wavAudioRef.current.pause();
      wavAudioRef.current.src = '';
      wavAudioRef.current = null;
    }

    setTestAudioError(null);
    const streamUrl = `/api/song/stream/${song.id}?format=wav&bitDepth=${wavBitDepth}`;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = streamUrl;

    audio.onended = () => {
      setTestingWavAudio(false);
    };

    audio.onerror = () => {
      console.warn('WAV stream playback note: audio element error fired');
      setTestingWavAudio(false);
      setTestAudioError('Playback note: 16-bit is recommended for direct web preview.');
    };

    audio
      .play()
      .then(() => {
        setTestingWavAudio(true);
        wavAudioRef.current = audio;
      })
      .catch((err) => {
        console.warn('Audio play error:', err.message);
        setTestingWavAudio(false);
        setTestAudioError('Browser preview error: Browser requires 16-bit standard WAV.');
      });
  };

  const handleCopyLyrics = async () => {
    if (!song.prompt) return;
    try {
      await navigator.clipboard.writeText(song.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  const handleDownload = async (format: AudioFormat, overrideBitDepth?: 16 | 24) => {
    setDownloadingFormat(format);
    setDownloadProgress(0);
    setDownloadError(null);
    setDownloadSuccessFormat(null);
    setDownloadStatusText(
      format === 'wav'
        ? (lang === 'km' ? 'កំពុងបំលែង WAV Lossless...' : 'Converting WAV Lossless...')
        : (lang === 'km' ? 'កំពុងរៀបចំ...' : 'Preparing...')
    );

    const bitDepthToUse = overrideBitDepth || wavBitDepth;
    const downloadUrl =
      format === 'wav'
        ? `/api/song/download/${song.id}?format=wav&bitDepth=${bitDepthToUse}`
        : `/api/song/download/${song.id}?format=${format}`;

    const cleanTitle = (song.title || 'Suno_Song')
      .replace(/[:]/g, ' - ')
      .replace(/[<>"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    const artist = (song.displayName || song.handle || 'Suno')
      .replace(/[:]/g, ' - ')
      .replace(/[<>"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    const bitDepthTag = format === 'wav' ? (bitDepthToUse === 24 ? ' [24-bit Studio Master]' : ' [16-bit Lossless]') : '';
    const filename = `${cleanTitle} - ${artist}${bitDepthTag}.${format}`;

    try {
      await downloadWithSmoothStream(downloadUrl, filename, {
        onProgress: (percent) => {
          setDownloadProgress(percent);
          setDownloadStatusText(
            lang === 'km' ? `កំពុងទាញយក ${percent}%` : `Downloading ${percent}%`
          );
        },
        onStatusChange: (status) => {
          if (status === 'converting') {
            setDownloadStatusText(
              format === 'wav'
                ? (lang === 'km' ? 'កំពុងបំលែង WAV Lossless...' : 'Converting to Lossless WAV...')
                : (lang === 'km' ? 'កំពុងរៀបចំ...' : 'Preparing...')
            );
          } else if (status === 'saving') {
            setDownloadStatusText(
              lang === 'km' ? 'កំពុងរក្សាទុកក្នុងកុំព្យូទ័រ...' : 'Saving file to device...'
            );
          } else if (status === 'completed') {
            setDownloadStatusText(
              lang === 'km' ? '✓ ទាញយកបានជោគជ័យ!' : '✓ Download Complete!'
            );
          }
        }
      });
      setDownloadSuccessFormat(format.toUpperCase());
      setTimeout(() => {
        setDownloadSuccessFormat(null);
      }, 4000);
    } catch (err: any) {
      console.warn('Download note:', err?.message);
      setDownloadError(err?.message || 'Download could not be completed.');
      setTimeout(() => {
        setDownloadError(null);
      }, 8000);
    } finally {
      setDownloadingFormat(null);
      setDownloadProgress(null);
      setDownloadStatusText(null);
    }
  };

  const handleDownloadZip = async (format: 'both' | 'mp3' | 'wav' = 'both') => {
    setDownloadingZip(format);
    const downloadName = song.title || 'Suno_Song';

    try {
      const songList = [{ id: song.id, title: song.title, artist: song.displayName || song.handle }];
      downloadBatchZipViaForm('/api/songs/batch-zip', {
        songs: songList,
        format,
        bitDepth: wavBitDepth,
        name: downloadName
      });

      recordZipDownload({
        name: `${downloadName} [${format === 'both' ? 'MP3+WAV' : format.toUpperCase()}]`,
        format,
        bitDepth: wavBitDepth,
        songs: songList,
        source: 'song'
      });
    } catch (err: any) {
      console.warn('Batch zip note:', err?.message);
    } finally {
      setTimeout(() => {
        setDownloadingZip(null);
      }, 2000);
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleDownloadLyrics = useCallback(() => {
    if (!song.prompt && !song.title) return;

    const cleanTitle = (song.title || 'Suno_Song')
      .replace(/[:]/g, ' - ')
      .replace(/[<>"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    const artist = (song.displayName || song.handle || 'Suno')
      .replace(/[:]/g, ' - ')
      .replace(/[<>"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();

    const formattedDuration = song.duration ? formatDuration(song.duration) : null;

    // Format clean lyrics document with comprehensive track info header
    const lines = [
      `TITLE: ${song.title || 'Untitled'}`,
      `ARTIST: ${song.displayName || 'Unknown'} (@${song.handle || 'anonymous'})`,
      formattedDuration ? `DURATION: ${formattedDuration}` : null,
      song.tags ? `GENRE / STYLE: ${song.tags}` : null,
      song.modelName ? `AI MODEL: ${song.modelName}` : null,
      `GENERATED VIA: Suno AI`,
      `SOURCE URL: ${song.sourceUrl || `https://suno.com/song/${song.id}`}`,
      `DOWNLOAD DATE: ${new Date().toLocaleDateString()}`,
      `==================================================`,
      `LYRICS / PROMPT:`,
      `==================================================`,
      '',
      song.prompt || '(No lyrics provided for this track)',
      ''
    ]
      .filter((line) => line !== null)
      .join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cleanTitle} - ${artist} - Lyrics.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadedLyrics(true);
    setTimeout(() => setDownloadedLyrics(false), 2500);
  }, [song]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {onBackToPlaylist && (
        <button
          type="button"
          id="back-to-playlist-from-song-btn"
          onClick={onBackToPlaylist}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors text-xs font-medium cursor-pointer shadow-md"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <ListMusic className="w-3.5 h-3.5 text-amber-400" />
          <span>
            {t.backToPlaylist}
            {playlistName ? `: ${playlistName}` : ''}
          </span>
        </button>
      )}

      <div className="w-full bg-neutral-900/60 border border-neutral-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
        {/* Top Header: Artwork & Meta */}
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        {/* Cover Art */}
        <div className="relative group shrink-0 mx-auto sm:mx-0">
          <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl overflow-hidden border-2 border-neutral-700/80 shadow-2xl shadow-black/60 relative bg-neutral-950">
            <img
              src={song.imageUrl}
              alt={song.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {/* Quick Favorite on Artwork */}
            <button
              type="button"
              id="song-card-artwork-favorite-btn"
              onClick={handleToggleFavorite}
              className={`absolute top-2.5 right-2.5 z-10 p-2 rounded-full backdrop-blur-md transition-all duration-200 cursor-pointer shadow-lg ${
                isFavorite
                  ? 'bg-rose-500 text-white shadow-rose-500/40 scale-105'
                  : 'bg-black/60 text-neutral-300 hover:text-white hover:bg-black/80 hover:scale-110'
              }`}
              title={isFavorite ? t.removeFromFavorites : t.addToFavorites}
              aria-label={isFavorite ? t.removeFromFavorites : t.addToFavorites}
            >
              <Heart
                className={`w-4 h-4 transition-transform active:scale-125 ${
                  isFavorite ? 'fill-current text-white' : 'text-neutral-300'
                }`}
              />
            </button>

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 pointer-events-none">
              <span className="text-[11px] font-mono text-amber-300">
                Suno AI Clip ID: {song.id.slice(0, 8)}...
              </span>
            </div>
          </div>
          {/* Vinyl record aesthetic glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-2xl blur-xl -z-10 opacity-70 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Title, Artist, Details */}
        <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <ModelBadge modelName={song.modelName} size="md" id="song-card-model-badge" />
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" />
                {t.statusDecrypted}
              </span>

              <div className="flex items-center gap-2 ml-auto">
                {/* Favorite Toggle Button */}
                <button
                  type="button"
                  id="song-card-favorite-btn"
                  onClick={handleToggleFavorite}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer border ${
                    isFavorite
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/40 hover:bg-rose-500/25 shadow-sm shadow-rose-500/20'
                      : 'bg-neutral-800/80 text-neutral-300 border-neutral-700/80 hover:bg-neutral-700/80 hover:text-white hover:border-neutral-600'
                  }`}
                  title={isFavorite ? t.removeFromFavorites : t.addToFavorites}
                >
                  <Heart
                    className={`w-3.5 h-3.5 transition-transform duration-200 active:scale-125 ${
                      isFavorite ? 'fill-rose-500 text-rose-500' : 'text-neutral-400'
                    }`}
                  />
                  <span>{isFavorite ? t.favorited : t.favorite}</span>
                </button>

                <a
                  href={song.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                  title="Open on Suno.com"
                >
                  <span>Suno</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight leading-snug break-words mb-2">
              {song.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2.5 text-sm text-neutral-400 mb-4">
              <button
                type="button"
                id="creator-profile-link-btn"
                onClick={() => onSelectProfile && onSelectProfile(song.handle)}
                className="inline-flex items-center gap-2 hover:bg-neutral-800/90 px-2.5 py-1 rounded-xl border border-transparent hover:border-neutral-700 transition-all cursor-pointer text-left group"
                title={`ចុចលើឈ្មោះ @${song.handle} ដើម្បីស្វែងរក Playlist ដោយស្វ័យប្រវត្តិ`}
              >
                {song.avatarUrl ? (
                  <img
                    src={song.avatarUrl}
                    alt={song.displayName}
                    className="w-6 h-6 rounded-full object-cover border border-neutral-700 group-hover:border-amber-500/50 transition-colors"
                  />
                ) : (
                  <User className="w-4 h-4 text-neutral-500 group-hover:text-amber-400 transition-colors" />
                )}
                <span className="text-neutral-200 font-medium group-hover:text-amber-400 transition-colors">
                  {song.displayName}
                </span>
                <span className="text-neutral-500 font-mono text-xs group-hover:text-amber-300 transition-colors">@{song.handle}</span>
              </button>

              <button
                type="button"
                id="auto-search-creator-playlist-btn"
                onClick={() => onSelectProfile && onSelectProfile(song.handle)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/30 hover:border-amber-500/60 transition-all text-xs font-semibold cursor-pointer shadow-sm shadow-amber-500/10"
                title={`ស្វែងរក Playlist របស់ @${song.handle} ដោយស្វ័យប្រវត្តិ`}
              >
                <ListMusic className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>ស្វែងរក Playlist</span>
              </button>

              <span className="text-neutral-600 hidden sm:inline">•</span>
              <span className="flex items-center gap-1 text-neutral-400 text-xs">
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(song.duration)}
              </span>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-3 flex flex-wrap items-center justify-between text-xs text-neutral-400 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">Sampling:</span>
              <span className="font-mono text-neutral-300">48,000 Hz Stereo</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">DRM Cipher:</span>
              <span className="font-mono text-amber-300">AES-CTR 128-bit</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">Transcode:</span>
              <span className="font-mono text-emerald-400">ffmpeg libmp3lame</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Audio Waveform Analyzer */}
      <div className="mt-6">
        <WebAudioVisualizer
          audioRef={testingWavAudio ? wavAudioRef : playerAudioRef}
          isPlaying={testingWavAudio || isPlayerPlaying}
          songTitle={song.title}
          lang={lang}
        />
      </div>

      {/* Embedded Player */}
      <div className="mt-4">
        <AudioPlayer
          song={song}
          onAudioElement={handlePlayerAudioElement}
          onPlayStateChange={setIsPlayerPlaying}
          onTimeUpdate={(cur, dur) => {
            setPlaybackTime(cur);
            if (dur > 0) setPlaybackDuration(dur);
          }}
        />
      </div>

      {/* Expandable Song Lyrics Container */}
      <div
        id="song-details-expandable-lyrics"
        className="mt-6 bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-4 sm:p-5 transition-all shadow-lg"
      >
        {/* Header & Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {t.lyricsTitle}
                </h3>
                {lyricLines.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-medium">
                    {t.linesCount.replace('{count}', String(lyricLines.length))}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400">
                {lang === 'km'
                  ? 'មើលទំនុកច្រៀងផ្ទាល់នៅលើអេក្រង់ដោយមិនបាច់ទាញយក file .txt'
                  : 'Read song lyrics directly on screen without downloading a .txt file'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 1-Click Copy Lyrics Button */}
            {song.prompt && (
              <button
                type="button"
                id="copy-lyrics-ui-btn"
                onClick={handleCopyLyrics}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                  copied
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border-neutral-700/80 hover:border-amber-500/40'
                }`}
                title={t.copyLyrics}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300 font-bold">{t.lyricsCopied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t.copyLyrics}</span>
                  </>
                )}
              </button>
            )}

            {/* Expand / Collapse Toggle Button */}
            {lyricLines.length > 0 && (
              <button
                type="button"
                id="toggle-expand-lyrics-btn"
                onClick={() => setIsLyricsExpanded((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  isLyricsExpanded
                    ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-amber-300 hover:text-amber-200 border-amber-500/40'
                }`}
                title={isLyricsExpanded ? t.collapseLyrics : t.expandLyrics}
              >
                {isLyricsExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                    <span>{t.collapseLyrics}</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                    <span>{t.showFullLyrics}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Lyrics Content: Collapsed Preview vs Expanded Full View */}
        {lyricLines.length === 0 ? (
          <div className="py-6 text-center text-neutral-500 italic text-xs">
            <FileText className="w-6 h-6 mx-auto mb-2 opacity-40 text-neutral-600" />
            <p>{t.noLyrics || 'No lyrics provided for this track.'}</p>
          </div>
        ) : !isLyricsExpanded ? (
          /* Collapsed Preview State */
          <div className="pt-3">
            <div className="relative max-h-24 overflow-hidden rounded-xl bg-neutral-900/40 p-3 border border-neutral-800/60">
              <div className="space-y-1.5 opacity-80">
                {lyricLines.slice(0, 3).map((line, idx) => {
                  const isHeader = /^\[.*\]$/.test(line) || /^\(.*\)$/.test(line);
                  return (
                    <p
                      key={idx}
                      className={`text-xs sm:text-sm truncate font-sans ${
                        isHeader ? 'text-amber-400 font-semibold uppercase' : 'text-neutral-300'
                      }`}
                    >
                      {line}
                    </p>
                  );
                })}
              </div>
              {/* Fade gradient mask */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neutral-950/60 to-neutral-950 flex items-end justify-center pb-1">
                <button
                  type="button"
                  id="expand-lyrics-preview-link-btn"
                  onClick={() => setIsLyricsExpanded(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-neutral-900/90 hover:bg-neutral-800 px-3 py-1 rounded-full border border-amber-500/30 transition-all cursor-pointer shadow-md"
                >
                  <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
                  <span>
                    {t.showFullLyrics} ({lyricLines.length} {lang === 'km' ? 'ឃ្លា' : 'lines'})
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Expanded Full Lyrics State */
          <div className="pt-3 space-y-3 animate-in fade-in duration-200">
            {/* Secondary Toolbar: Search Filter & Formatted / Raw View Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Search Inside Lyrics */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  id="lyrics-search-input"
                  value={lyricsSearch}
                  onChange={(e) => setLyricsSearch(e.target.value)}
                  placeholder={t.searchLyricsPlaceholder}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-neutral-900/90 border border-neutral-700/80 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
                {lyricsSearch && (
                  <button
                    type="button"
                    onClick={() => setLyricsSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* View Mode Toggle: Formatted vs Raw Prompt */}
              <div className="flex items-center gap-1 p-0.5 rounded-xl bg-neutral-900 border border-neutral-800">
                <button
                  type="button"
                  id="view-formatted-lyrics-btn"
                  onClick={() => setLyricsViewMode('formatted')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    lyricsViewMode === 'formatted'
                      ? 'bg-amber-500 text-neutral-950 shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {t.viewFormattedLyrics}
                </button>
                <button
                  type="button"
                  id="view-raw-lyrics-btn"
                  onClick={() => setLyricsViewMode('raw')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    lyricsViewMode === 'raw'
                      ? 'bg-amber-500 text-neutral-950 shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {t.viewRawLyrics}
                </button>
              </div>
            </div>

            {/* Scrollable Lyrics Container */}
            <div className="max-h-[420px] overflow-y-auto pr-2 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-4 space-y-1.5 scroll-smooth custom-scrollbar">
              {lyricsViewMode === 'raw' ? (
                <pre className="text-xs sm:text-sm text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed select-text">
                  {song.prompt}
                </pre>
              ) : filteredLyricLines.length === 0 ? (
                <div className="py-8 text-center text-neutral-500 text-xs italic">
                  {t.noLyricsFoundQuery}
                </div>
              ) : (
                filteredLyricLines.map((line, idx) => {
                  const isSectionHeader = /^\[.*\]$/.test(line) || /^\(.*\)$/.test(line);

                  if (isSectionHeader) {
                    return (
                      <div key={idx} className="pt-3 pb-1 first:pt-0">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-bold uppercase tracking-wider">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>{line.replace(/^\[|\]$|^\(|\)$/g, '')}</span>
                        </span>
                      </div>
                    );
                  }

                  const isSearchMatch = lyricsSearch.trim() && line.toLowerCase().includes(lyricsSearch.toLowerCase());

                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 py-1 px-2 rounded-lg transition-colors group ${
                        isSearchMatch ? 'bg-amber-500/20 text-amber-200' : 'hover:bg-neutral-800/40 text-neutral-200'
                      }`}
                    >
                      <span className="w-7 text-[10px] font-mono text-neutral-600 group-hover:text-neutral-400 select-none text-right shrink-0 pt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-xs sm:text-sm font-sans leading-relaxed break-words select-text">
                        {line}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Footer Ribbon with Collapse Action */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-mono text-neutral-500">
                {filteredLyricLines.length} {lang === 'km' ? 'ឃ្លាសរុប' : 'total lines'} • {song.title}
              </span>
              <button
                type="button"
                id="collapse-lyrics-bottom-btn"
                onClick={() => setIsLyricsExpanded(false)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-400 hover:text-amber-300 transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-neutral-800"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span>{t.collapseLyrics}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* High-Impact Download Action Cards */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-neutral-200 flex items-center gap-2">
            <FileAudio className="w-4 h-4 text-amber-400" />
            <span>{t.readyToDownload}</span>
          </h2>
          <span className="text-xs text-neutral-400">
            {downloadingFormat ? t.downloading : 'Direct Audio Streams'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Option 1: MP3 320kbps (Most Popular) */}
          <div
            id="download-card-mp3"
            className="relative flex flex-col justify-between p-5 rounded-2xl bg-neutral-950/80 border-2 border-amber-500/40 hover:border-amber-500 transition-all shadow-lg shadow-amber-500/5 group"
          >
            <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 text-[10px] font-extrabold uppercase tracking-wider">
              Recommended
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg font-bold text-white">MP3</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  320 kbps
                </span>
              </div>
              <p className="text-xs text-neutral-400 mb-3">
                {t.qualityMp3}
              </p>
              <div className="text-xs font-mono text-neutral-500 mb-4">
                {t.sizeEstimate}: ~10.7 MB
              </div>
            </div>

            <button
              id="download-mp3-btn"
              onClick={() => handleDownload('mp3')}
              disabled={downloadingFormat === 'mp3'}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-75"
            >
              {downloadingFormat === 'mp3' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : downloadSuccessFormat === 'MP3' ? (
                <Check className="w-4 h-4" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {downloadingFormat === 'mp3'
                  ? downloadStatusText || (downloadProgress !== null && downloadProgress > 0 ? `${downloadProgress}%` : t.downloading)
                  : downloadSuccessFormat === 'MP3'
                  ? (lang === 'km' ? '✓ ទាញយក MP3 បានជោគជ័យ!' : '✓ MP3 Downloaded!')
                  : t.downloadMp3}
              </span>
            </button>
            {downloadError && downloadingFormat === null && (
              <div className="mt-2 p-2 rounded-lg bg-red-950/40 border border-red-500/30 text-[11px] text-red-300">
                <a
                  href={`/api/song/download/${song.id}?format=mp3`}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="text-amber-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>{lang === 'km' ? 'ទាញយកតាមតំណភ្ជាប់ផ្ទាល់' : 'Direct download link'}</span>
                </a>
              </div>
            )}
          </div>

          {/* Option 2: WAV Studio Lossless (កម្រិតខ្ពស់) */}
          <div
            id="download-card-wav"
            className="relative flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-b from-sky-950/20 via-neutral-950/90 to-neutral-950 border-2 border-sky-500/40 hover:border-sky-500/70 transition-all shadow-xl group"
          >
            {/* Ambient indicator */}
            <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 text-[10px] font-extrabold text-neutral-950 uppercase tracking-wider flex items-center gap-1 shadow-md">
              <Sparkles className="w-3 h-3" />
              <span>{wavBitDepth === 24 ? t.wavMasterBadge : t.wavCdBadge}</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2 pt-1">
                <span className="text-lg font-bold text-white flex items-center gap-1.5">
                  <span>WAV</span>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    {wavBitDepth === 24 ? '24-bit / 48kHz' : '16-bit / 48kHz'}
                  </span>
                </span>
              </div>

              {/* Bit-depth Selector Pills (16-bit is Universal, 24-bit is DAW/Hi-Res) */}
              <div className="flex items-center gap-1.5 p-1 bg-neutral-900/90 border border-neutral-800 rounded-xl mb-3">
                <button
                  type="button"
                  id="select-wav-16bit-btn"
                  onClick={() => setWavBitDepth(16)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    wavBitDepth === 16
                      ? 'bg-sky-500 text-neutral-950 shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <span>16-bit (ចាក់បានគ្រប់ឧបករណ៍)</span>
                </button>
                <button
                  type="button"
                  id="select-wav-24bit-btn"
                  onClick={() => setWavBitDepth(24)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    wavBitDepth === 24
                      ? 'bg-sky-500 text-neutral-950 shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <span>24-bit (DAW Master)</span>
                </button>
              </div>

              <p className="text-xs text-neutral-300 mb-2 leading-relaxed">
                {wavBitDepth === 16 ? t.qualityWav16 : t.qualityWav}
              </p>

              {/* Compatibility Notice */}
              {wavBitDepth === 24 && (
                <div className="p-2.5 mb-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-300 leading-snug">
                  ⚠️ {t.wavCompatibilityTip}
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 mb-3 pt-1 border-t border-neutral-800/60">
                <span>{wavBitDepth === 24 ? 'Bitrate: 2,304 kbps' : 'Bitrate: 1,536 kbps'}</span>
                <span className="text-sky-400 font-semibold">
                  ~{(song.duration * (wavBitDepth === 24 ? 0.2746 : 0.1831)).toFixed(1)} MB
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                id="download-wav-btn"
                onClick={() => handleDownload('wav')}
                disabled={downloadingFormat === 'wav'}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 hover:from-sky-400 hover:to-cyan-300 text-neutral-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-75"
              >
                {downloadingFormat === 'wav' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : downloadSuccessFormat === 'WAV' ? (
                  <Check className="w-4 h-4 text-emerald-950" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>
                  {downloadingFormat === 'wav'
                    ? downloadStatusText || (downloadProgress !== null && downloadProgress > 0 ? `${downloadProgress}%` : t.downloading)
                    : downloadSuccessFormat === 'WAV'
                    ? (lang === 'km' ? '✓ ទាញយក WAV បានជោគជ័យ!' : '✓ WAV Downloaded!')
                    : wavBitDepth === 16
                    ? t.downloadWav16
                    : t.downloadWavHiRes}
                </span>
              </button>

              {downloadError && downloadingFormat === null && (
                <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-bold text-red-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{lang === 'km' ? 'មានបញ្ហាក្នុងការទាញយក' : 'Download Issue'}</span>
                  </div>
                  <p className="text-[11px] text-red-300/80">{downloadError}</p>
                  <a
                    href={`/api/song/download/${song.id}?format=wav&bitDepth=${wavBitDepth}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="text-[11px] text-sky-400 hover:text-sky-300 underline font-semibold flex items-center gap-1 mt-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>{lang === 'km' ? 'ចុចទីនេះដើម្បីទាញយកផ្ទាល់ (Direct Link)' : 'Open direct download link'}</span>
                  </a>
                </div>
              )}

              {/* Test Audio Button */}
              <button
                type="button"
                id="test-wav-audio-btn"
                onClick={handleTestWav}
                className="w-full py-1.5 px-3 rounded-lg bg-sky-950/40 hover:bg-sky-900/50 text-sky-400 border border-sky-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{testingWavAudio ? '⏸ កំពុងចាក់តេស្ត WAV...' : t.testPlayWav}</span>
              </button>

              {testAudioError && (
                <div className="text-[11px] text-amber-400/90 text-center px-1">
                  {testAudioError}
                </div>
              )}
            </div>
          </div>

          {/* Option 3: M4A Original Source */}
          <div
            id="download-card-m4a"
            className="flex flex-col justify-between p-5 rounded-2xl bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 transition-all shadow-lg group"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg font-bold text-white">M4A</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                  Opus/AAC
                </span>
              </div>
              <p className="text-xs text-neutral-400 mb-3">
                {t.qualityM4a}
              </p>
              <div className="text-xs font-mono text-neutral-500 mb-4">
                {t.sizeEstimate}: ~4.6 MB
              </div>
            </div>

            <button
              id="download-m4a-btn"
              onClick={() => handleDownload('m4a')}
              disabled={downloadingFormat === 'm4a'}
              className="w-full py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-sm flex items-center justify-center gap-2 border border-neutral-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-75"
            >
              {downloadingFormat === 'm4a' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : downloadSuccessFormat === 'M4A' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Download className="w-4 h-4 text-neutral-400" />
              )}
              <span>
                {downloadingFormat === 'm4a'
                  ? downloadStatusText || t.downloading
                  : downloadSuccessFormat === 'M4A'
                  ? (lang === 'km' ? '✓ ទាញយក M4A បានជោគជ័យ!' : '✓ M4A Downloaded!')
                  : t.downloadM4a}
              </span>
            </button>
          </div>
        </div>

        {/* Option 4: ZIP Archive with Original Khmer/Unicode Title (MP3 + WAV) */}
        <div
          id="download-card-zip-bundle"
          className="mt-4 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-neutral-900/95 to-sky-500/10 border border-amber-500/30 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <FolderArchive className="w-5 h-5 text-amber-400" />
              <span className="text-base font-bold text-white">
                {t.downloadZipBoth}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                {t.downloadZipBothBadge}
              </span>
            </div>
            <p className="text-xs text-neutral-300 mb-2 leading-relaxed">
              {t.downloadZipBothDesc}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-amber-300/90 font-medium">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-neutral-400">{t.originalTitleAttached}:</span>
              <span className="text-amber-200 font-semibold truncate max-w-xs sm:max-w-md">
                "{song.title}"
              </span>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 w-full lg:w-auto">
            <button
              type="button"
              id="download-zip-both-btn"
              onClick={() => handleDownloadZip('both')}
              disabled={downloadingZip !== null}
              className="flex-1 lg:flex-initial py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-sky-500 hover:from-amber-400 hover:to-sky-400 text-neutral-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              <FolderArchive className="w-4 h-4" />
              <span>
                {downloadingZip === 'both' ? t.preparingZip : `${t.downloadZipBoth}`}
              </span>
            </button>
            <button
              type="button"
              id="download-zip-mp3-btn"
              onClick={() => handleDownloadZip('mp3')}
              disabled={downloadingZip !== null}
              className="py-3 px-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-400 text-xs font-bold border border-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
              title="Download MP3 in ZIP with Original Title"
            >
              <span>{downloadingZip === 'mp3' ? '...' : 'MP3 (ZIP)'}</span>
            </button>
            <button
              type="button"
              id="download-zip-wav-btn"
              onClick={() => handleDownloadZip('wav')}
              disabled={downloadingZip !== null}
              className="py-3 px-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sky-400 text-xs font-bold border border-sky-500/20 transition-all cursor-pointer disabled:opacity-50"
              title="Download Lossless WAV in ZIP with Original Title"
            >
              <span>{downloadingZip === 'wav' ? '...' : 'WAV (ZIP)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Tabs for Lyrics, Tags, & Technical Decryption Info */}
      <div className="mt-8 pt-6 border-t border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3 mb-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              id="tab-lyrics-btn"
              onClick={() => setActiveTab('lyrics')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'lyrics'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>{t.lyricsTitle}</span>
            </button>

            <button
              id="tab-tags-btn"
              onClick={() => setActiveTab('tags')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'tags'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>{t.styleTitle}</span>
            </button>

            <button
              id="tab-tech-btn"
              onClick={() => setActiveTab('tech')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'tech'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>{t.techTitle}</span>
            </button>
          </div>

          {/* Download Lyrics .txt Button on Tab Ribbon */}
          {song.prompt && (
            <button
              type="button"
              id="tab-download-lyrics-btn"
              onClick={handleDownloadLyrics}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer shrink-0 ${
                downloadedLyrics
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border-neutral-700/80 hover:border-amber-500/40'
              }`}
              title={t.downloadLyricsTooltip}
            >
              {downloadedLyrics ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-semibold">{t.downloadLyricsSuccess}</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.downloadLyrics}</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Tab 1: Synchronized Lyrics with Audio Playback Auto-Scroll */}
        {activeTab === 'lyrics' && (
          <SynchronizedLyrics
            prompt={song.prompt}
            currentTime={playbackTime}
            duration={playbackDuration || song.duration || 0}
            isPlaying={isPlayerPlaying || testingWavAudio}
            onSeek={handleSeekLyrics}
            lang={lang}
            onCopy={handleCopyLyrics}
            copied={copied}
            onDownloadLyrics={handleDownloadLyrics}
            downloadedLyrics={downloadedLyrics}
          />
        )}

        {/* Tab 2: Musical Style & Tags */}
        {activeTab === 'tags' && (
          <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-5">
            <h3 className="text-xs font-mono text-neutral-400 mb-3 uppercase tracking-wider">
              Extracted Tags & Arrangement
            </h3>
            <div className="flex flex-wrap gap-2">
              {song.tags ? (
                song.tags
                  .split(/[\[\]]+/)
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs hover:border-amber-500/30 transition-colors"
                    >
                      {tag}
                    </span>
                  ))
              ) : (
                <span className="text-neutral-500 text-xs">No tags available.</span>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: DRM & Technical Specs */}
        {activeTab === 'tech' && (
          <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-5 space-y-4 text-xs font-mono text-neutral-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                <span className="text-neutral-500 block mb-1">AI Model Engine</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <ModelBadge modelName={song.modelName} size="sm" />
                  <span className="text-[11px] text-neutral-400 font-sans">
                    {song.modelName?.toLowerCase().includes('v6-pro') || song.modelName?.toLowerCase().includes('v6 pro')
                      ? 'SUNO V6 PRO • 48kHz Studio Master & Next-Gen Synthesis'
                      : song.modelName?.toLowerCase().includes('v6')
                      ? 'Next-Gen 48kHz Lossless Audio'
                      : song.modelName?.toLowerCase().includes('v3.8')
                      ? 'Refined Melodic & Harmonic Gen (V3.8 Ready)'
                      : 'Verified Supported Suno Model'}
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                <span className="text-neutral-500 block mb-1">Song Clip UUID</span>
                <span className="text-amber-400 select-all">{song.id}</span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                <span className="text-neutral-500 block mb-1">Rights License Server</span>
                <span className="text-neutral-200">https://studio-api-prod.suno.com/api/mango/rights</span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                <span className="text-neutral-500 block mb-1">Decryption Algorithm</span>
                <span className="text-emerald-400">AES-CTR 128-bit via Derived GLT Token</span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 sm:col-span-2">
                <span className="text-neutral-500 block mb-1">Audio Transcoder & Sample Rate</span>
                <span className="text-neutral-200">FFmpeg 4.4+ Native (libmp3lame 320k / PCM 24-bit 48kHz Studio Master) • Full SUNO V6 PRO, V6 & V3.8 DRM Decryption</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
              <span className="text-neutral-500 block mb-1">Encrypted CDN Endpoint</span>
              <span className="text-neutral-400 break-all">{song.audioUrl}</span>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

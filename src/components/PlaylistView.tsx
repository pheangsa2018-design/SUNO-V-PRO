import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ListMusic,
  Download,
  Play,
  Clock,
  Search,
  ArrowLeft,
  Share2,
  Check,
  Disc3,
  FolderArchive,
  CheckSquare,
  X,
  Sparkles,
  ExternalLink,
  Music2,
  FileAudio,
  User,
  Pause,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Layers,
  Tag,
  RefreshCw,
  Maximize2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  RotateCcw,
  ChevronDown,
  Settings,
  Minus,
  ArrowUpDown
} from 'lucide-react';
import type { PlaylistInfo, ProfileSongItem, AudioFormat, AsyncZipJobStatus } from '../types.js';
import type { Language } from '../i18n.js';
import { translations } from '../i18n.js';
import { AsyncZipModal } from './AsyncZipModal.js';
import { BatchDownloadModal, type BatchDownloadProgress } from './BatchDownloadModal.js';
import { ModelBadge } from './ModelBadge.js';
import { downloadWithSmoothStream, downloadBatchZipViaForm, downloadBatchZipViaStream } from '../utils/downloadHelper.js';
import { recordZipDownload } from '../utils/zipHistoryStorage.js';

// Fisher-Yates shuffle algorithm to randomize playlist song order
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export type PlaylistSortOption = 'default' | 'duration-asc' | 'duration-desc' | 'title-asc' | 'title-desc';

export interface PlaylistZipProgress {
  isActive: boolean;
  jobId?: string;
  status: 'queued' | 'processing' | 'streaming' | 'ready' | 'error' | 'cancelled';
  percent: number;
  current: number;
  total: number;
  currentTitle: string;
  currentStep: string;
  format: AudioFormat | 'both';
  bitDepth: 16 | 24;
  zipFilename?: string;
  zipSize?: number;
  downloadUrl?: string;
  error?: string;
  receivedMb?: string;
}

interface PlaylistViewProps {
  playlist: PlaylistInfo;
  onSelectSong: (songId: string) => void;
  onSelectProfile?: (handle: string) => void;
  onBack?: () => void;
  lang: Language;
}

interface SequentialProgress {
  current: number;
  total: number;
  currentTitle: string;
  percent: number;
  status: 'downloading' | 'completed';
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlist,
  onSelectSong,
  onSelectProfile,
  onBack,
  lang
}) => {
  const t = translations[lang];
  const [filterText, setFilterText] = useState('');
  const [downloadingSong, setDownloadingSong] = useState<{
    id: string;
    format: AudioFormat;
    percent?: number;
    statusText?: string;
  } | null>(null);
  const [downloadToast, setDownloadToast] = useState<{
    title: string;
    format: string;
    status: string;
    percent?: number;
    isError?: boolean;
    directUrl?: string;
  } | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  // Checkbox selection state - allows selecting multiple tracks for batch ZIP download
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const lastClickedIndexRef = useRef<number | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchDownloadProgress>({
    status: 'idle',
    percent: 0,
    currentStep: ''
  });
  const [zipDownloading, setZipDownloading] = useState<AudioFormat | 'both' | null>(null);
  const [isSequentialActive, setIsSequentialActive] = useState(false);
  const [sequentialProgress, setSequentialProgress] = useState<SequentialProgress | null>(null);
  const batchAbortRef = useRef(false);

  // Asynchronous Playlist ZIP state
  const [allFormat, setAllFormat] = useState<AudioFormat | 'both'>('mp3');
  const [selectedBitDepth, setSelectedBitDepth] = useState<16 | 24>(16);
  const [downloadMode, setDownloadMode] = useState<'async' | 'direct'>('direct');
  const [isAsyncModalOpen, setIsAsyncModalOpen] = useState(false);
  const [asyncJob, setAsyncJob] = useState<AsyncZipJobStatus | null>(null);
  const [asyncFormat, setAsyncFormat] = useState<AudioFormat | 'both'>('mp3');
  const [asyncBitDepth, setAsyncBitDepth] = useState<16 | 24>(16);
  const [asyncTotalSongs, setAsyncTotalSongs] = useState<number>(playlist.songCount);
  const pollTimerRef = useRef<any>(null);

  // Settings dropdown state for 'Download All' batch export
  const [isExportSettingsOpen, setIsExportSettingsOpen] = useState(false);
  const exportSettingsRef = useRef<HTMLDivElement | null>(null);
  const [isTracksHeaderSettingsOpen, setIsTracksHeaderSettingsOpen] = useState(false);
  const tracksHeaderSettingsRef = useRef<HTMLDivElement | null>(null);

  // In-Place Playlist Download All ZIP Progress State
  const [zipProgress, setZipProgress] = useState<PlaylistZipProgress>({
    isActive: false,
    status: 'queued',
    percent: 0,
    current: 0,
    total: playlist.songCount,
    currentTitle: '',
    currentStep: '',
    format: 'mp3',
    bitDepth: 16
  });

  // Audio preview state
  const [previewingSongId, setPreviewingSongId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Shuffle Play & Sequential Playback State
  const [displaySongs, setDisplaySongs] = useState<ProfileSongItem[]>(() => playlist.songs);
  const [isShuffleActive, setIsShuffleActive] = useState(false);
  const [sortBy, setSortBy] = useState<PlaylistSortOption>('default');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [playbackVolume, setPlaybackVolume] = useState(0.85);
  const [isPlaybackMuted, setIsPlaybackMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const sequentialAudioRef = useRef<HTMLAudioElement | null>(null);

  const currentPlayingSong =
    currentTrackIndex >= 0 && currentTrackIndex < displaySongs.length
      ? displaySongs[currentTrackIndex]
      : null;

  // Track format preferences (MP3 or WAV) per song
  const [songChosenFormats, setSongChosenFormats] = useState<Record<string, 'mp3' | 'wav'>>(() => {
    try {
      const saved = localStorage.getItem(`suno_playlist_track_formats_${playlist.id}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const getSongChosenFormat = (songId: string): 'mp3' | 'wav' => {
    if (songChosenFormats[songId]) {
      return songChosenFormats[songId];
    }
    return allFormat === 'wav' ? 'wav' : 'mp3';
  };

  const handleToggleSongFormat = (songId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSongChosenFormats((prev) => {
      const current = prev[songId] || (allFormat === 'wav' ? 'wav' : 'mp3');
      const next: 'mp3' | 'wav' = current === 'mp3' ? 'wav' : 'mp3';
      const updated = { ...prev, [songId]: next };
      try {
        localStorage.setItem(`suno_playlist_track_formats_${playlist.id}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleSetSelectedFormat = (format: 'mp3' | 'wav', ids?: string[]) => {
    const targetIds = ids || selectedIds;
    if (targetIds.length === 0) return;
    setSongChosenFormats((prev) => {
      const next = { ...prev };
      targetIds.forEach((id) => {
        next[id] = format;
      });
      try {
        localStorage.setItem(`suno_playlist_track_formats_${playlist.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const selectedFormatsSummary = useMemo(() => {
    let mp3Count = 0;
    let wavCount = 0;
    selectedIds.forEach((id) => {
      if (getSongChosenFormat(id) === 'wav') {
        wavCount++;
      } else {
        mp3Count++;
      }
    });
    return { mp3Count, wavCount };
  }, [selectedIds, songChosenFormats, allFormat]);

  const selectedSongsList = useMemo(() => {
    return playlist.songs.filter((s) => selectedIds.includes(s.id));
  }, [playlist.songs, selectedIds]);

  const handleRemoveSongFromSelection = (songId: string) => {
    setSelectedIds((prev) => prev.filter((id) => id !== songId));
  };

  // When playlist changes, reset selections, songs, and audio state
  useEffect(() => {
    setSelectedIds([]);
    setDisplaySongs(playlist.songs);
    setIsShuffleActive(false);
    setSortBy('default');
    setIsSortDropdownOpen(false);
    setCurrentTrackIndex(-1);
    setIsPlaying(false);
    if (sequentialAudioRef.current) {
      sequentialAudioRef.current.pause();
      sequentialAudioRef.current.src = '';
    }
    try {
      const saved = localStorage.getItem(`suno_playlist_track_formats_${playlist.id}`);
      setSongChosenFormats(saved ? JSON.parse(saved) : {});
    } catch {
      setSongChosenFormats({});
    }
  }, [playlist.id]);

  // Clean up audio previews and sequential audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.src = '';
      }
      if (sequentialAudioRef.current) {
        sequentialAudioRef.current.pause();
        sequentialAudioRef.current.src = '';
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // Close export settings dropdown and sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        exportSettingsRef.current &&
        !exportSettingsRef.current.contains(target)
      ) {
        setIsExportSettingsOpen(false);
      }
      if (
        tracksHeaderSettingsRef.current &&
        !tracksHeaderSettingsRef.current.contains(target)
      ) {
        setIsTracksHeaderSettingsOpen(false);
      }
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(target)
      ) {
        setIsSortDropdownOpen(false);
      }
    };
    if (isExportSettingsOpen || isTracksHeaderSettingsOpen || isSortDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportSettingsOpen, isTracksHeaderSettingsOpen, isSortDropdownOpen]);

  const formatDuration = (seconds?: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const totalSecs = Math.floor(seconds);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const playTrackAtIndex = (index: number, songList = displaySongs) => {
    if (index < 0 || index >= songList.length) return;
    const song = songList[index];
    setCurrentTrackIndex(index);
    setPlaybackTime(0);
    setPlaybackDuration(song.duration || 0);
    setIsBuffering(true);
    setIsPlaying(true);

    // Stop quick preview if playing
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPreviewingSongId(null);
    }
  };

  // Play audio whenever currentPlayingSong changes
  useEffect(() => {
    if (currentPlayingSong && sequentialAudioRef.current) {
      sequentialAudioRef.current.volume = isPlaybackMuted ? 0 : playbackVolume;
      sequentialAudioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        })
        .catch((err) => {
          console.warn('Sequential playback start error:', err?.message || 'Playback blocked');
          setIsPlaying(false);
          setIsBuffering(false);
        });
    }
  }, [currentPlayingSong?.id]);

  // Randomizes playlist song order and updates displayed song list
  const handleShuffleList = (startPlayback: boolean = false) => {
    if (playlist.songs.length === 0) return;
    const baseList: ProfileSongItem[] = displaySongs.length > 0 ? displaySongs : playlist.songs;
    const shuffled: ProfileSongItem[] = shuffleArray<ProfileSongItem>(baseList);
    setDisplaySongs(shuffled);
    setIsShuffleActive(true);
    setSortBy('default');

    if (currentPlayingSong) {
      const activeIdx = shuffled.findIndex((s) => s.id === currentPlayingSong.id);
      setCurrentTrackIndex(activeIdx >= 0 ? activeIdx : 0);
    } else if (startPlayback) {
      playTrackAtIndex(0, shuffled);
    }
  };

  // Sorts the playlist tracks (by duration ascending, duration descending, title, or original)
  const handleSortChange = (option: PlaylistSortOption) => {
    setSortBy(option);
    setIsSortDropdownOpen(false);

    let nextList: ProfileSongItem[] = [];
    if (option === 'duration-asc') {
      setIsShuffleActive(false);
      nextList = [...playlist.songs].sort((a, b) => (a.duration || 0) - (b.duration || 0));
    } else if (option === 'duration-desc') {
      setIsShuffleActive(false);
      nextList = [...playlist.songs].sort((a, b) => (b.duration || 0) - (a.duration || 0));
    } else if (option === 'title-asc') {
      setIsShuffleActive(false);
      nextList = [...playlist.songs].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (option === 'title-desc') {
      setIsShuffleActive(false);
      nextList = [...playlist.songs].sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    } else {
      setIsShuffleActive(false);
      nextList = [...playlist.songs];
    }

    setDisplaySongs(nextList);

    if (currentPlayingSong) {
      const activeIdx = nextList.findIndex((s) => s.id === currentPlayingSong.id);
      setCurrentTrackIndex(activeIdx >= 0 ? activeIdx : 0);
    }
  };

  // Randomizes playlist song order and initiates automatic sequential playback flow
  const handleShufflePlay = () => {
    handleShuffleList(true);
  };

  const handleReShuffle = () => {
    handleShuffleList(false);
  };

  const handlePlayNext = () => {
    if (displaySongs.length === 0) return;
    const nextIndex = (currentTrackIndex + 1) % displaySongs.length;
    playTrackAtIndex(nextIndex, displaySongs);
  };

  const handlePlayPrev = () => {
    if (displaySongs.length === 0) return;
    if (sequentialAudioRef.current && sequentialAudioRef.current.currentTime > 3) {
      sequentialAudioRef.current.currentTime = 0;
      setPlaybackTime(0);
      return;
    }
    const prevIndex = (currentTrackIndex - 1 + displaySongs.length) % displaySongs.length;
    playTrackAtIndex(prevIndex, displaySongs);
  };

  const togglePlayback = () => {
    if (!sequentialAudioRef.current) return;
    if (isPlaying) {
      sequentialAudioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (currentTrackIndex === -1 && displaySongs.length > 0) {
        playTrackAtIndex(0);
      } else {
        sequentialAudioRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            console.warn('Resume error:', err?.message || 'Resume failed');
          });
      }
    }
  };

  const handleRestoreOriginalOrder = () => {
    setIsShuffleActive(false);
    setSortBy('default');
    const activeSong = currentPlayingSong;
    setDisplaySongs(playlist.songs);
    if (activeSong) {
      const origIndex = playlist.songs.findIndex((s) => s.id === activeSong.id);
      setCurrentTrackIndex(origIndex >= 0 ? origIndex : 0);
    }
  };

  const handleSeekPlayback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPlaybackTime(val);
    if (sequentialAudioRef.current) {
      sequentialAudioRef.current.currentTime = val;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPlaybackVolume(val);
    if (sequentialAudioRef.current) {
      sequentialAudioRef.current.volume = isPlaybackMuted ? 0 : val;
    }
    if (val === 0) setIsPlaybackMuted(true);
    else setIsPlaybackMuted(false);
  };

  const togglePlaybackMute = () => {
    if (!sequentialAudioRef.current) return;
    const nextMuted = !isPlaybackMuted;
    setIsPlaybackMuted(nextMuted);
    sequentialAudioRef.current.muted = nextMuted;
    if (!nextMuted && playbackVolume === 0) {
      setPlaybackVolume(0.5);
      sequentialAudioRef.current.volume = 0.5;
    }
  };

  const handleStopPlayback = () => {
    if (sequentialAudioRef.current) {
      sequentialAudioRef.current.pause();
      sequentialAudioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTrackIndex(-1);
  };

  // Extract popular tags across playlist tracks for 1-click quick-filter shortcuts
  const playlistTags = useMemo(() => {
    const counts = new Map<string, number>();
    playlist.songs.forEach((s) => {
      if (s.tags) {
        s.tags
          .split(/[,#\s]+/)
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length >= 2 && !/^\d+$/.test(t))
          .forEach((tag) => {
            counts.set(tag, (counts.get(tag) || 0) + 1);
          });
      }
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [playlist.id, playlist.songs]);

  const filteredSongs = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) return displaySongs;
    const cleanQuery = query.replace(/^#/, '');

    return displaySongs.filter((song) => {
      const titleMatch = Boolean(song.title && song.title.toLowerCase().includes(query));
      const tagsMatch = Boolean(song.tags && song.tags.toLowerCase().includes(cleanQuery));
      return titleMatch || tagsMatch;
    });
  }, [displaySongs, filterText]);

  const filteredSongIds = filteredSongs.map((s) => s.id);
  const allFilteredSelected =
    filteredSongIds.length > 0 && filteredSongIds.every((id) => selectedIds.includes(id));
  const someFilteredSelected =
    filteredSongIds.some((id) => selectedIds.includes(id)) && !allFilteredSelected;

  const handleToggleSelectSong = (songId: string, index?: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Shift + Click range selection
    if (e && e.shiftKey && typeof index === 'number' && lastClickedIndexRef.current !== null) {
      const start = Math.min(lastClickedIndexRef.current, index);
      const end = Math.max(lastClickedIndexRef.current, index);
      const rangeIds = filteredSongs.slice(start, end + 1).map((s) => s.id);

      const isTargetAlreadySelected = selectedIds.includes(songId);
      if (isTargetAlreadySelected) {
        setSelectedIds((prev) => prev.filter((id) => !rangeIds.includes(id)));
      } else {
        setSelectedIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
      }
      lastClickedIndexRef.current = index;
      return;
    }

    if (typeof index === 'number') {
      lastClickedIndexRef.current = index;
    }
    setSelectedIds((prev) =>
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId]
    );
  };

  const handleInvertSelection = () => {
    const currentSet = new Set(selectedIds);
    const inverted = filteredSongs
      .map((s) => s.id)
      .filter((id) => !currentSet.has(id));
    setSelectedIds(inverted);
  };

  const handleSelectAll = () => {
    setSelectedIds(Array.from(new Set(filteredSongIds)));
  };

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredSongIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredSongIds])));
    }
  };

  const handleSelectTopN = (n: number) => {
    const topIds = filteredSongs.slice(0, n).map((s) => s.id);
    setSelectedIds(topIds);
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  // Preview Audio
  const handleTogglePreview = (song: ProfileSongItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingSongId === song.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPreviewingSongId(null);
    } else {
      if (!previewAudioRef.current) {
        previewAudioRef.current = new Audio();
        previewAudioRef.current.onended = () => setPreviewingSongId(null);
      }
      previewAudioRef.current.src = `/api/song/stream/${song.id}?format=m4a`;
      previewAudioRef.current.play().catch((err) => {
        console.warn('Audio preview error:', err);
      });
      setPreviewingSongId(song.id);
    }
  };

  // Single Song Download
  const handleDownload = async (song: ProfileSongItem, format: AudioFormat, e: React.MouseEvent) => {
    e.stopPropagation();
    const chosenFmt: 'mp3' | 'wav' = format === 'wav' ? 'wav' : 'mp3';
    setSongChosenFormats((prev) => {
      const next = { ...prev, [song.id]: chosenFmt };
      try {
        localStorage.setItem(`suno_playlist_track_formats_${playlist.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });

    setDownloadingSong({ id: song.id, format, percent: 0 });
    setDownloadToast({
      title: song.title || 'Suno Song',
      format: format.toUpperCase(),
      status: format === 'wav'
        ? (lang === 'km' ? 'កំពុងបំលែងជា WAV Lossless...' : 'Converting to Lossless WAV...')
        : (lang === 'km' ? 'កំពុងរៀបចំ...' : 'Preparing...'),
      percent: 0
    });

    const downloadUrl =
      format === 'wav'
        ? `/api/song/download/${song.id}?format=wav&bitDepth=16`
        : `/api/song/download/${song.id}?format=${format}`;

    const cleanTitle = (song.title || 'Suno_Song')
      .replace(/[:]/g, ' - ')
      .replace(/[<>"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    const artist = (playlist.name || 'Suno')
      .replace(/[:]/g, ' - ')
      .replace(/[<>"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    const bitDepthTag = format === 'wav' ? ' [16-bit Lossless]' : '';
    const filename = `${cleanTitle} - ${artist}${bitDepthTag}.${format}`;

    try {
      await downloadWithSmoothStream(downloadUrl, filename, {
        onProgress: (percent) => {
          setDownloadingSong({ id: song.id, format, percent });
          setDownloadToast(prev => prev ? {
            ...prev,
            status: lang === 'km' ? `កំពុងទាញយក ${percent}%` : `Downloading ${percent}%`,
            percent
          } : null);
        },
        onStatusChange: (status) => {
          if (status === 'converting') {
            setDownloadToast(prev => prev ? {
              ...prev,
              status: format === 'wav'
                ? (lang === 'km' ? 'កំពុងបំលែង WAV Lossless...' : 'Converting WAV Lossless...')
                : (lang === 'km' ? 'កំពុងរៀបចំ...' : 'Preparing...')
            } : null);
          } else if (status === 'saving') {
            setDownloadToast(prev => prev ? {
              ...prev,
              status: lang === 'km' ? 'កំពុងរក្សាទុក...' : 'Saving to device...',
              percent: 100
            } : null);
          } else if (status === 'completed') {
            setDownloadToast({
              title: song.title || 'Suno Song',
              format: format.toUpperCase(),
              status: lang === 'km' ? '✓ ទាញយកបានជោគជ័យ!' : '✓ Download Complete!',
              percent: 100
            });
            setTimeout(() => setDownloadToast(null), 4000);
          }
        }
      });
    } catch (err: any) {
      console.warn('Playlist song download note:', err?.message);
      setDownloadToast({
        title: song.title || 'Suno Song',
        format: format.toUpperCase(),
        status: err?.message || 'Download failed',
        isError: true,
        directUrl: downloadUrl
      });
      setTimeout(() => setDownloadToast(null), 8000);
    } finally {
      setTimeout(() => {
        setDownloadingSong(null);
      }, 1000);
    }
  };

  // Batch Direct Streaming ZIP Download with live byte progress & iframe resilience
  const handleBatchZipDownload = async (
    format: AudioFormat | 'both' = 'mp3',
    bitDepth: 16 | 24 = selectedBitDepth,
    customSongIds?: string[]
  ) => {
    const targetIds =
      customSongIds && customSongIds.length > 0
        ? customSongIds
        : selectedIds.length > 0
        ? selectedIds
        : playlist.songs.map((s) => s.id);

    if (targetIds.length === 0) return;
    setZipDownloading(format);

    const playlistName = playlist.name || 'Suno_Playlist';
    const targetSongs = playlist.songs
      .filter((s) => targetIds.includes(s.id))
      .map((s) => ({
        id: s.id,
        title: s.title,
        artist: playlist.userDisplayName || playlist.userHandle || 'Suno'
      }));

    const formatLabel = format === 'both' ? 'MP3 + WAV' : format.toUpperCase();
    const suggestedZipFilename = `${playlistName} [${formatLabel}].zip`;

    setZipProgress({
      isActive: true,
      status: 'streaming',
      percent: 5,
      current: 1,
      total: targetSongs.length,
      currentTitle: targetSongs[0]?.title || '',
      currentStep:
        lang === 'km'
          ? `កំពុងតភ្ជាប់ និងបង្កើតកញ្ចប់ ZIP (${targetSongs.length} បទ)...`
          : `Connecting & streaming ZIP package (${targetSongs.length} tracks)...`,
      format,
      bitDepth,
      zipFilename: suggestedZipFilename
    });

    setDownloadToast({
      title: `${playlistName} [${formatLabel}]`,
      format: 'ZIP',
      status:
        lang === 'km'
          ? `កំពុងតភ្ជាប់ និងបង្កើតកញ្ចប់ ZIP (${targetSongs.length} បទ)...`
          : `Connecting & streaming ZIP package (${targetSongs.length} tracks)...`,
      percent: undefined
    });

    try {
      await downloadBatchZipViaStream(
        '/api/songs/batch-zip',
        {
          songs: targetSongs,
          format,
          bitDepth,
          name: playlistName
        },
        suggestedZipFilename,
        {
          onProgress: (receivedBytes, totalBytes) => {
            const mb = (receivedBytes / (1024 * 1024)).toFixed(1);
            let percent: number | undefined;
            if (totalBytes && totalBytes > 0) {
              percent = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
            } else {
              const estimatedBytes = targetSongs.length * (format === 'wav' ? 35 : format === 'both' ? 40 : 4.5) * 1024 * 1024;
              percent = Math.min(95, Math.max(8, Math.round((receivedBytes / estimatedBytes) * 100)));
            }
            setZipProgress((prev) => ({
              ...prev,
              percent: percent || prev.percent,
              receivedMb: mb,
              currentStep:
                lang === 'km'
                  ? `កំពុងទាញយកកញ្ចប់ ZIP (${mb} MB)...`
                  : `Streaming ZIP archive (${mb} MB received)...`
            }));
            setDownloadToast((prev) =>
              prev
                ? {
                    ...prev,
                    status:
                      lang === 'km'
                        ? `កំពុងទាញយកកញ្ចប់ ZIP (${mb} MB)...`
                        : `Downloading ZIP package (${mb} MB received)...`,
                    percent
                  }
                : null
            );
          },
          onStatusChange: (status) => {
            setZipProgress((prev) => ({
              ...prev,
              currentStep: status
            }));
            setDownloadToast((prev) => (prev ? { ...prev, status } : null));
          }
        }
      );

      setZipProgress((prev) => ({
        ...prev,
        status: 'ready',
        percent: 100,
        current: targetSongs.length,
        currentStep:
          lang === 'km'
            ? '✓ បានទាញយកកញ្ចប់ ZIP ដោយជោគជ័យ!'
            : '✓ ZIP archive downloaded successfully!'
      }));

      recordZipDownload({
        name: playlistName,
        format,
        bitDepth,
        songs: targetSongs.map((s) => ({ id: s.id, title: s.title, artist: s.displayName || playlist.userDisplayName })),
        source: 'playlist'
      });

      setDownloadToast({
        title: `${playlistName} [${formatLabel}]`,
        format: 'ZIP',
        status:
          lang === 'km'
            ? '✓ បានទាញយកកញ្ចប់ ZIP ដោយជោគជ័យ!'
            : '✓ ZIP archive downloaded successfully!',
        percent: 100
      });
      setTimeout(() => setDownloadToast(null), 5000);
    } catch (err: any) {
      console.warn('Batch zip stream note, trying fallback:', err?.message);
      try {
        downloadBatchZipViaForm('/api/songs/batch-zip', {
          songs: targetSongs,
          format,
          bitDepth,
          name: playlistName
        });

        recordZipDownload({
          name: playlistName,
          format,
          bitDepth,
          songs: targetSongs.map((s) => ({ id: s.id, title: s.title, artist: s.displayName || playlist.userDisplayName })),
          source: 'playlist'
        });

        setZipProgress((prev) => ({
          ...prev,
          status: 'ready',
          percent: 100,
          current: targetSongs.length,
          currentStep:
            lang === 'km'
              ? '✓ បានផ្ញើសំណើទាញយកកញ្ចប់ ZIP ទៅកាន់ Browser ដោយជោគជ័យ!'
              : '✓ ZIP download dispatched to browser download manager!'
        }));
        setDownloadToast({
          title: `${playlistName} [${formatLabel}]`,
          format: 'ZIP',
          status:
            lang === 'km'
              ? '✓ បានផ្ញើសំណើទាញយកកញ្ចប់ ZIP ទៅកាន់ Browser ដោយជោគជ័យ!'
              : '✓ ZIP download dispatched to browser download manager!',
          percent: 100
        });
        setTimeout(() => setDownloadToast(null), 5000);
      } catch (fallbackErr: any) {
        setZipProgress((prev) => ({
          ...prev,
          status: 'error',
          error: err?.message || 'Failed to download ZIP archive',
          downloadUrl: `/api/songs/batch-zip?ids=${targetIds.join(',')}&format=${format}&name=${encodeURIComponent(playlistName)}`
        }));
        setDownloadToast({
          title: `${playlistName} [${formatLabel}]`,
          format: 'ZIP',
          status: err?.message || 'Failed to download ZIP archive',
          isError: true,
          directUrl: `/api/songs/batch-zip?ids=${targetIds.join(',')}&format=${format}&name=${encodeURIComponent(playlistName)}`
        });
        setTimeout(() => setDownloadToast(null), 8000);
      }
    } finally {
      setZipDownloading(null);
    }
  };

  // Asynchronous Download All / Batch ZIP Process with progress tracking
  const handleStartDownloadAll = async (
    format: AudioFormat | 'both' = allFormat,
    bitDepth: 16 | 24 = selectedBitDepth,
    targetSongIds?: string[]
  ) => {
    // If specific song IDs provided, use those; otherwise use selected or all songs in the playlist
    const targetIds =
      targetSongIds && targetSongIds.length > 0
        ? targetSongIds
        : selectedIds.length > 0
        ? selectedIds
        : playlist.songs.map((s) => s.id);

    const songsToZip = playlist.songs.filter((s) => targetIds.includes(s.id));
    if (songsToZip.length === 0) return;

    setZipDownloading(format);
    setAsyncFormat(format);
    setAsyncBitDepth(bitDepth);
    setAsyncTotalSongs(songsToZip.length);

    // Keep inline progress bar as primary view within PlaylistView; only open modal if explicitly in modal mode
    if (downloadMode === 'async') {
      setIsAsyncModalOpen(true);
    } else {
      setIsAsyncModalOpen(false);
    }

    const playlistName = playlist.name || 'Suno_Playlist';
    const formatTag = format === 'both' ? 'MP3_WAV' : format.toUpperCase();

    setZipProgress({
      isActive: true,
      jobId: '',
      status: 'queued',
      total: songsToZip.length,
      current: 0,
      currentTitle: '',
      currentStep: lang === 'km' ? 'កំពុងរៀបចំជួរទាញយក...' : 'Initializing download queue...',
      percent: 0,
      format,
      bitDepth,
      zipFilename: `${playlistName} [${formatTag}].zip`
    });

    setAsyncJob({
      id: '',
      playlistId: playlist.id,
      playlistName,
      format,
      bitDepth,
      status: 'queued',
      total: songsToZip.length,
      current: 0,
      currentTitle: '',
      currentStep: lang === 'km' ? 'កំពុងរៀបចំជួរទាញយក...' : 'Initializing download queue...',
      percent: 0,
      zipFilenameAscii: `${playlistName}_${formatTag}.zip`,
      zipFilenameUnicode: `${playlistName} [${formatTag}].zip`,
      createdAt: Date.now()
    });

    try {
      const res = await fetch('/api/playlist/download-all/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlistId: playlist.id,
          playlistName,
          songs: songsToZip.map((s) => ({
            id: s.id,
            title: s.title,
            artist: playlist.userDisplayName || playlist.userHandle || 'Suno'
          })),
          format,
          bitDepth
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.jobId) {
        throw new Error(data.error || 'Failed to start asynchronous ZIP generation');
      }

      const jobId = data.jobId;
      if (data.job) {
        setAsyncJob(data.job);
      }
      setZipProgress((prev) => ({
        ...prev,
        jobId,
        status: 'processing'
      }));

      // Start polling status
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/playlist/download-all/status/${jobId}`);
          const pollData = await pollRes.json();

          if (pollData.success && pollData.job) {
            const job = pollData.job;
            setAsyncJob(job);
            setZipProgress((prev) => ({
              ...prev,
              status: job.status,
              percent: job.percent ?? 0,
              current: job.current ?? 0,
              total: job.total ?? songsToZip.length,
              currentTitle: job.currentTitle ?? '',
              currentStep: job.currentStep ?? '',
              zipSize: job.zipSize,
              zipFilename: job.zipFilenameUnicode || prev.zipFilename,
              downloadUrl: `/api/playlist/download-all/file/${jobId}`,
              error: job.error
            }));

            if (job.status === 'ready') {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              setZipDownloading(null);

              // Trigger automatic browser download
              const downloadUrl = `/api/playlist/download-all/file/${jobId}`;
              const link = document.createElement('a');
              link.href = downloadUrl;
              link.setAttribute('download', job.zipFilenameUnicode || `${playlistName}.zip`);
              document.body.appendChild(link);
              link.click();
              setTimeout(() => {
                if (link.parentNode) link.parentNode.removeChild(link);
              }, 2000);

              recordZipDownload({
                name: playlistName,
                format: job.format || format,
                bitDepth: job.bitDepth || bitDepth,
                songs: songsToZip.map((s) => ({ id: s.id, title: s.title })),
                source: 'playlist',
                jobId,
                downloadUrl
              });

              setDownloadToast({
                title: `${playlistName} [${(job.format || format).toUpperCase()}]`,
                format: 'ZIP',
                status:
                  lang === 'km'
                    ? '✓ កញ្ចប់ ZIP រួចរាល់! ប្រសិនបើការទាញយកមិនទាន់ចាប់ផ្ដើម សូមចុចប៊ូតុងទាញយក'
                    : '✓ ZIP archive ready! If download did not auto-start, click download in the progress bar',
                percent: 100,
                directUrl: downloadUrl
              });
            } else if (job.status === 'error' || job.status === 'cancelled') {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              setZipDownloading(null);
            }
          }
        } catch (pollErr) {
          console.warn('[AsyncZip Poll Warning]:', pollErr);
        }
      }, 700);
    } catch (err: any) {
      console.error('[AsyncZip Start Error]:', err);
      setZipDownloading(null);
      setZipProgress((prev) => ({
        ...prev,
        status: 'error',
        error: err.message || 'Failed to start asynchronous process'
      }));
      setAsyncJob((prev) =>
        prev
          ? {
              ...prev,
              status: 'error',
              error: err.message || 'Failed to start asynchronous process'
            }
          : null
      );
    }
  };

  // Unified Bulk Download Trigger
  const handleBulkDownload = (
    format: AudioFormat | 'both',
    mode: 'async' | 'direct' = downloadMode,
    customSongIds?: string[]
  ) => {
    const targetIds = customSongIds || selectedIds;
    if (format === 'mp3' || format === 'wav') {
      handleSetSelectedFormat(format, targetIds);
    }
    if (mode === 'direct') {
      handleBatchZipDownload(format, selectedBitDepth, customSongIds);
    } else {
      handleStartDownloadAll(format, selectedBitDepth, customSongIds);
    }
  };

  const handleBatchDownloadFromModal = async (options: {
    songs: ProfileSongItem[];
    format: AudioFormat | 'both';
    bitDepth: 16 | 24;
    customName: string;
    mode: 'direct' | 'async';
  }) => {
    const { songs, format, bitDepth, customName, mode } = options;
    if (songs.length === 0) return;

    const songIds = songs.map((s) => s.id);
    const cleanZipName = (customName || `${playlist.name || 'Playlist'} - ${songs.length} Tracks`).replace(/\.zip$/i, '');
    const suggestedZipFilename = `${cleanZipName}.zip`;

    setBatchProgress({
      status: 'queued',
      percent: 5,
      current: 1,
      total: songs.length,
      currentTitle: songs[0]?.title || '',
      currentStep:
        lang === 'km'
          ? `កំពុងតភ្ជាប់ និងរៀបចំកញ្ចប់ ZIP (${songs.length} បទ)...`
          : `Connecting & streaming ZIP package (${songs.length} tracks)...`
    });

    setZipDownloading(format);

    if (mode === 'direct') {
      try {
        await downloadBatchZipViaStream(
          '/api/songs/batch-zip',
          {
            songs: songs.map((s) => ({
              id: s.id,
              title: s.title,
              artist: playlist.userDisplayName || playlist.userHandle || 'Suno'
            })),
            format,
            bitDepth,
            name: cleanZipName
          },
          suggestedZipFilename,
          {
            onProgress: (receivedBytes, totalBytes) => {
              const mb = (receivedBytes / (1024 * 1024)).toFixed(1);
              let percent: number | undefined;
              if (totalBytes && totalBytes > 0) {
                percent = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
              } else {
                const estimatedBytes = songs.length * (format === 'wav' ? 35 : format === 'both' ? 40 : 4.5) * 1024 * 1024;
                percent = Math.min(95, Math.max(8, Math.round((receivedBytes / estimatedBytes) * 100)));
              }
              setBatchProgress((prev) => ({
                ...prev,
                status: 'streaming',
                percent: percent || prev.percent,
                receivedMb: mb,
                currentStep:
                  lang === 'km'
                    ? `កំពុងទាញយកកញ្ចប់ ZIP (${mb} MB)...`
                    : `Streaming ZIP archive (${mb} MB received)...`
              }));
            },
            onStatusChange: (status) => {
              setBatchProgress((prev) => ({
                ...prev,
                currentStep: status
              }));
            }
          }
        );

        setBatchProgress((prev) => ({
          ...prev,
          status: 'ready',
          percent: 100,
          currentStep:
            lang === 'km'
              ? '✓ បានទាញយកកញ្ចប់ ZIP ដោយជោគជ័យ!'
              : '✓ ZIP archive downloaded successfully!'
        }));

        recordZipDownload({
          name: cleanZipName,
          format,
          bitDepth,
          songs: songs.map((s) => ({ id: s.id, title: s.title, artist: s.displayName || playlist.userDisplayName })),
          source: 'playlist'
        });

        setDownloadToast({
          title: cleanZipName,
          format: 'ZIP',
          status:
            lang === 'km'
              ? '✓ បានទាញយកកញ្ចប់ ZIP ដោយជោគជ័យ!'
              : '✓ ZIP archive downloaded successfully!',
          percent: 100
        });
        setTimeout(() => setDownloadToast(null), 5000);
      } catch (err: any) {
        console.warn('Batch direct stream note, attempting fallback:', err?.message);
        try {
          downloadBatchZipViaForm('/api/songs/batch-zip', {
            songs: songs.map((s) => ({
              id: s.id,
              title: s.title,
              artist: playlist.userDisplayName || playlist.userHandle || 'Suno'
            })),
            format,
            bitDepth,
            name: cleanZipName
          });

          recordZipDownload({
            name: cleanZipName,
            format,
            bitDepth,
            songs: songs.map((s) => ({ id: s.id, title: s.title, artist: s.displayName || playlist.userDisplayName })),
            source: 'playlist'
          });

          setBatchProgress((prev) => ({
            ...prev,
            status: 'ready',
            percent: 100,
            currentStep:
              lang === 'km'
                ? '✓ បានផ្ញើសំណើទាញយកកញ្ចប់ ZIP ទៅកាន់ Browser ដោយជោគជ័យ!'
                : '✓ ZIP download dispatched to browser!'
          }));
        } catch (fallbackErr: any) {
          setBatchProgress((prev) => ({
            ...prev,
            status: 'error',
            error: err?.message || 'Failed to download ZIP archive',
            downloadUrl: `/api/songs/batch-zip?ids=${songIds.join(',')}&format=${format}&name=${encodeURIComponent(cleanZipName)}`
          }));
        }
      } finally {
        setZipDownloading(null);
      }
    } else {
      // Async monitored mode
      try {
        const res = await fetch('/api/playlist/download-all/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playlistId: playlist.id,
            playlistName: cleanZipName,
            songs: songs.map((s) => ({
              id: s.id,
              title: s.title,
              artist: playlist.userDisplayName || playlist.userHandle || 'Suno'
            })),
            format,
            bitDepth
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success || !data.jobId) {
          throw new Error(data.error || 'Failed to start asynchronous ZIP generation');
        }

        const jobId = data.jobId;
        setBatchProgress((prev) => ({
          ...prev,
          status: 'processing',
          currentStep: lang === 'km' ? 'កំពុងដំណើរការបំលែងសម្លេង...' : 'Processing and packaging tracks...'
        }));

        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = setInterval(async () => {
          try {
            const pollRes = await fetch(`/api/playlist/download-all/status/${jobId}`);
            const pollData = await pollRes.json();

            if (pollData.success && pollData.job) {
              const job = pollData.job;
              setBatchProgress((prev) => ({
                ...prev,
                status: job.status,
                percent: job.percent ?? 0,
                current: job.current ?? 0,
                total: job.total ?? songs.length,
                currentTitle: job.currentTitle ?? '',
                currentStep: job.currentStep ?? '',
                downloadUrl: `/api/playlist/download-all/file/${jobId}`,
                error: job.error
              }));

              if (job.status === 'ready') {
                if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                setZipDownloading(null);

                const downloadUrl = `/api/playlist/download-all/file/${jobId}`;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.setAttribute('download', job.zipFilenameUnicode || `${cleanZipName}.zip`);
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                  if (link.parentNode) link.parentNode.removeChild(link);
                }, 2000);

                recordZipDownload({
                  name: cleanZipName,
                  format,
                  bitDepth,
                  songs: songs.map((s) => ({ id: s.id, title: s.title })),
                  source: 'playlist',
                  jobId,
                  downloadUrl
                });
              } else if (job.status === 'error' || job.status === 'cancelled') {
                if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                setZipDownloading(null);
              }
            }
          } catch (pollErr) {
            console.warn('[Batch Async Poll Error]:', pollErr);
          }
        }, 700);
      } catch (err: any) {
        setZipDownloading(null);
        setBatchProgress((prev) => ({
          ...prev,
          status: 'error',
          error: err.message || 'Failed to start asynchronous process'
        }));
      }
    }
  };

  // Single-click download of the FULL collection (all playlist tracks) as a ZIP archive with live progress
  const handleDownloadAllCollection = (formatOverride?: AudioFormat | 'both') => {
    const fmt = formatOverride || allFormat;
    // Always zips all tracks in the current playlist for a single-click download of the full collection
    const allSongIds = playlist.songs.map((s) => s.id);
    if (allSongIds.length === 0) return;
    if (fmt === 'mp3' || fmt === 'wav') {
      handleSetSelectedFormat(fmt, allSongIds);
    }
    // Execute async packaging engine which reports track-by-track zipping progress directly within PlaylistView
    handleStartDownloadAll(fmt, selectedBitDepth, allSongIds);
  };

  const handleCancelBatchZip = async () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (zipProgress.jobId) {
      try {
        await fetch(`/api/playlist/download-all/cancel/${zipProgress.jobId}`, { method: 'POST' });
      } catch (err) {
        console.warn('Failed to cancel job:', err);
      }
    }
    setZipProgress((prev) => ({
      ...prev,
      status: 'cancelled',
      currentStep: lang === 'km' ? 'បានបញ្ឈប់ដំណើរការបង្កើតកញ្ចប់ ZIP' : 'ZIP generation cancelled by user'
    }));
    setAsyncJob((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
    setZipDownloading(null);
  };

  const handleDismissZipProgress = () => {
    setZipProgress((prev) => ({
      ...prev,
      isActive: false
    }));
  };

  const handleCancelAsyncJob = async () => {
    await handleCancelBatchZip();
  };

  const handleCloseAsyncModal = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsAsyncModalOpen(false);
  };

  const handleRetryAsyncJob = () => {
    handleStartDownloadAll(asyncFormat, asyncBitDepth);
  };

  // Batch Sequential (1-by-1) Download
  const handleBatchSequentialDownload = async (formatOverride?: AudioFormat, bitDepth: 16 | 24 = 16) => {
    if (selectedIds.length === 0) return;
    setIsSequentialActive(true);
    batchAbortRef.current = false;

    const songsToDownload = playlist.songs.filter((s) => selectedIds.includes(s.id));
    const total = songsToDownload.length;

    for (let i = 0; i < total; i++) {
      if (batchAbortRef.current) break;
      const song = songsToDownload[i];
      const format = formatOverride || getSongChosenFormat(song.id);

      setSequentialProgress({
        current: i + 1,
        total,
        currentTitle: `${song.title} [${format.toUpperCase()}]`,
        percent: Math.round(((i + 1) / total) * 100),
        status: 'downloading'
      });

      const downloadUrl =
        format === 'wav'
          ? `/api/song/download/${song.id}?format=wav&bitDepth=${bitDepth}`
          : `/api/song/download/${song.id}?format=${format}`;

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `${song.title}.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Stagger downloads by 1.2s to prevent browser popup block
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    setSequentialProgress((prev) => (prev ? { ...prev, status: 'completed' } : null));
    setTimeout(() => {
      setIsSequentialActive(false);
      setSequentialProgress(null);
    }, 1800);
  };

  const handleSharePlaylist = async () => {
    try {
      await navigator.clipboard.writeText(playlist.sourceUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {}
  };

  return (
    <div className={`w-full max-w-5xl mx-auto space-y-6 ${currentPlayingSong ? 'pb-32 sm:pb-36' : ''}`}>
      {/* Top Bar Navigation */}
      {onBack && (
        <button
          type="button"
          id="back-from-playlist-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors text-xs font-medium cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.backToSong}</span>
        </button>
      )}

      {/* Playlist Hero Header */}
      <div className="bg-gradient-to-b from-neutral-900/90 to-neutral-900/40 border border-neutral-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 relative z-10">
          {/* Cover Art */}
          <div className="relative group w-32 h-32 sm:w-40 sm:h-40 shrink-0 rounded-2xl overflow-hidden bg-neutral-800 border border-neutral-700/60 shadow-xl">
            {playlist.imageUrl ? (
              <img
                src={playlist.imageUrl}
                alt={playlist.name}
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-800">
                <ListMusic className="w-16 h-16" />
              </div>
            )}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono font-medium text-amber-300 border border-amber-500/30">
              PLAYLIST
            </div>
          </div>

          {/* Playlist Metadata */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30 flex items-center gap-1.5">
                <ListMusic className="w-3.5 h-3.5" />
                {t.playlist}
              </span>
              {playlist.userHandle && (
                <button
                  type="button"
                  onClick={() => onSelectProfile && onSelectProfile(playlist.userHandle)}
                  className="px-2.5 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition-colors flex items-center gap-1.5 border border-neutral-700/50"
                  title="View creator profile"
                >
                  <User className="w-3 h-3 text-sky-400" />
                  <span>@{playlist.userHandle}</span>
                </button>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight break-words mb-2">
              {playlist.name || 'Suno Playlist'}
            </h2>

            {playlist.description && (
              <p className="text-neutral-400 text-xs sm:text-sm line-clamp-2 mb-3">
                {playlist.description}
              </p>
            )}

            {/* Metrics Chips */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400 mb-4">
              <div className="flex items-center gap-1.5 bg-neutral-950/60 px-3 py-1 rounded-lg border border-neutral-800">
                <Music2 className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  <strong className="text-neutral-200">{playlist.songCount}</strong> {t.totalTracks}
                </span>
              </div>

              {playlist.totalDuration && playlist.totalDuration > 0 && (
                <div className="flex items-center gap-1.5 bg-neutral-950/60 px-3 py-1 rounded-lg border border-neutral-800">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    <strong className="text-neutral-200">{formatDuration(playlist.totalDuration)}</strong> {t.totalDuration}
                  </span>
                </div>
              )}

              {playlist.userDisplayName && (
                <div className="flex items-center gap-1.5 bg-neutral-950/60 px-3 py-1 rounded-lg border border-neutral-800">
                  <span className="text-neutral-500">{t.playlistBy}:</span>
                  <span className="text-neutral-200 font-medium">{playlist.userDisplayName}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Primary 'Download All' Section with Settings Dropdown */}
              <div
                ref={exportSettingsRef}
                className="relative flex items-center gap-1.5 bg-neutral-900 border border-amber-500/40 p-1.5 rounded-2xl shadow-xl shadow-amber-500/10"
              >
                {/* 1-Click Batch Download Button */}
                <button
                  type="button"
                  id="download-all-btn"
                  onClick={() => handleDownloadAllCollection()}
                  disabled={zipDownloading !== null || playlist.songs.length === 0}
                  className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:brightness-105 active:scale-[0.98] text-neutral-950 font-extrabold text-xs sm:text-sm transition-all shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  title={
                    lang === 'km'
                      ? `ទាញយកចម្រៀងទាំងអស់ (${playlist.songs.length} បទ) ក្នុង Playlist នេះជាកញ្ចប់ ZIP ដោយចុចតែម្តង`
                      : `Zip all tracks in the current playlist for a single-click download of the full collection`
                  }
                >
                  {zipDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
                  ) : (
                    <FolderArchive className="w-4 h-4" />
                  )}
                  <span>
                    {zipDownloading
                      ? `${zipProgress.percent > 0 ? `${lang === 'km' ? 'កំពុងបង្កើត' : 'Zipping'} ${zipProgress.percent}%` : t.preparingZip}`
                      : lang === 'km'
                      ? 'ទាញយកទាំងអស់'
                      : 'Download All'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-black/20 text-neutral-950 text-[11px] font-mono font-bold">
                    {playlist.songs.length} {lang === 'km' ? 'បទ' : 'tracks'}
                  </span>
                  {/* Current Active Format Tag */}
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black uppercase ${
                      allFormat === 'wav'
                        ? 'bg-sky-400/90 text-neutral-950'
                        : allFormat === 'both'
                        ? 'bg-purple-400/90 text-neutral-950'
                        : 'bg-black/30 text-amber-950'
                    }`}
                  >
                    {allFormat === 'both' ? 'MP3+WAV' : allFormat === 'wav' ? `${selectedBitDepth}b WAV` : '320k MP3'}
                  </span>
                </button>

                {/* Settings Dropdown Trigger Button */}
                <button
                  type="button"
                  id="download-all-settings-toggle-btn"
                  onClick={() => setIsExportSettingsOpen((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    isExportSettingsOpen
                      ? 'bg-amber-500 text-neutral-950 border-amber-400 font-bold shadow-md'
                      : 'bg-neutral-950/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border-neutral-800'
                  }`}
                  title={lang === 'km' ? 'ការកំណត់ទម្រង់ & គុណភាពទាញយកទាំងអស់' : 'Batch Export Format & Quality Settings'}
                  aria-expanded={isExportSettingsOpen}
                  aria-haspopup="true"
                >
                  <Settings className={`w-3.5 h-3.5 ${isExportSettingsOpen ? 'animate-spin' : 'text-amber-400'}`} />
                  <span className="hidden sm:inline text-[11px] font-mono font-medium">
                    {lang === 'km' ? 'ការកំណត់' : 'Settings'}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isExportSettingsOpen ? 'rotate-180 text-neutral-950' : 'text-neutral-400'
                    }`}
                  />
                </button>

                {/* Settings Dropdown Popover */}
                {isExportSettingsOpen && (
                  <div
                    id="download-all-settings-dropdown"
                    className="absolute top-full left-0 mt-2 z-50 w-80 sm:w-96 bg-neutral-950/98 backdrop-blur-2xl border border-amber-500/40 rounded-2xl p-4 shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-top-2 duration-200"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <Settings className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white leading-tight">
                            {t.batchExportSettings}
                          </h4>
                          <p className="text-[11px] text-neutral-400 leading-tight">
                            {t.batchExportDesc}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsExportSettingsOpen(false)}
                        className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Options List */}
                    <div className="space-y-2">
                      {/* Option 1: High-Quality MP3 (320kbps) */}
                      <button
                        type="button"
                        id="export-format-mp3-opt"
                        onClick={() => setAllFormat('mp3')}
                        className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                          allFormat === 'mp3'
                            ? 'bg-amber-500/15 border-amber-500/80 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/50'
                            : 'bg-neutral-900/80 hover:bg-neutral-850 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 transition-colors ${
                            allFormat === 'mp3'
                              ? 'border-amber-400 bg-amber-400 text-neutral-950'
                              : 'border-neutral-600'
                          }`}
                        >
                          {allFormat === 'mp3' && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                              <Music2 className="w-3.5 h-3.5 text-amber-400" />
                              <span>{t.formatHighMp3Title}</span>
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 shrink-0">
                              ~{Math.max(1, Math.round(playlist.songs.length * 3.8))} MB
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 leading-relaxed">
                            {t.formatHighMp3Desc}
                          </p>
                        </div>
                      </button>

                      {/* Option 2: Lossless WAV (Studio Master) */}
                      <div
                        className={`p-2.5 rounded-xl border transition-all ${
                          allFormat === 'wav'
                            ? 'bg-sky-500/15 border-sky-500/80 shadow-md shadow-sky-500/10 ring-1 ring-sky-400/50'
                            : 'bg-neutral-900/80 hover:bg-neutral-850 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        <button
                          type="button"
                          id="export-format-wav-opt"
                          onClick={() => setAllFormat('wav')}
                          className="w-full text-left cursor-pointer flex items-start gap-3"
                        >
                          <div
                            className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 transition-colors ${
                              allFormat === 'wav'
                                ? 'border-sky-400 bg-sky-400 text-neutral-950'
                                : 'border-neutral-600'
                            }`}
                          >
                            {allFormat === 'wav' && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                                <FileAudio className="w-3.5 h-3.5 text-sky-400" />
                                <span>{t.formatLosslessWavTitle}</span>
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 shrink-0">
                                ~{Math.max(1, Math.round(playlist.songs.length * (selectedBitDepth === 24 ? 64 : 42)))} MB
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-400 leading-relaxed">
                              {t.formatLosslessWavDesc}
                            </p>
                          </div>
                        </button>

                        {/* WAV Bit-Depth Sub-Selector */}
                        <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px]">
                          <span className="text-neutral-400 font-medium">
                            {lang === 'km' ? 'កម្រិតប៊ីត (Bit Depth):' : 'Bit Depth:'}
                          </span>
                          <div className="flex items-center gap-1 p-0.5 bg-neutral-950 rounded-lg border border-neutral-800">
                            <button
                              type="button"
                              id="export-bitdepth-16-btn"
                              onClick={() => setSelectedBitDepth(16)}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                                selectedBitDepth === 16
                                  ? 'bg-sky-500 text-neutral-950'
                                  : 'text-neutral-400 hover:text-white'
                              }`}
                            >
                              16-bit Lossless
                            </button>
                            <button
                              type="button"
                              id="export-bitdepth-24-btn"
                              onClick={() => setSelectedBitDepth(24)}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                                selectedBitDepth === 24
                                  ? 'bg-sky-500 text-neutral-950'
                                  : 'text-neutral-400 hover:text-white'
                              }`}
                            >
                              24-bit Studio
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Option 3: Both Formats (MP3 + WAV) */}
                      <button
                        type="button"
                        id="export-format-both-opt"
                        onClick={() => setAllFormat('both')}
                        className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                          allFormat === 'both'
                            ? 'bg-purple-500/15 border-purple-500/80 shadow-md shadow-purple-500/10 ring-1 ring-purple-400/50'
                            : 'bg-neutral-900/80 hover:bg-neutral-850 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 transition-colors ${
                            allFormat === 'both'
                              ? 'border-purple-400 bg-purple-400 text-neutral-950'
                              : 'border-neutral-600'
                          }`}
                        >
                          {allFormat === 'both' && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                              <FolderArchive className="w-3.5 h-3.5 text-purple-400" />
                              <span>{t.formatBothTitle}</span>
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 shrink-0">
                              ~{Math.max(1, Math.round(playlist.songs.length * (3.8 + (selectedBitDepth === 24 ? 64 : 42))))} MB
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 leading-relaxed">
                            {t.formatBothDesc}
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* Quick Start Action inside Dropdown */}
                    <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-neutral-400">
                        {t.estimatedZipSize}:{' '}
                        <strong className="text-amber-400">
                          ~
                          {allFormat === 'both'
                            ? Math.max(1, Math.round(playlist.songs.length * (3.8 + (selectedBitDepth === 24 ? 64 : 42))))
                            : allFormat === 'wav'
                            ? Math.max(1, Math.round(playlist.songs.length * (selectedBitDepth === 24 ? 64 : 42)))
                            : Math.max(1, Math.round(playlist.songs.length * 3.8))}{' '}
                          MB
                        </strong>
                      </span>

                      <button
                        type="button"
                        id="dropdown-start-download-btn"
                        onClick={() => {
                          setIsExportSettingsOpen(false);
                          handleDownloadAllCollection();
                        }}
                        disabled={zipDownloading !== null || playlist.songs.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'km' ? 'ទាញយកឥឡូវនេះ' : 'Download Now'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Shuffle Play Primary Button */}
              <button
                type="button"
                id="shuffle-play-hero-btn"
                onClick={handleShufflePlay}
                disabled={playlist.songs.length === 0}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all shadow-md cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isShuffleActive && isPlaying
                    ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300 text-neutral-950 shadow-amber-500/25 ring-2 ring-amber-300'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-100 hover:text-amber-300 border border-neutral-700/80 shadow-black/20'
                }`}
                title={
                  lang === 'km'
                    ? 'ច្របល់លំដាប់បទចៃដន្យ និងចាប់ផ្តើមចាក់ស្តាប់ជាបន្តបន្ទាប់ដោយស្វ័យប្រវត្តិ'
                    : 'Randomize playlist order and trigger automatic sequential playback'
                }
              >
                <Shuffle className={`w-4 h-4 ${isShuffleActive && isPlaying ? 'animate-pulse text-neutral-950' : 'text-amber-400'}`} />
                <span>
                  {isShuffleActive && isPlaying
                    ? (lang === 'km' ? 'កំពុងចាក់ចៃដន្យ...' : 'Shuffling...')
                    : (lang === 'km' ? 'ចាក់ចៃដន្យ (Shuffle Play)' : 'Shuffle Play')}
                </span>
                {isShuffleActive && (
                  <span className="px-1.5 py-0.2 rounded bg-black/20 text-neutral-950 text-[10px] font-mono font-bold">
                    ON
                  </span>
                )}
              </button>

              <button
                type="button"
                id="share-playlist-btn"
                onClick={handleSharePlaylist}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors border border-neutral-700 cursor-pointer"
              >
                {copiedShare ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied Link!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Share Playlist</span>
                  </>
                )}
              </button>

              <a
                href={playlist.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 text-xs font-medium transition-colors border border-neutral-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open on Suno</span>
              </a>
            </div>
          </div>
        </div>

        {/* Master Bulk Download Panel */}
        <div className="mt-6 pt-6 border-t border-neutral-800/80 space-y-4">
          {(() => {
            const isSubsetSelected = selectedIds.length > 0 && selectedIds.length < playlist.songs.length;
            const targetSongsCount = selectedIds.length > 0 ? selectedIds.length : playlist.songs.length;
            const estMp3Size = Math.max(1, Math.round(targetSongsCount * 3.8));
            const estWavSize = Math.max(1, Math.round(targetSongsCount * (selectedBitDepth === 24 ? 64 : 42)));
            const estBothSize = estMp3Size + estWavSize;

            return (
              <>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                        <FolderArchive className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-bold text-neutral-100">
                        {lang === 'km'
                          ? 'ប្រព័ន្ធទាញយក Playlist ជាកញ្ចប់ ZIP (Bulk ZIP Downloader)'
                          : 'Bulk Playlist ZIP Downloader'}
                      </h3>
                      {isSubsetSelected ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                          <CheckSquare className="w-3 h-3" />
                          {lang === 'km'
                            ? `ជ្រើស ${selectedIds.length}/${playlist.songCount} បទ`
                            : `Selected ${selectedIds.length}/${playlist.songCount} tracks`}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-semibold">
                          {lang === 'km'
                            ? `Playlist ទាំងមូល (${playlist.songCount} បទ)`
                            : `All ${playlist.songCount} tracks`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      {isSubsetSelected
                        ? lang === 'km'
                          ? `ទាញយក ${selectedIds.length} បទដែលបានជ្រើសរើស (ក្នុងចំណោម ${playlist.songCount} បទ) ក្នុងកញ្ចប់ ZIP តែមួយ ដោយរក្សាទុកឈ្មោះដើមជាភាសាខ្មែរ និង Metadata ពេញលេញ`
                          : `Download ${selectedIds.length} selected tracks (out of ${playlist.songCount}) as a single compressed ZIP archive with preserved Unicode titles and complete ID3 tags`
                        : lang === 'km'
                        ? `ទាញយកចម្រៀងទាំងអស់ (${playlist.songCount} បទ) ក្នុងកញ្ចប់ ZIP តែមួយ ដោយរក្សាទុកចំណងជើងដើម និង Metadata ពេញលេញ`
                        : `Download all ${playlist.songCount} tracks in this playlist as a single compressed ZIP archive with preserved Unicode titles and ID3 metadata`}
                    </p>
                  </div>

                  {/* Mode & Quality Switchers */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Download Mode Toggle */}
                    <div className="flex items-center p-1 rounded-xl bg-neutral-950/80 border border-neutral-800">
                      <button
                        type="button"
                        id="mode-direct-btn"
                        onClick={() => setDownloadMode('direct')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          downloadMode === 'direct'
                            ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                        title="Direct fast stream straight into browser download manager without popup modal"
                      >
                        <Download className="w-3 h-3" />
                        <span>{lang === 'km' ? 'បិទ Modal (ទាញយកផ្ទាល់)' : 'Direct (No Modal)'}</span>
                      </button>
                      <button
                        type="button"
                        id="mode-async-btn"
                        onClick={() => setDownloadMode('async')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          downloadMode === 'async'
                            ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                        title="Shows live progress modal tracking decryption and track conversion"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{lang === 'km' ? 'បើកផ្ទាំងតាមដាន (Modal)' : 'Progress Modal'}</span>
                      </button>
                    </div>

                    {/* WAV Bit-depth Selector */}
                    <div className="flex items-center p-1 rounded-xl bg-neutral-950/80 border border-neutral-800">
                      <button
                        type="button"
                        id="bitdepth-16-btn"
                        onClick={() => setSelectedBitDepth(16)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
                          selectedBitDepth === 16
                            ? 'bg-sky-500 text-neutral-950 font-bold'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                        title="16-bit 44.1kHz Universal Lossless PCM"
                      >
                        16-bit
                      </button>
                      <button
                        type="button"
                        id="bitdepth-24-btn"
                        onClick={() => setSelectedBitDepth(24)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
                          selectedBitDepth === 24
                            ? 'bg-sky-500 text-neutral-950 font-bold'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                        title="24-bit 48kHz Studio Master PCM"
                      >
                        24-bit
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Selection Shortcuts Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 px-3 rounded-xl bg-neutral-950/70 border border-neutral-800/80 text-xs">
                  <div className="flex items-center gap-1.5 text-neutral-400 text-[11px]">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>{lang === 'km' ? 'ជ្រើសរើសបទសម្រាប់ ZIP:' : 'Target tracks for ZIP:'}</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      id="quick-select-all-btn"
                      onClick={() => setSelectedIds(playlist.songs.map((s) => s.id))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                        selectedIds.length === playlist.songs.length
                          ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40'
                          : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                      }`}
                    >
                      {lang === 'km' ? `ជ្រើសទាំងអស់ (${playlist.songCount})` : `Select All (${playlist.songCount})`}
                    </button>

                    <button
                      type="button"
                      id="quick-select-top5-btn"
                      onClick={() => setSelectedIds(playlist.songs.slice(0, 5).map((s) => s.id))}
                      className="px-2.5 py-1 rounded-lg text-[11px] bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-colors cursor-pointer"
                    >
                      {lang === 'km' ? '5 បទដំបូង' : 'Top 5'}
                    </button>

                    <button
                      type="button"
                      id="quick-select-top10-btn"
                      onClick={() => setSelectedIds(playlist.songs.slice(0, 10).map((s) => s.id))}
                      className="px-2.5 py-1 rounded-lg text-[11px] bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-colors cursor-pointer"
                    >
                      {lang === 'km' ? '10 បទដំបូង' : 'Top 10'}
                    </button>

                    {selectedIds.length > 0 && (
                      <button
                        type="button"
                        id="quick-deselect-all-btn"
                        onClick={() => setSelectedIds([])}
                        className="px-2.5 py-1 rounded-lg text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                      >
                        {lang === 'km' ? 'ដោះការជ្រើសរើស' : 'Clear Selection'}
                      </button>
                    )}
                  </div>
                </div>

                {/* 3 Bulk Action Download Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. Both MP3 + WAV ZIP */}
                  <button
                    type="button"
                    id="download-playlist-both-zip-btn"
                    onClick={() => handleBulkDownload('both', downloadMode, isSubsetSelected ? selectedIds : undefined)}
                    disabled={zipDownloading !== null}
                    className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-sky-500/10 to-transparent border border-amber-500/40 hover:border-amber-400 text-left transition-all hover:scale-[1.01] shadow-lg shadow-amber-500/5 cursor-pointer disabled:opacity-50 group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-xl bg-gradient-to-r from-amber-500 to-sky-400 text-neutral-950">
                        {zipDownloading === 'both' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FolderArchive className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono text-amber-300/90 font-medium px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                          {targetSongsCount} {lang === 'km' ? 'បទ' : 'tracks'}
                        </span>
                        <span className="text-[10px] font-mono text-sky-300/90 font-medium px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                          ~{estBothSize} MB
                        </span>
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-neutral-100 group-hover:text-amber-300 transition-colors">
                      {isSubsetSelected
                        ? lang === 'km'
                          ? `ទាញយក ${targetSongsCount} បទ (MP3 + WAV)`
                          : `Download ${targetSongsCount} Tracks (Both ZIP)`
                        : t.downloadAllBoth}
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-2">
                      {lang === 'km'
                        ? 'កញ្ចប់រួម MP3 320k + WAV Lossless ក្នុង ZIP តែមួយ'
                        : 'Complete pack with 320kbps MP3 & Lossless WAV in one ZIP'}
                    </p>
                  </button>

                  {/* 2. MP3 ZIP (320kbps) */}
                  <button
                    type="button"
                    id="download-playlist-mp3-zip-btn"
                    onClick={() => handleBulkDownload('mp3', downloadMode, isSubsetSelected ? selectedIds : undefined)}
                    disabled={zipDownloading !== null}
                    className="p-3.5 rounded-2xl bg-neutral-900/90 hover:bg-neutral-850 border border-amber-500/30 hover:border-amber-400 text-left transition-all hover:scale-[1.01] shadow-lg shadow-amber-500/5 cursor-pointer disabled:opacity-50 group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-xl bg-amber-500 text-neutral-950">
                        {zipDownloading === 'mp3' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FolderArchive className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono text-amber-300/90 font-medium px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                          {targetSongsCount} {lang === 'km' ? 'បទ' : 'tracks'}
                        </span>
                        <span className="text-[10px] font-mono text-amber-400 font-medium px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                          ~{estMp3Size} MB
                        </span>
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-neutral-100 group-hover:text-amber-300 transition-colors">
                      {isSubsetSelected
                        ? lang === 'km'
                          ? `ទាញយក ${targetSongsCount} បទ (MP3 ZIP)`
                          : `Download ${targetSongsCount} Tracks (MP3 ZIP)`
                        : t.downloadAllMp3}
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-2">
                      {lang === 'km'
                        ? 'គុណភាពខ្ពស់ 320kbps MP3 ភ្ជាប់ ID3 tags និងរូបក្របទ្វេ'
                        : 'Highest 320kbps CBR MP3 with full ID3 tags and album cover'}
                    </p>
                  </button>

                  {/* 3. Lossless WAV ZIP */}
                  <button
                    type="button"
                    id="download-playlist-wav-zip-btn"
                    onClick={() => handleBulkDownload('wav', downloadMode, isSubsetSelected ? selectedIds : undefined)}
                    disabled={zipDownloading !== null}
                    className="p-3.5 rounded-2xl bg-neutral-900/90 hover:bg-neutral-850 border border-sky-500/30 hover:border-sky-400 text-left transition-all hover:scale-[1.01] shadow-lg shadow-sky-500/5 cursor-pointer disabled:opacity-50 group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/40">
                        {zipDownloading === 'wav' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileAudio className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono text-sky-300/90 font-medium px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                          {targetSongsCount} {lang === 'km' ? 'បទ' : 'tracks'}
                        </span>
                        <span className="text-[10px] font-mono text-sky-400 font-medium px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                          ~{estWavSize} MB
                        </span>
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-neutral-100 group-hover:text-sky-300 transition-colors">
                      {isSubsetSelected
                        ? lang === 'km'
                          ? `ទាញយក ${targetSongsCount} បទ (WAV ZIP)`
                          : `Download ${targetSongsCount} Tracks (WAV ZIP)`
                        : t.downloadAllWav}
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-2">
                      {lang === 'km'
                        ? `គុណភាពដើមស្ទូឌីយោ ${selectedBitDepth}-bit PCM Stereo Lossless គ្មានការបាត់បង់`
                        : `Studio master ${selectedBitDepth}-bit PCM stereo uncompressed audio`}
                    </p>
                  </button>
                </div>

                {/* Supported Models Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                    <span className="font-semibold text-neutral-200">
                      {lang === 'km' ? 'ម៉ូដែល AI ដែលគាំទ្រ:' : 'Supported AI Engines:'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ModelBadge modelName="v6-pro" size="xs" />
                    <ModelBadge modelName="v6" size="xs" />
                    <ModelBadge modelName="v3.8" size="xs" />
                    <ModelBadge modelName="v4" size="xs" />
                    <ModelBadge modelName="v3.5" size="xs" />
                  </div>
                </div>

                {/* Quality & Feature Guarantees Ribbon */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-neutral-400">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-neutral-950/40 border border-neutral-800/60">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{lang === 'km' ? 'រក្សាឈ្មោះបទខ្មែរដើម' : 'Preserved Unicode Titles'}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-neutral-950/40 border border-neutral-800/60">
                    <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">{lang === 'km' ? 'ភ្ជាប់រូបក្រប & ID3 Tags' : 'Embedded ID3 & Cover Art'}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-neutral-950/40 border border-neutral-800/60">
                    <ListMusic className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="truncate">{lang === 'km' ? 'រៀបតាមលេខ 01, 02...' : 'Track Index Prefixes (01, 02...)'}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-neutral-950/40 border border-neutral-800/60">
                    <Disc3 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="truncate">{lang === 'km' ? '320k & 24-bit PCM' : '320kbps & 24-bit Studio PCM'}</span>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Download All Batch Progress Bar within PlaylistView */}
      {zipProgress.isActive && (
        <div
          id="playlist-download-all-progress-panel"
          className="bg-neutral-900/95 border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-300"
        >
          {/* Ambient Glow Accents */}
          <div className="absolute -right-16 -top-16 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-56 h-56 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header Row: Icon, Title, Status Badges, Percent & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
                {zipProgress.status === 'ready' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : zipProgress.status === 'error' ? (
                  <AlertCircle className="w-6 h-6 text-rose-400" />
                ) : zipProgress.status === 'cancelled' ? (
                  <X className="w-6 h-6 text-neutral-400" />
                ) : (
                  <Disc3 className="w-6 h-6 text-amber-400 animate-spin" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30 flex items-center gap-1">
                    <FolderArchive className="w-3 h-3" />
                    <span>{lang === 'km' ? 'ដំណើរការ ZIP Playlist' : 'Download All Batch ZIP'}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 text-[11px] font-mono border border-neutral-700/60 font-semibold">
                    {zipProgress.format === 'both' ? 'MP3 + WAV' : zipProgress.format.toUpperCase()}
                  </span>
                  {zipProgress.total > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 text-[11px] font-mono border border-neutral-700/60">
                      {zipProgress.current}/{zipProgress.total} {lang === 'km' ? 'បទ' : 'tracks'}
                    </span>
                  )}
                </div>
                <h4 className="text-sm sm:text-base font-bold text-white tracking-tight truncate mt-1">
                  {zipProgress.status === 'ready'
                    ? (lang === 'km' ? 'កញ្ចប់ ZIP រួចរាល់សម្រាប់ទាញយក!' : 'ZIP Archive Ready for Download!')
                    : zipProgress.status === 'error'
                    ? (lang === 'km' ? 'មានបញ្ហាក្នុងការបង្កើតកញ្ចប់ ZIP' : 'Error Creating ZIP Archive')
                    : zipProgress.status === 'cancelled'
                    ? (lang === 'km' ? 'បានបញ្ឈប់ការបង្កើតកញ្ចប់ ZIP' : 'ZIP Generation Cancelled')
                    : (lang === 'km' ? 'កំពុងបង្កើតកញ្ចប់ ZIP សម្រាប់ Playlist ទាំងមូល...' : 'Packaging & Zipping Full Playlist Collection...')}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
              {/* Percentage Counter */}
              <div className="text-right">
                <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight">
                  {zipProgress.percent}%
                </span>
              </div>

              {/* Action Buttons: Cancel, Open Modal, Dismiss */}
              <div className="flex items-center gap-1.5">
                {(zipProgress.status === 'processing' || zipProgress.status === 'queued' || zipProgress.status === 'streaming') ? (
                  <>
                    <button
                      type="button"
                      id="cancel-zip-progress-btn"
                      onClick={handleCancelBatchZip}
                      className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition-colors border border-neutral-700 cursor-pointer"
                    >
                      {t.cancelDownload}
                    </button>
                    <button
                      type="button"
                      id="expand-zip-modal-btn"
                      onClick={() => setIsAsyncModalOpen(true)}
                      className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                      title={lang === 'km' ? 'ពង្រីកផ្ទាំង Modal' : 'Expand to Modal View'}
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    id="close-zip-progress-btn"
                    onClick={handleDismissZipProgress}
                    className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    title="Dismiss progress"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active Track Title Display */}
          <div className="mb-2 px-3 py-2 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex items-center justify-between text-xs gap-2 relative z-10">
            <div className="flex items-center gap-2 truncate">
              <Music2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-neutral-400 shrink-0 font-medium">
                {lang === 'km' ? 'បទចម្រៀង:' : 'Current Track:'}
              </span>
              <span className="text-neutral-200 font-semibold truncate">
                {zipProgress.currentTitle || (lang === 'km' ? 'កំពុងត្រៀម...' : 'Preparing tracks...')}
              </span>
            </div>
            <span className="text-[11px] font-mono text-neutral-500 shrink-0">
              {zipProgress.current}/{zipProgress.total || playlist.songs.length}
            </span>
          </div>

          {/* Progress Bar Container */}
          <div className="space-y-2 relative z-10">
            <div className="w-full bg-neutral-950/90 rounded-full h-3 overflow-hidden p-0.5 border border-neutral-700/60 shadow-inner">
              <div
                id="playlist-zip-progress-bar-fill"
                role="progressbar"
                aria-valuenow={zipProgress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className={`h-full rounded-full transition-all duration-300 shadow-sm ${
                  zipProgress.status === 'ready'
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 shadow-emerald-500/50'
                    : zipProgress.status === 'error'
                    ? 'bg-gradient-to-r from-rose-500 to-red-600 shadow-rose-500/50'
                    : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 shadow-amber-500/50'
                }`}
                style={{ width: `${Math.max(zipProgress.percent, zipProgress.status === 'ready' ? 100 : 3)}%` }}
              />
            </div>

            {/* Step description and live stats */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-neutral-400 gap-2">
              <div className="flex items-center gap-1.5 truncate max-w-md">
                {zipProgress.status === 'ready' ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    {lang === 'km' ? 'ការវេចខ្ចប់បានបញ្ចប់! ការទាញយកបានចាប់ផ្ដើមដោយស្វ័យប្រវត្តិ' : 'Zipping complete! Download triggered automatically'}
                  </span>
                ) : zipProgress.status === 'error' ? (
                  <span className="text-rose-400">{zipProgress.error || 'Failed to complete packaging'}</span>
                ) : (
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                    <span className="truncate">{zipProgress.currentStep || 'Packaging audio tracks into ZIP archive...'}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                {zipProgress.receivedMb && (
                  <span className="text-amber-300/90">{zipProgress.receivedMb} MB</span>
                )}
                {zipProgress.zipSize && zipProgress.zipSize > 0 && (
                  <span className="text-amber-400 font-semibold">
                    {(zipProgress.zipSize / (1024 * 1024)).toFixed(1)} MB
                  </span>
                )}
                <span className="text-neutral-500 font-semibold">
                  {zipProgress.current} of {zipProgress.total || playlist.songs.length} tracks
                </span>
              </div>
            </div>
          </div>

          {/* Ready Action Ribbon with Instant Download Button */}
          {zipProgress.status === 'ready' && zipProgress.downloadUrl && (
            <div className="mt-4 pt-3.5 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3 relative z-10 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs text-neutral-300">
                <span className="text-emerald-400 font-bold">✓ {zipProgress.zipFilename || `${playlist.name}.zip`}</span>
                {zipProgress.zipSize && (
                  <span className="text-neutral-500 font-mono font-medium">
                    ({(zipProgress.zipSize / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <a
                  id="download-completed-zip-btn"
                  href={zipProgress.downloadUrl}
                  download={zipProgress.zipFilename || `${playlist.name}.zip`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.asyncZipDownloadButton}</span>
                </a>
                <button
                  type="button"
                  onClick={handleDismissZipProgress}
                  className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  {t.close}
                </button>
              </div>
            </div>
          )}

          {/* Error Retry Banner */}
          {zipProgress.status === 'error' && (
            <div className="mt-4 pt-3.5 border-t border-neutral-800 flex items-center justify-between gap-2 relative z-10 animate-in fade-in">
              <p className="text-xs text-rose-300">{zipProgress.error || 'An error occurred during zipping.'}</p>
              <button
                type="button"
                id="retry-zip-progress-btn"
                onClick={() => handleDownloadAllCollection(zipProgress.format)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{lang === 'km' ? 'ព្យាយាមម្តងទៀត' : 'Retry'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sequential Download Progress Notification Modal/Banner */}
      {isSequentialActive && sequentialProgress && (
        <div className="bg-neutral-900 border border-amber-500/40 rounded-2xl p-4 shadow-2xl relative overflow-hidden animate-in fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Disc3 className="w-4 h-4 text-amber-400 animate-spin" />
              <span className="text-xs font-semibold text-neutral-200">
                {t.batchDownloadingTitle}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                batchAbortRef.current = true;
                setIsSequentialActive(false);
              }}
              className="text-neutral-400 hover:text-neutral-200 text-xs px-2 py-0.5 rounded bg-neutral-800"
            >
              {t.cancelDownload}
            </button>
          </div>

          <div className="w-full bg-neutral-800 rounded-full h-2 mb-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${sequentialProgress.percent}%` }}
            />
          </div>

          <p className="text-[11px] text-neutral-400 truncate">
            {t.batchDownloadingStatus
              .replace('{current}', String(sequentialProgress.current))
              .replace('{total}', String(sequentialProgress.total))
              .replace('{title}', sequentialProgress.currentTitle)}
          </p>
        </div>
      )}

      {/* Dedicated Real-Time Track Search & Filter Section */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl space-y-3.5">
        {/* Row 1: Search Input Field & Real-Time Filter Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400 shrink-0 pointer-events-none" />
            <input
              id="filter-playlist-tracks-input"
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={t.searchTracksPlaceholder}
              className="w-full bg-neutral-950/90 border border-neutral-700/80 hover:border-neutral-600 focus:border-amber-500 rounded-xl sm:rounded-2xl pl-10 pr-28 py-2.5 text-xs sm:text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all shadow-inner"
            />
            {/* Trailing Controls: Match Counter & Clear Button */}
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {filterText.trim() && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {filteredSongs.length}/{displaySongs.length}
                </span>
              )}
              {filterText && (
                <button
                  type="button"
                  id="clear-playlist-filter-btn"
                  onClick={() => setFilterText('')}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  title={t.clearSearchFilter}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Popular Tag Quick Filters */}
        {playlistTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs pt-0.5">
            <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1 shrink-0">
              <Tag className="w-3 h-3 text-amber-400" />
              <span>{t.filterMatchingTag}</span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {playlistTags.map((tag) => {
                const isActive = filterText.trim().toLowerCase() === tag.toLowerCase();
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setFilterText(isActive ? '' : tag)}
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                        : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-amber-300 border border-neutral-800 hover:border-amber-500/40'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
              {filterText && (
                <button
                  type="button"
                  onClick={() => setFilterText('')}
                  className="text-[11px] text-neutral-500 hover:text-rose-400 underline ml-1 cursor-pointer"
                >
                  {t.clearSearchFilter}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Row 3: Checkboxes & Quick Selection Helpers */}
        <div className="pt-2 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              id="toggle-select-all-tracks-btn"
              onClick={handleToggleSelectAll}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border cursor-pointer ${
                allFilteredSelected
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : someFilteredSelected
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                  allFilteredSelected
                    ? 'bg-amber-500 border-amber-500 text-neutral-950'
                    : someFilteredSelected
                    ? 'bg-amber-500/50 border-amber-400 text-white'
                    : 'border-neutral-500'
                }`}
              >
                {allFilteredSelected && <Check className="w-3 h-3 stroke-[3]" />}
                {someFilteredSelected && <div className="w-2 h-0.5 bg-neutral-950 rounded" />}
              </div>
              <span>
                {allFilteredSelected ? t.deselectAll : t.selectAll} ({filteredSongIds.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTopN(5)}
              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-medium transition-colors border border-neutral-700/60 cursor-pointer"
            >
              {t.selectTop5}
            </button>
            <button
              type="button"
              onClick={() => handleSelectTopN(10)}
              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-medium transition-colors border border-neutral-700/60 cursor-pointer"
            >
              {t.selectTop10}
            </button>
            <button
              type="button"
              id="invert-selection-btn"
              onClick={handleInvertSelection}
              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-medium transition-colors border border-neutral-700/60 cursor-pointer"
              title={t.invertSelection}
            >
              {t.invertSelection}
            </button>
            <button
              type="button"
              id="toggle-selection-mode-btn"
              onClick={() => setIsSelectionMode((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
                isSelectionMode
                  ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-sm'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700/60'
              }`}
              title={isSelectionMode ? t.selectionModeOn : t.selectionModeOff}
            >
              <CheckSquare className="w-3 h-3" />
              <span>{t.selectionMode}</span>
              {isSelectionMode && (
                <span className="px-1 py-0.2 rounded bg-black/25 text-neutral-950 text-[9px] font-mono font-black">
                  ON
                </span>
              )}
            </button>
            {selectedIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2 py-1 rounded-lg text-neutral-400 hover:text-rose-400 text-[11px] transition-colors cursor-pointer"
                >
                  {t.deselectAll}
                </button>
                <button
                  type="button"
                  id="open-batch-modal-from-toolbar-btn"
                  onClick={() => {
                    setBatchProgress({
                      status: 'idle',
                      percent: 0,
                      currentStep: ''
                    });
                    setIsBatchModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-extrabold text-[11px] shadow-sm transition-all cursor-pointer"
                >
                  <FolderArchive className="w-3 h-3" />
                  <span>
                    {lang === 'km'
                      ? `ទាញយកបទដែលបានជ្រើស (${selectedIds.length})`
                      : `Download Selected (${selectedIds.length})`}
                  </span>
                </button>
              </>
            )}
          </div>

          <div className="text-[11px] text-neutral-500">
            {filterText.trim() ? (
              <span className="text-amber-400/90 font-medium">
                {t.filterCountLabel
                  .replace('{filtered}', String(filteredSongs.length))
                  .replace('{total}', String(playlist.songCount))}
              </span>
            ) : (
              <span>{playlist.songCount} {lang === 'km' ? 'បទសរុប' : 'total tracks'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Selection Action Bar (Sticky or Active when selected) */}
      {selectedIds.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-300 font-medium flex-wrap">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-amber-400" />
              <span>
                {lang === 'km'
                  ? `បានជ្រើសរើស ${selectedIds.length} ក្នុងចំណោម ${playlist.songCount} បទ`
                  : `Selected ${selectedIds.length} of ${playlist.songCount} tracks`}
              </span>
            </div>

            {/* Quick Format Chooser for Bulk Downloads */}
            <div className="flex items-center gap-1.5 pl-2 sm:border-l sm:border-amber-500/30">
              <span className="text-[11px] text-neutral-400 hidden sm:inline">
                {t.setFormatForSelected}
              </span>
              <button
                type="button"
                id="set-selected-mp3-btn"
                onClick={() => handleSetSelectedFormat('mp3')}
                className={`px-2 py-0.5 rounded-lg border font-mono font-bold text-[10px] cursor-pointer transition-all flex items-center gap-1 ${
                  selectedFormatsSummary.wavCount === 0
                    ? 'bg-amber-500 text-neutral-950 border-amber-500 shadow-sm'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-amber-300 border-amber-500/30 hover:border-amber-400'
                }`}
                title={t.setAllToMp3}
              >
                <span>MP3</span>
                <span className="text-[9px] opacity-80">({selectedFormatsSummary.mp3Count})</span>
              </button>
              <button
                type="button"
                id="set-selected-wav-btn"
                onClick={() => handleSetSelectedFormat('wav')}
                className={`px-2 py-0.5 rounded-lg border font-mono font-bold text-[10px] cursor-pointer transition-all flex items-center gap-1 ${
                  selectedFormatsSummary.mp3Count === 0
                    ? 'bg-sky-500 text-neutral-950 border-sky-500 shadow-sm'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-sky-300 border-sky-500/30 hover:border-sky-400'
                }`}
                title={t.setAllToWav}
              >
                <span>WAV</span>
                <span className="text-[9px] opacity-80">({selectedFormatsSummary.wavCount})</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              id="batch-modal-btn"
              onClick={() => {
                setBatchProgress({
                  status: 'idle',
                  percent: 0,
                  currentStep: ''
                });
                setIsBatchModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:brightness-105 active:scale-95 text-neutral-950 font-extrabold transition-all cursor-pointer shadow-md shadow-amber-500/20"
              title="Open Batch Download Configuration Modal"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>{lang === 'km' ? `ទាញយក ZIP (${selectedIds.length} បទ)` : `Batch ZIP (${selectedIds.length})`}</span>
            </button>

            <button
              type="button"
              id="batch-both-zip-btn"
              onClick={() => handleBulkDownload('both', downloadMode, selectedIds)}
              disabled={zipDownloading !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-sky-400 hover:opacity-90 text-neutral-950 font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
              title="Download MP3 + WAV for selected songs in one ZIP"
            >
              {zipDownloading === 'both' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-950" />
              ) : (
                <FolderArchive className="w-3.5 h-3.5" />
              )}
              <span>{t.downloadBatchZipBoth}</span>
            </button>

            <button
              type="button"
              id="batch-mp3-zip-btn"
              onClick={() => handleBulkDownload('mp3', downloadMode, selectedIds)}
              disabled={zipDownloading !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              {zipDownloading === 'mp3' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-950" />
              ) : (
                <FolderArchive className="w-3.5 h-3.5" />
              )}
              <span>{t.batchDownloadMp3Zip}</span>
            </button>

            <button
              type="button"
              id="batch-wav-zip-btn"
              onClick={() => handleBulkDownload('wav', downloadMode, selectedIds)}
              disabled={zipDownloading !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sky-400 font-medium border border-sky-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {zipDownloading === 'wav' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
              ) : (
                <FileAudio className="w-3.5 h-3.5" />
              )}
              <span>{t.batchDownloadWavZip}</span>
            </button>

            <button
              type="button"
              id="batch-sequential-btn"
              onClick={() => handleBatchSequentialDownload('mp3', selectedBitDepth)}
              disabled={isSequentialActive || zipDownloading !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium border border-neutral-700 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-neutral-400" />
              <span>{t.batchDownloadSequential}</span>
            </button>

            {/* Shuffle Play Selected Tracks or Playlist */}
            <button
              type="button"
              id="selection-shuffle-play-btn"
              onClick={() => {
                if (selectedIds.length > 0) {
                  const selectedSongs = playlist.songs.filter((s) => selectedIds.includes(s.id));
                  const shuffled = shuffleArray(selectedSongs);
                  setDisplaySongs(shuffled);
                  setIsShuffleActive(true);
                  playTrackAtIndex(0, shuffled);
                } else {
                  handleShufflePlay();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40 transition-all cursor-pointer active:scale-95"
              title={lang === 'km' ? 'ចាក់បទដែលបានជ្រើសរើសដោយចៃដន្យ' : 'Shuffle play selected tracks'}
            >
              <Shuffle className="w-3.5 h-3.5 text-amber-400" />
              <span>{lang === 'km' ? 'ចាក់ចៃដន្យ' : 'Shuffle Play'} ({selectedIds.length})</span>
            </button>

            <div className="h-4 w-px bg-neutral-700/60 hidden sm:block mx-0.5" />

            {/* Quick full collection download option */}
            <button
              type="button"
              id="selection-download-all-full-btn"
              onClick={() => handleDownloadAllCollection()}
              disabled={zipDownloading !== null || playlist.songs.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold border border-amber-500/30 transition-all cursor-pointer disabled:opacity-50"
              title="Download all tracks in the playlist as a single ZIP"
            >
              {zipDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : (
                <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{t.downloadAll} ({playlist.songs.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Playlist Songs List */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="px-4 sm:px-6 py-4 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-neutral-200">
                {t.playlistTracks} ({filteredSongs.length})
              </h3>
            </div>

            {/* Select All Checkbox Button in Header */}
            <button
              type="button"
              id="select-all-header-checkbox-btn"
              onClick={handleToggleSelectAll}
              disabled={filteredSongs.length === 0}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group/select-all select-none shadow-sm"
              title={
                allFilteredSelected
                  ? (lang === 'km' ? 'ដោះការជ្រើសរើសទាំងអស់' : 'Deselect all visible tracks')
                  : (lang === 'km' ? `ជ្រើសរើសទាំងអស់ (${filteredSongs.length} បទ)` : `Select all visible tracks (${filteredSongs.length})`)
              }
              role="checkbox"
              aria-checked={allFilteredSelected ? 'true' : someFilteredSelected ? 'mixed' : 'false'}
            >
              <div
                className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                  allFilteredSelected
                    ? 'bg-amber-500 border-amber-400 text-neutral-950 shadow-sm shadow-amber-500/40 ring-1 ring-amber-400/60'
                    : someFilteredSelected
                    ? 'bg-amber-500/40 border-amber-500 text-amber-200'
                    : 'border-neutral-600 bg-neutral-950 group-hover/select-all:border-neutral-400'
                }`}
              >
                {allFilteredSelected && <Check className="w-3 h-3 stroke-[3]" />}
                {someFilteredSelected && <Minus className="w-3 h-3 stroke-[3]" />}
              </div>
              <span>{allFilteredSelected ? t.deselectAll : t.selectAll}</span>
              {filteredSongs.length > 0 && (
                <span className="text-[11px] text-neutral-400 font-mono">
                  {selectedIds.length > 0 ? `(${selectedIds.length}/${filteredSongs.length})` : `(${filteredSongs.length})`}
                </span>
              )}
            </button>

            {/* Download Selected Action Button at the Top of Playlist List */}
            {selectedIds.length > 0 ? (
              <button
                type="button"
                id="download-selected-tracks-header-btn"
                onClick={() => {
                  setBatchProgress({
                    status: 'idle',
                    percent: 0,
                    currentStep: ''
                  });
                  setIsBatchModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:brightness-105 active:scale-95 text-neutral-950 font-extrabold text-xs shadow-md shadow-amber-500/25 transition-all cursor-pointer ring-1 ring-amber-400/50"
                title={lang === 'km' ? `ទាញយកបទដែលបានជ្រើស (${selectedIds.length})` : `Download Selected (${selectedIds.length} tracks)`}
              >
                <FolderArchive className="w-3.5 h-3.5" />
                <span>
                  {lang === 'km'
                    ? `ទាញយកបទដែលបានជ្រើស (${selectedIds.length})`
                    : `Download Selected (${selectedIds.length})`}
                </span>
              </button>
            ) : (
              <button
                type="button"
                id="select-all-and-download-header-btn"
                onClick={() => {
                  handleSelectAll();
                  setBatchProgress({
                    status: 'idle',
                    percent: 0,
                    currentStep: ''
                  });
                  setIsBatchModalOpen(true);
                }}
                disabled={playlist.songs.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/80 font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={lang === 'km' ? 'ជ្រើសរើសទាំងអស់ និងទាញយក' : 'Select all tracks to download'}
              >
                <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'km' ? 'ទាញយកបទដែលបានជ្រើស' : 'Download Selected'}</span>
              </button>
            )}

            {/* Sorting Dropdown in Playlist Header */}
            <div ref={sortDropdownRef} className="relative">
              <button
                type="button"
                id="playlist-sort-dropdown-btn"
                onClick={() => setIsSortDropdownOpen((prev) => !prev)}
                disabled={playlist.songs.length <= 1}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${
                  sortBy !== 'default'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm font-bold'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border-neutral-700/80'
                }`}
                aria-expanded={isSortDropdownOpen}
                aria-haspopup="true"
                title={t.sortBy}
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {sortBy === 'duration-asc'
                    ? (lang === 'km' ? 'ថិរវេលា៖ ខ្លី ➔ វែង' : 'Duration: Shortest')
                    : sortBy === 'duration-desc'
                    ? (lang === 'km' ? 'ថិរវេលា៖ វែង ➔ ខ្លី' : 'Duration: Longest')
                    : sortBy === 'title-asc'
                    ? 'A ➔ Z'
                    : sortBy === 'title-desc'
                    ? 'Z ➔ A'
                    : t.sortBy}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${isSortDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Sorting Dropdown Menu */}
              {isSortDropdownOpen && (
                <div
                  id="playlist-sort-dropdown-menu"
                  className="absolute left-0 mt-2 z-50 w-72 bg-neutral-950/98 backdrop-blur-2xl border border-neutral-700/80 rounded-2xl p-2 shadow-2xl shadow-black/90 animate-in fade-in slide-in-from-top-2 duration-150 space-y-1"
                >
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-800/80 mb-1 flex items-center justify-between">
                    <span>{t.sortBy}</span>
                    <Clock className="w-3 h-3 text-amber-400" />
                  </div>

                  {/* 1. Duration: Shortest to Longest */}
                  <button
                    type="button"
                    id="sort-duration-asc-btn"
                    onClick={() => handleSortChange('duration-asc')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                      sortBy === 'duration-asc'
                        ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                        : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{t.sortByDurationAsc}</span>
                    </div>
                    {sortBy === 'duration-asc' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>

                  {/* 2. Duration: Longest to Shortest */}
                  <button
                    type="button"
                    id="sort-duration-desc-btn"
                    onClick={() => handleSortChange('duration-desc')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                      sortBy === 'duration-desc'
                        ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                        : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{t.sortByDurationDesc}</span>
                    </div>
                    {sortBy === 'duration-desc' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>

                  <div className="h-px bg-neutral-800/80 my-1" />

                  {/* 3. Original Order */}
                  <button
                    type="button"
                    id="sort-original-btn"
                    onClick={() => handleSortChange('default')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                      sortBy === 'default' && !isShuffleActive
                        ? 'bg-neutral-800 text-amber-300 font-bold'
                        : 'text-neutral-400 hover:bg-neutral-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ListMusic className="w-3.5 h-3.5 shrink-0" />
                      <span>{t.sortByOriginal}</span>
                    </div>
                    {sortBy === 'default' && !isShuffleActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>
                </div>
              )}
            </div>

            {/* Dedicated Shuffle Button in Playlist Header */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="playlist-shuffle-btn"
                onClick={() => handleShuffleList(false)}
                disabled={playlist.songs.length <= 1}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isShuffleActive
                    ? 'bg-amber-400 text-neutral-950 shadow-amber-500/25 ring-1 ring-amber-300 font-extrabold'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-amber-300 border border-neutral-700'
                }`}
                title={t.shuffleTooltip}
              >
                <Shuffle className={`w-3.5 h-3.5 ${isShuffleActive ? 'animate-pulse text-neutral-950' : 'text-amber-400'}`} />
                <span>{t.shuffle}</span>
                {isShuffleActive && (
                  <span className="px-1.5 py-0.2 rounded bg-black/25 text-neutral-950 text-[10px] font-mono font-black">
                    ON
                  </span>
                )}
              </button>

              {/* Shuffled State Quick Controls */}
              {isShuffleActive && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    id="reshuffle-header-btn"
                    onClick={() => handleShuffleList(false)}
                    className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer border border-neutral-700"
                    title={t.reshuffle}
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                  <button
                    type="button"
                    id="restore-order-header-btn"
                    onClick={handleRestoreOriginalOrder}
                    className="px-2 py-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 text-[10px] font-mono transition-colors cursor-pointer border border-neutral-700"
                    title={t.originalOrder}
                  >
                    {t.originalOrder}
                  </button>
                </div>
              )}
            </div>

            {/* Single-Click Download All Tracks in Playlist Header with Settings Dropdown */}
            <div ref={tracksHeaderSettingsRef} className="relative flex items-center gap-1 bg-neutral-900 border border-amber-500/30 p-1 rounded-xl shadow-sm">
              <button
                type="button"
                id="download-all-tracks-header-btn"
                onClick={() => handleDownloadAllCollection()}
                disabled={zipDownloading !== null || playlist.songs.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:brightness-105 active:scale-95 text-neutral-950 font-extrabold text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-60"
                title={
                  lang === 'km'
                    ? `ទាញយកចម្រៀងទាំងអស់ (${playlist.songs.length} បទ) ជា ${allFormat === 'wav' ? `${selectedBitDepth}b WAV` : allFormat === 'both' ? 'MP3+WAV' : '320k MP3'} ដោយចុចតែម្តង`
                    : `Zip all tracks in the current playlist as ${allFormat === 'wav' ? `${selectedBitDepth}b WAV` : allFormat === 'both' ? 'MP3+WAV' : '320k MP3'} for a single-click download`
                }
              >
                {zipDownloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-950" />
                ) : (
                  <FolderArchive className="w-3.5 h-3.5" />
                )}
                <span>
                  {zipDownloading
                    ? `${lang === 'km' ? 'កំពុងបង្កើត' : 'Zipping'} ${zipProgress.percent}%`
                    : `${lang === 'km' ? 'ទាញយកទាំងអស់' : 'Download All'} (${playlist.songs.length})`}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-black/30 text-amber-950 text-[10px] font-mono font-black uppercase">
                  {allFormat === 'both' ? 'MP3+WAV' : allFormat === 'wav' ? `${selectedBitDepth}b WAV` : '320k MP3'}
                </span>
              </button>

              <button
                type="button"
                id="tracks-header-settings-toggle-btn"
                onClick={() => setIsTracksHeaderSettingsOpen((prev) => !prev)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isTracksHeaderSettingsOpen
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
                title={lang === 'km' ? 'ការកំណត់ទម្រង់ទាញយក (MP3 / WAV)' : 'Batch Export Settings (MP3 / WAV)'}
                aria-expanded={isTracksHeaderSettingsOpen}
              >
                <Settings className={`w-3.5 h-3.5 ${isTracksHeaderSettingsOpen ? 'text-neutral-950 animate-spin' : 'text-amber-400'}`} />
              </button>

              {/* Tracks Header Settings Dropdown Popover */}
              {isTracksHeaderSettingsOpen && (
                <div
                  id="tracks-header-settings-dropdown"
                  className="absolute top-full right-0 sm:left-0 mt-2 z-50 w-80 sm:w-96 bg-neutral-950/98 backdrop-blur-2xl border border-amber-500/40 rounded-2xl p-4 shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        <Settings className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white leading-tight">
                          {t.batchExportSettings}
                        </h4>
                        <p className="text-[11px] text-neutral-400 leading-tight">
                          {t.batchExportDesc}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsTracksHeaderSettingsOpen(false)}
                      className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {/* Option 1: High-Quality MP3 (320kbps) */}
                    <button
                      type="button"
                      id="tracks-header-format-mp3-opt"
                      onClick={() => setAllFormat('mp3')}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                        allFormat === 'mp3'
                          ? 'bg-amber-500/15 border-amber-500/80 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/50'
                          : 'bg-neutral-900/80 hover:bg-neutral-850 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 transition-colors ${
                          allFormat === 'mp3'
                            ? 'border-amber-400 bg-amber-400 text-neutral-950'
                            : 'border-neutral-600'
                        }`}
                      >
                        {allFormat === 'mp3' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                            <Music2 className="w-3.5 h-3.5 text-amber-400" />
                            <span>{t.formatHighMp3Title}</span>
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 shrink-0">
                            ~{Math.max(1, Math.round(playlist.songs.length * 3.8))} MB
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 leading-relaxed">
                          {t.formatHighMp3Desc}
                        </p>
                      </div>
                    </button>

                    {/* Option 2: Lossless WAV (Studio Master) */}
                    <div
                      className={`p-2.5 rounded-xl border transition-all ${
                        allFormat === 'wav'
                          ? 'bg-sky-500/15 border-sky-500/80 shadow-md shadow-sky-500/10 ring-1 ring-sky-400/50'
                          : 'bg-neutral-900/80 hover:bg-neutral-850 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <button
                        type="button"
                        id="tracks-header-format-wav-opt"
                        onClick={() => setAllFormat('wav')}
                        className="w-full text-left cursor-pointer flex items-start gap-3"
                      >
                        <div
                          className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 transition-colors ${
                            allFormat === 'wav'
                              ? 'border-sky-400 bg-sky-400 text-neutral-950'
                              : 'border-neutral-600'
                          }`}
                        >
                          {allFormat === 'wav' && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                              <FileAudio className="w-3.5 h-3.5 text-sky-400" />
                              <span>{t.formatLosslessWavTitle}</span>
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 shrink-0">
                              ~{Math.max(1, Math.round(playlist.songs.length * (selectedBitDepth === 24 ? 64 : 42)))} MB
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 leading-relaxed">
                            {t.formatLosslessWavDesc}
                          </p>
                        </div>
                      </button>

                      {/* WAV Bit-Depth Sub-Selector */}
                      <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px]">
                        <span className="text-neutral-400 font-medium">
                          {lang === 'km' ? 'កម្រិតប៊ីត (Bit Depth):' : 'Bit Depth:'}
                        </span>
                        <div className="flex items-center gap-1 p-0.5 bg-neutral-950 rounded-lg border border-neutral-800">
                          <button
                            type="button"
                            id="tracks-header-bitdepth-16-btn"
                            onClick={() => setSelectedBitDepth(16)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                              selectedBitDepth === 16
                                ? 'bg-sky-500 text-neutral-950'
                                : 'text-neutral-400 hover:text-white'
                            }`}
                          >
                            16-bit Lossless
                          </button>
                          <button
                            type="button"
                            id="tracks-header-bitdepth-24-btn"
                            onClick={() => setSelectedBitDepth(24)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                              selectedBitDepth === 24
                                ? 'bg-sky-500 text-neutral-950'
                                : 'text-neutral-400 hover:text-white'
                            }`}
                          >
                            24-bit Studio
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Option 3: Both Formats (MP3 + WAV) */}
                    <button
                      type="button"
                      id="tracks-header-format-both-opt"
                      onClick={() => setAllFormat('both')}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                        allFormat === 'both'
                          ? 'bg-purple-500/15 border-purple-500/80 shadow-md shadow-purple-500/10 ring-1 ring-purple-400/50'
                          : 'bg-neutral-900/80 hover:bg-neutral-850 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 transition-colors ${
                          allFormat === 'both'
                            ? 'border-purple-400 bg-purple-400 text-neutral-950'
                            : 'border-neutral-600'
                        }`}
                      >
                        {allFormat === 'both' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                            <FolderArchive className="w-3.5 h-3.5 text-purple-400" />
                            <span>{t.formatBothTitle}</span>
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 shrink-0">
                            ~{Math.max(1, Math.round(playlist.songs.length * (3.8 + (selectedBitDepth === 24 ? 64 : 42))))} MB
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 leading-relaxed">
                          {t.formatBothDesc}
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Quick Start Action inside Dropdown */}
                  <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-neutral-400">
                      {t.estimatedZipSize}:{' '}
                      <strong className="text-amber-400">
                        ~
                        {allFormat === 'both'
                          ? Math.max(1, Math.round(playlist.songs.length * (3.8 + (selectedBitDepth === 24 ? 64 : 42))))
                          : allFormat === 'wav'
                          ? Math.max(1, Math.round(playlist.songs.length * (selectedBitDepth === 24 ? 64 : 42)))
                          : Math.max(1, Math.round(playlist.songs.length * 3.8))}{' '}
                        MB
                      </strong>
                    </span>

                    <button
                      type="button"
                      id="tracks-header-dropdown-start-btn"
                      onClick={() => {
                        setIsTracksHeaderSettingsOpen(false);
                        handleDownloadAllCollection();
                      }}
                      disabled={zipDownloading !== null || playlist.songs.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>
                        {lang === 'km' ? 'ទាញយកឥឡូវនេះ' : 'Download Now'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Companion Shuffle Play Button */}
            <button
              type="button"
              id="shuffle-play-tracks-header-btn"
              onClick={handleShufflePlay}
              disabled={playlist.songs.length === 0}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 disabled:opacity-50 ${
                isShuffleActive && isPlaying
                  ? 'bg-amber-400 text-neutral-950 shadow-amber-500/20 ring-1 ring-amber-300 font-extrabold'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-amber-300 border border-neutral-700'
              }`}
              title="Randomize track order and begin sequential playback"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${isShuffleActive && isPlaying ? 'text-neutral-950' : 'text-amber-400'}`} />
              <span>{t.shufflePlay}</span>
            </button>
          </div>

          <span className="text-xs text-neutral-500 hidden sm:inline">
            {lang === 'km' ? 'ចុចលើបទចម្រៀងដើម្បីបើកមើលពាក្យច្រៀង & រលកសម្លេង' : 'Click track to open lyrics & waveform analyzer'}
          </span>
        </div>

        {filteredSongs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3 text-amber-400">
              <Search className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-neutral-200 mb-1">
              {filterText.trim()
                ? t.noTracksMatchingQuery.replace('{query}', filterText)
                : t.noTracksFound}
            </h4>
            <p className="text-xs text-neutral-500 max-w-sm mb-4">
              {filterText.trim() ? t.tryAnotherSearch : ''}
            </p>
            {filterText.trim() && (
              <button
                type="button"
                id="empty-state-clear-filter-btn"
                onClick={() => setFilterText('')}
                className="px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t.clearSearchFilter}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/60">
            {/* Column subheader with aligned Select All Checkbox */}
            <div className="px-4 sm:px-6 py-2.5 bg-neutral-950/70 border-b border-neutral-800/80 flex items-center justify-between gap-3 text-xs text-neutral-400 select-none">
              <div className="flex items-center gap-3">
                <div
                  role="checkbox"
                  id="playlist-column-select-all-checkbox"
                  aria-checked={allFilteredSelected ? 'true' : someFilteredSelected ? 'mixed' : 'false'}
                  aria-label={allFilteredSelected ? t.deselectAll : t.selectAll}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      handleToggleSelectAll();
                    }
                  }}
                  onClick={handleToggleSelectAll}
                  className="p-1 -ml-1 text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer flex items-center gap-2.5 group/col-select-all focus:outline-none"
                  title={allFilteredSelected ? t.deselectAll : t.selectAll}
                >
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                      allFilteredSelected
                        ? 'bg-amber-500 border-amber-400 text-neutral-950 shadow-sm shadow-amber-500/40 ring-1 ring-amber-400/60'
                        : someFilteredSelected
                        ? 'bg-amber-500/40 border-amber-500 text-amber-200'
                        : 'border-neutral-600 bg-neutral-900 group-hover/col-select-all:border-neutral-400'
                    }`}
                  >
                    {allFilteredSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    {someFilteredSelected && <Minus className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-300 group-hover/col-select-all:text-white">
                    {allFilteredSelected ? t.deselectAll : t.selectAll}
                  </span>
                </div>
                {selectedIds.length > 0 && (
                  <span className="text-[11px] text-amber-400 font-medium">
                    {lang === 'km' ? `(${selectedIds.length} បានជ្រើស)` : `(${selectedIds.length} selected)`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                {/* Quick Duration Sort Toggle in Column Subheader */}
                <button
                  type="button"
                  id="col-duration-sort-btn"
                  onClick={() => {
                    if (sortBy === 'duration-asc') {
                      handleSortChange('duration-desc');
                    } else if (sortBy === 'duration-desc') {
                      handleSortChange('default');
                    } else {
                      handleSortChange('duration-asc');
                    }
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    sortBy.startsWith('duration')
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                  }`}
                  title={
                    sortBy === 'duration-asc'
                      ? t.sortByDurationDesc
                      : sortBy === 'duration-desc'
                      ? t.sortByOriginal
                      : t.sortByDurationAsc
                  }
                >
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>
                    {sortBy === 'duration-asc'
                      ? (lang === 'km' ? 'ខ្លី ➔ វែង ↑' : 'Duration ↑')
                      : sortBy === 'duration-desc'
                      ? (lang === 'km' ? 'វែង ➔ ខ្លី ↓' : 'Duration ↓')
                      : (lang === 'km' ? 'ថិរវេលា' : 'Duration')}
                  </span>
                </button>
                <span>•</span>
                <button
                  type="button"
                  id="col-shuffle-toggle-btn"
                  onClick={() => handleShuffleList(false)}
                  disabled={playlist.songs.length <= 1}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    isShuffleActive
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                  }`}
                  title={t.shuffleTooltip}
                >
                  <Shuffle className={`w-3 h-3 ${isShuffleActive ? 'animate-pulse text-amber-300' : 'text-amber-400'}`} />
                  <span>{isShuffleActive ? (lang === 'km' ? 'លំដាប់ចៃដន្យ' : 'Shuffled') : t.shuffle}</span>
                </button>
                <span>•</span>
                <span>{filteredSongs.length} {lang === 'km' ? 'បទចម្រៀង' : 'tracks'}</span>
              </div>
            </div>

            {filteredSongs.map((song, index) => {
              const isSelected = selectedIds.includes(song.id);
              const isPreviewing = previewingSongId === song.id;
              const isDownloading = downloadingSong?.id === song.id;
              const isCurrentSong = currentPlayingSong?.id === song.id;

              return (
                <div
                  key={song.id}
                  id={`playlist-track-${song.id}`}
                  onClick={(e) => {
                    if (isSelectionMode) {
                      handleToggleSelectSong(song.id, index, e);
                    } else {
                      onSelectSong(song.id);
                    }
                  }}
                  className={`px-4 sm:px-6 py-3.5 flex items-center gap-3 sm:gap-4 hover:bg-neutral-800/50 transition-all cursor-pointer group ${
                    isCurrentSong
                      ? 'bg-amber-500/10 border-l-4 border-l-amber-400 pl-3 sm:pl-5'
                      : isSelected
                      ? 'bg-amber-500/[0.08] border-l-2 border-l-amber-500/80 pl-3.5 sm:pl-5.5'
                      : ''
                  }`}
                >
                  {/* Individual Song Selection Checkbox */}
                  <div
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={`Select ${song.title}`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleToggleSelectSong(song.id, index);
                      }
                    }}
                    onClick={(e) => handleToggleSelectSong(song.id, index, e)}
                    className="p-2 -ml-2 text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer select-none focus:outline-none"
                    title={
                      isSelected
                        ? (lang === 'km' ? 'ដោះការជ្រើសរើស' : 'Deselect track')
                        : (lang === 'km' ? 'ជ្រើសរើសបទនេះ (Hold Shift សម្រាប់ជ្រើសច្រើនបទ)' : 'Select track for batch download (Hold Shift for range)')
                    }
                  >
                    <div
                      className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-amber-500 border-amber-400 text-neutral-950 shadow-sm shadow-amber-500/40 ring-1 ring-amber-400/60'
                          : 'border-neutral-600 bg-neutral-900/80 group-hover:border-neutral-400 group-hover:bg-neutral-800'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>

                  {/* Track Number Index or Playing Equalizer Animation */}
                  <div className="w-6 flex items-center justify-center text-xs font-mono text-neutral-500 shrink-0">
                    {isCurrentSong && isPlaying ? (
                      <div className="flex items-end gap-0.5 h-4 justify-center" title="Now Playing">
                        <span className="w-1 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.3s] h-3" />
                        <span className="w-1 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.15s] h-4" />
                        <span className="w-1 bg-amber-400 rounded-full animate-bounce h-2.5" />
                      </div>
                    ) : isCurrentSong ? (
                      <Disc3 className="w-4 h-4 text-amber-400 animate-spin" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>

                  {/* Thumbnail with direct Play / Pause into Sequential Queue */}
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-neutral-800 shrink-0 border border-neutral-700/50">
                    <img
                      src={song.imageUrl}
                      alt={song.title}
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                    <button
                      type="button"
                      id={`play-track-${song.id}-btn`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isCurrentSong) {
                          togglePlayback();
                        } else {
                          const targetIdx = displaySongs.findIndex((s) => s.id === song.id);
                          if (targetIdx >= 0) {
                            playTrackAtIndex(targetIdx, displaySongs);
                          }
                        }
                      }}
                      className={`absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center text-white transition-opacity cursor-pointer ${
                        isCurrentSong ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      title={isCurrentSong && isPlaying ? 'Pause' : 'Play track in sequential flow'}
                    >
                      {isCurrentSong && isPlaying ? (
                        <Pause className="w-5 h-5 text-amber-400 fill-amber-400 animate-pulse" />
                      ) : (
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      )}
                    </button>
                  </div>

                  {/* Title and Tags */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-neutral-100 truncate group-hover:text-amber-300 transition-colors">
                        {song.title}
                      </h4>

                      {/* Visible Badge Indicating Last Chosen Format (MP3 or WAV) */}
                      {(() => {
                        const chosenFmt = getSongChosenFormat(song.id);
                        const isWav = chosenFmt === 'wav';
                        return (
                          <button
                            type="button"
                            id={`track-format-badge-${song.id}`}
                            onClick={(e) => handleToggleSongFormat(song.id, e)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wide transition-all cursor-pointer shadow-xs shrink-0 select-none ${
                              isWav
                                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/40 hover:bg-sky-500/25 hover:border-sky-400'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 hover:border-amber-400'
                            }`}
                            title={t.trackFormatBadgeTooltip.replace('{format}', chosenFmt.toUpperCase())}
                          >
                            {isWav ? (
                              <FileAudio className="w-2.5 h-2.5 text-sky-400" />
                            ) : (
                              <Download className="w-2.5 h-2.5 text-amber-400" />
                            )}
                            <span>{isWav ? t.formatWavBadge : t.formatMp3Badge}</span>
                          </button>
                        );
                      })()}

                      {song.modelName && (
                        <ModelBadge modelName={song.modelName} size="xs" />
                      )}
                      {isCurrentSong && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1 shrink-0">
                          <Disc3 className={`w-2.5 h-2.5 text-amber-400 ${isPlaying ? 'animate-spin' : ''}`} />
                          <span>{isPlaying ? (lang === 'km' ? 'កំពុងចាក់' : 'PLAYING') : (lang === 'km' ? 'ផ្អាក' : 'PAUSED')}</span>
                        </span>
                      )}
                      {isPreviewing && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono shrink-0">
                          PREVIEWING
                        </span>
                      )}
                    </div>
                    {song.tags && (
                      <p className="text-xs text-neutral-500 truncate mt-0.5">
                        {song.tags}
                      </p>
                    )}
                  </div>

                  {/* Duration */}
                  <div
                    className={`hidden sm:flex items-center gap-1 text-xs font-mono shrink-0 transition-colors ${
                      sortBy.startsWith('duration')
                        ? 'text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30'
                        : 'text-neutral-400'
                    }`}
                  >
                    <Clock className={`w-3 h-3 ${sortBy.startsWith('duration') ? 'text-amber-400' : 'text-neutral-500'}`} />
                    <span>{formatDuration(song.duration)}</span>
                  </div>

                  {/* Quick Action Download Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      const chosenFmt = getSongChosenFormat(song.id);
                      return (
                        <>
                          <button
                            type="button"
                            id={`download-mp3-track-${song.id}-btn`}
                            onClick={(e) => handleDownload(song, 'mp3', e)}
                            disabled={isDownloading}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-75 ${
                              chosenFmt === 'mp3'
                                ? 'bg-neutral-800 text-amber-300 border-amber-500/40 font-semibold shadow-xs'
                                : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 border-neutral-700/60'
                            }`}
                            title="Download 320kbps MP3"
                          >
                            {isDownloading && downloadingSong?.format === 'mp3' ? (
                              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                            ) : (
                              <Download className={`w-3.5 h-3.5 ${chosenFmt === 'mp3' ? 'text-amber-400' : 'text-neutral-400'}`} />
                            )}
                            <span className="font-mono text-[11px]">
                              {isDownloading && downloadingSong?.format === 'mp3' && downloadingSong.percent
                                ? `${downloadingSong.percent}%`
                                : 'MP3'}
                            </span>
                          </button>

                          <button
                            type="button"
                            id={`download-wav-track-${song.id}-btn`}
                            onClick={(e) => handleDownload(song, 'wav', e)}
                            disabled={isDownloading}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-75 ${
                              chosenFmt === 'wav'
                                ? 'bg-sky-950/40 text-sky-300 border-sky-500/60 font-semibold shadow-xs'
                                : 'bg-neutral-800/80 hover:bg-neutral-700 text-sky-400 border-sky-500/30'
                            }`}
                            title="Download Lossless WAV"
                          >
                            {isDownloading && downloadingSong?.format === 'wav' ? (
                              <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                            ) : (
                              <FileAudio className="w-3.5 h-3.5 text-sky-400" />
                            )}
                            <span className="font-mono text-[11px]">
                              {isDownloading && downloadingSong?.format === 'wav' && downloadingSong.percent
                                ? `${downloadingSong.percent}%`
                                : 'WAV'}
                            </span>
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Single Song Download Toast */}
      {downloadToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {downloadToast.isError ? (
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              ) : downloadToast.percent === 100 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <Loader2 className="w-5 h-5 text-sky-400 animate-spin shrink-0" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate max-w-[180px]">
                    {downloadToast.title}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-bold">
                    {downloadToast.format}
                  </span>
                </div>
                <p className="text-xs text-neutral-300 mt-0.5">{downloadToast.status}</p>
                {downloadToast.directUrl && (
                  <a
                    href={downloadToast.directUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="text-[11px] text-sky-400 hover:underline font-semibold flex items-center gap-1 mt-1.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>ចុចទីនេះដើម្បីទាញយកផ្ទាល់ (Direct Link)</span>
                  </a>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDownloadToast(null)}
              className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {typeof downloadToast.percent === 'number' && !downloadToast.isError && (
            <div className="w-full bg-neutral-800 rounded-full h-1.5 mt-2.5 overflow-hidden">
              <div
                className="bg-sky-400 h-full rounded-full transition-all duration-200"
                style={{ width: `${downloadToast.percent}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Audio Element for Sequential & Shuffle Playback Flow (Mounted only when active track is selected) */}
      {currentPlayingSong && (
        <audio
          ref={sequentialAudioRef}
          key={currentPlayingSong.id}
          src={`/api/song/stream/${currentPlayingSong.id}?format=m4a`}
          preload="auto"
          crossOrigin="anonymous"
          onTimeUpdate={() => {
            if (sequentialAudioRef.current) {
              setPlaybackTime(sequentialAudioRef.current.currentTime);
              const dur = sequentialAudioRef.current.duration || currentPlayingSong.duration || 0;
              if (dur && dur !== playbackDuration) {
                setPlaybackDuration(dur);
              }
            }
          }}
          onLoadedMetadata={() => {
            if (sequentialAudioRef.current) {
              const dur = sequentialAudioRef.current.duration || currentPlayingSong.duration || 0;
              setPlaybackDuration(dur);
              sequentialAudioRef.current.volume = isPlaybackMuted ? 0 : playbackVolume;
            }
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
          }}
          onPause={() => {
            setIsPlaying(false);
          }}
          onEnded={() => {
            // Automatic sequential playback flow!
            handlePlayNext();
          }}
          onError={() => {
            console.warn('Sequential playback stream note: failed to stream track');
            setIsBuffering(false);
            setIsPlaying(false);
          }}
        />
      )}

      {/* Persistent Sticky / Floating Sequential & Shuffle Player Bar */}
      {currentPlayingSong && (
        <div
          id="playlist-sequential-player-bar"
          className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-xl border-t border-amber-500/30 p-3 sm:p-4 shadow-2xl transition-all animate-in slide-in-from-bottom duration-300"
        >
          {/* Ambient Glow Gradient */}
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent pointer-events-none" />

          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
            {/* Track Info (Left) */}
            <div className="flex items-center gap-3 w-full md:w-auto min-w-0">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-neutral-800 shrink-0 border border-amber-500/30 shadow-md">
                <img
                  src={currentPlayingSong.imageUrl}
                  alt={currentPlayingSong.title}
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <Disc3 className={`w-6 h-6 text-amber-400 ${isPlaying ? 'animate-spin' : ''}`} />
                </div>
              </div>

              <div className="min-w-0 flex-1 md:max-w-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                      isShuffleActive
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                    }`}
                  >
                    <Shuffle className="w-2.5 h-2.5" />
                    <span>{isShuffleActive ? (lang === 'km' ? 'ចៃដន្យ (SHUFFLE)' : 'SHUFFLE') : (lang === 'km' ? 'លំដាប់' : 'SEQUENTIAL')}</span>
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400">
                    {currentTrackIndex + 1}/{displaySongs.length}
                  </span>
                </div>
                <h4
                  onClick={() => onSelectSong(currentPlayingSong.id)}
                  className="text-sm font-bold text-white hover:text-amber-300 transition-colors truncate cursor-pointer mt-0.5"
                  title={lang === 'km' ? 'ចុចដើម្បីមើលទំនុកច្រៀង & រលកសម្លេង' : 'Click to view lyrics & waveform analyzer'}
                >
                  {currentPlayingSong.title}
                </h4>
                <p className="text-[11px] text-neutral-400 truncate">
                  {playlist.name || 'Suno Playlist'}
                </p>
              </div>
            </div>

            {/* Transport Controls & Progress Slider (Center) */}
            <div className="flex-1 w-full max-w-xl flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-3">
                {/* Shuffle Mode Toggle & Re-shuffle */}
                <button
                  type="button"
                  id="player-shuffle-toggle-btn"
                  onClick={() => {
                    if (isShuffleActive) {
                      handleReShuffle();
                    } else {
                      handleShufflePlay();
                    }
                  }}
                  className={`p-2 rounded-xl transition-all cursor-pointer ${
                    isShuffleActive
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                  }`}
                  title={
                    isShuffleActive
                      ? (lang === 'km' ? 'ចុចដើម្បីច្របល់លំដាប់ឡើងវិញ (Re-shuffle)' : 'Click to re-shuffle playlist order')
                      : (lang === 'km' ? 'បើកការចាក់ចៃដន្យ (Enable Shuffle)' : 'Enable Shuffle Play')
                  }
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                {/* Previous Track */}
                <button
                  type="button"
                  id="player-prev-track-btn"
                  onClick={handlePlayPrev}
                  className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  title={t.prevTrack}
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                {/* Main Play / Pause Button */}
                <button
                  type="button"
                  id="player-play-pause-btn"
                  onClick={togglePlayback}
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300 hover:brightness-110 text-neutral-950 flex items-center justify-center shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-neutral-950" />
                  ) : (
                    <Play className="w-5 h-5 fill-neutral-950 ml-0.5" />
                  )}
                </button>

                {/* Next Track */}
                <button
                  type="button"
                  id="player-next-track-btn"
                  onClick={handlePlayNext}
                  className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  title={t.nextTrack}
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                {/* Restore Original Order Button if Shuffle is Active */}
                {isShuffleActive && (
                  <button
                    type="button"
                    id="player-restore-order-btn"
                    onClick={handleRestoreOriginalOrder}
                    className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 text-[10px] font-mono transition-colors cursor-pointer border border-neutral-700"
                    title={t.originalOrder}
                  >
                    {t.originalOrder}
                  </button>
                )}
              </div>

              {/* Scrubber Range Slider & Times */}
              <div className="w-full flex items-center gap-2 text-xs font-mono text-neutral-400">
                <span className="w-10 text-right shrink-0">{formatTime(playbackTime)}</span>
                <div className="relative flex-1 group">
                  <input
                    id="player-scrubber-slider"
                    type="range"
                    min={0}
                    max={playbackDuration || 100}
                    step={0.1}
                    value={playbackTime}
                    onChange={handleSeekPlayback}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400 focus:outline-none"
                  />
                </div>
                <span className="w-10 shrink-0 text-neutral-500">
                  {isBuffering ? '...' : formatTime(playbackDuration)}
                </span>
              </div>
            </div>

            {/* Volume & Close Controls (Right) */}
            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
              <div className="hidden sm:flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1">
                <button
                  type="button"
                  id="player-mute-btn"
                  onClick={togglePlaybackMute}
                  className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title="Mute/Unmute"
                >
                  {isPlaybackMuted || playbackVolume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  id="player-volume-slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={isPlaybackMuted ? 0 : playbackVolume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  title="Volume"
                />
              </div>

              <button
                type="button"
                id="player-view-song-btn"
                onClick={() => onSelectSong(currentPlayingSong.id)}
                className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors border border-neutral-700 cursor-pointer hidden sm:inline-flex items-center gap-1"
                title="Open lyrics and waveform analysis"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>{lang === 'km' ? 'ពាក្យច្រៀង' : 'Lyrics'}</span>
              </button>

              <button
                type="button"
                id="player-stop-btn"
                onClick={handleStopPlayback}
                className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title={lang === 'km' ? 'បិទកម្មវិធីចាក់' : 'Close Player'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Sticky Bottom Batch Action Bar */}
      {selectedIds.length > 0 && (
        <div
          id="floating-batch-action-bar"
          className={`fixed left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-4xl bg-neutral-950/95 backdrop-blur-xl border border-amber-500/50 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl shadow-black/90 transition-all duration-300 animate-in slide-in-from-bottom-6 ${
            currentPlayingSong ? 'bottom-28 sm:bottom-24' : 'bottom-4 sm:bottom-5'
          }`}
        >
          {/* Ambient Top Glow Line */}
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            {/* Left: Selected count & quick selection actions */}
            <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl">
                <CheckSquare className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-amber-300">
                  {lang === 'km'
                    ? `បានជ្រើស ${selectedIds.length}/${playlist.songCount} បទ`
                    : `${selectedIds.length} of ${playlist.songCount} selected`}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  id="floating-select-all-btn"
                  onClick={handleToggleSelectAll}
                  className="px-2 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] transition-colors cursor-pointer"
                >
                  {allFilteredSelected ? t.deselectAll : t.selectAll}
                </button>
                <button
                  type="button"
                  id="floating-invert-btn"
                  onClick={handleInvertSelection}
                  className="px-2 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 text-[11px] transition-colors cursor-pointer"
                  title={t.invertSelection}
                >
                  {t.invertSelection}
                </button>
                <button
                  type="button"
                  id="floating-clear-btn"
                  onClick={handleDeselectAll}
                  className="px-2 py-1 rounded-lg text-neutral-400 hover:text-rose-400 text-[11px] transition-colors cursor-pointer"
                >
                  {lang === 'km' ? 'ដោះចេញ' : 'Clear'}
                </button>
              </div>
            </div>

            {/* Right: Quick format switcher + Modal trigger + Primary Download Button */}
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
              {/* Quick Format Switch */}
              <div className="flex items-center p-0.5 rounded-xl bg-neutral-900 border border-neutral-800 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => handleSetSelectedFormat('mp3')}
                  className={`px-2 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                    selectedFormatsSummary.wavCount === 0
                      ? 'bg-amber-500 text-neutral-950 shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title={t.setAllToMp3}
                >
                  MP3
                </button>
                <button
                  type="button"
                  onClick={() => handleSetSelectedFormat('wav')}
                  className={`px-2 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                    selectedFormatsSummary.mp3Count === 0
                      ? 'bg-sky-500 text-neutral-950 shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title={t.setAllToWav}
                >
                  WAV
                </button>
              </div>

              {/* Configure / Inspect in Modal Button */}
              <button
                type="button"
                id="floating-batch-configure-btn"
                onClick={() => {
                  setBatchProgress({
                    status: 'idle',
                    percent: 0,
                    currentStep: ''
                  });
                  setIsBatchModalOpen(true);
                }}
                className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-amber-400 border border-neutral-800 transition-colors cursor-pointer"
                title={lang === 'km' ? 'កំណត់ជម្រើសកញ្ចប់ ZIP (Options)' : 'Configure ZIP settings & review tracks'}
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Primary Download ZIP Action Button */}
              <button
                type="button"
                id="floating-batch-download-zip-btn"
                onClick={() => {
                  setBatchProgress({
                    status: 'idle',
                    percent: 0,
                    currentStep: ''
                  });
                  setIsBatchModalOpen(true);
                }}
                disabled={zipDownloading !== null}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:brightness-105 active:scale-95 text-neutral-950 font-extrabold text-xs shadow-lg shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {zipDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
                ) : (
                  <FolderArchive className="w-4 h-4" />
                )}
                <span>
                  {lang === 'km'
                    ? `ទាញយក ZIP (${selectedIds.length} បទ)`
                    : `Download ZIP (${selectedIds.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Download Modal for Selected Tracks */}
      <BatchDownloadModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        playlistName={playlist.name}
        selectedSongs={selectedSongsList}
        defaultFormat={allFormat}
        defaultBitDepth={selectedBitDepth}
        onRemoveSong={handleRemoveSongFromSelection}
        onDownload={handleBatchDownloadFromModal}
        isDownloading={zipDownloading !== null}
        progress={batchProgress}
        onCancelDownload={handleCancelBatchZip}
        lang={lang}
      />

      {/* Asynchronous Download All ZIP Progress Modal */}
      <AsyncZipModal
        isOpen={isAsyncModalOpen}
        job={asyncJob}
        playlistName={playlist.name}
        totalSongs={asyncTotalSongs}
        format={asyncFormat}
        onCancel={handleCancelAsyncJob}
        onClose={handleCloseAsyncModal}
        onRetry={handleRetryAsyncJob}
        lang={lang}
      />
    </div>
  );
};

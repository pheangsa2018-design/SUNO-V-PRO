import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Music,
  ExternalLink,
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
  ListMusic,
  Lock,
  Globe,
  Link as LinkIcon,
  Clipboard,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Zap,
  Radio
} from 'lucide-react';
import type { ProfileInfo, ProfileSongItem, AudioFormat } from '../types.js';
import type { Language } from '../i18n.js';
import { translations } from '../i18n.js';
import { downloadWithSmoothStream, downloadBatchZipViaForm } from '../utils/downloadHelper.js';
import { recordZipDownload } from '../utils/zipHistoryStorage.js';
import { UnlistedCapturedModal } from './UnlistedCapturedModal.js';
import { ModelBadge } from './ModelBadge.js';
import { ProfileDataModal } from './ProfileDataModal.js';

interface ProfileViewProps {
  profile: ProfileInfo;
  onSelectSong: (songId: string) => void;
  onSelectPlaylist?: (playlistId: string) => void;
  onBack?: () => void;
  lang: Language;
  isMeProfile?: boolean;
  isCreateWorkspace?: boolean;
  onOpenMeConfig?: () => void;
}

interface SequentialProgress {
  current: number;
  total: number;
  currentTitle: string;
  percent: number;
  status: 'downloading' | 'completed';
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  onSelectSong,
  onSelectPlaylist,
  onBack,
  lang,
  isMeProfile,
  isCreateWorkspace,
  onOpenMeConfig
}) => {
  const t = translations[lang];
  const [filterText, setFilterText] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'unlisted'>('all');
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
  const [isProfileDataModalOpen, setIsProfileDataModalOpen] = useState(false);

  // Dynamic local songs list (starts with profile.songs, allows dynamically adding unlisted tracks by link)
  const [songsList, setSongsList] = useState<ProfileSongItem[]>(profile.songs);

  // Unlisted / Direct Song Search states
  const [unlistedInput, setUnlistedInput] = useState('');
  const [isSearchingUnlisted, setIsSearchingUnlisted] = useState(false);
  const [unlistedSearchError, setUnlistedSearchError] = useState<string | null>(null);
  const [unlistedSearchSuccess, setUnlistedSearchSuccess] = useState<string | null>(null);
  const [foundUnlistedSong, setFoundUnlistedSong] = useState<ProfileSongItem | null>(null);
  const [highlightedSongId, setHighlightedSongId] = useState<string | null>(null);
  const [copiedSongId, setCopiedSongId] = useState<string | null>(null);

  // Advanced Unlisted Track Auto-Capture states
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [isCapturingSongId, setIsCapturingSongId] = useState<string | null>(null);
  const [capturedModalOpen, setCapturedModalOpen] = useState(false);
  const [activeCapturedSong, setActiveCapturedSong] = useState<ProfileSongItem | null>(null);
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [batchScanNotice, setBatchScanNotice] = useState<string | null>(null);

  // Checkbox selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zipDownloading, setZipDownloading] = useState<AudioFormat | 'both' | null>(null);
  const [isSequentialActive, setIsSequentialActive] = useState(false);
  const [sequentialProgress, setSequentialProgress] = useState<SequentialProgress | null>(null);
  const batchAbortRef = useRef(false);

  // Synchronize when profile prop updates while preserving any added unlisted tracks and local storage items
  useEffect(() => {
    const storageKey = `suno_unlisted_songs_${profile.handle.toLowerCase()}`;
    let savedTracks: ProfileSongItem[] = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        savedTracks = JSON.parse(stored);
      }
    } catch {}

    setSongsList((prev) => {
      const incomingIds = new Set(profile.songs.map((s) => s.id));
      const newlyAdded = prev.filter((s) => !incomingIds.has(s.id));
      const savedToAdd = savedTracks.filter(
        (s) => !incomingIds.has(s.id) && !newlyAdded.some((na) => na.id === s.id)
      );
      return [...savedToAdd, ...newlyAdded, ...profile.songs];
    });
  }, [profile]);

  // Filter songs by search text and visibility (all, public, unlisted)
  const filteredSongs = songsList.filter((song) => {
    // Visibility filter
    if (visibilityFilter === 'public' && (song.isPublic === false || song.isUnlisted)) return false;
    if (visibilityFilter === 'unlisted' && song.isPublic !== false && !song.isUnlisted) return false;

    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return (
      song.title.toLowerCase().includes(q) ||
      (song.tags && song.tags.toLowerCase().includes(q))
    );
  });

  const unlistedSongsCount = songsList.filter((s) => s.isPublic === false || s.isUnlisted).length;
  const publicSongsCount = songsList.length - unlistedSongsCount;

  const filteredSongIds = filteredSongs.map((s) => s.id);
  const allFilteredSelected =
    filteredSongIds.length > 0 && filteredSongIds.every((id) => selectedIds.includes(id));
  const someFilteredSelected =
    filteredSongIds.some((id) => selectedIds.includes(id)) && !allFilteredSelected;

  // Search unlisted track via direct Suno URL or Song ID
  const handleSearchUnlistedSong = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = unlistedInput.trim();
    if (!query) return;

    setIsSearchingUnlisted(true);
    setUnlistedSearchError(null);
    setUnlistedSearchSuccess(null);
    setFoundUnlistedSong(null);

    try {
      const res = await fetch(
        `/api/profile/check-unlisted-song?query=${encodeURIComponent(query)}&handle=${encodeURIComponent(profile.handle)}`
      );
      const data = await res.json();

      if (!res.ok || !data.success || !data.song) {
        throw new Error(data.error || t.songNotFoundOrPrivate);
      }

      const song: ProfileSongItem = data.song;
      setFoundUnlistedSong(song);

      const alreadyExists = songsList.some((s) => s.id === song.id);

      if (alreadyExists) {
        setUnlistedSearchSuccess(t.songAlreadyInList);
      } else {
        setSongsList((prev) => [song, ...prev]);
        setUnlistedSearchSuccess(t.songAddedSuccess);
        setSelectedIds((prev) => Array.from(new Set([...prev, song.id])));

        // Persist unlisted track into creator local storage
        try {
          const storageKey = `suno_unlisted_songs_${profile.handle.toLowerCase()}`;
          const stored = localStorage.getItem(storageKey);
          const currentSaved: ProfileSongItem[] = stored ? JSON.parse(stored) : [];
          if (!currentSaved.some((s) => s.id === song.id)) {
            localStorage.setItem(storageKey, JSON.stringify([song, ...currentSaved]));
          }
        } catch {}
      }

      setHighlightedSongId(song.id);
      setUnlistedInput('');

      // Auto scroll to song card
      setTimeout(() => {
        const el = document.getElementById(`profile-song-card-${song.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);
    } catch (err: any) {
      setUnlistedSearchError(err.message || t.songNotFoundOrPrivate);
    } finally {
      setIsSearchingUnlisted(false);
    }
  };

  const handleCopySongLink = async (songId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const link = `https://suno.com/song/${songId}`;
      await navigator.clipboard.writeText(link);
      setCopiedSongId(songId);
      setTimeout(() => setCopiedSongId(null), 2000);
    } catch (err) {
      console.warn('Could not copy song link:', err);
    }
  };

  const handlePasteUnlisted = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUnlistedInput(text.trim());
      }
    } catch {
      // Ignore clipboard permission errors
    }
  };

  // Toggle individual song selection
  const handleToggleSelectSong = (songId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId]
    );
  };

  // Toggle select all filtered songs
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

  // Auto-capture single track when clicked in Profile
  const handleAutoCaptureSong = async (song: ProfileSongItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // If autoCaptureEnabled is false and called via card click (no e), directly navigate
    if (!autoCaptureEnabled && !e) {
      onSelectSong(song.id);
      return;
    }

    setIsCapturingSongId(song.id);
    setHighlightedSongId(song.id);

    try {
      const res = await fetch(
        `/api/profile/check-unlisted-song?query=${encodeURIComponent(song.id)}&handle=${encodeURIComponent(profile.handle)}`
      );
      const data = await res.json();

      let updatedSong: ProfileSongItem;
      if (res.ok && data.success && data.song) {
        updatedSong = {
          ...song,
          ...data.song,
          audioUrl: data.song.audioUrl || song.audioUrl,
          prompt: data.songInfo?.prompt || data.song.prompt || song.prompt,
          isUnlisted: data.isUnlisted ?? true,
          isPublic: data.isPublic ?? false,
          capturedAt: Date.now()
        };
      } else {
        updatedSong = {
          ...song,
          isUnlisted: true,
          isPublic: false,
          capturedAt: Date.now()
        };
      }

      // Update in songsList
      setSongsList((prev) =>
        prev.map((s) => (s.id === song.id ? updatedSong : s))
      );

      // Persist in creator unlisted storage
      try {
        const storageKey = `suno_unlisted_songs_${profile.handle.toLowerCase()}`;
        const stored = localStorage.getItem(storageKey);
        const currentSaved: ProfileSongItem[] = stored ? JSON.parse(stored) : [];
        const filtered = currentSaved.filter((s) => s.id !== song.id);
        localStorage.setItem(storageKey, JSON.stringify([updatedSong, ...filtered]));
      } catch {}

      setActiveCapturedSong(updatedSong);
      setCapturedModalOpen(true);
    } catch (err) {
      console.warn('Auto capture error:', err);
      onSelectSong(song.id);
    } finally {
      setIsCapturingSongId(null);
    }
  };

  // Batch scan & auto-capture unlisted tracks across the profile
  const handleBatchScanUnlisted = async () => {
    if (isBatchScanning || songsList.length === 0) return;
    setIsBatchScanning(true);
    setBatchScanNotice(t.scanningUnlisted);

    try {
      const songIds = songsList.map((s) => s.id);
      const res = await fetch('/api/profile/batch-scan-unlisted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songIds, handle: profile.handle })
      });
      const data = await res.json();

      if (res.ok && data.success && Array.isArray(data.unlistedSongs)) {
        const discovered: ProfileSongItem[] = data.unlistedSongs;
        if (discovered.length > 0) {
          const discMap = new Map(discovered.map((s) => [s.id, s]));
          setSongsList((prev) =>
            prev.map((s) => (discMap.has(s.id) ? { ...s, ...discMap.get(s.id)! } : s))
          );

          // Save to localStorage
          try {
            const storageKey = `suno_unlisted_songs_${profile.handle.toLowerCase()}`;
            const stored = localStorage.getItem(storageKey);
            const currentSaved: ProfileSongItem[] = stored ? JSON.parse(stored) : [];
            const newMap = new Map(currentSaved.map((s) => [s.id, s]));
            discovered.forEach((s) => newMap.set(s.id, s));
            localStorage.setItem(storageKey, JSON.stringify(Array.from(newMap.values())));
          } catch {}

          setVisibilityFilter('unlisted');
          setBatchScanNotice(t.scanCompleted.replace('{count}', String(discovered.length)));
        } else {
          setBatchScanNotice(t.noUnlistedFoundInScan);
        }
      } else {
        setBatchScanNotice(t.noUnlistedFoundInScan);
      }
    } catch (err: any) {
      setBatchScanNotice(err?.message || 'Error scanning unlisted songs');
    } finally {
      setIsBatchScanning(false);
      setTimeout(() => setBatchScanNotice(null), 5000);
    }
  };

  // Single Song Download
  const handleDownload = async (song: ProfileSongItem, format: AudioFormat, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
    const artist = (profile.displayName || profile.handle || 'Suno')
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
      console.warn('Profile download note:', err?.message);
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

  // Batch ZIP Download with Original Unicode Titles
  const handleBatchZipDownload = async (
    format: AudioFormat | 'both' = 'mp3',
    bitDepth: 16 | 24 = 16,
    customSongs?: ProfileSongItem[]
  ) => {
    const targetSongs = customSongs && customSongs.length > 0
      ? customSongs
      : songsList.filter((s) => selectedIds.includes(s.id));

    if (targetSongs.length === 0) return;
    setZipDownloading(format);

    const profileName = profile.displayName || profile.handle || 'Suno_Creator';
    const songsToPack = targetSongs.map((s) => ({
      id: s.id,
      title: s.title,
      artist: profile.displayName || profile.handle
    }));

    try {
      downloadBatchZipViaForm('/api/songs/batch-zip', {
        songs: songsToPack,
        format,
        bitDepth,
        name: profileName
      });

      recordZipDownload({
        name: `${profileName} Collection`,
        format,
        bitDepth,
        songs: songsToPack,
        source: 'profile'
      });
    } catch (err: any) {
      console.warn('Batch zip note:', err?.message);
    } finally {
      setTimeout(() => {
        setZipDownloading(null);
      }, 2500);
    }
  };

  // Batch Sequential (1-by-1) Download
  const handleBatchSequentialDownload = async (format: AudioFormat = 'mp3', bitDepth: 16 | 24 = 16) => {
    if (selectedIds.length === 0) return;
    setIsSequentialActive(true);
    batchAbortRef.current = false;

    const songsToDownload = songsList.filter((s) => selectedIds.includes(s.id));
    const total = songsToDownload.length;

    for (let i = 0; i < total; i++) {
      if (batchAbortRef.current) break;
      const song = songsToDownload[i];

      setSequentialProgress({
        current: i + 1,
        total,
        currentTitle: song.title,
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

  const handleShareProfile = async () => {
    try {
      await navigator.clipboard.writeText(`https://suno.com/@${profile.handle}`);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {}
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-24">
      {/* Top Header Card */}
      <div className="relative rounded-3xl bg-gradient-to-b from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl -z-10" />

        {/* isCreateWorkspace or isMeProfile Connected Notice Banner */}
        {(isCreateWorkspace || isMeProfile) && (
          <div className={`mb-5 p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg ${
            isCreateWorkspace
              ? 'bg-gradient-to-r from-violet-500/15 via-violet-500/10 to-purple-500/15 border-violet-500/40 shadow-violet-500/10'
              : 'bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-teal-500/15 border-emerald-500/40 shadow-emerald-500/10'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`p-2 rounded-xl border shrink-0 ${
                isCreateWorkspace
                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs sm:text-sm font-bold ${
                    isCreateWorkspace ? 'text-violet-300' : 'text-emerald-300'
                  }`}>
                    {isCreateWorkspace ? t.createLinkedBadge : t.meLinkedBadge}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                    isCreateWorkspace
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}>
                    {isCreateWorkspace ? 'https://suno.com/create?wid=default' : 'https://suno.com/me'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {isCreateWorkspace ? t.createAutoResolved : t.meAutoResolved}
                </p>
              </div>
            </div>

            {onOpenMeConfig && (
              <button
                type="button"
                id="change-me-handle-btn"
                onClick={onOpenMeConfig}
                className={`px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 hover:text-white border text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 shadow-sm ${
                  isCreateWorkspace
                    ? 'border-neutral-700 hover:border-violet-500/40'
                    : 'border-neutral-700 hover:border-emerald-500/40'
                }`}
              >
                <span>{t.meChangeButton}</span>
              </button>
            )}
          </div>
        )}

        {onBack && (
          <button
            id="back-to-song-btn"
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t.backToSong}</span>
          </button>
        )}

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with vinyl ring */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-amber-500/30 shadow-xl bg-neutral-950 relative">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-amber-400">
                  <User className="w-12 h-12" />
                </div>
              )}
            </div>
            <div className="absolute -inset-1 bg-amber-500/20 rounded-2xl blur-lg -z-10 opacity-70" />
          </div>

          {/* Profile details */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Suno Creator
              </span>
              <a
                href={`https://suno.com/@${profile.handle}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                <span>suno.com/@{profile.handle}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1">
              {profile.displayName}
            </h1>
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-3">
              <p className="text-sm font-mono text-neutral-400">
                @{profile.handle}
              </p>
              {isMeProfile && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  suno.com/me
                </span>
              )}
            </div>

            {profile.bio && (
              <p className="text-xs text-neutral-300 max-w-xl mb-4 leading-relaxed">
                {profile.bio}
              </p>
            )}

            {/* Stats row */}
            <div className="flex items-center justify-center sm:justify-start gap-4 text-xs">
              <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-1.5 flex items-center gap-2">
                <Music className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-white">{songsList.length}</span>
                <span className="text-neutral-400">{t.profileSongsFound}</span>
                {unlistedSongsCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>{unlistedSongsCount}</span>
                  </span>
                )}
              </div>

              <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-1.5 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-semibold text-white">{profile.followersCount}</span>
                <span className="text-neutral-400">{t.followers}</span>
              </div>

              <button
                type="button"
                id="open-profile-data-modal-header-btn"
                onClick={() => setIsProfileDataModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/25 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                title={t.downloadProfileData}
              >
                <FolderArchive className="w-3.5 h-3.5 text-neutral-950" />
                <span>{t.downloadProfileData}</span>
              </button>

              <button
                type="button"
                id="share-profile-btn"
                onClick={handleShareProfile}
                className="p-1.5 rounded-xl bg-neutral-950/80 border border-neutral-800 hover:border-amber-500/30 text-neutral-400 hover:text-neutral-200 transition-colors"
                title="Copy Profile Link"
              >
                {copiedShare ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Discovered Playlists Section */}
      {profile.playlists && profile.playlists.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-neutral-900/90 to-orange-500/10 border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-md mb-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <ListMusic className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>{lang === 'km' ? 'Playlists របស់ creator' : 'Creator Playlists'}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30 font-semibold">
                    {profile.playlists.length}
                  </span>
                </h3>
                <p className="text-xs text-neutral-400">
                  {lang === 'km'
                    ? 'ចុចលើ Playlist ណាមួយដើម្បីបើក និងទាញយកបទចម្រៀងទាំងអស់'
                    : 'Click any playlist to open and download all tracks'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {profile.playlists.map((pl) => (
              <div
                key={pl.id}
                id={`creator-playlist-card-${pl.id}`}
                onClick={() => onSelectPlaylist && onSelectPlaylist(pl.id)}
                className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-neutral-950/80 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 cursor-pointer transition-all duration-200 group shadow-sm hover:shadow-md"
              >
                <div className="w-14 h-14 rounded-xl bg-neutral-900 overflow-hidden shrink-0 border border-neutral-800 relative">
                  {pl.imageUrl ? (
                    <img
                      src={pl.imageUrl}
                      alt={pl.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-amber-400 bg-neutral-900">
                      <ListMusic className="w-7 h-7" />
                    </div>
                  )}
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-amber-300">
                    LIST
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                    {pl.name}
                  </h4>
                  <p className="text-xs text-neutral-400 flex items-center gap-2 mt-0.5">
                    <span>
                      <strong className="text-neutral-200">{pl.songCount}</strong> {t.totalTracks}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-[11px] text-neutral-500">@{pl.userHandle || profile.handle}</span>
                  </p>
                </div>

                <button
                  type="button"
                  id={`open-playlist-btn-${pl.id}`}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <ListMusic className="w-3.5 h-3.5" />
                  <span>{lang === 'km' ? 'បើកមើល' : 'Open'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Unlisted / Non-Public Track Auto-Capture Studio */}
      <div className="bg-gradient-to-br from-amber-500/15 via-neutral-900/95 to-orange-500/15 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-md relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4 relative z-10">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 text-amber-300 border border-amber-500/40 shadow-sm shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>{t.autoCaptureUnlistedTitle}</span>
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                </h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/40 font-bold tracking-wide">
                  AUTO-INTERCEPT
                </span>
                {unlistedSongsCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" />
                    {unlistedSongsCount} Unlisted
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-300 mt-1 leading-relaxed max-w-3xl">
                {t.autoCaptureUnlistedSubtitle}
              </p>
            </div>
          </div>

          {/* Quick Auto-Capture Mode Toggle & Batch Scan Button */}
          <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
            <button
              type="button"
              id="toggle-auto-capture-btn"
              onClick={() => setAutoCaptureEnabled((prev) => !prev)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 shadow-sm ${
                autoCaptureEnabled
                  ? 'bg-amber-500/25 hover:bg-amber-500/35 text-amber-300 border-amber-400 ring-2 ring-amber-400/40'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${autoCaptureEnabled ? 'bg-amber-400 animate-pulse' : 'bg-neutral-600'}`} />
              <Zap className="w-3.5 h-3.5" />
              <span>
                {autoCaptureEnabled ? t.autoCaptureOnClickActive : t.autoCaptureOnClickInactive}
              </span>
            </button>

            <button
              type="button"
              id="batch-scan-unlisted-btn"
              onClick={handleBatchScanUnlisted}
              disabled={isBatchScanning || songsList.length === 0}
              className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-amber-300 hover:text-amber-200 border border-amber-500/40 hover:border-amber-400 transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBatchScanning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>{t.scanningUnlisted}</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.batchScanUnlistedBtn}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Batch scan notification */}
        {batchScanNotice && (
          <div className="mb-3 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2 animate-in fade-in">
            <Radio className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
            <span className="font-semibold">{batchScanNotice}</span>
          </div>
        )}

        {/* Search / Direct paste input form */}
        <form onSubmit={handleSearchUnlistedSong} className="flex flex-col sm:flex-row gap-2.5 mt-2 relative z-10">
          <div className="relative flex-1">
            <LinkIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400/80" />
            <input
              id="profile-unlisted-song-input"
              type="text"
              value={unlistedInput}
              onChange={(e) => setUnlistedInput(e.target.value)}
              placeholder={t.searchUnlistedPlaceholder}
              className="w-full bg-neutral-950/95 border border-amber-500/30 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none transition-all shadow-inner"
            />
            {unlistedInput && (
              <button
                type="button"
                onClick={() => setUnlistedInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="paste-unlisted-link-btn"
              onClick={handlePasteUnlisted}
              className="px-3.5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-neutral-700 hover:border-amber-500/40"
            >
              <Clipboard className="w-3.5 h-3.5 text-amber-400" />
              <span>{lang === 'km' ? 'បិទភ្ជាប់' : 'Paste'}</span>
            </button>

            <button
              type="submit"
              id="search-unlisted-song-btn"
              disabled={isSearchingUnlisted || !unlistedInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
            >
              {isSearchingUnlisted ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.searchingSong}</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>{t.searchAndAddButton}</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Feedback Alerts */}
        {unlistedSearchError && (
          <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{unlistedSearchError}</span>
          </div>
        )}

        {unlistedSearchSuccess && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{unlistedSearchSuccess}</span>
          </div>
        )}

        {/* Found Song Preview */}
        {foundUnlistedSong && (
          <div className="mt-3 p-3.5 rounded-2xl bg-neutral-950/90 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={foundUnlistedSong.imageUrl}
                alt={foundUnlistedSong.title}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-xl object-cover shrink-0 border border-neutral-800"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-white truncate">
                    {foundUnlistedSong.title}
                  </h4>
                  {foundUnlistedSong.isPublic === false || foundUnlistedSong.isUnlisted ? (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-semibold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      {t.unlistedBadge}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] font-semibold flex items-center gap-1">
                      <Globe className="w-2.5 h-2.5" />
                      {t.publicBadge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(foundUnlistedSong.duration)}
                  </span>
                  {foundUnlistedSong.modelName && <span>• {foundUnlistedSong.modelName}</span>}
                  {foundUnlistedSong.tags && <span>• {foundUnlistedSong.tags}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => onSelectSong(foundUnlistedSong.id)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-amber-400" />
                <span>{t.playAndInspect}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Track List Section */}
      <div className="bg-neutral-900/60 border border-neutral-800/90 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-md">
        {/* Title and Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Disc3 className="w-5 h-5 text-amber-400 animate-spin-slow" />
            <h2 className="text-lg font-bold text-white">
              {lang === 'km' ? 'បញ្ជីបទចម្រៀងទាំងអស់' : 'All Creator Tracks'}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono">
              {filteredSongs.length}
            </span>
          </div>

          {/* Filter search inside profile */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              id="profile-tracks-filter-input"
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={t.filterTracksPlaceholder}
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Visibility Filter Tabs (All, Public, Unlisted) */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            type="button"
            onClick={() => setVisibilityFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              visibilityFilter === 'all'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20 font-bold'
                : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
          >
            <span>{t.filterAll}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/20 font-mono">
              {songsList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setVisibilityFilter('public')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              visibilityFilter === 'public'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20 font-bold'
                : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
          >
            <Globe className="w-3 h-3" />
            <span>{t.filterPublic}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/20 font-mono">
              {publicSongsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setVisibilityFilter('unlisted')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              visibilityFilter === 'unlisted'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20 font-bold'
                : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
          >
            <Lock className="w-3 h-3 text-amber-400" />
            <span>{t.filterUnlisted}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold">
              {unlistedSongsCount}
            </span>
          </button>
        </div>

        {/* Unlisted Tracks Detected Banner */}
        {unlistedSongsCount > 0 && (
          <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-amber-500/20 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-amber-500/5 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <p className="text-xs text-amber-200 leading-relaxed">
                <span className="font-bold text-white">
                  {lang === 'km'
                    ? `រកឃើញបទចម្រៀងពុំទាន់បានបង្កើតជា Public (Unlisted) ចំនួន ${unlistedSongsCount} បទ ក្នុង Profile នេះ!`
                    : `Discovered ${unlistedSongsCount} unlisted / non-public track(s) in this profile!`}
                </span>{' '}
                <span className="text-amber-300/80">
                  {lang === 'km'
                    ? 'អ្នកអាចចាក់ស្តាប់ ចម្លង Link ឬទាញយកជា MP3 320kbps និង WAV Lossless ដោយសេរី។'
                    : 'You can stream, copy direct links, or batch download them as MP3 or WAV.'}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVisibilityFilter(visibilityFilter === 'unlisted' ? 'all' : 'unlisted')}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold shrink-0 transition-colors shadow-sm"
            >
              {visibilityFilter === 'unlisted'
                ? lang === 'km'
                  ? 'បង្ហាញទាំងអស់'
                  : 'Show All'
                : lang === 'km'
                ? 'បង្ហាញតែ Unlisted'
                : 'Show Unlisted Only'}
            </button>
          </div>
        )}

        {/* Checkbox Toolbar: Select All, Select First 5, Count, Prompt */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 mb-5 rounded-2xl bg-neutral-950/80 border border-neutral-800">
          <div className="flex items-center flex-wrap gap-2">
            {/* Master Select Checkbox */}
            <button
              type="button"
              id="master-select-all-btn"
              onClick={handleToggleSelectAll}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold text-neutral-200 border border-neutral-700 hover:border-amber-500/50 transition-all cursor-pointer"
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  allFilteredSelected
                    ? 'bg-amber-500 border-amber-500 text-neutral-950'
                    : someFilteredSelected
                    ? 'bg-amber-500/40 border-amber-500 text-neutral-950'
                    : 'border-neutral-600 bg-neutral-950 text-transparent'
                }`}
              >
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span>{allFilteredSelected ? t.deselectAll : t.selectAll}</span>
              <span className="text-[11px] text-neutral-400 font-mono">({filteredSongs.length})</span>
            </button>

            {/* Quick selectors */}
            {filteredSongs.length > 5 && (
              <button
                type="button"
                id="select-top-5-btn"
                onClick={() => handleSelectTopN(5)}
                className="px-2.5 py-1.5 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-[11px] font-medium text-neutral-300 hover:text-amber-400 border border-neutral-800 transition-colors"
              >
                {t.selectFirst5}
              </button>
            )}

            {filteredSongs.length > 10 && (
              <button
                type="button"
                id="select-top-10-btn"
                onClick={() => handleSelectTopN(10)}
                className="px-2.5 py-1.5 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-[11px] font-medium text-neutral-300 hover:text-amber-400 border border-neutral-800 transition-colors hidden sm:inline-block"
              >
                {t.selectFirst10}
              </button>
            )}

            {selectedIds.length > 0 && (
              <button
                type="button"
                id="clear-selection-toolbar-btn"
                onClick={handleDeselectAll}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              >
                {t.deselectAll}
              </button>
            )}

            {/* Direct Open Profile Data & Export Hub */}
            <button
              type="button"
              id="toolbar-open-profile-data-btn"
              onClick={() => setIsProfileDataModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/35 hover:border-amber-400 transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm ml-auto sm:ml-0"
              title={t.downloadProfileData}
            >
              <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.downloadProfileData}</span>
            </button>
          </div>

          {/* Prompt / Counter Status */}
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold animate-pulse">
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{t.selectedSongsCount.replace('{count}', String(selectedIds.length))}</span>
              </div>
            ) : (
              <span className="text-[11px] text-neutral-500 hidden md:inline">
                {t.selectSongsPrompt}
              </span>
            )}
          </div>
        </div>

        {filteredSongs.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 text-xs">
            {lang === 'km'
              ? 'រកមិនឃើញបទចម្រៀងដែលត្រូវនឹងពាក្យស្វែងរកនេះទេ។'
              : 'No songs found matching your search filter.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredSongs.map((song, idx) => {
              const isSelected = selectedIds.includes(song.id);
              const isHighlighted = highlightedSongId === song.id;
              const isCapturingThis = isCapturingSongId === song.id;
              const isUnlistedSong = song.isPublic === false || song.isUnlisted;
              const isDownloadingMp3 =
                Boolean(song.id && downloadingSong?.id === song.id && downloadingSong?.format === 'mp3');
              const isDownloadingWav =
                Boolean(song.id && downloadingSong?.id === song.id && downloadingSong?.format === 'wav');

              return (
                <div
                  key={song.id}
                  id={`profile-song-card-${song.id}`}
                  onClick={() => {
                    if (autoCaptureEnabled) {
                      handleAutoCaptureSong(song);
                    } else {
                      onSelectSong(song.id);
                    }
                  }}
                  className={`flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer group shadow-sm hover:shadow-lg relative ${
                    isCapturingThis
                      ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/80 shadow-amber-500/30 shadow-xl animate-pulse'
                      : isHighlighted
                      ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/80 shadow-amber-500/20 shadow-lg'
                      : isSelected
                      ? 'bg-amber-500/[0.08] border-amber-500/60 ring-1 ring-amber-500/40'
                      : 'bg-neutral-950/70 hover:bg-neutral-950 border-neutral-800 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    {/* Dedicated Checkbox */}
                    <button
                      type="button"
                      id={`checkbox-song-${song.id}`}
                      onClick={(e) => handleToggleSelectSong(song.id, e)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all mt-1 ${
                        isSelected
                          ? 'bg-amber-500 border-amber-500 text-neutral-950 shadow-sm shadow-amber-500/50 scale-105'
                          : 'border-neutral-700 bg-neutral-900/90 hover:border-amber-400/80 text-transparent'
                      }`}
                      title={isSelected ? t.deselectAll : t.checkboxSelect}
                      aria-label={`Select ${song.title}`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </button>

                    {/* Artwork */}
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 bg-neutral-900 border border-neutral-800">
                      <img
                        src={song.imageUrl}
                        alt={song.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-5 h-5 text-amber-400 fill-amber-400" />
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-mono mb-0.5 flex-wrap">
                        <span>#{idx + 1}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(song.duration)}
                        </span>
                        {song.modelName && (
                          <>
                            <span>•</span>
                            <ModelBadge modelName={song.modelName} size="xs" />
                          </>
                        )}
                        <span>•</span>
                        {isUnlistedSong ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-300 border border-amber-500/40 text-[9px] font-bold flex items-center gap-1 shadow-sm shadow-amber-500/10">
                            <Lock className="w-2.5 h-2.5 text-amber-300" />
                            <span>{t.unlistedBadge}</span>
                            {song.capturedAt && (
                              <span className="text-[8px] text-emerald-300 font-mono">✓ CAPTURED</span>
                            )}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[9px] font-semibold flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" />
                            <span>{t.publicBadge}</span>
                          </span>
                        )}
                      </div>

                      <h3 className={`text-sm font-semibold transition-colors line-clamp-2 leading-snug ${
                        isSelected ? 'text-amber-300' : 'text-white group-hover:text-amber-400'
                      }`}>
                        {song.title}
                      </h3>

                      {song.tags && (
                        <p className="text-[11px] text-neutral-400 line-clamp-1 mt-1">
                          {song.tags}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/80">
                    <button
                      type="button"
                      id={`play-song-${song.id}-btn`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSong(song.id);
                      }}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-neutral-900 hover:bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{t.playAndInspect}</span>
                    </button>

                    {/* Quick Auto-Capture Trigger */}
                    <button
                      type="button"
                      id={`quick-capture-${song.id}-btn`}
                      onClick={(e) => handleAutoCaptureSong(song, e)}
                      disabled={isCapturingThis}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all shadow-sm ${
                        isUnlistedSong
                          ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/50'
                          : 'bg-neutral-900 hover:bg-amber-500/10 text-neutral-300 hover:text-amber-300 border-neutral-700 hover:border-amber-500/40'
                      }`}
                      title={t.quickCaptureBtn}
                    >
                      {isCapturingThis ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      )}
                      <span className="hidden sm:inline">{t.quickCaptureBtn}</span>
                    </button>

                    <button
                      type="button"
                      id={`dl-mp3-${song.id}-btn`}
                      onClick={(e) => handleDownload(song, 'mp3', e)}
                      disabled={isDownloadingMp3}
                      className="py-1.5 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 text-xs font-bold flex items-center gap-1 shadow-sm transition-all disabled:opacity-75"
                      title="Download MP3 320kbps"
                    >
                      {isDownloadingMp3 ? (
                        <Loader2 className="w-3 h-3 animate-spin text-neutral-950" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      <span>{isDownloadingMp3 ? (downloadingSong?.percent ? `${downloadingSong.percent}%` : '...') : 'MP3'}</span>
                    </button>

                    <button
                      type="button"
                      id={`dl-wav-${song.id}-btn`}
                      onClick={(e) => handleDownload(song, 'wav', e)}
                      disabled={isDownloadingWav}
                      className="py-1.5 px-2.5 rounded-lg bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 border border-sky-500/30 text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-75"
                      title="Download Universal Lossless WAV (100% Compatible)"
                    >
                      {isDownloadingWav ? (
                        <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                      ) : (
                        <Download className="w-3 h-3 text-sky-400" />
                      )}
                      <span>{isDownloadingWav ? (downloadingSong?.percent ? `${downloadingSong.percent}%` : '...') : 'WAV'}</span>
                    </button>

                    <button
                      type="button"
                      id={`copy-link-${song.id}-btn`}
                      onClick={(e) => handleCopySongLink(song.id, e)}
                      className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-amber-300 border border-neutral-800 transition-colors"
                      title={copiedSongId === song.id ? (lang === 'km' ? 'បានចម្លង Link!' : 'Copied Link!') : (lang === 'km' ? 'ចម្លង Suno Link' : 'Copy Suno Link')}
                    >
                      {copiedSongId === song.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <LinkIcon className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Sticky Bulk Download Action Bar */}
      {selectedIds.length > 0 && (
        <div
          id="batch-download-sticky-bar"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-2xl bg-neutral-950/95 backdrop-blur-xl border-2 border-amber-500/50 rounded-3xl p-3 sm:p-4 shadow-2xl shadow-amber-950/50 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          {/* Left: Selection Count */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-neutral-950 font-black text-sm shadow-md shrink-0">
                {selectedIds.length}
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-white leading-tight">
                  {t.selectedSongsCount.replace('{count}', String(selectedIds.length))}
                </p>
                <p className="text-[10px] text-neutral-400">
                  {lang === 'km' ? 'ជ្រើសរើសទម្រង់ទាញយកទាំងអស់' : 'Batch download all selected tracks'}
                </p>
              </div>
            </div>

            {/* Clear button on mobile */}
            <button
              type="button"
              id="clear-selection-mobile-btn"
              onClick={handleDeselectAll}
              className="sm:hidden p-1.5 text-neutral-400 hover:text-white"
              title={t.deselectAll}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Download Actions */}
          <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end">
            {/* Download MP3 + WAV (ZIP) with Original Titles */}
            <button
              type="button"
              id="batch-download-both-zip-btn"
              onClick={() => handleBatchZipDownload('both')}
              disabled={zipDownloading !== null || isSequentialActive}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-sky-500 to-cyan-400 hover:opacity-95 text-neutral-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all disabled:opacity-50 cursor-pointer"
              title="Download MP3 and Lossless WAV with original Unicode titles in one ZIP"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>{zipDownloading === 'both' ? t.preparingZip : t.downloadBatchZipBoth}</span>
            </button>

            {/* Download MP3 ZIP */}
            <button
              type="button"
              id="batch-download-mp3-zip-btn"
              onClick={() => handleBatchZipDownload('mp3')}
              disabled={zipDownloading !== null || isSequentialActive}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all disabled:opacity-50 cursor-pointer"
              title="Download all selected songs as MP3 ZIP"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>{zipDownloading === 'mp3' ? t.preparingZip : t.batchDownloadMp3Zip}</span>
            </button>

            {/* Download WAV ZIP */}
            <button
              type="button"
              id="batch-download-wav-zip-btn"
              onClick={() => handleBatchZipDownload('wav')}
              disabled={zipDownloading !== null || isSequentialActive}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-sky-950 hover:bg-sky-900 border border-sky-500/40 text-sky-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              title="Download all selected songs as Lossless WAV ZIP"
            >
              <FolderArchive className="w-3.5 h-3.5 text-sky-400" />
              <span>{zipDownloading === 'wav' ? t.preparingZip : t.batchDownloadWavZip}</span>
            </button>

            {/* Sequential 1-by-1 Download Button */}
            <button
              type="button"
              id="batch-download-sequential-btn"
              onClick={() => handleBatchSequentialDownload('mp3')}
              disabled={zipDownloading !== null || isSequentialActive}
              className="px-2.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 hover:border-amber-500/40 transition-colors text-xs flex items-center gap-1"
              title={t.batchDownloadSequential}
            >
              <Download className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden sm:inline">{t.batchDownloadSequential}</span>
            </button>

            {/* Clear button on desktop */}
            <button
              type="button"
              id="close-batch-bar-btn"
              onClick={handleDeselectAll}
              className="hidden sm:inline-flex p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title={t.deselectAll}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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

      {/* Sequential Batch Download Modal */}
      {isSequentialActive && sequentialProgress && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Disc3 className="w-5 h-5 text-amber-400 animate-spin" />
                <span>{t.batchDownloadingTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  batchAbortRef.current = true;
                  setIsSequentialActive(false);
                }}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 font-medium truncate mb-3">
              {t.batchDownloadingStatus
                .replace('{current}', String(sequentialProgress.current))
                .replace('{total}', String(sequentialProgress.total))
                .replace('{title}', sequentialProgress.currentTitle)}
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-neutral-950 rounded-full h-3 overflow-hidden border border-neutral-800 mb-3">
              <div
                className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${sequentialProgress.percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-400 mb-4">
              <span>{sequentialProgress.percent}%</span>
              <span>
                {sequentialProgress.current} / {sequentialProgress.total}
              </span>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  batchAbortRef.current = true;
                  setIsSequentialActive(false);
                }}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors"
              >
                {t.cancelDownload}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Data Download & Export Modal */}
      <ProfileDataModal
        isOpen={isProfileDataModalOpen}
        onClose={() => setIsProfileDataModalOpen(false)}
        profile={profile}
        songs={songsList}
        lang={lang}
        onDownloadAllZip={(format, bitDepth) => handleBatchZipDownload(format, bitDepth, songsList)}
        zipDownloading={zipDownloading}
      />

      {/* Captured Unlisted Track Inspector & Audio Stream Player Modal */}
      <UnlistedCapturedModal
        isOpen={capturedModalOpen}
        onClose={() => setCapturedModalOpen(false)}
        song={activeCapturedSong}
        lang={lang}
        onOpenInFullStudio={(songId) => {
          setCapturedModalOpen(false);
          onSelectSong(songId);
        }}
        onDownload={(s, format) => handleDownload(s, format)}
        isDownloadingMp3={
          Boolean(activeCapturedSong?.id && downloadingSong?.id === activeCapturedSong.id && downloadingSong?.format === 'mp3')
        }
        isDownloadingWav={
          Boolean(activeCapturedSong?.id && downloadingSong?.id === activeCapturedSong.id && downloadingSong?.format === 'wav')
        }
        downloadPercent={
          activeCapturedSong?.id && downloadingSong?.id === activeCapturedSong.id ? downloadingSong?.percent : undefined
        }
      />
    </div>
  );
};

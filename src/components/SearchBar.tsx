import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Clipboard,
  X,
  ArrowRight,
  Loader2,
  Sparkles,
  ListMusic,
  Music,
  User,
  Disc,
  Lock,
  Unlock,
  Copy,
  Check,
  Zap,
  Play,
  Settings,
  UserCheck
} from 'lucide-react';
import type { Language } from '../i18n.js';
import { translations } from '../i18n.js';
import { ModelBadge } from './ModelBadge.js';

export interface SearchBarInputProps {
  url: string;
  setUrl: (url: string) => void;
  onFetch: (targetUrl?: string) => void;
  isLoading: boolean;
  lang: Language;
  isLocked?: boolean;
  onToggleLock?: () => void;
}

export interface SearchBarSamplesProps {
  url: string;
  setUrl: (url: string) => void;
  onFetch: (targetUrl?: string) => void;
  isLoading: boolean;
  lang: Language;
  meHandle?: string;
  onOpenMeConfig?: () => void;
}

export interface SearchBarProps extends SearchBarInputProps {
  meHandle?: string;
  onOpenMeConfig?: () => void;
}

export type SampleCategory = 'all' | 'song' | 'profile' | 'playlist' | 'unlisted';

export interface SampleItem {
  id: string;
  category: SampleCategory;
  title: string;
  subtitle: string;
  badge: string;
  url: string;
  icon: React.ElementType;
  theme: {
    border: string;
    hoverBorder: string;
    bg: string;
    hoverBg: string;
    text: string;
    badgeBg: string;
    badgeText: string;
    glow: string;
    activeBorder: string;
    activeRing: string;
  };
}

/**
 * Primary Search & Paste Input Bar
 * Keeps the input and "Paste" button locked together in one place,
 * with an interactive lock button (ចាក់សោរប៊ូតុង) to pin/lock position on scroll.
 */
export const SearchBarInput: React.FC<SearchBarInputProps> = ({
  url,
  setUrl,
  onFetch,
  isLoading,
  lang,
  isLocked = true,
  onToggleLock
}) => {
  const t = translations[lang];
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onFetch(url.trim());
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const clean = text.trim();
        setUrl(clean);
        setPasteSuccess(true);
        setPasteNotice(null);
        setTimeout(() => setPasteSuccess(false), 1500);
      } else {
        setPasteNotice(lang === 'km' ? 'ក្តារចម្លងទទេ' : 'Clipboard is empty');
        setTimeout(() => setPasteNotice(null), 2500);
      }
    } catch {
      // Permission denied or iframe restriction
      const inputEl = document.getElementById('suno-url-input');
      if (inputEl) inputEl.focus();
      setPasteNotice(
        t.pasteErrorTip ||
          (lang === 'km'
            ? 'សូមចុច Ctrl+V (ឬ Cmd+V) ដើម្បីបិទភ្ជាប់'
            : 'Please press Ctrl+V to paste')
      );
      setTimeout(() => setPasteNotice(null), 3000);
    }
  };

  // Detected link type for smart visual feedback
  const detected = useMemo(() => {
    const u = url.trim().toLowerCase();
    if (!u) return null;
    if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(u)) {
      if (u.includes('playlist')) {
        return {
          icon: Disc,
          label: t.linkTypePlaylist,
          color: 'text-teal-300 bg-teal-500/15 border-teal-500/30'
        };
      }
      if (u.includes('song') && u.includes('5adacb49')) {
        return {
          icon: Lock,
          label: t.linkTypeUnlisted,
          color: 'text-purple-300 bg-purple-500/15 border-purple-500/30'
        };
      }
      return {
        icon: Music,
        label: t.linkTypeSong,
        color: 'text-amber-300 bg-amber-500/15 border-amber-500/30'
      };
    }
    if (u.includes('playlist') || u.includes('page=playlists')) {
      return {
        icon: Disc,
        label: t.linkTypePlaylist,
        color: 'text-teal-300 bg-teal-500/15 border-teal-500/30'
      };
    }
    if (u.includes('create') || u.includes('suno.com/create')) {
      return {
        icon: Sparkles,
        label: t.linkTypeCreate,
        color: 'text-violet-300 bg-violet-500/15 border-violet-500/30'
      };
    }
    if (u.startsWith('@') || u.includes('/@') || u.includes('suno.com/me') || u === 'me') {
      return {
        icon: User,
        label: t.linkTypeProfile,
        color: 'text-sky-300 bg-sky-500/15 border-sky-500/30'
      };
    }
    if (u.includes('suno.com/s/') || u.includes('suno.com/song/')) {
      return {
        icon: Music,
        label: t.linkTypeSong,
        color: 'text-amber-300 bg-amber-500/15 border-amber-500/30'
      };
    }
    return null;
  }, [url, t]);

  const DetectedIcon = detected?.icon;

  return (
    <div className="w-full relative">
      <form onSubmit={handleSubmit} className="relative group">
        <div
          className={`relative flex items-center bg-neutral-900/95 border ${
            isLocked
              ? 'border-amber-500/40 ring-1 ring-amber-500/20 shadow-xl shadow-amber-500/5'
              : 'border-neutral-800'
          } focus-within:border-amber-500/80 rounded-2xl p-1.5 sm:p-2 shadow-2xl shadow-black/60 transition-all duration-300`}
        >
          {/* Left search icon or detected tag */}
          <div className="pl-2.5 sm:pl-3 pr-1.5 flex items-center gap-1.5 shrink-0">
            {detected && DetectedIcon ? (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-semibold border ${detected.color}`}
              >
                <DetectedIcon className="w-3 h-3" />
                <span className="hidden sm:inline">{detected.label}</span>
              </span>
            ) : (
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-400 group-focus-within:text-amber-400 transition-colors" />
            )}
          </div>

          {/* Primary URL Input */}
          <input
            id="suno-url-input"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t.inputPlaceholder}
            disabled={isLoading}
            className="w-full bg-transparent text-xs sm:text-sm md:text-base text-neutral-100 placeholder:text-neutral-500 focus:outline-none px-1.5 sm:px-2 disabled:opacity-50 font-sans min-w-0"
          />

          {/* Action Button Group */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Clear Button */}
            {url && (
              <button
                type="button"
                id="clear-url-btn"
                onClick={() => setUrl('')}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
                title={t.clearButton}
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}

            {/* Paste Button (Always visible on mobile & desktop) */}
            <button
              type="button"
              id="paste-url-btn"
              onClick={handlePaste}
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 border cursor-pointer active:scale-95 ${
                pasteSuccess
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700/70 hover:border-neutral-600'
              }`}
              title={t.pasteTooltip}
            >
              {pasteSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[11px] font-bold text-emerald-300">
                    {lang === 'km' ? 'បានបិទភ្ជាប់!' : 'Pasted!'}
                  </span>
                </>
              ) : (
                <>
                  <Clipboard className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden xs:inline text-[11px]">{t.pasteButton}</span>
                </>
              )}
            </button>

            {/* Lock Button ("ចាក់សោរប៊ូតុង") */}
            {onToggleLock && (
              <button
                type="button"
                id="lock-searchbar-btn"
                onClick={onToggleLock}
                className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 border cursor-pointer active:scale-95 ${
                  isLocked
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10 hover:bg-amber-500/25'
                    : 'bg-neutral-800/80 text-neutral-400 border-neutral-700/60 hover:text-neutral-200 hover:bg-neutral-700'
                }`}
                title={isLocked ? t.lockTooltipLocked : t.lockTooltipUnlocked}
                aria-label={isLocked ? t.lockedInPlace : t.unlockPosition}
              >
                {isLocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="hidden sm:inline text-[11px] font-bold text-amber-300">
                      {t.lockedInPlace}
                    </span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="hidden sm:inline text-[11px]">{t.unlockPosition}</span>
                  </>
                )}
              </button>
            )}

            {/* Fetch / Submit Button */}
            <button
              type="submit"
              id="fetch-song-btn"
              disabled={isLoading || !url.trim()}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs sm:text-sm transition-all duration-200 shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                  <span className="hidden md:inline">{t.fetching}</span>
                </>
              ) : (
                <>
                  <span className="hidden xs:inline">{t.fetchButton}</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Optional Paste notification tooltip */}
      {pasteNotice && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-xs text-amber-300 shadow-xl z-50 animate-in fade-in zoom-in duration-200 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>{pasteNotice}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Supported Models & Interactive Sample Link Hub
 */
export const SearchBarSamples: React.FC<SearchBarSamplesProps> = ({
  url,
  setUrl,
  onFetch,
  isLoading,
  lang,
  meHandle,
  onOpenMeConfig
}) => {
  const t = translations[lang];
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<SampleCategory>('all');
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);

  const handleSampleClick = (sample: SampleItem) => {
    setUrl(sample.url);
    setLoadingSampleId(sample.id);
    onFetch(sample.url);
  };

  const handleCopySample = async (e: React.MouseEvent, sample: SampleItem) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(sample.url);
      setCopiedId(sample.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      setLoadingSampleId(null);
    }
  }, [isLoading]);

  const samples: SampleItem[] = [
    {
      id: 'sample-create',
      category: 'profile',
      title: t.sampleCreateTitle,
      subtitle: meHandle
        ? t.sampleCreateConfigured
          ? t.sampleCreateConfigured.replace('{handle}', meHandle)
          : `@${meHandle} • Workspace`
        : t.sampleCreateDesc,
      badge: t.sampleCreateBadge,
      url: 'https://suno.com/create?wid=default',
      icon: Sparkles,
      theme: {
        border: 'border-violet-500/40',
        hoverBorder: 'hover:border-violet-400/80',
        bg: 'bg-violet-500/[0.08]',
        hoverBg: 'hover:bg-violet-500/[0.16]',
        text: 'text-violet-300',
        badgeBg: 'bg-violet-500/25',
        badgeText: 'text-violet-300',
        glow: 'group-hover:shadow-[0_0_20px_rgba(139,92,246,0.2)]',
        activeBorder: 'border-violet-400',
        activeRing: 'ring-1 ring-violet-400/60 shadow-[0_0_16px_rgba(139,92,246,0.25)]'
      }
    },
    {
      id: 'sample-me',
      category: 'profile',
      title: t.sampleProfileMeTitle,
      subtitle: meHandle
        ? t.sampleProfileMeConfigured
          ? t.sampleProfileMeConfigured.replace('{handle}', meHandle)
          : `@${meHandle}`
        : t.sampleProfileMeDesc,
      badge: t.sampleProfileMeBadge,
      url: 'https://suno.com/me',
      icon: UserCheck,
      theme: {
        border: 'border-emerald-500/40',
        hoverBorder: 'hover:border-emerald-400/80',
        bg: 'bg-emerald-500/[0.08]',
        hoverBg: 'hover:bg-emerald-500/[0.16]',
        text: 'text-emerald-300',
        badgeBg: 'bg-emerald-500/25',
        badgeText: 'text-emerald-300',
        glow: 'group-hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]',
        activeBorder: 'border-emerald-400',
        activeRing: 'ring-1 ring-emerald-400/60 shadow-[0_0_16px_rgba(16,185,129,0.25)]'
      }
    },
    {
      id: 'sample-me-playlists',
      category: 'playlist',
      title: t.sampleMePlaylistsTitle,
      subtitle: meHandle
        ? t.sampleMePlaylistsConfigured
          ? t.sampleMePlaylistsConfigured.replace('{handle}', meHandle)
          : `@${meHandle} • Playlists`
        : t.sampleMePlaylistsDesc,
      badge: t.sampleMePlaylistsBadge,
      url: 'https://suno.com/me/playlists',
      icon: ListMusic,
      theme: {
        border: 'border-teal-500/40',
        hoverBorder: 'hover:border-teal-400/80',
        bg: 'bg-teal-500/[0.08]',
        hoverBg: 'hover:bg-teal-500/[0.16]',
        text: 'text-teal-300',
        badgeBg: 'bg-teal-500/25',
        badgeText: 'text-teal-300',
        glow: 'group-hover:shadow-[0_0_20px_rgba(20,184,166,0.2)]',
        activeBorder: 'border-teal-400',
        activeRing: 'ring-1 ring-teal-400/60 shadow-[0_0_16px_rgba(20,184,166,0.25)]'
      }
    },
    {
      id: 'sample-song',
      category: 'song',
      title: t.sampleSongTitle,
      subtitle: t.sampleSongDesc,
      badge: 'MP3 + WAV',
      url: 'https://suno.com/s/J5hDrJ4xqChr98cw',
      icon: Music,
      theme: {
        border: 'border-amber-500/30',
        hoverBorder: 'hover:border-amber-400/70',
        bg: 'bg-amber-500/[0.07]',
        hoverBg: 'hover:bg-amber-500/[0.14]',
        text: 'text-amber-300',
        badgeBg: 'bg-amber-500/20',
        badgeText: 'text-amber-300',
        glow: 'group-hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
        activeBorder: 'border-amber-400',
        activeRing: 'ring-1 ring-amber-400/60 shadow-[0_0_16px_rgba(245,158,11,0.2)]'
      }
    },
    {
      id: 'sample-musicsabay',
      category: 'profile',
      title: t.sampleProfileMusicsabayTitle,
      subtitle: t.sampleProfileMusicsabayDesc,
      badge: lang === 'km' ? '💾 ទាញយកទិន្នន័យ Profile' : '💾 Profile Data & ZIP',
      url: 'https://suno.com/@musicsabay',
      icon: User,
      theme: {
        border: 'border-sky-500/30',
        hoverBorder: 'hover:border-sky-400/70',
        bg: 'bg-sky-500/[0.07]',
        hoverBg: 'hover:bg-sky-500/[0.14]',
        text: 'text-sky-300',
        badgeBg: 'bg-sky-500/20',
        badgeText: 'text-sky-300',
        glow: 'group-hover:shadow-[0_0_20px_rgba(14,165,233,0.15)]',
        activeBorder: 'border-sky-400',
        activeRing: 'ring-1 ring-sky-400/60 shadow-[0_0_16px_rgba(14,165,233,0.2)]'
      }
    },
    {
      id: 'sample-psmusic',
      category: 'playlist',
      title: t.sampleProfilePsmusicTitle,
      subtitle: t.sampleProfilePsmusicDesc,
      badge: lang === 'km' ? '⚡ ស្វ័យប្រវត្តិ (34 បទ)' : '⚡ Auto (34 Tracks)',
      url: 'https://suno.com/@ps_music_english?page=playlists',
      icon: ListMusic,
      theme: {
        border: 'border-orange-500/40',
        hoverBorder: 'hover:border-orange-400/80',
        bg: 'bg-orange-500/[0.08]',
        hoverBg: 'hover:bg-orange-500/[0.16]',
        text: 'text-orange-300',
        badgeBg: 'bg-orange-500/25',
        badgeText: 'text-orange-300',
        glow: 'group-hover:shadow-[0_0_20px_rgba(249,115,22,0.2)]',
        activeBorder: 'border-orange-400',
        activeRing: 'ring-1 ring-orange-400/60 shadow-[0_0_16px_rgba(249,115,22,0.25)]'
      }
    },
    {
      id: 'sample-playlist',
      category: 'playlist',
      title: t.samplePlaylistTitle,
      subtitle: t.samplePlaylistDesc,
      badge: 'Album ZIP',
      url: 'https://suno.com/playlist/49978bf2-6166-4bc6-ae7c-c92554eac081',
      icon: Disc,
      theme: {
        border: 'border-emerald-500/30',
        hoverBorder: 'hover:border-emerald-400/70',
        bg: 'bg-emerald-500/[0.07]',
        hoverBg: 'hover:bg-emerald-500/[0.14]',
        text: 'text-emerald-300',
        badgeBg: 'bg-emerald-500/20',
        badgeText: 'text-emerald-300',
        glow: 'group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]',
        activeBorder: 'border-emerald-400',
        activeRing: 'ring-1 ring-emerald-400/60 shadow-[0_0_16px_rgba(16,185,129,0.2)]'
      }
    },
    {
      id: 'sample-unlisted',
      category: 'unlisted',
      title: t.sampleUnlistedTitle,
      subtitle: t.sampleUnlistedDesc,
      badge: 'DRM Unlisted',
      url: 'https://suno.com/song/5adacb49-e794-40b9-89e8-06e43a3d74b4',
      icon: Lock,
      theme: {
        border: 'border-purple-500/30',
        hoverBorder: 'hover:border-purple-400/70',
        bg: 'bg-purple-500/[0.07]',
        hoverBg: 'hover:bg-purple-500/[0.14]',
        text: 'text-purple-300',
        badgeBg: 'bg-purple-500/20',
        badgeText: 'text-purple-300',
        glow: 'group-hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]',
        activeBorder: 'border-purple-400',
        activeRing: 'ring-1 ring-purple-400/60 shadow-[0_0_16px_rgba(168,85,247,0.2)]'
      }
    }
  ];

  const filterTabs = [
    { key: 'all' as SampleCategory, label: t.sampleFilterAll },
    { key: 'song' as SampleCategory, label: t.sampleFilterSong },
    { key: 'profile' as SampleCategory, label: t.sampleFilterProfile },
    { key: 'playlist' as SampleCategory, label: t.sampleFilterPlaylist },
    { key: 'unlisted' as SampleCategory, label: t.sampleFilterUnlisted }
  ];

  const filteredSamples =
    activeCategory === 'all'
      ? samples
      : samples.filter(
          (s) =>
            s.category === activeCategory ||
            (s.id === 'sample-me-playlists' &&
              (activeCategory === 'playlist' || activeCategory === 'profile')) ||
            (s.id === 'sample-psmusic' &&
              (activeCategory === 'playlist' || activeCategory === 'profile')) ||
            (s.id === 'sample-me' && activeCategory === 'profile') ||
            (s.id === 'sample-create' && activeCategory === 'profile')
        );

  const isUrlActive = (sampleUrl: string) => {
    if (!url) return false;
    const cleanCurrent = url.trim().toLowerCase();
    const cleanSample = sampleUrl.trim().toLowerCase();
    if (cleanCurrent === cleanSample) return true;
    if (cleanSample.includes('playlists') && cleanCurrent.includes('playlists')) return true;
    if (!cleanSample.includes('playlists') && cleanCurrent.includes('playlists')) return false;
    if (cleanSample.includes('create') && cleanCurrent.includes('create')) return true;
    return cleanCurrent.includes(cleanSample);
  };

  return (
    <div className="w-full space-y-4">
      {/* Supported Models Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 shadow-md">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
          <span className="text-xs font-semibold text-neutral-300">
            {lang === 'km' ? 'គាំទ្រគ្រប់ជំនាន់ AI:' : 'Supported Suno AI Engines:'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModelBadge modelName="v6-pro" size="sm" />
          <ModelBadge modelName="v6" size="sm" />
          <ModelBadge modelName="v3.8" size="sm" />
          <ModelBadge modelName="v4" size="sm" />
          <ModelBadge modelName="v3.5" size="sm" />
          <span className="hidden sm:inline-block text-[11px] text-emerald-400/90 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            ✓ DRM Decrypted & 48kHz PCM
          </span>
        </div>
      </div>

      {/* Smart & Lively Sample Link Hub */}
      <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-3 sm:p-4 shadow-xl backdrop-blur-sm transition-all duration-300">
        {/* Hub Header & Categories */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 mb-3.5 pb-2.5 border-b border-neutral-800/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-sm shadow-amber-500/10">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-neutral-200 tracking-wide">
                  {t.sampleHubTitle}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  {t.sampleHubBadge}
                </span>
              </div>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center flex-wrap gap-1.5">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveCategory(tab.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                  activeCategory === tab.key
                    ? 'bg-amber-500 text-neutral-950 font-semibold shadow-sm shadow-amber-500/20'
                    : 'bg-neutral-800/80 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Interactive Sample Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filteredSamples.map((sample) => {
            const Icon = sample.icon;
            const active = isUrlActive(sample.url);
            const isThisLoading = isLoading && loadingSampleId === sample.id;
            const isCopied = copiedId === sample.id;

            return (
              <div
                key={sample.id}
                id={`sample-card-${sample.id}`}
                onClick={() => handleSampleClick(sample)}
                className={`group relative flex items-center justify-between p-2.5 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden ${
                  sample.theme.bg
                } ${sample.theme.hoverBg} ${
                  active
                    ? `${sample.theme.activeBorder} ${sample.theme.activeRing}`
                    : `${sample.theme.border} ${sample.theme.hoverBorder}`
                } ${sample.theme.glow} hover:-translate-y-0.5 active:scale-[0.98]`}
                title={`${t.sampleClickToLoad}: ${sample.url}`}
              >
                {/* Left Side: Animated Icon + Titles */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <div
                    className={`relative p-2 rounded-lg border shrink-0 transition-transform duration-300 group-hover:scale-105 ${sample.theme.badgeBg} ${sample.theme.border} ${sample.theme.text}`}
                  >
                    {isThisLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}

                    {/* Animated Equalizer Wave Bars on Hover */}
                    <span className="absolute -bottom-1 -right-1 flex items-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="w-0.5 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-0.5 h-3 bg-amber-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-0.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-bold truncate transition-colors ${
                          active ? 'text-white' : 'text-neutral-200 group-hover:text-white'
                        }`}
                      >
                        {sample.title}
                      </span>
                      {active && (
                        <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500 text-neutral-950">
                          <Check className="w-2.5 h-2.5" />
                          {t.sampleActiveBadge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 group-hover:text-neutral-300 truncate leading-snug">
                      {sample.subtitle}
                    </p>
                  </div>
                </div>

                {/* Right Side: Badge & Copy Action */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`hidden xl:inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border border-transparent ${sample.theme.badgeBg} ${sample.theme.badgeText}`}
                  >
                    {sample.badge}
                  </span>

                  {/* Gear configure button for sample-me, sample-create, sample-me-playlists */}
                  {(sample.id === 'sample-me' ||
                    sample.id === 'sample-create' ||
                    sample.id === 'sample-me-playlists') &&
                    onOpenMeConfig && (
                      <button
                        id={`config-${sample.id}-btn`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenMeConfig();
                        }}
                        className={`p-1.5 rounded-lg border transition-all opacity-90 group-hover:opacity-100 ${
                          sample.id === 'sample-create'
                            ? 'bg-violet-500/10 hover:bg-violet-500/25 text-violet-400 border-violet-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/30'
                        }`}
                        title={t.meChangeButton}
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    )}

                  {/* Copy Link Button */}
                  <button
                    type="button"
                    onClick={(e) => handleCopySample(e, sample)}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      isCopied
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                        : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 border-neutral-700/60 opacity-80 group-hover:opacity-100'
                    }`}
                    title={isCopied ? t.sampleCopiedLink : t.sampleCopyLink}
                  >
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Play/Load Indicator */}
                  <div className="p-1 rounded-full text-neutral-500 group-hover:text-amber-400 transition-colors">
                    <Play className="w-3 h-3 fill-current opacity-70 group-hover:opacity-100" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Smart Hint Bar */}
        <div className="mt-3 pt-2 border-t border-neutral-800/40 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-neutral-500">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-400/80 shrink-0" />
            <span>
              {lang === 'km'
                ? 'ចុចលើ Link គំរូខាងលើ ដើម្បីទាញយកទិន្នន័យដោយស្វ័យប្រវត្តិ ឬចុចប៊ូតុងចម្លង (Copy) សម្រាប់យកទៅប្រើប្រាស់'
                : 'Click any sample above for instant automated loading, or use the copy button to grab the URL directly.'}
            </span>
          </div>
          <span className="text-neutral-600 font-mono text-[10px]">Suno V4.5 & V3.5 Supported</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Combined SearchBar for backward compatibility
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  url,
  setUrl,
  onFetch,
  isLoading,
  lang,
  meHandle,
  onOpenMeConfig,
  isLocked,
  onToggleLock
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <SearchBarInput
        url={url}
        setUrl={setUrl}
        onFetch={onFetch}
        isLoading={isLoading}
        lang={lang}
        isLocked={isLocked}
        onToggleLock={onToggleLock}
      />
      <SearchBarSamples
        url={url}
        setUrl={setUrl}
        onFetch={onFetch}
        isLoading={isLoading}
        lang={lang}
        meHandle={meHandle}
        onOpenMeConfig={onOpenMeConfig}
      />
    </div>
  );
};

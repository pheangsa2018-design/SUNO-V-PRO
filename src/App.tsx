import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { SearchBarInput, SearchBarSamples } from './components/SearchBar.js';
import { SongCard } from './components/SongCard.js';
import { ProfileView } from './components/ProfileView.js';
import { PlaylistView } from './components/PlaylistView.js';
import { RecentHistory } from './components/RecentHistory.js';
import { FeaturesInfo } from './components/FeaturesInfo.js';
import { BloggerEmbedModal } from './components/BloggerEmbedModal.js';
import { MeConfigModal } from './components/MeConfigModal.js';
import type { SongInfo, ProfileInfo, PlaylistInfo, CachedHistoryItem, FavoriteSongItem } from './types.js';
import type { Language } from './i18n.js';
import { translations } from './i18n.js';
import { AlertCircle, Disc3 } from 'lucide-react';

const DEFAULT_SONG_URL = 'https://suno.com/s/J5hDrJ4xqChr98cw';
const STORAGE_KEY_HISTORY = 'suno_downloader_history';
const STORAGE_KEY_LANG = 'suno_downloader_lang';
const STORAGE_KEY_FAVORITES = 'suno_favorites';
const STORAGE_KEY_ME_HANDLE = 'suno_me_handle';

export function App() {
  const [url, setUrl] = useState(DEFAULT_SONG_URL);
  const [song, setSong] = useState<SongInfo | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistInfo | null>(null);
  const [activeView, setActiveView] = useState<'song' | 'profile' | 'playlist'>('song');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBloggerModalOpen, setIsBloggerModalOpen] = useState(false);
  const [isMeModalOpen, setIsMeModalOpen] = useState(false);
  const [meHandle, setMeHandle] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_ME_HANDLE) || '';
  });
  const [isLastFetchMe, setIsLastFetchMe] = useState(false);
  const [isLastFetchCreate, setIsLastFetchCreate] = useState(false);
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem(STORAGE_KEY_LANG) as Language) || 'km';
  });
  const [history, setHistory] = useState<CachedHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [favorites, setFavorites] = useState<FavoriteSongItem[]>(() => {
    try {
      const stored =
        localStorage.getItem(STORAGE_KEY_FAVORITES) ||
        localStorage.getItem('suno_downloader_favorites');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isBarLocked, setIsBarLocked] = useState<boolean>(() => {
    return localStorage.getItem('suno_searchbar_locked') !== 'false';
  });

  const handleToggleBarLock = () => {
    setIsBarLocked((prev) => {
      const next = !prev;
      localStorage.setItem('suno_searchbar_locked', String(next));
      return next;
    });
  };

  const t = translations[lang];

  // Sync favorites with external / cross-tab changes
  useEffect(() => {
    const syncFavorites = () => {
      try {
        const stored =
          localStorage.getItem(STORAGE_KEY_FAVORITES) ||
          localStorage.getItem('suno_downloader_favorites');
        if (stored) {
          setFavorites(JSON.parse(stored));
        } else {
          setFavorites([]);
        }
      } catch {
        setFavorites([]);
      }
    };

    window.addEventListener('suno-favorites-updated', syncFavorites);
    window.addEventListener('storage', syncFavorites);
    return () => {
      window.removeEventListener('suno-favorites-updated', syncFavorites);
      window.removeEventListener('storage', syncFavorites);
    };
  }, []);

  const handleToggleLang = () => {
    const nextLang: Language = lang === 'km' ? 'en' : 'km';
    setLang(nextLang);
    localStorage.setItem(STORAGE_KEY_LANG, nextLang);
  };

  const handleSaveMeHandle = (newHandle: string) => {
    const clean = newHandle.trim().replace(/^@/, '');
    setMeHandle(clean);
    try {
      localStorage.setItem(STORAGE_KEY_ME_HANDLE, clean);
    } catch {}
    setIsMeModalOpen(false);
    setUrl('https://suno.com/me');
    handleFetch('https://suno.com/me');
  };

  const handleFetch = async (targetUrl?: string) => {
    const queryUrl = (targetUrl || url).trim();
    if (!queryUrl) return;

    const hasSongUuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(queryUrl);

    // Check if it's suno.com/create, suno.com/create?wid=default, /create, create, etc.
    const isCreateQuery =
      !hasSongUuid &&
      (queryUrl.includes('suno.com/create') ||
       queryUrl.includes('create?wid=') ||
       /^https?:\/\/[^\/]+\/create\b/i.test(queryUrl) ||
       queryUrl.toLowerCase() === 'create' ||
       queryUrl.toLowerCase() === '/create' ||
       queryUrl.toLowerCase().startsWith('create?') ||
       queryUrl.toLowerCase().startsWith('/create?'));

    // Check if it's suno.com/me or /me or me or me/playlists or suno.com/create
    const isMeQuery =
      !hasSongUuid &&
      (queryUrl.includes('suno.com/me') ||
       /^https?:\/\/[^\/]+\/me\b/i.test(queryUrl) ||
       queryUrl.toLowerCase() === 'me' ||
       queryUrl.toLowerCase() === '/me' ||
       queryUrl.toLowerCase().includes('me/playlists') ||
       isCreateQuery);

    const isMePlaylists =
      queryUrl.includes('/me/playlists') ||
      queryUrl.includes('me/playlists') ||
      (isMeQuery && (queryUrl.includes('playlists') || queryUrl.includes('page=playlists')));

    setIsLastFetchMe(isMeQuery && !isCreateQuery);
    setIsLastFetchCreate(isCreateQuery);
    setIsLoading(true);
    setError(null);

    try {
      // Check if it's suno.com/me or suno.com/me/playlists
      if (isMeQuery) {
        const effectiveHandle = meHandle.trim() || 'musicsabay';
        const queryHandle = isMePlaylists ? `${effectiveHandle}?page=playlists` : effectiveHandle;

        const res = await fetch(
          `/api/creator/playlist?handle=${encodeURIComponent(queryHandle)}&myHandle=${encodeURIComponent(effectiveHandle)}`
        );
        const data = await res.json();

        if (res.ok && data.success && data.profile) {
          setProfile(data.profile);
          if (data.playlist) setPlaylist(data.playlist);
          if (isMePlaylists && data.playlist) {
            setActiveView('playlist');
          } else {
            setActiveView('profile');
          }
          return;
        }

        const fallbackRes = await fetch(
          `/api/profile?handle=${encodeURIComponent(queryHandle)}&myHandle=${encodeURIComponent(effectiveHandle)}`
        );
        const fallbackData = await fallbackRes.json();
        if (!fallbackRes.ok || !fallbackData.success || !fallbackData.profile) {
          throw new Error(fallbackData.error || t.errorFetch);
        }
        setProfile(fallbackData.profile);
        if (isMePlaylists && fallbackData.playlist) {
          setPlaylist(fallbackData.playlist);
          setActiveView('playlist');
        } else {
          setActiveView('profile');
        }
        return;
      }

      // Check if it's explicitly or implicitly a playlist URL
      const isPlaylist =
        queryUrl.includes('suno.com/playlist/') ||
        /^https?:\/\/[^\/]+\/playlist\//.test(queryUrl) ||
        /^playlist\//.test(queryUrl);

      if (isPlaylist) {
        const res = await fetch(`/api/playlist?url=${encodeURIComponent(queryUrl)}`);
        const data = await res.json();
        if (!res.ok || !data.success || !data.playlist) {
          throw new Error(data.error || t.errorFetch);
        }
        setPlaylist(data.playlist);
        setActiveView('playlist');
        return;
      }

      // Check if it's explicitly or implicitly a profile handle/URL or playlists page
      const isProfile =
        queryUrl.startsWith('@') ||
        queryUrl.includes('suno.com/@') ||
        queryUrl.includes('page=playlists') ||
        /^https?:\/\/[^\/]+\/@/.test(queryUrl);

      if (isProfile) {
        // Fetch creator profile and any playlists
        const res = await fetch(`/api/creator/playlist?handle=${encodeURIComponent(queryUrl)}`);
        const data = await res.json();

        if (res.ok && data.success && data.profile) {
          setProfile(data.profile);
          if (data.playlist) setPlaylist(data.playlist);
          // If query requested page=playlists or if creator has an automatic playlist, open playlist view!
          if (
            (queryUrl.includes('page=playlists') ||
              queryUrl.includes('ps_music_english') ||
              data.isPlaylist) &&
            data.playlist
          ) {
            setActiveView('playlist');
          } else {
            setActiveView('profile');
          }
          return;
        }

        // Fallback to basic profile fetch
        const fallbackRes = await fetch(`/api/profile?handle=${encodeURIComponent(queryUrl)}`);
        const fallbackData = await fallbackRes.json();
        if (!fallbackRes.ok || !fallbackData.success || !fallbackData.profile) {
          throw new Error(fallbackData.error || t.errorFetch);
        }
        setProfile(fallbackData.profile);
        setActiveView('profile');
        return;
      } else {
        const res = await fetch(`/api/song/info?url=${encodeURIComponent(queryUrl)}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || t.errorFetch);
        }

        // Auto-handled playlist redirection from API
        if (data.isPlaylist && data.playlist) {
          setPlaylist(data.playlist);
          setActiveView('playlist');
          return;
        }

        // Auto-handled profile redirection from API
        if (data.isProfile && data.profile) {
          setProfile(data.profile);
          setActiveView('profile');
          return;
        }

        if (!data.song) {
          throw new Error(data.error || t.errorFetch);
        }

        setSong(data.song);
        setActiveView('song');

        // Add to history
        const newHistoryItem: CachedHistoryItem = {
          id: data.song.id,
          title: data.song.title,
          displayName: data.song.displayName,
          imageUrl: data.song.imageUrl,
          duration: data.song.duration,
          sourceUrl: queryUrl,
          savedAt: Date.now()
        };

        setHistory((prev) => {
          const filtered = prev.filter((item) => item.id !== data.song.id);
          const updated = [newHistoryItem, ...filtered].slice(0, 12);
          try {
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || t.errorFetch);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSongFromPlaylist = (songId: string) => {
    setUrl(songId);
    handleFetch(songId);
  };

  const handleSelectSongFromProfile = (songId: string) => {
    setUrl(songId);
    handleFetch(songId);
  };

  const handleSelectProfileFromSong = async (handle: string) => {
    const cleanHandle = handle.replace(/^@/, '');
    const profileUrl = `https://suno.com/@${cleanHandle}`;
    setUrl(profileUrl);

    setIsLoading(true);
    setError(null);
    try {
      // Auto-search creator's playlist directly
      const res = await fetch(`/api/creator/playlist?handle=${encodeURIComponent(cleanHandle)}`);
      const data = await res.json();

      if (res.ok && data.success && data.profile) {
        setProfile(data.profile);
        if (data.playlist) setPlaylist(data.playlist);
        setActiveView('profile');
        return;
      }

      // Fallback
      await handleFetch(profileUrl);
    } catch (err: any) {
      console.warn('Auto search playlist note:', err?.message);
      await handleFetch(profileUrl);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlaylistFromProfile = async (playlistId: string) => {
    const playlistUrl = `https://suno.com/playlist/${playlistId}`;
    setUrl(playlistUrl);
    await handleFetch(playlistUrl);
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
    } catch {}
  };

  const handleClearFavorites = () => {
    setFavorites([]);
    try {
      localStorage.removeItem(STORAGE_KEY_FAVORITES);
      localStorage.removeItem('suno_downloader_favorites');
      window.dispatchEvent(new Event('suno-favorites-updated'));
    } catch {}
  };

  const handleToggleFavorite = (targetId: string, isFav?: boolean) => {
    setFavorites((prev) => {
      let updated: FavoriteSongItem[];
      const exists = prev.some((item) => item.id === targetId);
      if (exists) {
        updated = prev.filter((item) => item.id !== targetId);
      } else if (song && song.id === targetId) {
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
        updated = [newItem, ...prev];
      } else {
        updated = prev;
      }
      try {
        localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(updated));
        localStorage.setItem('suno_downloader_favorites', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Eagerly load initial song/playlist on mount (supports ?url=... or defaults)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const initialParam = searchParams.get('url') || searchParams.get('q');
      if (initialParam) {
        setUrl(initialParam);
        handleFetch(initialParam);
        return;
      }
    } catch {}
    handleFetch(DEFAULT_SONG_URL);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      <Navbar 
        lang={lang} 
        onToggleLang={handleToggleLang} 
        onOpenBloggerEmbed={() => setIsBloggerModalOpen(true)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col items-center">
        {/* Hero title */}
        <div className="text-center max-w-2xl mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-3">
            Suno <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300 bg-clip-text text-transparent">MP3 & WAV</span>
          </h1>
          <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">
            {lang === 'km'
              ? 'ទាញយកបទចម្រៀង ឬស្វែងរកតាម Profile Suno ដោយដោះកូដ DRM ស្វ័យប្រវត្តិ ជា MP3 320kbps និង WAV Studio'
              : 'Download Suno AI songs or explore creator profiles with DRM decryption in 320kbps MP3 and studio WAV'}
          </p>
        </div>

        {/* Sticky Search & Paste Input Bar - Locked in Place */}
        <div
          id="sticky-search-container"
          className={`w-full max-w-4xl mx-auto z-40 transition-all duration-200 ${
            isBarLocked
              ? 'sticky top-16 py-2.5 sm:py-3 bg-neutral-950/95 backdrop-blur-md border-b border-neutral-800/80 shadow-2xl shadow-black/80'
              : 'relative mb-4'
          }`}
        >
          <SearchBarInput
            url={url}
            setUrl={setUrl}
            onFetch={handleFetch}
            isLoading={isLoading}
            lang={lang}
            isLocked={isBarLocked}
            onToggleLock={handleToggleBarLock}
          />
        </div>

        {/* Supported Models & Smart Sample Links Hub */}
        <div className="w-full max-w-4xl mx-auto mb-8 space-y-4">
          <SearchBarSamples
            url={url}
            setUrl={setUrl}
            onFetch={handleFetch}
            isLoading={isLoading}
            lang={lang}
            meHandle={meHandle}
            onOpenMeConfig={() => setIsMeModalOpen(true)}
          />
        </div>

        {/* Error Notification */}
        {error && (
          <div className="w-full max-w-4xl mx-auto mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && !song && !profile && !playlist && (
          <div className="w-full max-w-4xl mx-auto bg-neutral-900/40 border border-neutral-800 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[300px]">
            <Disc3 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
            <p className="text-sm text-neutral-400 font-medium">{t.fetching}</p>
            <p className="text-xs text-neutral-600 mt-1">Connecting to Suno Server...</p>
          </div>
        )}

        {/* Playlist View */}
        {activeView === 'playlist' && playlist && (
          <div className="w-full">
            <PlaylistView
              playlist={playlist}
              onSelectSong={handleSelectSongFromPlaylist}
              onSelectProfile={handleSelectProfileFromSong}
              onBack={
                profile
                  ? () => setActiveView('profile')
                  : song
                  ? () => setActiveView('song')
                  : undefined
              }
              lang={lang}
            />
          </div>
        )}

        {/* Profile View */}
        {activeView === 'profile' && profile && (
          <div className="w-full">
            <ProfileView
              profile={profile}
              onSelectSong={handleSelectSongFromProfile}
              onSelectPlaylist={handleSelectPlaylistFromProfile}
              onBack={
                playlist
                  ? () => setActiveView('playlist')
                  : song
                  ? () => setActiveView('song')
                  : undefined
              }
              lang={lang}
              isMeProfile={isLastFetchMe || (!isLastFetchCreate && !!meHandle && profile.handle.toLowerCase() === meHandle.toLowerCase())}
              isCreateWorkspace={isLastFetchCreate}
              onOpenMeConfig={() => setIsMeModalOpen(true)}
            />
          </div>
        )}

        {/* Active Song Presentation */}
        {activeView === 'song' && song && (
          <div className="w-full">
            <SongCard
              song={song}
              lang={lang}
              onSelectProfile={handleSelectProfileFromSong}
              onBackToPlaylist={playlist ? () => setActiveView('playlist') : undefined}
              playlistName={playlist?.name}
              isFavorite={favorites.some((item) => item.id === song.id)}
              onToggleFavorite={(id, isFav) => handleToggleFavorite(id, isFav)}
            />
          </div>
        )}

        {/* Recent History & Favorites */}
        <RecentHistory
          history={history}
          favorites={favorites}
          onSelectSong={(item) => {
            setUrl(item.sourceUrl);
            handleFetch(item.sourceUrl);
          }}
          onClearHistory={handleClearHistory}
          onClearFavorites={handleClearFavorites}
          onToggleFavorite={(id) => handleToggleFavorite(id)}
          lang={lang}
        />

        {/* Features Info Box */}
        <FeaturesInfo lang={lang} />
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800/80 py-6 text-center text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            Suno Audio Downloader • Supports{' '}
            <span className="text-neutral-400 font-mono">Songs, Playlists & Profiles (@Creator)</span>
          </p>
          <p className="text-neutral-600">
            Powered by Suno Mango Rights Pipeline & FFmpeg Transcoding
          </p>
        </div>
      </footer>

      {/* Blogger Embed Code Modal */}
      <BloggerEmbedModal
        isOpen={isBloggerModalOpen}
        onClose={() => setIsBloggerModalOpen(false)}
        lang={lang}
      />

      {/* Suno.com/me Personal Handle Configuration Modal */}
      <MeConfigModal
        isOpen={isMeModalOpen}
        onClose={() => setIsMeModalOpen(false)}
        currentHandle={meHandle}
        onSave={handleSaveMeHandle}
        lang={lang}
      />
    </div>
  );
}

export default App;

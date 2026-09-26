import React, { useState, useEffect } from 'react';
import {
  History,
  Trash2,
  Check,
  FolderArchive,
  ArrowUpRight,
  CheckSquare,
  X,
  Heart,
  Music,
  ListPlus,
  Plus,
  Download,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Clock,
  FileAudio,
  Loader2,
  Sparkles
} from 'lucide-react';
import type { CachedHistoryItem, FavoriteSongItem, AudioFormat, QueueItem, DownloadedArchiveItem } from '../types.js';
import type { Language } from '../i18n.js';
import { translations } from '../i18n.js';
import { downloadBatchZipViaForm } from '../utils/downloadHelper.js';
import {
  getZipDownloadHistory,
  recordZipDownload,
  removeZipDownload,
  clearZipDownloadHistory
} from '../utils/zipHistoryStorage.js';
import { ModelBadge } from './ModelBadge.js';

interface RecentHistoryProps {
  history: CachedHistoryItem[];
  favorites?: FavoriteSongItem[];
  onSelectSong: (item: CachedHistoryItem | FavoriteSongItem) => void;
  onClearHistory: () => void;
  onClearFavorites?: () => void;
  onToggleFavorite?: (songId: string) => void;
  onAddToQueue?: (item: CachedHistoryItem | FavoriteSongItem) => void;
  onAddMultipleToQueue?: (items: (CachedHistoryItem | FavoriteSongItem)[]) => void;
  onOpenQueueManager?: () => void;
  queueIds?: string[];
  lang: Language;
}

export const RecentHistory: React.FC<RecentHistoryProps> = ({
  history,
  favorites = [],
  onSelectSong,
  onClearHistory,
  onClearFavorites,
  onToggleFavorite,
  onAddToQueue,
  onAddMultipleToQueue,
  onOpenQueueManager,
  queueIds = [],
  lang
}) => {
  const t = translations[lang];

  // ZIP Download History state
  const [downloadHistory, setDownloadHistory] = useState<DownloadedArchiveItem[]>(() =>
    getZipDownloadHistory()
  );
  const [downloadingArchiveId, setDownloadingArchiveId] = useState<string | null>(null);
  const [expandedArchiveIds, setExpandedArchiveIds] = useState<string[]>([]);

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'history' | 'favorites' | 'downloads'>(() => {
    if (history.length > 0) return 'history';
    if (favorites.length > 0) return 'favorites';
    return 'downloads';
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [queueAddedToast, setQueueAddedToast] = useState<string | null>(null);

  // Sync ZIP history across tabs or whenever new downloads occur
  useEffect(() => {
    const handleUpdate = () => {
      setDownloadHistory(getZipDownloadHistory());
    };
    window.addEventListener('suno-zip-history-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('suno-zip-history-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const showToast = (msg: string) => {
    setQueueAddedToast(msg);
    setTimeout(() => setQueueAddedToast(null), 3000);
  };

  // If all lists are empty, render nothing
  if (history.length === 0 && favorites.length === 0 && downloadHistory.length === 0) {
    return null;
  }

  const currentList = activeTab === 'history' ? history : favorites;
  const allSelected = currentList.length > 0 && selectedIds.length === currentList.length;

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentList.map((h) => h.id));
    }
  };

  const handleBatchZip = async (format: AudioFormat | 'both' = 'mp3') => {
    if (selectedIds.length === 0) return;
    setIsDownloading(true);

    const archiveName = activeTab === 'history' ? 'Recent_History' : 'Favorites';
    const selectedSongs = currentList
      .filter((h) => selectedIds.includes(h.id))
      .map((s) => ({ id: s.id, title: s.title, displayName: s.displayName }));

    try {
      downloadBatchZipViaForm('/api/songs/batch-zip', {
        songs: selectedSongs,
        format,
        name: archiveName
      });

      // Record in Download History
      recordZipDownload({
        name: archiveName,
        format,
        songs: selectedSongs,
        source: activeTab === 'history' ? 'history' : 'favorites'
      });

      showToast(lang === 'km' ? 'បានបង្កើត និងទាញយកកញ្ចប់ ZIP ដោយជោគជ័យ!' : 'ZIP archive generated & saved to Download History!');
    } catch (err: any) {
      console.warn('Batch zip note:', err?.message);
    } finally {
      setTimeout(() => {
        setIsDownloading(false);
      }, 2000);
    }
  };

  // Trigger 'Download Again' for a previously downloaded archive
  const handleDownloadAgain = (archive: DownloadedArchiveItem) => {
    setDownloadingArchiveId(archive.id);
    showToast(t.downloadingAgain);

    try {
      downloadBatchZipViaForm('/api/songs/batch-zip', {
        songs: archive.songs.map((s) => ({
          id: s.id,
          title: s.title,
          artist: s.artist || s.displayName
        })),
        format: archive.format,
        bitDepth: archive.bitDepth || 16,
        name: archive.name
      });

      // Re-record to refresh timestamp to top of history
      recordZipDownload({
        name: archive.name,
        format: archive.format,
        bitDepth: archive.bitDepth,
        songs: archive.songs,
        source: archive.source || 'batch',
        fileSizeApprox: archive.fileSizeApprox
      });
    } catch (err: any) {
      console.warn('Download again note:', err);
    } finally {
      setTimeout(() => {
        setDownloadingArchiveId(null);
      }, 2000);
    }
  };

  const handleRemoveArchive = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    removeZipDownload(id);
    setDownloadHistory((prev) => prev.filter((a) => a.id !== id));
  };

  const handleClearAllDownloads = () => {
    clearZipDownloadHistory();
    setDownloadHistory([]);
  };

  const toggleExpandArchive = (id: string) => {
    setExpandedArchiveIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: number) => {
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) {
      return lang === 'km' ? 'មុននេះបន្តិច' : 'Just now';
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      return lang === 'km' ? `${diffMin} នាទីមុន` : `${diffMin}m ago`;
    }
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
      return lang === 'km' ? `${diffHours} ម៉ោងមុន` : `${diffHours}h ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      return lang === 'km' ? `${diffDays} ថ្ងៃមុន` : `${diffDays}d ago`;
    }
    const date = new Date(timestamp);
    return date.toLocaleDateString(lang === 'km' ? 'km-KH' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-10 mb-8">
      {/* Header with Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-900/90 border border-neutral-800/90 rounded-2xl shadow-inner">
          {/* Tab 1: Recent History */}
          <button
            type="button"
            id="history-tab-btn"
            onClick={() => {
              setActiveTab('history');
              setSelectedIds([]);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{t.historyTab}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'history'
                  ? 'bg-neutral-950/20 text-neutral-950 font-bold'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {history.length}
            </span>
          </button>

          {/* Tab 2: Favorites */}
          <button
            type="button"
            id="favorites-tab-btn"
            onClick={() => {
              setActiveTab('favorites');
              setSelectedIds([]);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'favorites'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Heart
              className={`w-3.5 h-3.5 ${
                activeTab === 'favorites' ? 'fill-white text-white' : 'text-rose-400'
              }`}
            />
            <span>{t.favoritesTab}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'favorites'
                  ? 'bg-black/30 text-white font-bold'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {favorites.length}
            </span>
          </button>

          {/* Tab 3: Download History (ZIP Archives) */}
          <button
            type="button"
            id="download-history-tab-btn"
            onClick={() => {
              setActiveTab('downloads');
              setSelectedIds([]);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'downloads'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-neutral-950 shadow-md shadow-emerald-500/20 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>{t.downloadHistoryTab}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'downloads'
                  ? 'bg-neutral-950/20 text-neutral-950 font-bold'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {downloadHistory.length}
            </span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {activeTab !== 'downloads' && (
            <>
              {/* Quick Add All to Queue */}
              {currentList.length > 0 && onAddMultipleToQueue && (
                <button
                  type="button"
                  id={`${activeTab}-add-all-queue-btn`}
                  onClick={() => {
                    onAddMultipleToQueue(currentList);
                    showToast(
                      activeTab === 'history'
                        ? `Added all ${currentList.length} history songs to queue`
                        : `Added all ${currentList.length} favorite songs to queue`
                    );
                  }}
                  className="text-xs px-2.5 py-1 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-amber-300 border border-neutral-800 hover:border-amber-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Add all to Download Queue"
                >
                  <ListPlus className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">
                    {activeTab === 'history'
                      ? t.addAllHistoryToQueue.replace('{count}', String(currentList.length))
                      : t.addAllFavoritesToQueue.replace('{count}', String(currentList.length))}
                  </span>
                  <span className="sm:hidden">Queue All</span>
                </button>
              )}

              {currentList.length > 0 && (
                <>
                  {/* Toggle Select Mode */}
                  <button
                    type="button"
                    id="toggle-history-select-mode-btn"
                    onClick={() => {
                      setIsSelectMode(!isSelectMode);
                      if (isSelectMode) setSelectedIds([]);
                    }}
                    className={`text-xs px-2.5 py-1 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelectMode
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-medium'
                        : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border-neutral-800'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{isSelectMode ? t.deselectAll : t.selectSongs}</span>
                  </button>

                  {isSelectMode && currentList.length > 1 && (
                    <button
                      type="button"
                      id="history-select-all-btn"
                      onClick={handleToggleSelectAll}
                      className="text-xs px-2.5 py-1 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 transition-colors cursor-pointer"
                    >
                      {allSelected ? t.deselectAll : t.selectAll}
                    </button>
                  )}
                </>
              )}

              {activeTab === 'history' && history.length > 0 && (
                <button
                  type="button"
                  id="clear-history-btn"
                  onClick={onClearHistory}
                  className="text-xs text-neutral-500 hover:text-rose-400 flex items-center gap-1 transition-colors px-2 py-1 cursor-pointer"
                  title={t.clearHistory}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.clearHistory}</span>
                </button>
              )}

              {activeTab === 'favorites' && favorites.length > 0 && onClearFavorites && (
                <button
                  type="button"
                  id="clear-favorites-btn"
                  onClick={onClearFavorites}
                  className="text-xs text-neutral-500 hover:text-rose-400 flex items-center gap-1 transition-colors px-2 py-1 cursor-pointer"
                  title={t.clearFavorites}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.clearFavorites}</span>
                </button>
              )}
            </>
          )}

          {/* Controls for Download History Tab */}
          {activeTab === 'downloads' && downloadHistory.length > 0 && (
            <button
              type="button"
              id="clear-download-history-btn"
              onClick={handleClearAllDownloads}
              className="text-xs text-neutral-500 hover:text-rose-400 flex items-center gap-1 transition-colors px-2.5 py-1 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-rose-500/30 cursor-pointer"
              title={t.clearDownloadHistory}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.clearDownloadHistory}</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Alert Notification */}
      {queueAddedToast && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-amber-400" />
            <span>{queueAddedToast}</span>
          </div>
          {onOpenQueueManager && (
            <button
              type="button"
              onClick={onOpenQueueManager}
              className="underline hover:text-white font-bold cursor-pointer"
            >
              {t.openQueue}
            </button>
          )}
        </div>
      )}

      {/* Batch Download Action Bar for History / Favorites */}
      {activeTab !== 'downloads' && isSelectMode && selectedIds.length > 0 && (
        <div className="mb-4 p-3 rounded-2xl bg-neutral-900 border border-amber-500/40 flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
            <CheckSquare className="w-4 h-4" />
            <span>{t.selectedSongsCount.replace('{count}', String(selectedIds.length))}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onAddMultipleToQueue && (
              <button
                type="button"
                id="history-batch-add-queue-btn"
                onClick={() => {
                  const selectedSongs = currentList.filter((h) => selectedIds.includes(h.id));
                  onAddMultipleToQueue(selectedSongs);
                  showToast(`Added ${selectedSongs.length} songs to Download Queue!`);
                }}
                className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-xs font-bold flex items-center gap-1.5 border border-neutral-700 hover:border-amber-500/50 shadow-sm transition-all cursor-pointer"
                title="Add selected songs to Download Queue"
              >
                <ListPlus className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.addSelectedToQueue.replace('{count}', String(selectedIds.length))}</span>
              </button>
            )}

            <button
              type="button"
              id="history-batch-both-btn"
              onClick={() => handleBatchZip('both')}
              disabled={isDownloading}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-sky-400 hover:opacity-90 text-neutral-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              title="Download MP3 + WAV with original titles"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>{isDownloading ? '...' : t.downloadBatchZipBoth}</span>
            </button>

            <button
              type="button"
              id="history-batch-mp3-btn"
              onClick={() => handleBatchZip('mp3')}
              disabled={isDownloading}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>{isDownloading ? t.preparingZip : t.batchDownloadMp3Zip}</span>
            </button>

            <button
              type="button"
              id="history-batch-wav-btn"
              onClick={() => handleBatchZip('wav')}
              disabled={isDownloading}
              className="px-3 py-1.5 rounded-xl bg-sky-950 hover:bg-sky-900 border border-sky-500/30 text-sky-300 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <FolderArchive className="w-3.5 h-3.5 text-sky-400" />
              <span>WAV ZIP</span>
            </button>

            <button
              type="button"
              id="cancel-history-selection-btn"
              onClick={() => setSelectedIds([])}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white cursor-pointer"
              title={t.deselectAll}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1 & 2 CONTENT: SONG LIST FOR HISTORY & FAVORITES     */}
      {/* ======================================================== */}
      {activeTab !== 'downloads' && (
        <>
          {/* Empty State for Favorites */}
          {activeTab === 'favorites' && favorites.length === 0 && (
            <div className="w-full p-8 rounded-3xl bg-neutral-900/40 border border-neutral-800 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3">
                <Heart className="w-6 h-6 text-rose-400" />
              </div>
              <h4 className="text-sm font-semibold text-neutral-200 mb-1">{t.favoritesTitle}</h4>
              <p className="text-xs text-neutral-500 max-w-sm">{t.noFavorites}</p>
            </div>
          )}

          {/* Empty State for History */}
          {activeTab === 'history' && history.length === 0 && (
            <div className="w-full p-8 rounded-3xl bg-neutral-900/40 border border-neutral-800 text-center flex flex-col items-center justify-center">
              <History className="w-6 h-6 text-neutral-600 mb-2" />
              <p className="text-xs text-neutral-500">{t.noHistory}</p>
            </div>
          )}

          {/* Grid of Songs */}
          {currentList.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentList.map((item) => {
                const isSelected = selectedIds.includes(item.id);

                return (
                  <div
                    key={item.id}
                    id={`${activeTab}-item-${item.id}`}
                    onClick={() => {
                      if (isSelectMode) {
                        toggleSelect(item.id);
                      } else {
                        onSelectSong(item);
                      }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer group shadow-md relative ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                        : 'bg-neutral-900/60 hover:bg-neutral-900 border-neutral-800 hover:border-amber-500/40'
                    }`}
                  >
                    {/* Checkbox (visible in select mode) */}
                    {isSelectMode && (
                      <button
                        type="button"
                        id={`${activeTab}-checkbox-${item.id}`}
                        onClick={(e) => toggleSelect(item.id, e)}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? 'bg-amber-500 border-amber-500 text-neutral-950 shadow-sm'
                            : 'border-neutral-700 bg-neutral-950 text-transparent hover:border-amber-400'
                        }`}
                        aria-label={`Select ${item.title}`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    )}

                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-neutral-950 relative border border-neutral-800">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4
                          className={`text-xs font-semibold truncate transition-colors ${
                            isSelected ? 'text-amber-300' : 'text-neutral-200 group-hover:text-amber-400'
                          }`}
                        >
                          {item.title}
                        </h4>
                        {item.modelName && (
                          <ModelBadge modelName={item.modelName} size="xs" />
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 truncate">{item.displayName}</p>
                      <span className="text-[10px] font-mono text-neutral-600">
                        {formatDuration(item.duration)}
                      </span>
                    </div>

                    {/* Favorite toggle directly in row when in favorites tab */}
                    {activeTab === 'favorites' && onToggleFavorite && !isSelectMode && (
                      <button
                        type="button"
                        id={`unfavorite-item-${item.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(item.id);
                        }}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-all shrink-0 cursor-pointer"
                        title={t.removeFromFavorites}
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}

                    {/* Quick Add to Queue button */}
                    {onAddToQueue && !isSelectMode && (
                      <button
                        type="button"
                        id={`queue-item-btn-${item.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToQueue(item);
                          showToast(`"${item.title.slice(0, 20)}..." added to queue!`);
                        }}
                        className={`p-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${
                          queueIds.includes(item.id)
                            ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
                            : 'text-neutral-500 hover:text-amber-400 hover:bg-neutral-800 border border-transparent'
                        }`}
                        title={queueIds.includes(item.id) ? t.inQueue : t.addToQueue}
                      >
                        {queueIds.includes(item.id) ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <ListPlus className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    {!isSelectMode && activeTab === 'history' && (
                      <ArrowUpRight className="w-4 h-4 text-neutral-600 group-hover:text-amber-400 transition-colors shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* TAB 3 CONTENT: DOWNLOAD HISTORY (ZIP ARCHIVES)           */}
      {/* ======================================================== */}
      {activeTab === 'downloads' && (
        <div id="download-history-section" className="space-y-3">
          {/* Empty State */}
          {downloadHistory.length === 0 && (
            <div className="w-full p-8 rounded-3xl bg-neutral-900/40 border border-neutral-800 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3 text-emerald-400">
                <FolderArchive className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-neutral-200 mb-1">{t.noDownloadHistory}</h4>
              <p className="text-xs text-neutral-500 max-w-md leading-relaxed">
                {t.noDownloadHistoryDesc}
              </p>
            </div>
          )}

          {/* List of Downloaded ZIP Archives */}
          {downloadHistory.length > 0 && (
            <div className="grid grid-cols-1 gap-3">
              {downloadHistory.map((archive) => {
                const isDownloadingThis = downloadingArchiveId === archive.id;
                const isExpanded = expandedArchiveIds.includes(archive.id);

                return (
                  <div
                    key={archive.id}
                    id={`download-archive-${archive.id}`}
                    className="p-4 rounded-2xl bg-neutral-900/80 hover:bg-neutral-900 border border-neutral-800 hover:border-emerald-500/40 transition-all shadow-md group relative"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Icon, Archive Name, and Metadata Badges */}
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-neutral-950 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 shadow-inner">
                          <FolderArchive className="w-5 h-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-neutral-100 group-hover:text-emerald-300 transition-colors truncate">
                              {archive.name}
                            </h4>

                            {/* Format Badge */}
                            {archive.format === 'both' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-gradient-to-r from-amber-500 to-sky-400 text-neutral-950">
                                MP3 + WAV Dual
                              </span>
                            ) : archive.format === 'wav' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                {archive.bitDepth === 24 ? '24b Master WAV' : '16b Lossless WAV'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                320k MP3
                              </span>
                            )}

                            {/* Source Badge if present */}
                            {archive.source && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono uppercase bg-neutral-800 text-neutral-400 border border-neutral-700">
                                {archive.source}
                              </span>
                            )}
                          </div>

                          {/* Secondary Meta Row */}
                          <div className="flex items-center gap-2.5 text-xs text-neutral-500 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Music className="w-3 h-3 text-neutral-400" />
                              <span className="font-semibold text-neutral-300">
                                {archive.songCount} {archive.songCount === 1 ? 'track' : 'tracks'}
                              </span>
                            </span>

                            <span>•</span>

                            <span className="font-mono text-neutral-400">
                              {archive.fileSizeApprox}
                            </span>

                            <span>•</span>

                            <span className="flex items-center gap-1 text-[11px] text-neutral-500">
                              <Clock className="w-3 h-3" />
                              <span>{formatTimestamp(archive.downloadedAt)}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions ('Download Again' & Delete) */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {/* Toggle Song Preview Button */}
                        {archive.songs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpandArchive(archive.id)}
                            className="px-2 py-1 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                            title="Inspect tracks inside this archive"
                          >
                            <span>Tracks</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {/* Download Again Button */}
                        <button
                          type="button"
                          id={`download-again-btn-${archive.id}`}
                          onClick={() => handleDownloadAgain(archive)}
                          disabled={isDownloadingThis}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                          title="Re-download this entire ZIP archive"
                        >
                          {isDownloadingThis ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>{t.downloadingAgain}</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>{t.downloadAgain}</span>
                            </>
                          )}
                        </button>

                        {/* Remove from history button */}
                        <button
                          type="button"
                          id={`delete-archive-btn-${archive.id}`}
                          onClick={(e) => handleRemoveArchive(archive.id, e)}
                          className="p-1.5 rounded-xl text-neutral-600 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                          title={t.deleteArchiveRecord}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Track List Preview */}
                    {isExpanded && archive.songs.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-neutral-800/80">
                        <div className="text-[11px] font-semibold text-neutral-400 mb-2 flex items-center justify-between">
                          <span>Tracks in Archive:</span>
                          <span className="font-mono text-neutral-500 text-[10px]">
                            {archive.songs.length} total
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                          {archive.songs.map((song, sIdx) => (
                            <div
                              key={`${archive.id}-song-${sIdx}-${song.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-neutral-950/80 border border-neutral-800/80 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[10px] text-neutral-500 w-4">
                                  {sIdx + 1}.
                                </span>
                                <span className="text-neutral-300 font-medium truncate">
                                  {song.title}
                                </span>
                              </div>
                              {song.artist && (
                                <span className="text-[10px] text-neutral-500 shrink-0 truncate max-w-[100px]">
                                  {song.artist}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

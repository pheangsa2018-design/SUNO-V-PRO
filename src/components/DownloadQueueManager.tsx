import React, { useState } from 'react';
import {
  FolderArchive,
  Trash2,
  X,
  Play,
  Download,
  ListPlus,
  Heart,
  History,
  CheckCircle2,
  HardDrive,
  Clock,
  Sparkles,
  FileAudio,
  Check
} from 'lucide-react';
import type { QueueItem } from '../types.js';
import type { Language } from '../i18n.js';
import { translations } from '../i18n.js';
import { downloadBatchZipViaForm } from '../utils/downloadHelper.js';
import { recordZipDownload } from '../utils/zipHistoryStorage.js';
import { ModelBadge } from './ModelBadge.js';

export type QueueArchiveFormat = 'mp3' | 'wav16' | 'wav24' | 'both';

interface DownloadQueueManagerProps {
  queue: QueueItem[];
  isOpen: boolean;
  onClose: () => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  onAddFromHistory?: () => void;
  onAddFromFavorites?: () => void;
  historyCount?: number;
  favoritesCount?: number;
  lang: Language;
  onSelectSong?: (songId: string) => void;
}

export const DownloadQueueManager: React.FC<DownloadQueueManagerProps> = ({
  queue,
  isOpen,
  onClose,
  onRemoveItem,
  onClearQueue,
  onAddFromHistory,
  onAddFromFavorites,
  historyCount = 0,
  favoritesCount = 0,
  lang,
  onSelectSong
}) => {
  const t = translations[lang];

  const [archiveFormat, setArchiveFormat] = useState<QueueArchiveFormat>('mp3');
  const [archiveName, setArchiveName] = useState('Suno_Batch_Queue');
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isSequentialDownloading, setIsSequentialDownloading] = useState(false);
  const [sequentialProgress, setSequentialProgress] = useState<{ current: number; total: number; title: string } | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate total duration in seconds
  const totalSeconds = queue.reduce((acc, item) => acc + (item.duration || 180), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalRemainingSecs = Math.floor(totalSeconds % 60);
  const formattedTotalDuration = `${totalMinutes}:${totalRemainingSecs.toString().padStart(2, '0')}`;

  // Estimate file size based on format and total duration
  const getEstimatedSize = (): string => {
    if (queue.length === 0) return '0 MB';
    let bytesPerSecond = 40 * 1024; // MP3 320kbps (~40 KB/s)
    if (archiveFormat === 'wav16') {
      bytesPerSecond = 176.4 * 1024; // 16-bit 44.1kHz stereo (~176.4 KB/s)
    } else if (archiveFormat === 'wav24') {
      bytesPerSecond = 288 * 1024; // 24-bit 48kHz stereo (~288 KB/s)
    } else if (archiveFormat === 'both') {
      bytesPerSecond = (40 + 176.4) * 1024; // MP3 + 16-bit WAV
    }
    const totalBytes = bytesPerSecond * totalSeconds;
    const mb = totalBytes / (1024 * 1024);
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${Math.round(mb)} MB`;
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // 1. Single Compressed ZIP Download
  const handleDownloadZipArchive = async () => {
    if (queue.length === 0 || isDownloadingZip || isSequentialDownloading) return;
    setIsDownloadingZip(true);
    setDownloadError(null);
    setDownloadSuccess(false);

    const safeArchiveName = (archiveName.trim() || 'Suno_Batch_Queue')
      .replace(/[:]/g, ' - ')
      .replace(/[<>"/\\|?*\x00-\x1F]/g, '_')
      .trim();

    const formatForApi: 'mp3' | 'wav' | 'both' =
      archiveFormat === 'both' ? 'both' : archiveFormat.startsWith('wav') ? 'wav' : 'mp3';
    const bitDepth: 16 | 24 = archiveFormat === 'wav24' ? 24 : 16;

    const formatTag =
      archiveFormat === 'both'
        ? 'MP3+WAV'
        : archiveFormat === 'wav24'
        ? 'WAV_24bit'
        : archiveFormat === 'wav16'
        ? 'WAV_16bit'
        : 'MP3';

    const filename = `${safeArchiveName}.zip`;

    try {
      const queueSongs = queue.map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.displayName || s.handle
      }));

      downloadBatchZipViaForm('/api/songs/batch-zip', {
        songs: queueSongs,
        format: formatForApi,
        bitDepth,
        name: safeArchiveName
      });

      recordZipDownload({
        name: safeArchiveName,
        format: formatForApi,
        bitDepth,
        songs: queueSongs,
        source: 'queue'
      });

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 6000);
    } catch (err: any) {
      console.error('ZIP generation error:', err);
      setDownloadError(err?.message || 'Failed to download ZIP archive');
    } finally {
      setTimeout(() => {
        setIsDownloadingZip(false);
      }, 2500);
    }
  };

  // 2. Sequential Individual Downloads
  const handleSequentialDownload = async () => {
    if (queue.length === 0 || isDownloadingZip || isSequentialDownloading) return;
    setIsSequentialDownloading(true);
    setDownloadError(null);
    setDownloadSuccess(false);

    const formatForApi: 'mp3' | 'wav' = archiveFormat.startsWith('wav') ? 'wav' : 'mp3';
    const bitDepth = archiveFormat === 'wav24' ? 24 : 16;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      setSequentialProgress({
        current: i + 1,
        total: queue.length,
        title: item.title
      });

      const downloadUrl =
        formatForApi === 'wav'
          ? `/api/song/download/${item.id}?format=wav&bitDepth=${bitDepth}`
          : `/api/song/download/${item.id}?format=mp3`;

      const cleanTitle = (item.title || 'Suno_Song')
        .replace(/[:]/g, ' - ')
        .replace(/[<>"/\\|?*\x00-\x1F]/g, '_')
        .trim();
      const artist = (item.displayName || item.handle || 'Suno')
        .replace(/[:]/g, ' - ')
        .replace(/[<>"/\\|?*\x00-\x1F]/g, '_')
        .trim();
      const bitDepthTag = formatForApi === 'wav' ? (bitDepth === 24 ? ' [24-bit Studio]' : ' [16-bit Lossless]') : '';
      const filename = `${cleanTitle} - ${artist}${bitDepthTag}.${formatForApi}`;

      try {
        const res = await fetch(downloadUrl);
        if (res.ok) {
          const blob = await res.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
        }
      } catch (e) {
        console.warn('Failed sequential song:', item.id, e);
      }

      // Small pacing pause between downloads
      await new Promise((r) => setTimeout(r, 600));
    }

    setIsSequentialDownloading(false);
    setSequentialProgress(null);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 5000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800/80 bg-neutral-900/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 p-[1px] shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-neutral-950 rounded-[15px] flex items-center justify-center">
                <FolderArchive className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white font-sans">
                  {t.queueTitle}
                </h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {queue.length}
                </span>
              </div>
              <p className="text-xs text-neutral-400 line-clamp-1">{t.queueSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <button
                type="button"
                id="queue-clear-btn"
                onClick={onClearQueue}
                className="text-xs text-neutral-500 hover:text-rose-400 transition-colors flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-neutral-800 hover:border-rose-500/30 cursor-pointer"
                title={t.clearQueue}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.clearQueue}</span>
              </button>
            )}

            <button
              type="button"
              id="queue-close-btn"
              onClick={onClose}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Add Presets Bar (History / Favorites shortcuts) */}
        {(historyCount > 0 || favoritesCount > 0) && (
          <div className="px-4 py-2.5 bg-neutral-900/40 border-b border-neutral-800/60 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1">
              <ListPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>Quick Add:</span>
            </span>

            {historyCount > 0 && onAddFromHistory && (
              <button
                type="button"
                id="queue-add-all-history-btn"
                onClick={onAddFromHistory}
                className="text-xs px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:border-amber-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <History className="w-3 h-3 text-amber-400" />
                <span>{t.addAllHistoryToQueue.replace('{count}', String(historyCount))}</span>
              </button>
            )}

            {favoritesCount > 0 && onAddFromFavorites && (
              <button
                type="button"
                id="queue-add-all-favorites-btn"
                onClick={onAddFromFavorites}
                className="text-xs px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:border-rose-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Heart className="w-3 h-3 text-rose-400 fill-rose-400/20" />
                <span>{t.addAllFavoritesToQueue.replace('{count}', String(favoritesCount))}</span>
              </button>
            )}
          </div>
        )}

        {/* Body Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Empty State */}
          {queue.length === 0 ? (
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/20">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
                <FolderArchive className="w-7 h-7 text-amber-400" />
              </div>
              <h4 className="text-sm sm:text-base font-bold text-white mb-1.5">{t.emptyQueue}</h4>
              <p className="text-xs text-neutral-400 max-w-sm mb-4">{t.emptyQueueDesc}</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {historyCount > 0 && onAddFromHistory && (
                  <button
                    type="button"
                    onClick={onAddFromHistory}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{t.addAllHistoryToQueue.replace('{count}', String(historyCount))}</span>
                  </button>
                )}
                {favoritesCount > 0 && onAddFromFavorites && (
                  <button
                    type="button"
                    onClick={onAddFromFavorites}
                    className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-rose-500/20 cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 fill-white" />
                    <span>{t.addAllFavoritesToQueue.replace('{count}', String(favoritesCount))}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Queue Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-500">
                    {t.playlistTracks} ({queue.length})
                  </span>
                  <span className="font-mono text-[11px] flex items-center gap-1 text-neutral-400">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>{formattedTotalDuration}</span>
                  </span>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {queue.map((item, index) => (
                    <div
                      key={item.id}
                      id={`queue-item-${item.id}`}
                      className="group flex items-center gap-3 p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 hover:border-amber-500/30 transition-all"
                    >
                      <span className="font-mono text-[11px] text-neutral-600 w-5 text-center shrink-0">
                        {String(index + 1).padStart(2, '0')}
                      </span>

                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-950 border border-neutral-800">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h5 className="text-xs font-semibold text-neutral-200 truncate group-hover:text-amber-400 transition-colors">
                            {item.title}
                          </h5>
                          {item.modelName && (
                            <ModelBadge modelName={item.modelName} size="xs" />
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500 truncate">{item.displayName}</p>
                      </div>

                      <span className="text-[10px] font-mono text-neutral-500 shrink-0">
                        {formatDuration(item.duration)}
                      </span>

                      {/* Play preview trigger */}
                      {onSelectSong && (
                        <button
                          type="button"
                          id={`queue-play-${item.id}`}
                          onClick={() => {
                            onSelectSong(item.id);
                            onClose();
                          }}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                          title="Open & Play"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                      )}

                      {/* Remove single track */}
                      <button
                        type="button"
                        id={`queue-remove-${item.id}`}
                        onClick={() => onRemoveItem(item.id)}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                        title={t.removeFromQueue}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Archive Settings Card */}
              <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
                  <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                    <FolderArchive className="w-4 h-4 text-amber-400" />
                    {t.archiveSettings}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full font-mono font-medium">
                    <HardDrive className="w-3 h-3" />
                    <span>{t.estimatedSize}: {getEstimatedSize()}</span>
                  </div>
                </div>

                {/* Archive Name Input */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1.5">
                    {t.archiveName}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="queue-archive-name-input"
                      value={archiveName}
                      onChange={(e) => setArchiveName(e.target.value)}
                      placeholder="e.g. My_Suno_Collection"
                      className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-neutral-100 placeholder-neutral-600 outline-none transition-colors"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setArchiveName('Suno_Favorites_Archive')}
                        className="text-[10px] px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                      >
                        Favorites
                      </button>
                      <button
                        type="button"
                        onClick={() => setArchiveName('Suno_History_Archive')}
                        className="text-[10px] px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                      >
                        History
                      </button>
                    </div>
                  </div>
                </div>

                {/* Archive Format Radio Selection */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-2">
                    {t.archiveFormat}
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Option 1: MP3 320k */}
                    <button
                      type="button"
                      id="queue-format-mp3-btn"
                      onClick={() => setArchiveFormat('mp3')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                        archiveFormat === 'mp3'
                          ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                          : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <FileAudio className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-xs font-bold text-neutral-200">MP3 (320 kbps)</span>
                        </div>
                        {archiveFormat === 'mp3' && (
                          <span className="w-4 h-4 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400 line-clamp-1">{t.formatMp3Desc}</p>
                    </button>

                    {/* Option 2: WAV 16-bit Red Book Universal */}
                    <button
                      type="button"
                      id="queue-format-wav16-btn"
                      onClick={() => setArchiveFormat('wav16')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                        archiveFormat === 'wav16'
                          ? 'bg-sky-500/10 border-sky-500/50 ring-1 ring-sky-500/30'
                          : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <FileAudio className="w-3.5 h-3.5 text-sky-400" />
                          <span className="text-xs font-bold text-neutral-200">WAV (16-bit 44.1k)</span>
                        </div>
                        {archiveFormat === 'wav16' && (
                          <span className="w-4 h-4 rounded-full bg-sky-400 text-neutral-950 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400 line-clamp-1">{t.formatWav16Desc}</p>
                    </button>

                    {/* Option 3: WAV 24-bit DAW */}
                    <button
                      type="button"
                      id="queue-format-wav24-btn"
                      onClick={() => setArchiveFormat('wav24')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                        archiveFormat === 'wav24'
                          ? 'bg-purple-500/10 border-purple-500/50 ring-1 ring-purple-500/30'
                          : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <FileAudio className="w-3.5 h-3.5 text-purple-400" />
                          <span className="text-xs font-bold text-neutral-200">WAV (24-bit 48k DAW)</span>
                        </div>
                        {archiveFormat === 'wav24' && (
                          <span className="w-4 h-4 rounded-full bg-purple-400 text-neutral-950 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400 line-clamp-1">{t.formatWav24Desc}</p>
                    </button>

                    {/* Option 4: MP3 + WAV Dual Bundle */}
                    <button
                      type="button"
                      id="queue-format-both-btn"
                      onClick={() => setArchiveFormat('both')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                        archiveFormat === 'both'
                          ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30'
                          : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <FolderArchive className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-xs font-bold text-neutral-200">Dual (MP3 + WAV)</span>
                        </div>
                        {archiveFormat === 'both' && (
                          <span className="w-4 h-4 rounded-full bg-emerald-400 text-neutral-950 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400 line-clamp-1">{t.formatBothDesc}</p>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Sequential progress indicator */}
          {isSequentialDownloading && sequentialProgress && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-300">
                  {t.batchDownloadingStatus
                    .replace('{current}', String(sequentialProgress.current))
                    .replace('{total}', String(sequentialProgress.total))
                    .replace('{title}', sequentialProgress.title)}
                </span>
                <span className="font-mono text-amber-400">
                  {Math.round((sequentialProgress.current / sequentialProgress.total) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                  style={{ width: `${(sequentialProgress.current / sequentialProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Active ZIP Packaging Spinner Feedback */}
          {isDownloadingZip && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 animate-in fade-in">
              <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-300">{t.compressingZip}</p>
                <p className="text-[10px] text-neutral-400">
                  Transcoding audio, preserving Khmer Unicode titles, packing into single ZIP...
                </p>
              </div>
            </div>
          )}

          {/* Success message */}
          {downloadSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-emerald-300 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{t.downloadComplete}</span>
            </div>
          )}

          {/* Error message */}
          {downloadError && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-rose-300 text-xs animate-in fade-in">
              <X className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{downloadError}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {queue.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-neutral-800/80 bg-neutral-900/70 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-neutral-400">
              <span className="font-semibold text-white font-mono">{queue.length}</span> songs in queue •{' '}
              <span className="text-amber-400 font-mono">{getEstimatedSize()}</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                id="queue-sequential-download-btn"
                onClick={handleSequentialDownload}
                disabled={isDownloadingZip || isSequentialDownloading}
                className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                title="Download each song individually"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.downloadQueueSequential.replace('{count}', String(queue.length))}</span>
              </button>

              <button
                type="button"
                id="queue-download-zip-btn"
                onClick={handleDownloadZipArchive}
                disabled={isDownloadingZip || isSequentialDownloading}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:opacity-95 text-neutral-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isDownloadingZip ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-neutral-950 border-t-transparent animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <FolderArchive className="w-4 h-4" />
                    <span>{t.downloadQueueZip.replace('{count}', String(queue.length))}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

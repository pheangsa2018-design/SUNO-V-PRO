import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderArchive,
  Music2,
  FileAudio,
  Check,
  X,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  Settings,
  ExternalLink,
  Trash2
} from 'lucide-react';
import type { ProfileSongItem, AudioFormat } from '../types.js';
import type { Language } from '../i18n.js';
import { translations } from '../i18n.js';
import { calculateRemainingTime } from '../utils/timeEstimator.js';

export interface BatchDownloadProgress {
  percent: number;
  current?: number;
  total?: number;
  currentTitle?: string;
  currentStep: string;
  receivedMb?: string;
  status: 'idle' | 'queued' | 'processing' | 'streaming' | 'ready' | 'error' | 'cancelled';
  downloadUrl?: string;
  error?: string;
}

interface BatchDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlistName: string;
  selectedSongs: ProfileSongItem[];
  defaultFormat?: AudioFormat | 'both';
  defaultBitDepth?: 16 | 24;
  onRemoveSong: (songId: string) => void;
  onDownload: (options: {
    songs: ProfileSongItem[];
    format: AudioFormat | 'both';
    bitDepth: 16 | 24;
    customName: string;
    mode: 'direct' | 'async';
  }) => Promise<void>;
  isDownloading: boolean;
  progress: BatchDownloadProgress;
  onCancelDownload?: () => void;
  lang: Language;
}

export const BatchDownloadModal: React.FC<BatchDownloadModalProps> = ({
  isOpen,
  onClose,
  playlistName,
  selectedSongs,
  defaultFormat = 'mp3',
  defaultBitDepth = 16,
  onRemoveSong,
  onDownload,
  isDownloading,
  progress,
  onCancelDownload,
  lang
}) => {
  const t = translations[lang];

  const [chosenFormat, setChosenFormat] = useState<AudioFormat | 'both'>(defaultFormat);
  const [chosenBitDepth, setChosenBitDepth] = useState<16 | 24>(defaultBitDepth);
  const [downloadMode, setDownloadMode] = useState<'direct' | 'async'>('direct');
  const [customZipName, setCustomZipName] = useState(() => {
    const base = playlistName || 'Playlist';
    return `${base} - ${selectedSongs.length} Tracks`;
  });
  const [showTrackList, setShowTrackList] = useState(false);
  const [downloadStartTime, setDownloadStartTime] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const isCompleted = progress.status === 'ready';
  const isError = progress.status === 'error';
  const isBusy = isDownloading || progress.status === 'processing' || progress.status === 'streaming' || progress.status === 'queued';

  // Sync format and custom name when modal opens or songs change
  useEffect(() => {
    if (isOpen) {
      setChosenFormat(defaultFormat);
      setChosenBitDepth(defaultBitDepth);
      const base = playlistName || 'Playlist';
      setCustomZipName(`${base} - ${selectedSongs.length} Tracks`);
    }
  }, [isOpen, playlistName, selectedSongs.length]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDownloading && onCancelDownload) {
          onCancelDownload();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDownloading, onClose, onCancelDownload]);

  // Track start time and set up a 1-second ticker for live ETA recalculation
  useEffect(() => {
    if (isBusy) {
      if (!downloadStartTime) {
        setDownloadStartTime(Date.now());
      }
      const timer = setInterval(() => setTick((prev) => prev + 1), 1000);
      return () => clearInterval(timer);
    } else {
      setDownloadStartTime(null);
    }
  }, [isBusy]);

  const remainingTimeStr = useMemo(() => {
    if (!isBusy || !downloadStartTime) return null;
    return calculateRemainingTime(downloadStartTime, progress.percent, t, lang);
  }, [isBusy, downloadStartTime, progress.percent, t, lang]);

  if (!isOpen) return null;

  const formatDuration = (seconds?: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const totalSecs = Math.floor(seconds);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const count = selectedSongs.length;
  const estMp3Mb = Math.max(1, Math.round(count * 3.8));
  const estWavMb = Math.max(1, Math.round(count * (chosenBitDepth === 24 ? 64 : 42)));
  const estBothMb = estMp3Mb + estWavMb;

  const currentEstMb =
    chosenFormat === 'both' ? estBothMb : chosenFormat === 'wav' ? estWavMb : estMp3Mb;

  const handleStart = () => {
    if (count === 0 || isDownloading) return;
    onDownload({
      songs: selectedSongs,
      format: chosenFormat,
      bitDepth: chosenBitDepth,
      customName: customZipName.trim() || `${playlistName || 'Playlist'} - ${count} Tracks`,
      mode: downloadMode
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200 cursor-pointer"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) {
          onClose();
        }
      }}
    >
      <div
        id="batch-download-modal"
        onClick={(e) => e.stopPropagation()}
        className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden text-neutral-100 cursor-default my-auto max-h-[92vh] flex flex-col"
      >
        {/* Glow ambient backgrounds */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-neutral-800/80 shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-md shadow-amber-500/10">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                  {lang === 'km' ? 'ទាញយកជាកញ្ចប់ ZIP' : 'BATCH ZIP DOWNLOAD'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 text-[10px] font-mono border border-neutral-700">
                  {count} {lang === 'km' ? 'បទ' : count === 1 ? 'track' : 'tracks'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                {lang === 'km'
                  ? 'ទាញយកបទចម្រៀងដែលបានជ្រើសជាកញ្ចប់ ZIP'
                  : 'Download Selected Tracks as ZIP'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            id="close-batch-modal-btn"
            onClick={isBusy && onCancelDownload ? onCancelDownload : onClose}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
            title={isBusy ? (lang === 'km' ? 'បញ្ឈប់ការទាញយក' : 'Cancel Download') : (lang === 'km' ? 'បិទ' : 'Close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 relative z-10">
          {/* Progress / Processing Banner when active */}
          {isBusy && (
            <div className="p-4 rounded-2xl bg-neutral-950/90 border border-amber-500/40 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-neutral-100">
                      {progress.status === 'streaming'
                        ? (lang === 'km' ? 'កំពុងបង្កើត និងទាញយកកញ្ចប់ ZIP...' : 'Streaming ZIP archive directly...')
                        : (lang === 'km' ? 'កំពុងរៀបចំ និងបំលែងសម្លេង...' : 'Packaging audio files into ZIP...')}
                    </h4>
                    <p className="text-[11px] text-neutral-400 truncate max-w-xs sm:max-w-md">
                      {progress.currentStep || (lang === 'km' ? 'កំពុងតភ្ជាប់...' : 'Connecting...')}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xl font-black font-mono text-amber-400">
                    {progress.percent}%
                  </span>
                  {progress.receivedMb && (
                    <p className="text-[10px] font-mono text-neutral-400">
                      {progress.receivedMb} MB
                    </p>
                  )}
                </div>
              </div>

              {/* Enhanced Visual Progress Bar Container */}
              <div className="space-y-2">
                <div className="w-full h-3 bg-neutral-950 rounded-full overflow-hidden p-0.5 border border-neutral-700/70 shadow-inner">
                  <div
                    id="batch-modal-progress-bar-fill"
                    role="progressbar"
                    aria-valuenow={progress.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-300 rounded-full transition-all duration-300 shadow-md shadow-amber-500/50"
                    style={{ width: `${Math.max(4, Math.min(100, progress.percent))}%` }}
                  />
                </div>

                {/* Remaining Time & Real-time ETA Stats */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  {/* Remaining Time Estimate */}
                  <div
                    id="batch-remaining-time-badge"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-mono font-medium shadow-sm"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                    <span>
                      <span className="text-neutral-400 font-sans text-[11px] mr-1">
                        {t.remainingTime || (lang === 'km' ? 'ពេលវេលានៅសល់:' : 'Remaining Time:')}:
                      </span>
                      <strong className="text-amber-300 font-bold">{remainingTimeStr}</strong>
                    </span>
                  </div>

                  {progress.current && progress.total && (
                    <div className="text-[11px] font-mono text-neutral-400 flex items-center gap-1.5">
                      <span>{progress.current} of {progress.total} tracks</span>
                    </div>
                  )}
                </div>
              </div>

              {progress.currentTitle && (
                <div className="text-[11px] text-neutral-400 flex items-center justify-between bg-neutral-900/60 px-3 py-1.5 rounded-xl border border-neutral-800">
                  <span className="truncate max-w-[280px]">
                    <span className="text-neutral-500">{lang === 'km' ? 'បទបច្ចុប្បន្ន៖ ' : 'Current: '}</span>
                    <strong className="text-neutral-200">{progress.currentTitle}</strong>
                  </span>
                  <span className="text-[10px] text-amber-400/90 font-mono">
                    {progress.receivedMb ? `${progress.receivedMb} MB` : ''}
                  </span>
                </div>
              )}

              {onCancelDownload && (
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={onCancelDownload}
                    className="px-3 py-1 rounded-lg text-[11px] font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {lang === 'km' ? 'បញ្ឈប់ (Cancel)' : 'Cancel packaging'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Success Banner */}
          {isCompleted && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-neutral-200 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>
                  {lang === 'km'
                    ? '✓ បានបង្កើត និងទាញយកកញ្ចប់ ZIP ដោយជោគជ័យ!'
                    : '✓ ZIP Archive Generated & Downloaded Successfully!'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-300">
                {lang === 'km'
                  ? 'ឯកសារ ZIP ត្រូវបានបញ្ជូនទៅកាន់កម្មវិធីទាញយកនៃ Browser របស់អ្នក។ ប្រសិនបើការទាញយកមិនទាន់ចាប់ផ្តើម សូមចុចប៊ូតុងខាងក្រោម៖'
                  : 'The ZIP package was sent to your browser download manager. If it did not auto-start, click below:'}
              </p>
              {progress.downloadUrl && (
                <a
                  href={progress.downloadUrl}
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-neutral-950 text-xs font-bold hover:bg-emerald-400 transition-colors shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{lang === 'km' ? 'ទាញយកឯកសារ ZIP ម្តងទៀត' : 'Download ZIP File Again'}</span>
                </a>
              )}
            </div>
          )}

          {/* Error Banner */}
          {isError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-rose-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                <span>{lang === 'km' ? 'បញ្ហាក្នុងការទាញយក' : 'Download Error'}</span>
              </div>
              <p className="text-[11px] text-neutral-300">
                {progress.error || (lang === 'km' ? 'មិនអាចបង្កើតកញ្ចប់ ZIP បានទេ។' : 'Failed to create ZIP package.')}
              </p>
            </div>
          )}

          {/* Format Selection Cards */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-300 flex items-center justify-between">
              <span>{lang === 'km' ? 'ជ្រើសរើសទម្រង់សម្លេង (Audio Quality):' : 'Select Audio Format & Quality:'}</span>
              <span className="text-[11px] font-mono text-amber-400 font-bold">
                ~{currentEstMb} MB {lang === 'km' ? 'សរុប' : 'total'}
              </span>
            </label>

            {/* Option 1: MP3 320kbps */}
            <button
              type="button"
              id="batch-opt-mp3"
              disabled={isBusy}
              onClick={() => setChosenFormat('mp3')}
              className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                chosenFormat === 'mp3'
                  ? 'bg-amber-500/15 border-amber-500/80 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/50'
                  : 'bg-neutral-950/70 hover:bg-neutral-800/80 border-neutral-800 hover:border-neutral-700'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <div
                className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 transition-colors ${
                  chosenFormat === 'mp3'
                    ? 'border-amber-400 bg-amber-400 text-neutral-950'
                    : 'border-neutral-600'
                }`}
              >
                {chosenFormat === 'mp3' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                    <Music2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t.formatHighMp3Title}</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 shrink-0">
                    ~{estMp3Mb} MB
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  {t.formatHighMp3Desc}
                </p>
              </div>
            </button>

            {/* Option 2: Lossless WAV */}
            <div
              className={`p-3 rounded-2xl border transition-all ${
                chosenFormat === 'wav'
                  ? 'bg-sky-500/15 border-sky-500/80 shadow-md shadow-sky-500/10 ring-1 ring-sky-400/50'
                  : 'bg-neutral-950/70 hover:bg-neutral-800/80 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <button
                type="button"
                id="batch-opt-wav"
                disabled={isBusy}
                onClick={() => setChosenFormat('wav')}
                className="w-full text-left cursor-pointer flex items-start gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div
                  className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 transition-colors ${
                    chosenFormat === 'wav'
                      ? 'border-sky-400 bg-sky-400 text-neutral-950'
                      : 'border-neutral-600'
                  }`}
                >
                  {chosenFormat === 'wav' && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                      <FileAudio className="w-3.5 h-3.5 text-sky-400" />
                      <span>{t.formatLosslessWavTitle}</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 shrink-0">
                      ~{estWavMb} MB
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    {t.formatLosslessWavDesc}
                  </p>
                </div>
              </button>

              {/* Bit Depth Sub-Selector */}
              <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px]">
                <span className="text-neutral-400 font-medium">
                  {lang === 'km' ? 'កម្រិតប៊ីត (Bit Depth):' : 'Bit Depth:'}
                </span>
                <div className="flex items-center gap-1 p-0.5 bg-neutral-950 rounded-lg border border-neutral-800">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      setChosenBitDepth(16);
                      setChosenFormat('wav');
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                      chosenBitDepth === 16 && chosenFormat === 'wav'
                        ? 'bg-sky-500 text-neutral-950'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    16-bit Lossless (Universal)
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      setChosenBitDepth(24);
                      setChosenFormat('wav');
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                      chosenBitDepth === 24 && chosenFormat === 'wav'
                        ? 'bg-sky-500 text-neutral-950'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    24-bit Studio Master
                  </button>
                </div>
              </div>
            </div>

            {/* Option 3: Both MP3 + WAV */}
            <button
              type="button"
              id="batch-opt-both"
              disabled={isBusy}
              onClick={() => setChosenFormat('both')}
              className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                chosenFormat === 'both'
                  ? 'bg-purple-500/15 border-purple-500/80 shadow-md shadow-purple-500/10 ring-1 ring-purple-400/50'
                  : 'bg-neutral-950/70 hover:bg-neutral-800/80 border-neutral-800 hover:border-neutral-700'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <div
                className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 transition-colors ${
                  chosenFormat === 'both'
                    ? 'border-purple-400 bg-purple-400 text-neutral-950'
                    : 'border-neutral-600'
                }`}
              >
                {chosenFormat === 'both' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                    <FolderArchive className="w-3.5 h-3.5 text-purple-400" />
                    <span>{t.formatBothTitle}</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 shrink-0">
                    ~{estBothMb} MB
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  {t.formatBothDesc}
                </p>
              </div>
            </button>
          </div>

          {/* Custom ZIP Package Filename */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 block">
              {lang === 'km' ? 'ឈ្មោះឯកសារកញ្ចប់ ZIP (Archive Name):' : 'ZIP Archive Filename:'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                id="batch-custom-zip-name-input"
                disabled={isBusy}
                value={customZipName}
                onChange={(e) => setCustomZipName(e.target.value)}
                placeholder="My_Playlist_Batch"
                className="flex-1 px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-amber-500 text-xs font-mono text-neutral-200 outline-none transition-colors"
              />
              <span className="px-2 py-2 rounded-xl bg-neutral-800 text-neutral-400 text-xs font-mono border border-neutral-700">
                .zip
              </span>
            </div>
          </div>

          {/* Download Method Toggle */}
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-neutral-950 border border-neutral-800/80 text-xs">
            <span className="text-neutral-400 font-medium">
              {lang === 'km' ? 'របៀបទាញយក (Download Mode):' : 'Packaging Mode:'}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setDownloadMode('direct')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  downloadMode === 'direct'
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Fast streaming directly into browser downloads"
              >
                {lang === 'km' ? 'ទាញយកផ្ទាល់ (Direct Stream)' : 'Direct Stream'}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setDownloadMode('async')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  downloadMode === 'async'
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Monitored packaging with live percentage"
              >
                {lang === 'km' ? 'តាមដានជំហាន (Tracked)' : 'Tracked Queue'}
              </button>
            </div>
          </div>

          {/* Collapsible Track List Preview */}
          <div className="border border-neutral-800/80 rounded-2xl overflow-hidden bg-neutral-950/60">
            <button
              type="button"
              onClick={() => setShowTrackList((prev) => !prev)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs text-neutral-300 hover:bg-neutral-800/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold">
                  {lang === 'km' ? 'ពិនិត្យបញ្ជីបទដែលបានជ្រើស' : 'Review Selected Tracks'} ({count})
                </span>
              </div>
              <span className="text-[11px] text-amber-400 font-mono">
                {showTrackList ? (lang === 'km' ? 'លាក់' : 'Hide') : (lang === 'km' ? 'បង្ហាញ' : 'Show')}
              </span>
            </button>

            {showTrackList && (
              <div className="divide-y divide-neutral-800/60 max-h-48 overflow-y-auto p-1">
                {selectedSongs.map((song, idx) => (
                  <div
                    key={song.id}
                    className="p-2 flex items-center justify-between gap-2 hover:bg-neutral-900/60 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 text-[11px] font-mono text-neutral-500 text-center shrink-0">
                        {idx + 1}
                      </span>
                      {song.imageUrl && (
                        <img
                          src={song.imageUrl}
                          alt={song.title}
                          className="w-7 h-7 rounded-lg object-cover shrink-0 border border-neutral-800"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-neutral-200 truncate">
                          {song.title}
                        </p>
                        <p className="text-[10px] text-neutral-500 truncate">
                          {formatDuration(song.duration)}
                        </p>
                      </div>
                    </div>

                    {!isBusy && (
                      <button
                        type="button"
                        onClick={() => onRemoveSong(song.id)}
                        className="p-1 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                        title={lang === 'km' ? 'ដកបទនេះចេញ' : 'Remove from batch'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="pt-4 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 relative z-10">
          <div className="text-xs font-mono text-neutral-400">
            <span>{lang === 'km' ? 'កញ្ចប់៖ ' : 'Package: '}</span>
            <strong className="text-amber-400 font-bold">
              {count} {lang === 'km' ? 'បទ' : 'tracks'} (~{currentEstMb} MB)
            </strong>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={isBusy}
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {lang === 'km' ? 'បោះបង់' : 'Cancel'}
            </button>

            <button
              type="button"
              id="start-batch-zip-btn"
              disabled={count === 0 || isBusy}
              onClick={handleStart}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:brightness-105 active:scale-95 text-neutral-950 text-xs sm:text-sm font-extrabold shadow-lg shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
                  <span>
                    {progress.percent > 0
                      ? `${lang === 'km' ? 'កំពុងបង្កើត' : 'Zipping'} ${progress.percent}%`
                      : (lang === 'km' ? 'កំពុងតភ្ជាប់...' : 'Packaging...')}
                  </span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    {lang === 'km'
                      ? `ទាញយកកញ្ចប់ ZIP (${count} បទ)`
                      : `Download ZIP Archive (${count})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

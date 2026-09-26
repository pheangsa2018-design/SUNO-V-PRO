import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderArchive,
  Disc3,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Music,
  FileAudio,
  Sparkles,
  RefreshCw,
  Clock
} from 'lucide-react';
import type { AsyncZipJobStatus, AudioFormat } from '../types.js';
import type { Language } from '../i18n.js';
import { translations } from '../i18n.js';
import { calculateRemainingTime } from '../utils/timeEstimator.js';

interface AsyncZipModalProps {
  isOpen: boolean;
  job: AsyncZipJobStatus | null;
  playlistName: string;
  totalSongs: number;
  format: AudioFormat | 'both';
  onCancel: () => void;
  onClose: () => void;
  onRetry?: () => void;
  lang: Language;
}

export const AsyncZipModal: React.FC<AsyncZipModalProps> = ({
  isOpen,
  job,
  playlistName,
  totalSongs,
  format,
  onCancel,
  onClose,
  onRetry,
  lang
}) => {
  const isProcessing = job?.status === 'queued' || job?.status === 'processing';
  const isReady = job?.status === 'ready';
  const isError = job?.status === 'error';
  const isCancelled = job?.status === 'cancelled';

  const [jobStartTime, setJobStartTime] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (isProcessing) {
      if (!jobStartTime) {
        setJobStartTime(Date.now());
      }
      const timer = setInterval(() => setTick((t) => t + 1), 1000);
      return () => clearInterval(timer);
    } else {
      setJobStartTime(null);
    }
  }, [isProcessing]);

  const remainingTimeStr = useMemo(() => {
    if (!isProcessing || !jobStartTime) return null;
    return calculateRemainingTime(jobStartTime, job?.percent ?? 0, translations[lang], lang);
  }, [isProcessing, jobStartTime, job?.percent, lang]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isProcessing) {
          onCancel();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onCancel, onClose]);

  if (!isOpen) return null;

  const t = translations[lang];

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatLabel =
    format === 'both' ? 'MP3 (320k) + WAV (Lossless)' : format === 'wav' ? 'Lossless WAV (16-bit)' : 'MP3 (320kbps)';

  const downloadUrl = job?.id ? `/api/playlist/download-all/file/${job.id}` : '#';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (isProcessing) {
            onCancel();
          } else {
            onClose();
          }
        }
      }}
    >
      <div
        id="async-zip-modal"
        onClick={(e) => e.stopPropagation()}
        className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative overflow-hidden text-neutral-100 cursor-default"
      >
        {/* Top ambient glow */}
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-56 h-56 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-semibold border border-amber-500/30 flex items-center gap-1">
                <FolderArchive className="w-3 h-3" />
                <span>{t.downloadAll}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 text-[11px] font-mono border border-neutral-700/60">
                {formatLabel}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight truncate max-w-sm">
              {playlistName || 'Suno Playlist'}
            </h3>
          </div>

          <button
            type="button"
            id="close-async-zip-modal-btn"
            onClick={isProcessing ? onCancel : onClose}
            className="p-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            title={isProcessing ? t.asyncZipCancelButton : t.asyncZipCloseButton}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Processing State */}
        {isProcessing && (
          <div className="space-y-5 relative z-10 py-2">
            {/* Circular / Disc graphic & percentage */}
            <div className="flex items-center justify-between bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Disc3 className="w-6 h-6 text-amber-400 animate-spin" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-neutral-400 font-medium">
                    {lang === 'km' ? 'ដំណើរការ Asynchronous កំពុងដំណើរការ' : 'Asynchronous Packaging Engine'}
                  </p>
                  <p className="text-sm font-semibold text-neutral-100 truncate">
                    {t.asyncZipStatusProcessing}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 flex flex-col items-end">
                <span className="text-2xl font-black text-amber-400 font-mono leading-none">
                  {job?.percent ?? 0}%
                </span>
                {remainingTimeStr && (
                  <span className="text-[10px] font-mono text-amber-300/90 flex items-center gap-1 mt-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    <Clock className="w-3 h-3 text-amber-400 animate-pulse shrink-0" />
                    <span>{remainingTimeStr}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Progress Bar Container with Live ETA */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-400 font-medium">
                  {job?.total ? (
                    t.asyncZipProgressItem
                      .replace('{current}', String(job.current))
                      .replace('{total}', String(job.total))
                      .replace('{title}', '')
                      .replace('៖', '')
                      .replace(':', '')
                      .trim()
                  ) : (
                    <span>
                      {job?.current ?? 0} / {totalSongs}
                    </span>
                  )}
                </span>
                <span className="text-neutral-500 text-[11px] font-mono">
                  {job?.current ?? 0}/{job?.total ?? totalSongs} tracks
                </span>
              </div>

              <div className="w-full bg-neutral-950 rounded-full h-3 overflow-hidden p-0.5 border border-neutral-700/60 shadow-inner">
                <div
                  id="async-zip-progress-bar-fill"
                  role="progressbar"
                  aria-valuenow={job?.percent ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 h-full rounded-full transition-all duration-300 shadow-sm shadow-amber-500/50"
                  style={{ width: `${Math.max(job?.percent ?? 0, 4)}%` }}
                />
              </div>

              {/* Remaining Time Badge */}
              {remainingTimeStr && (
                <div
                  id="async-zip-remaining-time-badge"
                  className="flex items-center justify-between text-xs pt-0.5"
                >
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-mono font-medium shadow-sm">
                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                    <span>
                      <strong className="text-neutral-400 font-sans text-[10px] mr-1">
                        {t.remainingTime || (lang === 'km' ? 'ពេលវេលានៅសល់:' : 'Remaining Time:')}:
                      </strong>
                      {remainingTimeStr}
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Current Song Details */}
            <div className="bg-neutral-950/50 border border-neutral-800 rounded-xl p-3 flex items-start gap-2.5">
              <Music className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-neutral-200 truncate">
                  {job?.currentTitle || (lang === 'km' ? 'កំពុងត្រៀម...' : 'Preparing tracks...')}
                </p>
                <p className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                  <span className="truncate">{job?.currentStep || t.asyncZipStatusProcessing}</span>
                </p>
              </div>
            </div>

            {/* Explanation Tip */}
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              {t.downloadAllDesc}
            </p>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-800/80">
              <button
                type="button"
                id="cancel-async-zip-btn"
                onClick={onCancel}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                {t.asyncZipCancelButton}
              </button>
            </div>
          </div>
        )}

        {/* Ready State */}
        {isReady && (
          <div className="space-y-5 relative z-10 py-2">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-emerald-300">
                  {t.asyncZipStatusReady}
                </h4>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {t.asyncZipDownloadAuto}
                </p>
              </div>
            </div>

            {/* File Info Card */}
            <div className="bg-neutral-950/60 border border-neutral-800 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center text-neutral-400">
                <span>{lang === 'km' ? 'ឈ្មោះឯកសារ' : 'Filename'}:</span>
                <span className="text-neutral-200 font-mono font-medium truncate max-w-[240px]">
                  {job?.zipFilenameUnicode || 'Playlist.zip'}
                </span>
              </div>
              <div className="flex justify-between items-center text-neutral-400">
                <span>{t.asyncZipSize}:</span>
                <span className="text-amber-400 font-mono font-semibold">
                  {formatBytes(job?.zipSize)}
                </span>
              </div>
              <div className="flex justify-between items-center text-neutral-400">
                <span>{t.totalTracks}:</span>
                <span className="text-neutral-200 font-semibold">{job?.total || totalSongs} tracks</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
              <a
                id="direct-download-zip-btn"
                href={downloadUrl}
                download={job?.zipFilenameUnicode || 'Playlist.zip'}
                className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-extrabold text-sm transition-all shadow-lg shadow-amber-500/25 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t.asyncZipDownloadButton}</span>
              </a>

              <button
                type="button"
                id="close-completed-async-zip-btn"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                {t.asyncZipCloseButton}
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="space-y-4 relative z-10 py-2">
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-rose-300">
                  {t.asyncZipStatusError}
                </h4>
                <p className="text-xs text-neutral-400 mt-1">
                  {job?.error || t.errorFetch}
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              {onRetry && (
                <button
                  type="button"
                  id="retry-async-zip-btn"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{lang === 'km' ? 'ព្យាយាមម្តងទៀត' : 'Retry'}</span>
                </button>
              )}
              <button
                type="button"
                id="close-error-async-zip-btn"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors cursor-pointer"
              >
                {t.asyncZipCloseButton}
              </button>
            </div>
          </div>
        )}

        {/* Cancelled State */}
        {isCancelled && (
          <div className="space-y-4 relative z-10 py-2">
            <div className="bg-neutral-800/80 border border-neutral-700 rounded-2xl p-4 flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-400" />
              <div>
                <h4 className="text-sm font-semibold text-neutral-200">
                  {t.asyncZipStatusCancelled}
                </h4>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {lang === 'km'
                    ? 'អ្នកបានបញ្ឈប់ដំណើរការបង្កើតកញ្ចប់ ZIP'
                    : 'The background packaging process was halted.'}
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              {onRetry && (
                <button
                  type="button"
                  id="restart-cancelled-async-zip-btn"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{lang === 'km' ? 'ចាប់ផ្តើមឡើងវិញ' : 'Restart'}</span>
                </button>
              )}
              <button
                type="button"
                id="close-cancelled-async-zip-btn"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors cursor-pointer"
              >
                {t.asyncZipCloseButton}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

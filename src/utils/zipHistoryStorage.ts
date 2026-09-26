import type { AudioFormat, DownloadedArchiveItem, DownloadedArchiveSong } from '../types.js';

export const STORAGE_KEY_ZIP_DOWNLOADS = 'suno_zip_download_history';

/**
 * Calculates a realistic estimated file size for a multi-track ZIP archive.
 */
export function estimateArchiveSize(
  count: number,
  format: AudioFormat | 'both',
  bitDepth: 16 | 24 = 16
): string {
  if (count <= 0) return '0 MB';

  let perTrackMb = 7.5; // High-quality 320kbps MP3 (~3 mins)
  if (format === 'wav') {
    perTrackMb = bitDepth === 24 ? 48.0 : 32.0; // 24-bit studio vs 16-bit PCM
  } else if (format === 'both') {
    perTrackMb = bitDepth === 24 ? 55.5 : 39.5; // MP3 + WAV bundled
  } else if (format === 'm4a') {
    perTrackMb = 4.2;
  }

  const totalMb = count * perTrackMb;
  if (totalMb >= 1024) {
    return `~${(totalMb / 1024).toFixed(1)} GB`;
  }
  return `~${Math.round(totalMb)} MB`;
}

/**
 * Safely retrieves the stored ZIP download history from localStorage.
 */
export function getZipDownloadHistory(): DownloadedArchiveItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ZIP_DOWNLOADS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && typeof item.id === 'string' && Array.isArray(item.songs));
    }
  } catch (err) {
    console.warn('[ZipHistory] Failed to read localStorage:', err);
  }
  return [];
}

/**
 * Saves ZIP download items back to localStorage and notifies listeners.
 */
export function saveZipDownloadHistory(items: DownloadedArchiveItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ZIP_DOWNLOADS, JSON.stringify(items.slice(0, 50)));
    window.dispatchEvent(new CustomEvent('suno-zip-history-updated'));
  } catch (err) {
    console.warn('[ZipHistory] Failed to save to localStorage:', err);
  }
}

/**
 * Records a new ZIP download archive into history.
 */
export function recordZipDownload(entry: {
  name: string;
  format: AudioFormat | 'both';
  bitDepth?: 16 | 24;
  songs: Array<{ id: string; title?: string; artist?: string; displayName?: string; duration?: number }>;
  source?: 'playlist' | 'queue' | 'history' | 'favorites' | 'song' | 'batch' | 'profile';
  downloadUrl?: string;
  jobId?: string;
  fileSizeApprox?: string;
}): DownloadedArchiveItem {
  const cleanSongs: DownloadedArchiveSong[] = entry.songs.map((s, idx) => ({
    id: s.id,
    title: (s.title && s.title.trim()) || `Track_${idx + 1}`,
    artist: (s.artist || s.displayName || 'Suno').trim(),
    displayName: (s.displayName || s.artist || 'Suno').trim(),
    duration: s.duration
  }));

  const newItem: DownloadedArchiveItem = {
    id: `zip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: entry.name.trim() || 'Suno_Songs_Archive',
    format: entry.format,
    bitDepth: entry.bitDepth || 16,
    songCount: cleanSongs.length,
    songs: cleanSongs,
    fileSizeApprox: entry.fileSizeApprox || estimateArchiveSize(cleanSongs.length, entry.format, entry.bitDepth || 16),
    downloadedAt: Date.now(),
    source: entry.source || 'batch',
    downloadUrl: entry.downloadUrl,
    jobId: entry.jobId
  };

  const existing = getZipDownloadHistory();
  // Filter out duplicate identical archive from the past 5 seconds (prevent duplicate fast clicks)
  const filtered = existing.filter(
    (item) => !(item.name === newItem.name && Math.abs(item.downloadedAt - newItem.downloadedAt) < 4000)
  );

  const updated = [newItem, ...filtered].slice(0, 50);
  saveZipDownloadHistory(updated);
  return newItem;
}

/**
 * Removes a specific download archive record by ID.
 */
export function removeZipDownload(id: string): void {
  const current = getZipDownloadHistory();
  const next = current.filter((item) => item.id !== id);
  saveZipDownloadHistory(next);
}

/**
 * Clears the entire download history.
 */
export function clearZipDownloadHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_ZIP_DOWNLOADS);
    window.dispatchEvent(new CustomEvent('suno-zip-history-updated'));
  } catch (err) {
    console.warn('[ZipHistory] Failed to clear localStorage:', err);
  }
}

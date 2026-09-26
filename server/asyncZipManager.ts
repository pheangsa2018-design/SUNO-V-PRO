import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { ZipArchive } from 'archiver';
import {
  getFormattedAudioPath,
  getCachedSongInfo,
  getSongInfo,
  getPlaylistInfo,
  sanitizeFilename
} from './sunoService.js';
import type { AudioFormat } from '../src/types.js';

export interface AsyncZipJob {
  id: string;
  playlistId?: string;
  playlistName: string;
  format: AudioFormat | 'both';
  bitDepth: 16 | 24;
  status: 'queued' | 'processing' | 'ready' | 'error' | 'cancelled';
  total: number;
  current: number;
  currentTitle: string;
  currentStep: string;
  percent: number;
  zipPath?: string;
  zipSize?: number;
  zipFilenameAscii: string;
  zipFilenameUnicode: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
  cancelled: boolean;
}

interface SongItemInput {
  id: string;
  title?: string;
  artist?: string;
  displayName?: string;
}

const JOBS_DIR = path.join(os.tmpdir(), 'suno_audio_cache', 'zip_jobs');
if (!fs.existsSync(JOBS_DIR)) {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
}

// In-memory registry of active and recent jobs
const jobs = new Map<string, AsyncZipJob>();

// Clean up jobs older than 1 hour every 15 minutes
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < oneHourAgo) {
      if (job.zipPath && fs.existsSync(job.zipPath)) {
        try {
          fs.unlinkSync(job.zipPath);
        } catch {}
      }
      jobs.delete(id);
    }
  }
}, 15 * 60 * 1000);

export function getZipJob(jobId: string): AsyncZipJob | undefined {
  return jobs.get(jobId);
}

export function cancelZipJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job) return false;

  job.cancelled = true;
  job.status = 'cancelled';
  job.currentStep = 'Job cancelled by user';

  if (job.zipPath && fs.existsSync(job.zipPath)) {
    try {
      fs.unlinkSync(job.zipPath);
    } catch {}
  }
  return true;
}

export async function startAsyncZipJob(options: {
  playlistId?: string;
  playlistName?: string;
  songs?: SongItemInput[];
  format?: AudioFormat | 'both';
  bitDepth?: 16 | 24;
}): Promise<AsyncZipJob> {
  const jobId = crypto.randomUUID();
  let playlistName = options.playlistName || 'Suno_Playlist';
  let songs = options.songs || [];
  const format = options.format || 'mp3';
  const bitDepth: 16 | 24 = options.bitDepth === 24 ? 24 : 16;

  // If songs not provided but playlistId is, fetch playlist info
  if (songs.length === 0 && options.playlistId) {
    try {
      const playlist = await getPlaylistInfo(options.playlistId);
      playlistName = playlist.name || playlistName;
      songs = playlist.songs.map((s) => ({
        id: s.id,
        title: s.title,
        artist: playlist.userDisplayName || playlist.userHandle
      }));
    } catch (err: any) {
      console.error(`[AsyncZip] Failed to fetch playlist info for ${options.playlistId}:`, err);
    }
  }

  if (songs.length === 0) {
    throw new Error('No songs provided to zip');
  }

  const cleanCustomName = sanitizeFilename(playlistName);
  const asciiCustomName =
    cleanCustomName.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').trim() || 'Suno_Playlist';
  const zipFilenameAscii = `${asciiCustomName}.zip`;
  const zipFilenameUnicode = `${cleanCustomName}.zip`;

  const job: AsyncZipJob = {
    id: jobId,
    playlistId: options.playlistId,
    playlistName,
    format,
    bitDepth,
    status: 'queued',
    total: songs.length,
    current: 0,
    currentTitle: '',
    currentStep: 'Initializing download queue...',
    percent: 0,
    zipFilenameAscii,
    zipFilenameUnicode,
    createdAt: Date.now(),
    cancelled: false
  };

  jobs.set(jobId, job);

  // Execute processing asynchronously in the background
  executeZipJob(job, songs).catch((err) => {
    console.error(`[AsyncZip] Uncaught error in job ${jobId}:`, err);
    job.status = 'error';
    job.error = err.message || 'Failed to generate playlist zip';
  });

  return job;
}

async function executeZipJob(job: AsyncZipJob, songs: SongItemInput[]): Promise<void> {
  const tempZipPath = path.join(JOBS_DIR, `${job.id}.zip`);
  const outputStream = fs.createWriteStream(tempZipPath);

  const archive = new ZipArchive({
    zlib: { level: 5 }
  });

  let hasError = false;

  archive.on('error', (err) => {
    console.error(`[AsyncZip Archive Error ${job.id}]:`, err);
    hasError = true;
    job.status = 'error';
    job.error = err.message || 'Archiver internal error';
  });

  archive.pipe(outputStream);

  job.status = 'processing';
  job.currentStep = 'Starting track processing...';

  const format = job.format;
  const bitDepth = job.bitDepth;
  const usedEntryNames = new Set<string>();

  const getUniqueZipEntry = (baseTitle: string, ext: string) => {
    const clean = sanitizeFilename(baseTitle) || 'Track';
    let candidate = `${clean}.${ext}`;
    if (!usedEntryNames.has(candidate.toLowerCase())) {
      usedEntryNames.add(candidate.toLowerCase());
      return candidate;
    }
    let count = 2;
    while (usedEntryNames.has(`${clean} (${count}).${ext}`.toLowerCase())) {
      count++;
    }
    const unique = `${clean} (${count}).${ext}`;
    usedEntryNames.add(unique.toLowerCase());
    return unique;
  };

  for (let i = 0; i < songs.length; i++) {
    if (job.cancelled) {
      try {
        archive.abort();
        outputStream.end();
        if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
      } catch {}
      return;
    }

    const item = songs[i];
    const songId = item.id;

    job.current = i + 1;
    job.currentTitle = item.title || `Track ${i + 1}`;
    job.currentStep = `Fetching and decrypting audio (${i + 1}/${songs.length})...`;
    job.percent = Math.round((i / songs.length) * 100);

    try {
      // 1. Resolve title & artist
      let title = item.title?.trim();
      let artist = (item.artist || item.displayName)?.trim();

      if (!title || !artist) {
        const cached = getCachedSongInfo(songId);
        if (cached) {
          if (!title && cached.title && cached.title !== 'Untitled Suno Track') {
            title = cached.title;
          }
          if (!artist && (cached.displayName || cached.handle)) {
            artist = cached.displayName || cached.handle;
          }
        }
      }

      if (!title || !artist) {
        try {
          const info = await getSongInfo(songId);
          if (!title && info.title) title = info.title;
          if (!artist && (info.displayName || info.handle)) artist = info.displayName || info.handle;
        } catch (err: any) {
          console.warn(`[AsyncZip] Metadata lookup fallback error for ${songId}:`, err?.message);
        }
      }

      title = title || `Track_${i + 1}`;
      artist = artist || 'Suno';
      job.currentTitle = title;

      if (format === 'both') {
        job.currentStep = `Converting to MP3 & Lossless WAV (${i + 1}/${songs.length})...`;
        const mp3Path = await getFormattedAudioPath(songId, 'mp3', { title, artist, bitDepth: 16 });
        const wavPath = await getFormattedAudioPath(songId, 'wav', { title, artist, bitDepth });

        if (job.cancelled) return;

        const mp3Entry = getUniqueZipEntry(title, 'mp3');
        const wavEntry = getUniqueZipEntry(title, 'wav');

        archive.file(mp3Path, { name: mp3Entry });
        archive.file(wavPath, { name: wavEntry });
      } else if (format === 'wav') {
        job.currentStep = `Converting to Lossless WAV (${i + 1}/${songs.length})...`;
        const wavPath = await getFormattedAudioPath(songId, 'wav', { title, artist, bitDepth });

        if (job.cancelled) return;

        const wavEntry = getUniqueZipEntry(title, 'wav');
        archive.file(wavPath, { name: wavEntry });
      } else {
        job.currentStep = `Converting to 320kbps MP3 (${i + 1}/${songs.length})...`;
        const mp3Path = await getFormattedAudioPath(songId, 'mp3', { title, artist, bitDepth: 16 });

        if (job.cancelled) return;

        const mp3Entry = getUniqueZipEntry(title, 'mp3');
        archive.file(mp3Path, { name: mp3Entry });
      }

      job.percent = Math.round(((i + 1) / songs.length) * 100);
    } catch (songErr: any) {
      console.warn(`[AsyncZip Skip] Failed to package track ${songId}:`, songErr?.message);
      // Append a note inside the zip if this track could not be fetched
      try {
        archive.append(
          `Could not download track ${item.title || songId}: ${songErr?.message || 'Network/DRM error'}`,
          { name: `_ERROR_Track_${i + 1}_${songId.slice(0, 8)}.txt` }
        );
      } catch {}
    }
  }

  if (job.cancelled || hasError) return;

  job.currentStep = 'Finalizing and compressing ZIP archive...';
  job.percent = 99;

  await archive.finalize();

  await new Promise<void>((resolve, reject) => {
    outputStream.on('close', () => resolve());
    outputStream.on('error', (err) => reject(err));
  });

  if (fs.existsSync(tempZipPath)) {
    const stat = fs.statSync(tempZipPath);
    job.zipPath = tempZipPath;
    job.zipSize = stat.size;
    job.status = 'ready';
    job.percent = 100;
    job.currentStep = 'ZIP archive is ready for download!';
    job.completedAt = Date.now();
  } else {
    job.status = 'error';
    job.error = 'ZIP file was not created successfully';
  }
}

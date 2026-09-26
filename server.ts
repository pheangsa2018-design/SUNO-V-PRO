import express from 'express';
import path from 'path';
import fs from 'fs';
import { ZipArchive } from 'archiver';
import { createServer as createViteServer } from 'vite';
import {
  resolveSongId,
  getSongInfo,
  getCachedSongInfo,
  setCachedSongInfo,
  getDecryptedAudioPath,
  getFormattedAudioPath,
  sanitizeFilename,
  isProfileQuery,
  extractProfileHandle,
  getProfileInfo,
  isPlaylistQuery,
  getPlaylistInfo,
  getCreatorPlaylist,
  addDiscoveredUnlistedSong
} from './server/sunoService.js';
import {
  startAsyncZipJob,
  getZipJob,
  cancelZipJob
} from './server/asyncZipManager.js';
import type { AudioFormat, ProfileSongItem } from './src/types.js';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Enable embedding in Blogger / Blogspot and other sites + enable CORS
  app.use((req, res, next) => {
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', "frame-ancestors *");
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Serve the Blogger XML theme file with download attachment headers
  app.get('/suno-downloader-theme.xml', (req, res) => {
    const xmlFile = path.join(process.cwd(), 'public', 'suno-downloader-theme.xml');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="suno-downloader-theme.xml"');
    res.sendFile(xmlFile);
  });

  // API 1: Fetch Song Details (or redirect to profile/playlist if matching URL passed)
  app.get('/api/song/info', async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ success: false, error: 'Song URL or ID is required' });
      }

      if (isProfileQuery(url)) {
        const myHandle = (req.query.myHandle as string) || 'musicsabay';
        if (
          url.includes('page=playlists') ||
          url.includes('me/playlists') ||
          url.includes('/playlists')
        ) {
          const { playlist, profile, isPlaylist } = await getCreatorPlaylist(url, myHandle);
          return res.json({ success: true, isPlaylist, playlist, profile, isProfile: true });
        }
        const profile = await getProfileInfo(url, myHandle);
        return res.json({ success: true, isProfile: true, profile });
      }

      if (isPlaylistQuery(url)) {
        const playlist = await getPlaylistInfo(url);
        return res.json({ success: true, isPlaylist: true, playlist });
      }

      const songId = await resolveSongId(url);
      const info = await getSongInfo(songId, { rawUrl: url });

      // Eagerly initiate decryption in the background to warm cache for instant playback
      getDecryptedAudioPath(songId).catch((err) => {
        console.log(`[Warm Cache] Notice for ${songId}:`, err.message);
      });

      res.json({ success: true, song: info });
    } catch (err: any) {
      // Resilient fallback: Check if input was a playlist ID
      const url = req.query.url as string;
      if (url) {
        try {
          const playlist = await getPlaylistInfo(url);
          return res.json({ success: true, isPlaylist: true, playlist });
        } catch {}
      }

      console.log('[API Info Notice]:', err?.message || err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch song info' });
    }
  });

  // API 1b: Fetch Creator Profile Details & Clips
  app.get('/api/profile', async (req, res) => {
    try {
      const handle = (req.query.handle || req.query.url) as string;
      const myHandle = (req.query.myHandle as string) || 'musicsabay';
      if (!handle) {
        return res.status(400).json({ success: false, error: 'Profile handle or URL is required' });
      }

      const autoPlaylist =
        req.query.autoPlaylist === 'true' ||
        req.query.findPlaylist === 'true' ||
        handle.includes('page=playlists') ||
        handle.includes('me/playlists') ||
        handle.includes('/playlists');

      if (autoPlaylist) {
        const { playlist, profile, isPlaylist } = await getCreatorPlaylist(handle, myHandle);
        return res.json({ success: true, isPlaylist, playlist, profile });
      }

      const profile = await getProfileInfo(handle, myHandle);

      res.json({ success: true, profile });
    } catch (err: any) {
      console.error('[API Profile Error]:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch creator profile' });
    }
  });

  // API 1b-2: Export Profile Data (JSON, CSV, M3U)
  app.get('/api/profile/export', async (req, res) => {
    try {
      const handle = (req.query.handle || req.query.url) as string;
      const myHandle = (req.query.myHandle as string) || 'musicsabay';
      const format = ((req.query.format as string) || 'json').toLowerCase();

      if (!handle) {
        return res.status(400).json({ success: false, error: 'Profile handle or URL is required' });
      }

      const profile = await getProfileInfo(handle, myHandle);
      const cleanHandle = profile.handle || 'creator';

      if (format === 'csv') {
        const headers = [
          'Index',
          'Title',
          'Song ID',
          'AI Model',
          'Duration (MM:SS)',
          'Duration (Sec)',
          'Visibility',
          'Suno Link',
          'Audio CDN URL',
          'Tags',
          'Prompt',
          'Created At'
        ];

        const escapeCsv = (val: any) => {
          if (val === null || val === undefined) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        };

        const rows = profile.songs.map((s, idx) => {
          const min = Math.floor((s.duration || 0) / 60);
          const sec = Math.floor((s.duration || 0) % 60).toString().padStart(2, '0');
          const isUnlisted = Boolean(s.isUnlisted || s.isPublic === false);
          return [
            idx + 1,
            escapeCsv(s.title || 'Untitled'),
            escapeCsv(s.id),
            escapeCsv(s.modelName || 'v3.5'),
            escapeCsv(`${min}:${sec}`),
            s.duration || 0,
            escapeCsv(isUnlisted ? 'Unlisted' : 'Public'),
            escapeCsv(`https://suno.com/song/${s.id}`),
            escapeCsv(s.audioUrl || `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${s.id}.m4a`),
            escapeCsv(s.tags || ''),
            escapeCsv(s.prompt || ''),
            escapeCsv(s.createdAt || '')
          ].join(',');
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${cleanHandle}_tracks.csv"`);
        return res.send(csvContent);
      } else if (format === 'm3u') {
        let m3u = '#EXTM3U\n';
        m3u += `#PLAYLIST:${profile.displayName || cleanHandle}\n\n`;
        for (const s of profile.songs) {
          const dur = Math.round(s.duration || 180);
          const artist = profile.displayName || cleanHandle;
          const title = s.title || 'Untitled';
          const streamUrl = s.audioUrl || `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${s.id}.m4a`;
          m3u += `#EXTINF:${dur},${artist} - ${title}\n${streamUrl}\n\n`;
        }
        res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${cleanHandle}_playlist.m3u8"`);
        return res.send(m3u);
      } else {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${cleanHandle}_profile_data.json"`);
        return res.json({
          version: '1.0',
          exportedAt: new Date().toISOString(),
          creator: {
            handle: profile.handle,
            displayName: profile.displayName,
            bio: profile.bio,
            avatarUrl: profile.avatarUrl,
            followersCount: profile.followersCount,
            totalSongs: profile.songs.length
          },
          songs: profile.songs,
          playlists: profile.playlists || []
        });
      }
    } catch (err: any) {
      console.error('[API Profile Export Error]:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to export creator profile data' });
    }
  });

  // API 1c: Fetch Playlist Details & Clips
  app.get('/api/playlist', async (req, res) => {
    try {
      const playlistIdOrUrl = (req.query.id || req.query.url) as string;
      if (!playlistIdOrUrl) {
        return res.status(400).json({ success: false, error: 'Playlist ID or URL is required' });
      }

      const playlist = await getPlaylistInfo(playlistIdOrUrl);
      res.json({ success: true, playlist });
    } catch (err: any) {
      console.error('[API Playlist Error]:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch Suno playlist' });
    }
  });

  // API 1d: Auto-search creator's playlist directly
  app.get('/api/creator/playlist', async (req, res) => {
    try {
      const handle = (req.query.handle || req.query.url) as string;
      const myHandle = (req.query.myHandle as string) || 'musicsabay';
      if (!handle) {
        return res.status(400).json({ success: false, error: 'Creator handle or URL is required' });
      }

      const { playlist, profile, isPlaylist } = await getCreatorPlaylist(handle, myHandle);
      res.json({ success: true, isPlaylist, playlist, profile });
    } catch (err: any) {
      console.warn('[API Creator Playlist]:', err?.message || err);
      try {
        const handle = (req.query.handle || req.query.url) as string;
        const myHandle = (req.query.myHandle as string) || 'musicsabay';
        const profile = await getProfileInfo(handle, myHandle);
        return res.json({ success: true, isPlaylist: false, profile });
      } catch (profileErr: any) {
        res.status(500).json({ success: false, error: profileErr.message || 'Failed to find creator profile' });
      }
    }
  });

  // API 1e: Check or fetch unlisted / direct song link for Profile View
  app.get('/api/profile/check-unlisted-song', async (req, res) => {
    try {
      const query = (req.query.query || req.query.url || req.query.id) as string;
      const targetHandle = ((req.query.handle as string) || '').toLowerCase().replace(/^@/, '').trim();
      if (!query) {
        return res.status(400).json({ success: false, error: 'Song URL or ID is required' });
      }

      const songId = await resolveSongId(query);
      if (!songId) {
        return res.status(400).json({ success: false, error: 'Could not extract valid Suno song ID' });
      }

      const song = await getSongInfo(songId, { rawUrl: query });
      const isUnlisted = song.isPublic === false || song.isUnlisted === true;
      const songHandle = (song.handle || '').toLowerCase().replace(/^@/, '').trim();
      const matchesCreator = !targetHandle || songHandle === targetHandle;

      const profileItem: ProfileSongItem = {
        id: song.id,
        title: song.title,
        imageUrl: song.imageUrl,
        duration: song.duration,
        createdAt: song.createdAt,
        tags: song.tags,
        modelName: song.modelName,
        isPublic: song.isPublic !== false && !song.isUnlisted,
        isUnlisted: isUnlisted,
        audioUrl: song.audioUrl,
        prompt: song.prompt,
        capturedAt: Date.now()
      };

      if (profileItem.isUnlisted || !profileItem.isPublic) {
        addDiscoveredUnlistedSong(song.handle || targetHandle, profileItem);
      }

      // Pre-warm decryption in background for instant playback/download
      getDecryptedAudioPath(song.id).catch(() => {});

      res.json({
        success: true,
        song: profileItem,
        songInfo: song,
        isUnlisted,
        isPublic: profileItem.isPublic,
        matchesCreator,
        creatorHandle: song.handle
      });
    } catch (err: any) {
      console.log('[Check Unlisted Song Notice]:', err?.message || err);
      res.status(404).json({
        success: false,
        notFound: true,
        error: err.message || 'Song not found or inaccessible on Suno'
      });
    }
  });

  // API 1f: Batch scan & auto-capture unlisted tracks for Profile
  app.post('/api/profile/batch-scan-unlisted', express.json(), async (req, res) => {
    try {
      const { songIds, handle } = req.body || {};
      if (!Array.isArray(songIds) || songIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Array of songIds is required' });
      }

      const targetHandle = ((handle as string) || '').toLowerCase().replace(/^@/, '').trim();
      const uniqueIds = Array.from(new Set(songIds.filter((id) => typeof id === 'string' && id.trim()))).slice(0, 30);
      const results: ProfileSongItem[] = [];

      // Concurrency worker (chunk of 5)
      const chunkSize = 5;
      for (let i = 0; i < uniqueIds.length; i += chunkSize) {
        const chunk = uniqueIds.slice(i, i + chunkSize);
        await Promise.allSettled(
          chunk.map(async (id) => {
            try {
              const song = await getSongInfo(id);
              const isUnlisted = song.isPublic === false || song.isUnlisted === true;
              if (isUnlisted || !song.isPublic) {
                const item: ProfileSongItem = {
                  id: song.id,
                  title: song.title,
                  imageUrl: song.imageUrl,
                  duration: song.duration,
                  createdAt: song.createdAt,
                  tags: song.tags,
                  modelName: song.modelName,
                  isPublic: false,
                  isUnlisted: true,
                  audioUrl: song.audioUrl,
                  prompt: song.prompt,
                  capturedAt: Date.now()
                };
                results.push(item);
                addDiscoveredUnlistedSong(song.handle || targetHandle, item);
                getDecryptedAudioPath(song.id).catch(() => {});
              }
            } catch {}
          })
        );
      }

      res.json({
        success: true,
        totalScanned: uniqueIds.length,
        unlistedFound: results.length,
        unlistedSongs: results
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Batch scan failed' });
    }
  });

  // API 2: Stream audio for in-browser player with Range support
  app.get('/api/song/stream/:id', async (req, res) => {
    try {
      const songId = req.params.id;
      const format = ((req.query.format as string) || 'm4a').toLowerCase() as AudioFormat;
      const bitDepthParam = req.query.bitDepth ? parseInt(req.query.bitDepth as string, 10) : 16;
      const bitDepth: 16 | 24 = bitDepthParam === 24 ? 24 : 16;

      let audioPath: string;
      let contentType = 'audio/mp4';

      if (format === 'wav' || format === 'mp3') {
        audioPath = await getFormattedAudioPath(songId, format, { bitDepth });
        contentType = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
      } else {
        audioPath = await getDecryptedAudioPath(songId);
        contentType = 'audio/mp4';
      }

      const stat = fs.statSync(audioPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        });

        const fileStream = fs.createReadStream(audioPath, { start, end });
        const cleanup = () => {
          if (!fileStream.destroyed) fileStream.destroy();
        };
        req.on('close', cleanup);
        res.on('finish', cleanup);
        res.on('close', cleanup);
        fileStream.on('error', () => {
          cleanup();
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to read audio stream' });
          } else {
            res.destroy();
          }
        });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        });
        const fileStream = fs.createReadStream(audioPath);
        const cleanup = () => {
          if (!fileStream.destroyed) fileStream.destroy();
        };
        req.on('close', cleanup);
        res.on('finish', cleanup);
        res.on('close', cleanup);
        fileStream.on('error', () => {
          cleanup();
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to read audio stream' });
          } else {
            res.destroy();
          }
        });
        fileStream.pipe(res);
      }
    } catch (err: any) {
      console.error('[API Stream Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to stream audio' });
    }
  });

  // API 3: Download converted audio (MP3, WAV, M4A)
  app.get('/api/song/download/:id', async (req, res) => {
    try {
      const songId = req.params.id;
      const format = ((req.query.format as string) || 'mp3').toLowerCase() as AudioFormat;
      // Default to 16-bit for 100% universal player compatibility (Windows Media Player, iOS, Android, Car stereos)
      const bitDepthParam = req.query.bitDepth ? parseInt(req.query.bitDepth as string, 10) : 16;
      const bitDepth: 16 | 24 = bitDepthParam === 24 ? 24 : 16;

      if (!['mp3', 'wav', 'm4a'].includes(format)) {
        return res.status(400).json({ error: 'Unsupported format. Allowed: mp3, wav, m4a' });
      }

      // Fetch song info for nice filename
      let title = 'suno_song';
      let artist = 'Suno';
      try {
        const info = await getSongInfo(songId);
        if (info.title) title = info.title;
        if (info.displayName) artist = info.displayName;
      } catch (e) {}

      const cleanTitle = sanitizeFilename(title);
      const cleanArtist = sanitizeFilename(artist);
      const safeTitle = title.replace(/[\r\n\t]/g, ' ').trim() || 'Suno Music';
      const safeArtist = artist.replace(/[\r\n\t]/g, ' ').trim() || 'Suno AI';
      
      // Generate clean ASCII fallback filename that never becomes "( ).wav"
      let asciiTitle = cleanTitle.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').trim();
      if (!asciiTitle || asciiTitle.length < 2) {
        asciiTitle = `Suno_Music_${songId.slice(0, 8)}`;
      }
      const bitDepthTag = format === 'wav' ? (bitDepth === 24 ? ' [24-bit Studio Master]' : ' [16-bit Lossless]') : '';
      const fullFilename = `${cleanTitle} - ${cleanArtist}${bitDepthTag}.${format}`;
      // RFC 5987 compliant encoding that strictly escapes characters like single-quotes and parentheses
      const encodedFilename = encodeURIComponent(fullFilename).replace(/['()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

      const targetPath = await getFormattedAudioPath(songId, format, { title: safeTitle, artist: safeArtist, bitDepth });
      const stat = fs.statSync(targetPath);
      const fileSize = stat.size;

      const mimeTypes: Record<string, string> = {
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        m4a: 'audio/mp4'
      };
      const contentType = mimeTypes[format] || 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Type, Accept-Ranges');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${asciiTitle}.${format}"; filename*=UTF-8''${encodedFilename}`
      );

      // Instantly finish HEAD requests without piping stream
      if (req.method === 'HEAD') {
        return res.end();
      }

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;

        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunksize);

        const fileStream = fs.createReadStream(targetPath, { start, end });
        const cleanupStream = () => {
          if (!fileStream.destroyed) fileStream.destroy();
        };
        req.on('close', cleanupStream);
        res.on('finish', cleanupStream);
        res.on('close', cleanupStream);
        fileStream.on('error', (streamErr) => {
          cleanupStream();
          console.warn('[Download FileStream Range Error]:', streamErr.message);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to read audio stream' });
          } else {
            res.destroy();
          }
        });
        fileStream.pipe(res);
      } else {
        const fileStream = fs.createReadStream(targetPath);
        const cleanupStream = () => {
          if (!fileStream.destroyed) fileStream.destroy();
        };
        req.on('close', cleanupStream);
        res.on('finish', cleanupStream);
        res.on('close', cleanupStream);
        fileStream.on('error', (streamErr) => {
          cleanupStream();
          console.warn('[Download FileStream Error]:', streamErr.message);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to read audio stream' });
          } else {
            res.destroy();
          }
        });
        fileStream.pipe(res);
      }
    } catch (err: any) {
      console.warn('[API Download Warning]:', err?.message || err);
      if (!res.headersSent) {
        const msg = err?.message || 'Failed to process audio for download';
        const isNotFound = msg.includes('404') || msg.toLowerCase().includes('not found');
        const isRateLimit = msg.includes('429');
        const status = isNotFound ? 404 : isRateLimit ? 429 : 500;
        res.status(status).json({ error: msg });
      } else {
        res.end();
      }
    }
  });

  // API 3b: Batch download multiple songs as a ZIP archive (GET & POST)
  const handleBatchZip = async (req: express.Request, res: express.Response) => {
    try {
      type IncomingSongItem = { id: string; title?: string; artist?: string; displayName?: string };
      let songItems: IncomingSongItem[] = [];

      if (req.method === 'POST') {
        let rawSongs = req.body?.songs;
        if (typeof rawSongs === 'string') {
          try {
            rawSongs = JSON.parse(rawSongs);
          } catch {}
        }
        if (Array.isArray(rawSongs)) {
          songItems = rawSongs
            .map((s: any) => ({
              id: String(s.id || '').trim(),
              title: s.title ? String(s.title).trim() : undefined,
              artist: s.artist || s.displayName ? String(s.artist || s.displayName).trim() : undefined
            }))
            .filter((s: IncomingSongItem) => Boolean(s.id));
        } else if (Array.isArray(req.body?.songIds)) {
          songItems = req.body.songIds.map((s: any) => ({ id: String(s).trim() })).filter((s: IncomingSongItem) => Boolean(s.id));
        }
      }

      // Query parameter fallbacks
      if (songItems.length === 0 && req.query.songs) {
        try {
          const parsed = JSON.parse(req.query.songs as string);
          if (Array.isArray(parsed)) {
            songItems = parsed
              .map((s: any) => ({
                id: String(s.id || '').trim(),
                title: s.title ? String(s.title).trim() : undefined,
                artist: s.artist || s.displayName ? String(s.artist || s.displayName).trim() : undefined
              }))
              .filter((s: IncomingSongItem) => Boolean(s.id));
          }
        } catch {}
      }

      if (songItems.length === 0 && req.query.ids) {
        songItems = (req.query.ids as string)
          .split(',')
          .map((s) => ({ id: s.trim() }))
          .filter((s) => Boolean(s.id));
      }

      if (songItems.length === 0) {
        return res.status(400).json({ error: 'No valid songs or song IDs provided for batch zip' });
      }

      const formatRaw = ((req.query.format || req.body?.format) as string || 'mp3').toLowerCase();
      const format: 'mp3' | 'wav' | 'both' = formatRaw === 'both' ? 'both' : formatRaw === 'wav' ? 'wav' : 'mp3';
      const bitDepthParam = req.query.bitDepth || req.body?.bitDepth;
      const bitDepth: 16 | 24 = bitDepthParam ? (parseInt(String(bitDepthParam), 10) === 24 ? 24 : 16) : 16;
      const customName = (req.query.name || req.body?.name || 'Suno_Songs') as string;

      const cleanCustomName = sanitizeFilename(customName);
      const asciiCustomName = cleanCustomName.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').trim() || 'Suno_Songs';
      const zipFilenameAscii = `${asciiCustomName}.zip`;
      const zipFilenameUnicode = `${cleanCustomName}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${zipFilenameAscii}"; filename*=UTF-8''${encodeURIComponent(zipFilenameUnicode)}`
      );

      const archive = new ZipArchive({
        zlib: { level: 5 }
      });

      archive.on('error', (err) => {
        console.error('[Archive Error]:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Archive creation error' });
        }
      });

      archive.pipe(res);

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

      for (let i = 0; i < songItems.length; i++) {
        const item = songItems[i];
        const songId = item.id;
        try {
          // Resolve original title and artist with multi-level lookup
          let title = item.title?.trim();
          let artist = (item.artist || item.displayName)?.trim();

          // 1. Check in-memory metadata cache
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

          // 2. Fetch directly from Suno if still missing
          if (!title || !artist) {
            try {
              const info = await getSongInfo(songId);
              if (!title && info.title) title = info.title;
              if (!artist && (info.displayName || info.handle)) artist = info.displayName || info.handle;
            } catch (err: any) {
              console.warn(`[getSongInfo fallback failed for ${songId}]:`, err?.message);
            }
          }

          title = title || `Track_${i + 1}`;
          artist = artist || 'Suno';

          if (format === 'both') {
            // Include both MP3 320kbps and WAV Lossless with original title
            const mp3Path = await getFormattedAudioPath(songId, 'mp3', { title, artist, bitDepth: 16 });
            const wavPath = await getFormattedAudioPath(songId, 'wav', { title, artist, bitDepth });
            const mp3Entry = getUniqueZipEntry(title, 'mp3');
            const wavEntry = getUniqueZipEntry(title, 'wav');

            archive.file(mp3Path, { name: mp3Entry });
            archive.file(wavPath, { name: wavEntry });
          } else if (format === 'wav') {
            const wavPath = await getFormattedAudioPath(songId, 'wav', { title, artist, bitDepth });
            const wavEntry = getUniqueZipEntry(title, 'wav');
            archive.file(wavPath, { name: wavEntry });
          } else {
            // Default MP3 320kbps
            const mp3Path = await getFormattedAudioPath(songId, 'mp3', { title, artist, bitDepth: 16 });
            const mp3Entry = getUniqueZipEntry(title, 'mp3');
            archive.file(mp3Path, { name: mp3Entry });
          }
        } catch (songErr: any) {
          console.warn(`[Batch Zip Skip] Could not include song ${songId}:`, songErr?.message);
        }
      }

      await archive.finalize();
    } catch (err: any) {
      console.error('[API Batch Zip Error]:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Failed to generate batch zip' });
      }
    }
  };

  app.get('/api/songs/batch-zip', handleBatchZip);
  app.post('/api/songs/batch-zip', handleBatchZip);

  // API 4: Asynchronous Playlist ZIP Generation
  app.post('/api/playlist/download-all/start', async (req, res) => {
    try {
      const { playlistId, playlistName, songs, format, bitDepth } = req.body;
      const job = await startAsyncZipJob({
        playlistId,
        playlistName,
        songs,
        format,
        bitDepth
      });
      res.json({ success: true, jobId: job.id, job });
    } catch (err: any) {
      console.error('[AsyncZip Start Error]:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to start async zip job' });
    }
  });

  app.get('/api/playlist/download-all/status/:jobId', (req, res) => {
    const job = getZipJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Zip job not found or expired' });
    }
    res.json({ success: true, job });
  });

  app.post('/api/playlist/download-all/cancel/:jobId', (req, res) => {
    const success = cancelZipJob(req.params.jobId);
    res.json({ success });
  });

  app.get('/api/playlist/download-all/file/:jobId', (req, res) => {
    const job = getZipJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Zip job not found or expired' });
    }
    if (job.status !== 'ready' || !job.zipPath || !fs.existsSync(job.zipPath)) {
      return res.status(400).json({ error: 'Zip file is not ready for download yet' });
    }

    const stat = fs.statSync(job.zipPath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', stat.size);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${job.zipFilenameAscii}"; filename*=UTF-8''${encodeURIComponent(job.zipFilenameUnicode)}`
    );

    const stream = fs.createReadStream(job.zipPath);
    stream.pipe(res);
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Vite middleware in dev, static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup failure:', err);
  process.exit(1);
});

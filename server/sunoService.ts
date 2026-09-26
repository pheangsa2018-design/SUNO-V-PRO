import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { SongInfo, AudioFormat, ProfileInfo, ProfileSongItem, PlaylistInfo } from '../src/types.js';

const execFileAsync = promisify(execFile);

const CACHE_DIR = path.join(os.tmpdir(), 'suno_audio_cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// UUID regex pattern
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export async function resolveSongId(input: string): Promise<string> {
  const trimmed = input.trim();

  // 1. If already a direct UUID
  const directMatch = trimmed.match(UUID_REGEX);
  if (directMatch && trimmed.length === 36) {
    return directMatch[0];
  }

  // 2. Short share code e.g. "s/J5hDrJ4xqChr98cw" or pure code "J5hDrJ4xqChr98cw"
  const cleanCode = trimmed.replace(/^https?:\/\/[^\/]+\/s\//i, '').replace(/^s\//i, '').trim();
  if (/^[a-zA-Z0-9_-]{10,24}$/.test(cleanCode) && !directMatch) {
    try {
      const res = await fetch(`https://suno.com/s/${cleanCode}`, {
        redirect: 'manual',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      });
      const location = res.headers.get('location');
      if (location) {
        const locMatch = location.match(UUID_REGEX);
        if (locMatch) return locMatch[0];
      }
      const html = await res.text();
      const htmlMatch = html.match(UUID_REGEX);
      if (htmlMatch) return htmlMatch[0];
    } catch {}
  }

  // 3. If it's a URL
  try {
    const parsedUrl = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);

    // If it's /song/{id}
    const match = parsedUrl.pathname.match(UUID_REGEX);
    if (match) {
      return match[0];
    }

    // If it's a share link e.g. /s/J5hDrJ4xqChr98cw
    if (parsedUrl.pathname.includes('/s/')) {
      const res = await fetch(parsedUrl.toString(), {
        redirect: 'manual',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      });

      const location = res.headers.get('location');
      if (location) {
        const locMatch = location.match(UUID_REGEX);
        if (locMatch) {
          return locMatch[0];
        }
      }

      // If redirect was followed or returned HTML
      const html = await res.text();
      const htmlMatch = html.match(UUID_REGEX);
      if (htmlMatch) {
        return htmlMatch[0];
      }
    }
  } catch (err) {
    // If not a URL, try regex search in raw string
    const fallbackMatch = trimmed.match(UUID_REGEX);
    if (fallbackMatch) {
      return fallbackMatch[0];
    }
    throw new Error(`Invalid Suno URL or Song ID: ${input}`);
  }

  const finalMatch = trimmed.match(UUID_REGEX);
  if (finalMatch) {
    return finalMatch[0];
  }

  throw new Error(`Could not extract a valid Suno Song ID from: ${input}`);
}

// In-memory song metadata cache to guarantee fast access and 100% preservation of original titles
export const songInfoCache = new Map<string, SongInfo>();

export function setCachedSongInfo(songId: string, info: Partial<SongInfo>) {
  const existing = songInfoCache.get(songId) || ({} as SongInfo);
  songInfoCache.set(songId, { ...existing, ...info, id: songId } as SongInfo);
}

export function getCachedSongInfo(songId: string): SongInfo | undefined {
  return songInfoCache.get(songId);
}

/**
 * Normalizes raw model name strings from Suno API or HTML scraper into clean identifiers
 * (e.g., 'v6-pro', 'v6', 'v3.8', 'v4', 'v3.5', 'v3', 'v2', 'v1')
 */
export function normalizeModelName(raw?: string | null): string {
  if (!raw) return 'v6';
  const clean = raw.trim().toLowerCase();
  if (
    clean.includes('v6-pro') ||
    clean.includes('v6_pro') ||
    clean.includes('v6 pro') ||
    clean.includes('chirp-v6-pro') ||
    clean.includes('suno-v6-pro') ||
    clean.includes('v6pro')
  ) {
    return 'v6-pro';
  }
  if (clean.includes('v6') || clean.includes('chirp-v6') || clean.includes('6.0') || clean === 'v6') {
    return 'v6';
  }
  if (
    clean.includes('v3.8') ||
    clean.includes('v3-8') ||
    clean.includes('v3_8') ||
    clean.includes('chirp-v3-8') ||
    clean.includes('chirp-v3.8') ||
    clean === 'v3.8'
  ) {
    return 'v3.8';
  }
  if (clean.includes('v4') || clean.includes('chirp-v4') || clean === 'v4') {
    return 'v4';
  }
  if (
    clean.includes('v3.5') ||
    clean.includes('v3-5') ||
    clean.includes('v3_5') ||
    clean.includes('chirp-v3-5') ||
    clean.includes('chirp-v3.5') ||
    clean === 'v3.5'
  ) {
    return 'v3.5';
  }
  if (clean.includes('v3') || clean.includes('chirp-v3') || clean === 'v3') {
    return 'v3';
  }
  if (clean.includes('v2') || clean.includes('chirp-v2') || clean === 'v2') {
    return 'v2';
  }
  if (clean.includes('v1') || clean.includes('chirp-v1') || clean === 'v1') {
    return 'v1';
  }
  return clean.replace(/^chirp-?/i, '') || 'v6';
}

export async function fetchSongInfoFromHtml(songId: string, rawUrl?: string): Promise<SongInfo | null> {
  const targetUrls = [
    rawUrl && rawUrl.startsWith('http') ? rawUrl : null,
    `https://suno.com/song/${songId}`
  ].filter(Boolean) as string[];

  for (const url of targetUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      if (!res.ok) continue;

      const html = await res.text();

      // 1. OpenGraph and Meta tags
      const ogTitle = html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1];
      const ogImage = html.match(/<meta property="og:image" content="([^"]*)"/i)?.[1];
      const desc = html.match(/<meta name="description" content="([^"]*)"/i)?.[1];
      const titleTag = html.match(/<title>([^<]*)<\/title>/i)?.[1];

      let title = ogTitle || '';
      let displayName = 'Suno Artist';
      let handle = 'suno';

      if (desc) {
        const authorMatch = desc.match(/by\s+(.*?)\s+\(@([a-zA-Z0-9_\-]+)\)/i);
        if (authorMatch) {
          displayName = authorMatch[1].trim();
          handle = authorMatch[2].trim();
        }
      } else if (titleTag) {
        const parts = titleTag.split('|')[0].split(' by ');
        if (parts.length > 1) {
          displayName = parts[1].trim();
          if (!title) title = parts[0].trim();
        }
      }

      if (!title && titleTag) {
        title = titleTag.replace(/\s*\|\s*Suno.*$/i, '').replace(/\s+by\s+.*$/i, '').trim();
      }

      // 2. Unescaped chunks for tags, prompt, duration, and model
      const unescaped = html.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

      let prompt = '';
      const promptMatch = unescaped.match(/"prompt":"([^"]*)"/);
      if (promptMatch && !promptMatch[1].startsWith('$')) {
        prompt = promptMatch[1];
      }

      let tags = '';
      const tagsMatch = unescaped.match(/"tags":"([^"]*)"/);
      if (tagsMatch) tags = tagsMatch[1];

      let duration = 0;
      const durMatch = unescaped.match(/"duration":([0-9\.]+)/);
      if (durMatch) duration = parseFloat(durMatch[1]);

      let modelName = 'v6';
      const modelMatch =
        unescaped.match(/"model_name":"([^"]*)"/) ||
        unescaped.match(/"major_model_version":"([^"]*)"/) ||
        unescaped.match(/"model":"([^"]*)"/);
      if (modelMatch && modelMatch[1]) {
        modelName = normalizeModelName(modelMatch[1]);
      } else {
        if (/chirp-v6-pro|suno-v6-pro|v6-pro|"v6-pro"|"v6 pro"/i.test(html)) {
          modelName = 'v6-pro';
        } else if (/chirp-v6|suno-v6|"v6"/i.test(html)) {
          modelName = 'v6';
        } else if (/chirp-v3-8|chirp-v3\.8|suno-v3\.8|"v3\.8"/i.test(html)) {
          modelName = 'v3.8';
        } else if (/chirp-v4|suno-v4|"v4"/i.test(html)) {
          modelName = 'v4';
        } else if (/chirp-v3-5|chirp-v3\.5|suno-v3\.5|"v3\.5"/i.test(html)) {
          modelName = 'v3.5';
        } else if (/chirp-v3|suno-v3|"v3"/i.test(html)) {
          modelName = 'v3';
        }
      }

      const imageUrl = ogImage || `https://cdn2.suno.ai/image_large_${songId}.jpeg`;

      if (title || ogImage || tags) {
        return {
          id: songId,
          title: title || 'Untitled Suno Track',
          displayName,
          handle,
          imageUrl,
          imageLargeUrl: imageUrl,
          duration,
          tags,
          prompt,
          modelName,
          createdAt: new Date().toISOString(),
          sourceUrl: `https://suno.com/song/${songId}`,
          audioUrl: `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${songId}.m4a`,
          isPublic: false,
          isUnlisted: true
        };
      }
    } catch {
      // Continue to next URL
    }
  }

  return null;
}

export async function getSongInfo(songId: string, options?: { rawUrl?: string }): Promise<SongInfo> {
  const cached = songInfoCache.get(songId);
  if (cached && cached.audioUrl && cached.title && cached.title !== 'Untitled Suno Track') {
    return cached;
  }

  const endpoints = [
    `https://studio-api-prod.suno.com/api/clip/${songId}`,
    `https://studio-api.prod.suno.com/api/clip/${songId}`
  ];

  let clipData: any = null;

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Origin: 'https://suno.com',
          Referer: `https://suno.com/song/${songId}`
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        clipData = await res.json();
        break;
      }
    } catch {
      // continue to next endpoint or HTML fallback
    }
  }

  if (clipData && (clipData.id || clipData.title)) {
    let progressiveUrl = '';
    if (Array.isArray(clipData.media_urls)) {
      const item = clipData.media_urls.find((m: any) => m.delivery === 'progressive') || clipData.media_urls[0];
      if (item?.url) {
        progressiveUrl = item.url;
      }
    }

    if (!progressiveUrl) {
      progressiveUrl = `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${songId}.m4a`;
    }

    const result: SongInfo = {
      id: clipData.id || songId,
      title: clipData.title || (cached?.title) || 'Untitled Suno Track',
      displayName: clipData.display_name || (cached?.displayName) || 'Suno Artist',
      handle: clipData.handle || (cached?.handle) || 'suno',
      imageUrl: clipData.image_large_url || clipData.image_url || `https://cdn2.suno.ai/image_${songId}.jpeg`,
      imageLargeUrl: clipData.image_large_url || clipData.image_url,
      avatarUrl: clipData.avatar_image_url,
      duration: clipData.metadata?.duration || 0,
      tags: clipData.metadata?.tags || clipData.display_tags || '',
      prompt: clipData.metadata?.prompt || '',
      modelName: normalizeModelName(
        clipData.model_name ||
        clipData.major_model_version ||
        clipData.metadata?.model_name ||
        cached?.modelName
      ),
      createdAt: clipData.created_at || new Date().toISOString(),
      playCount: clipData.play_count,
      upvoteCount: clipData.upvote_count,
      sourceUrl: `https://suno.com/song/${songId}`,
      audioUrl: progressiveUrl,
      isPublic: clipData.is_public !== undefined ? Boolean(clipData.is_public) : true,
      isUnlisted: clipData.is_public === false
    };

    songInfoCache.set(songId, result);
    return result;
  }

  // Fallback 1: HTML scraping fallback for unlisted / link-only songs
  const htmlResult = await fetchSongInfoFromHtml(songId, options?.rawUrl);
  if (htmlResult) {
    if (cached) {
      htmlResult.title = htmlResult.title !== 'Untitled Suno Track' ? htmlResult.title : cached.title;
      htmlResult.displayName = cached.displayName || htmlResult.displayName;
      htmlResult.handle = cached.handle || htmlResult.handle;
      htmlResult.duration = htmlResult.duration || cached.duration;
      htmlResult.modelName = htmlResult.modelName || normalizeModelName(cached.modelName);
    }
    songInfoCache.set(songId, htmlResult);
    return htmlResult;
  }

  // Fallback 2: Cached metadata from profile / unified feed
  if (cached && (cached.title || cached.displayName)) {
    const fallbackResult: SongInfo = {
      ...cached,
      id: songId,
      title: cached.title || 'Untitled Suno Track',
      displayName: cached.displayName || 'Suno Artist',
      handle: cached.handle || 'suno',
      imageUrl: cached.imageUrl || `https://cdn2.suno.ai/image_${songId}.jpeg`,
      audioUrl: cached.audioUrl || `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${songId}.m4a`,
      isPublic: cached.isPublic !== undefined ? cached.isPublic : false,
      isUnlisted: cached.isUnlisted !== undefined ? cached.isUnlisted : true,
      sourceUrl: cached.sourceUrl || `https://suno.com/song/${songId}`,
      duration: cached.duration || 0,
      tags: cached.tags || '',
      prompt: cached.prompt || '',
      modelName: normalizeModelName(cached.modelName),
      createdAt: cached.createdAt || new Date().toISOString()
    };
    songInfoCache.set(songId, fallbackResult);
    return fallbackResult;
  }

  throw new Error(`Song not found on Suno (ID: ${songId}). The track may be private, unlisted without valid link, or deleted.`);
}

// AES-GCM unwrapper using Node crypto
function decryptWrappedKey(b64Data: string, aad: string, userKeyHash: Buffer): Buffer {
  const buf = Buffer.from(b64Data, 'base64');
  const iv = buf.subarray(0, 12);
  const ciphertextWithTag = buf.subarray(12);
  const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', userKeyHash, iv);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

const inFlightDecryptions = new Map<string, Promise<string>>();
const inFlightConversions = new Map<string, Promise<string>>();

export async function getDecryptedAudioPath(songId: string): Promise<string> {
  const cachedM4a = path.join(CACHE_DIR, `${songId}.m4a`);
  if (fs.existsSync(cachedM4a) && fs.statSync(cachedM4a).size > 1000) {
    return cachedM4a;
  }

  // Deduplicate concurrent decryptions for the same songId
  if (inFlightDecryptions.has(songId)) {
    return inFlightDecryptions.get(songId)!;
  }

  const task = (async () => {
    try {
      // 1. Fetch Mango rights
      const rightsRes = await fetch('https://studio-api-prod.suno.com/api/mango/rights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Origin': 'https://suno.com',
          'Referer': `https://suno.com/song/${songId}`
        },
        body: JSON.stringify({
          content_params: {
            content_id: songId,
            content_type: 'clip'
          }
        })
      });

      if (!rightsRes.ok) {
        console.log(`[DRM Notice]: Mango rights returned ${rightsRes.status} for ${songId}. Checking for direct unencrypted audio or CDN...`);

        // Check if clip exists or fetch direct audio URLs
        let fallbackAudioBuffer: Buffer | null = null;
        const candidateUrls: string[] = [
          `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${songId}.m4a`,
          `https://cdn1.suno.ai/${songId}.mp3`,
          `https://audiopipe.suno.ai/?item_id=${songId}`
        ];

        try {
          const clipInfoRes = await fetch(`https://studio-api-prod.suno.com/api/clip/${songId}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          if (clipInfoRes.ok) {
            const clipData = await clipInfoRes.json();
            if (clipData?.audio_url && !clipData.audio_url.includes('api/forbidden')) {
              candidateUrls.unshift(clipData.audio_url);
            }
            if (Array.isArray(clipData?.media_urls)) {
              for (const m of clipData.media_urls) {
                if (m?.url) candidateUrls.unshift(m.url);
              }
            }
          }
        } catch {
          // Ignore clip endpoint errors and proceed to candidate CDN URLs
        }

        // Attempt downloading from candidate URLs
        for (const url of candidateUrls) {
          try {
            const directRes = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });
            if (directRes.ok) {
              const buf = Buffer.from(await directRes.arrayBuffer());
              if (buf.length > 2000) {
                fallbackAudioBuffer = buf;
                break;
              }
            }
          } catch {}
        }

        if (fallbackAudioBuffer) {
          const tempFile = path.join(CACHE_DIR, `${songId}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}.m4a`);
          fs.writeFileSync(tempFile, fallbackAudioBuffer);
          try {
            fs.renameSync(tempFile, cachedM4a);
          } catch {
            try {
              fs.copyFileSync(tempFile, cachedM4a);
              fs.unlinkSync(tempFile);
            } catch {}
          }
          if (fs.existsSync(cachedM4a) && fs.statSync(cachedM4a).size > 1000) {
            return cachedM4a;
          }
        }

        if (rightsRes.status === 404) {
          throw new Error(`Song not found on Suno (ID: ${songId}). It may have been deleted or removed by its creator.`);
        }
        throw new Error(`Failed to obtain DRM license from Suno (${rightsRes.status})`);
      }

      const { key: encKeyB64, iv: encIvB64, glt } = await rightsRes.json();
      if (!encKeyB64 || !encIvB64 || !glt) {
        throw new Error('Incomplete rights response from Suno');
      }

      // 2. Derive user key and decrypt content key & iv
      const userKeyHash = crypto.createHash('sha256').update(glt).digest();
      const rawKey = decryptWrappedKey(encKeyB64, songId, userKeyHash);
      const rawIv = decryptWrappedKey(encIvB64, songId, userKeyHash);

      // 3. Download encrypted audio
      const audioUrl = `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${songId}.m4a`;
      const audioRes = await fetch(audioUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!audioRes.ok) {
        if (audioRes.status === 404) {
          throw new Error(`Song not found on Suno (ID: ${songId}). It may have been deleted or removed by its creator.`);
        }
        throw new Error(`Failed to download encrypted audio stream (${audioRes.status})`);
      }

      const encBuffer = Buffer.from(await audioRes.arrayBuffer());

      // 4. Decrypt audio using AES-CTR
      const cipherAlg = rawKey.length === 16 ? 'aes-128-ctr' : 'aes-256-ctr';
      const decipher = crypto.createDecipheriv(cipherAlg, rawKey, rawIv);
      const decBuffer = Buffer.concat([decipher.update(encBuffer), decipher.final()]);

      const tempFile = path.join(CACHE_DIR, `${songId}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}.m4a`);
      fs.writeFileSync(tempFile, decBuffer);
      try {
        fs.renameSync(tempFile, cachedM4a);
      } catch {
        try {
          fs.copyFileSync(tempFile, cachedM4a);
          fs.unlinkSync(tempFile);
        } catch {}
      }

      if (!fs.existsSync(cachedM4a) || fs.statSync(cachedM4a).size < 1000) {
        throw new Error(`Decrypted audio file for ${songId} is invalid or empty.`);
      }

      return cachedM4a;
    } finally {
      inFlightDecryptions.delete(songId);
    }
  })();

  inFlightDecryptions.set(songId, task);
  return task;
}

export async function getFormattedAudioPath(
  songId: string,
  format: AudioFormat,
  metadata?: { title?: string; artist?: string; bitDepth?: 16 | 24 }
): Promise<string> {
  const bitDepth = metadata?.bitDepth === 16 ? 16 : 24;
  // Use _pcm suffix to ensure newly encoded 44.1kHz universal PCM is used and old incompatible files are avoided
  const filename = format === 'wav' ? `${songId}_${bitDepth}bit_pcm.wav` : `${songId}.${format}`;
  const targetFile = path.join(CACHE_DIR, filename);
  if (fs.existsSync(targetFile) && fs.statSync(targetFile).size > 1000) {
    return targetFile;
  }

  const lockKey = `${songId}_${format}_${bitDepth}`;
  if (inFlightConversions.has(lockKey)) {
    return inFlightConversions.get(lockKey)!;
  }

  const task = (async () => {
    try {
      const sourceM4a = await getDecryptedAudioPath(songId);

      if (format === 'm4a') {
        return sourceM4a;
      }

      // Check again after decryption
      if (fs.existsSync(targetFile) && fs.statSync(targetFile).size > 1000) {
        return targetFile;
      }

      const tempTarget = path.join(CACHE_DIR, `${songId}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}.${filename}`);

      if (format === 'mp3') {
        // Convert to 320kbps MP3 with ID3 metadata tags
        const args = [
          '-y',
          '-i', sourceM4a,
          '-vn',
          '-c:a', 'libmp3lame',
          '-b:a', '320k',
          '-id3v2_version', '3',
          '-metadata', `title=${metadata?.title || 'Suno Music'}`,
          '-metadata', `artist=${metadata?.artist || 'Suno AI'}`,
          '-metadata', `comment=Downloaded with Suno MP3 & WAV Downloader`,
          tempTarget
        ];
        await execFileAsync('ffmpeg', args);
      } else if (format === 'wav') {
        // Convert to 100% standard universal PCM WAV:
        // 16-bit 44.1kHz stereo PCM is Red Book standard, universally playable on Windows Media Player, iOS, Android, macOS, car stereos, and older USB players.
        // 24-bit 48kHz is Studio Master for DAWs.
        const is16Bit = bitDepth === 16;
        const codec = is16Bit ? 'pcm_s16le' : 'pcm_s24le';
        const sampleRate = is16Bit ? '44100' : '48000';

        const args = [
          '-y',
          '-i', sourceM4a,
          '-vn',
          '-c:a', codec,
          '-ar', sampleRate,
          '-ac', '2',
          tempTarget
        ];
        await execFileAsync('ffmpeg', args);
      }

      if (fs.existsSync(tempTarget)) {
        try {
          fs.renameSync(tempTarget, targetFile);
        } catch {
          try {
            fs.copyFileSync(tempTarget, targetFile);
            fs.unlinkSync(tempTarget);
          } catch {}
        }
      }

      if (!fs.existsSync(targetFile) || fs.statSync(targetFile).size < 1000) {
        throw new Error(`Converted audio file for ${songId} (${format.toUpperCase()}) is invalid or empty.`);
      }

      return targetFile;
    } finally {
      inFlightConversions.delete(lockKey);
    }
  })();

  inFlightConversions.set(lockKey, task);
  return task;
}

export function sanitizeFilename(filename: string): string {
  if (!filename) return 'suno_audio';
  // Replace invalid filesystem characters (< > : " / \ | ? * and ASCII control characters)
  // Strictly preserves all Khmer, Southeast Asian, Unicode, spaces, and alphanumeric characters
  const cleaned = filename
    .replace(/[:]/g, ' - ')
    .replace(/[<>"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/, '')
    .trim();
  return cleaned.slice(0, 150) || 'suno_audio';
}

export function isProfileQuery(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.startsWith('@')) return true;
  if (trimmed.includes('suno.com/@')) return true;
  if (/^https?:\/\/[^\/]+\/@/.test(trimmed)) return true;
  if (trimmed.includes('page=playlists')) return true;
  if (trimmed.includes('me/playlists') || trimmed.includes('/me/playlists')) return true;
  // Automatically support suno.com/me, /me, and variations
  if (
    trimmed.includes('suno.com/me') ||
    /^https?:\/\/[^\/]+\/me\b/i.test(trimmed) ||
    trimmed.toLowerCase() === 'me' ||
    trimmed.toLowerCase() === '/me'
  ) {
    return true;
  }
  // Automatically support suno.com/create, /create, create, and create?wid=default (unless URL contains direct song UUID)
  const hasUuid = UUID_REGEX.test(trimmed);
  if (
    !hasUuid && (
      trimmed.includes('suno.com/create') ||
      /^https?:\/\/[^\/]+\/create\b/i.test(trimmed) ||
      trimmed.toLowerCase() === 'create' ||
      trimmed.toLowerCase() === '/create' ||
      trimmed.toLowerCase().startsWith('create?') ||
      trimmed.toLowerCase().startsWith('/create?') ||
      trimmed.toLowerCase().includes('create?wid=')
    )
  ) {
    return true;
  }
  return false;
}

export function extractProfileHandle(input: string, fallbackHandle: string = 'musicsabay'): string {
  let trimmed = input.trim();
  // Strip query parameters (?page=playlists, ?wid=default, etc.) and hash fragments
  trimmed = trimmed.replace(/[?#].*$/, '');

  // Automatically resolve suno.com/me, /me, suno.com/create, /create, suno.com/me/playlists, me/playlists to the configured/fallback handle
  if (
    trimmed.includes('suno.com/me') ||
    trimmed.includes('suno.com/create') ||
    /^https?:\/\/[^\/]+\/me\b/i.test(trimmed) ||
    /^https?:\/\/[^\/]+\/create\b/i.test(trimmed) ||
    trimmed.toLowerCase() === 'me' ||
    trimmed.toLowerCase() === '/me' ||
    trimmed.toLowerCase() === 'create' ||
    trimmed.toLowerCase() === '/create' ||
    trimmed.toLowerCase().includes('me/playlists')
  ) {
    return (fallbackHandle || 'musicsabay').replace(/^@/, '').trim();
  }

  // If it's a full URL e.g. https://suno.com/@musicsabay
  const urlMatch = trimmed.match(/suno\.com\/@([a-zA-Z0-9_\-]+)/i);
  if (urlMatch) return urlMatch[1];

  // If starts with @
  if (trimmed.startsWith('@')) {
    return trimmed.slice(1).replace(/\/.*$/, '').trim();
  }

  // Generic handle match
  return trimmed.replace(/^https?:\/\/[^\/]+\/@?/i, '').replace(/\/.*$/, '').trim();
}

export const discoveredUnlistedSongs = new Map<string, ProfileSongItem[]>();

export function addDiscoveredUnlistedSong(handle: string, song: ProfileSongItem) {
  const cleanHandle = handle.toLowerCase().replace(/^@/, '').trim();
  const existing = discoveredUnlistedSongs.get(cleanHandle) || [];
  if (!existing.some((s) => s.id === song.id)) {
    discoveredUnlistedSongs.set(cleanHandle, [song, ...existing]);
  }
}

export function getDiscoveredUnlistedSongs(handle: string): ProfileSongItem[] {
  const cleanHandle = handle.toLowerCase().replace(/^@/, '').trim();
  return discoveredUnlistedSongs.get(cleanHandle) || [];
}

async function fetchUnifiedFeedSongs(
  targetUserId: string,
  handle: string,
  displayName: string
): Promise<ProfileSongItem[]> {
  const gathered: ProfileSongItem[] = [];
  const seen = new Set<string>();
  let cursor: any = undefined;
  let page = 1;
  const maxPages = 15; // Safety cap of up to 750 songs

  while (page <= maxPages) {
    try {
      const body: any = {
        feed_id: 'user_songs',
        target_user_id: targetUserId,
        page_size: 50
      };
      if (cursor !== undefined && cursor !== null) {
        body.cursor = cursor;
      }

      const res = await fetch('https://studio-api.prod.suno.com/api/unified/feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Origin': 'https://suno.com',
          'Referer': `https://suno.com/@${handle}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        console.warn(`[Unified Feed] Fetch failed status ${res.status} for target user ${targetUserId}`);
        break;
      }

      const data = await res.json();
      const items = data.feed?.items || [];
      if (items.length === 0) break;

      for (const it of items) {
        const clip = it.content_item || {};
        const id = clip.id || it.content_id;
        if (!id || seen.has(id)) continue;
        seen.add(id);

        const title = clip.title || 'Untitled Suno Track';
        const isPublic = clip.is_public !== false && !clip.is_unlisted;
        const isUnlisted = !isPublic;
        const duration =
          typeof clip.metadata?.duration === 'number'
            ? clip.metadata.duration
            : typeof clip.duration === 'number'
            ? clip.duration
            : 0;
        const imageUrl = clip.image_url || clip.image_large_url || `https://cdn2.suno.ai/image_${id}.jpeg`;
        const createdAt = clip.created_at || '';
        const tags = clip.metadata?.tags || clip.display_tags || '';
        const rawModel = clip.model_name || clip.major_model_version || clip.metadata?.model_name || '';
        const modelName = normalizeModelName(rawModel);

        const songItem: ProfileSongItem = {
          id,
          title,
          imageUrl,
          duration,
          createdAt,
          tags,
          modelName,
          isPublic,
          isUnlisted
        };

        gathered.push(songItem);

        // Pre-cache song metadata
        setCachedSongInfo(id, {
          id,
          title,
          displayName: clip.display_name || displayName,
          handle: clip.handle || handle,
          imageUrl,
          duration,
          tags,
          modelName,
          isPublic,
          isUnlisted,
          audioUrl: clip.audio_url || undefined
        });
      }

      if (data.feed?.next_cursor && items.length > 0) {
        cursor = data.feed.next_cursor;
        page++;
      } else {
        break;
      }
    } catch (err: any) {
      console.warn(`[Unified Feed] Error fetching page ${page}:`, err?.message || err);
      break;
    }
  }

  return gathered;
}

async function fetchUnifiedFeedPlaylists(
  targetUserId: string,
  handle: string,
  displayName: string
): Promise<{ id: string; name: string; imageUrl?: string; songCount: number; userHandle: string; userDisplayName?: string }[]> {
  const playlists: { id: string; name: string; imageUrl?: string; songCount: number; userHandle: string; userDisplayName?: string }[] = [];
  const seen = new Set<string>();

  try {
    const res = await fetch('https://studio-api.prod.suno.com/api/unified/feed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Origin': 'https://suno.com',
        'Referer': `https://suno.com/@${handle}`
      },
      body: JSON.stringify({
        feed_id: 'user_playlists',
        target_user_id: targetUserId,
        page_size: 50
      })
    });

    if (res.ok) {
      const data = await res.json();
      const items = data.feed?.items || [];
      for (const it of items) {
        const p = it.content_item || {};
        const pId = p.playlist_id || it.content_id;
        if (!pId || seen.has(pId)) continue;
        seen.add(pId);
        playlists.push({
          id: pId,
          name: p.playlist_name || `${displayName}'s Playlist`,
          imageUrl: p.playlist_image_url || '',
          songCount: p.playlist_song_count || 0,
          userHandle: p.playlist_user_handle || handle,
          userDisplayName: p.playlist_user_display_name || displayName
        });
      }
    }
  } catch (err) {
    console.warn(`[fetchUnifiedFeedPlaylists] Error for user ${targetUserId}:`, err);
  }

  return playlists;
}

export async function getProfileInfo(handleInput: string, fallbackHandle: string = 'musicsabay'): Promise<ProfileInfo> {
  const handle = extractProfileHandle(handleInput, fallbackHandle);
  if (!handle) {
    throw new Error(`Invalid profile handle or URL: ${handleInput}`);
  }

  const url = `https://suno.com/@${handle}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Origin': 'https://suno.com',
      'Referer': 'https://suno.com/'
    }
  });

  if (!res.ok) {
    throw new Error(`Suno profile not found or inaccessible (${res.status}) for @${handle}`);
  }

  let html = await res.text();
  html = html.replace(/\\"/g, '"').replace(/\\\//g, '/');

  const profileMatch = html.match(/"stats":\{"followers_count":(\d+),"likes_count":(\d+),"clips_count":(\d+)/);
  const avatarMatch = html.match(/"avatar_image_url":"([^"]+)"/);
  const nameMatch = html.match(/"display_name":"([^"]+)"/);
  const bioMatch = html.match(/"profile_description":"([^"]*)"/);

  const displayName = nameMatch ? nameMatch[1] : handle;

  // 1. Try to fetch the full unified feed using the creator external_user_id or user_id
  const extUserMatch = html.match(/"(?:external_user_id|user_id)":"([0-9a-f-]{36})"/);
  let songs: ProfileSongItem[] = [];
  const seen = new Set<string>();
  const playlists: { id: string; name: string; imageUrl?: string; songCount: number; userHandle: string; userDisplayName?: string }[] = [];
  const seenPlaylists = new Set<string>();

  if (extUserMatch && extUserMatch[1]) {
    const targetUserId = extUserMatch[1];
    try {
      const feedSongs = await fetchUnifiedFeedSongs(targetUserId, handle, displayName);
      for (const s of feedSongs) {
        if (!seen.has(s.id)) {
          seen.add(s.id);
          songs.push(s);
        }
      }
    } catch (feedErr: any) {
      console.warn(`[getProfileInfo] Unified feed error for @${handle}:`, feedErr?.message || feedErr);
    }

    try {
      const feedPlaylists = await fetchUnifiedFeedPlaylists(targetUserId, handle, displayName);
      for (const p of feedPlaylists) {
        if (!seenPlaylists.has(p.id)) {
          seenPlaylists.add(p.id);
          playlists.push(p);
        }
      }
    } catch (feedPlErr: any) {
      console.warn(`[getProfileInfo] Unified feed playlists error for @${handle}:`, feedPlErr?.message || feedPlErr);
    }
  }

  // 2. Fallback / supplementary extraction from static HTML
  const regex =
    /"content_item":\{"status":"complete","title":"([^"]+)"[\s\S]*?"id":"([0-9a-f-]{36})"[\s\S]*?"image_url":"([^"]*)"[\s\S]*?"duration":([\d\.]+)[\s\S]*?"created_at":"([^"]*)"(?:[\s\S]*?"display_tags":"([^"]*)")?/g;

  let m;
  while ((m = regex.exec(html)) !== null) {
    const title = m[1];
    const id = m[2];
    const imageUrl = m[3] || `https://cdn2.suno.ai/image_${id}.jpeg`;
    const duration = parseFloat(m[4]) || 0;
    const createdAt = m[5];
    const tags = m[6] || '';

    if (!seen.has(id)) {
      seen.add(id);
      const isExplicitlyPrivate = m[0].includes('"is_public":false');
      const isPublic = !isExplicitlyPrivate;
      const modelMatch = m[0].match(/"(?:model_name|major_model_version)":"([^"]*)"/);
      const modelName = normalizeModelName(modelMatch ? modelMatch[1] : undefined);
      songs.push({ id, title, imageUrl, duration, createdAt, tags, modelName, isPublic, isUnlisted: !isPublic });
      setCachedSongInfo(id, {
        id,
        title,
        displayName,
        handle,
        imageUrl,
        duration,
        tags,
        modelName,
        isPublic,
        isUnlisted: !isPublic
      });
    }
  }

  // 3. Automatically append any unlisted tracks previously discovered for this handle
  const unlistedDiscovered = getDiscoveredUnlistedSongs(handle);
  for (const us of unlistedDiscovered) {
    if (!seen.has(us.id)) {
      seen.add(us.id);
      songs.unshift(us); // Put discovered unlisted songs up front
    }
  }

  // Extract playlists from Suno profile
  const pRegex =
    /"playlist_id":"([0-9a-f-]{36})"[^\}]*?"playlist_name":"([^"]+)"(?:[^\}]*?"playlist_image_url":"([^"]*)")?(?:[^\}]*?"playlist_song_count":(\d+))?/g;
  let pm;

  while ((pm = pRegex.exec(html)) !== null) {
    const pId = pm[1];
    if (!seenPlaylists.has(pId)) {
      seenPlaylists.add(pId);
      playlists.push({
        id: pId,
        name: pm[2] || `${displayName}'s Playlist`,
        imageUrl: pm[3] || '',
        songCount: pm[4] ? parseInt(pm[4], 10) : 0,
        userHandle: handle,
        userDisplayName: displayName
      });
    }
  }

  // Fallback pattern if playlists_feed items used different order
  const fallbackPRegex = /"playlist_id":"([0-9a-f-]{36})"/g;
  let fpm;
  while ((fpm = fallbackPRegex.exec(html)) !== null) {
    const pId = fpm[1];
    if (!seenPlaylists.has(pId)) {
      seenPlaylists.add(pId);
      playlists.push({
        id: pId,
        name: `${displayName}'s Playlist`,
        imageUrl: '',
        songCount: 0,
        userHandle: handle,
        userDisplayName: displayName
      });
    }
  }

  return {
    handle,
    displayName,
    avatarUrl: avatarMatch ? avatarMatch[1] : '',
    bio: bioMatch ? bioMatch[1] : '',
    followersCount: profileMatch ? parseInt(profileMatch[1], 10) : 0,
    clipsCount: profileMatch ? Math.max(parseInt(profileMatch[3], 10), songs.length) : songs.length,
    songs,
    playlists,
    primaryPlaylistId: playlists.length > 0 ? playlists[0].id : undefined
  };
}

export async function getCreatorPlaylist(handleInput: string, fallbackHandle: string = 'musicsabay'): Promise<{ playlist?: PlaylistInfo; profile: ProfileInfo; isPlaylist: boolean }> {
  const profile = await getProfileInfo(handleInput, fallbackHandle);

  // If creator has public Suno playlists, fetch the primary one
  if (profile.playlists && profile.playlists.length > 0) {
    try {
      const playlistId = profile.playlists[0].id;
      const playlist = await getPlaylistInfo(playlistId);
      return { playlist, profile, isPlaylist: true };
    } catch (err) {
      console.warn(`[getCreatorPlaylist] Could not fetch primary playlist for @${profile.handle}, using songs fallback:`, err);
    }
  }

  // If creator has no dedicated playlist but has songs, generate a virtual playlist
  if (profile.songs && profile.songs.length > 0) {
    const totalDuration = profile.songs.reduce((acc, s) => acc + (s.duration || 0), 0);
    const virtualPlaylist: PlaylistInfo = {
      id: `profile-${profile.handle}`,
      name: `${profile.displayName || profile.handle}'s Songs`,
      description: profile.bio || `Tracks created by @${profile.handle}`,
      imageUrl: profile.songs[0]?.imageUrl || profile.avatarUrl,
      userDisplayName: profile.displayName || profile.handle,
      userHandle: profile.handle,
      userAvatarUrl: profile.avatarUrl,
      songCount: profile.songs.length,
      totalDuration: Math.round(totalDuration),
      sourceUrl: `https://suno.com/@${profile.handle}`,
      songs: profile.songs
    };
    return { playlist: virtualPlaylist, profile, isPlaylist: true };
  }

  return { profile, isPlaylist: false };
}

export function isPlaylistQuery(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.includes('suno.com/playlist/')) return true;
  if (/^https?:\/\/[^\/]+\/playlist\/[0-9a-f\-]{36}/i.test(trimmed)) return true;
  if (/^playlist\/[0-9a-f\-]{36}/i.test(trimmed)) return true;
  return false;
}

export function extractPlaylistId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(UUID_REGEX);
  if (match) return match[0];
  throw new Error(`Could not extract a valid Suno Playlist ID from: ${input}`);
}

export async function getPlaylistInfo(idOrUrl: string): Promise<PlaylistInfo> {
  const playlistId = extractPlaylistId(idOrUrl);
  const url = `https://studio-api-prod.suno.com/api/playlist/${playlistId}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Origin': 'https://suno.com',
      'Referer': `https://suno.com/playlist/${playlistId}`
    }
  });

  if (!res.ok) {
    throw new Error(`Suno playlist not found or inaccessible (${res.status}) for ID ${playlistId}`);
  }

  const data = await res.json();

  const songs: ProfileSongItem[] = [];
  const seenIds = new Set<string>();

  const processClips = (clipsList: any[]) => {
    if (!Array.isArray(clipsList)) return;
    const playlistCreator = data.user_display_name || 'Suno Creator';
    const playlistHandle = data.user_handle || '';

    for (const item of clipsList) {
      const clip = item?.clip || item;
      if (!clip || !clip.id) continue;
      if (seenIds.has(clip.id)) continue;
      seenIds.add(clip.id);

      const songTitle = clip.title || 'Untitled Track';
      const songArtist = clip.display_name || playlistCreator;
      const songImg = clip.image_large_url || clip.image_url || `https://cdn2.suno.ai/image_${clip.id}.jpeg`;
      const songDur = clip.metadata?.duration || clip.duration || 0;
      const songTags = clip.metadata?.tags || clip.display_tags || '';
      const rawModel = clip.model_name || clip.major_model_version || clip.metadata?.model_name || '';
      const modelName = normalizeModelName(rawModel);

      songs.push({
        id: clip.id,
        title: songTitle,
        imageUrl: songImg,
        duration: songDur,
        createdAt: clip.created_at || new Date().toISOString(),
        tags: songTags,
        modelName
      });

      setCachedSongInfo(clip.id, {
        id: clip.id,
        title: songTitle,
        displayName: songArtist,
        handle: clip.handle || playlistHandle,
        imageUrl: songImg,
        duration: songDur,
        tags: songTags,
        modelName
      });
    }
  };

  processClips(data.playlist_clips);

  // If there are more pages, fetch up to page 5
  const totalExpected = data.num_total_results || data.song_count || songs.length;
  if (totalExpected > songs.length) {
    let currentPage = 2;
    while (songs.length < totalExpected && currentPage <= 5) {
      try {
        const pageRes = await fetch(`${url}?page=${currentPage}`, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': `https://suno.com/playlist/${playlistId}`
          }
        });
        if (!pageRes.ok) break;
        const pageData = await pageRes.json();
        const pageClips = pageData.playlist_clips;
        if (!pageClips || pageClips.length === 0) break;
        const prevCount = songs.length;
        processClips(pageClips);
        if (songs.length === prevCount) break;
        currentPage++;
      } catch {
        break;
      }
    }
  }

  return {
    id: data.id || playlistId,
    name: data.name || 'Suno Playlist',
    description: data.description || '',
    imageUrl: data.image_url || (songs[0] ? songs[0].imageUrl : ''),
    userDisplayName: data.user_display_name || 'Suno Creator',
    userHandle: data.user_handle || '',
    userAvatarUrl: data.user_avatar_image_url || '',
    songCount: songs.length,
    totalDuration: data.total_duration || songs.reduce((acc, s) => acc + (s.duration || 0), 0),
    sourceUrl: `https://suno.com/playlist/${playlistId}`,
    songs
  };
}


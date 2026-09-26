/**
 * High-Performance Universal File Downloader
 *
 * Supports robust single-song downloads (Lossless WAV ~40MB+, MP3 320k, M4A)
 * and multi-track ZIP packages.
 *
 * Guaranteed to work smoothly across:
 * - Sandboxed Iframes (AI Studio preview, Blogger embeds)
 * - Standard tabs and mobile browsers (iOS Safari, Android Chrome)
 * - Standalone desktop browsers
 */

export interface DownloadOptions {
  onProgress?: (percent: number, loadedBytes: number, totalBytes: number) => void;
  onStatusChange?: (
    status: 'starting' | 'converting' | 'downloading' | 'saving' | 'completed' | 'error',
    message?: string
  ) => void;
  timeoutMs?: number;
}

/**
 * Triggers a download from an in-memory Blob or Object URL.
 * This is 100% reliable in iframes because it does not trigger cross-origin navigation.
 */
export function triggerBlobDownload(blobUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  // Cleanup after browser acknowledges the click
  setTimeout(() => {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
  }, 2000);
}

/**
 * Triggers native browser download via hidden iframe navigation or direct link.
 */
export function triggerNativeDownload(url: string, filename?: string): void {
  // Method 1: Invisible iframe - avoids iframe top-level navigation blocks
  const iframeId = '__suno_single_download_iframe__';
  let iframe = document.getElementById(iframeId) as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.name = iframeId;
    iframe.style.display = 'none';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.position = 'absolute';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    document.body.appendChild(iframe);
  }
  iframe.src = url;

  // Method 2: Anchor click backup
  setTimeout(() => {
    const link = document.createElement('a');
    link.href = url;
    if (filename) {
      link.setAttribute('download', filename);
    }
    link.target = '_blank';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) link.parentNode.removeChild(link);
    }, 2000);
  }, 200);
}

/**
 * Parses Unicode or ASCII filename from Content-Disposition header.
 */
function extractFilenameFromHeader(disposition: string | null): string | null {
  if (!disposition) return null;

  // Prefer RFC 5987 UTF-8 encoded filename (filename*=UTF-8''...)
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {}
  }

  // Fallback to standard filename="..."
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  if (plainMatch && plainMatch[1]) {
    return plainMatch[1].trim();
  }

  return null;
}

/**
 * Universal Streaming Downloader with Progress Tracking & Iframe Resilience.
 *
 * 1. Fetches stream directly from server with live percentage updates.
 * 2. Assembles into a Blob in memory.
 * 3. Saves to disk via `URL.createObjectURL(blob)`, completely bypassing
 *    iframe navigation blocks, expired user-gesture issues, and browser interventions.
 */
export async function downloadWithSmoothStream(
  url: string,
  suggestedFilename?: string,
  optionsOrTimeout?: DownloadOptions | number
): Promise<void> {
  const options: DownloadOptions =
    typeof optionsOrTimeout === 'number'
      ? { timeoutMs: optionsOrTimeout }
      : optionsOrTimeout || {};

  const timeoutMs = options.timeoutMs || 120000; // Allow up to 2 mins for heavy WAV conversions
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  options.onStatusChange?.('converting', 'Preparing audio stream...');

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMsg = `Server returned HTTP ${response.status}`;
      try {
        const rawText = await response.text();
        try {
          const errJson = JSON.parse(rawText);
          const customMsg = errJson?.error || errJson?.message || errJson?.detail;
          if (customMsg && typeof customMsg === 'string') {
            errorMsg = customMsg;
          }
        } catch {
          if (rawText && rawText.trim()) {
            const cleanText = rawText.replace(/<[^>]*>/g, '').trim().slice(0, 150);
            if (cleanText && !cleanText.toLowerCase().includes('html')) {
              errorMsg = cleanText;
            }
          }
        }
      } catch {}

      if (response.status === 404) {
        if (!errorMsg || errorMsg.includes('HTTP 404')) {
          errorMsg = 'Song not found on Suno. It may have been deleted, unlisted, or private.';
        }
      } else if (response.status === 500) {
        if (errorMsg === `Server returned HTTP 500` || errorMsg.toLowerCase().includes('internal server error')) {
          errorMsg = 'Failed to process audio stream. The song DRM license or audio source is temporarily unavailable on Suno.';
        }
      }

      options.onStatusChange?.('error', errorMsg);
      const httpErr = new Error(errorMsg);
      (httpErr as any).status = response.status;
      throw httpErr;
    }

    // Determine target filename
    const headerFilename = extractFilenameFromHeader(response.headers.get('content-disposition'));
    const resolvedFilename = suggestedFilename || headerFilename || 'suno_audio.wav';

    // Content length for progress calculation
    const contentLengthHeader = response.headers.get('content-length');
    const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

    options.onStatusChange?.('downloading', 'Downloading audio data...');

    let blob: Blob;

    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          if (totalBytes > 0 && options.onProgress) {
            const percent = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
            options.onProgress(percent, receivedBytes, totalBytes);
          }
        }
      }

      const mimeType =
        response.headers.get('content-type') ||
        (resolvedFilename.endsWith('.wav')
          ? 'audio/wav'
          : resolvedFilename.endsWith('.mp3')
          ? 'audio/mpeg'
          : 'application/octet-stream');

      blob = new Blob(chunks, { type: mimeType });
    } else {
      blob = await response.blob();
    }

    options.onStatusChange?.('saving', 'Saving file...');
    options.onProgress?.(100, blob.size, blob.size);

    // Create object URL and trigger download
    const blobUrl = URL.createObjectURL(blob);
    triggerBlobDownload(blobUrl, resolvedFilename);

    // Keep object URL active long enough for download manager to claim
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60000);

    options.onStatusChange?.('completed', 'Download completed');
  } catch (err: any) {
    clearTimeout(timeoutId);

    // Only attempt native download fallback if this was a network transport error (e.g. strict CSP / CORS in third-party iframe)
    // NEVER re-request the URL via fallback iframe/window if the server already returned an explicit HTTP error (4xx/5xx) or user aborted
    const isExplicitHttpError = Boolean(err?.status && err.status >= 400);
    const isAbort = err?.name === 'AbortError';

    if (!isExplicitHttpError && !isAbort) {
      try {
        options.onStatusChange?.('downloading', 'Retrying via fallback...');
        triggerNativeDownload(url, suggestedFilename);
      } catch (fallbackErr) {
        // Silent fallback failure
      }
    }

    if (isAbort) {
      throw new Error('Download timed out. Please check your internet connection or try again.');
    }
    throw err;
  }
}

/**
 * Downloads a batch ZIP archive using fetch stream with byte progress tracking
 * and triggers blob download, fully resilient against sandboxed iframes.
 */
export async function downloadBatchZipViaStream(
  url: string,
  payload: {
    songs?: any[];
    songIds?: string[];
    format?: string;
    bitDepth?: number;
    name?: string;
  },
  suggestedFilename?: string,
  options?: {
    onProgress?: (receivedBytes: number, totalBytes?: number) => void;
    onStatusChange?: (status: string) => void;
  }
): Promise<void> {
  options?.onStatusChange?.('Connecting to packaging service...');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errorMsg = `Server error ${response.status}`;
    try {
      const errData = await response.json();
      if (errData?.error) errorMsg = errData.error;
    } catch {}
    throw new Error(errorMsg);
  }

  const headerFilename = extractFilenameFromHeader(response.headers.get('content-disposition'));
  const finalFilename = suggestedFilename || headerFilename || `${payload.name || 'playlist'}.zip`;

  const contentLength = response.headers.get('content-length');
  const totalBytes = contentLength ? parseInt(contentLength, 10) : undefined;

  let blob: Blob;
  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    options?.onStatusChange?.('Streaming ZIP archive...');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        receivedBytes += value.length;
        options?.onProgress?.(receivedBytes, totalBytes);
      }
    }
    blob = new Blob(chunks, { type: 'application/zip' });
  } else {
    blob = await response.blob();
  }

  options?.onStatusChange?.('Saving ZIP archive...');
  const blobUrl = URL.createObjectURL(blob);
  triggerBlobDownload(blobUrl, finalFilename);

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 60000);
}

// Safe JSON stringify that removes circular references, DOM nodes, and window references
function safeFormValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val !== 'object') return String(val);
  try {
    const seen = new WeakSet();
    return JSON.stringify(val, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (value instanceof Node || value instanceof Window || 'nodeType' in value) {
          return undefined;
        }
        if (seen.has(value)) {
          return undefined;
        }
        seen.add(value);
      }
      return value;
    });
  } catch {
    return '';
  }
}

/**
 * Submits a POST request for batch ZIP generation using a hidden HTML form
 * targeting an invisible iframe. This streams the generated ZIP directly to the
 * browser's native download manager without freezing the JavaScript thread.
 */
export function downloadBatchZipViaForm(
  url: string,
  payload: {
    songs?: any[];
    songIds?: string[];
    format?: string;
    bitDepth?: number;
    name?: string;
  }
): void {
  // Ensure an invisible download iframe exists
  const iframeId = '__suno_download_stream_iframe__';
  let iframe = document.getElementById(iframeId) as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.name = iframeId;
    iframe.style.display = 'none';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.position = 'absolute';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    document.body.appendChild(iframe);
  }

  // Create temporary form
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  form.target = iframeId;
  form.style.display = 'none';

  // application/x-www-form-urlencoded with stringified fields
  form.enctype = 'application/x-www-form-urlencoded';

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = safeFormValue(value);
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();

  setTimeout(() => {
    if (form.parentNode) {
      form.parentNode.removeChild(form);
    }
  }, 3000);
}

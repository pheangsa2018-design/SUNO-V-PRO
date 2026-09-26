import React, { useState } from 'react';
import {
  FolderArchive,
  FileJson,
  FileSpreadsheet,
  ListMusic,
  Copy,
  Check,
  Download,
  X,
  Sparkles,
  Music,
  User,
  ExternalLink,
  ShieldCheck,
  Disc3,
  Loader2
} from 'lucide-react';
import type { ProfileInfo, ProfileSongItem, AudioFormat } from '../types.js';
import type { Language } from '../i18n.js';
import { translations } from '../i18n.js';
import { ModelBadge } from './ModelBadge.js';

interface ProfileDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileInfo;
  songs: ProfileSongItem[];
  lang: Language;
  onDownloadAllZip: (format: AudioFormat | 'both', bitDepth?: 16 | 24) => void;
  zipDownloading: AudioFormat | 'both' | null;
}

export const ProfileDataModal: React.FC<ProfileDataModalProps> = ({
  isOpen,
  onClose,
  profile,
  songs,
  lang,
  onDownloadAllZip,
  zipDownloading
}) => {
  const t = translations[lang];
  const [copiedLinks, setCopiedLinks] = useState(false);
  const [copiedStreamLinks, setCopiedStreamLinks] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'audio' | 'data'>('all');

  if (!isOpen) return null;

  const handleName = profile.handle || 'suno_creator';
  const displayName = profile.displayName || profile.handle || 'Suno Creator';
  const totalDurationSec = songs.reduce((acc, s) => acc + (s.duration || 0), 0);
  const totalMinutes = Math.floor(totalDurationSec / 60);

  // 1. Export JSON Data
  const handleExportJson = () => {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      creator: {
        handle: profile.handle,
        displayName: profile.displayName,
        bio: profile.bio || '',
        avatarUrl: profile.avatarUrl || '',
        followersCount: profile.followersCount || 0,
        totalSongs: songs.length,
        totalDurationSeconds: totalDurationSec,
        playlistsCount: profile.playlists?.length || 0,
        sunoProfileUrl: `https://suno.com/@${profile.handle}`
      },
      songs: songs.map((s, idx) => ({
        index: idx + 1,
        id: s.id,
        title: s.title || 'Untitled Suno Track',
        modelName: s.modelName || 'Unknown',
        durationSeconds: s.duration || 0,
        durationFormatted: `${Math.floor((s.duration || 0) / 60)}:${Math.floor((s.duration || 0) % 60).toString().padStart(2, '0')}`,
        isPublic: s.isPublic !== false && !s.isUnlisted,
        isUnlisted: Boolean(s.isUnlisted || s.isPublic === false),
        imageUrl: s.imageUrl || '',
        sunoUrl: `https://suno.com/song/${s.id}`,
        streamAudioUrl: s.audioUrl || `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${s.id}.m4a`,
        downloadMp3Url: `/api/song/download/${s.id}?format=mp3`,
        downloadWavUrl: `/api/song/download/${s.id}?format=wav&bitDepth=16`,
        tags: s.tags || '',
        prompt: s.prompt || '',
        createdAt: s.createdAt || ''
      })),
      playlists: (profile.playlists || []).map((p) => ({
        id: p.id,
        name: p.name,
        songCount: p.songCount,
        url: `https://suno.com/playlist/${p.id}`
      }))
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${handleName}_profile_data.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 2. Export CSV / Excel Data (with UTF-8 BOM)
  const handleExportCsv = () => {
    const headers = [
      'Index',
      'Title',
      'Song ID',
      'AI Model',
      'Duration (MM:SS)',
      'Duration (Seconds)',
      'Visibility',
      'Suno Link',
      'Audio Stream CDN',
      'Download MP3 (API)',
      'Download WAV (API)',
      'Tags',
      'Prompt',
      'Created At'
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = songs.map((s, idx) => {
      const min = Math.floor((s.duration || 0) / 60);
      const sec = Math.floor((s.duration || 0) % 60).toString().padStart(2, '0');
      const isUnlisted = Boolean(s.isUnlisted || s.isPublic === false);
      const visibility = isUnlisted ? 'Unlisted' : 'Public';
      const audioUrl = s.audioUrl || `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${s.id}.m4a`;

      return [
        idx + 1,
        escapeCsv(s.title || 'Untitled'),
        escapeCsv(s.id),
        escapeCsv(s.modelName || 'v3.5'),
        escapeCsv(`${min}:${sec}`),
        s.duration || 0,
        escapeCsv(visibility),
        escapeCsv(`https://suno.com/song/${s.id}`),
        escapeCsv(audioUrl),
        escapeCsv(`/api/song/download/${s.id}?format=mp3`),
        escapeCsv(`/api/song/download/${s.id}?format=wav`),
        escapeCsv(s.tags || ''),
        escapeCsv(s.prompt || ''),
        escapeCsv(s.createdAt || '')
      ].join(',');
    });

    // Prepend UTF-8 Byte Order Mark (\uFEFF) for Excel compatibility
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${handleName}_tracks.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 3. Export M3U8 Playlist
  const handleExportM3u = () => {
    let m3u = '#EXTM3U\n';
    m3u += `#PLAYLIST:${displayName} (@${handleName})\n\n`;

    for (const song of songs) {
      const dur = Math.round(song.duration || 180);
      const artist = displayName;
      const title = song.title || 'Untitled';
      const streamUrl = song.audioUrl || `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${song.id}.m4a`;

      m3u += `#EXTINF:${dur},${artist} - ${title}\n`;
      m3u += `${streamUrl}\n\n`;
    }

    const blob = new Blob([m3u], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${handleName}_playlist.m3u8`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 4. Copy All Suno URLs
  const handleCopyAllLinks = async () => {
    const urls = songs.map((s) => `https://suno.com/song/${s.id}`).join('\n');
    try {
      await navigator.clipboard.writeText(urls);
      setCopiedLinks(true);
      setTimeout(() => setCopiedLinks(false), 2500);
    } catch {}
  };

  // 5. Copy All Audio Stream CDN URLs
  const handleCopyAllStreamUrls = async () => {
    const urls = songs
      .map((s) => s.audioUrl || `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${s.id}.m4a`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(urls);
      setCopiedStreamLinks(true);
      setTimeout(() => setCopiedStreamLinks(false), 2500);
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-3xl max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden my-auto">
        {/* Header Ribbon */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-r from-amber-500/20 via-neutral-900 to-purple-500/20 border-b border-neutral-800">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden border-2 border-amber-500/40 bg-neutral-950 shrink-0 shadow-lg">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-amber-400 bg-neutral-950">
                    <User className="w-7 h-7" />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg sm:text-xl font-extrabold text-white">
                    {t.downloadProfileData}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    DATA HUB
                  </span>
                </div>
                <p className="text-xs text-neutral-300 mt-0.5">
                  <span className="font-bold text-white">{displayName}</span>{' '}
                  <span className="font-mono text-neutral-400">(@{handleName})</span>
                  {' • '}
                  <strong className="text-amber-400">{songs.length}</strong> {t.totalTracks} ({totalMinutes} min)
                </p>
              </div>
            </div>

            <button
              type="button"
              id="close-profile-data-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Filter */}
          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-neutral-800/80 text-neutral-300 hover:text-white'
              }`}
            >
              {lang === 'km' ? 'ជម្រើសទាំងអស់' : 'All Options'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audio')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'audio'
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-neutral-800/80 text-neutral-300 hover:text-white'
              }`}
            >
              <Music className="w-3 h-3" />
              <span>{lang === 'km' ? 'កញ្ចប់ Audio (ZIP)' : 'Audio Archives (ZIP)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('data')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'data'
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-neutral-800/80 text-neutral-300 hover:text-white'
              }`}
            >
              <FileJson className="w-3 h-3" />
              <span>{lang === 'km' ? 'ទិន្នន័យ (JSON / CSV)' : 'Metadata & Exports'}</span>
            </button>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Section 1: Batch Audio Download Options */}
          {(activeTab === 'all' || activeTab === 'audio') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <FolderArchive className="w-4 h-4" />
                  <span>{lang === 'km' ? 'ទាញយកបទចម្រៀងជាកញ្ចប់ ZIP (Audio ZIPs)' : 'Bulk Audio Archive Downloads (ZIP)'}</span>
                </h4>
                <span className="text-[11px] font-mono text-neutral-400">
                  {songs.length} {lang === 'km' ? 'បទចម្រៀង' : 'tracks'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. MP3 ZIP */}
                <button
                  type="button"
                  id="profile-download-all-mp3-btn"
                  onClick={() => onDownloadAllZip('mp3')}
                  disabled={zipDownloading !== null}
                  className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-900 text-left transition-all group relative overflow-hidden shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs">
                      MP3
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400 px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800">
                      320 kbps
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                    {t.downloadProfileAllMp3}
                  </h5>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                    {lang === 'km' ? 'ទាញយកគ្រប់បទជា MP3 កម្រិតខ្ពស់ជាមួយ ID3 Cover Art' : 'All tracks in high quality 320kbps MP3 with embedded tags'}
                  </p>
                  {zipDownloading === 'mp3' && (
                    <div className="absolute inset-0 bg-neutral-950/90 flex items-center justify-center gap-2 text-amber-400 font-bold text-xs">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t.preparingZip}</span>
                    </div>
                  )}
                </button>

                {/* 2. WAV ZIP */}
                <button
                  type="button"
                  id="profile-download-all-wav-btn"
                  onClick={() => onDownloadAllZip('wav', 16)}
                  disabled={zipDownloading !== null}
                  className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-sky-500/50 hover:bg-neutral-900 text-left transition-all group relative overflow-hidden shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold text-xs">
                      WAV
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400 px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800">
                      48kHz Lossless
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">
                    {t.downloadProfileAllWav}
                  </h5>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                    {lang === 'km' ? 'ទាញយក WAV Lossless គ្មានការបាត់បង់គុណភាពសម្លេង' : 'Uncompressed 48kHz studio audio for editing & listening'}
                  </p>
                  {zipDownloading === 'wav' && (
                    <div className="absolute inset-0 bg-neutral-950/90 flex items-center justify-center gap-2 text-sky-400 font-bold text-xs">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t.preparingZip}</span>
                    </div>
                  )}
                </button>

                {/* 3. Both MP3 + WAV */}
                <button
                  type="button"
                  id="profile-download-all-both-btn"
                  onClick={() => onDownloadAllZip('both')}
                  disabled={zipDownloading !== null}
                  className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-purple-500/50 hover:bg-neutral-900 text-left transition-all group relative overflow-hidden shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-xs">
                      ALL
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400 px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800">
                      MP3 + WAV
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                    {t.downloadProfileAllBoth}
                  </h5>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                    {lang === 'km' ? 'កញ្ចប់ពេញលេញរួមបញ្ចូលទាំង MP3 និង WAV គ្រប់បទ' : 'Complete package containing both MP3 & WAV for each song'}
                  </p>
                  {zipDownloading === 'both' && (
                    <div className="absolute inset-0 bg-neutral-950/90 flex items-center justify-center gap-2 text-purple-400 font-bold text-xs">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t.preparingZip}</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Section 2: Data & Metadata Exports */}
          {(activeTab === 'all' || activeTab === 'data') && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <FileJson className="w-4 h-4 text-amber-400" />
                  <span>{t.exportProfileData}</span>
                </h4>
                <span className="text-[11px] text-emerald-400 font-mono">
                  UTF-8 Unicode Ready
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. JSON Export */}
                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-amber-500/40 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <FileJson className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-white">{t.exportJson}</h5>
                        <p className="text-[10px] text-neutral-500 font-mono">.json • Complete Catalog</p>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                      {t.exportJsonDesc} ({songs.length} {lang === 'km' ? 'បទចម្រៀង' : 'songs'} + Prompts + Tags + Models)
                    </p>
                  </div>
                  <button
                    type="button"
                    id="export-profile-json-btn"
                    onClick={handleExportJson}
                    className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700 hover:border-amber-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>{lang === 'km' ? 'ទាញយក JSON ឯកសារ' : 'Download JSON File'}</span>
                  </button>
                </div>

                {/* 2. CSV / Excel Export */}
                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500/40 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-white">{t.exportCsv}</h5>
                        <p className="text-[10px] text-neutral-500 font-mono">.csv • Excel / Sheets UTF-8</p>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                      {t.exportCsvDesc}
                    </p>
                  </div>
                  <button
                    type="button"
                    id="export-profile-csv-btn"
                    onClick={handleExportCsv}
                    className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700 hover:border-emerald-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{lang === 'km' ? 'ទាញយក CSV (Excel)' : 'Download CSV Spreadsheet'}</span>
                  </button>
                </div>

                {/* 3. M3U8 Playlist */}
                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-violet-500/40 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="p-2 rounded-xl bg-violet-500/15 text-violet-400 border border-violet-500/30">
                        <ListMusic className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-white">{t.exportM3u}</h5>
                        <p className="text-[10px] text-neutral-500 font-mono">.m3u8 • Media Players</p>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                      {t.exportM3uDesc}
                    </p>
                  </div>
                  <button
                    type="button"
                    id="export-profile-m3u-btn"
                    onClick={handleExportM3u}
                    className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700 hover:border-violet-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5 text-violet-400" />
                    <span>{lang === 'km' ? 'ទាញយក M3U Playlist' : 'Download M3U Playlist'}</span>
                  </button>
                </div>

                {/* 4. Copy All Links */}
                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-sky-500/40 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
                        <Copy className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-white">{t.copyAllLinks}</h5>
                        <p className="text-[10px] text-neutral-500 font-mono">{songs.length} URLs • IDM / Downloader</p>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                      {t.copyAllLinksDesc}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      id="copy-all-suno-links-btn"
                      onClick={handleCopyAllLinks}
                      className="py-2 px-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700 hover:border-sky-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm truncate"
                    >
                      {copiedLinks ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-emerald-300 font-bold">{lang === 'km' ? 'បានចម្លង!' : 'Copied!'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span>Suno URLs</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      id="copy-all-stream-links-btn"
                      onClick={handleCopyAllStreamUrls}
                      className="py-2 px-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700 hover:border-sky-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm truncate"
                    >
                      {copiedStreamLinks ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-emerald-300 font-bold">{lang === 'km' ? 'បានចម្លង!' : 'Copied!'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span>Direct CDN</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Details & Model Footprint */}
          <div className="p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex flex-wrap items-center justify-between gap-2.5 text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>DRM Decryption & ID3 Tagging included in all downloads</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-neutral-500">{lang === 'km' ? 'ម៉ូដែលក្នុងកាតាឡុក:' : 'Engines:'}</span>
              <ModelBadge modelName="v6-pro" size="xs" />
              <ModelBadge modelName="v6" size="xs" />
              <ModelBadge modelName="v3.8" size="xs" />
              <ModelBadge modelName="v4" size="xs" />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between gap-3">
          <a
            href={`https://suno.com/@${profile.handle}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-amber-400 transition-colors"
          >
            <span>suno.com/@{profile.handle}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            id="close-profile-data-modal-bottom-btn"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

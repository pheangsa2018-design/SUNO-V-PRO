export interface SongInfo {
  id: string;
  title: string;
  displayName: string;
  handle: string;
  imageUrl: string;
  imageLargeUrl?: string;
  avatarUrl?: string;
  duration: number;
  tags: string;
  prompt: string;
  modelName: string;
  createdAt: string;
  playCount?: number;
  upvoteCount?: number;
  sourceUrl: string;
  audioUrl?: string;
  isPublic?: boolean;
  isUnlisted?: boolean;
}

export type AudioFormat = 'mp3' | 'wav' | 'm4a';

export interface DownloadOption {
  format: AudioFormat;
  label: string;
  labelKm: string;
  quality: string;
  approxSize: string;
  description: string;
  descriptionKm: string;
  badge: string;
}

export interface CachedHistoryItem {
  id: string;
  title: string;
  displayName: string;
  imageUrl: string;
  duration: number;
  sourceUrl: string;
  savedAt: number;
  modelName?: string;
}

export interface FavoriteSongItem {
  id: string;
  title: string;
  displayName: string;
  handle?: string;
  imageUrl: string;
  duration: number;
  sourceUrl: string;
  tags?: string;
  savedAt: number;
  modelName?: string;
}

export interface QueueItem {
  id: string;
  title: string;
  displayName: string;
  handle?: string;
  imageUrl: string;
  duration: number;
  sourceUrl?: string;
  addedAt: number;
  modelName?: string;
}

export interface ProfileSongItem {
  id: string;
  title: string;
  imageUrl: string;
  duration: number;
  createdAt: string;
  tags?: string;
  modelName?: string;
  isPublic?: boolean;
  isUnlisted?: boolean;
  audioUrl?: string;
  prompt?: string;
  capturedAt?: number;
  displayName?: string;
  handle?: string;
}

export interface ProfilePlaylistItem {
  id: string;
  name: string;
  imageUrl?: string;
  songCount: number;
  userHandle: string;
  userDisplayName?: string;
}

export interface ProfileInfo {
  handle: string;
  displayName: string;
  avatarUrl: string;
  bio?: string;
  followersCount: number;
  clipsCount: number;
  songs: ProfileSongItem[];
  playlists?: ProfilePlaylistItem[];
  primaryPlaylistId?: string;
}

export interface PlaylistInfo {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  userDisplayName: string;
  userHandle: string;
  userAvatarUrl?: string;
  songCount: number;
  totalDuration?: number;
  sourceUrl: string;
  songs: ProfileSongItem[];
}

export interface AsyncZipJobStatus {
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
}

export interface DownloadedArchiveSong {
  id: string;
  title: string;
  artist?: string;
  displayName?: string;
  duration?: number;
}

export interface DownloadedArchiveItem {
  id: string;
  name: string;
  format: AudioFormat | 'both';
  bitDepth?: 16 | 24;
  songCount: number;
  songs: DownloadedArchiveSong[];
  fileSizeApprox?: string;
  downloadedAt: number;
  source?: 'playlist' | 'queue' | 'history' | 'favorites' | 'song' | 'batch' | 'profile';
  downloadUrl?: string;
  jobId?: string;
}



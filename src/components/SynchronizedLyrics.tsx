import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileText,
  Copy,
  Check,
  Radio,
  Volume2,
  Maximize2,
  Minimize2,
  Navigation,
  Sparkles,
  ArrowDownCircle
} from 'lucide-react';
import type { Language } from '../i18n.js';
import { translations } from '../i18n.js';

export interface LyricLine {
  id: string;
  originalText: string;
  cleanText: string;
  isSectionHeader: boolean;
  sectionTitle?: string;
  startTime: number;
  endTime: number;
  hasTimestamp: boolean;
}

interface SynchronizedLyricsProps {
  prompt: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (seconds: number) => void;
  lang: Language;
  onCopy?: () => void;
  copied?: boolean;
}

function formatTimestamp(secs: number): string {
  if (isNaN(secs) || secs < 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const SynchronizedLyrics: React.FC<SynchronizedLyricsProps> = ({
  prompt,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  lang,
  onCopy,
  copied = false
}) => {
  const t = translations[lang];
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse prompt into structured lyric lines with calculated or explicit timestamps
  const parsedLines = useMemo<LyricLine[]>(() => {
    if (!prompt || typeof prompt !== 'string') return [];

    const rawLines = prompt.split(/\r?\n/).map((l) => l.trim());
    const validLines = rawLines.filter((l) => l.length > 0);

    if (validLines.length === 0) return [];

    // Check if lines have LRC format timestamps: [mm:ss.xx] or [mm:ss]
    const timestampRegex = /^\s*\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]\s*(.*)$/;
    const explicitTimestampLines: { time: number; text: string }[] = [];

    validLines.forEach((line) => {
      const match = line.match(timestampRegex);
      if (match) {
        const mins = parseInt(match[1], 10);
        const secs = parseFloat(match[2]);
        explicitTimestampLines.push({
          time: mins * 60 + secs,
          text: match[3].trim()
        });
      }
    });

    const hasExplicitLrc = explicitTimestampLines.length >= 2;
    const safeDuration = duration && duration > 5 ? duration : 180;

    // Case 1: Has explicit LRC timestamps
    if (hasExplicitLrc) {
      return explicitTimestampLines.map((item, idx) => {
        const nextTime =
          idx < explicitTimestampLines.length - 1
            ? explicitTimestampLines[idx + 1].time
            : safeDuration;
        const isHeader = /^\[.*\]$/.test(item.text);
        const sectionMatch = item.text.match(/^\[(.*)\]$/);

        return {
          id: `line-${idx}`,
          originalText: item.text,
          cleanText: isHeader && sectionMatch ? sectionMatch[1] : item.text,
          isSectionHeader: isHeader,
          sectionTitle: isHeader && sectionMatch ? sectionMatch[1] : undefined,
          startTime: item.time,
          endTime: Math.max(item.time + 1, nextTime),
          hasTimestamp: true
        };
      });
    }

    // Case 2: Standard Suno prompt with section headers like [Verse 1], [Chorus]
    // Calculate intelligent musical timeline distribution based on syllable/character length
    const totalLines = validLines.length;
    // Leave small intro and outro margins
    const introBuffer = Math.min(5, safeDuration * 0.05);
    const outroBuffer = Math.min(6, safeDuration * 0.05);
    const activeWindow = Math.max(10, safeDuration - introBuffer - outroBuffer);

    // Calculate line weights (longer lines take more time to sing; section headers get a brief pause)
    const weights = validLines.map((line) => {
      const isHeader = /^\[.*\]$/.test(line);
      if (isHeader) return 1.2;
      const charCount = line.length;
      return Math.max(2, Math.min(8, Math.round(charCount / 8)));
    });

    const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1;
    let accumulatedTime = introBuffer;

    return validLines.map((line, idx) => {
      const isHeader = /^\[.*\]$/.test(line);
      const sectionMatch = line.match(/^\[(.*)\]$/);
      const weight = weights[idx];
      const lineDuration = (weight / totalWeight) * activeWindow;

      const startTime = accumulatedTime;
      const endTime = idx === totalLines - 1 ? safeDuration : accumulatedTime + lineDuration;
      accumulatedTime += lineDuration;

      return {
        id: `line-${idx}`,
        originalText: line,
        cleanText: isHeader && sectionMatch ? sectionMatch[1] : line,
        isSectionHeader: isHeader,
        sectionTitle: isHeader && sectionMatch ? sectionMatch[1] : undefined,
        startTime,
        endTime,
        hasTimestamp: false
      };
    });
  }, [prompt, duration]);

  // Determine active line index based on currentTime
  const activeLineIndex = useMemo<number>(() => {
    if (parsedLines.length === 0) return -1;

    // Find matching line
    for (let i = 0; i < parsedLines.length; i++) {
      const line = parsedLines[i];
      if (currentTime >= line.startTime && currentTime < line.endTime) {
        return i;
      }
    }

    // Edge case: before first line
    if (currentTime < parsedLines[0].startTime) {
      return 0;
    }

    // Edge case: after last line
    if (currentTime >= parsedLines[parsedLines.length - 1].endTime) {
      return parsedLines.length - 1;
    }

    return -1;
  }, [currentTime, parsedLines]);

  // Smooth auto-scroll to the active line
  const scrollToActiveLine = (smooth: boolean = true) => {
    if (activeLineIndex < 0 || !containerRef.current) return;
    const targetEl = lineRefs.current[activeLineIndex];
    if (!targetEl) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const relativeOffset = targetRect.top - containerRect.top + container.scrollTop;
    const targetScrollTop = relativeOffset - containerRect.height / 2 + targetRect.height / 2;

    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: smooth ? 'smooth' : 'auto'
    });
  };

  // Perform auto-scroll whenever active line changes and auto-scroll is enabled
  useEffect(() => {
    if (autoScroll && !isUserScrolling && activeLineIndex >= 0) {
      scrollToActiveLine(true);
    }
  }, [activeLineIndex, autoScroll, isUserScrolling]);

  // Detect manual user scrolling to temporarily pause auto-scroll
  const handleUserScroll = () => {
    if (!autoScroll) return;

    setIsUserScrolling(true);

    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }

    // Re-enable auto-scroll after 4.5 seconds of user scroll inactivity if playing
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
      if (isPlaying) {
        scrollToActiveLine(true);
      }
    }, 4500);
  };

  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  // Resume auto-scroll manually
  const handleSyncToActive = () => {
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    setIsUserScrolling(false);
    setAutoScroll(true);
    scrollToActiveLine(true);
  };

  if (!prompt || parsedLines.length === 0) {
    return (
      <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-6 text-center text-neutral-500 italic text-sm">
        {t.noLyrics || 'No lyrics provided for this track.'}
      </div>
    );
  }

  return (
    <div className="relative bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-4 sm:p-5 transition-all">
      {/* Top Header & Controls Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-neutral-800/80">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono text-neutral-300 font-semibold uppercase tracking-wider">
            {t.lyricsTitle}
          </span>
          {isPlaying && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-mono border border-amber-500/30 animate-pulse">
              <Radio className="w-2.5 h-2.5" />
              <span>{t.lyricsSyncActive || 'Live Sync'}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto-Scroll Toggle */}
          <button
            type="button"
            id="toggle-lyrics-autoscroll-btn"
            onClick={() => {
              const next = !autoScroll;
              setAutoScroll(next);
              if (next) {
                setIsUserScrolling(false);
                scrollToActiveLine(true);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
              autoScroll
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 shadow-sm shadow-amber-500/10'
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
            title={autoScroll ? 'Disable Auto-Scroll' : 'Enable Auto-Scroll'}
          >
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                autoScroll ? 'bg-amber-400 animate-ping' : 'bg-neutral-600'
              }`}
            />
            <span>{autoScroll ? (t.autoScrollOn || 'Auto-Scroll ON') : (t.autoScrollOff || 'Auto-Scroll OFF')}</span>
          </button>

          {/* Expand / Collapse Height Toggle */}
          <button
            type="button"
            id="expand-lyrics-view-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-xs border border-neutral-800 transition-colors cursor-pointer"
            title={isExpanded ? (t.collapseLyrics || 'Collapse View') : (t.expandLyrics || 'Expand View')}
          >
            {isExpanded ? (
              <>
                <Minimize2 className="w-3 h-3" />
                <span className="hidden sm:inline">{t.collapseLyrics || 'Collapse'}</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3 h-3" />
                <span className="hidden sm:inline">{t.expandLyrics || 'Expand'}</span>
              </>
            )}
          </button>

          {/* Copy Lyrics Button */}
          {onCopy && (
            <button
              type="button"
              id="copy-lyrics-btn"
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors border border-neutral-700 cursor-pointer"
              title="Copy lyrics to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{t.lyricsCopied}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{t.copyLyrics}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Synchronized Lyrics Scroll Container */}
      <div
        ref={containerRef}
        onWheel={handleUserScroll}
        onTouchMove={handleUserScroll}
        className={`relative overflow-y-auto pr-2 space-y-2 font-sans transition-all duration-300 scroll-smooth selection:bg-amber-500/30 ${
          isExpanded ? 'max-h-[580px]' : 'max-h-96'
        }`}
      >
        {parsedLines.map((line, idx) => {
          const isActive = idx === activeLineIndex;
          const isPast = idx < activeLineIndex;

          if (line.isSectionHeader) {
            return (
              <div
                key={line.id}
                ref={(el) => {
                  lineRefs.current[idx] = el;
                }}
                onClick={() => onSeek(line.startTime)}
                className={`pt-3 pb-1 cursor-pointer transition-colors ${
                  isActive ? 'text-amber-300 font-bold' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-neutral-900/90 border border-neutral-800 text-[11px] font-mono uppercase tracking-wider text-amber-400/90">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{line.cleanText}</span>
                  <span className="text-[10px] text-neutral-500 font-normal">
                    {formatTimestamp(line.startTime)}
                  </span>
                </span>
              </div>
            );
          }

          return (
            <div
              key={line.id}
              ref={(el) => {
                lineRefs.current[idx] = el;
              }}
              onClick={() => onSeek(line.startTime)}
              className={`group flex items-start gap-3 p-2 rounded-xl transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-amber-500/15 border border-amber-500/30 shadow-md shadow-amber-500/5'
                  : 'hover:bg-neutral-900/80 border border-transparent'
              }`}
              title={t.clickToJump || 'Click to jump playback here'}
            >
              {/* Left Timestamp Pill */}
              <button
                type="button"
                className={`shrink-0 font-mono text-[11px] px-1.5 py-0.5 rounded-md transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-600 group-hover:text-neutral-400 group-hover:bg-neutral-900'
                }`}
              >
                {formatTimestamp(line.startTime)}
              </button>

              {/* Lyric Text */}
              <div className="flex-1 min-w-0">
                <p
                  className={`leading-relaxed transition-all break-words ${
                    isActive
                      ? 'text-white font-bold text-base sm:text-lg tracking-wide'
                      : isPast
                      ? 'text-neutral-400 font-normal text-sm sm:text-base'
                      : 'text-neutral-300/80 font-normal text-sm sm:text-base group-hover:text-neutral-100'
                  }`}
                >
                  {line.cleanText}
                </p>
              </div>

              {/* Active Indicator Wave Icon */}
              {isActive && isPlaying && (
                <div className="shrink-0 flex items-center self-center pr-1 text-amber-400 animate-pulse">
                  <Volume2 className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating "Sync to Audio" pill when user has manually scrolled away */}
      {isUserScrolling && autoScroll && activeLineIndex >= 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 animate-fade-in">
          <button
            type="button"
            id="sync-lyrics-to-playback-btn"
            onClick={handleSyncToActive}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 font-bold text-xs shadow-xl shadow-amber-500/25 hover:opacity-95 active:scale-95 transition-all cursor-pointer border border-amber-300/40"
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
            <span>{t.jumpToActive || 'Sync to Audio'}</span>
          </button>
        </div>
      )}

      {/* Bottom Hint Banner */}
      <div className="mt-3 pt-2 border-t border-neutral-900 flex items-center justify-between text-[11px] text-neutral-500">
        <span className="flex items-center gap-1">
          <Navigation className="w-3 h-3 text-neutral-600" />
          <span>{t.clickToJump || 'Click any lyric line to jump audio playback'}</span>
        </span>
        <span className="font-mono text-[10px] text-neutral-600">
          {formatTimestamp(currentTime)} / {formatTimestamp(duration || 0)}
        </span>
      </div>
    </div>
  );
};

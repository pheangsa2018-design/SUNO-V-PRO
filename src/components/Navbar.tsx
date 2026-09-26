import React from 'react';
import { ShieldCheck, Globe, Disc3, Code2, Sparkles, Crown } from 'lucide-react';
import type { Language } from '../i18n.js';
import { translations } from '../i18n.js';

interface NavbarProps {
  lang: Language;
  onToggleLang: () => void;
  onOpenBloggerEmbed: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ lang, onToggleLang, onOpenBloggerEmbed }) => {
  const t = translations[lang];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-neutral-950/80 border-b border-neutral-800/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 p-[1px] shadow-lg shadow-amber-500/10">
            <div className="w-full h-full bg-neutral-950 rounded-[11px] flex items-center justify-center">
              <Disc3 className="w-5 h-5 text-amber-400 animate-spin-slow" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-white text-lg font-sans">
                Suno<span className="text-amber-400">Audio</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" />
                DRM Bypass Active
              </span>
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-amber-500/20 text-purple-200 border border-purple-500/40 shadow-sm shadow-purple-500/15 ring-1 ring-purple-500/30">
                <Sparkles className="w-3 h-3 text-pink-400 animate-pulse" />
                <span>V6 & V3.8 Ready</span>
                <span className="w-1 h-1 rounded-full bg-amber-400 animate-ping" />
                <span className="inline-flex items-center gap-1 text-amber-300 font-extrabold">
                  <Crown className="w-3 h-3 text-amber-400" />
                  SUNO V6 PRO
                </span>
              </span>
            </div>
            <p className="text-xs text-neutral-400 line-clamp-1 hidden sm:block">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            id="blogger-embed-btn"
            onClick={onOpenBloggerEmbed}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all hover:border-amber-500/50 shadow-sm"
            title={t.bloggerEmbed}
          >
            <Code2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{t.bloggerEmbed}</span>
            <span className="sm:hidden">Blogger</span>
          </button>

          <div className="hidden md:flex items-center gap-1.5 text-xs text-neutral-400 bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-mono">Mango AES-128</span>
          </div>

          <button
            id="lang-toggle-btn"
            onClick={onToggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 text-xs font-medium transition-colors"
            title="Toggle Language / ប្តូរភាសា"
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>{lang === 'km' ? 'English' : 'ភាសាខ្មែរ'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

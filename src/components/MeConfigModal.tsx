import React, { useState } from 'react';
import { User, Sparkles, X, Check, ArrowRight, ExternalLink, RefreshCw } from 'lucide-react';
import type { Language } from '../i18n.js';
import { translations } from '../i18n.js';

interface MeConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHandle: string;
  onSave: (handle: string) => void;
  lang: Language;
}

const DEMO_SUGGESTIONS = [
  { handle: 'musicsabay', label: '@musicsabay', desc: '22+ Tracks & Unlisted' },
  { handle: 'ps_music_english', label: '@ps_music_english', desc: 'Auto Playlist & Album' }
];

export const MeConfigModal: React.FC<MeConfigModalProps> = ({
  isOpen,
  onClose,
  currentHandle,
  onSave,
  lang
}) => {
  const t = translations[lang];
  const [handleInput, setHandleInput] = useState(currentHandle || 'musicsabay');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = handleInput.trim().replace(/^@/, '').replace(/^https?:\/\/[^\/]+\/@?/i, '').replace(/\/.*$/, '').trim();
    if (!clean) {
      setError(lang === 'km' ? 'សូមបញ្ចូលឈ្មោះគណនី Suno Handle របស់អ្នក' : 'Please enter your Suno handle');
      return;
    }
    setError(null);
    onSave(clean);
  };

  const handleSelectSuggestion = (suggested: string) => {
    setHandleInput(suggested);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        id="me-config-modal-card"
        className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 p-6 sm:p-7 shadow-2xl shadow-black/80 space-y-5 overflow-hidden"
      >
        {/* Glow effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {t.meModalTitle}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  {t.sampleProfileMeBadge}
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">https://suno.com/create?wid=default • https://suno.com/me & /playlists</p>
            </div>
          </div>

          <button
            id="close-me-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explanation */}
        <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-3.5">
          {t.meModalSubtitle}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              {t.meInputLabel}
            </label>
            <div className="relative flex items-center bg-neutral-950 border border-neutral-800 focus-within:border-emerald-500/80 rounded-2xl px-3.5 py-2.5 transition-all">
              <span className="text-neutral-500 font-mono text-sm mr-1.5">@</span>
              <input
                id="me-handle-input"
                type="text"
                value={handleInput.replace(/^@/, '')}
                onChange={(e) => {
                  setHandleInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={t.meInputPlaceholder}
                className="w-full bg-transparent text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none font-mono"
                autoFocus
              />
              {handleInput && (
                <button
                  type="button"
                  onClick={() => setHandleInput('')}
                  className="p-1 text-neutral-500 hover:text-neutral-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              {t.meInputHint}
            </p>
            {error && (
              <p className="text-xs text-rose-400 mt-1.5">{error}</p>
            )}
          </div>

          {/* Quick suggestions */}
          <div className="space-y-2">
            <span className="text-[11px] font-medium text-neutral-400">
              {t.meQuickSuggestTitle}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_SUGGESTIONS.map((item) => (
                <button
                  key={item.handle}
                  type="button"
                  onClick={() => handleSelectSuggestion(item.handle)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                    handleInput.trim().replace(/^@/, '') === item.handle
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold block">{item.label}</span>
                    <span className="text-[10px] text-neutral-400 truncate block">{item.desc}</span>
                  </div>
                  {handleInput.trim().replace(/^@/, '') === item.handle && (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1.5" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
            >
              {lang === 'km' ? 'បោះបង់' : 'Cancel'}
            </button>
            <button
              id="save-me-handle-btn"
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t.meSaveButton}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

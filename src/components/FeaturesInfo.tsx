import React from 'react';
import { ShieldCheck, Music4, Zap, LockOpen, Sparkles } from 'lucide-react';
import type { Language } from '../i18n.js';
import { translations } from '../i18n.js';
import { ModelBadge } from './ModelBadge.js';

interface FeaturesInfoProps {
  lang: Language;
}

export const FeaturesInfo: React.FC<FeaturesInfoProps> = ({ lang }) => {
  const t = translations[lang];

  return (
    <div className="w-full max-w-4xl mx-auto mt-14 pt-10 border-t border-neutral-800/80">
      <div className="text-center mb-8">
        <h3 className="text-lg font-bold text-white tracking-tight">
          {t.featuresTitle}
        </h3>
        <p className="text-xs text-neutral-400 mt-1">
          {lang === 'km'
            ? 'បច្ចេកវិទ្យាដោះកូដសម្លេង និងបំលែងឯកសារស្តង់ដារស្ទូឌីយោ'
            : 'Next-generation audio decryption and studio mastering technology'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 hover:border-neutral-700 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
            <LockOpen className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-neutral-200 mb-1.5">
            {t.feature1Title}
          </h4>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {t.feature1Desc}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 hover:border-neutral-700 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
            <Music4 className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-neutral-200 mb-1.5">
            {t.feature2Title}
          </h4>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {t.feature2Desc}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 hover:border-neutral-700 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-3">
            <Zap className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-neutral-200 mb-1.5">
            {t.feature3Title}
          </h4>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {t.feature3Desc}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900/40 border border-purple-500/20 hover:border-purple-500/40 transition-colors bg-purple-950/[0.08]">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <h4 className="text-sm font-semibold text-neutral-200 mb-1.5 flex items-center justify-between">
            <span>{t.feature4Title}</span>
          </h4>
          <p className="text-xs text-neutral-400 leading-relaxed mb-3">
            {t.feature4Desc}
          </p>
          <div className="flex flex-wrap gap-1">
            <ModelBadge modelName="v6-pro" size="xs" />
            <ModelBadge modelName="v6" size="xs" />
            <ModelBadge modelName="v3.8" size="xs" />
            <ModelBadge modelName="v4" size="xs" />
          </div>
        </div>
      </div>
    </div>
  );
};

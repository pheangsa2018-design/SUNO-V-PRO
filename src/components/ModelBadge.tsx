import React from 'react';
import { Sparkles, Cpu, Zap, Radio, Crown } from 'lucide-react';

interface ModelBadgeProps {
  modelName?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
  id?: string;
}

export const ModelBadge: React.FC<ModelBadgeProps> = ({
  modelName,
  size = 'md',
  showIcon = true,
  className = '',
  id
}) => {
  const raw = (modelName || '').toLowerCase().trim();

  let label = 'Suno V6';
  let badgeStyle = 'bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-amber-500/20 text-purple-200 border-purple-500/40 shadow-sm shadow-purple-500/10 ring-1 ring-purple-500/30';
  let icon = <Sparkles className="animate-pulse text-pink-400" />;
  let tooltip = 'Suno V6 Next-Gen AI Model • 48kHz Studio Quality & Pristine Vocals';

  if (
    raw.includes('v6-pro') ||
    raw.includes('v6 pro') ||
    raw.includes('v6pro') ||
    raw.includes('suno-v6-pro') ||
    raw.includes('suno v6 pro') ||
    raw.includes('chirp-v6-pro')
  ) {
    label = 'SUNO V6 PRO';
    badgeStyle = 'bg-gradient-to-r from-amber-500/25 via-purple-600/30 to-pink-600/25 text-amber-200 border-amber-400/50 shadow-md shadow-amber-500/20 ring-1 ring-amber-400/50 font-bold';
    icon = <Crown className="animate-pulse text-amber-300" />;
    tooltip = 'SUNO V6 PRO Studio Master AI Engine • 48kHz 24-bit Audiophile Processing & Ultra-Pristine Vocal Synthesis';
  } else if (raw.includes('v6') || raw.includes('6.0') || raw === 'v6') {
    label = 'Suno V6';
    badgeStyle = 'bg-gradient-to-r from-purple-600/25 via-pink-600/20 to-amber-500/20 text-purple-200 border-purple-500/40 shadow-sm shadow-purple-950/40 ring-1 ring-purple-500/30';
    icon = <Sparkles className="animate-pulse text-pink-400" />;
    tooltip = 'Suno V6 Next-Gen Model • 48kHz Lossless Studio Processing';
  } else if (
    raw.includes('v3.8') ||
    raw.includes('v3-8') ||
    raw.includes('v3_8') ||
    raw.includes('chirp-v3-8') ||
    raw.includes('chirp-v3.8') ||
    raw === 'v3.8'
  ) {
    label = 'Suno V3.8';
    badgeStyle = 'bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 text-emerald-200 border-emerald-500/40 shadow-sm shadow-emerald-950/40 ring-1 ring-emerald-500/30 font-semibold';
    icon = <Zap className="text-emerald-400" />;
    tooltip = 'Suno V3.8 Enhanced Melodic Architecture & Expressive Harmony';
  } else if (raw.includes('v4') || raw.includes('chirp-v4') || raw === 'v4') {
    label = 'Suno V4';
    badgeStyle = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    icon = <Cpu className="text-amber-400" />;
    tooltip = 'Suno V4 High-Fidelity Audio Generation Engine';
  } else if (raw.includes('v3.5') || raw.includes('v3-5') || raw.includes('chirp-v3-5') || raw === 'v3.5') {
    label = 'Suno V3.5';
    badgeStyle = 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    icon = <Cpu className="text-sky-400" />;
    tooltip = 'Suno V3.5 Extended Composition Model';
  } else if (raw.includes('v3') || raw === 'v3') {
    label = 'Suno V3';
    badgeStyle = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    icon = <Cpu className="text-blue-400" />;
    tooltip = 'Suno V3 Generation Engine';
  } else if (raw) {
    // Custom model identifier
    const formatted = raw.replace(/^chirp-?/i, '').toUpperCase();
    label = `Suno ${formatted}`;
    badgeStyle = 'bg-neutral-800 text-neutral-300 border-neutral-700';
    icon = <Radio className="text-neutral-400" />;
    tooltip = `Suno ${formatted} Model`;
  }

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-1 [&>svg]:w-2.5 [&>svg]:h-2.5',
    sm: 'text-xs px-2 py-0.5 gap-1.5 [&>svg]:w-3 [&>svg]:h-3 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 [&>svg]:w-3.5 [&>svg]:h-3.5 font-semibold',
    lg: 'text-sm px-3 py-1.5 gap-2 [&>svg]:w-4 [&>svg]:h-4 font-semibold'
  }[size];

  return (
    <span
      id={id}
      title={tooltip}
      className={`inline-flex items-center rounded-full border whitespace-nowrap select-none transition-all duration-200 tracking-wide ${sizeClasses} ${badgeStyle} ${className}`}
    >
      {showIcon && icon}
      <span>{label}</span>
    </span>
  );
};

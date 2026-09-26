/**
 * Helper to calculate and format estimated remaining time for downloads and packaging tasks
 */
export function calculateRemainingTime(
  startTime: number | null | undefined,
  percent: number,
  t?: {
    remainingTimeCalculating?: string;
    remainingSeconds?: string;
    remainingMinutes?: string;
  },
  lang: 'km' | 'en' = 'en'
): string | null {
  if (!startTime || percent <= 0) return null;
  const elapsedSecs = (Date.now() - startTime) / 1000;

  if (percent <= 2 || elapsedSecs < 1.2) {
    return t?.remainingTimeCalculating || (lang === 'km' ? 'កំពុងគណនា...' : 'Calculating...');
  }

  if (percent >= 99) {
    return lang === 'km' ? 'នៅសល់ប៉ុន្មានវិនាទី...' : 'Finalizing...';
  }

  const totalEstimatedSecs = elapsedSecs / (percent / 100);
  const remainingSecs = Math.max(1, Math.round(totalEstimatedSecs - elapsedSecs));

  if (remainingSecs < 60) {
    if (t?.remainingSeconds) {
      return t.remainingSeconds.replace('{seconds}', String(remainingSecs));
    }
    return lang === 'km' ? `នៅសល់ប្រហែល ${remainingSecs} វិនាទី` : `~${remainingSecs}s remaining`;
  }

  const mins = Math.floor(remainingSecs / 60);
  const secs = remainingSecs % 60;
  if (t?.remainingMinutes) {
    return t.remainingMinutes
      .replace('{minutes}', String(mins))
      .replace('{seconds}', String(secs));
  }
  return lang === 'km'
    ? `នៅសល់ប្រហែល ${mins} នាទី ${secs > 0 ? `${secs} វិនាទី` : ''}`
    : `~${mins}m ${secs > 0 ? `${secs}s` : ''} remaining`;
}

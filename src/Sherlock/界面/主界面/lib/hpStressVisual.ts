import type { ApStressTier } from './apStressVisual';
import { getApStressTier } from './apStressVisual';
import { cn } from './utils';

export type HpStressTier = ApStressTier;

export function getHpStressTier(pct: number): HpStressTier {
  return getApStressTier(pct);
}

/** 生机雾色：由青绿（充盈）→ 琥珀 → 赤红（濒灭） */
export function hpMistShellClass(tier: HpStressTier): string {
  switch (tier) {
    case 'comfort':
      return 'border-emerald-500/40 bg-linear-to-br from-emerald-950/50 via-black/60 to-cyan-950/35 shadow-[inset_0_0_18px_rgba(52,211,153,0.12),0_0_16px_rgba(34,211,238,0.08)]';
    case 'watch':
      return 'border-teal-500/38 bg-linear-to-br from-teal-950/45 via-black/58 to-emerald-950/30 shadow-[inset_0_0_16px_rgba(45,212,191,0.1)]';
    case 'tense':
      return 'border-amber-500/45 bg-linear-to-br from-amber-950/55 via-black/65 to-orange-950/35 shadow-[inset_0_0_18px_rgba(251,191,36,0.14),0_0_14px_rgba(251,146,60,0.12)]';
    case 'critical':
      return 'border-rose-500/55 bg-linear-to-br from-rose-950/65 via-black/72 to-red-950/45 sherlock-hp-glyph--critical-pulse shadow-[inset_0_0_20px_rgba(244,63,94,0.22),0_0_22px_rgba(244,63,94,0.28)]';
    default:
      return 'border-emerald-500/40 bg-black/55';
  }
}

export function hpPercentTextClass(tier: HpStressTier): string {
  switch (tier) {
    case 'comfort':
      return 'text-emerald-200';
    case 'watch':
      return 'text-teal-200';
    case 'tense':
      return 'text-amber-200';
    case 'critical':
      return 'inline-block text-rose-200 sherlock-hp-percent--critical-pulse';
    default:
      return 'text-emerald-200';
  }
}

export function hpHeartIconClass(tier: HpStressTier): string {
  switch (tier) {
    case 'comfort':
      return 'text-emerald-400/90';
    case 'watch':
      return 'text-teal-300';
    case 'tense':
      return 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]';
    case 'critical':
      return 'inline-block text-rose-400 sherlock-hp-heart--critical-pulse drop-shadow-[0_0_12px_rgba(244,63,94,0.75)]';
    default:
      return 'text-emerald-400';
  }
}

export function hpMiniBarFillClass(tier: HpStressTier): string {
  switch (tier) {
    case 'comfort':
      return 'bg-linear-to-r from-emerald-700/95 via-teal-500 to-cyan-400/90';
    case 'watch':
      return 'bg-linear-to-r from-teal-800 via-teal-500 to-emerald-400/85';
    case 'tense':
      return 'bg-linear-to-r from-amber-900 via-amber-600 to-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.35)]';
    case 'critical':
      return 'bg-linear-to-r from-red-950 via-rose-700 to-red-400 sherlock-hp-bar-fill--critical-pulse shadow-[0_0_16px_rgba(244,63,94,0.5)]';
    default:
      return 'bg-emerald-600';
  }
}

export function hpMiniBarTrackClass(tier: HpStressTier): string {
  return cn(
    'w-full overflow-hidden rounded-full border bg-black/55 transition-[border-color,box-shadow] duration-300',
    tier === 'comfort' && 'border-emerald-500/25',
    tier === 'watch' && 'border-teal-500/28',
    tier === 'tense' && 'border-amber-500/35 shadow-[inset_0_0_10px_rgba(251,146,60,0.08)]',
    tier === 'critical' &&
      'border-rose-500/45 shadow-[inset_0_0_12px_rgba(244,63,94,0.12),0_0_10px_rgba(244,63,94,0.18)]',
  );
}

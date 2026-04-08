import { cn } from './utils';

export type ApStressTier = 'comfort' | 'watch' | 'tense' | 'critical';

/** 按行动余地占比分档，用于条/字色与动效 */
export function getApStressTier(pct: number): ApStressTier {
  if (pct <= 10) return 'critical';
  if (pct <= 22) return 'tense';
  if (pct <= 45) return 'watch';
  return 'comfort';
}

export function apStressBarFillClass(tier: ApStressTier): string {
  switch (tier) {
    case 'comfort':
      return 'bg-linear-to-r from-amber-700/90 via-sherlock-gold to-amber-200/90';
    case 'watch':
      return 'bg-linear-to-r from-amber-800/90 via-amber-500 to-yellow-200/85';
    case 'tense':
      return 'bg-linear-to-r from-orange-900 via-orange-600 to-amber-400 shadow-[0_0_14px_rgba(251,146,60,0.35)]';
    case 'critical':
      return 'bg-linear-to-r from-red-950 via-rose-700 to-red-400 sherlock-ap-bar-fill--critical-pulse shadow-[0_0_18px_rgba(244,63,94,0.55)]';
    default:
      return 'bg-sherlock-gold/90';
  }
}

export function apStressPercentTextClass(tier: ApStressTier): string {
  switch (tier) {
    case 'comfort':
      return 'text-sherlock-gold';
    case 'watch':
      return 'text-amber-200';
    case 'tense':
      return 'text-orange-300';
    case 'critical':
      return 'inline-block text-rose-300 sherlock-ap-percent--critical-pulse';
    default:
      return 'text-sherlock-gold';
  }
}

export function apStressZapClass(tier: ApStressTier): string {
  switch (tier) {
    case 'comfort':
      return 'text-sherlock-gold';
    case 'watch':
      return 'text-amber-300';
    case 'tense':
      return 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]';
    case 'critical':
      return 'inline-block text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.75)] sherlock-ap-zap--critical-pulse';
    default:
      return 'text-sherlock-gold';
  }
}

/** 侧栏「行动余地」按钮外框（含舒适金与危机档） */
export function apHudStatusStressShell(tier: ApStressTier): string {
  switch (tier) {
    case 'comfort':
      return 'border-sherlock-gold/45 bg-linear-to-br from-black/80 via-sherlock-gold/10 to-black/90 hover:border-sherlock-gold/70 hover:shadow-[0_0_28px_rgba(184,134,11,0.22)] focus-visible:ring-sherlock-gold/60';
    case 'watch':
      return 'border-amber-500/40 bg-linear-to-br from-black/85 via-amber-950/15 to-black/90 hover:border-amber-400/50 hover:shadow-[0_0_22px_rgba(245,158,11,0.14)] focus-visible:ring-amber-500/40';
    case 'tense':
      return 'border-orange-500/45 bg-linear-to-br from-black/88 via-orange-950/25 to-black/92 hover:border-orange-400/55 hover:shadow-[0_0_24px_rgba(251,146,60,0.18)] focus-visible:ring-orange-500/45';
    case 'critical':
      return 'border-rose-500/55 bg-linear-to-br from-black/90 via-rose-950/40 to-black/95 shadow-[0_0_22px_rgba(244,63,94,0.22)] hover:border-rose-400/65 hover:shadow-[0_0_28px_rgba(244,63,94,0.32)] focus-visible:ring-rose-500/55';
    default:
      return 'border-sherlock-gold/45 bg-linear-to-br from-black/80 via-sherlock-gold/10 to-black/90';
  }
}

export function apHudStatusGlyphBorderClass(tier: ApStressTier): string {
  switch (tier) {
    case 'comfort':
      return 'border-sherlock-gold/35 shadow-[inset_0_0_12px_rgba(184,134,11,0.2)]';
    case 'watch':
      return 'border-amber-500/35 shadow-[inset_0_0_12px_rgba(245,158,11,0.12)]';
    case 'tense':
      return 'border-orange-500/40 shadow-[inset_0_0_12px_rgba(251,146,60,0.15)]';
    case 'critical':
      return 'border-rose-500/50 shadow-[inset_0_0_14px_rgba(244,63,94,0.2)]';
    default:
      return 'border-sherlock-gold/35';
  }
}

/** 顶栏紧凑条轨道边框（随档位略变；高度由外层 className 控制） */
export function apStressBarTrackClass(tier: ApStressTier): string {
  return cn(
    'sherlock-ap-bar-glow w-full overflow-hidden rounded-full bg-black/55 transition-[border-color,box-shadow] duration-300',
    tier === 'comfort' && 'border-sherlock-gold/25 border',
    tier === 'watch' && 'border border-amber-500/30',
    tier === 'tense' && 'border border-orange-500/35 shadow-[inset_0_0_12px_rgba(251,146,60,0.08)]',
    tier === 'critical' &&
      'border border-rose-500/45 shadow-[inset_0_0_14px_rgba(244,63,94,0.12),0_0_12px_rgba(244,63,94,0.15)]',
  );
}

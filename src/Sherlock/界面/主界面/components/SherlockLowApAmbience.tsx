import type { CSSProperties } from 'react';
import { useSherlockStats } from '../context/SherlockStatContext';
import { SHERLOCK_LOW_AP_PERCENT_THRESHOLD } from '../lib/gameBalanceConstants';
import { clampPct } from '../utils/sherlockStatModel';

/**
 * 主列氛围层：低余地时 vignette + 轻微冷色罩，与顶栏百分比条呼应。
 */
export function SherlockLowApAmbience() {
  const { stats } = useSherlockStats();
  const apMax = Math.max(1, stats.player.apMax);
  const ap = Math.min(Math.max(0, stats.player.ap), apMax);
  const pct = clampPct((ap / apMax) * 100);
  if (pct > SHERLOCK_LOW_AP_PERCENT_THRESHOLD) return null;

  const stress = 1 - pct / SHERLOCK_LOW_AP_PERCENT_THRESHOLD;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-4 sherlock-low-ap-ambience"
      style={{ '--sherlock-ap-stress': String(stress) } as CSSProperties}
      aria-hidden
    >
      <div className="sherlock-low-ap-ambience__vignette" />
      <div className="sherlock-low-ap-ambience__coolwash" />
    </div>
  );
}

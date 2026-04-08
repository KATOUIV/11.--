import {
  BATTLE_TAG_NAMES,
  inferBattleSignal,
  parseBattleProtocols,
} from './battleProtocolParser';

/** 单次递交（选项或自拟回答）最多扣「AP 上限」的比例 */
export const SHERLOCK_AP_BURN_MAX_RATIO = 0.03;

/** 再平静也有微量耗神；与上限相乘得最小扣点比例 */
export const SHERLOCK_AP_BURN_MIN_RATIO = 0.01;

/**
 * 战斗仪表激烈度 0–1：综合协议行、标签密度与叙事/分析中的对抗启发。
 */
export function computeBattleGaugeIntensity(fullAssistantMessage: string): number {
  if (!fullAssistantMessage?.trim()) return 0;
  let s = 0;
  if (inferBattleSignal(fullAssistantMessage)) s += 0.38;

  const { lines, hasBattleContent } = parseBattleProtocols(fullAssistantMessage);
  const known = lines.filter(l => BATTLE_TAG_NAMES.has(l.tag));
  if (hasBattleContent) s += 0.22;
  s += Math.min(known.length / 5, 1) * 0.22;

  const tags = new Set(known.map(l => l.tag));
  if (tags.has('CRIT') || tags.has('DYING')) s += 0.14;
  if (tags.has('BATTLE_END')) s += 0.06;
  if (tags.has('BATTLE_START') || tags.has('ENCOUNTER')) s += 0.1;
  if (tags.has('ROLL')) s += 0.06;

  return Math.min(1, s);
}

/**
 * 本次行动相对 AP 上限的扣减比例，落在 [min, max]（默认 1%–3%）。
 */
export function computeApBurnRatioOfApMax(intensity01: number): number {
  const t = Math.min(1, Math.max(0, intensity01));
  return SHERLOCK_AP_BURN_MIN_RATIO + t * (SHERLOCK_AP_BURN_MAX_RATIO - SHERLOCK_AP_BURN_MIN_RATIO);
}

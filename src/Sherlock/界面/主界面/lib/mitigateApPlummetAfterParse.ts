import { klona } from 'klona';
import { SHERLOCK_AP_BURN_MAX_RATIO } from './apBurnFromBattleGauge';
import { extractSherlockStats } from '../utils/sherlockStatModel';
/**
 * 模型在 `<UpdateVariable>` 里偶发把「玩家状态.AP」写成断崖值（如 100→13），与「每次递状至多削去上限一小步」的规则冲突。
 * 仅在满足「此前尚充裕、新值极低、落差超过上限三分之一」时，按单次递状上限柔化，避免一行误写毁掉余地。
 */
export function mitigateApPlummetAfterParse(baseMvu: Mvu.MvuData, parsedMvu: Mvu.MvuData): Mvu.MvuData {
  const baseSd = baseMvu.stat_data as Record<string, unknown>;
  const parsedSd = parsedMvu.stat_data as Record<string, unknown>;
  const b = extractSherlockStats(baseSd);
  const p = extractSherlockStats(parsedSd);
  const cap = Math.max(1, b.player.apMax, p.player.apMax);
  const prevAp = b.player.ap;
  const nextAp = p.player.ap;
  const maxStep = Math.max(1, Math.round(cap * SHERLOCK_AP_BURN_MAX_RATIO));
  /** 新值须极低（≤18% 上限）且落差超过三分之一，避免把「一口气掉到两成」类合法剧情当成误写 */
  const catastrophic =
    prevAp >= cap * 0.65 && nextAp <= cap * 0.18 && prevAp - nextAp > cap * 0.35;

  if (!catastrophic) return parsedMvu;

  const restored = Math.max(0, prevAp - maxStep);
  console.warn(
    '[Sherlock] 案卷中气力单次落差异常，已按单次递状上限柔化（多为回函误写，非界面扣条）。',
    { 上限: cap, 此前: prevAp, 回函写入: nextAp, 柔化后: restored },
  );

  const out = klona(parsedMvu) as Mvu.MvuData;
  const sd = out.stat_data as Record<string, unknown>;
  const pr = sd['玩家状态'];
  if (!pr || typeof pr !== 'object' || Array.isArray(pr)) return parsedMvu;
  const player = pr as Record<string, unknown>;
  const apRaw = player.AP;
  if (Array.isArray(apRaw)) {
    player.AP = [restored, apRaw[1] ?? ''];
  } else {
    player.AP = restored;
  }
  return out;
}

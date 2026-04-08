import { klona } from 'klona';
import { ensureMvuData } from '../utils/variableReader';
import { extractSherlockStats } from '../utils/sherlockStatModel';

/**
 * 按「AP 上限 × 比例」从当前 MVU 快照扣减 `玩家状态.AP`，用于 user 楼层附带最新 stat。
 * 调用方应在写入前用 `shouldBurnApFromAssistantMessage` 判断；比例为 0 时不改 AP。
 * @param burnRatioOfMax 如 0.03 表示扣 3% 的上限点数（取整，且不超过当前 AP）
 */
export function applyApBurnToMvuClone(mvuIn: Mvu.MvuData, burnRatioOfMax: number): Mvu.MvuData {
  const mvu = klona(ensureMvuData(mvuIn as unknown as Record<string, unknown>));
  const sd = mvu.stat_data as Record<string, unknown>;
  const ex = extractSherlockStats(sd);
  const apMax = Math.max(1, ex.player.apMax);
  const ratio = Math.min(1, Math.max(0, burnRatioOfMax));
  const burnPoints = Math.round(apMax * ratio);
  if (burnPoints <= 0) return mvu;

  const newAp = Math.max(0, ex.player.ap - burnPoints);
  const pr = sd['玩家状态'];
  if (!pr || typeof pr !== 'object' || Array.isArray(pr)) return mvu;
  const player = pr as Record<string, unknown>;
  const apRaw = player.AP;
  if (Array.isArray(apRaw)) {
    player.AP = [newAp, apRaw[1] ?? ''];
  } else {
    player.AP = newAp;
  }
  return mvu;
}

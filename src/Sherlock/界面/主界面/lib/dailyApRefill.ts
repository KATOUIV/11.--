/**
 * 按「世界层.当前日期」日更：将 `玩家状态.AP` 补至 `玩家状态.AP上限`（与界面日更标记比对，同日不重复）。
 * 依赖剧情维护日期字段；日期为空或不变时不写入。
 */
import { klona } from 'klona';
import { ensureMvuData, getGameMvuData, pick } from '../utils/variableReader';

/** 写入 stat_data，勿与叙事键冲突 */
export const UI_DAILY_AP_DATE_KEY = '_界面日更AP日期';

function trimStr(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function apMaxFromPlayer(p: Record<string, unknown>): number {
  const raw = p.AP上限;
  let n = 100;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) n = raw;
  else if (typeof raw === 'string') {
    const x = parseFloat(raw.replace(/%/g, '').trim());
    if (Number.isFinite(x) && x > 0) n = x;
  }
  return n;
}

/**
 * 若游戏内日期推进且与上次日更标记不同，则补满 AP 并写回 MVU（latest 消息层）。
 * @returns 是否写回了 MVU
 */
export async function maybeApplyDailyApRefill(): Promise<boolean> {
  if (typeof Mvu === 'undefined' || typeof Mvu.replaceMvuData !== 'function') {
    return false;
  }

  let raw: Mvu.MvuData;
  try {
    raw = await getGameMvuData();
  } catch {
    return false;
  }

  const mvu = klona(ensureMvuData(raw as unknown as Record<string, unknown>));
  const stat = mvu.stat_data;
  if (!stat || typeof stat !== 'object') return false;

  const dateStr = trimStr(pick(stat, '世界层.当前日期', ''));
  if (!dateStr || dateStr === '—') return false;

  const playerRoot = stat['玩家状态'];
  if (!playerRoot || typeof playerRoot !== 'object' || Array.isArray(playerRoot)) return false;
  const player = playerRoot as Record<string, unknown>;

  const last = trimStr(player[UI_DAILY_AP_DATE_KEY]);
  if (last === dateStr) return false;

  /**
   * 未写过日更键时：只锚定当前剧情日，**不得**补满 AP。
   * 否则卡面/旧档从未带 `_界面日更AP日期` 时，`'' !== dateStr` 恒真，每次刷新都会把 AP 拉回上限（顶栏永远 100%）。
   */
  if (last === '') {
    player[UI_DAILY_AP_DATE_KEY] = dateStr;
    try {
      await Mvu.replaceMvuData(mvu, { type: 'message', message_id: 'latest' });
      console.info('[Sherlock] 日更：已锚定剧情日', dateStr, '（未改 AP，避免误补满）');
      return true;
    } catch (e) {
      console.warn('[Sherlock] 日更锚定日期写回失败', e);
      return false;
    }
  }

  const apMax = apMaxFromPlayer(player);
  player.AP = apMax;
  player[UI_DAILY_AP_DATE_KEY] = dateStr;

  try {
    await Mvu.replaceMvuData(mvu, { type: 'message', message_id: 'latest' });
    console.info('[Sherlock] 日更：剧情日自', last, '→', dateStr, '，已将 AP 补满至', apMax);
    return true;
  } catch (e) {
    console.warn('[Sherlock] 日更补 AP 写回失败', e);
    return false;
  }
}

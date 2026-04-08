/**
 * 次元商城兑换：扣 AP、记限购、写入特质，与 stat_data 路径对齐。
 * 剧情侧门槛（羁绊、通关数等）仍以叙事与 AI 裁定为准；此处只管资源与档案落地。
 */
import { klona } from 'klona';
import { effectiveDimensionalShopApCost, resolveDimensionalShopItem } from './dimensionalShop';
import { ensureMvuData, ensureMvuInitialized, getGameMvuData } from '../utils/variableReader';
import { num } from '../utils/sherlockStatModel';

export type ShopPurchaseResult = { ok: true } | { ok: false; reason: string };

function ensureNestedObject(stat: Record<string, unknown>, key: string): Record<string, unknown> {
  const cur = stat[key];
  if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
    return cur as Record<string, unknown>;
  }
  const next: Record<string, unknown> = {};
  stat[key] = next;
  return next;
}

/**
 * 在最新消息楼层写入兑换结果（需 MVU 可用）。
 */
export async function purchaseDimensionalShopItem(itemId: number): Promise<ShopPurchaseResult> {
  await ensureMvuInitialized();

  const raw = await getGameMvuData();
  const mvu = klona(ensureMvuData(raw));
  const stat = mvu.stat_data;
  const item = resolveDimensionalShopItem(itemId, stat);
  if (!item) return { ok: false, reason: '货架上无此编号' };
  const player = ensureNestedObject(stat, '玩家状态');

  const cost = effectiveDimensionalShopApCost(item.apCost);
  const ap = num(player.AP, 0);
  if (ap < cost) {
    return { ok: false, reason: `行动点不足（需要 ${cost}，当前 ${ap}）` };
  }

  const ledger = ensureNestedObject(player, '次元商城已购');
  const prevRaw = ledger[String(itemId)] ?? ledger[itemId];
  const prevN = typeof prevRaw === 'number' ? prevRaw : num(prevRaw, 0);
  if (item.purchaseLimit != null && prevN >= item.purchaseLimit) {
    return { ok: false, reason: '已达该奇物限购次数' };
  }

  player.AP = ap - cost;
  ledger[String(itemId)] = prevN + 1;

  const traits = ensureNestedObject(player, '特质');
  traits[item.name] = {
    来源: '次元商城',
    传承门类: item.traitCategory,
    货架编号: item.id,
    兑换次数: prevN + 1,
    效果摘要: item.effect.length > 120 ? `${item.effect.slice(0, 117)}…` : item.effect,
  };

  try {
    await Mvu.replaceMvuData(mvu, { type: 'message', message_id: 'latest' });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

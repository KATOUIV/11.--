import {
  BATTLE_TAG_NAMES,
  extractKnownBattleProtocolBlockAfterStructuredTags,
  parseBattleProtocols,
} from './battleProtocolParser';

/**
 * 仅当卷末（结构化标签之后）出现**已落地的战斗/检定裁定**时，下一次玩家递交才扣行动余地。
 * 曾误把 `[STATUS]`、`[BATTLE_START]` 等也当作扣费上下文，导致开局首段对话前条若含此类行就会误扣。
 */
const NON_BURN_TAIL_TAGS = new Set(['BATTLE_END', 'EXP', 'SYNC']);

/**
 * 必须至少出现其一，才视为「刚跑完检定 / 对抗结算」，与「仅有战场状态描线」区分。
 * 与雾巷面板、选项角标文案一致：真正耗神的是掷骰裁定类行。
 */
const BURN_AP_TRIGGER_TAGS = new Set(['ROLL', 'CRIT', 'DYING']);

/** 若尾段仅有以上「收束类」标签且无其它裁定，则不扣 AP（探索/结算后递状不耗余地） */
function tailOnlyNonBurnTags(knownTags: string[]): boolean {
  if (!knownTags.length) return true;
  return knownTags.every(t => NON_BURN_TAIL_TAGS.has(t));
}

/**
 * 根据上一条 assistant 全文判断：本次递交是否应扣减行动余地。
 */
export function shouldBurnApFromAssistantMessage(fullAssistantMessage: string): boolean {
  const block = extractKnownBattleProtocolBlockAfterStructuredTags(fullAssistantMessage);
  if (!block.trim()) return false;
  const { lines } = parseBattleProtocols(block);
  const known = lines.filter(l => BATTLE_TAG_NAMES.has(l.tag));
  if (!known.length) return false;
  const tags = known.map(l => l.tag);
  if (tailOnlyNonBurnTags(tags)) return false;
  return tags.some(t => BURN_AP_TRIGGER_TAGS.has(t));
}

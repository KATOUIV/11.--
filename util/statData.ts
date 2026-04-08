/**
 * 从最新一条 assistant 楼层读取 MVU `stat_data`（优先 Mvu.getMvuData，否则 getVariables）
 */

export function findLatestAssistantMessageId(): number | null {
  if (typeof getLastMessageId !== 'function' || typeof getChatMessages !== 'function') {
    return null;
  }
  const last = getLastMessageId();
  if (last < 0) return null;
  for (let id = last; id >= 0; id--) {
    const msgs = getChatMessages(id, { role: 'assistant' });
    if (msgs.length > 0) return msgs[0].message_id;
  }
  return null;
}

export function getStatDataFromMessage(messageId: number): Record<string, unknown> | null {
  try {
    if (typeof Mvu !== 'undefined' && typeof Mvu.getMvuData === 'function') {
      const data = Mvu.getMvuData({ type: 'message', message_id: messageId });
      const sd = data?.stat_data;
      if (sd && typeof sd === 'object' && !Array.isArray(sd)) {
        return sd as Record<string, unknown>;
      }
    }
    if (typeof getVariables === 'function') {
      const v = getVariables({ type: 'message', message_id: messageId });
      const sd = (v as { stat_data?: unknown }).stat_data;
      if (sd && typeof sd === 'object' && !Array.isArray(sd)) {
        return sd as Record<string, unknown>;
      }
    }
  } catch (e) {
    console.warn('[statData] getStatDataFromMessage', e);
  }
  return null;
}

export function getLatestAssistantStatData(): {
  statData: Record<string, unknown> | null;
  anchorMessageId: number | null;
} {
  const anchor = findLatestAssistantMessageId();
  if (anchor === null) {
    return { statData: null, anchorMessageId: null };
  }
  return {
    statData: getStatDataFromMessage(anchor),
    anchorMessageId: anchor,
  };
}

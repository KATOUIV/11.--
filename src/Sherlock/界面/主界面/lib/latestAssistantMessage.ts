/**
 * 取当前聊天中最新一条可见 assistant 楼层全文（供战斗仪表 / 余地扣减等使用）。
 */
export function getLatestAssistantFullMessage(): string {
  if (typeof getChatMessages !== 'function') return '';
  try {
    const msgs = getChatMessages(-1, { role: 'assistant', hide_state: 'unhidden' });
    if (!msgs?.length) return '';
    return msgs[msgs.length - 1]?.message ?? '';
  } catch {
    return '';
  }
}

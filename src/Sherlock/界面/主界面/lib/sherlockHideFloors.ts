/**
 * 与酒馆主界面「隐藏旧楼层」类脚本对齐：将较早楼层标记为 is_hidden。
 * 勿在案卷前端「入局」时自动批量调用：易触发酒馆/助手事件链导致 iframe 反复重载、卡在门闸。
 * 需要时请用助手中的「隐藏楼层」脚本，或在稳定时机由你方脚本显式调用 `applySherlockKeepRecentFloorsVisible`。
 */
export const SHERLOCK_RECENT_VISIBLE_CHAT_MESSAGES = 5;

export function canApplySherlockFloorVisibility(): boolean {
  return typeof getLastMessageId === 'function' && typeof setChatMessages === 'function';
}

/**
 * 将 message_id 在 [0 .. firstVisible-1] 的楼层设为隐藏，其余取消隐藏。
 * @param keepRecent 保留的最新楼层条数（含用户与助手）
 */
export async function applySherlockKeepRecentFloorsVisible(
  keepRecent: number = SHERLOCK_RECENT_VISIBLE_CHAT_MESSAGES,
): Promise<void> {
  if (!canApplySherlockFloorVisibility()) return;
  const last = getLastMessageId();
  if (last < 0) return;
  if (keepRecent < 1) return;
  if (last < keepRecent - 1) return;

  const firstVisible = Math.max(0, last - (keepRecent - 1));
  const payload: Array<{ message_id: number; is_hidden: boolean }> = [];
  for (let id = 0; id <= last; id++) {
    payload.push({ message_id: id, is_hidden: id < firstVisible });
  }
  await setChatMessages(payload, { refresh: 'affected' });
}

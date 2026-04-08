/** 区分「首次进入游戏」与「再次打开」——用于不同载入动画与首次全屏 */
const KEY = 'sherlock_entry_seen_v1';

export function isFirstEntrySplash(): boolean {
  try {
    return !localStorage.getItem(KEY);
  } catch {
    return true;
  }
}

export function markEntrySplashSeen(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}

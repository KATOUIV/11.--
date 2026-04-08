/** 酒馆楼层 API（界面内全局注入） */
declare function getLastMessageId(): number;

/**
 * 是否显示开局表单：以「手记启封完成」为准（与是否存在 assistant 开场白无关）
 */
export function isOpeningBookCompleted(): boolean {
  if (typeof getVariables !== 'function') {
    return false;
  }
  try {
    const v = getVariables({ type: 'message', message_id: 0 }) as Record<string, unknown> | undefined;
    const stat = v?.stat_data as Record<string, unknown> | undefined;
    const gs = stat?.['游戏状态'] as Record<string, unknown> | undefined;
    return gs?.['手记启封完成'] === true;
  } catch {
    return false;
  }
}

export function shouldShowOpeningForm(): boolean {
  return !isOpeningBookCompleted();
}

/**
 * 开场动画结束后（再次进入时自动）：已「手记启封完成」→ 主界面，否则手记向导。
 */
export function resolvePhaseAfterSplash(): 'book' | 'game' {
  try {
    if (isOpeningBookCompleted()) {
      return 'game';
    }
  } catch {
    /* 离线预览等 */
  }
  return 'book';
}

/**
 * 点击「开始游戏」后（与 mhjg「有楼层则直进游戏」同构，但叠写手记旗标）：
 * - 最新楼层 > 0 **且** `手记启封完成` → 主界面（接续案卷）。
 * - 最新楼层 > 0 **但未**启封手记 → 仍进手记向导，避免 stat_data 与界面脱节。
 * - 否则（空档或仅第 0 层等）→ 与载入页结束后的分流一致。
 * `getLastMessageId() < 0` 视为空档。
 */
export function resolvePhaseAfterStartGame(): 'book' | 'game' {
  try {
    if (typeof getLastMessageId === 'function') {
      const last = getLastMessageId();
      if (last > 0) {
        return isOpeningBookCompleted() ? 'game' : 'book';
      }
    }
  } catch {
    /* 离线预览 */
  }
  return resolvePhaseAfterSplash();
}

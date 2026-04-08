import type { SherlockOpeningFormData } from '../types';

/** 软性叙事提示（数值仍合法） */
export function computeOpeningConflictHints(form: SherlockOpeningFormData): string[] {
  const hints: string[] = [];

  if (form.characterMode === 'kesibo' && form.locationId === 'barts_lab') {
    hints.push('柯司博开局落在巴茨：可强调数字取证与化验数据交叉验证。');
  }
  if (form.characterMode === 'chen_yuan' && form.locationId === 'grey_alley_intel') {
    hints.push('陈媛 × 灰巷线人：交际与灰线交易叙事高度契合。');
  }
  if (form.locationId === 'grey_alley_intel' && (form.attrBonus['情报力'] ?? 0) < 2) {
    hints.push('灰巷开局若情报加点偏低，叙事上可补「临时线人不可靠」类波折。');
  }
  if (form.characterMode === 'custom' && form.locationId === 'baker_221b') {
    hints.push('自定义警探直开贝克街：可写清「因何被夏洛克点名」或苏格兰场借调。');
  }
  if (form.gameDifficulty === 'narrative') {
    hints.push('叙事向导：宜先铺陈雾都与人物关系，主线仍如棋局般收束——不必急于刀光剑影。');
  }
  if (form.gameDifficulty === 'hardcore') {
    hints.push('硬核博弈：败局与误导将更刺骨；务求每次交锋都在纸面留下可核对的推演与后果。');
  }

  return hints;
}

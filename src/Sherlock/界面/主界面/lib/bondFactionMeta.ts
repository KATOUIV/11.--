/**
 * 派系羁绊：与七维属性、传承门类叙事联动（界面展示用，不修改 MVU）。
 */
import type { TraitCategoryKey } from './dimensionalShop';

export interface ResolvedBondFaction {
  /** 优先展示的七维键名，须与 stat 中一致 */
  primaryAttrs: string[];
  /** 对应的传承门类（用于衔接次元商城 / 特质叙事） */
  traitCategories: TraitCategoryKey[];
  /** 短标签，用于卡面角标 */
  tagline: string;
  /** 详情页：羁绊如何影响玩法 */
  synergy: string;
  /** 浮窗：一句话操作提示 */
  playTip: string;
}

const RULES: Array<{ test: (n: string) => boolean; meta: ResolvedBondFaction }> = [
  {
    test: n => /贝克街|221B|华生|夏洛克/.test(n),
    meta: {
      primaryAttrs: ['演绎力', '观察力'],
      traitCategories: ['演绎', '洞察'],
      tagline: '贝克街同盟',
      synergy:
        '羁绊升高时，演绎墙、双人思维殿堂与主角团庇护叙事更易触发；过低则难以撬动 221B 核心剧情。',
      playTip: '与信任总值、夏洛克/华生个人羁绊双线联动。',
    },
  },
  {
    test: n => /苏格兰场|雷斯垂德|重案组/.test(n),
    meta: {
      primaryAttrs: ['沟通力', '演绎力'],
      traitCategories: ['沟通', '演绎'],
      tagline: '重案组背书',
      synergy: '代表明面警力与卷宗权限；高则封锁现场、并案更顺，低则内务与媒体掣肘。',
      playTip: '与警队话语权、警队公信力共振。',
    },
  },
  {
    test: n => /大英|政府|内阁|王室|白厅/.test(n),
    meta: {
      primaryAttrs: ['沟通力', '情报力'],
      traitCategories: ['沟通', '情报'],
      tagline: '体制特许',
      synergy:
        '羁绊升高时，官方背书、搜查许可与「合法暴力」的叙事余地更大；过低则明面渠道对你关上半扇门。',
      playTip: '与警队话语权、演绎等级呼应：高羁绊下说服/威慑检定可描写为「有白厅影子站台」。',
    },
  },
  {
    test: n => /莫里亚蒂|犯罪网络|蜘蛛/.test(n),
    meta: {
      primaryAttrs: ['演绎力', '情报力'],
      traitCategories: ['演绎', '情报'],
      tagline: '暗网棋局',
      synergy:
        '你在犯罪天才的棋盘上既是棋子也是变量；高羁绊解锁黑市情报与反向利用罪案链，过低则处处被预判。',
      playTip: '与线索权重、棋局掌控力联动：适合推「假意合作」「双面证据」类剧情。',
    },
  },
  {
    test: n => /谢林福特|欧洛丝|监禁|东风/.test(n),
    meta: {
      primaryAttrs: ['抗压性', '观察力'],
      traitCategories: ['抗压', '洞察'],
      tagline: '禁域回声',
      synergy:
        '高羁绊代表高墙之内仍愿为你留一扇窗——极端心理战、监禁叙事与家族秘密更易触达。',
      playTip: '与团队士气、意志类检定联动：高压场景下可减免「精神崩溃」类坏结果叙事。',
    },
  },
  {
    test: n => /地下|线人|耳目|帮派/.test(n),
    meta: {
      primaryAttrs: ['情报力', '应变力'],
      traitCategories: ['情报', '应变'],
      tagline: '雾巷耳目',
      synergy:
        '线人网络是暗处的血管；高羁绊时追踪、盯梢与脏活选项更丰富，过低则情报迟到或反水。',
      playTip: '与行动隐蔽度、情报覆盖度联动：适合追逐、潜入与街头打听。',
    },
  },
];

export function resolveBondFaction(name: string): ResolvedBondFaction {
  for (const r of RULES) {
    if (r.test(name)) return { ...r.meta };
  }
  return {
    primaryAttrs: ['情报力', '演绎力', '沟通力'],
    traitCategories: ['情报', '演绎', '沟通'],
    tagline: '未定派系',
    synergy: '该势力在卷宗中尚未定型；羁绊升降将决定其把你视作棋子、盟友还是弃子。',
    playTip: '泛用：七维均衡时更易承接多分支；偏科时优先用强项撬动情势。',
  };
}

export function bondTierFromPct(pct: number): { label: string; accent: string } {
  if (pct >= 75) return { label: '铁杆同盟', accent: 'from-emerald-400 to-teal-600' };
  if (pct >= 50) return { label: '深度合作', accent: 'from-cyan-400 to-blue-600' };
  if (pct >= 30) return { label: '观望', accent: 'from-amber-400 to-orange-600' };
  if (pct >= 15) return { label: '冷淡', accent: 'from-slate-400 to-zinc-600' };
  return { label: '敌意', accent: 'from-rose-500 to-red-800' };
}

/** 叙事侧「协同档」0～5，用于界面星点 / 文案 */
export function bondSynergyPips(bondPct: number): number {
  return Math.min(5, Math.max(0, Math.floor(bondPct / 20)));
}

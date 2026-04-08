/**
 * 羁绊伙伴：界面展示用档案（技能/称号为叙事向，与 MVU 字段独立）。
 */

export interface CompanionSkill {
  name: string;
  blurb: string;
}

export interface CompanionProfile {
  displayName: string;
  epithet: string;
  /** 与 GAME_CARD_PALETTES 错开强调：仅用于头像光晕等 */
  aura: 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate';
  skills: CompanionSkill[];
  /** 一行角色侧写，供浮层顶部 */
  tagline: string;
}

const AURA_CLASS: Record<CompanionProfile['aura'], string> = {
  violet: 'from-violet-400/35 to-fuchsia-600/20',
  emerald: 'from-emerald-400/30 to-teal-600/20',
  amber: 'from-amber-400/35 to-orange-600/20',
  rose: 'from-rose-400/30 to-pink-600/20',
  cyan: 'from-cyan-400/30 to-sky-600/20',
  slate: 'from-slate-400/25 to-zinc-700/20',
};

export function companionAuraClass(aura: CompanionProfile['aura']): string {
  return AURA_CLASS[aura];
}

const RULES: Array<{ test: (n: string) => boolean; profile: CompanionProfile }> = [
  {
    test: n => /夏洛克|Sherlock/i.test(n),
    profile: {
      displayName: '夏洛克·福尔摩斯',
      epithet: '咨询侦探',
      aura: 'violet',
      tagline: '冷感推演与社交障碍并存；高羁绊时愿为你改写法理边界。',
      skills: [
        { name: '演绎推演', blurb: '从碎片拼出整链；主线指证、庭审与反转的核心。' },
        { name: '观察入微', blurb: '衣着、习惯、灰尘与鞋印皆可成证；现场检定叙事加成。' },
        { name: '记忆宫殿', blurb: '跨案串联；长线剧情中召回旧案细节。' },
        { name: '小提琴·节拍', blurb: '高压下以节奏稳定心神；部分意志/抗压叙事可用。' },
      ],
    },
  },
  {
    test: n => /华生|Watson|约翰/i.test(n),
    profile: {
      displayName: '约翰·H·华生',
      epithet: '军医 · 记录者',
      aura: 'emerald',
      tagline: '枪口与笔杆同样可靠；羁绊高时掩护与救护选项更硬。',
      skills: [
        { name: '战地救护', blurb: '止血、包扎、稳定伤势；雾巷博弈中伤值与士气联动。' },
        { name: '手枪压制', blurb: '近距离威慑与掩护撤退；追逐/对峙场景优先。' },
        { name: '叙事锚点', blurb: '把疯癫推理译成人话；说服陪审团与媒体时补正。' },
        { name: '忠诚掩护', blurb: '一次剧情杀式危机可挡刀或圆谎（仍以叙事裁定）。' },
      ],
    },
  },
  {
    test: n => /雷斯垂德|Lestrade|格雷格/i.test(n),
    profile: {
      displayName: '格雷格·雷斯垂德',
      epithet: '苏格兰场探长',
      aura: 'amber',
      tagline: '明面程序的守门人；信任高时封锁令与警力调度更顺。',
      skills: [
        { name: '现场封锁', blurb: '合法拉线、控人；与「警队话语权」叙事同步。' },
        { name: '拘捕协助', blurb: '制服、押送；械斗收尾与逮捕检定友好。' },
        { name: '内务缓冲', blurb: '替你挡媒体与内务质询；公信力受损时减伤叙事。' },
        { name: '老派直觉', blurb: '街头线人与惯例案经验；补充「常识」选项。' },
      ],
    },
  },
  {
    test: n => /欧洛丝|Eurus|东风/i.test(n),
    profile: {
      displayName: '欧洛丝·福尔摩斯',
      epithet: '高墙之后',
      aura: 'rose',
      tagline: '极端智慧与极端危险同体；羁绊解锁家族暗线与心理战上限。',
      skills: [
        { name: '东风棋局', blurb: '预判多步；与莫里亚蒂线对撞时叙事权重上升。' },
        { name: '情感武器', blurb: '精准打击软肋；审讯/崩溃类检定双向锋利。' },
        { name: '禁闭知识', blurb: '谢林福特与家族秘密；特定设施与门禁叙事钥匙。' },
        { name: '共犯邀约', blurb: '高风险高回报选项；道德与阵营反噬检定可能并行。' },
      ],
    },
  },
];

export function resolveCompanionProfile(rawName: string): CompanionProfile {
  for (const r of RULES) {
    if (r.test(rawName)) return { ...r.profile };
  }
  return {
    displayName: rawName.replace(/_/g, ' '),
    epithet: '同行者',
    aura: 'slate',
    tagline: '卷宗中的名字将随剧情丰满；羁绊与体魄仍以此栏为准。',
    skills: [
      { name: '同行支援', blurb: '随羁绊升高解锁更多掩护、证言与支线。' },
      { name: '羁绊共鸣', blurb: '与派系、仓库、检定叙事交叉时可能触发额外选项。' },
    ],
  };
}

/** 精神状态关键词着色（展示用） */
export function mentalStatusTone(mental: string): { label: string; className: string } {
  const m = mental.trim();
  if (/稳定|良好|清醒/.test(m)) return { label: m, className: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100' };
  if (/恶化|崩溃|失控|狂/.test(m)) return { label: m, className: 'border-rose-400/45 bg-rose-600/20 text-rose-100' };
  if (/疲惫|低落|阴郁/.test(m)) return { label: m, className: 'border-amber-400/40 bg-amber-500/15 text-amber-100' };
  return { label: m || '—', className: 'border-white/20 bg-black/35 text-sherlock-text-secondary' };
}

/** 是否显示「同步脉冲」：高羁绊且生存尚可 */
export function companionShowSyncPulse(bondPct: number, hpPct: number): boolean {
  return bondPct >= 52 && hpPct >= 28;
}

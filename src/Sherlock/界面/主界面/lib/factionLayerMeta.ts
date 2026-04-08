/**
 * 阵营状态层：与各指标叙事、七维、传承门类联动（界面展示用，不写入 MVU）。
 */
import type { TraitCategoryKey } from './dimensionalShop';
import { clampPct } from '../utils/sherlockStatModel';

export type FactionMetricId =
  | 'clueWeight'
  | 'policeVoice'
  | 'intelCoverage'
  | 'trustTotal'
  | 'policeCredibility'
  | 'teamMorale'
  | 'chessControl'
  | 'securityLevel'
  | 'stealth'
  | 'lawBoundary'
  | 'infoControl'
  | 'gameBottom'
  | 'abilityUse';

export interface FactionMetricBundle {
  title: string;
  subtitle: string;
  primaryAttrs: string[];
  traitCategories: TraitCategoryKey[];
  synergy: string;
  playTip: string;
}

export const FACTION_METRIC_META: Record<FactionMetricId, FactionMetricBundle> = {
  clueWeight: {
    title: '线索权重',
    subtitle: '物证链上的分量',
    primaryAttrs: ['观察力', '情报力'],
    traitCategories: ['洞察', '情报'],
    synergy: '权重高时，指证与推理选项更「硬」；过低时你可能「知道真相」却一时说不服法庭与舆论。',
    playTip: '与仓库证物、现场勘查叙事联动；提升观察/情报可加速堆权重。',
  },
  policeVoice: {
    title: '警队话语权',
    subtitle: '明面警力听谁',
    primaryAttrs: ['沟通力', '演绎力'],
    traitCategories: ['沟通', '演绎'],
    synergy: '代表苏格兰场与明面支援对你的服从度；高则封锁、搜查更顺，低则内务与媒体掣肘。',
    playTip: '与警队公信力、团队士气共振；说服/威慑检定成功可叙事性抬高话语权。',
  },
  intelCoverage: {
    title: '情报覆盖度',
    subtitle: '耳目所及',
    primaryAttrs: ['情报力', '气运值'],
    traitCategories: ['情报', '演绎'],
    synergy: '伦敦暗流有多少在你图上显影；覆盖高则预判莫里亚蒂先手，低则处处被动。',
    playTip: '与派系羁绊、地下线人联动；破译与侧写类检定受益最明显。',
  },
  trustTotal: {
    title: '信任总值',
    subtitle: '各方愿押注于你',
    primaryAttrs: ['沟通力', '抗压性'],
    traitCategories: ['沟通', '抗压'],
    synergy: '羁绊伙伴与派系好感汇总体感；高则庇护与资源倾斜，低则背叛与甩锅频发。',
    playTip: '与同行者名册、长线结局分支挂钩；稳住士气与公信力可间接抬信任。',
  },
  policeCredibility: {
    title: '警队公信力',
    subtitle: '公众与内务如何看待官方叙事',
    primaryAttrs: ['演绎力', '沟通力'],
    traitCategories: ['演绎', '沟通'],
    synergy: '高时媒体与陪审团更信「官方结论」；低时冤案与丑闻反噬。',
    playTip: '与线索权重对冲：真相过硬但公信力低时，仍可能被舆论掀翻。',
  },
  teamMorale: {
    title: '团队士气',
    subtitle: '身边人还能跟你多久',
    primaryAttrs: ['抗压性', '应变力'],
    traitCategories: ['抗压', '应变'],
    synergy: '高强度办案与伤亡会压低士气；大胜与安全屋休整可回弹。',
    playTip: '与雾巷博弈负伤、连续失手叙事联动；士气过低易触发离队或失误选项。',
  },
  chessControl: {
    title: '棋局掌控力',
    subtitle: '对莫里亚蒂网络的预判',
    primaryAttrs: ['演绎力', '情报力'],
    traitCategories: ['演绎', '情报'],
    synergy: '宏观上你是否抢得先手；高时剧情允许「将计就计」与反埋伏。',
    playTip: '与派系「莫里亚蒂」羁绊、大案闭环强相关。',
  },
  securityLevel: {
    title: '安保防护等级',
    subtitle: '物理与制度护盾',
    primaryAttrs: ['应变力', '观察力'],
    traitCategories: ['应变', '洞察'],
    synergy: '保护要人、证物与据点；高则暗杀与灭证更难成功。',
    playTip: '与设施、安全屋叙事一致；据点越稳，突袭与潜入越偏你有利。',
  },
  stealth: {
    title: '行动隐蔽度',
    subtitle: '你在雾中有多难被盯梢',
    primaryAttrs: ['应变力', '情报力'],
    traitCategories: ['应变', '情报'],
    synergy: '高调行事与超能力显露会压低隐蔽；潜行、尾随、渗透受益。',
    playTip: '与探案准则「能力使用」拉扯：异界手段越多，隐蔽越难维持。',
  },
  lawBoundary: {
    title: '执法边界',
    subtitle: '程序正义 vs 结果正义',
    primaryAttrs: ['演绎力', '沟通力'],
    traitCategories: ['演绎', '沟通'],
    synergy: '偏左守程序、偏右踩线；走极端时，全局形势会随之剧烈起伏。',
    playTip: '与警队内务、媒体舆情检定交叉；越界选项多但反噬大。',
  },
  infoControl: {
    title: '信息管控',
    subtitle: '真相示人多少',
    primaryAttrs: ['情报力', '沟通力'],
    traitCategories: ['情报', '沟通'],
    synergy: '管控高则舆论可控、低则泄密与恐慌；与情报覆盖度形成张力。',
    playTip: '适合与「编年史」式公开信息叙事对齐：少说多藏 vs 全透明。',
  },
  gameBottom: {
    title: '博弈底线',
    subtitle: '与恶徒对弈愿付代价',
    primaryAttrs: ['抗压性', '演绎力'],
    traitCategories: ['抗压', '演绎'],
    synergy: '底线低则敢用脏手段换线索；过低则道德与阵营反噬检定变多。',
    playTip: '与莫里亚蒂侧交易、伪证高风险选项挂钩。',
  },
  abilityUse: {
    title: '能力使用',
    subtitle: '异界手段显露程度',
    primaryAttrs: ['气运值', '抗压性'],
    traitCategories: ['情报', '抗压'],
    synergy: '显露越高，超自然检定越猛，但隐蔽与公众信任承压。',
    playTip: '与玩家状态「超能力层级」、次元商城加护同屏阅读体验最佳。',
  },
};

export function getFactionMetricMeta(id: FactionMetricId): FactionMetricBundle {
  return FACTION_METRIC_META[id];
}

/** 四大核心资源均势 0–100，用于顶栏「势力压强」 */
export function factionCorePressure(f: {
  clueWeight: number;
  policeVoice: number;
  intelCoverage: number;
  trustTotal: number;
}): number {
  return Math.round(
    (clampPct(f.clueWeight) +
      clampPct(f.policeVoice) +
      clampPct(f.intelCoverage) +
      clampPct(f.trustTotal)) /
      4,
  );
}

export const DEDUCTION_RANK_LORE =
  '演绎等级是你在官方与暗线之间的推演名望位阶；不直接等于数值大小写，但应与「线索权重」「棋局掌控力」叙事一致。';

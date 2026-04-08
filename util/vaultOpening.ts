/**
 * 开局档案：与 stat_data「世界环境层」字段对齐，供开局书本写入 0 层变量。
 * 完整 stat_data 示例见 vault-opening-stat-example.json，供提示词 / 角色卡引用。
 */

import statDataFullExample from './vault-opening-stat-example.json';

export type VaultOpeningDraft = {
  /** 对应 世界环境层.灾难本质 */
  disasterEssence: string;
  /** 对应 世界环境层.时间线节点 */
  timelineNode: string;
};

/** 完整 stat_data 示例（格式化 JSON 字符串，可嵌入预设/世界书提示词） */
export const VAULT_STAT_DATA_FULL_SCHEMA_EXAMPLE = JSON.stringify(statDataFullExample, null, 2);

/** 层级说明（精简，便于与完整 JSON 配套） */
export const VAULT_STAT_LAYER_GUIDE = `
【stat_data 顶层分区】
- 世界环境层：日期/时间/灾难本质/世界现状/时间线节点（开局书本会写入其中若干项）
- 避难所状态层：资源、环境指标、社会制度、宏观属性
- 社会关系与派系：各派系名称、宗旨、好感度等
- 设施与库存：设施区域、仓库系统
- 监督者系统：基本信息、S.P.E.C.I.A.L、特质
- 追随者系统：各追随者档案
`.trim();

/** 封面：灾难本质预设（可扩展） */
export const VAULT_DISASTER_PRESETS: { id: string; title: string; blurb: string }[] = [
  {
    id: 'ww3_nuclear_classic',
    title: '第三次世界大战与核冬天（原著向）',
    blurb: '全球热战升级为核交换，地表辐射与尘埃层使人类无法长期生存，避难所成为常态。',
  },
  {
    id: 'slow_collapse',
    title: '慢性崩溃：经济·生态连锁',
    blurb: '无单次末日事件；供应链、气候与冲突叠加，文明在数十年内逐级坍塌。',
  },
  {
    id: 'bio_plague',
    title: '生物性灾难',
    blurb: '高致死瘟疫或基因武器外溢，社会结构在隔离与恐慌中瓦解。',
  },
  {
    id: 'ai_control',
    title: '失控自动化 / 对齐事故',
    blurb: '关键基础设施被错误优化或对抗性智能锁死，人类失去对地表的控制权。',
  },
  {
    id: 'solar_catastrophe',
    title: '天体或极端气候事件',
    blurb: '太阳活动异常、超级风暴或海平面突变等，迫使人口转入地下或封闭城。',
  },
  {
    id: 'custom',
    title: '自定义：由你在下页或对话中补完',
    blurb: '将仅记录简短占位，建议在开局后第一条用户消息中描述你的设定。',
  },
];

/** 时间线：相对「灾难爆发」锚点（与叙事提示一致） */
export const VAULT_TIMELINE_OPTIONS: string[] = [
  '灾难爆发前十天',
  '灾难爆发前一天',
  '灾难爆发前五分钟',
  '灾难爆发后三天',
  '灾难爆发后一年',
  '灾难爆发后十年',
  '灾难爆发后一百年',
  '灾难爆发后两百年',
];

/**
 * 供提示词工程使用：说明开局书本会写入哪些路径（可贴进角色/预设）
 */
export const VAULT_OPENING_VARIABLE_HINT = `
【开局档案 · 变量映射（界面写入）】
- stat_data.世界环境层.当前日期 / 当前时间：开局确认时写入本机日期时间（YYYY-MM-DD / HH:mm）。
- stat_data.世界环境层.灾难本质：玩家选择的末世逻辑说明。
- stat_data.世界环境层.时间线节点：相对灾难爆发的时间关系。
- stat_data.世界环境层.世界现状：根据上述选项生成的开局摘要句（可被后续 AI 更新覆盖）。
`.trim();

function formatVaultDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatVaultTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

function buildInitialWorldSituation(draft: VaultOpeningDraft): string {
  const essenceShort =
    draft.disasterEssence.length > 160 ? `${draft.disasterEssence.slice(0, 160)}…` : draft.disasterEssence;
  return `开局锚点：${draft.timelineNode}。灾难轮廓：${essenceShort} 地表与避难所细节由叙事与后续回合补全。`;
}

export function buildOpeningPromptContext(draft: VaultOpeningDraft): string {
  return [
    VAULT_OPENING_VARIABLE_HINT,
    '',
    '【玩家已选开局档案】',
    `- 灾难本质：${draft.disasterEssence}`,
    `- 时间线节点：${draft.timelineNode}`,
    '',
    VAULT_STAT_LAYER_GUIDE,
    '',
    '【stat_data 完整结构示例（initvar / 提示词对齐用）】',
    VAULT_STAT_DATA_FULL_SCHEMA_EXAMPLE,
    '',
    '【给 AI 的指令建议】',
    '请根据玩家已选「灾难本质」与「时间线节点」，在叙事一致前提下补全或微调各层字段；若 initvar 已存在完整 stat_data，仅合并冲突键或按剧情演进更新。',
  ].join('\n');
}

function mergeWorldAmbient(
  statData: Record<string, unknown>,
  draft: VaultOpeningDraft,
): Record<string, unknown> {
  const raw = statData['世界环境层'];
  const layer =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
  const now = new Date();
  layer['当前日期'] = formatVaultDate(now);
  layer['当前时间'] = formatVaultTime(now);
  layer['灾难本质'] = draft.disasterEssence;
  layer['时间线节点'] = draft.timelineNode;
  layer['世界现状'] = buildInitialWorldSituation(draft);
  return { ...statData, 世界环境层: layer };
}

/**
 * 将开局选择写入 0 层消息变量（优先 MVU，否则 updateVariablesWith）
 */
export async function applyVaultOpeningToMessage0(draft: VaultOpeningDraft): Promise<void> {
  const opt = { type: 'message' as const, message_id: 0 as const };

  try {
    if (typeof Mvu !== 'undefined' && typeof Mvu.getMvuData === 'function' && typeof Mvu.replaceMvuData === 'function') {
      const data = Mvu.getMvuData(opt);
      const stat = mergeWorldAmbient((data.stat_data || {}) as Record<string, unknown>, draft);
      await Mvu.replaceMvuData({ ...data, stat_data: stat }, opt);
      console.info('[vaultOpening] applied to message 0 via Mvu.replaceMvuData');
      return;
    }
  } catch (e) {
    console.warn('[vaultOpening] Mvu path failed, fallback', e);
  }

  if (typeof updateVariablesWith !== 'function') {
    throw new Error('[vaultOpening] updateVariablesWith 不可用');
  }

  updateVariablesWith(vars => {
    const next = { ...vars };
    const stat = { ...((next.stat_data || {}) as Record<string, unknown>) };
    next.stat_data = mergeWorldAmbient(stat, draft);
    return next;
  }, opt);
  console.info('[vaultOpening] applied to message 0 via updateVariablesWith');
}

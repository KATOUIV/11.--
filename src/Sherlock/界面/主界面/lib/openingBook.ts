/**
 * 翻书式开局：身份 → 所在位置 → 七维分配 →（UI）确认页；stat_data 深合并 + 开局全文（填入输入框后由玩家发送）
 */
import merge from 'lodash/merge';
import type { SherlockOpeningFormData } from '../types';
import { GAME_DIFFICULTY_STAT_LABEL } from './openingBookDifficulty';
import {
  LONDON_WORLD_ESSENCE,
  LONDON_WORLD_STATUS,
  OPENING_BOOK_TITLE,
  resolveInvestigatorName,
} from './openingBookConstants';

/** 身份：自定义（苏格兰场新人线）或固定卡 */
export type CharacterModeId = 'custom' | 'chen_yuan' | 'kesibo';

/** 开局所在位置（映射世界层 / 派系 / 叙事） */
export type OpeningLocationId =
  | 'scotland_yard'
  | 'baker_221b'
  | 'thames_riverside'
  | 'barts_lab'
  | 'grey_alley_intel';

/** 七维属性键，与变量表一致：D O C E R I L */
export const ATTR_KEYS = [
  '演绎力',
  '观察力',
  '沟通力',
  '应变力',
  '抗压性',
  '情报力',
  '气运值',
] as const;

export type AttrKey = (typeof ATTR_KEYS)[number];

/** 每项在基础值上的加点点数 */
export const ATTR_BASE = 10;
export const ATTR_BONUS_POOL = 21;
export const ATTR_BONUS_MAX_PER = 8;

export function createDefaultAttrBonus(): Record<AttrKey, number> {
  const base = Math.floor(ATTR_BONUS_POOL / ATTR_KEYS.length);
  let rem = ATTR_BONUS_POOL - base * ATTR_KEYS.length;
  const o: Partial<Record<AttrKey, number>> = {};
  for (const k of ATTR_KEYS) {
    o[k] = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem -= 1;
  }
  return o as Record<AttrKey, number>;
}

export function validateAttrBonus(b: Record<AttrKey, number>): boolean {
  let sum = 0;
  for (const k of ATTR_KEYS) {
    const v = b[k];
    if (typeof v !== 'number' || v < 0 || v > ATTR_BONUS_MAX_PER) return false;
    sum += v;
  }
  return sum === ATTR_BONUS_POOL;
}

/**
 * 与角色卡 MVU 枚举一致（勿写自由文案，否则会触发「无效选项」）。
 * 开局五地点均属第一季舞台，统一用「第一季开篇」；具体氛围见 `OPENING_SCENE_ANCHOR` → 游戏状态.场景锚点。
 */
export const VALID_TIMELINE_NODE_OPENING = '第一季开篇' as const;

/** 各开局地的叙事锚点（写入 游戏状态.场景锚点，供界面与模型阅读） */
export const OPENING_SCENE_ANCHOR: Record<OpeningLocationId, string> = {
  scotland_yard: '苏格兰场·晨间卷宗',
  baker_221b: '贝克街·初访',
  thames_riverside: '泰晤士河岸·潮雾现场',
  barts_lab: '巴茨医院·化验与物证',
  grey_alley_intel: '灰巷·耳目暗线',
};

export const OPENING_LOCATION_OPTIONS: Array<{
  id: OpeningLocationId;
  label: string;
  subtitle: string;
  desc: string;
}> = [
  {
    id: 'scotland_yard',
    label: '苏格兰场 · 重案组办公室',
    subtitle: '明面执法',
    desc: '卷宗、警力与内务压力；警队话语权、苏格兰场羁绊易涨。',
  },
  {
    id: 'baker_221b',
    label: '贝克街 · 221B',
    subtitle: '咨询侦探侧',
    desc: '演绎墙与化学角；贝克街小队羁绊、信任总值叙事向。',
  },
  {
    id: 'thames_riverside',
    label: '泰晤士河岸 · 现场',
    subtitle: '取证与跟踪',
    desc: '雾线与潮声；线索权重、行动隐蔽度偏现场流。',
  },
  {
    id: 'barts_lab',
    label: '巴茨医院 · 法医实验室',
    subtitle: '物证与辐射痕',
    desc: '茉莉线前置；观察与物证链，情报覆盖度略升。',
  },
  {
    id: 'grey_alley_intel',
    label: '灰巷 · 线人接头点',
    subtitle: '地下耳目',
    desc: '伦敦地下线人网络、情报覆盖；莫里亚蒂暗线更易擦边。',
  },
];

function patchWorldBlurb(): Record<string, unknown> {
  return {
    世界层: {
      博弈本质: LONDON_WORLD_ESSENCE,
      世界现状: LONDON_WORLD_STATUS,
    },
  };
}

function patchGameDifficulty(id: SherlockOpeningFormData['gameDifficulty']): Record<string, unknown> {
  return {
    世界层: {
      游戏难度: GAME_DIFFICULTY_STAT_LABEL[id],
    },
  };
}

function patchCharacterMode(mode: CharacterModeId): Record<string, unknown> {
  if (mode === 'custom') {
    return {
      阵营状态层: { 警队公信力: 56 },
      派系羁绊层: { 苏格兰场重案组: 14, 贝克街221B小队: 8 },
      羁绊伙伴: { 格雷格_雷斯垂德: { 羁绊等级: 66 } },
      游戏状态: {
        预设身份: '穿越者警探·自定义',
        手记身份备注: '苏格兰场新人线；七维由你分配',
      },
    };
  }
  if (mode === 'chen_yuan') {
    return {
      玩家状态: { 特质: { 八面玲珑: true } },
      派系羁绊层: { 苏格兰场重案组: 15, 伦敦地下线人网络: 8, 大英政府: 7 },
      游戏状态: {
        预设身份: '陈媛·八面玲珑（警队穿越者）',
        手记身份备注:
          '传记向：共情沟通、体育与口供优势；失忆与 K 线伏笔；七维由你分配',
      },
    };
  }
  return {
    玩家状态: { 特质: { 数字破壁: true } },
    派系羁绊层: { 苏格兰场重案组: 9, 贝克街221B小队: 11 },
    游戏状态: {
      预设身份: '柯司博·数字破壁（技术穿越者）',
      手记身份备注:
        '传记向：取证与数字切口、市侩与仗义并存、惧独与 K 旧友失忆；七维由你分配',
    },
  };
}

function patchLocation(id: OpeningLocationId): Record<string, unknown> {
  const date = '1996年12月25日';
  const anchor = OPENING_SCENE_ANCHOR[id];
  switch (id) {
    case 'scotland_yard':
      return {
        世界层: {
          当前日期: date,
          当前时间: '09:15',
          时间线节点: VALID_TIMELINE_NODE_OPENING,
        },
        阵营状态层: { 警队话语权: 12, 线索权重: 8 },
        派系羁绊层: { 苏格兰场重案组: 10 },
        游戏状态: {
          当前位置: '英国伦敦·苏格兰场重案组办公室',
          场景锚点: anchor,
        },
      };
    case 'baker_221b':
      return {
        世界层: {
          当前日期: date,
          当前时间: '14:20',
          时间线节点: VALID_TIMELINE_NODE_OPENING,
        },
        阵营状态层: { 信任总值: 12, 演绎等级: '入门级' },
        派系羁绊层: { 贝克街221B小队: 14 },
        游戏状态: { 当前位置: '英国伦敦·贝克街221B', 场景锚点: anchor },
      };
    case 'thames_riverside':
      return {
        世界层: {
          当前日期: date,
          当前时间: '06:45',
          时间线节点: VALID_TIMELINE_NODE_OPENING,
        },
        阵营状态层: { 线索权重: 12, 宏观属性: { 行动隐蔽度: 58 } },
        游戏状态: {
          当前位置: '英国伦敦·泰晤士河岸（现场）',
          场景锚点: anchor,
        },
      };
    case 'barts_lab':
      return {
        世界层: {
          当前日期: date,
          当前时间: '11:00',
          时间线节点: VALID_TIMELINE_NODE_OPENING,
        },
        阵营状态层: { 情报覆盖度: 10 },
        派系羁绊层: { 贝克街221B小队: 6 },
        游戏状态: {
          当前位置: '英国伦敦·巴茨医院法医实验室',
          场景锚点: anchor,
        },
      };
    case 'grey_alley_intel':
      return {
        世界层: {
          当前日期: date,
          当前时间: '22:30',
          时间线节点: VALID_TIMELINE_NODE_OPENING,
        },
        阵营状态层: { 情报覆盖度: 14 },
        派系羁绊层: { 伦敦地下线人网络: 18, 莫里亚蒂犯罪网络: 6 },
        游戏状态: {
          当前位置: '英国伦敦·灰色地带线人接头点',
          场景锚点: anchor,
        },
      };
    default:
      return {};
  }
}

function patchAttrAllocation(bonus: Record<AttrKey, number>): Record<string, unknown> {
  const 属性: Record<string, number> = {};
  for (const k of ATTR_KEYS) {
    属性[k] = ATTR_BASE + (bonus[k] ?? 0);
  }
  return { 玩家状态: { 属性 } };
}

export function buildOpeningBookStatPatch(form: SherlockOpeningFormData): Record<string, unknown> {
  let acc: Record<string, unknown> = {};
  acc = merge(acc, patchWorldBlurb());
  acc = merge(acc, patchGameDifficulty(form.gameDifficulty));
  acc = merge(acc, patchCharacterMode(form.characterMode));
  acc = merge(acc, patchLocation(form.locationId));
  acc = merge(acc, patchAttrAllocation(form.attrBonus));

  const displayName = resolveInvestigatorName(form.investigatorName);
  acc = merge(acc, {
    游戏状态: {
      手记书名: OPENING_BOOK_TITLE,
      调查员: displayName,
      开局时间: new Date().toISOString(),
      样貌笔记: form.appearance?.trim() || '',
      人物列传: form.personalBackstory?.trim() || '',
      性别: form.gender ?? 'unspecified',
      开局手记版: '三页·身份/位置/七维',
    },
  });

  return acc;
}

export function computePreviewStatData(form: SherlockOpeningFormData): Record<string, unknown> {
  const base = getDefaultStatSkeleton();
  const patch = buildOpeningBookStatPatch(form);
  return merge({}, base, patch) as Record<string, unknown>;
}

function getDefaultStatSkeleton(): Record<string, unknown> {
  return {
    世界层: {
      当前日期: '1996年12月25日',
      当前时间: '00:00',
      时间线节点: VALID_TIMELINE_NODE_OPENING,
      游戏难度: GAME_DIFFICULTY_STAT_LABEL.standard,
      博弈本质: LONDON_WORLD_ESSENCE,
      世界现状: LONDON_WORLD_STATUS,
    },
    阵营状态层: {
      线索权重: 0,
      警队话语权: 0,
      情报覆盖度: 0,
      信任总值: 0,
      演绎等级: '入门级',
      警队公信力: 50,
      团队士气: 50,
      探案准则: { 执法边界: 0, 信息管控: 0, 博弈底线: 0, 能力使用: 0 },
      宏观属性: { 棋局掌控力: 0, 安保防护等级: 0, 行动隐蔽度: 50 },
    },
    派系羁绊层: {
      贝克街221B小队: 0,
      苏格兰场重案组: 0,
      大英政府: 0,
      莫里亚蒂犯罪网络: 0,
      谢林福特特殊监禁区: 0,
      伦敦地下线人网络: 0,
    },
    设施与道具层: {
      设施等级: {
        苏格兰场重案组办公室: 1,
        贝克街221B演绎墙: 0,
        巴茨医院法医实验室: 0,
        伦敦监控与数字取证中心: 0,
        伦敦安全屋网络: 0,
        谢林福特监禁区会客室: false,
      },
      仓库: { 穿越者的剧情笔记: true },
    },
    玩家状态: {
      AP: 100,
      AP上限: 100,
      HP: 100,
      HP上限: 100,
      属性: {
        演绎力: 10,
        观察力: 10,
        沟通力: 10,
        应变力: 10,
        抗压性: 10,
        情报力: 10,
        气运值: 10,
      },
      超能力层级: 0,
      特质: {},
    },
    羁绊伙伴: {
      夏洛克_福尔摩斯: { 羁绊等级: 20, 精神状态: '稳定', 生命值: 100, 专属特质: false },
      约翰_H_华生: { 羁绊等级: 50, 精神状态: '稳定', 生命值: 100, 专属特质: false },
      格雷格_雷斯垂德: { 羁绊等级: 60, 精神状态: '稳定', 生命值: 100, 专属特质: false },
      欧洛丝_福尔摩斯: { 羁绊等级: 0, 精神状态: '稳定', 生命值: 100, 专属特质: false },
    },
    游戏状态: {},
  };
}

const MODE_LABEL: Record<CharacterModeId, string> = {
  custom: '穿越者警探（自定义）',
  chen_yuan: '陈媛·八面玲珑（警队穿越者）',
  kesibo: '柯司博·数字破壁（技术穿越者）',
};

function getLocationPrologue(form: SherlockOpeningFormData): { lead: string; tag: string } {
  const mode = MODE_LABEL[form.characterMode];
  switch (form.locationId) {
    case 'scotland_yard':
      return {
        tag: '苏格兰场',
        lead: `你从重案组的咖啡渍与未结案编号开始。《${OPENING_BOOK_TITLE}》在桌角摊开——身份：${mode}。窗外是九六年伦敦的薄雾，卷宗堆里藏着连环自杀案爆发前的最后平静；麦考夫的耳目与雷斯垂德的叹息，都在等你签下第一个字。`,
      };
    case 'baker_221b':
      return {
        tag: '贝克街221B',
        lead: `台阶上的泥印与门环的铜绿先于言语招待了你。寓所里煤气味与未干的化学试剂纠缠，演绎墙尚空——身份：${mode}。夏洛克与华生的影子在楼梯转角一晃而过，而你知道，辐射棋局的真正棋盘才刚露出边角。`,
      };
    case 'thames_riverside':
      return {
        tag: '泰晤士河岸',
        lead: `潮声把警笛磨成钝响。泥泞里的足迹通向尚未命名的死者——身份：${mode}。雾线低垂，莫里亚蒂的棋子在河对岸冷笑；你手里的取证袋与《神夏》记忆叠在一起，成为伦敦唯一能改写的变量。`,
      };
    case 'barts_lab':
      return {
        tag: '巴茨法医室',
        lead: `消毒水与福尔马林替换了街头的煤气味。显微镜下的纤维与辐射痕在静默中对峙——身份：${mode}。茉莉的笔迹在送检单边缘发颤，而你知道，切尔诺贝利的幽灵不止留在东欧。`,
      };
    case 'grey_alley_intel':
      return {
        tag: '灰巷耳目',
        lead: `煤气灯照不进的巷子里，线人用眼神计价。纸烟与假名交换成半条路由——身份：${mode}。地下网络与军情六处的边界在此模糊，莫里亚蒂的耳语可能藏在下一声口哨里。`,
      };
    default:
      return {
        tag: '伦敦',
        lead: `雾都铺开它的棋局——身份：${mode}。`,
      };
  }
}

export function composeOpeningBookMessages(form: SherlockOpeningFormData): {
  maintext: string;
  option: string;
  sum: string;
} {
  const name = resolveInvestigatorName(form.investigatorName);
  const { lead: p1, tag: variantTag } = getLocationPrologue(form);

  let p2 = '';
  if (form.appearance?.trim()) {
    p2 += `旁人眼中的你：${form.appearance.trim()}\n\n`;
  }
  if (form.personalBackstory?.trim()) {
    p2 += `你心底的背景：${form.personalBackstory.trim()}\n\n`;
  }
  p2 += `你以「${name}」的身份踏入这场博弈——煤气灯、卷宗与切尔诺贝利阴影下的辐射棋局，都在你的七维与位置选择里落定第一子。`;

  const maintext = `<maintext>
${p1}

${p2}
</maintext>`;

  const option = `<option>
A. 前往贝克街 221B，与咨询侦探会合
B. 留在苏格兰场，先调阅在办重案卷宗
</option>`;

  const loc = OPENING_LOCATION_OPTIONS.find(l => l.id === form.locationId);
  const node = loc?.label ?? form.locationId;
  const sum = `<sum>${name}｜${node}｜${variantTag}｜${MODE_LABEL[form.characterMode]}｜${GAME_DIFFICULTY_STAT_LABEL[form.gameDifficulty]}，伦敦博弈场开始。</sum>`;

  return { maintext, option, sum };
}

/** 第 0 层消息末尾状态栏占位（粘贴发送后由正则/脚本替换为界面）；向导预览应隐去，勿当普通正文展示 */
export const OPENING_LAYER_ZERO_STATUS_PLACEHOLDER = '<StatusPlaceHolderImpl/>';

const PLACEHOLDER = OPENING_LAYER_ZERO_STATUS_PLACEHOLDER;

/** 供开局向导「文稿预览」：去掉占位符，避免屏幕上出现 XML 小尾巴 */
export function stripOpeningStatusPlaceholderForPreview(fullText: string): string {
  return fullText.replaceAll(OPENING_LAYER_ZERO_STATUS_PLACEHOLDER, '');
}

/** 复制到剪贴板时去掉状态栏占位标签（勿让玩家把 XML 标签粘进递状） */
export function stripStatusPlaceholderForClipboard(text: string): string {
  return text
    .replace(/<StatusPlaceHolderImpl\s*\/?>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/** 与 {@link buildMessageZeroFullText} 同文，但不含 &lt;StatusPlaceHolderImpl/&gt; */
export function buildMessageZeroClipboardText(form: SherlockOpeningFormData): string {
  return stripStatusPlaceholderForClipboard(buildMessageZeroFullText(form));
}

/**
 * 玩家确认页正文（不含「---」后界面尾段）；完整发送稿见 buildMessageZeroFullText。
 * 与 UI 第四页展示一致。
 */
export function buildOpeningConfirmationUserMessage(form: SherlockOpeningFormData): string {
  const name = resolveInvestigatorName(form.investigatorName);
  const genderZh = form.gender === 'male' ? '男' : form.gender === 'female' ? '女' : '其他';
  const mode = MODE_LABEL[form.characterMode];
  const loc = OPENING_LOCATION_OPTIONS.find(l => l.id === form.locationId);
  const diffLabel = GAME_DIFFICULTY_STAT_LABEL[form.gameDifficulty];
  const lines: string[] = [
    '【伦敦博弈场 · 开局确认】',
    '',
    `手记：${OPENING_BOOK_TITLE}`,
    `调查员：${name}`,
    `性别：${genderZh}`,
    `博弈难度：${diffLabel}`,
    `角色模板：${mode}`,
    `所在位置：${loc?.label ?? form.locationId}`,
    '',
    '—— 样貌笔记 ——',
    form.appearance?.trim() || '（未填）',
    '',
    '—— 人物列传 ——',
    form.personalBackstory?.trim() || '（未填）',
    '',
    '—— 七维（每项基础 10 + 自由分配）——',
  ];
  for (const k of ATTR_KEYS) {
    const bonus = form.attrBonus[k] ?? 0;
    lines.push(`${k}：${ATTR_BASE + bonus}（自由分配 ${bonus} 点）`);
  }
  lines.push(
    '',
    '呈堂附记：上列条目将与阁下首道呈词一并归档；卷末若有朱批暗记，务请原样保留，勿擅删改。',
  );
  return lines.join('\n');
}

/**
 * 供粘贴到对话输入框的完整开局稿：确认正文 + 分隔 + 短标题与占位符（发送后落层）
 */
export function buildMessageZeroFullText(form: SherlockOpeningFormData): string {
  return `${buildOpeningConfirmationUserMessage(form)}\n\n---\n\n${buildUserLayerZeroOpeningText(form)}`;
}

/** 第 0 层用户消息尾段：短标题 + 占位符 */
export function buildUserLayerZeroOpeningText(form: SherlockOpeningFormData): string {
  const loc = OPENING_LOCATION_OPTIONS.find(l => l.id === form.locationId);
  const tag = loc?.subtitle ?? '开局';
  const oneLiner =
    form.locationId === 'scotland_yard'
      ? '晨间卷宗，警力与内务并行。'
      : form.locationId === 'baker_221b'
        ? '午后贝克街，门环已响。'
        : form.locationId === 'thames_riverside'
          ? '河岸雾中，取证先行。'
          : form.locationId === 'barts_lab'
            ? '法医台灯光，物证说话。'
            : '灰巷耳目，真假换线。';
  return `${OPENING_BOOK_TITLE} · ${tag}\n神探夏洛克：伦敦博弈场\n${oneLiner}\n\n${PLACEHOLDER}`;
}

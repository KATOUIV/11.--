/**
 * 次元商城奇物目录（界面展示；剧情内成交以卡面规则为准）。
 * 日漫与国创等 IP 为氛围彩蛋，授权与商用由作者自行合规处理。
 * 捞尸人条目为雾都停尸间/河案向改编，可与原作设定分流使用。
 */

import { DIMENSIONAL_SHOP_AP_COST_MULTIPLIER } from './gameBalanceConstants';

/** 与「六大传承门类」对齐，用于筛选货架与统计兑换偏好 */
export const TRAIT_CATEGORY_KEYS = ['演绎', '洞察', '沟通', '应变', '抗压', '情报'] as const;
export type TraitCategoryKey = (typeof TRAIT_CATEGORY_KEYS)[number];

export type ShopSeriesTag =
  | '咒术回战'
  | '神精榜'
  | '蛊真人'
  | '捞尸人'
  | '神探夏洛克'
  | '穿越者'
  | '混合';

export interface DimensionalShopItem {
  id: number;
  name: string;
  tag: ShopSeriesTag;
  ipSubtitle: string;
  effect: string;
  acquire: string;
  apCost: number;
  traitCategory: TraitCategoryKey;
  /** 限购次数，undefined 表示不限 */
  purchaseLimit?: number;
}

/** 界面分组与排序：系列优先于此顺序，其次门类、气力标价、编号 */
export const SHOP_TAG_DISPLAY_ORDER: readonly ShopSeriesTag[] = [
  '神探夏洛克',
  '咒术回战',
  '神精榜',
  '蛊真人',
  '捞尸人',
  '混合',
  '穿越者',
] as const;

/** 动态货架条目 id 须 ≥ 此值，避免与静态表 1–99 冲突 */
export const DYNAMIC_SHOP_ID_MIN = 10000;

/** 复导出：倍率数值在 `gameBalanceConstants.ts` 修改 */
export { DIMENSIONAL_SHOP_AP_COST_MULTIPLIER };

export function effectiveDimensionalShopApCost(baseApCost: number): number {
  const base = Math.max(0, Math.floor(Number(baseApCost)) || 0);
  return Math.max(1, Math.round(base * DIMENSIONAL_SHOP_AP_COST_MULTIPLIER));
}

function readStatPathRaw(root: unknown, path: string): unknown {
  if (root == null || typeof root !== 'object') return undefined;
  const parts = path.split('.');
  let cur: unknown = root;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    if (Array.isArray(cur) && cur.length > 0 && typeof cur[0] !== 'object') {
      cur = cur[0];
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** MVU 常见 [数组, "说明"] 与纯数组两种写法 */
function coalesceMvuArrayField(v: unknown): unknown[] {
  if (!Array.isArray(v)) return [];
  if (v.length >= 2 && typeof v[1] === 'string' && Array.isArray(v[0])) {
    return v[0];
  }
  return v;
}

function tagOrderIndex(tag: ShopSeriesTag): number {
  const i = SHOP_TAG_DISPLAY_ORDER.indexOf(tag);
  return i === -1 ? 999 : i;
}

export function sortDimensionalShopItems(items: DimensionalShopItem[]): DimensionalShopItem[] {
  return [...items].sort((a, b) => {
    const ta = tagOrderIndex(a.tag);
    const tb = tagOrderIndex(b.tag);
    if (ta !== tb) return ta - tb;
    const ca = TRAIT_CATEGORY_KEYS.indexOf(a.traitCategory);
    const cb = TRAIT_CATEGORY_KEYS.indexOf(b.traitCategory);
    if (ca !== cb) return ca - cb;
    if (a.apCost !== b.apCost) return a.apCost - b.apCost;
    return a.id - b.id;
  });
}

function asTraitCategoryKey(s: unknown): TraitCategoryKey {
  if (typeof s === 'string' && (TRAIT_CATEGORY_KEYS as readonly string[]).includes(s)) {
    return s as TraitCategoryKey;
  }
  return '情报';
}

function asShopSeriesTag(s: unknown): ShopSeriesTag {
  if (typeof s === 'string' && (SHOP_TAG_DISPLAY_ORDER as readonly string[]).includes(s)) {
    return s as ShopSeriesTag;
  }
  return '混合';
}

/**
 * 解析 `stat_data.次元商城.扩展奇物`：JSON 数组或 MVU 元组包裹的数组。
 * 每条须含 id（≥10000）、name、tag、traitCategory、apCost 等，形状同 {@link DimensionalShopItem}。
 */
export function parseDimensionalShopExtensions(raw: unknown): DimensionalShopItem[] {
  const arr = coalesceMvuArrayField(raw);
  const out: DimensionalShopItem[] = [];
  for (const el of arr) {
    if (!el || typeof el !== 'object') continue;
    const o = el as Record<string, unknown>;
    const id = Number(o.id);
    if (!Number.isFinite(id) || id < DYNAMIC_SHOP_ID_MIN) continue;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!name) continue;
    const limRaw = o.purchaseLimit;
    const purchaseLimit =
      limRaw != null && limRaw !== ''
        ? Math.max(0, Math.floor(Number(limRaw)))
        : undefined;
    out.push({
      id,
      name,
      tag: asShopSeriesTag(o.tag),
      ipSubtitle: typeof o.ipSubtitle === 'string' ? o.ipSubtitle : '',
      effect: typeof o.effect === 'string' ? o.effect : '',
      acquire: typeof o.acquire === 'string' ? o.acquire : '',
      apCost: Math.max(0, Math.floor(Number(o.apCost)) || 0),
      traitCategory: asTraitCategoryKey(o.traitCategory),
      purchaseLimit: purchaseLimit !== undefined && !Number.isNaN(purchaseLimit) ? purchaseLimit : undefined,
    });
  }
  return out;
}

/** 静态目录 + 变量扩展，去重后按系列、门类、气力标价排序 */
export function mergeDimensionalShopCatalog(statData: Record<string, unknown> | null | undefined): DimensionalShopItem[] {
  const root = statData && typeof statData === 'object' ? statData : {};
  const ext = parseDimensionalShopExtensions(readStatPathRaw(root, '次元商城.扩展奇物'));
  const merged = [...DIMENSIONAL_SHOP_ITEMS, ...ext];
  const seen = new Set<number>();
  const out: DimensionalShopItem[] = [];
  for (const item of merged) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({
      ...item,
      apCost: effectiveDimensionalShopApCost(item.apCost),
    });
  }
  return sortDimensionalShopItems(out);
}

export function resolveDimensionalShopItem(
  itemId: number,
  statData: Record<string, unknown>,
): DimensionalShopItem | undefined {
  const base = DIMENSIONAL_SHOP_ITEMS.find(i => i.id === itemId);
  if (base) return base;
  return parseDimensionalShopExtensions(readStatPathRaw(statData, '次元商城.扩展奇物')).find(i => i.id === itemId);
}

export const DIMENSIONAL_SHOP_ITEMS: DimensionalShopItem[] = [
  {
    id: 1,
    name: '六眼·侦缉全开特质券',
    tag: '咒术回战',
    ipSubtitle: '咒术回战 · 五条悟',
    effect: '解锁永久特质：观察力+5，现场勘查检定 DC-6，可回溯 72 小时现场轨迹。',
    acquire: '超能力层级≥5，观察力≥20，通关 3 起特级咒灵密室案，消耗五点气力',
    apCost: 5,
    traitCategory: '洞察',
  },
  {
    id: 2,
    name: '咒言·绝对缚命密卷',
    tag: '咒术回战',
    ipSubtitle: '咒术回战 · 狗卷棘',
    effect: '解锁永久特质：沟通力+5，审讯检定 DC-6，可强制目标吐露真相。',
    acquire: '超能力层级≥5，沟通力≥20，通关 2 起咒言连环案，消耗五点气力',
    apCost: 5,
    traitCategory: '沟通',
  },
  {
    id: 3,
    name: '无量空处·简式核心',
    tag: '咒术回战',
    ipSubtitle: '咒术回战 · 五条悟',
    effect: '全属性+2，所有检定 DC-3，可展开结界击溃目标精神防线读取记忆。',
    acquire: '超能力层级≥6，全属性≥20，通关所有特级咒灵案，消耗六点气力，限购 1',
    apCost: 6,
    purchaseLimit: 1,
    traitCategory: '情报',
  },
  {
    id: 4,
    name: '天与咒缚体术残卷',
    tag: '咒术回战',
    ipSubtitle: '咒术回战 · 伏黑甚尔',
    effect: '应变力+5、抗压性+5，免疫常规物理伤害，近身制服检定 DC-5。',
    acquire: '超能力层级≥5，应变力≥20，通关 3 起高危追凶案，消耗五点气力',
    apCost: 5,
    traitCategory: '应变',
  },
  {
    id: 5,
    name: '宿傩·御魂斩术',
    tag: '咒术回战',
    ipSubtitle: '咒术回战 · 两面宿傩',
    effect: '演绎力+4，威慑类检定 DC-5，可强行突破防御结界，压制灵体目标。',
    acquire: '超能力层级≥5，演绎力≥20，莫里亚蒂犯罪网络羁绊≥30，消耗五点气力',
    apCost: 5,
    traitCategory: '演绎',
  },
  {
    id: 6,
    name: '十影术·拘灵寻踪法',
    tag: '咒术回战',
    ipSubtitle: '咒术回战 · 伏黑惠',
    effect: '应变力+4，追踪检定 DC-5，召唤式神潜入侦查，无法被常规手段察觉。',
    acquire: '超能力层级≥4，应变力≥18，通关 2 起无监控追凶案，消耗四点气力',
    apCost: 4,
    traitCategory: '应变',
  },
  {
    id: 7,
    name: '天降帳·侦缉结界符',
    tag: '咒术回战',
    ipSubtitle: '咒术回战',
    effect: '解锁永久特质：现场封锁检定 DC-4，展开结界防止凶手逃脱，掌控结界内动向。',
    acquire: '超能力层级≥3，演绎力≥15，通关 2 起凶手逃脱案，消耗三点气力',
    apCost: 3,
    traitCategory: '演绎',
  },
  {
    id: 8,
    name: '逆术·治愈结晶',
    tag: '咒术回战',
    ipSubtitle: '咒术回战 · 家入硝子',
    effect: '抗压性+3，生存检定 DC-4，可治愈自身/伙伴伤势，恢复满状态。',
    acquire: '超能力层级≥3，抗压性≥15，通关 3 起重伤追凶案，消耗三点气力',
    apCost: 3,
    traitCategory: '抗压',
  },
  {
    id: 9,
    name: '清虚神识筑基真解',
    tag: '神精榜',
    ipSubtitle: '神精榜',
    effect: '情报力+4，密码破译检定 DC-5，解锁记忆宫殿，永久储存案件细节。',
    acquire: '超能力层级≥3，情报力≥15，通关 5 起暗号连环案，消耗三点气力',
    apCost: 3,
    traitCategory: '情报',
  },
  {
    id: 10,
    name: '玉虚金刚不坏身',
    tag: '神精榜',
    ipSubtitle: '神精榜',
    effect: '抗压性+4，抗伤检定 DC-5，免疫常规毒素与物理伤害，可屏蔽痛觉疲惫。',
    acquire: '超能力层级≥3，抗压性≥15，通关 3 起毒杀案，消耗三点气力',
    apCost: 3,
    traitCategory: '抗压',
  },
  {
    id: 11,
    name: '三教合一冲虚诀',
    tag: '神精榜',
    ipSubtitle: '神精榜',
    effect: '全属性+1，所有检定 DC-2，气运值加成翻倍至 66%，可强制 3 次检定大成功。',
    acquire: '超能力层级≥5，全属性≥15，通关 10 起疑难案件，消耗五点气力',
    apCost: 5,
    traitCategory: '情报',
  },
  {
    id: 12,
    name: '玄巫噬咒蛊母',
    tag: '混合',
    ipSubtitle: '神精榜 × 蛊真人',
    effect: '抗压性+3、气运值+2，超自然对抗检定 DC-4，可吞噬咒灵怨灵，被动预警危险。',
    acquire: '超能力层级≥4，抗压性≥16，通关 2 起怨灵杀人案，消耗四点气力',
    apCost: 4,
    traitCategory: '抗压',
  },
  {
    id: 13,
    name: '春秋蝉·时间回溯蛊',
    tag: '蛊真人',
    ipSubtitle: '蛊真人',
    effect: '单次使用：可回溯 1 小时内剧情选择，重置错误操作与检定失败。',
    acquire: '超能力层级≥4，气运值≥18，通关 1 起完美密室案，消耗四点气力，限购 2',
    apCost: 4,
    purchaseLimit: 2,
    traitCategory: '情报',
  },
  {
    id: 14,
    name: '敛息蛊·无痕潜入',
    tag: '蛊真人',
    ipSubtitle: '蛊真人',
    effect: '应变力+3，行动隐蔽度永久+20，潜入检定 DC-4，完全消除气息行踪。',
    acquire: '超能力层级≥3，应变力≥15，通关 2 起卧底调查案，消耗三点气力',
    apCost: 3,
    traitCategory: '应变',
  },
  {
    id: 15,
    name: '智慧蛊·终极侧写',
    tag: '蛊真人',
    ipSubtitle: '蛊真人',
    effect: '情报力+4，凶手侧写检定 DC-5，输入线索直接生成 100% 匹配凶手侧写。',
    acquire: '超能力层级≥4，情报力≥18，通关 5 起连环杀人案，消耗四点气力',
    apCost: 4,
    traitCategory: '情报',
  },
  {
    id: 16,
    name: '气运蛊·真凶显形',
    tag: '蛊真人',
    ipSubtitle: '蛊真人',
    effect: '气运值+4，所有检定气运加成翻倍，可直接标记真凶，无视嫁祸伪装。',
    acquire: '超能力层级≥4，气运值≥18，通关 5 起嫁祸案，消耗四点气力',
    apCost: 4,
    traitCategory: '情报',
  },
  {
    id: 17,
    name: '实力蛊·全域增幅',
    tag: '蛊真人',
    ipSubtitle: '蛊真人',
    effect: '7 项核心属性各+3，持续 7 个剧情日，期间所有检定 DC-2。',
    acquire: '超能力层级≥3，全属性≥12，警队话语权≥30，消耗三点气力',
    apCost: 3,
    traitCategory: '抗压',
  },
  {
    id: 18,
    name: '演绎墙满级核心',
    tag: '神探夏洛克',
    ipSubtitle: '神探夏洛克',
    effect: '贝克街 221B 演绎墙直接拉满 5 级，线索权重+50，线索推演检定 DC-4。',
    acquire: '演绎等级≥大师级，夏洛克羁绊≥80，消耗四点气力',
    apCost: 4,
    traitCategory: '演绎',
  },
  {
    id: 19,
    name: '线人网络全域解锁卡',
    tag: '神探夏洛克',
    ipSubtitle: '神探夏洛克',
    effect: '伦敦地下线人网络羁绊拉满 100，情报覆盖度+50，线索获取效率翻倍。',
    acquire: '超能力层级≥3，情报力≥15，通关 10 起街头案件，消耗三点气力',
    apCost: 3,
    traitCategory: '情报',
  },
  {
    id: 20,
    name: '平行世界线索仪',
    tag: '穿越者',
    ipSubtitle: '穿越者专属',
    effect: '全属性+1，所有检定 DC-2，可调取平行世界同案件完整破案线索。',
    acquire: '超能力层级≥6，全属性≥18，通关所有隐藏案件，消耗六点气力，限购 1',
    apCost: 6,
    purchaseLimit: 1,
    traitCategory: '情报',
  },

  /* —— 咒术回战 · 雾都缉魔扩展 —— */
  {
    id: 21,
    name: '乙骨·里香共犯契约（拓印）',
    tag: '咒术回战',
    ipSubtitle: '咒术回战 · 乙骨忧太',
    effect:
      '沟通力+3、抗压性+2；当同伴濒危时，本轮检定可视为「双人共掷」取高者；对灵体类目标审讯与威慑 DC-3。',
    acquire: '超能力层级≥4，沟通力≥16，通关 1 起「同伴涉案」伦理案，消耗四点气力',
    apCost: 4,
    traitCategory: '沟通',
  },
  {
    id: 22,
    name: '夏油·咒灵操术·缉拿卷轴',
    tag: '咒术回战',
    ipSubtitle: '咒术回战 · 夏油杰',
    effect:
      '情报力+3；可将「街头咒灵传闻」转化为可追踪线索；对组织型犯罪网络侧写时 DC-4，但警队话语权过低时易触发道德检定。',
    acquire: '超能力层级≥4，情报力≥17，任意派系羁绊≥25，消耗四点气力',
    apCost: 4,
    traitCategory: '情报',
  },
  {
    id: 23,
    name: '胀相·赤血溯缘线',
    tag: '咒术回战',
    ipSubtitle: '咒术回战 · 胀相',
    effect:
      '观察力+3；血缘、亲缘与「同出一源」的物证链上，指纹与 DNA 推演检定 DC-4，可识破伪装亲属。',
    acquire: '超能力层级≥3，观察力≥15，通关 1 起家族遗产案，消耗三点气力',
    apCost: 3,
    traitCategory: '洞察',
  },
  {
    id: 24,
    name: '真人·无为转变·形变侧写残页',
    tag: '咒术回战',
    ipSubtitle: '咒术回战 · 真人',
    effect:
      '演绎力+3；对「身份流动」类凶手（易容、替身、人格分裂叙事）侧写 DC-4；失败时承受一次精神污染检定（抗压对抗）。',
    acquire: '超能力层级≥4，演绎力≥17，通关 2 起身份谜案，消耗四点气力',
    apCost: 4,
    traitCategory: '演绎',
  },
  {
    id: 25,
    name: '花御·木隐潜行种',
    tag: '咒术回战',
    ipSubtitle: '咒术回战 · 花御',
    effect:
      '应变力+3、行动隐蔽度叙事加权；在公园、植物园、旧木建筑追踪与潜伏时 DC-4，暴雨雾夜再-1。',
    acquire: '超能力层级≥3，应变力≥15，通关 1 起绿廊/温室案，消耗三点气力',
    apCost: 3,
    traitCategory: '应变',
  },
  {
    id: 26,
    name: '陀艮·渊域水压界（简式·三息）',
    tag: '咒术回战',
    ipSubtitle: '咒术回战 · 陀艮',
    effect:
      '抗压性+4；在封闭空间（地下室、船舱、密道）对峙时，意志与窒息恐惧检定 DC-4；每案限触发 3 次「水压震慑」压制对手先攻。',
    acquire: '超能力层级≥4，抗压性≥16，通关 1 起密闭空间案，消耗四点气力',
    apCost: 4,
    traitCategory: '抗压',
  },
  {
    id: 27,
    name: '黑闪·刹那心算式',
    tag: '咒术回战',
    ipSubtitle: '咒术回战',
    effect:
      '观察力+2、应变力+2；在追逐、械斗、突发证物出现时，本轮可重掷一次 d20 取较高值（每剧情日 2 次）。',
    acquire: '超能力层级≥3，应变力≥14，消耗三点气力',
    apCost: 3,
    traitCategory: '洞察',
  },
  {
    id: 28,
    name: '冥冥·乌鸦航拍契',
    tag: '咒术回战',
    ipSubtitle: '咒术回战 · 冥冥',
    effect:
      '情报力+3；俯瞰视角封锁街区时，情报覆盖度临时+15；追踪「驾车逃逸」类目标 DC-4。',
    acquire: '超能力层级≥3，情报力≥15，警队话语权≥20，消耗三点气力',
    apCost: 3,
    traitCategory: '情报',
  },
  {
    id: 29,
    name: '秤金次·坐杀搏徒骰运',
    tag: '咒术回战',
    ipSubtitle: '咒术回战 · 秤金次',
    effect:
      '气运相关检定可额外掷一枚六面骰，将点数加至士气；若得六点，本回合内各色检定苛刻度各降两档（若得一点则升一档，叙事须交代「运气反噬」）。',
    acquire: '超能力层级≥4，气运值≥16，消耗四点气力，限购 2',
    apCost: 4,
    purchaseLimit: 2,
    traitCategory: '情报',
  },
  {
    id: 30,
    name: '家入式·反转术式·急救印',
    tag: '咒术回战',
    ipSubtitle: '咒术回战 · 家入硝子（进阶）',
    effect:
      '抗压性+2；重伤、中毒、咒伤三线各一次「锁血」豁免（每长线剧情 1 次），需后续剧情补医疗检定。',
    acquire: '超能力层级≥3，抗压性≥15，通关 3 起伤亡案，消耗三点气力',
    apCost: 3,
    traitCategory: '抗压',
  },

  /* —— 神精榜 · 玄门与元神 —— */
  {
    id: 31,
    name: '雷符·破妄眼（拓片）',
    tag: '神精榜',
    ipSubtitle: '神精榜 · 符箓',
    effect:
      '观察力+3；对幻术、致幻剂、煤气灯效应下的「集体错觉」识破 DC-4；雷雨夜检定额外-1 DC。',
    acquire: '超能力层级≥3，观察力≥14，消耗三点气力',
    apCost: 3,
    traitCategory: '洞察',
  },
  {
    id: 32,
    name: '剑丸·斩丝诀（微缩）',
    tag: '神精榜',
    ipSubtitle: '神精榜 · 剑修',
    effect:
      '演绎力+2、应变力+2；在绳索、纤维、丝线类物证上，可一刀两断式锁定「切断工具与力道」推演，DC-3。',
    acquire: '超能力层级≥3，演绎力≥14，消耗三点气力',
    apCost: 3,
    traitCategory: '演绎',
  },
  {
    id: 33,
    name: '洞天缩地符（一瞬·巷弄）',
    tag: '神精榜',
    ipSubtitle: '神精榜 · 洞天',
    effect:
      '应变力+3；在伦敦侧巷追逐中，可宣告「抄近道」一次，跳过一轮障碍检定（每案 1 次）。',
    acquire: '超能力层级≥3，应变力≥15，消耗三点气力',
    apCost: 3,
    traitCategory: '应变',
  },
  {
    id: 34,
    name: '五行锁灵桩图（案卷版）',
    tag: '神精榜',
    ipSubtitle: '神精榜 · 阵图',
    effect:
      '情报力+3；封锁现场后，证物链污染与串供概率下降；「密室」类案件初始线索+1 条（叙事向）。',
    acquire: '超能力层级≥3，情报力≥15，通关 2 起密室案，消耗三点气力',
    apCost: 3,
    traitCategory: '情报',
  },
  {
    id: 35,
    name: '元神旁听·壁后耳（残卷）',
    tag: '神精榜',
    ipSubtitle: '神精榜 · 元神',
    effect:
      '沟通力+3；隔墙偷听时，对抗「察觉」与「反窃听」双检定，你方 DC-4；失败则暴露行踪。',
    acquire: '超能力层级≥3，沟通力≥15，消耗三点气力',
    apCost: 3,
    traitCategory: '沟通',
  },
  {
    id: 36,
    name: '八卦炉烟·迷阵退散',
    tag: '神精榜',
    ipSubtitle: '神精榜 · 炼器',
    effect:
      '情报力+2、抗压性+2；破解烟雾、浓雾、蒸汽掩护下的视野干扰时，环境检定 DC-3。',
    acquire: '超能力层级≥3，通关 1 起雾夜连环案，消耗三点气力',
    apCost: 3,
    traitCategory: '情报',
  },
  {
    id: 37,
    name: '玉册·因果小字（拓印）',
    tag: '神精榜',
    ipSubtitle: '神精榜',
    effect:
      '演绎力+3；在卷宗矛盾处可强制「重排时间线」一次，若成功则直接揭示一处逻辑漏洞（每长线 1 次）。',
    acquire: '超能力层级≥4，演绎力≥16，消耗四点气力',
    apCost: 4,
    traitCategory: '演绎',
  },
  {
    id: 38,
    name: '太虚观星盘（残）',
    tag: '神精榜',
    ipSubtitle: '神精榜 · 占星',
    effect:
      '情报力+4；跨案件「星象/潮汐/节庆日期」关联时 DC-4；需在世界时间推进时才能触发联动。',
    acquire: '超能力层级≥4，情报力≥17，消耗四点气力',
    apCost: 4,
    traitCategory: '情报',
  },

  /* —— 蛊真人 · 蛊与智道 —— */
  {
    id: 39,
    name: '定游蛊·证词锚',
    tag: '蛊真人',
    ipSubtitle: '蛊真人 · 智道',
    effect:
      '沟通力+3；关键证人一旦开口，本轮其证词不可被「轻度干扰」撤回；对抗伪证与恐吓时 DC-3。',
    acquire: '超能力层级≥3，沟通力≥15，消耗三点气力',
    apCost: 3,
    traitCategory: '沟通',
  },
  {
    id: 40,
    name: '月光蛊·夜视卷宗',
    tag: '蛊真人',
    ipSubtitle: '蛊真人',
    effect:
      '观察力+3；夜间阅读、微光下辨读褪色墨水与铅笔压痕时 DC-4；与「雾都」夜晚场景相性极佳。',
    acquire: '超能力层级≥3，观察力≥14，消耗三点气力',
    apCost: 3,
    traitCategory: '洞察',
  },
  {
    id: 41,
    name: '血颅蛊·验谎血滴（仿）',
    tag: '蛊真人',
    ipSubtitle: '蛊真人',
    effect:
      '情报力+3；对自愿接受「血誓」之目标，谎言检定自动多一次对抗机会；失败则反噬信任总值。',
    acquire: '超能力层级≥4，情报力≥16，消耗四点气力',
    apCost: 4,
    traitCategory: '情报',
  },
  {
    id: 42,
    name: '解谜蛊·锁链推演',
    tag: '蛊真人',
    ipSubtitle: '蛊真人 · 智道',
    effect:
      '情报力+4；多线索互锁时，可一次性尝试「全盘推演」检定，成功则直接点亮演绎墙 2 格。',
    acquire: '超能力层级≥4，情报力≥17，通关 3 起多线并进案，消耗四点气力',
    apCost: 4,
    traitCategory: '情报',
  },
  {
    id: 43,
    name: '胆识蛊·绝境一搏（微蛊）',
    tag: '蛊真人',
    ipSubtitle: '蛊真人',
    effect:
      '抗压性+3；在生机与士气低于三成叙事时，一次检定可宣言「孤注一掷」：成功则大成功档，失败则加重伤势。',
    acquire: '超能力层级≥3，抗压性≥14，消耗三点气力',
    apCost: 3,
    traitCategory: '抗压',
  },
  {
    id: 44,
    name: '人祖传·希望碎片（抄本）',
    tag: '蛊真人',
    ipSubtitle: '蛊真人 · 寓言',
    effect:
      '演绎力+2、沟通力+2；对绝望中的 NPC 进行「故事疗法」式说服时 DC-3，易触发羁绊分支。',
    acquire: '超能力层级≥3，通关 1 起自杀干预相关案，消耗三点气力',
    apCost: 3,
    traitCategory: '演绎',
  },
  {
    id: 45,
    name: '态度蛊·话术双旋（仿炼）',
    tag: '蛊真人',
    ipSubtitle: '蛊真人 · 智道',
    effect:
      '沟通力+4；同一轮对话中可切换「软诱导/硬施压」两种话术模式各一次，对抗意志检定 DC-4。',
    acquire: '超能力层级≥4，沟通力≥17，消耗四点气力',
    apCost: 4,
    traitCategory: '沟通',
  },

  /* —— 捞尸人 · 阴河与雾都尸语（适配停尸间、河案、无名尸） —— */
  {
    id: 46,
    name: '阴瞳·停尸间残光',
    tag: '捞尸人',
    ipSubtitle: '捞尸人 · 阴瞳',
    effect:
      '观察力+4；在停尸间、解剖室、地下冷藏库勘查时，尸表细节与死后时间推断 DC-4；对「非自然安详」尸体额外感知检定。',
    acquire: '超能力层级≥3，观察力≥15，通关 1 起法医相关案，消耗三点气力',
    apCost: 3,
    traitCategory: '洞察',
  },
  {
    id: 47,
    name: '尸语残卷·无名者之名',
    tag: '捞尸人',
    ipSubtitle: '捞尸人 · 尸语',
    effect:
      '情报力+3、沟通力+2；对身份不明遗体，可从随身物与齿痕「问」出一句线索（叙事向关键词），每案 2 次。',
    acquire: '超能力层级≥3，通关 1 起无名尸案，消耗三点气力',
    apCost: 3,
    traitCategory: '情报',
  },
  {
    id: 48,
    name: '镇尸钉·雾巷封线',
    tag: '捞尸人',
    ipSubtitle: '捞尸人 · 镇煞',
    effect:
      '应变力+3；封锁现场后，「尸变、起灵、搬运」类超自然干扰检定 DC-4；与苏格兰场封锁令叠用时警队话语权临时+5。',
    acquire: '超能力层级≥3，应变力≥15，通关 1 起灵异常案，消耗三点气力',
    apCost: 3,
    traitCategory: '应变',
  },
  {
    id: 49,
    name: '捞尸契·河案牵引',
    tag: '捞尸人',
    ipSubtitle: '捞尸人 · 河契',
    effect:
      '情报力+4；泰晤士河、运河、码头水案浮尸链上，物证与流向推演 DC-4；雨天再-1 DC。',
    acquire: '超能力层级≥4，情报力≥16，通关 1 起水尸案，消耗四点气力',
    apCost: 4,
    traitCategory: '情报',
  },
  {
    id: 50,
    name: '走阴鞋·夜巡不迷',
    tag: '捞尸人',
    ipSubtitle: '捞尸人 · 走阴',
    effect:
      '应变力+3；夜间穿越墓地、教堂地下、废弃医院时，迷路、跌落、遭遇幻觉检定 DC-4。',
    acquire: '超能力层级≥3，应变力≥14，消耗三点气力',
    apCost: 3,
    traitCategory: '应变',
  },
  {
    id: 51,
    name: '黄泉灯·引渡伪证',
    tag: '捞尸人',
    ipSubtitle: '捞尸人 · 引渡',
    effect:
      '演绎力+3；伪造「临终遗言」类证据时对抗识破 DC-4（高风险：道德与阵营反噬检定同步触发）。',
    acquire: '超能力层级≥4，演绎力≥16，莫里亚蒂网络或地下羁绊≥20，消耗四点气力',
    apCost: 4,
    traitCategory: '演绎',
  },
  {
    id: 52,
    name: '阴阳契·生死簿拓印（残页）',
    tag: '捞尸人',
    ipSubtitle: '捞尸人 · 阴阳簿',
    effect:
      '情报力+5；可宣告「此人当死」或「此人当活」叙事锚点一次，强制与真凶时间线对撞检定（每长线 1 次，限购 1）。',
    acquire: '超能力层级≥5，情报力≥18，通关 5 起死亡案，消耗五点气力，限购 1',
    apCost: 5,
    purchaseLimit: 1,
    traitCategory: '情报',
  },
  {
    id: 53,
    name: '捞尸幡·唤潮证物',
    tag: '捞尸人',
    ipSubtitle: '捞尸人 · 幡引',
    effect:
      '沟通力+3；对「怕水、畏河、曾溺」相关目标审讯时，恐惧与招供检定 DC-4；失败则目标精神崩溃需善后。',
    acquire: '超能力层级≥3，沟通力≥15，消耗三点气力',
    apCost: 3,
    traitCategory: '沟通',
  },

  /* —— 混合 / 雾都原创 —— */
  {
    id: 54,
    name: '双印封条·咒力×符箓',
    tag: '混合',
    ipSubtitle: '咒术回战 × 神精榜',
    effect:
      '抗压性+3、情报力+2；对「双重封印」现场（咒灵+阵法残留）勘查时，超自然干扰合并为一次检定，DC-4。',
    acquire: '超能力层级≥4，抗压性≥16，消耗四点气力',
    apCost: 4,
    traitCategory: '抗压',
  },
  {
    id: 55,
    name: '蛊丝式神·双线追踪',
    tag: '混合',
    ipSubtitle: '蛊真人 × 咒术回战',
    effect:
      '情报力+3、应变力+2；同时追踪两名目标时，可分骰不减值；适合「共犯分头跑」类案。',
    acquire: '超能力层级≥4，情报力≥16，消耗四点气力',
    apCost: 4,
    traitCategory: '情报',
  },
  {
    id: 56,
    name: '尸语演绎墙·捞尸×演绎',
    tag: '混合',
    ipSubtitle: '捞尸人 × 神探夏洛克',
    effect:
      '演绎力+3、观察力+2；停尸间结论可直接投影至 221B 演绎墙，跨场景推理 DC-3（需设施「演绎墙」已解锁）。',
    acquire: '超能力层级≥4，演绎力≥16，贝克街设施≥2，消耗四点气力',
    apCost: 4,
    traitCategory: '演绎',
  },
  {
    id: 57,
    name: '巴斯克维尔雾核·猎犬残响',
    tag: '神探夏洛克',
    ipSubtitle: '神探夏洛克 · 巴斯克维尔',
    effect:
      '观察力+3、应变力+2；沼地、荒原、庄园兽类袭击案追踪与生存检定 DC-4；恐惧检定对抗时士气+10。',
    acquire: '超能力层级≥3，通关 1 起乡野传说类案，消耗三点气力',
    apCost: 3,
    traitCategory: '洞察',
  },
  {
    id: 58,
    name: '莱辛巴赫假死保险（叙事装置）',
    tag: '神探夏洛克',
    ipSubtitle: '神探夏洛克',
    effect:
      '抗压性+3；一次剧情杀/坠崖/坠落判定可宣告「假死」进入暗线回合（每长线 1 次），需后续剧情圆回。',
    acquire: '超能力层级≥4，夏洛克或华生羁绊≥60，消耗四点气力，限购 1',
    apCost: 4,
    purchaseLimit: 1,
    traitCategory: '抗压',
  },
  {
    id: 59,
    name: '剧本外备注笔',
    tag: '穿越者',
    ipSubtitle: '穿越者 · meta',
    effect:
      '沟通力+2、情报力+2；对「打破第四面墙」式人物或戏外线索检定时苛刻度降三档；慎用，以免撕破幕布。',
    acquire: '超能力层级≥4，消耗三点气力',
    apCost: 3,
    traitCategory: '沟通',
  },
  {
    id: 60,
    name: '万界货架·微尘兑换券',
    tag: '穿越者',
    ipSubtitle: '穿越者',
    effect:
      '任意一次次元商城兑换时气力消耗减一（最少仍为一），或免费刷新当日货架叙事（二选一，每剧情周一次）。',
    acquire: '超能力层级≥5，已兑换≥10 件奇物，消耗两点气力，限购 3',
    apCost: 2,
    purchaseLimit: 3,
    traitCategory: '情报',
  },
];

/** 根据 `玩家状态.次元商城已购` 统计各门类兑换件数 */
export function countShopPurchasesByCategory(purchaseCounts: Record<number, number>): Record<TraitCategoryKey, number> {
  const out = Object.fromEntries(TRAIT_CATEGORY_KEYS.map(k => [k, 0])) as Record<TraitCategoryKey, number>;
  for (const item of DIMENSIONAL_SHOP_ITEMS) {
    const n = purchaseCounts[item.id] ?? 0;
    if (n > 0) out[item.traitCategory] += n;
  }
  return out;
}

/** 六大传承门类：卡片展示 + 点击详情（与「特质」栏、七维属性叙事呼应） */
export interface TraitCategoryDetail {
  key: string;
  title: string;
  hint: string;
  accent: string;
  /** 在雾都棋局中的定位 */
  lore: string;
  /** 主加成的七维属性 */
  primaryAttr: string;
  /** 获取难易与门槛感（叙事向，非数值表） */
  acquisition: string;
  /** 对调查员的玩法向加成 */
  bonuses: string[];
  /** 与其它门类或系统的化学反应 */
  synergy?: string;
}

export const TRAIT_CATEGORY_DETAILS: TraitCategoryDetail[] = [
  {
    key: '演绎',
    title: '演绎秘典',
    hint: '伪装易容、慑魂话术等',
    accent: 'from-violet-500/30 to-fuchsia-500/20',
    lore:
      '这一脉不问你真话多少，只问「你能把故事说到多像真的」。从社交场上的身份扮演，到对峙时的气场碾压，皆属「演绎」——让观者信，让对手乱。',
    primaryAttr: '演绎力',
    acquisition:
      '入门易：市井戏法与基础伪装即可上手；精通难：要骗过老狐狸与异界目光，需高演绎、高资源与多次大案洗礼。次元货架中低阶券常见，顶阶往往绑定名案与羁绊。',
    bonuses: [
      '检定：社交演绎、伪装渗透、威慑与话术对抗时，依演绎力获得加值；特质可进一步压低 DC。',
      '叙事：更易取得「假身份掩护」「话术压制 NPC」类成功，影响警队话语权与线人态度。',
      '穿越者向：与「情报」叠用时，可伪造卷宗痕迹；与「沟通」叠用时，审讯与说服双线施压。',
    ],
    synergy: '偏进攻与控场；若七维偏科仅堆演绎，易被硬证据与现场反噬——记得留观察与情报补洞。',
  },
  {
    key: '洞察',
    title: '洞察心法',
    hint: '微表情读心、场景回溯等',
    accent: 'from-cyan-500/30 to-blue-500/20',
    lore:
      '雾都的谎言比煤烟还多。洞察一脉教人从微尘里读因果：一滴血、半句颤音、地毯纤维的走向，皆可指认真凶。',
    primaryAttr: '观察力',
    acquisition:
      '极吃现场与文本细节，前期成长稳、后期吃案件难度。高阶「回溯」类特质常要求通关密室、无监控案等苛刻条件。',
    bonuses: [
      '检定：现场勘查、察言观色、识破伪装与陷阱；对抗「演绎」系欺骗时有额外对抗机会。',
      '叙事：更容易触发「隐藏线索」「时间线矛盾」选项，直接影响线索权重与演绎墙进度。',
      '与「情报」互补：一眼看出物证缺口，再由情报补齐暗线。',
    ],
    synergy: '防守与拆谎核心；与「演绎」在叙事上常形成「谁骗得过谁」的拉锯，适合爱盘逻辑的玩家。',
  },
  {
    key: '沟通',
    title: '沟通话术',
    hint: '共情诱导、咒言束缚等',
    accent: 'from-amber-500/30 to-orange-500/20',
    lore:
      '有人用刀，有人用绳，这一脉用「话」。共情可开嘴，咒缚可封口——让证人开口，让嫌犯失言。',
    primaryAttr: '沟通力',
    acquisition:
      '社交本宽：小到街头线人，大到法庭辩论皆可练级；高阶咒言、缚命类往往要羁绊与超能力层级双达标，偏中后期。',
    bonuses: [
      '检定：审讯、谈判、煽动、安抚；对「信任总值」与派系羁绊有隐性加成，易拿到线人网与警方让步。',
      '叙事：多解锁「说服」「离间」「结盟」分支，改变阵营态势与案件走向。',
      '与「演绎」连携：一软一硬，一问一压，适合控社交节奏。',
    ],
    synergy: '对「警队话语权」「羁绊」条最友好；缺观察时慎防被假供词带偏。',
  },
  {
    key: '应变',
    title: '应变身法',
    hint: '极限追猎、子弹时间等',
    accent: 'from-emerald-500/30 to-teal-500/20',
    lore:
      '当计划赶不上雾都的变卦，这一脉教你用身体与直觉杀出血路：追车、潜入、刹那间的抉择。',
    primaryAttr: '应变力',
    acquisition:
      '吃操作感与剧情刺激度；追逐、潜入、限时案越多，解锁越快。体术与式神类特质常与高危案绑定。',
    bonuses: [
      '检定：追逐、闪避、潜入、即时反应；失败代价常为受伤或暴露，高应变能「买」一次翻盘。',
      '叙事：多行动类、跑酷类、双线操作选项；影响行动隐蔽度与宏观「棋局掌控」体感。',
      '与「抗压」：一攻一守，极限场景下轮流扛伤与反打。',
    ],
    synergy: '节奏最快的一门；若只堆应变不堆情报，易「跑得快却跑错方向」。',
  },
  {
    key: '抗压',
    title: '抗压炼体',
    hint: '金刚护体、绝境逢生等',
    accent: 'from-rose-500/30 to-red-500/20',
    lore:
      '雾都会碾碎粗心的人。炼体一脉把恐惧与疼痛也炼成武器：站得住，才看得见下一回合。',
    primaryAttr: '抗压性',
    acquisition:
      '前期即可堆生存与毒抗；高阶「不死身」「噬咒」类需多次重伤线、毒杀案或怨灵案证明你有命硬到底。',
    bonuses: [
      '检定：意志、创伤、毒素、精神污染；失败时减轻「坏结果」层级，甚至锁血一线生机。',
      '叙事：多「硬扛」「拖延」「以伤换情报」选项，影响团队士气与伙伴存活。',
      '与「气运」：绝境时气运加成放大，易出现大成功翻盘。',
    ],
    synergy: '团队的底线；与「应变」搭配成「打不死又跑得快」的莽夫流，但别忽略推理缺口。',
  },
  {
    key: '情报',
    title: '情报奇术',
    hint: '密码破译、线索推演、真凶显形等',
    accent: 'from-indigo-500/30 to-sky-500/20',
    lore:
      '伦敦的网比蜘蛛丝还密。情报一脉教你从暗号、账本与记忆宫殿里，把真凶从雾里拽出来。',
    primaryAttr: '情报力 · 气运（部分高阶条目）',
    acquisition:
      '最吃案件数量与暗号类副本；前期破译快、后期要「记忆宫殿」与平行线索仪等需全图探索的奇物。',
    bonuses: [
      '检定：破译、侧写、线索合成、嫁祸识破；直接抬高情报覆盖度与线索权重。',
      '叙事：多「推演墙」「卷宗串联」选项，可跨案件锁定真凶与莫里亚蒂网络。',
      '与「洞察」：一眼发现问题，一手拼出答案；与「气运」联动时，真凶显形类特质可无视部分伪装。',
    ],
    synergy: '后期核心；偏科堆情报时记得补沟通或抗压，否则「知道却做不到」。',
  },
];

/** @deprecated 使用 TRAIT_CATEGORY_DETAILS */
export const TRAIT_CATEGORY_BLURBS = TRAIT_CATEGORY_DETAILS.map(({ key, title, hint, accent }) => ({
  key,
  title,
  hint,
  accent,
}));

export function traitCategoryTitle(key: TraitCategoryKey): string {
  return TRAIT_CATEGORY_DETAILS.find(c => c.key === key)?.title ?? key;
}

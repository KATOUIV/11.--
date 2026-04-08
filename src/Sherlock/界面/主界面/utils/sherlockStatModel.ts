/**
 * 从 MVU `stat_data` 解析 Sherlock 变量表（嵌套中文键），供界面绑定进度条 / 雷达等。
 *
 * ## 数值约定（与界面条一致，便于排查「剧情写了但条不对」）
 * - **百分比类**（`num()` → `clampPct`）：界面显示 0–100%。卡面 `stat_data` 应写 **0–100** 的数（或 `"85%"` 字符串）。
 *   若剧情写 **0–1 小数**（如 0.85 表示 85%），当前会显示为 **1%**，需在卡面侧改为百分数或日后加比例检测。
 * - **AP / AP 上限**（`apLike`）：点数制，非百分比。展示条为「当前 AP ÷ 上限」；若某层快照漏写上限，会按本聊天曾出现的上限或当前点数锚定分母，避免 50/50 却显示成 50%。**未写 AP 时视同满额**。
 *
 * ## MVU 路径 ↔ 界面（核对清单）
 * | stat_data 路径 | 界面位置 |
 * |---|---|
 * | `世界层.当前日期` / `当前时间` / `时间线节点` | 顶栏剧情时间、节点 |
 * | `游戏状态.场景锚点` | 顶栏节点后场景 |
 * | `阵营状态层.宏观属性.棋局掌控力` / `安保防护等级` / `行动隐蔽度` | 顶栏 棋局、安保、隐蔽 |
 * | `阵营状态层.信任总值` | 顶栏 信任 |
 * | `玩家状态.AP`、`玩家状态.AP上限` | 顶栏右侧「行动余地」百分比条 |
 * | `玩家状态.HP`、`玩家状态.HP上限`（或 `生命值`） | 顶栏「生机」小方框（相对上限的百分比） |
 * | `阵营状态层.线索权重`、`警队话语权` | 右侧 线索 / 警力 |
 * | `阵营状态层.探案准则.执法边界`、`信息管控` | 右侧 执法 / 管控滑条 |
 *
 * `extractSherlockStats` 为单一数据源；侧栏 / 雷达等应复用本结构，勿重复硬编码路径。
 */
import { pick } from './variableReader';

export interface SherlockWorldLayer {
  date: string;
  time: string;
  timelineNode: string;
  /** 开局或剧情写入的细颗粒场景（游戏状态.场景锚点），与枚举型时间线节点配合展示 */
  sceneAnchor: string;
}

export interface SherlockFactionLayer {
  clueWeight: number;
  policeVoice: number;
  intelCoverage: number;
  trustTotal: number;
  deductionRank: string;
  policeCredibility: number;
  teamMorale: number;
  rules: {
    lawBoundary: number;
    infoControl: number;
    gameBottom: number;
    abilityUse: number;
  };
  macro: {
    chessControl: number;
    securityLevel: number;
    stealth: number;
  };
}

export interface SherlockPlayerState {
  ap: number;
  /** 未在变量表给出时用默认上限 */
  apMax: number;
  /** 调查员当前生命；与 HP上限 同源为点数，界面显示为占上限的百分比 */
  hp: number;
  hpMax: number;
  attrs: Record<string, number>;
  superPowerTier: number;
  traits: Record<string, unknown>;
  /**
   * 与 AP 同源，仅「存起来」的部分；未在 stat_data 配置则不显示。
   * 路径：`玩家状态.AP储备`
   */
  apReserve?: number;
  /** 次元商城各货架编号 → 已兑换次数（用于限购与门类统计） */
  shopPurchaseCounts: Record<number, number>;
}

export interface SherlockCompanionEntry {
  bondLevel: number;
  mental: string;
  hp: number;
  exclusiveTrait: boolean | string;
}

export interface SherlockNormalizedStats {
  world: SherlockWorldLayer;
  faction: SherlockFactionLayer;
  /** 派系羁绊层：名称 → 0–100 */
  bondFactions: Record<string, number>;
  /** 设施等级：名称 → 等级数字；false 视为 0 */
  facilityLevels: Record<string, number>;
  /** 谢林福特监禁区会客室等布尔设施 */
  facilityFlags: Record<string, boolean>;
  warehouse: Record<string, unknown>;
  player: SherlockPlayerState;
  companions: Record<string, SherlockCompanionEntry>;
  rawStatData: Record<string, unknown>;
}

/** AP / 储备等非百分比数值（不做 0–100 夹取） */
function apLike(v: unknown, fallback: number): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/%/g, '').trim());
    if (!Number.isNaN(n)) return n;
  }
  if (Array.isArray(v) && v.length > 0) return apLike(v[0], fallback);
  return fallback;
}

/** 读取 MVU 中可能是数字或 [数字, 说明] 的字段 */
export function num(v: unknown, fallback: number): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return clampPct(v);
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/%/g, '').trim());
    if (!Number.isNaN(n)) return clampPct(n);
  }
  return fallback;
}

function str(v: unknown, fallback: string): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

/** 百分比条：0–100，超出则夹取 */
export function clampPct(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

const NOTFOUND = Symbol('notfound');

function readNested(root: unknown, path: string): unknown {
  const v = pick(root, path, NOTFOUND as unknown);
  return v === NOTFOUND ? undefined : v;
}

/** 各聊天一份：剧情常漏写 AP 上限时用「曾见过的上限 / 当前点数」作分母，避免 50 点却按 100 算成 50% */
const apCapCacheByChat: Record<string, number> = {};

function sherlockChatKeyForApCap(): string {
  try {
    const ST = (globalThis as { SillyTavern?: { getCurrentChatId?: () => unknown } }).SillyTavern;
    const id = ST?.getCurrentChatId?.();
    if (id != null && String(id).length > 0) return String(id);
  } catch {
    /* 非酒馆环境 */
  }
  return '_';
}

function parsePositiveApCap(raw: unknown): number {
  if (raw === undefined || raw === null) return 0;
  const n = apLike(raw, 0);
  return n > 0 ? n : 0;
}

/**
 * 展示用 AP 上限：变量里有 `AP上限` 时以它为准；缺省时沿用本聊天曾记录的上限，否则用当前 AP 首次锚定，最后才兜底 100。
 */
function resolveDisplayApCap(chatKey: string, apMaxRaw: unknown, apHint: number): number {
  const fromVar = parsePositiveApCap(apMaxRaw);
  if (fromVar > 0) {
    apCapCacheByChat[chatKey] = Math.max(apCapCacheByChat[chatKey] ?? 0, fromVar);
    return fromVar;
  }
  const remembered = apCapCacheByChat[chatKey] ?? 0;
  if (remembered > 0) {
    const cap = Math.max(remembered, apHint);
    apCapCacheByChat[chatKey] = cap;
    return cap;
  }
  if (apHint > 0) {
    apCapCacheByChat[chatKey] = apHint;
    return apHint;
  }
  return 100;
}

export function extractSherlockStats(statData: Record<string, unknown> | null | undefined): SherlockNormalizedStats {
  const root = statData && typeof statData === 'object' ? statData : {};

  const world: SherlockWorldLayer = {
    date: str(readNested(root, '世界层.当前日期'), '—'),
    time: str(readNested(root, '世界层.当前时间'), '—'),
    timelineNode: str(readNested(root, '世界层.时间线节点'), '—'),
    sceneAnchor: str(readNested(root, '游戏状态.场景锚点'), ''),
  };

  const faction: SherlockFactionLayer = {
    clueWeight: num(readNested(root, '阵营状态层.线索权重'), 0),
    policeVoice: num(readNested(root, '阵营状态层.警队话语权'), 0),
    intelCoverage: num(readNested(root, '阵营状态层.情报覆盖度'), 0),
    trustTotal: num(readNested(root, '阵营状态层.信任总值'), 0),
    deductionRank: str(readNested(root, '阵营状态层.演绎等级'), '—'),
    policeCredibility: num(readNested(root, '阵营状态层.警队公信力'), 0),
    teamMorale: num(readNested(root, '阵营状态层.团队士气'), 0),
    rules: {
      lawBoundary: num(readNested(root, '阵营状态层.探案准则.执法边界'), 0),
      infoControl: num(readNested(root, '阵营状态层.探案准则.信息管控'), 0),
      gameBottom: num(readNested(root, '阵营状态层.探案准则.博弈底线'), 0),
      abilityUse: num(readNested(root, '阵营状态层.探案准则.能力使用'), 0),
    },
    macro: {
      chessControl: num(readNested(root, '阵营状态层.宏观属性.棋局掌控力'), 0),
      securityLevel: num(readNested(root, '阵营状态层.宏观属性.安保防护等级'), 0),
      stealth: num(readNested(root, '阵营状态层.宏观属性.行动隐蔽度'), 0),
    },
  };

  const bondFactions: Record<string, number> = {};
  const bondLayer = readNested(root, '派系羁绊层');
  if (bondLayer && typeof bondLayer === 'object' && !Array.isArray(bondLayer)) {
    for (const [k, v] of Object.entries(bondLayer as Record<string, unknown>)) {
      bondFactions[k] = num(v, 0);
    }
  }

  const facilityLevels: Record<string, number> = {};
  const facilityFlags: Record<string, boolean> = {};
  const facilitiesRoot = readNested(root, '设施与道具层.设施等级');
  if (facilitiesRoot && typeof facilitiesRoot === 'object' && !Array.isArray(facilitiesRoot)) {
    for (const [k, v] of Object.entries(facilitiesRoot as Record<string, unknown>)) {
      if (typeof v === 'boolean') {
        facilityFlags[k] = v;
        facilityLevels[k] = v ? 1 : 0;
      } else {
        facilityLevels[k] = typeof v === 'number' ? v : num(v, 0);
      }
    }
  }

  const warehouseRaw = readNested(root, '设施与道具层.仓库');
  const warehouse =
    warehouseRaw && typeof warehouseRaw === 'object' && !Array.isArray(warehouseRaw)
      ? { ...(warehouseRaw as Record<string, unknown>) }
      : {};

  const attrs: Record<string, number> = {};
  const attrsRoot = readNested(root, '玩家状态.属性');
  if (attrsRoot && typeof attrsRoot === 'object' && !Array.isArray(attrsRoot)) {
    for (const [k, v] of Object.entries(attrsRoot as Record<string, unknown>)) {
      attrs[k] = num(v, 0);
    }
  }

  const apMaxRaw = readNested(root, '玩家状态.AP上限');
  const apRaw = readNested(root, '玩家状态.AP');
  const apHintForCap = apRaw === undefined ? 0 : apLike(apRaw, 0);
  const chatKey = sherlockChatKeyForApCap();
  let apMax = resolveDisplayApCap(chatKey, apMaxRaw, apHintForCap);
  /** 未写 AP 时视同满额；显式写 0 仍保留 0 */
  const apUncapped = apRaw === undefined ? apMax : apLike(apRaw, apMax);
  if (apUncapped > apMax) {
    apMax = apUncapped;
    apCapCacheByChat[chatKey] = apMax;
  }
  const ap = Math.min(Math.max(0, apUncapped), apMax);

  const hpMaxRaw =
    readNested(root, '玩家状态.HP上限') ?? readNested(root, '玩家状态.生命上限');
  const hpMaxCandidate = apLike(hpMaxRaw, 100);
  const hpMax = hpMaxCandidate > 0 ? hpMaxCandidate : 100;
  const hpOnlyLife = readNested(root, '玩家状态.生命值');
  const hpRaw = readNested(root, '玩家状态.HP') ?? hpOnlyLife;
  let hpUncapped: number;
  if (hpRaw === undefined && hpOnlyLife === undefined) {
    hpUncapped = hpMax;
  } else {
    hpUncapped = apLike(hpRaw, hpMax);
  }
  const hp = Math.min(Math.max(0, hpUncapped), hpMax);

  const traitsRoot = readNested(root, '玩家状态.特质');
  const traits =
    traitsRoot && typeof traitsRoot === 'object' && !Array.isArray(traitsRoot)
      ? { ...(traitsRoot as Record<string, unknown>) }
      : {};

  const arProbe = readNested(root, '玩家状态.AP储备');
  const apReserve = arProbe !== undefined && arProbe !== null ? apLike(arProbe, 0) : undefined;

  const shopPurchaseCounts: Record<number, number> = {};
  const ledgerRoot = readNested(root, '玩家状态.次元商城已购');
  if (ledgerRoot && typeof ledgerRoot === 'object' && !Array.isArray(ledgerRoot)) {
    for (const [k, v] of Object.entries(ledgerRoot as Record<string, unknown>)) {
      const id = Number.parseInt(k, 10);
      if (!Number.isNaN(id)) shopPurchaseCounts[id] = num(v, 0);
    }
  }

  const player: SherlockPlayerState = {
    ap,
    apMax,
    hp,
    hpMax,
    attrs,
    superPowerTier: num(readNested(root, '玩家状态.超能力层级'), 0),
    traits,
    apReserve,
    shopPurchaseCounts,
  };

  const companions: Record<string, SherlockCompanionEntry> = {};
  const compRoot = readNested(root, '羁绊伙伴');
  if (compRoot && typeof compRoot === 'object' && !Array.isArray(compRoot)) {
    for (const [name, entry] of Object.entries(compRoot as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const o = entry as Record<string, unknown>;
      companions[name] = {
        bondLevel: num(o['羁绊等级'], 0),
        mental: str(o['精神状态'], '—'),
        hp: num(o['生命值'], 0),
        exclusiveTrait: o['专属特质'] as boolean | string,
      };
    }
  }

  return {
    world,
    faction,
    bondFactions,
    facilityLevels,
    facilityFlags,
    warehouse,
    player,
    companions,
    rawStatData: root as Record<string, unknown>,
  };
}

/** 七维属性顺序（与雷达一致） */
export const ATTR_RADAR_ORDER = ['演绎力', '观察力', '沟通力', '应变力', '抗压性', '情报力', '气运值'] as const;

export function buildRadarRows(attrs: Record<string, number>): Array<{ subject: string; A: number }> {
  return ATTR_RADAR_ORDER.map(subject => ({
    subject,
    A: clampPct(attrs[subject] ?? 0),
  }));
}

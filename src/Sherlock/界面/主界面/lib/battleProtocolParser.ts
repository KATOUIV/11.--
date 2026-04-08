/**
 * 从 assistant 楼层全文解析博弈/战斗协议行（如 [BATTLE_START]、[ROLL]）。
 * 协议应放在 <maintext> 与 <sum>、<UpdateVariable> 之后，正文框只显示 maintext，故不会污染剧情阅读区。
 */

export const BATTLE_TAG_NAMES = new Set([
  'BATTLE_START',
  'STATUS',
  'ROLL',
  'CHANGE',
  'ROUND_END',
  'BATTLE_END',
  'INIT',
  'ENCOUNTER',
  'SKILL',
  'ITEM',
  'BUFF',
  'CRIT',
  'SYNC',
  'DYING',
  'EXP',
]);

export type BattleLine = { tag: string; body: string; raw: string };

export interface ParsedBattleProtocols {
  lines: BattleLine[];
  /** 是否包含任一已知博弈协议 */
  hasBattleContent: boolean;
  /** 当前回合数（从 BATTLE_START 或 ROUND_END 尽力解析） */
  roundHint: string | null;
}

const TAG_RE = /^\[([A-Z][A-Z0-9_]*)\]\s*(.*)$/;

export function parseBattleProtocols(fullMessage: string): ParsedBattleProtocols {
  if (!fullMessage?.trim()) {
    return { lines: [], hasBattleContent: false, roundHint: null };
  }

  const lines: BattleLine[] = [];
  const rawLines = fullMessage.split(/\r?\n/);
  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line.startsWith('[')) continue;
    const m = line.match(TAG_RE);
    if (!m) continue;
    const tag = m[1];
    const body = (m[2] ?? '').trim();
    lines.push({ tag, body, raw: line });
  }

  const known = lines.filter(l => BATTLE_TAG_NAMES.has(l.tag));
  let roundHint: string | null = null;
  for (const l of known) {
    if (l.tag === 'BATTLE_START') {
      const parts = l.body.split('|');
      if (parts[1]?.trim()) roundHint = parts[1].trim();
    }
    if (l.tag === 'ROUND_END') {
      const p = l.body.split('|')[0]?.trim();
      if (p) roundHint = p;
    }
  }

  return {
    lines,
    hasBattleContent: known.length > 0,
    roundHint,
  };
}

/**
 * 从模型**原始全文**抽出已识别的博弈协议行（与 parseBattleProtocols 一致），用于写入 assistant 楼层。
 * 管线若只重组 XML 标签而不追加本段，文末的 `[ROLL]` 等会被丢弃，雾巷博弈面板会一直报缺协议。
 */
export function extractKnownBattleProtocolBlock(fullMessage: string): string {
  const { lines } = parseBattleProtocols(fullMessage);
  const known = lines.filter(l => BATTLE_TAG_NAMES.has(l.tag));
  if (!known.length) return '';
  return known.map(l => l.raw).join('\n');
}

/** 取「最后一个」结构化闭合标签之后的文本（协议约定写在 maintext/option/sum/UpdateVariable 之后） */
function getTailAfterLastStructuredClose(fullMessage: string): string {
  const closers = ['</UpdateVariable>', '</sum>', '</option>', '</maintext>'];
  let endPos = 0;
  for (const c of closers) {
    const i = fullMessage.lastIndexOf(c);
    if (i !== -1) {
      endPos = Math.max(endPos, i + c.length);
    }
  }
  return endPos > 0 ? fullMessage.slice(endPos) : fullMessage;
}

/**
 * 只从结构化标签**之后**提取博弈行，避免 &lt;maintext&gt; 内若出现形似 `[ROLL]` 的叙事与文末协议重复拼接。
 */
export function extractKnownBattleProtocolBlockAfterStructuredTags(fullMessage: string): string {
  return extractKnownBattleProtocolBlock(getTailAfterLastStructuredClose(fullMessage));
}

/** 将 ROLL 行拆成可读单元（逗号分隔，结构因卡面而异） */
export function parseRollParts(body: string): string[] {
  return body.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * 模型未输出 [ROLL] 等行时的兜底：从全文推断是否「对抗/战斗」。
 * 与触发顺序无关：只要本楼层字符串里存在对应片段即生效。
 */
const ANALYSIS_COMBAT_RE =
  /Combat|combat|战斗|对抗|伏击|械斗|负伤|袭击|血战|assault|knife|blade|wound|melee|搏斗|埋伏|检定|check|roll|DC|dice|有罪|无罪|推定|说服|破坏|摧毁|撬锁|审讯/i;

const MAINTEXT_COMBAT_RE =
  /刀|刃|血|袭击|伏击|搏斗|火并|埋伏|杀手|近身|折叠刀|铁管|捅|刺|割|枪响|枪声|有罪|无罪|推定|陪审|撬|锁|摧毁|砸|说服|识破|谎言|检定|骰|砸门|攀爬|潜行|意志|恐惧/i;

export function inferBattleSignal(fullMessage: string): boolean {
  if (!fullMessage?.trim()) return false;
  if (/\[(?:BATTLE_START|ROLL|ENCOUNTER|ROUND_END|BATTLE_END)\]/i.test(fullMessage)) {
    return true;
  }
  const am = fullMessage.match(/<Analysis>([\s\S]*?)<\/Analysis>/i);
  if (am?.[1] && ANALYSIS_COMBAT_RE.test(am[1])) {
    return true;
  }
  const mt = fullMessage.match(/<maintext>([\s\S]*?)<\/maintext>/i);
  if (mt?.[1] && MAINTEXT_COMBAT_RE.test(mt[1])) {
    return true;
  }
  return false;
}

/**
 * 战斗 HUD：从助手消息中解析「极简行协议」或 COMBAT_JSON。
 * 极简行以 `[VAULT_COMBAT]` 开头，便于正则/AI 稳定输出（思路同 PIP_DATA）。
 */
import { stripReasoningBlocks } from './messageParser';

export type CombatPhase = 'idle' | 'encounter' | 'initiative' | 'status' | 'check' | 'round_end' | 'battle_end';

export type CombatActor = {
  id: string;
  name: string;
  hp: number;
  hpMax: number;
  mp?: number;
  mpMax?: number;
  tags?: string[];
  side?: 'ally' | 'foe';
};

export type LastRoll = {
  title?: string;
  expr?: string;
  total?: number;
  dc?: number;
  grade?: 'crit_success' | 'success' | 'fail' | 'crit_fail' | string;
  damage?: number;
  damageType?: string;
};

export type CombatPayload = {
  v: number;
  phase: CombatPhase | string;
  round?: number;
  actors?: CombatActor[];
  lastRoll?: LastRoll;
};

const MARKER_JSON = 'COMBAT_JSON:';
const MARKER_LINE = '[VAULT_COMBAT]';

/** 提取首个平衡花括号 JSON（支持 COMBAT_JSON: 后多行） */
function extractBalancedJson(s: string): string | null {
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function extractCombatJsonBlob(cleaned: string): string | null {
  const idx = cleaned.lastIndexOf(MARKER_JSON);
  if (idx === -1) return null;
  let rest = cleaned.slice(idx + MARKER_JSON.length).trim();
  if (rest.startsWith('```')) {
    const fenceEnd = rest.indexOf('```', 3);
    if (fenceEnd !== -1) {
      rest = rest
        .slice(3, fenceEnd)
        .replace(/^json\s*/i, '')
        .trim();
    }
  }
  const firstLine = rest.split('\n')[0]?.trim() ?? '';
  if (firstLine.startsWith('{')) {
    try {
      JSON.parse(firstLine);
      return firstLine;
    } catch {
      /* try multiline */
    }
  }
  const balanced = extractBalancedJson(rest);
  if (balanced) {
    try {
      JSON.parse(balanced);
      return balanced;
    } catch {
      return null;
    }
  }
  const loose = rest.match(/\{[\s\S]*\}/);
  if (loose) {
    try {
      JSON.parse(loose[0]);
      return loose[0];
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 单行协议，示例：
 * `[VAULT_COMBAT] status,2 | 马库斯,12,18,ally;哥布林,5,8,foe | 攻击|1d20+5|15|14|success|6|挥砍`
 * 段1: phase,round
 * 段2: 参战者，分号分隔；每人 name,hp,hpMax,side[,id][,mp,mpMax]
 * 段3（可选）: 检定，竖线分隔 title|expr|total|dc|grade|damage|damageType
 */
export function parseVaultCombatLine(line: string): CombatPayload | null {
  const s = line.trim();
  if (!s.startsWith(MARKER_LINE)) return null;
  const inner = s.slice(MARKER_LINE.length).trim();
  const parts = inner.split(/\s*\|\s*/).map(p => p.trim());
  if (parts.length < 2) return null;

  const [head, actorsStr, rollStr] = [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''];
  const headParts = head.split(',').map(x => x.trim());
  const phaseRaw = headParts[0] ?? 'idle';
  const round = Math.max(0, parseInt(headParts[1] ?? '0', 10) || 0);

  const actors: CombatActor[] = [];
  if (actorsStr && actorsStr !== '-') {
    for (const seg of actorsStr.split(';')) {
      const t = seg.trim();
      if (!t) continue;
      const f = t.split(',').map(x => x.trim());
      if (f.length < 4) continue;
      const name = f[0] ?? '';
      const hp = Number(f[1]);
      const hpMax = Number(f[2]);
      const side = f[3];
      const actor: CombatActor = {
        id: name,
        name: name || '未知',
        hp: Number.isFinite(hp) ? hp : 0,
        hpMax: Number.isFinite(hpMax) && hpMax > 0 ? hpMax : 1,
        side: side === 'foe' ? 'foe' : 'ally',
      };
      if (f.length >= 5) actor.id = (f[4] || name).trim() || name;
      if (f.length >= 7) {
        const mp = Number(f[5]);
        const mpMax = Number(f[6]);
        if (Number.isFinite(mp) && Number.isFinite(mpMax)) {
          actor.mp = mp;
          actor.mpMax = mpMax;
        }
      }
      actors.push(actor);
    }
  }

  let lastRoll: LastRoll | undefined;
  if (rollStr && rollStr !== '-') {
    const rf = rollStr.split('|').map(x => x.trim());
    if (rf.length >= 5) {
      const [title, expr, totalS, dcS, grade, dmgS, dmgType] = [rf[0], rf[1], rf[2], rf[3], rf[4], rf[5], rf[6]];
      lastRoll = {
        title: title || undefined,
        expr: expr && expr !== '-' ? expr : undefined,
        total: totalS != null ? Number(totalS) : undefined,
        dc: dcS != null && dcS !== '-' ? Number(dcS) : undefined,
        grade: grade || undefined,
        damage: dmgS != null && dmgS !== '' ? Number(dmgS) : undefined,
        damageType: dmgType && dmgType !== '-' ? dmgType : undefined,
      };
    }
  }

  return {
    v: 1,
    phase: phaseRaw,
    round,
    actors: actors.length ? actors : undefined,
    lastRoll,
  };
}

function parseCombatJsonFromText(text: string): CombatPayload | null {
  const cleaned = stripReasoningBlocks(text);
  const blob = extractCombatJsonBlob(cleaned);
  if (!blob) return null;
  try {
    const o = JSON.parse(blob) as CombatPayload;
    if (o && typeof o === 'object' && o.v === 1) return o;
  } catch {
    /* ignore */
  }
  return null;
}

/** 从消息全文从后往前找第一个可用的 `[VAULT_COMBAT]` 行（允许行前带其它字符） */
function parseVaultCombatFromMessage(text: string): CombatPayload | null {
  const cleaned = stripReasoningBlocks(text);
  const lines = cleaned.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i] ?? '';
    const idx = line.indexOf(MARKER_LINE);
    if (idx === -1) continue;
    const p = parseVaultCombatLine(line.slice(idx).trim());
    if (p) return p;
  }
  return null;
}

export function parseCombatPayloadFromAssistantMessage(message: string): CombatPayload | null {
  const fromLine = parseVaultCombatFromMessage(message);
  if (fromLine) return fromLine;
  return parseCombatJsonFromText(message);
}

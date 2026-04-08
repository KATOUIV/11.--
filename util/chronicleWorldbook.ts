/**
 * 维护角色卡绑定世界书中名为「编年史」的条目：
 * 按 assistant 楼层 message_id 换算编号（floor(message_id/2)），写入/更新 &lt;sum&gt;，
 * 并处理回档重 roll（同编号已存在且存在更高编号时截断更高层）。
 *
 * 依赖酒馆助手全局：getCharWorldbookNames、getWorldbook、updateWorldbookWith、getChatMessages、parseSum（本文件内联解析与 messageParser 一致）
 */

import { parseSum } from './messageParser';
import { findLatestAssistantMessageId } from './statData';

export const CHRONICLE_ENTRY_NAME = '编年史';

/** 楼层编号：用户定义为 message_id 除以 2（向下取整） */
export function chronicleRoundFromMessageId(messageId: number): number {
  if (!Number.isFinite(messageId) || messageId < 0) return 0;
  return Math.floor(messageId / 2);
}

function escapeXmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseChronicleBlocks(body: string): Map<number, string> {
  const map = new Map<number, string>();
  let m: RegExpExecArray | null;
  const re = /<chronicle\s+n="(\d+)">\s*<sum>([\s\S]*?)<\/sum>\s*<\/chronicle>/gi;
  while ((m = re.exec(body)) !== null) {
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n < 0) continue;
    map.set(n, m[2].trim());
  }
  return map;
}

/** 从正文拆出：前言（第一个 &lt;chronicle 之前）与机器管理块 */
function splitPreambleAndChronicleBody(content: string): { preamble: string; body: string } {
  const idx = content.search(/<chronicle\s/i);
  if (idx === -1) {
    return { preamble: content.trimEnd(), body: '' };
  }
  return {
    preamble: content.slice(0, idx).trimEnd(),
    body: content.slice(idx).trim(),
  };
}

function serializeChronicleBody(map: Map<number, string>): string {
  const keys = [...map.keys()].sort((a, b) => b - a);
  const lines: string[] = [];
  for (const n of keys) {
    const sum = map.get(n) ?? '';
    lines.push(`<chronicle n="${n}"><sum>${escapeXmlText(sum)}</sum></chronicle>`);
  }
  return lines.join('\n');
}

function mergeContent(preamble: string, body: string): string {
  const pre = preamble.trimEnd();
  const b = body.trim();
  if (!pre && !b) return '';
  if (!pre) return b;
  if (!b) return pre;
  return `${pre}\n\n${b}`;
}

export async function findChronicleEntryWorldbook(): Promise<{ worldbookName: string; entryIndex: number } | null> {
  if (typeof getCharWorldbookNames !== 'function' || typeof getWorldbook !== 'function') {
    return null;
  }
  try {
    const { primary, additional } = getCharWorldbookNames('current');
    const names = [primary, ...additional].filter(Boolean) as string[];
    for (const wb of names) {
      const book = await getWorldbook(wb);
      const entryIndex = book.findIndex(e => e.name === CHRONICLE_ENTRY_NAME);
      if (entryIndex !== -1) {
        return { worldbookName: wb, entryIndex };
      }
    }
  } catch (e) {
    console.error('[chronicleWorldbook] findChronicleEntryWorldbook', e);
  }
  return null;
}

function hasHigherRound(map: Map<number, string>, n: number): boolean {
  for (const k of map.keys()) {
    if (k > n) return true;
  }
  return false;
}

/**
 * 在收到/更新某条消息后调用：若为 assistant 楼层则更新「编年史」条目。
 */
export async function syncChronicleOnAssistantMessage(messageId: number): Promise<void> {
  if (typeof getChatMessages !== 'function' || typeof updateWorldbookWith !== 'function') {
    return;
  }

  const msgs = getChatMessages(messageId, { role: 'assistant' });
  if (!msgs.length) return;

  const content = msgs[0].message ?? '';
  const sum = parseSum(content);
  const roundNum = chronicleRoundFromMessageId(messageId);

  const found = await findChronicleEntryWorldbook();
  if (!found) {
    console.info('[chronicleWorldbook] 未找到名为「编年史」的世界书条目，已跳过');
    return;
  }

  const { worldbookName, entryIndex } = found;

  let rollbackBranch = false;

  await updateWorldbookWith(
    worldbookName,
    book => {
      const next = [...book];
      const entry = next[entryIndex];
      if (!entry || entry.name !== CHRONICLE_ENTRY_NAME) return book;

      const full = entry.content ?? '';
      const { preamble, body } = splitPreambleAndChronicleBody(full);
      const map = parseChronicleBlocks(body);

      const roundExisted = map.has(roundNum);
      const hadHigher = hasHigherRound(map, roundNum);
      rollbackBranch = roundExisted && hadHigher;

      if (roundExisted && hadHigher) {
        map.set(roundNum, sum);
        for (const k of [...map.keys()]) {
          if (k > roundNum) map.delete(k);
        }
      } else {
        map.set(roundNum, sum);
      }

      const newBody = serializeChronicleBody(map);
      const newContent = mergeContent(preamble, newBody);

      next[entryIndex] = { ...entry, content: newContent };
      return next;
    },
    { render: 'debounced' },
  );

  console.info('[chronicleWorldbook] 已同步编年史', { messageId, roundNum, rollbackBranch });
}

/**
 * 指南别名：定位最新 assistant 楼层，若有 &lt;sum&gt; 则同步「编年史」世界书条目。
 */
export async function checkAndUpdateChronicle(): Promise<void> {
  try {
    const id = findLatestAssistantMessageId();
    if (id == null) return;
    await syncChronicleOnAssistantMessage(id);
  } catch (e) {
    console.error('[chronicleWorldbook] checkAndUpdateChronicle', e);
  }
}

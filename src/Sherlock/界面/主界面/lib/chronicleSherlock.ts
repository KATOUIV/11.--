/**
 * 编年史：从 &lt;sum&gt; 更新世界书（逻辑对齐 mhjg/chronicleUpdater，世界书名由 sherlockConfig 配置）
 */
import { SHERLOCK_ENTRY_CHRONICLE, SHERLOCK_WORLDBOOK_NAME } from './sherlockConfig';

declare function getChatMessages(
  range: string | number,
  options?: { role?: 'all' | 'system' | 'assistant' | 'user' },
): Array<{ message: string; message_id: number; role: string }>;

declare function getLastMessageId(): number;

declare function getWorldbook(worldbook_name: string): Promise<WorldbookEntry[]>;

declare function replaceWorldbook(
  worldbook_name: string,
  worldbook: PartialDeep<WorldbookEntry>[],
  options?: { render?: 'debounced' | 'immediate' },
): Promise<void>;

type WorldbookEntry = {
  uid: number;
  name: string;
  enabled: boolean;
  strategy: Record<string, unknown>;
  position: Record<string, unknown>;
  content: string;
  probability: number;
  recursion: Record<string, unknown>;
  effect: Record<string, unknown>;
  extra?: Record<string, unknown>;
};

type PartialDeep<T> = {
  [P in keyof T]?: T[P] extends object ? PartialDeep<T[P]> : T[P];
};

function parseSum(message: string): string {
  const sumMatch = message.match(/<sum>([\s\S]*?)<\/sum>/i);
  return sumMatch ? sumMatch[1].trim() : '';
}

function findLatestSumMessage(startMessageId: number): { messageId: number; sumText: string } | null {
  for (let messageId = startMessageId; messageId >= 0; messageId--) {
    try {
      const messages = getChatMessages(messageId);
      if (messages?.length) {
        const sumText = parseSum(messages[0].message || '');
        if (sumText) {
          return { messageId, sumText };
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

function parseChronicleContent(content: string): Array<{ number: number; text: string }> {
  const entries: Array<{ number: number; text: string }> = [];
  const lines = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  for (const line of lines) {
    const match = line.match(/^(\d+)\.(.+)$/);
    if (match) {
      const number = parseInt(match[1], 10);
      const text = match[2].trim();
      if (!isNaN(number) && text) {
        entries.push({ number, text });
      }
    }
  }
  return entries;
}

function formatChronicleContent(entries: Array<{ number: number; text: string }>): string {
  entries.sort((a, b) => b.number - a.number);
  return entries.map(entry => `${entry.number}.${entry.text}`).join('\n\n');
}

function updateChronicleEntry(content: string, entryNumber: number, entryText: string): string {
  const entries = parseChronicleContent(content);
  const existingIndex = entries.findIndex(e => e.number === entryNumber);
  if (existingIndex >= 0) {
    entries[existingIndex].text = entryText;
  } else {
    entries.push({ number: entryNumber, text: entryText });
  }
  const filteredEntries = entries.filter(e => e.number <= entryNumber);
  return formatChronicleContent(filteredEntries);
}

async function updateChronicleInWorldbook(messageId: number, sumText: string): Promise<void> {
  if (!SHERLOCK_WORLDBOOK_NAME.trim()) {
    return;
  }

  /** 首条 assistant 常为 id=0；之后 user/assistant 交替，偶数 id 为 AI 层：编号 = floor(id/2)+1 */
  const entryNumber = Math.floor(messageId / 2) + 1;
  if (entryNumber < 1) {
    return;
  }

  try {
    let worldbook: WorldbookEntry[];
    try {
      worldbook = await getWorldbook(SHERLOCK_WORLDBOOK_NAME);
    } catch (err) {
      console.warn(`[Sherlock] 世界书不存在，跳过编年史:`, err);
      return;
    }

    let chronicleEntry = worldbook.find(entry => entry.name === SHERLOCK_ENTRY_CHRONICLE);
    if (!chronicleEntry) {
      console.warn(`[Sherlock] 未找到条目「${SHERLOCK_ENTRY_CHRONICLE}」`);
      return;
    }

    const currentContent = chronicleEntry.content || '';
    const updatedContent = updateChronicleEntry(currentContent, entryNumber, sumText);
    chronicleEntry = { ...chronicleEntry, content: updatedContent };
    const updatedWorldbook = worldbook.map(entry => (entry.name === SHERLOCK_ENTRY_CHRONICLE ? chronicleEntry : entry));
    await replaceWorldbook(SHERLOCK_WORLDBOOK_NAME, updatedWorldbook, { render: 'debounced' });
    console.info(`[Sherlock] 编年史已更新: ${entryNumber}.${sumText}`);
  } catch (error) {
    console.error('[Sherlock] 更新编年史失败:', error);
  }
}

export async function checkAndUpdateChronicleSherlock(): Promise<void> {
  if (!SHERLOCK_WORLDBOOK_NAME.trim()) {
    return;
  }
  try {
    const latestMessageId = getLastMessageId();
    if (latestMessageId < 0) {
      return;
    }
    const sumInfo = findLatestSumMessage(latestMessageId);
    if (!sumInfo) {
      return;
    }
    await updateChronicleInWorldbook(sumInfo.messageId, sumInfo.sumText);
  } catch (error) {
    console.error('[Sherlock] checkAndUpdateChronicleSherlock:', error);
  }
}

/** 开局或异步写入后延迟重试，对齐 adventure 编年史重试惯例 */
export async function checkAndUpdateChronicleSherlockWithRetry(retries = 3): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
      await checkAndUpdateChronicleSherlock();
      return;
    } catch (e) {
      console.warn(`[Sherlock] 编年史更新重试 ${i + 1}/${retries}:`, e);
    }
  }
}

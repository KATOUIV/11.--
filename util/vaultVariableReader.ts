/**
 * 变量读取（对齐指南 variableReader）：多源回退 + MVU [值,描述] 的 pick
 */
import { klona } from 'klona';

declare function getVariables(option: { type: 'message'; message_id: number | 'latest' }): Record<string, unknown>;
declare function getChatMessages(
  range: number,
  opt?: { role?: 'all' | 'assistant' | 'user' | 'system' },
): { message_id: number; message: string; role: string; data?: Record<string, unknown> }[];
declare function getLastMessageId(): number;

type Value = string | number | boolean | Record<string, unknown> | unknown[] | null | undefined;

/**
 * 从嵌套对象按路径取值；支持 MVU 元组 `[值, "描述"]`（取首元素）
 */
export function pick<T extends Value>(obj: unknown, path: string, fallback: T): T {
  if (!obj || typeof obj !== 'object') return fallback;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return fallback;
    if (Array.isArray(cur) && cur.length > 0) {
      cur = cur[0];
      if (cur == null || typeof cur !== 'object') return fallback;
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  if (Array.isArray(cur) && cur.length > 0) return (cur[0] as T) ?? fallback;
  return (cur as T) ?? fallback;
}

function hasStatDataContent(stat_data: unknown): boolean {
  return !!(stat_data && typeof stat_data === 'object' && !Array.isArray(stat_data) && Object.keys(stat_data).length > 0);
}

let mvuInitPromise: Promise<void> | null = null;

async function ensureMvuInitialized(): Promise<void> {
  if (typeof Mvu === 'undefined') return;
  if (mvuInitPromise) return mvuInitPromise;
  mvuInitPromise = (async () => {
    try {
      if (typeof waitGlobalInitialized === 'function') {
        await waitGlobalInitialized('Mvu');
      }
    } catch {
      /* ignore */
    }
  })();
  return mvuInitPromise;
}

export type VaultGameMvuSnapshot = {
  stat_data: Record<string, unknown>;
  display_data?: Record<string, unknown>;
  delta_data?: Record<string, unknown>;
  source: 'assistant_mvu' | 'assistant_data' | 'latest_mvu' | 'latest_vars' | 'layer0_mvu' | 'layer0_vars' | 'empty';
};

/**
 * 读取优先级：最新 assistant 的 MVU → 其 data → latest MVU → latest getVariables → 0 层 MVU → 0 层 getVariables
 */
export async function getVaultGameMvuData(): Promise<VaultGameMvuSnapshot> {
  await ensureMvuInitialized();

  const empty = (): VaultGameMvuSnapshot => ({ stat_data: {}, source: 'empty' });

  if (typeof getChatMessages !== 'function' || typeof getLastMessageId !== 'function') {
    return empty();
  }

  const tryAssistant = (messageId: number): VaultGameMvuSnapshot | null => {
    try {
      if (typeof Mvu !== 'undefined' && typeof Mvu.getMvuData === 'function') {
        const mvuData = Mvu.getMvuData({ type: 'message', message_id: messageId });
        if (mvuData && hasStatDataContent(mvuData.stat_data)) {
          return {
            stat_data: (mvuData.stat_data || {}) as Record<string, unknown>,
            display_data: mvuData.display_data as Record<string, unknown> | undefined,
            delta_data: mvuData.delta_data as Record<string, unknown> | undefined,
            source: 'assistant_mvu',
          };
        }
      }
    } catch {
      /* continue */
    }
    try {
      const msgs = getChatMessages(messageId, { role: 'assistant' });
      const m = msgs[0];
      const sd = m?.data?.stat_data;
      if (hasStatDataContent(sd)) {
        return {
          stat_data: sd as Record<string, unknown>,
          display_data: m?.data?.display_data as Record<string, unknown> | undefined,
          source: 'assistant_data',
        };
      }
    } catch {
      /* continue */
    }
    return null;
  };

  try {
    const assistantMsgs = getChatMessages(-1, { role: 'assistant' });
    if (assistantMsgs.length > 0) {
      const id = assistantMsgs[assistantMsgs.length - 1].message_id;
      const fromAsst = tryAssistant(id);
      if (fromAsst) return fromAsst;
    }
  } catch {
    /* continue */
  }

  try {
    if (typeof Mvu !== 'undefined' && typeof Mvu.getMvuData === 'function') {
      const mvuData = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
      if (mvuData && hasStatDataContent(mvuData.stat_data)) {
        return {
          stat_data: (mvuData.stat_data || {}) as Record<string, unknown>,
          display_data: mvuData.display_data as Record<string, unknown> | undefined,
          delta_data: mvuData.delta_data as Record<string, unknown> | undefined,
          source: 'latest_mvu',
        };
      }
    }
  } catch {
    /* continue */
  }

  try {
    if (typeof getVariables === 'function') {
      const variables = getVariables({ type: 'message', message_id: 'latest' });
      if (hasStatDataContent(variables.stat_data)) {
        return {
          stat_data: (variables.stat_data || {}) as Record<string, unknown>,
          display_data: variables.display_data as Record<string, unknown> | undefined,
          source: 'latest_vars',
        };
      }
    }
  } catch {
    /* continue */
  }

  try {
    if (typeof Mvu !== 'undefined' && typeof Mvu.getMvuData === 'function') {
      const mvuData = Mvu.getMvuData({ type: 'message', message_id: 0 });
      if (mvuData && hasStatDataContent(mvuData.stat_data)) {
        return {
          stat_data: (mvuData.stat_data || {}) as Record<string, unknown>,
          display_data: mvuData.display_data as Record<string, unknown> | undefined,
          delta_data: mvuData.delta_data as Record<string, unknown> | undefined,
          source: 'layer0_mvu',
        };
      }
    }
  } catch {
    /* continue */
  }

  try {
    if (typeof getVariables === 'function') {
      const variables = getVariables({ type: 'message', message_id: 0 });
      if (hasStatDataContent(variables.stat_data)) {
        return {
          stat_data: (variables.stat_data || {}) as Record<string, unknown>,
          display_data: variables.display_data as Record<string, unknown> | undefined,
          source: 'layer0_vars',
        };
      }
    }
  } catch {
    /* continue */
  }

  return empty();
}

/** 供界面或调试使用的扁平读取（可按需扩展字段） */
export async function readVaultGameData(): Promise<{
  stat_data: Record<string, unknown>;
  source: VaultGameMvuSnapshot['source'];
  世界环境层: Record<string, unknown>;
}> {
  const m = await getVaultGameMvuData();
  const stat = klona(m.stat_data);
  const ambientRaw = pick(stat, '世界环境层', {});
  const 世界环境层 =
    ambientRaw && typeof ambientRaw === 'object' && !Array.isArray(ambientRaw)
      ? (ambientRaw as Record<string, unknown>)
      : {};
  return { stat_data: stat, source: m.source, 世界环境层 };
}

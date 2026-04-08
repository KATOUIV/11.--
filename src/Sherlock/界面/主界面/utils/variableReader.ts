/**
 * MVU 变量读取（Sherlock 案卷）
 * 1. **最新楼层**（含 user）：选项/递状后 AP 等写在最新 user 的 `data` 上；若优先读 assistant，HUD 会滞后到下一纸回音。
 * 2. 最近一条 assistant（兼容：最新层无 stat 时回退）
 * 3. Mvu.getMvuData(latest)、getVariables(latest)、0 层兜底
 */

declare function getChatMessages(
  range: string | number,
  options?: { role?: 'all' | 'system' | 'assistant' | 'user' },
): Array<{ message_id: number; role: string; data?: Record<string, unknown>; message?: string }>;
declare function getLastMessageId(): number;
declare function getVariables(option: { type: 'message'; message_id: number | 'latest' }): Record<string, unknown>;
declare function waitGlobalInitialized(name: 'Mvu' | string): Promise<unknown>;

function hasStatDataContent(stat_data: unknown): boolean {
  return Boolean(stat_data && typeof stat_data === 'object' && Object.keys(stat_data as object).length > 0);
}

type Value = string | number | boolean | Record<string, unknown> | unknown[] | null | undefined;

/**
 * 从嵌套路径取值，支持 MVU 的 [值, "描述"] 元组
 */
export function pick<T extends Value>(obj: unknown, path: string, fallback: T): T {
  if (obj == null) return fallback;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null) return fallback;
    if (Array.isArray(cur) && cur.length > 0 && typeof cur[0] !== 'object') {
      cur = cur[0];
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  if (Array.isArray(cur) && cur.length > 0) {
    return (cur[0] as T) ?? fallback;
  }
  return (cur as T) ?? fallback;
}

/** 将任意对象整理为 Mvu.parseMessage / replaceMvuData 可用的结构 */
export function ensureMvuData(raw: Record<string, unknown> | null | undefined): Mvu.MvuData {
  const r = raw ?? {};
  const init = r.initialized_lorebooks;
  return {
    initialized_lorebooks:
      init && typeof init === 'object' && !Array.isArray(init)
        ? (init as Mvu.MvuData['initialized_lorebooks'])
        : {},
    stat_data:
      typeof r.stat_data === 'object' && r.stat_data !== null
        ? (r.stat_data as Record<string, unknown>)
        : {},
    ...(typeof r.display_data === 'object' ? { display_data: r.display_data } : {}),
    ...(typeof r.delta_data === 'object' ? { delta_data: r.delta_data } : {}),
  } as Mvu.MvuData;
}

let mvuReady = false;
let mvuPromise: Promise<void> | null = null;

export async function ensureMvuInitialized(): Promise<void> {
  if (mvuReady) return;
  if (mvuPromise) return mvuPromise;
  mvuPromise = (async () => {
    try {
      await waitGlobalInitialized('Mvu');
      mvuReady = true;
      console.info('✅ [Sherlock variableReader] MVU 已就绪');
    } catch (e) {
      console.warn('⚠️ [Sherlock variableReader] MVU 初始化异常:', e);
      mvuReady = true;
    }
  })();
  return mvuPromise;
}

/**
 * 按指南优先级读取当前对局可用的 MVU 数据（用于界面或作为 user 消息基底）
 */
export async function getGameMvuData(): Promise<Mvu.MvuData> {
  await ensureMvuInitialized();

  try {
    if (typeof getLastMessageId === 'function') {
      const lastId = getLastMessageId();
      if (lastId >= 0) {
        try {
          const rows = getChatMessages(lastId);
          const lastRow = rows?.[0];
          const fromData = lastRow?.data as { stat_data?: unknown } | undefined;
          if (fromData && hasStatDataContent(fromData.stat_data)) {
            console.info(`✅ [Sherlock variableReader] 自最新楼层 ${lastId} (${lastRow?.role ?? '?'}) 的 data 读取`);
            return ensureMvuData(fromData as Record<string, unknown>);
          }
        } catch (err) {
          console.warn(`⚠️ [Sherlock variableReader] getChatMessages(${lastId})`, err);
        }
        try {
          const mvuLatestFloor = Mvu.getMvuData({ type: 'message', message_id: lastId });
          if (mvuLatestFloor?.stat_data && hasStatDataContent(mvuLatestFloor.stat_data)) {
            console.info(`✅ [Sherlock variableReader] 自最新楼层 ${lastId} MVU 读取`);
            return ensureMvuData(mvuLatestFloor as unknown as Record<string, unknown>);
          }
        } catch (err) {
          console.warn(`⚠️ [Sherlock variableReader] getMvuData(${lastId})`, err);
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ [Sherlock variableReader] 读取最新楼层失败', err);
  }

  try {
    const assistantMsgs = getChatMessages(-1, { role: 'assistant' });
    if (assistantMsgs?.length) {
      const latestAssistant = assistantMsgs[assistantMsgs.length - 1];
      const messageId = latestAssistant.message_id;
      try {
        const mvuData = Mvu.getMvuData({ type: 'message', message_id: messageId });
        if (mvuData?.stat_data && hasStatDataContent(mvuData.stat_data)) {
          console.info(`✅ [Sherlock variableReader] 自 assistant 楼层 ${messageId} 读取 MVU`);
          return ensureMvuData(mvuData as unknown as Record<string, unknown>);
        }
      } catch (err) {
        console.warn(`⚠️ [Sherlock variableReader] getMvuData(${messageId})`, err);
      }
      const d = latestAssistant.data;
      if (d && hasStatDataContent((d as { stat_data?: unknown }).stat_data)) {
        console.info(`✅ [Sherlock variableReader] 自 assistant 楼层 ${messageId} 的 data 读取`);
        return ensureMvuData(d as Record<string, unknown>);
      }
    }
  } catch (err) {
    console.warn('⚠️ [Sherlock variableReader] 读取 assistant 失败', err);
  }

  try {
    const mvuData = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
    if (mvuData?.stat_data && hasStatDataContent(mvuData.stat_data)) {
      console.info('✅ [Sherlock variableReader] 自 latest 读取 MVU');
      return ensureMvuData(mvuData as unknown as Record<string, unknown>);
    }
  } catch (err) {
    console.warn('⚠️ [Sherlock variableReader] latest MVU', err);
  }

  try {
    const variables = getVariables({ type: 'message', message_id: 'latest' });
    if (variables?.stat_data && hasStatDataContent(variables.stat_data)) {
      console.info('✅ [Sherlock variableReader] 自 getVariables(latest) 读取');
      return ensureMvuData(variables as Record<string, unknown>);
    }
  } catch (err) {
    console.warn('⚠️ [Sherlock variableReader] getVariables latest', err);
  }

  try {
    const mvu0 = Mvu.getMvuData({ type: 'message', message_id: 0 });
    if (mvu0?.stat_data && hasStatDataContent(mvu0.stat_data)) {
      console.info('✅ [Sherlock variableReader] 自 0 层 MVU 读取');
      return ensureMvuData(mvu0 as unknown as Record<string, unknown>);
    }
  } catch (err) {
    console.warn('⚠️ [Sherlock variableReader] MVU(0)', err);
  }

  try {
    const v0 = getVariables({ type: 'message', message_id: 0 });
    if (v0?.stat_data && hasStatDataContent(v0.stat_data)) {
      console.info('✅ [Sherlock variableReader] 自 getVariables(0) 读取');
      return ensureMvuData(v0 as Record<string, unknown>);
    }
  } catch (err) {
    console.warn('⚠️ [Sherlock variableReader] getVariables(0)', err);
  }

  console.warn('⚠️ [Sherlock variableReader] 无可用 stat_data，返回空壳');
  return ensureMvuData({});
}

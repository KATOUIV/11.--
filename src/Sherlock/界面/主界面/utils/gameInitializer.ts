/**
 * 开局：第 0 层消息变量 + assistant 开局文；玩家首条正文由界面内复制后自行粘贴到酒馆输入框发送。
 * 支持：角色卡已有 user/assistant 开场白时先备份，手记完成后再恢复原文并挂上合并后的 MVU。
 */
import merge from 'lodash/merge';
import {
  buildMessageZeroClipboardText,
  buildOpeningBookStatPatch,
  composeOpeningBookMessages,
} from '../lib/openingBook';
import type { SherlockOpeningFormData } from '../types';
import { isOpeningBookCompleted } from '../gamePhase';

let isCreatingOpening = false;

async function getLayer0MvuPayload(): Promise<Mvu.MvuData> {
  try {
    await waitGlobalInitialized('Mvu');
    const mvu = Mvu.getMvuData({ type: 'message', message_id: 0 });
    if (mvu?.stat_data) {
      return mvu;
    }
  } catch {
    /* 忽略 */
  }
  try {
    const vars = getVariables({ type: 'message', message_id: 0 });
    if (vars?.stat_data) {
      return {
        initialized_lorebooks: {},
        stat_data: vars.stat_data as Record<string, unknown>,
        display_data: vars.display_data as Record<string, unknown> | undefined,
        delta_data: vars.delta_data as Record<string, unknown> | undefined,
      } as Mvu.MvuData;
    }
  } catch {
    /* 忽略 */
  }
  return {
    initialized_lorebooks: {},
    stat_data: {},
  } as Mvu.MvuData;
}

function backupStorageKey(): string {
  const id =
    typeof SillyTavern !== 'undefined' && typeof SillyTavern.getCurrentChatId === 'function'
      ? SillyTavern.getCurrentChatId()
      : 'default';
  return `sherlock_opening_backup_${id}`;
}

export type SherlockOpeningBackup = {
  userMessage: string;
  assistantMessageId: number | null;
  assistantMessage: string;
};

/**
 * 进入开局流程前调用（载入结束或点「开始游戏」时）：备份第 0 层 user 与首条 assistant 原文，便于手记完成后写回。
 */
export function captureSherlockOpeningBackup(): void {
  if (typeof sessionStorage === 'undefined' || typeof getLastMessageId !== 'function' || typeof getChatMessages !== 'function') {
    return;
  }
  if (isOpeningBookCompleted()) {
    return;
  }
  const key = backupStorageKey();
  if (sessionStorage.getItem(key)) {
    return;
  }
  const last = getLastMessageId();
  if (last < 0) {
    return;
  }

  let userMessage = '';
  try {
    const u = getChatMessages(0)?.[0] as { role?: string; message?: string } | undefined;
    if (u?.role === 'user') {
      userMessage = u.message || '';
    }
  } catch {
    /* 忽略 */
  }

  let assistantMessageId: number | null = null;
  let assistantMessage = '';
  try {
    for (let i = 0; i <= last; i++) {
      const m = getChatMessages(i)?.[0] as { role?: string; message?: string } | undefined;
      if (m?.role === 'assistant') {
        assistantMessageId = i;
        assistantMessage = m.message || '';
        break;
      }
    }
  } catch {
    /* 忽略 */
  }

  const payload: SherlockOpeningBackup = {
    userMessage,
    assistantMessageId,
    assistantMessage,
  };
  try {
    sessionStorage.setItem(key, JSON.stringify(payload));
    console.info('✅ [Sherlock gameInitializer] 已备份开场白（user + 如有则 assistant）');
  } catch {
    /* 忽略 */
  }
}

function readSherlockOpeningBackup(): SherlockOpeningBackup | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(backupStorageKey());
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as SherlockOpeningBackup;
  } catch {
    return null;
  }
}

function clearSherlockOpeningBackup(): void {
  try {
    sessionStorage.removeItem(backupStorageKey());
  } catch {
    /* 忽略 */
  }
}

/** 从低到高查找第一条指定 role 的楼层号；无则 null */
function getFirstMessageIndexByRole(role: 'user' | 'assistant'): number | null {
  if (typeof getLastMessageId !== 'function' || typeof getChatMessages !== 'function') {
    return null;
  }
  try {
    const last = getLastMessageId();
    if (last < 0) {
      return null;
    }
    for (let i = 0; i <= last; i++) {
      const m = getChatMessages(i)?.[0] as { role?: string } | undefined;
      if (m?.role === role) {
        return i;
      }
    }
  } catch {
    /* 忽略 */
  }
  return null;
}

/**
 * 将手记选项写入 0 层消息变量（深合并 stat_data），并标记手记已完成（用于下次进入主界面）。
 */
export async function initializeGameVariables(formData: SherlockOpeningFormData): Promise<boolean> {
  try {
    await updateVariablesWith(
      vars => {
        const next = vars && typeof vars === 'object' ? { ...vars } : {};
        if (!next.stat_data || typeof next.stat_data !== 'object') {
          next.stat_data = {};
        }
        const stat = next.stat_data as Record<string, unknown>;
        merge(stat, buildOpeningBookStatPatch(formData));
        merge(stat, {
          游戏状态: {
            手记启封完成: true,
          },
        });
        /** 手记经界面首次落印：行动余地顶栏显示满格（AP 与上限对齐） */
        const pr = stat['玩家状态'];
        if (pr && typeof pr === 'object' && !Array.isArray(pr)) {
          const player = pr as Record<string, unknown>;
          const capRaw = player['AP上限'];
          let cap = 100;
          if (typeof capRaw === 'number' && !Number.isNaN(capRaw) && capRaw > 0) {
            cap = capRaw;
          } else if (typeof capRaw === 'string') {
            const n = parseFloat(capRaw.replace(/%/g, '').trim());
            if (!Number.isNaN(n) && n > 0) cap = n;
          } else if (Array.isArray(capRaw) && capRaw.length > 0) {
            const n = Number(capRaw[0]);
            if (!Number.isNaN(n) && n > 0) cap = n;
          }
          player['AP'] = cap;
          player['AP上限'] = cap;
        }
        return next;
      },
      { type: 'message', message_id: 0 },
    );
    console.info('✅ [Sherlock gameInitializer] 0 层变量已写入（手记开局 + 手记启封完成）');
    return true;
  } catch (error) {
    console.error('❌ [Sherlock gameInitializer] initializeGameVariables:', error);
    return false;
  }
}

/**
 * 将开局全文写入系统剪贴板（供玩家粘贴到酒馆输入框）。
 */
export async function rewriteUserMessageZeroWithOpening(formData: SherlockOpeningFormData): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(buildMessageZeroClipboardText(formData));
    return true;
  } catch (error) {
    console.warn('⚠️ [Sherlock gameInitializer] rewriteUserMessageZeroWithOpening:', error);
    return false;
  }
}

/**
 * 手记完成后的统一收尾：写入第 0 层变量与 assistant（开局全文由界面复制，见 OpeningBookWizard）。
 * 若有备份则按**当前**首条 assistant 楼层恢复原文，原文为空时用合成开局文（避免空白 assistant）。
 */
export async function finalizeOpeningAfterWizard(formData: SherlockOpeningFormData): Promise<boolean> {
  const ok = await initializeGameVariables(formData);
  if (!ok) {
    return false;
  }

  const layer0Data = await getLayer0MvuPayload();
  const { maintext, option, sum } = composeOpeningBookMessages(formData);
  const composedAssistant = `${maintext}\n\n${sum}\n\n${option}`;

  let storyOk = true;
  try {
    const backup = readSherlockOpeningBackup();
    const firstAssistantIdx = getFirstMessageIndexByRole('assistant');

    if (backup) {
      if (firstAssistantIdx !== null) {
        const raw = backup.assistantMessage?.trim() ?? '';
        const assistantText = raw || composedAssistant;
        await setChatMessages(
          [
            {
              message_id: firstAssistantIdx,
              message: assistantText,
              data: layer0Data as unknown as Record<string, unknown>,
            },
          ],
          { refresh: 'affected' },
        );
        console.info('✅ [Sherlock gameInitializer] 已恢复/填充首条 assistant 并同步 MVU');
        void scheduleChronicleRetry();
      } else {
        storyOk = await createOpeningStoryMessage(formData);
      }
      clearSherlockOpeningBackup();
    } else {
      storyOk = await createOpeningStoryMessage(formData);
    }

    return storyOk;
  } catch (error) {
    console.error('❌ [Sherlock gameInitializer] finalizeOpeningAfterWizard:', error);
    return false;
  }
}

/**
 * 创建开局 assistant 楼层（含 maintext / option / sum），并携带 0 层 MVU data
 */
export async function createOpeningStoryMessage(formData: SherlockOpeningFormData): Promise<boolean> {
  if (isCreatingOpening) {
    console.warn('⚠️ [Sherlock gameInitializer] 正在创建开局，跳过重复调用');
    return false;
  }

  isCreatingOpening = true;
  try {
    const last = getLastMessageId();
    if (last >= 0) {
      const firstAi = getFirstMessageIndexByRole('assistant');
      if (firstAi !== null) {
        const m = getChatMessages(firstAi)?.[0] as { message?: string } | undefined;
        if (m?.message?.trim()) {
          console.warn('⚠️ [Sherlock gameInitializer] 已有非空 assistant 楼层，跳过开局创建');
          void scheduleChronicleRetry();
          return true;
        }
        const { maintext, option, sum } = composeOpeningBookMessages(formData);
        const message = `${maintext}\n\n${sum}\n\n${option}`;
        const layer0Data = await getLayer0MvuPayload();
        await setChatMessages(
          [{ message_id: firstAi, message, data: layer0Data as unknown as Record<string, unknown> }],
          { refresh: 'none' },
        );
        console.info('✅ [Sherlock gameInitializer] 已填充空白的 assistant 开局楼层');
        void scheduleChronicleRetry();
        return true;
      }
    }

    const { maintext, option, sum } = composeOpeningBookMessages(formData);
    const message = `${maintext}\n\n${sum}\n\n${option}`;
    const layer0Data = await getLayer0MvuPayload();

    await createChatMessages(
      [{ role: 'assistant', message, data: layer0Data as unknown as Record<string, unknown> }],
      { refresh: 'none' },
    );

    console.info('✅ [Sherlock gameInitializer] 开局 assistant 楼层已创建');
    void scheduleChronicleRetry();
    return true;
  } catch (error) {
    console.error('❌ [Sherlock gameInitializer] createOpeningStoryMessage:', error);
    return false;
  } finally {
    isCreatingOpening = false;
  }
}

async function scheduleChronicleRetry(): Promise<void> {
  const { checkAndUpdateChronicleSherlockWithRetry } = await import('../lib/chronicleSherlock');
  await checkAndUpdateChronicleSherlockWithRetry();
}

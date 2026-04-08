/**
 * 开局流程（对齐 mhjg / horr / adventure 指南）：
 * - initializeGameVariables：写入 0 层变量（原子更新）
 * - createOpeningStoryMessage：创建 1 层 assistant 开局楼，携带 0 层 data，refresh:none，并尝试更新编年史
 */
import { klona } from 'klona';

import { syncChronicleOnAssistantMessage } from './chronicleWorldbook';
import { applyVaultOpeningToMessage0, type VaultOpeningDraft } from './vaultOpening';

export type VaultOpeningFormData = VaultOpeningDraft;

let isCreatingOpening = false;

/**
 * 将表单数据写入酒馆 **message_id: 0**（优先 MVU.replaceMvuData，否则 updateVariablesWith）
 */
export async function initializeGameVariables(formData: VaultOpeningFormData): Promise<boolean> {
  try {
    await applyVaultOpeningToMessage0(formData);
    console.info('[vaultGameInitializer] initializeGameVariables OK');
    return true;
  } catch (e) {
    console.error('[vaultGameInitializer] initializeGameVariables failed', e);
    return false;
  }
}

async function getLayer0DataForAssistantMessage(): Promise<Record<string, unknown> | undefined> {
  try {
    if (typeof Mvu !== 'undefined' && typeof Mvu.getMvuData === 'function') {
      const d = Mvu.getMvuData({ type: 'message', message_id: 0 });
      return klona(d) as unknown as Record<string, unknown>;
    }
  } catch (e) {
    console.warn('[vaultGameInitializer] getMvuData(0) for assistant.data failed', e);
  }
  try {
    if (typeof getVariables === 'function') {
      return klona(getVariables({ type: 'message', message_id: 0 })) as Record<string, unknown>;
    }
  } catch (e) {
    console.warn('[vaultGameInitializer] getVariables(0) failed', e);
  }
  return undefined;
}

function buildOpeningAssistantBody(draft: VaultOpeningFormData): string {
  const sumLine = `开局档案已确认：时间线「${draft.timelineNode}」；灾难轮廓已写入世界环境层。`;
  return [
    '<maintext>',
    'VAULT-OS：避难所主系统在线。',
    '',
    '监督者已完成开局档案编纂：灾难本质与时间线节点已同步至「世界环境层」。',
    '后续回合将按 stat_data 与叙事继续展开；你可从下方选项继续，或使用主界面输入框推进剧情。',
    '</maintext>',
    '',
    '<option>',
    '继续',
    '</option>',
    '',
    `<sum>${sumLine}</sum>`,
  ].join('\n');
}

async function updateChronicleWithRetry(assistantId: number, retries = 3): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise(r => setTimeout(r, 400 * (i + 1)));
      await syncChronicleOnAssistantMessage(assistantId);
      console.info('[vaultGameInitializer] chronicle sync OK', assistantId);
      return;
    } catch (e) {
      console.warn(`[vaultGameInitializer] chronicle retry ${i + 1}/${retries}`, e);
    }
  }
}

/**
 * 创建 **1 层** assistant 开局介绍（若 1 楼已存在则跳过）。
 * 使用 `createChatMessages(..., { refresh: 'none' })`，由 Vault 事件/界面自行刷新。
 */
export async function createOpeningStoryMessage(formData: VaultOpeningFormData): Promise<boolean> {
  if (isCreatingOpening) {
    console.info('[vaultGameInitializer] createOpeningStoryMessage skipped (already running)');
    return false;
  }
  if (typeof getChatMessages !== 'function' || typeof createChatMessages !== 'function') {
    console.error('[vaultGameInitializer] getChatMessages / createChatMessages unavailable');
    return false;
  }

  try {
    const existing = getChatMessages(1);
    if (existing && existing.length > 0) {
      console.info('[vaultGameInitializer] floor 1 exists, skip opening assistant');
      void updateChronicleWithRetry(existing[0].message_id);
      return true;
    }
  } catch {
    /* 1 层不存在，继续创建 */
  }

  isCreatingOpening = true;
  try {
    const message = buildOpeningAssistantBody(formData);
    const data = await getLayer0DataForAssistantMessage();

    await createChatMessages(
      [
        {
          role: 'assistant',
          message,
          ...(data ? { data } : {}),
        },
      ],
      { refresh: 'none', insert_before: 'end' },
    );

    let assistantId: number | null = null;
    if (typeof getLastMessageId === 'function') {
      assistantId = getLastMessageId();
    }
    console.info('[vaultGameInitializer] opening assistant created', assistantId);

    if (assistantId != null && assistantId >= 0) {
      void updateChronicleWithRetry(assistantId);
    }

    return true;
  } catch (e) {
    console.error('[vaultGameInitializer] createOpeningStoryMessage failed', e);
    return false;
  } finally {
    isCreatingOpening = false;
  }
}

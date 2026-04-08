/**
 * 同层交互核心流程（不经酒馆原生发送框）：
 *
 * ① 构建提示词（选项或输入框文本）
 * ② createChatMessages(user, { data: mvu_data }, { refresh: 'none' }) — 静默 user 层
 * ③ generate({ user_input, should_stream: true, should_silence: true }) — 可监听流式 token
 * ④ 过滤 &lt;thinking&gt; / &lt;redacted_thinking&gt;，提取 &lt;maintext&gt;、&lt;option&gt;、&lt;sum&gt;、&lt;UpdateVariable&gt;
 * ⑤ Mvu.parseMessage(message, baseData) — 变量更新
 * ⑥ createChatMessages(assistant, { data: parsed }, { refresh: 'none' }) — 静默 assistant 层；可选 replaceMvuData(latest)
 * ⑦ 由界面回调显式刷新（因 refresh:none 不会触发 MESSAGE_RECEIVED，须手动 refresh MVU / 叙事区）
 *
 * 错误回退：generate 失败或格式不合规 → deleteChatMessages(user)（refresh:none），恢复发送前等价状态。
 */
import { ensureMvuData, getGameMvuData } from '../utils/variableReader';
import { shouldBurnApFromAssistantMessage } from './apBurnCheckContext';
import { applyApBurnToMvuClone } from './apBurnMvu';
import { computeApBurnRatioOfApMax, computeBattleGaugeIntensity } from './apBurnFromBattleGauge';
import { extractKnownBattleProtocolBlockAfterStructuredTags } from './battleProtocolParser';
import { mitigateApPlummetAfterParse } from './mitigateApPlummetAfterParse';
import { getLatestAssistantFullMessage } from './latestAssistantMessage';
import { SHERLOCK_ENTRY_COT, SHERLOCK_ENTRY_OPENING_COT, SHERLOCK_WORLDBOOK_NAME } from './sherlockConfig';
import {
  extractLastMaintext,
  extractLastOption,
  extractLastSum,
  extractLastUpdateVariable,
  removeThinkingTags,
  removeThinkingTagsFromStream,
  validateAssistantOutput,
} from './sherlockGenerateHelpers';

export type SherlockRequestType = 'option' | 'custom';

export interface SherlockRequestData {
  type: SherlockRequestType;
  content: string;
}

export type SherlockRequestCallbacks = {
  onDisableOptions?: () => void;
  onShowGenerating?: () => void;
  onHideGenerating?: () => void;
  onEnableOptions?: () => void;
  onError?: (error: string) => void;
  onRefreshStory?: () => void;
  onStreamingUpdate?: (text: string) => void;
};

async function getBaseMvuData(): Promise<Mvu.MvuData> {
  try {
    return await getGameMvuData();
  } catch (error) {
    console.warn('[Sherlock] getBaseMvuData fallback:', error);
    return ensureMvuData({});
  }
}

function buildPrompt(request: SherlockRequestData): string {
  if (typeof request.content !== 'string' || !request.content.trim()) {
    return '';
  }
  return request.content.trim();
}

/**
 * 在已有 user 楼层（userMessageId）前提下，仅执行 generate → assistant 写入（用于新建回复与重 roll）
 */
async function runSherlockGenerationPipeline(
  prompt: string,
  userMessageId: number,
  callbacks: SherlockRequestCallbacks,
  deleteUserMessageOnFailure: boolean,
): Promise<boolean> {
  let streamListener: EventOnReturn | null = null;
  if (typeof eventOn !== 'undefined' && iframe_events?.STREAM_TOKEN_RECEIVED_FULLY) {
    const streamingHandler = (fullText: string) => {
      const cleanedText = removeThinkingTagsFromStream(fullText);
      if (!cleanedText?.trim()) {
        callbacks.onStreamingUpdate?.('');
        return;
      }
      const maintextMatch = cleanedText.match(/<maintext>([\s\S]*?)(?:<\/maintext>|$)/i);
      if (maintextMatch?.[1]) {
        callbacks.onStreamingUpdate?.(maintextMatch[1].trim());
      } else {
        callbacks.onStreamingUpdate?.(cleanedText);
      }
    };
    streamListener = eventOn(iframe_events.STREAM_TOKEN_RECEIVED_FULLY, streamingHandler);
  }

  let result: string;
  try {
    result = await generate({
      user_input: prompt,
      should_stream: true,
      /** 不经输入框发送，避免与酒馆停止按钮/UI 双重绑定 */
      should_silence: true,
    });
  } finally {
    streamListener?.stop();
  }

  const cleanedResult = removeThinkingTags(result);

  if (!cleanedResult || !validateAssistantOutput(cleanedResult)) {
    if (deleteUserMessageOnFailure) {
      try {
        await deleteChatMessages([userMessageId], { refresh: 'none' });
      } catch {
        /* ignore */
      }
    }
    callbacks.onHideGenerating?.();
    callbacks.onEnableOptions?.();
    callbacks.onError?.('承卷回函不合制式（须含完整、非空的叙事正文标签），本次递状已撤回。');
    return false;
  }

  const maintext = extractLastMaintext(cleanedResult);
  const option = extractLastOption(cleanedResult);
  const sum = extractLastSum(cleanedResult);
  const updateVariable = extractLastUpdateVariable(cleanedResult);

  if (!maintext?.trim()) {
    if (deleteUserMessageOnFailure) {
      try {
        await deleteChatMessages([userMessageId], { refresh: 'none' });
      } catch {
        /* ignore */
      }
    }
    callbacks.onHideGenerating?.();
    callbacks.onEnableOptions?.();
    callbacks.onError?.('未能从回函中析出叙事正文，本次递状已撤回。');
    return false;
  }

  let finalMessage = `<maintext>${maintext}</maintext>`;
  if (option?.trim()) {
    finalMessage += `\n\n<option>${option}</option>`;
  }
  if (sum) {
    finalMessage += `\n\n<sum>${sum}</sum>`;
  }
  if (updateVariable) {
    finalMessage += `\n\n<UpdateVariable>${updateVariable}</UpdateVariable>`;
  }

  /** 模型常把 [ROLL]/[ENCOUNTER] 放在 UpdateVariable 之后；重组 XML 时必须从原文带回，否则博弈面板永远缺协议 */
  const battleProtocolBlock = extractKnownBattleProtocolBlockAfterStructuredTags(cleanedResult);
  if (battleProtocolBlock) {
    finalMessage += `\n\n${battleProtocolBlock}`;
  }

  await waitGlobalInitialized('Mvu');

  let base: Record<string, unknown> | undefined;
  const userMessage = getChatMessages(userMessageId)?.[0];
  if (userMessage?.data) {
    base = userMessage.data as Record<string, unknown>;
  }
  if (!base) {
    const fallback =
      getChatMessages(-1, { role: 'assistant' })?.[0]?.data ??
      Mvu.getMvuData({ type: 'message', message_id: 'latest' });
    base = fallback as Record<string, unknown>;
  }
  const baseMvu = ensureMvuData(base);

  const parsed = await Mvu.parseMessage(finalMessage, baseMvu);
  const merged = ensureMvuData((parsed ?? baseMvu) as unknown as Record<string, unknown>);
  const finalData = mitigateApPlummetAfterParse(baseMvu, merged);

  await createChatMessages(
    [
      {
        role: 'assistant',
        message: finalMessage,
        data: finalData as unknown as Record<string, unknown>,
      },
    ],
    { refresh: 'none' },
  );

  try {
    await Mvu.replaceMvuData(finalData, { type: 'message', message_id: 'latest' });
  } catch (e) {
    console.warn('[Sherlock] replaceMvuData（可忽略）:', e);
  }

  const { checkAndUpdateChronicleSherlock } = await import('./chronicleSherlock');
  await checkAndUpdateChronicleSherlock();

  callbacks.onHideGenerating?.();
  callbacks.onEnableOptions?.();

  setTimeout(() => {
    callbacks.onRefreshStory?.();
  }, 300);

  return true;
}

export async function handleSherlockRequest(
  request: SherlockRequestData,
  callbacks: SherlockRequestCallbacks,
): Promise<boolean> {
  let userMessageId: number | null = null;

  try {
    callbacks.onDisableOptions?.();
    callbacks.onShowGenerating?.();

    const prompt = buildPrompt(request);
    if (!prompt) {
      throw new Error('递状不得为空');
    }

    await maybeToggleOpeningCotEntries();

    let mvu_data = await getBaseMvuData();
    const gaugeSource = getLatestAssistantFullMessage();
    const burnRatio = shouldBurnApFromAssistantMessage(gaugeSource)
      ? computeApBurnRatioOfApMax(computeBattleGaugeIntensity(gaugeSource))
      : 0;
    mvu_data = applyApBurnToMvuClone(mvu_data, burnRatio);

    await createChatMessages(
      [
        {
          role: 'user',
          message: prompt,
          data: mvu_data as unknown as Record<string, unknown>,
        },
      ],
      { refresh: 'none' },
    );

    userMessageId = getLastMessageId();
    console.info('[Sherlock] user 消息 ID:', userMessageId);

    // 静默 user 层通常不触发 MESSAGE_RECEIVED；须立刻刷新 HUD / 叙事缓存，否则「行动余地」仍读上一纸 assistant
    const bumpUi = () => callbacks.onRefreshStory?.();
    bumpUi();
    queueMicrotask(bumpUi);

    return await runSherlockGenerationPipeline(prompt, userMessageId, callbacks, true);
  } catch (error) {
    console.error('[Sherlock] handleSherlockRequest:', error);
    if (userMessageId !== null) {
      try {
        await deleteChatMessages([userMessageId], { refresh: 'none' });
      } catch {
        /* ignore */
      }
    }
    callbacks.onHideGenerating?.();
    callbacks.onEnableOptions?.();
    callbacks.onError?.(error instanceof Error ? error.message : '叙事未能接续，请稍后再试。');
    return false;
  }
}

/**
 * 重 roll：删除指定 assistant 楼层后，用同一 user 文本重新走生成管线（不新建 user 楼层）
 */
export async function handleSherlockReroll(
  params: { assistantMessageId: number; userMessageId: number },
  callbacks: SherlockRequestCallbacks,
): Promise<boolean> {
  const { assistantMessageId, userMessageId } = params;

  try {
    callbacks.onDisableOptions?.();
    callbacks.onShowGenerating?.();

    const userMsgs = getChatMessages(userMessageId, { role: 'user' });
    if (!userMsgs?.length) {
      throw new Error('找不到与重撰相对应的递状楼层');
    }
    const userText = (userMsgs[0].message || '').trim();
    if (!userText) {
      throw new Error('递状原稿为空，无法重撰');
    }

    await deleteChatMessages([assistantMessageId], { refresh: 'none' });
    await maybeToggleOpeningCotEntries();

    return await runSherlockGenerationPipeline(userText, userMessageId, callbacks, false);
  } catch (error) {
    console.error('[Sherlock] handleSherlockReroll:', error);
    callbacks.onHideGenerating?.();
    callbacks.onEnableOptions?.();
    callbacks.onError?.(error instanceof Error ? error.message : '重撰未能完成，请稍后再试。');
    return false;
  }
}

function findWorldbookEntryByLabel(
  entries: Array<{ name: string; uid: number; enabled: boolean; comment?: string }>,
  label: string,
) {
  return entries.find(e => e.name === label || e.comment === label);
}

async function maybeToggleOpeningCotEntries(): Promise<void> {
  const name = SHERLOCK_WORLDBOOK_NAME.trim();
  if (!name) {
    return;
  }
  try {
    const currentMessageId = getLastMessageId();
    const isOpeningPhase = currentMessageId >= 0 && currentMessageId <= 1;
    const worldbookEntries = await getWorldbook(name);
    const openingCotEntry = findWorldbookEntryByLabel(worldbookEntries, SHERLOCK_ENTRY_OPENING_COT);
    const cotEntry = findWorldbookEntryByLabel(worldbookEntries, SHERLOCK_ENTRY_COT);
    const updates: Array<{ uid: number; enabled: boolean }> = [];

    if (isOpeningPhase) {
      if (openingCotEntry && !openingCotEntry.enabled) {
        updates.push({ uid: openingCotEntry.uid, enabled: true });
      }
      if (cotEntry?.enabled) {
        updates.push({ uid: cotEntry.uid, enabled: false });
      }
    } else {
      if (openingCotEntry?.enabled) {
        updates.push({ uid: openingCotEntry.uid, enabled: false });
      }
      if (cotEntry && !cotEntry.enabled) {
        updates.push({ uid: cotEntry.uid, enabled: true });
      }
    }

    if (updates.length > 0) {
      await updateWorldbookWith(name, worldbook => {
        return worldbook.map(entry => {
          const update = updates.find(u => u.uid === entry.uid);
          return update ? { ...entry, enabled: update.enabled } : entry;
        });
      });
    }
  } catch (error) {
    console.warn('[Sherlock] 世界书 COT 切换失败（可忽略）:', error);
  }
}

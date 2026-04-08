/**
 * Vault「伪原生输入」回合管线：不走酒馆输入框 /send、/trigger，避免整页聊天反复 refresh；
 * 全程用 `createChatMessages` / `setChatMessages` 的 `refresh: 'none'` + `generate` + 自定义事件刷新 iframe UI。
 *
 * 与玩家点击发送的对应关系（游戏内交互）：
 * ① 构建提示词：系统注入 `buildSystemInject(statSnapshot)` + 用户句 `displayUserText`（选项等同理）。
 * ② `createChatMessages(user, { data: 伪0层合并MVU }, { refresh: 'none' })` — 仿制 user 楼层，不触发生成、不刷新主界面。
 * ③ `generate({ should_silence, should_stream?, injects })` — 静默请求 LLM。
 * ④ 得到全文后 `stripReasoningBlocks`，校验 `<maintext>`；流式时另见 `STREAM_TOKEN_RECEIVED_FULLY`。
 * ⑤ `Mvu.parseMessage(body, old_data)` — 解析变量命令得到 `finalMvu`。
 * ⑥ `setChatMessages` 或 `createChatMessages(assistant, …, { refresh: 'none' })` — 写入 assistant；随后 `Mvu.replaceMvuData`。
 * ⑦ `eventEmit(VAULT_OS_TURN_COMMITTED)` — `VaultApp` 监听后 `reloadAndRenderChatWithoutEvents` + `syncMaintextFromChat` 等，只刷新需要区域。
 *
 * **伪0层**：`message_id: 0`（酒馆开局/嵌入卡楼层）的 MVU 与 `latest` 深合并，`latest` 覆盖同键，作本回合 `user.data` 与 parse 的 `old_data`。
 *
 * 更细对照见 `src/vault/LLM交互流程-对照指南.md`。
 */

import { klona } from 'klona';
import { merge } from 'lodash';

import {
  extractLastMaintextBlock,
  parseMaintext,
  parseSum,
  removeThinkingTagsFromStream,
  stripReasoningBlocks,
} from './messageParser';
import { getLatestAssistantStatData } from './statData';
import { getVaultVariableWorldbookSnippets } from './vaultWorldbook';

/** 与 VaultApp 约定：回合已写入聊天（assistant 楼层已落库），可安全刷新 UI */
export const VAULT_OS_TURN_COMMITTED = 'vault_os_turn_committed';

/** 流式生成时从 &lt;maintext&gt; 内文推送预览（空字符串由界面在回合结束时自行清空） */
export const VAULT_OS_STREAM_MAINTEXT = 'vault_os_stream_maintext';

export type VaultTurnMode = 'single_api' | 'dual_api';

export type DualApiRuntimeConfig = {
  apiurl: string;
  key: string;
  model: string;
  maxRetries: number;
  secondApiExtraTasks: string;
  /** 已解析的世界书名 */
  worldbookName: string;
};

type GenerateInject = {
  role: 'system' | 'assistant' | 'user';
  content: string;
  position: 'in_chat' | 'none';
  depth: number;
  should_scan?: boolean;
};

function buildSystemInject(statSnapshot: string): string {
  return [
    '你是一个末世避难所的 AI 管家，代号 VAULT-OS。',
    '语气：冷静、高效、偶尔黑色幽默；必须使用中文；不要使用表情符号；回答尽量简短。',
    `当前 MVU stat_data（截断）：${statSnapshot}`,
    '回复中请使用与角色卡约定的标签，例如 <maintext>、<option>、<sum> 等。',
  ].join('\n');
}

/**
 * 回合开始前 MVU 快照：伪0层（`message_id: 0`）与 `latest` 深合并，`latest` 优先。
 * 实现《前端项目改造指南》里「从0层读取并合并变量」再写入 user 楼层 `data` 的意图。
 */
async function getBaseMvuDataForUserTurn(): Promise<Mvu.MvuData | null> {
  try {
    if (typeof waitGlobalInitialized === 'function') {
      await waitGlobalInitialized('Mvu');
    }
  } catch {
    /* 无 Mvu 脚本时继续 */
  }
  if (typeof Mvu === 'undefined' || typeof Mvu.getMvuData !== 'function') {
    return null;
  }

  let layer0: Mvu.MvuData | null = null;
  let latest: Mvu.MvuData | null = null;
  try {
    layer0 = klona(Mvu.getMvuData({ type: 'message', message_id: 0 }));
  } catch (e) {
    console.warn('[vaultTurnPipeline] getMvuData(0) failed', e);
  }
  try {
    latest = klona(Mvu.getMvuData({ type: 'message', message_id: 'latest' }));
  } catch (e) {
    console.warn('[vaultTurnPipeline] getMvuData(latest) failed', e);
  }

  if (!layer0 && !latest) return null;
  return merge({}, layer0 ?? {}, latest ?? {}) as Mvu.MvuData;
}

function buildSecondApiPrompt(parts: {
  maintextInner: string;
  变量更新规则: string;
  变量列表: string;
  变量输出格式: string;
  statJson: string;
  extraTasks: string;
}): string {
  const lines = [
    '【系统角色】你是变量与状态更新执行器。只根据下列材料输出「变量更新」相关片段，严格遵循「变量输出格式」。不要输出 <maintext> 剧情正文，不要复述用户可见故事，不要闲聊。',
    '',
    '【当前回合正文（maintext 内文）】',
    parts.maintextInner || '（空）',
    '',
    '【变量更新规则】',
    parts.变量更新规则 || '（世界书条目为空）',
    '',
    '【变量列表】',
    parts.变量列表 || '（世界书条目为空）',
    '',
    '【变量输出格式】',
    parts.变量输出格式 || '（世界书条目为空）',
    '',
    '【当前 stat_data（JSON，更新前）】',
    parts.statJson,
    '',
  ];
  if (parts.extraTasks.trim()) {
    lines.push('【其他需兼顾的任务说明】', parts.extraTasks.trim(), '');
  }
  lines.push(
    '【你的任务】仅输出符合上述「变量输出格式」的内容（例如要求的 XML/标签块）。若本轮无变量变化，也需按格式给出空或说明。',
  );
  return lines.join('\n');
}

async function generateRawWithRetries(
  prompt: string,
  cfg: { apiurl: string; key: string; model: string },
  maxRetries: number,
): Promise<string> {
  if (typeof generateRaw !== 'function') {
    throw new Error('generateRaw 不可用');
  }
  const attempts = Math.max(0, maxRetries);
  let lastErr: unknown;
  for (let i = 0; i <= attempts; i++) {
    try {
      const out = await generateRaw({
        should_silence: true,
        ordered_prompts: [{ role: 'user', content: prompt }],
        custom_api: {
          apiurl: cfg.apiurl.trim(),
          key: cfg.key,
          model: cfg.model.trim(),
          source: 'openai',
        },
      });
      return String(out ?? '').trim();
    } catch (e) {
      lastErr = e;
      console.warn('[vaultTurnPipeline] second API attempt failed', i, e);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function validateAssistantBody(raw: string): boolean {
  return parseMaintext(raw).trim().length > 0;
}

/**
 * @returns 本轮 assistant 楼层 message_id
 */
export async function runVaultTurn(params: {
  displayUserText: string;
  statSnapshot: string;
  /** 与指南一致：为 true 时在 generate 前注册 STREAM_TOKEN_RECEIVED_FULLY，并传 should_stream */
  shouldStream?: boolean;
  mode?: VaultTurnMode;
  dual?: DualApiRuntimeConfig | null;
}): Promise<number> {
  const { displayUserText, statSnapshot, shouldStream = false, mode = 'single_api', dual } = params;

  if (typeof createChatMessages !== 'function') {
    throw new Error('createChatMessages 不可用');
  }
  if (typeof generate !== 'function') {
    throw new Error('generate 不可用');
  }
  if (typeof getLastMessageId !== 'function' || typeof getChatMessages !== 'function') {
    throw new Error('getLastMessageId / getChatMessages 不可用');
  }

  const systemInject = buildSystemInject(statSnapshot);
  const injects: GenerateInject[] = [
    {
      role: 'system',
      content: systemInject,
      position: 'in_chat',
      depth: 0,
      should_scan: false,
    },
  ];

  const mvuBefore = await getBaseMvuDataForUserTurn();

  let userMessageId: number | null = null;
  /** assistant 已成功写入（含 setChatMessages），失败时不再删 user，避免破坏已生成楼层 */
  let assistantCommitted = false;

  const rollbackUser = async () => {
    if (userMessageId === null || typeof deleteChatMessages !== 'function') return;
    try {
      await deleteChatMessages([userMessageId], { refresh: 'none' });
    } catch (e) {
      console.warn('[vaultTurnPipeline] rollback user message failed', e);
    }
    userMessageId = null;
  };

  try {
    /** ② user 楼层，refresh:none — 仿制输入框发送，不触发酒馆整页刷新 */
    await createChatMessages(
      [
        {
          role: 'user',
          message: displayUserText,
          ...(mvuBefore ? { data: mvuBefore as unknown as Record<string, unknown> } : {}),
        },
      ],
      {
        refresh: 'none',
        insert_before: 'end',
      },
    );

    userMessageId = getLastMessageId();

    /** 写入 user 后、尚未落库本楼 assistant 前，stat_data 仍对应上一楼 assistant */
    const statBeforeJson = JSON.stringify(getLatestAssistantStatData().statData ?? {});

    /** ③④ 流式：generate 前注册；③ generate 本体 */
    let streamSub: { stop: () => void } | null = null;
    if (shouldStream && typeof eventOn === 'function') {
      streamSub = eventOn(iframe_events.STREAM_TOKEN_RECEIVED_FULLY, (fullText: string) => {
        const cleaned = removeThinkingTagsFromStream(fullText);
        const m = cleaned.match(/<maintext>([\s\S]*?)(?:<\/maintext>|$)/i);
        const preview = (m?.[1] ?? '').trim();
        if (typeof eventEmit === 'function') {
          void eventEmit(VAULT_OS_STREAM_MAINTEXT, preview);
        }
      });
    }

    let aiText: string;
    try {
      aiText = await generate({
        user_input: displayUserText,
        should_silence: true,
        should_stream: shouldStream,
        injects,
      });
    } finally {
      streamSub?.stop();
    }

    let body = stripReasoningBlocks(String(aiText ?? '')).trim();

    /** ④ 校验标签化正文（Vault 要求至少可解析出 <maintext>） */
    if (!validateAssistantBody(body)) {
      throw new Error('生成结果不符合规范：未解析到有效的 <maintext>');
    }

    void parseSum(body);

    if (mode === 'dual_api') {
      if (!dual) {
        throw new Error('双 API 模式需要第二 API 与世界书配置');
      }
      const wb = dual.worldbookName.trim();
      if (!wb) {
        throw new Error('双 API 模式需要有效的世界书名（请在设置中指定或绑定角色世界书）');
      }
      if (!dual.apiurl.trim() || !dual.model.trim()) {
        throw new Error('双 API 模式需要填写第二 API 的 URL 与模型');
      }

      const block = extractLastMaintextBlock(body);
      if (!block) {
        console.warn('[vaultTurnPipeline] 主 API 未产出闭合的 <maintext>，跳过第二 API');
      } else {
        const snippets = await getVaultVariableWorldbookSnippets(wb);
        const secondPrompt = buildSecondApiPrompt({
          maintextInner: block.inner,
          变量更新规则: snippets.变量更新规则,
          变量列表: snippets.变量列表,
          变量输出格式: snippets.变量输出格式,
          statJson: statBeforeJson,
          extraTasks: dual.secondApiExtraTasks ?? '',
        });

        const varPart = await generateRawWithRetries(
          secondPrompt,
          {
            apiurl: dual.apiurl,
            key: dual.key,
            model: dual.model,
          },
          dual.maxRetries,
        );

        if (varPart) {
          body = `${body.trimEnd()}\n\n${varPart}`;
        }
      }
    }

    /** ⑤ Mvu.parseMessage — 变量命令 → 本楼将写入的 MVU */
    let finalMvu: Mvu.MvuData | null = mvuBefore ? klona(mvuBefore) : null;
    if (typeof Mvu !== 'undefined' && typeof Mvu.parseMessage === 'function' && mvuBefore) {
      try {
        const parsed = await Mvu.parseMessage(body, klona(mvuBefore));
        if (parsed) {
          finalMvu = parsed;
        }
      } catch (e) {
        console.warn('[vaultTurnPipeline] Mvu.parseMessage', e);
      }
    }

    /** ⑥ assistant 楼层，refresh:none；若 generate 已占位则 setChatMessages */
    const last = getChatMessages(-1)[0];
    let assistantId: number;

    if (last.role === 'assistant') {
      assistantId = last.message_id;
      if (typeof setChatMessages !== 'function') {
        throw new Error('setChatMessages 不可用');
      }
      await setChatMessages(
        [
          {
            message_id: assistantId,
            message: body,
            ...(finalMvu ? { data: finalMvu as unknown as Record<string, unknown> } : {}),
          },
        ],
        { refresh: 'none' },
      );
    } else {
      await createChatMessages(
        [
          {
            role: 'assistant',
            message: body,
            ...(finalMvu ? { data: finalMvu as unknown as Record<string, unknown> } : {}),
          },
        ],
        {
          refresh: 'none',
          insert_before: 'end',
        },
      );
      assistantId = getLastMessageId();
    }

    assistantCommitted = true;

    /** 指南：将更新后的变量写回楼层 */
    if (typeof Mvu !== 'undefined' && typeof Mvu.replaceMvuData === 'function' && finalMvu) {
      try {
        await Mvu.replaceMvuData(finalMvu, { type: 'message', message_id: assistantId });
      } catch (e) {
        console.warn('[vaultTurnPipeline] Mvu.replaceMvuData', e);
      }
    }

    /** ⑦ 通知前端：可安全刷新 Vault 与编年史（不依赖酒馆默认楼层 refresh） */
    if (typeof eventEmit === 'function') {
      await eventEmit(VAULT_OS_TURN_COMMITTED, assistantId);
    }

    return assistantId;
  } catch (e) {
    if (!assistantCommitted) {
      await rollbackUser();
    }
    throw e;
  }
}

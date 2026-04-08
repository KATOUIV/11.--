/**
 * 消息解析工具：从 assistant 消息中解析 &lt;maintext&gt;、&lt;option&gt;、&lt;sum&gt; 等标签（供 Vault 等界面使用）
 *
 * 与「手工创建楼层 + generate + createChatMessages(assistant) + 事件刷新」流程配合：
 * 界面侧通过 {@link loadFromLatestMessage} 读取**最新一条 assistant 楼层**的正文与选项。
 */

/** 与文档中的 Option 名称兼容 */
export type Option = OptionItem;

export interface OptionItem {
  id: string;
  text: string;
}

/** 界面展示用：最多解析的选项条数 */
export const PARSE_OPTIONS_MAX = 4;

/**
 * 去掉 thinking / 推理块，避免误匹配块内的 &lt;maintext&gt;
 */
export function stripReasoningBlocks(content: string): string {
  let cleaned = content;
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '');
  const thinkingUnclosed = cleaned.search(/<thinking>/i);
  if (thinkingUnclosed !== -1) cleaned = cleaned.substring(0, thinkingUnclosed);
  const thinkUnclosed = cleaned.search(/<think>/i);
  if (thinkUnclosed !== -1) cleaned = cleaned.substring(0, thinkUnclosed);
  return cleaned;
}

/**
 * 与《前端项目改造指南》中 `removeThinkingTagsFromStream` 一致：在流式回调的累计全文上移除推理块，
 * 再对正文做 `<maintext>…` 的未闭合匹配。
 */
export function removeThinkingTagsFromStream(content: string): string {
  return stripReasoningBlocks(content);
}

/**
 * 解析消息中的正文（取最后一个 &lt;maintext&gt;，且不在 thinking/推理块内）
 */
export function parseMaintext(messageContent: string): string {
  if (!messageContent) return '';

  const cleaned = stripReasoningBlocks(messageContent);
  const matches = cleaned.match(/<maintext>([\s\S]*?)<\/maintext>/gi);
  if (!matches || matches.length === 0) return '';

  const lastMatch = matches[matches.length - 1];
  const content = lastMatch.match(/<maintext>([\s\S]*?)<\/maintext>/i);
  return content ? content[1].trim() : '';
}

/**
 * 取最后一个闭合的 &lt;maintext&gt;…&lt;/maintext&gt; 整段与内文（用于双 API：第二路提示词）
 */
export function extractLastMaintextBlock(messageContent: string): { fullBlock: string; inner: string } | null {
  if (!messageContent) return null;
  const cleaned = stripReasoningBlocks(messageContent);
  const re = /<maintext>([\s\S]*?)<\/maintext>/gi;
  const all = [...cleaned.matchAll(re)];
  if (all.length === 0) return null;
  const last = all[all.length - 1];
  const inner = last[1] != null ? String(last[1]).trim() : '';
  return { fullBlock: last[0], inner };
}

/**
 * 解析消息中的选项
 * - 带 id 的 `&lt;option id="…"&gt;`：每项一条，最多 {@link PARSE_OPTIONS_MAX} 条
 * - 纯 `&lt;option&gt;…&lt;/option&gt;`：取**最后一个**块内文本，支持 A. B. C. 多行续行
 */
export function parseOptions(messageContent: string): OptionItem[] {
  if (!messageContent) return [];

  const cleaned = stripReasoningBlocks(messageContent);

  const optionWithIdRegex = /<option id="([^"]+)">([^<]+)<\/option>/g;
  const optionsWithId: OptionItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = optionWithIdRegex.exec(cleaned)) !== null) {
    optionsWithId.push({
      id: match[1],
      text: match[2].trim(),
    });
  }

  if (optionsWithId.length > 0) {
    return optionsWithId.slice(0, PARSE_OPTIONS_MAX);
  }

  const blocks = [...cleaned.matchAll(/<option>([\s\S]*?)<\/option>/gi)];
  if (blocks.length === 0) {
    return [];
  }

  const optionText = blocks[blocks.length - 1][1].trim();
  const lines = optionText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  const optionPattern = /^[A-Z]\.\s*/;
  const hasLetterPrefix = lines.some(line => optionPattern.test(line));

  if (hasLetterPrefix) {
    const options: OptionItem[] = [];
    let currentOption: string[] = [];

    for (const line of lines) {
      if (optionPattern.test(line)) {
        if (currentOption.length > 0) {
          const text = currentOption.join('\n');
          const id = text.match(/^([A-Z])\./)?.[1] ?? String.fromCharCode(65 + options.length);
          options.push({
            id,
            text: text.replace(/^[A-Z]\.\s*/, '').trim(),
          });
        }
        currentOption = [line];
      } else if (currentOption.length > 0) {
        currentOption.push(line);
      }
    }

    if (currentOption.length > 0) {
      const text = currentOption.join('\n');
      const id = text.match(/^([A-Z])\./)?.[1] ?? String.fromCharCode(65 + options.length);
      options.push({
        id,
        text: text.replace(/^[A-Z]\.\s*/, '').trim(),
      });
    }

    return options.slice(0, PARSE_OPTIONS_MAX);
  }

  const out: OptionItem[] = [];
  for (let i = 0; i < lines.length && out.length < PARSE_OPTIONS_MAX; i++) {
    const raw = lines[i];
    const text = raw.replace(/^[A-Da-d0-4][.)、:：]\s*/, '').trim() || raw;
    out.push({
      id: String.fromCharCode(65 + out.length),
      text,
    });
  }

  return out;
}

/**
 * 解析消息中的 &lt;sum&gt;（取最后一个块，且不在 thinking/推理块内）
 */
export function parseSum(messageContent: string): string {
  if (!messageContent) return '';

  const cleaned = stripReasoningBlocks(messageContent);
  const matches = cleaned.match(/<sum>([\s\S]*?)<\/sum>/gi);
  if (!matches || matches.length === 0) return '';

  const lastMatch = matches[matches.length - 1];
  const content = lastMatch.match(/<sum>([\s\S]*?)<\/sum>/i);
  return content ? content[1].trim() : '';
}

/**
 * 将**最后一个** &lt;maintext&gt;…&lt;/maintext&gt; 块替换为新内文；若无匹配则在文末追加一块。
 */
export function replaceLastMaintext(fullMessage: string, newInner: string): string {
  if (!fullMessage) {
    return `<maintext>${newInner}</maintext>`;
  }
  const re = /<maintext>([\s\S]*?)<\/maintext>/gi;
  const all = [...fullMessage.matchAll(re)];
  if (all.length === 0) {
    return `${fullMessage.trimEnd()}\n<maintext>${newInner}</maintext>`;
  }
  const last = all[all.length - 1];
  const start = last.index ?? 0;
  const end = start + last[0].length;
  return fullMessage.slice(0, start) + `<maintext>${newInner}</maintext>` + fullMessage.slice(end);
}

/** 所有 assistant 楼层及其 &lt;maintext&gt;（按楼层号升序） */
export function getAssistantFloorsMaintext(): { messageId: number; maintext: string }[] {
  try {
    if (typeof getLastMessageId !== 'function' || typeof getChatMessages !== 'function') {
      return [];
    }
    const last = getLastMessageId();
    if (last < 0) return [];
    const msgs = getChatMessages(`0-${last}`, { role: 'assistant' });
    return msgs.map(m => ({
      messageId: m.message_id,
      maintext: parseMaintext(m.message ?? ''),
    }));
  } catch (e) {
    console.error('[messageParser] getAssistantFloorsMaintext', e);
    return [];
  }
}

/** 所有 assistant 楼层及其 &lt;sum&gt; 摘要（按楼层号升序） */
export function getAssistantFloorsSum(): { messageId: number; sum: string }[] {
  try {
    if (typeof getLastMessageId !== 'function' || typeof getChatMessages !== 'function') {
      return [];
    }
    const last = getLastMessageId();
    if (last < 0) return [];
    const msgs = getChatMessages(`0-${last}`, { role: 'assistant' });
    return msgs.map(m => ({
      messageId: m.message_id,
      sum: parseSum(m.message ?? ''),
    }));
  } catch (e) {
    console.error('[messageParser] getAssistantFloorsSum', e);
    return [];
  }
}

export function loadFromLatestMessage(): {
  maintext: string;
  options: OptionItem[];
  messageId?: number;
  userMessageId?: number;
  fullMessage?: string;
} {
  try {
    if (typeof getLastMessageId !== 'function' || typeof getChatMessages !== 'function') {
      return { maintext: '', options: [] };
    }

    const lastMessageId = getLastMessageId();
    if (lastMessageId < 0) {
      return { maintext: '', options: [] };
    }

    /** 优先：最新一条楼层若即为 assistant，则直接取该层（与 getChatMessages(-1) 语义一致） */
    let latestAssistant: { message: string; message_id: number } | null = null;
    try {
      const atNewest = getChatMessages(-1, { role: 'assistant' });
      if (atNewest.length > 0) {
        latestAssistant = { message: atNewest[0].message ?? '', message_id: atNewest[0].message_id };
      }
    } catch {
      /* ignore */
    }

    if (!latestAssistant) {
      const assistantMessages = getChatMessages(`0-${lastMessageId}`, { role: 'assistant' });
      if (!assistantMessages.length) {
        return { maintext: '', options: [] };
      }
      latestAssistant = assistantMessages[assistantMessages.length - 1];
    }

    const messageContent = latestAssistant.message ?? '';

    const maintext = parseMaintext(messageContent);
    const options = parseOptions(messageContent);

    let userMessageId: number | undefined;
    const mid = latestAssistant.message_id;
    if (mid > 0) {
      const userMessages = getChatMessages(mid - 1, { role: 'user' });
      if (userMessages.length > 0) {
        userMessageId = userMessages[0].message_id;
      }
    }

    return {
      maintext,
      options,
      messageId: latestAssistant.message_id,
      userMessageId,
      fullMessage: messageContent,
    };
  } catch (error) {
    console.error('[messageParser] loadFromLatestMessage failed', error);
    return { maintext: '', options: [] };
  }
}

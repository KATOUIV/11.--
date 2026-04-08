/**
 * 消息解析：从 assistant 楼层文本中解析 <maintext>、<option> 等标签。
 * 供主界面正文框、选项区与 storyTags 统一使用。
 */

/** 去掉各类「思考」块及未闭合片段，避免误匹配标签内的正文（含 &lt;thinking&gt; / &lt;redacted_thinking&gt;） */
export function stripThinkingBlocks(messageContent: string): string {
  if (!messageContent) return '';

  let cleaned = messageContent.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  cleaned = cleaned.replace(/<redacted_thinking>[\s\S]*?<\/redacted_thinking>/gi, '');
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '');

  const thinkingStart = cleaned.search(/<thinking>/i);
  if (thinkingStart !== -1) {
    cleaned = cleaned.substring(0, thinkingStart);
  }
  const redactedStart = cleaned.search(/<redacted_thinking>/i);
  if (redactedStart !== -1) {
    cleaned = cleaned.substring(0, redactedStart);
  }

  return cleaned;
}

/**
 * 正文：只取 **最后一个** &lt;maintext&gt;（与楼层内多次标签时「当前生效」一致）。
 * 先移除 thinking，再匹配，避免 thinking 内出现字样干扰。
 */
export function parseMaintext(messageContent: string): string {
  if (!messageContent) return '';

  const cleaned = stripThinkingBlocks(messageContent);
  const matches = cleaned.match(/<maintext>([\s\S]*?)<\/maintext>/gi);
  if (!matches?.length) return '';

  const lastMatch = matches[matches.length - 1];
  const content = lastMatch.match(/<maintext>([\s\S]*?)<\/maintext>/i);
  return content ? content[1].trim() : '';
}

export interface OptionItem {
  id: string;
  /** 递交模型用的纯文案（已去掉行首消耗标注） */
  text: string;
  /** 建议行动点消耗；未标注时首项 0、其后递增（保证总有一条 0 消耗缓推进） */
  apCost: number;
}

/** 主界面选项区最多展示条数 */
export const SHERLOCK_OPTION_MAX = 4;

/**
 * 行首消耗标注（可选）：`[2] 正文`、`【余力1】正文`、`（消耗0）正文`
 */
function stripLineApPrefix(line: string): { text: string; ap?: number } {
  const s = line.trim();
  const m0 = s.match(/^\[(\d+)\]\s+/);
  if (m0) return { text: s.slice(m0[0].length).trim(), ap: parseInt(m0[1], 10) };
  const m1 = s.match(/^【\s*余力\s*(\d+)\s*】\s*/);
  if (m1) return { text: s.slice(m1[0].length).trim(), ap: parseInt(m1[1], 10) };
  const m2 = s.match(/^（\s*消耗\s*(\d+)\s*）\s*/);
  if (m2) return { text: s.slice(m2[0].length).trim(), ap: parseInt(m2[1], 10) };
  return { text: s };
}

function parseOptionOpenAttributes(attrPart: string): { id?: string; ap?: number } {
  const idM = /\bid\s*=\s*"([^"]+)"/i.exec(attrPart);
  const apM = /\b(?:ap|cost)\s*=\s*"(\d+)"/i.exec(attrPart);
  return {
    id: idM?.[1],
    ap: apM ? parseInt(apM[1], 10) : undefined,
  };
}

/** 合并作者标注与默认顺位（首项 0）；若全部 &gt;0 则强制首项为 0 */
export function normalizeOptionApCosts(items: Array<{ id: string; text: string; ap?: number }>): OptionItem[] {
  const base = items.map((item, i) => {
    const has = item.ap !== undefined && Number.isFinite(item.ap) && item.ap >= 0;
    return {
      id: item.id,
      text: item.text,
      apCost: has ? Math.min(20, Math.floor(item.ap as number)) : i === 0 ? 0 : Math.min(i, 6),
    };
  });
  if (base.length > 0 && base.every(x => x.apCost > 0)) {
    base[0] = { ...base[0], apCost: 0 };
  }
  return base;
}

/**
 * 解析 &lt;option&gt;：
 * - 多个 &lt;option id="A" ap="2"&gt;（ap/cost 可选）
 * - 否则取第一个 &lt;option&gt;...&lt;/option&gt; 内文本，按行拆条；支持行首 [n] / 【余力n】等
 */
export function parseOptionsDetailed(messageContent: string): OptionItem[] {
  if (!messageContent) return [];

  const cleaned = stripThinkingBlocks(messageContent);

  const optionTagRegex = /<option\s+([^>]+)>([\s\S]*?)<\/option>/gi;
  const withId: Array<{ id: string; text: string; ap?: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = optionTagRegex.exec(cleaned)) !== null) {
    const attrs = parseOptionOpenAttributes(match[1]);
    if (!attrs.id) continue;
    const innerRaw = match[2].trim();
    const innerLines = innerRaw.split(/\r?\n/).map(l => l.trim());
    const headSt = stripLineApPrefix(innerLines[0] ?? '');
    const textBody = [headSt.text, ...innerLines.slice(1)].filter(Boolean).join('\n').trim();
    const ap = attrs.ap !== undefined ? attrs.ap : headSt.ap;
    if (textBody) {
      withId.push({ id: attrs.id, text: textBody, ap });
    }
  }

  if (withId.length > 0) {
    return normalizeOptionApCosts(withId).slice(0, SHERLOCK_OPTION_MAX);
  }

  const optionMatch = cleaned.match(/<option>([\s\S]*?)<\/option>/i);
  if (!optionMatch) {
    return [];
  }

  const optionText = optionMatch[1].trim();
  const lines = optionText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const optionPattern = /^[A-Z]\.\s*/;
  const hasLetterPrefix = lines.some(line => optionPattern.test(line));

  if (hasLetterPrefix && lines.length > 1) {
    const merged: Array<{ id: string; text: string; ap?: number }> = [];
    let currentOption: string[] = [];

    const flush = () => {
      if (currentOption.length === 0) return;
      const st0 = stripLineApPrefix(currentOption[0]);
      const rebuilt = [st0.text, ...currentOption.slice(1)];
      const fullText = rebuilt.join('\n');
      const idMatch = fullText.match(/^([A-Z])\./);
      const id = idMatch ? idMatch[1] : String.fromCharCode(65 + merged.length);
      const text = fullText.replace(/^[A-Z]\.\s*/, '').trim();
      merged.push({ id, text, ap: st0.ap });
      currentOption = [];
    };

    for (const line of lines) {
      if (optionPattern.test(line)) {
        flush();
        currentOption.push(line);
      } else if (currentOption.length > 0) {
        currentOption.push(line);
      }
    }
    flush();

    return normalizeOptionApCosts(merged).slice(0, SHERLOCK_OPTION_MAX);
  }

  return normalizeOptionApCosts(
    lines.slice(0, SHERLOCK_OPTION_MAX).map((line, index) => {
      const st = stripLineApPrefix(line);
      return { id: String.fromCharCode(65 + index), text: st.text, ap: st.ap };
    }),
  );
}

/** 只返回选项文案列表（已截断至最多 4 条） */
export function parseOptions(messageContent: string): string[] {
  return parseOptionsDetailed(messageContent).map(o => o.text);
}

export interface LoadFromLatestResult {
  maintext: string;
  options: OptionItem[];
  messageId?: number;
  userMessageId?: number;
  fullMessage?: string;
}

/**
 * 从聊天记录中取出 **最新一条 assistant 楼层** 的完整文本，再解析 maintext / option。
 */
export function loadFromLatestMessage(): LoadFromLatestResult {
  try {
    if (typeof getLastMessageId !== 'function' || typeof getChatMessages !== 'function') {
      return { maintext: '', options: [] };
    }

    const lastMessageId = getLastMessageId();
    if (lastMessageId < 0) {
      return { maintext: '', options: [] };
    }

    const assistantMsgs = getChatMessages(`0-${lastMessageId}`, {
      role: 'assistant',
      hide_state: 'unhidden',
    });
    if (!assistantMsgs?.length) {
      return { maintext: '', options: [] };
    }

    const latestAssistant = assistantMsgs[assistantMsgs.length - 1];
    const messageContent = latestAssistant.message || '';

    const maintext = parseMaintext(messageContent);
    const options = parseOptionsDetailed(messageContent);

    /** assistant 之前的最后一条 user（message_id 可能为 0，不能用 truthy 判断） */
    let userMessageId: number | undefined;
    const aid = latestAssistant.message_id;
    if (aid > 0) {
      try {
        const userMsgs = getChatMessages(`0-${aid - 1}`, { role: 'user', hide_state: 'unhidden' });
        if (userMsgs?.length) {
          userMessageId = userMsgs[userMsgs.length - 1].message_id;
        }
      } catch {
        /* 楼层不存在 */
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
    console.error('[Sherlock messageParser] loadFromLatestMessage', error);
    return { maintext: '', options: [] };
  }
}

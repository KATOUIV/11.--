import { parseMaintext, stripThinkingBlocks } from './messageParser';

/** 与 messageParser 一致：剥离思维链，避免干扰标签解析 */
export function removeThinkingTags(text: string): string {
  return stripThinkingBlocks(text);
}

/** 流式 token 累积文本同样先剥离 &lt;thinking&gt; / &lt;redacted_thinking&gt;（含未闭合截断） */
export function removeThinkingTagsFromStream(text: string): string {
  return stripThinkingBlocks(text);
}

export function extractLastMaintext(text: string): string {
  return parseMaintext(text);
}

export function extractLastOption(text: string): string {
  const matches = text.match(/<option>([\s\S]*?)<\/option>/gi);
  if (!matches?.length) return '';
  const lastMatch = matches[matches.length - 1];
  const contentMatch = lastMatch.match(/<option>([\s\S]*?)<\/option>/i);
  return contentMatch ? contentMatch[1].trim() : '';
}

export function extractLastSum(text: string): string {
  const matches = text.match(/<sum>([\s\S]*?)<\/sum>/gi);
  if (!matches?.length) return '';
  const lastMatch = matches[matches.length - 1];
  const contentMatch = lastMatch.match(/<sum>([\s\S]*?)<\/sum>/i);
  return contentMatch ? contentMatch[1].trim() : '';
}

export function extractLastUpdateVariable(text: string): string {
  const matches = text.match(/<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/gi);
  if (!matches?.length) return '';
  const lastMatch = matches[matches.length - 1];
  const contentMatch = lastMatch.match(/<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/i);
  return contentMatch ? contentMatch[1].trim() : '';
}

/** 至少需可解析的 &lt;maintext&gt;；&lt;option&gt; 可选（自由输入回合可无选项）。 */
export function validateAssistantOutput(messageContent: string): boolean {
  const cleaned = removeThinkingTags(messageContent);
  const maintext = extractLastMaintext(cleaned);
  return Boolean(maintext?.trim());
}

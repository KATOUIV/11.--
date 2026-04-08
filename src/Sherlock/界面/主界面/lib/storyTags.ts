/**
 * 与 mhjg 的 storyInteraction 标签约定一致：&lt;maintext&gt; / &lt;option&gt; / &lt;sum&gt; 等。
 * 正文与选项的解析实现见 `./messageParser.ts`。
 */

import {
  parseMaintext,
  parseOptions,
  loadFromLatestMessage,
  parseOptionsDetailed,
  SHERLOCK_OPTION_MAX,
  type OptionItem,
  type LoadFromLatestResult,
} from './messageParser';

export {
  parseMaintext,
  parseOptions,
  loadFromLatestMessage,
  parseOptionsDetailed,
  SHERLOCK_OPTION_MAX,
  type OptionItem,
  type LoadFromLatestResult,
};

/** 与生成校验一致：至少要有可解析的 &lt;maintext&gt;。 */
export function validateMessage(messageContent: string): boolean {
  if (!messageContent || typeof messageContent !== 'string') {
    return false;
  }
  return Boolean(parseMaintext(messageContent)?.trim());
}

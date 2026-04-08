/**
 * 统一请求处理（对齐指南 requestHandler / unifiedRequestHandler）：
 * 封装 `runVaultTurn`，提供回调位；流式正文仍通过 `VAULT_OS_STREAM_MAINTEXT` 由界面订阅。
 */
import { runVaultTurn, VAULT_OS_STREAM_MAINTEXT, type DualApiRuntimeConfig, type VaultTurnMode } from './vaultTurnPipeline';

export type VaultRequestData = {
  type: 'option' | 'custom';
  content: string;
};

export type VaultUnifiedCallbacks = {
  onDisableOptions?: () => void;
  onShowGenerating?: () => void;
  onHideGenerating?: () => void;
  onEnableOptions?: () => void;
  onError?: (message: string) => void;
  onRefreshStory?: () => void | Promise<void>;
  onStreamingUpdate?: (preview: string) => void;
  onRefreshVariables?: () => void | Promise<void>;
};

export type VaultRequestContext = {
  statSnapshot: string;
  shouldStream: boolean;
  mode: VaultTurnMode;
  dual: DualApiRuntimeConfig | null;
};

/**
 * @returns 是否成功完成一轮（assistant 已落库并发出 COMMITTED）
 */
export async function handleVaultUnifiedRequest(
  request: VaultRequestData,
  ctx: VaultRequestContext,
  callbacks?: VaultUnifiedCallbacks,
): Promise<boolean> {
  const prompt = request.content.trim();
  if (!prompt) {
    callbacks?.onError?.('内容为空');
    return false;
  }

  callbacks?.onDisableOptions?.();
  callbacks?.onShowGenerating?.();

  let streamSub: { stop: () => void } | null = null;
  if (ctx.shouldStream && typeof eventOn === 'function' && callbacks?.onStreamingUpdate) {
    streamSub = eventOn(VAULT_OS_STREAM_MAINTEXT, (preview: string) => {
      callbacks.onStreamingUpdate?.(preview);
    });
  }

  try {
    await runVaultTurn({
      displayUserText: prompt,
      statSnapshot: ctx.statSnapshot,
      shouldStream: ctx.shouldStream,
      mode: ctx.mode,
      dual: ctx.dual,
    });

    callbacks?.onHideGenerating?.();
    callbacks?.onEnableOptions?.();

    await callbacks?.onRefreshStory?.();
    await callbacks?.onRefreshVariables?.();

    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[vaultRequestHandler] handleVaultUnifiedRequest', e);
    callbacks?.onHideGenerating?.();
    callbacks?.onEnableOptions?.();
    callbacks?.onError?.(msg);
    return false;
  } finally {
    streamSub?.stop();
  }
}

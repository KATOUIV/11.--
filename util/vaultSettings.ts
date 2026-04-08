/**
 * VAULT-OS 界面设置（存角色卡变量，随角色持久化）
 */
import { z } from 'zod';

export const VAULT_UI_STORAGE_KEY = 'vault_os_ui';

export const VaultUiSettingsSchema = z.object({
  /** 根字号（px） */
  fontSizePx: z.number().min(10).max(26).default(12),
  /** 使用等宽栈（JetBrains Mono 等） */
  useMonoFont: z.boolean().default(true),
  /**
   * 与《前端项目改造指南》统一请求处理一致：`generate` 传 `should_stream: true`，
   * 并在调用前注册 `iframe_events.STREAM_TOKEN_RECEIVED_FULLY`（见 util/vaultTurnPipeline）。
   */
  streamLlm: z.boolean().default(false),
  outputMode: z.enum(['single_api', 'dual_api']).default('single_api'),
  /** 留空则使用当前角色绑定主世界书名 */
  worldbookName: z.string().default(''),
  dualApi: z
    .object({
      apiurl: z.string().default(''),
      key: z.string().default(''),
      model: z.string().default(''),
      maxRetries: z.number().int().min(0).max(10).default(2),
      /** 第二 API 额外任务说明（世界大势等），可为空 */
      secondApiExtraTasks: z.string().default(''),
    })
    .default({}),
});

export type VaultUiSettings = z.infer<typeof VaultUiSettingsSchema>;

export function loadVaultUiSettings(): VaultUiSettings {
  if (typeof getVariables !== 'function') {
    return VaultUiSettingsSchema.parse({});
  }
  try {
    const v = getVariables({ type: 'character' });
    const raw = v[VAULT_UI_STORAGE_KEY];
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return VaultUiSettingsSchema.parse(raw);
    }
  } catch (e) {
    console.warn('[vaultSettings] load', e);
  }
  return VaultUiSettingsSchema.parse({});
}

export function saveVaultUiSettings(settings: VaultUiSettings): void {
  if (typeof getVariables !== 'function' || typeof replaceVariables !== 'function') {
    throw new Error('getVariables / replaceVariables 不可用');
  }
  const parsed = VaultUiSettingsSchema.parse(settings);
  const prev = getVariables({ type: 'character' });
  replaceVariables({ ...prev, [VAULT_UI_STORAGE_KEY]: parsed }, { type: 'character' });
}

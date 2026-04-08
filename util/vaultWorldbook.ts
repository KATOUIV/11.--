/**
 * 按单/双 API 模式切换世界书条目启用状态；按名称读取条目正文（供第二 API 提示词）
 */

/** 与角色卡世界书条目名称一致 */
export const VAULT_WB_NAMES = {
  varRules: '变量更新规则',
  varList: '变量列表',
  varFormat: '变量输出格式',
  singleBody: '单api正文格式',
  multiBody: '多api正文格式',
} as const;

export async function resolveVaultWorldbookName(override: string): Promise<string | null> {
  const t = override.trim();
  if (t) return t;
  if (typeof getCharWorldbookNames !== 'function') return null;
  const ch = getCharWorldbookNames('current');
  if (ch.primary) return ch.primary;
  if (ch.additional?.length) return ch.additional[0] ?? null;
  return null;
}

/**
 * 单 API：启用变量相关 + 单api正文；关闭多api正文。
 * 双 API：关闭变量相关 + 单api正文；启用多api正文。
 */
export async function applyVaultOutputModeToWorldbook(
  mode: 'single_api' | 'dual_api',
  worldbookName: string,
): Promise<void> {
  if (typeof updateWorldbookWith !== 'function') {
    throw new Error('updateWorldbookWith 不可用');
  }

  const enableIfSingle: Record<string, boolean> = {
    [VAULT_WB_NAMES.varRules]: true,
    [VAULT_WB_NAMES.varList]: true,
    [VAULT_WB_NAMES.varFormat]: true,
    [VAULT_WB_NAMES.singleBody]: true,
    [VAULT_WB_NAMES.multiBody]: false,
  };

  const enableIfDual: Record<string, boolean> = {
    [VAULT_WB_NAMES.varRules]: false,
    [VAULT_WB_NAMES.varList]: false,
    [VAULT_WB_NAMES.varFormat]: false,
    [VAULT_WB_NAMES.singleBody]: false,
    [VAULT_WB_NAMES.multiBody]: true,
  };

  const target = mode === 'dual_api' ? enableIfDual : enableIfSingle;

  await updateWorldbookWith(
    worldbookName,
    wb =>
      wb.map(entry => {
        if (entry.name in target) {
          return { ...entry, enabled: target[entry.name]! };
        }
        return entry;
      }),
    { render: 'immediate' },
  );
}

export async function getWorldbookEntryContent(worldbookName: string, entryName: string): Promise<string> {
  if (typeof getWorldbook !== 'function') {
    throw new Error('getWorldbook 不可用');
  }
  const wb = await getWorldbook(worldbookName);
  const hit = wb.find(e => e.name === entryName);
  return hit?.content ?? '';
}

export async function getVaultVariableWorldbookSnippets(worldbookName: string): Promise<{
  变量更新规则: string;
  变量列表: string;
  变量输出格式: string;
}> {
  const [变量更新规则, 变量列表, 变量输出格式] = await Promise.all([
    getWorldbookEntryContent(worldbookName, VAULT_WB_NAMES.varRules),
    getWorldbookEntryContent(worldbookName, VAULT_WB_NAMES.varList),
    getWorldbookEntryContent(worldbookName, VAULT_WB_NAMES.varFormat),
  ]);
  return { 变量更新规则, 变量列表, 变量输出格式 };
}

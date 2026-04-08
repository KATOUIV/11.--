import { useCallback, useEffect, useState } from 'react';

import {
  loadVaultUiSettings,
  saveVaultUiSettings,
  type VaultUiSettings,
} from '../../../../util/vaultSettings';
import { applyVaultOutputModeToWorldbook, resolveVaultWorldbookName } from '../../../../util/vaultWorldbook';

type Props = {
  open: boolean;
  onClose: () => void;
  /** 保存成功后回调（用于父组件同步内存中的 settings） */
  onSaved: (s: VaultUiSettings) => void;
};

export function VaultSettingsModal(props: Props) {
  const [draft, setDraft] = useState<VaultUiSettings>(() => loadVaultUiSettings());
  const [resolvedWb, setResolvedWb] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [apiStatus, setApiStatus] = useState<string>('');
  const [modelsBusy, setModelsBusy] = useState(false);
  const [modelsHint, setModelsHint] = useState<string>('');

  const dual = draft.dualApi;

  const refreshResolvedWb = useCallback(async (worldbookOverride?: string) => {
    const n = await resolveVaultWorldbookName(worldbookOverride ?? draft.worldbookName);
    setResolvedWb(n ?? '（未绑定或无法解析）');
  }, [draft.worldbookName]);

  useEffect(() => {
    if (!props.open) return;
    const s = loadVaultUiSettings();
    setDraft(s);
    void (async () => {
      const n = await resolveVaultWorldbookName(s.worldbookName);
      setResolvedWb(n ?? '（未绑定或无法解析）');
    })();
  }, [props.open]);

  const testConnection = async () => {
    setApiStatus('测试中…');
    try {
      if (typeof getModelList !== 'function') {
        setApiStatus('getModelList 不可用');
        return;
      }
      if (!dual.apiurl.trim()) {
        setApiStatus('请填写 API URL');
        return;
      }
      await getModelList({ apiurl: dual.apiurl.trim(), key: dual.key });
      setApiStatus('连接成功（已请求模型列表接口）');
    } catch (e) {
      console.error('[vault settings] test', e);
      setApiStatus(`失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const fetchModels = async () => {
    setModelsBusy(true);
    setModelsHint('');
    try {
      if (typeof getModelList !== 'function') {
        setModelsHint('getModelList 不可用');
        return;
      }
      if (!dual.apiurl.trim()) {
        setModelsHint('请填写 API URL');
        return;
      }
      const list = await getModelList({ apiurl: dual.apiurl.trim(), key: dual.key });
      setModelsHint(list.length ? `共 ${list.length} 个模型（可手动填入下方）` : '列表为空');
      if (list.length && !draft.dualApi.model.trim()) {
        setDraft(d => ({
          ...d,
          dualApi: { ...d.dualApi, model: list[0] ?? '' },
        }));
      }
    } catch (e) {
      console.error('[vault settings] models', e);
      setModelsHint(`获取失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setModelsBusy(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const wb = await resolveVaultWorldbookName(draft.worldbookName);
      if (!wb) {
        toastr?.error?.('无法解析世界书：请在本界面填写世界书名称，或为当前角色绑定主世界书');
        return;
      }
      await applyVaultOutputModeToWorldbook(draft.outputMode === 'dual_api' ? 'dual_api' : 'single_api', wb);
      saveVaultUiSettings(draft);
      props.onSaved(draft);
      toastr?.success?.('设置已保存，世界书条目已切换');
      props.onClose();
    } catch (e) {
      console.error('[vault settings] save', e);
      toastr?.error?.(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-130 flex items-end justify-center sm:items-center pt-[env(safe-area-inset-top,0)] sm:p-3 bg-black/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-settings-title"
      onClick={e => e.target === e.currentTarget && props.onClose()}
    >
      <div
        className="vault-panel w-full max-w-lg max-h-[min(90dvh,640px)] sm:max-h-[min(90vh,640px)] flex flex-col rounded-t-xl sm:rounded-sm shadow-[0_0_40px_rgba(0,255,65,0.1)] border border-vault-border/50 mb-[env(safe-area-inset-bottom,0)] sm:mb-0"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-vault-border px-3 py-2.5 sm:py-2 shrink-0">
          <h2 id="vault-settings-title" className="text-[13px] tracking-widest font-semibold m-0 min-w-0 pr-2">
            设置
          </h2>
          <button
            type="button"
            className="vault-btn rounded-sm px-3 py-2 sm:px-2 sm:py-1 text-[11px] shrink-0 min-h-11 sm:min-h-0"
            onClick={props.onClose}
          >
            关闭
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto vault-scrollbar p-3 sm:p-3 space-y-4 text-[12px] leading-relaxed">
          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold tracking-wider text-vault-green/90 m-0">外观</h3>
            <label className="flex items-center justify-between gap-2">
              <span className="opacity-85">界面字号</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={10}
                  max={22}
                  step={1}
                  value={draft.fontSizePx}
                  onChange={e =>
                    setDraft(d => ({ ...d, fontSizePx: Number(e.target.value) || 12 }))
                  }
                  className="w-28 accent-vault-green"
                />
                <span className="tabular-nums opacity-80 w-8">{draft.fontSizePx}px</span>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.useMonoFont}
                onChange={e => setDraft(d => ({ ...d, useMonoFont: e.target.checked }))}
                className="accent-vault-green"
              />
              <span className="opacity-85">等宽字体（终端风格）</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.streamLlm}
                onChange={e => setDraft(d => ({ ...d, streamLlm: e.target.checked }))}
                className="accent-vault-green mt-0.5"
              />
              <span className="opacity-85">
                LLM 流式传输（与《前端项目改造指南》一致：在 <code className="text-[10px] opacity-90">generate</code> 前监听{' '}
                <code className="text-[10px] opacity-90">STREAM_TOKEN_RECEIVED_FULLY</code>，并传{' '}
                <code className="text-[10px] opacity-90">should_stream</code>）
              </span>
            </label>
          </section>

          <section className="space-y-2 border-t border-vault-border/30 pt-3">
            <h3 className="text-[11px] font-semibold tracking-wider text-vault-green/90 m-0">输出模式</h3>
            <div className="space-y-2 opacity-90">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="vault-out-mode"
                  checked={draft.outputMode === 'single_api'}
                  onChange={() => setDraft(d => ({ ...d, outputMode: 'single_api' }))}
                  className="mt-1 accent-vault-green"
                />
                <span>
                  <strong>单 API 模式</strong>
                  <span className="block text-[11px] opacity-75 mt-0.5">
                    一次生成完整输出：剧情与变量由同一模型在同一轮完成。
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="vault-out-mode"
                  checked={draft.outputMode === 'dual_api'}
                  onChange={() => setDraft(d => ({ ...d, outputMode: 'dual_api' }))}
                  className="mt-1 accent-vault-green"
                />
                <span>
                  <strong>多 API 模式</strong>
                  <span className="block text-[11px] opacity-75 mt-0.5">
                    主 API 只生成剧情与界面标签（配合「多api正文格式」世界书）；第二 API 单独根据正文与变量规则输出变量更新，上下文更短、更稳。
                  </span>
                </span>
              </label>
            </div>
            <p className="text-[10px] opacity-60 m-0 leading-snug">
              切换模式并保存时，会自动开关世界书中的：变量更新规则、变量列表、变量输出格式、单api正文格式、多api正文格式（按名称匹配条目）。
            </p>
            <label className="block space-y-1">
              <span className="opacity-85">世界书名称（留空则用当前角色主世界书）</span>
              <input
                className="vault-input w-full rounded-sm px-2 py-1.5 text-[12px]"
                value={draft.worldbookName}
                onChange={e => setDraft(d => ({ ...d, worldbookName: e.target.value }))}
                onBlur={e => void refreshResolvedWb(e.target.value)}
                placeholder="例如：我的避难所世界书"
              />
              <span className="text-[10px] opacity-55">解析为：{resolvedWb}</span>
            </label>
          </section>

          {draft.outputMode === 'dual_api' && (
            <section className="space-y-2 border-t border-vault-border/30 pt-3">
              <h3 className="text-[11px] font-semibold tracking-wider text-vault-green/90 m-0">第二 API（OpenAI 兼容）</h3>
              <label className="block space-y-1">
                <span className="opacity-85">API URL</span>
                <input
                  className="vault-input w-full rounded-sm px-2 py-1.5 text-[12px]"
                  value={dual.apiurl}
                  onChange={e =>
                    setDraft(d => ({ ...d, dualApi: { ...d.dualApi, apiurl: e.target.value } }))
                  }
                  placeholder="https://..."
                  autoComplete="off"
                />
              </label>
              <label className="block space-y-1">
                <span className="opacity-85">API Key</span>
                <input
                  type="password"
                  className="vault-input w-full rounded-sm px-2 py-1.5 text-[12px]"
                  value={dual.key}
                  onChange={e => setDraft(d => ({ ...d, dualApi: { ...d.dualApi, key: e.target.value } }))}
                  placeholder="sk-..."
                  autoComplete="new-password"
                />
              </label>
              <label className="block space-y-1">
                <span className="opacity-85">模型</span>
                <input
                  className="vault-input w-full rounded-sm px-2 py-1.5 text-[12px]"
                  value={dual.model}
                  onChange={e =>
                    setDraft(d => ({ ...d, dualApi: { ...d.dualApi, model: e.target.value } }))
                  }
                  placeholder="gpt-4o-mini"
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="opacity-85">最大重试次数（0–10）</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  className="vault-input w-16 rounded-sm px-2 py-1 text-[12px] text-center"
                  value={dual.maxRetries}
                  onChange={e =>
                    setDraft(d => ({
                      ...d,
                      dualApi: {
                        ...d.dualApi,
                        maxRetries: Math.min(10, Math.max(0, Number(e.target.value) || 0)),
                      },
                    }))
                  }
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="vault-btn rounded-sm px-2 py-1.5 text-[11px]"
                  onClick={() => void testConnection()}
                >
                  连接测试
                </button>
                <button
                  type="button"
                  className="vault-btn rounded-sm px-2 py-1.5 text-[11px] disabled:opacity-50"
                  disabled={modelsBusy}
                  onClick={() => void fetchModels()}
                >
                  {modelsBusy ? '获取中…' : '获取可用模型'}
                </button>
              </div>
              {apiStatus && <p className="text-[10px] opacity-75 m-0">{apiStatus}</p>}
              {modelsHint && <p className="text-[10px] opacity-75 m-0">{modelsHint}</p>}

              <label className="block space-y-1">
                <span className="opacity-85">第二 API 额外任务（可选）</span>
                <textarea
                  className="vault-input w-full min-h-[72px] rounded-sm px-2 py-1.5 text-[12px] resize-y"
                  value={dual.secondApiExtraTasks}
                  onChange={e =>
                    setDraft(d => ({
                      ...d,
                      dualApi: { ...d.dualApi, secondApiExtraTasks: e.target.value },
                    }))
                  }
                  placeholder="例如：同步「世界大势」摘要；若无则留空。"
                />
              </label>
            </section>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2 border-t border-vault-border/30">
            <button
              type="button"
              className="vault-btn rounded-sm px-3 py-2.5 sm:py-2 text-[12px] w-full sm:w-auto min-h-11 sm:min-h-0 touch-manipulation"
              onClick={props.onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="vault-btn rounded-sm px-3 py-2.5 sm:py-2 text-[12px] disabled:opacity-50 w-full sm:w-auto min-h-11 sm:min-h-0 touch-manipulation"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? '保存中…' : '保存并应用世界书'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

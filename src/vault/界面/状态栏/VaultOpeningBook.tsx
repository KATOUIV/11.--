import { gsap } from 'gsap';
import { useCallback, useMemo, useRef, useState } from 'react';

import { createOpeningStoryMessage, initializeGameVariables } from '../../utils/gameInitializer';
import { VAULT_DISASTER_PRESETS, VAULT_TIMELINE_OPTIONS, type VaultOpeningDraft } from '../../../../util/vaultOpening';

type Props = {
  useMonoFont: boolean;
  fontSizePx: number;
  onDone: () => void;
};

function buildDisasterEssence(
  disasterId: string,
  customDisaster: string,
): { ok: true; text: string } | { ok: false; reason: string } {
  const preset = VAULT_DISASTER_PRESETS.find(p => p.id === disasterId);
  if (!preset) return { ok: false, reason: '无效选项' };
  if (disasterId === 'custom') {
    const t = customDisaster.trim();
    if (!t) return { ok: false, reason: '请填写自定义灾难设定，或改选其他预设。' };
    return { ok: true, text: t };
  }
  return { ok: true, text: `「${preset.title}」${preset.blurb}` };
}

export function VaultOpeningBook({ useMonoFont, fontSizePx, onDone }: Props) {
  const [page, setPage] = useState<0 | 1>(0);
  const [disasterId, setDisasterId] = useState(VAULT_DISASTER_PRESETS[0].id);
  const [customDisaster, setCustomDisaster] = useState('');
  const [timeline, setTimeline] = useState(VAULT_TIMELINE_OPTIONS[0]);
  const [busy, setBusy] = useState(false);

  const flipRef = useRef<HTMLDivElement>(null);
  const flippingRef = useRef(false);

  const selectedPreset = useMemo(() => VAULT_DISASTER_PRESETS.find(p => p.id === disasterId), [disasterId]);

  const runFlip = useCallback((afterSwap: () => void) => {
    const el = flipRef.current;
    if (!el || flippingRef.current) {
      afterSwap();
      return;
    }
    flippingRef.current = true;
    gsap.set(el, { transformPerspective: 1100 });
    gsap.to(el, {
      rotationY: -88,
      opacity: 0.2,
      duration: 0.34,
      ease: 'power2.in',
      onComplete: () => {
        afterSwap();
        gsap.fromTo(
          el,
          { rotationY: 88, opacity: 0.2 },
          {
            rotationY: 0,
            opacity: 1,
            duration: 0.4,
            ease: 'power2.out',
            onComplete: () => {
              flippingRef.current = false;
            },
          },
        );
      },
    });
  }, []);

  const goNext = () => {
    const essence = buildDisasterEssence(disasterId, customDisaster);
    if (!essence.ok) {
      toastr?.error?.(essence.reason);
      return;
    }
    runFlip(() => setPage(1));
  };

  const goPrev = () => {
    runFlip(() => setPage(0));
  };

  const handleFinish = async () => {
    const essence = buildDisasterEssence(disasterId, customDisaster);
    if (!essence.ok) {
      toastr?.error?.(essence.reason);
      return;
    }
    const draft: VaultOpeningDraft = {
      disasterEssence: essence.text,
      timelineNode: timeline,
    };
    setBusy(true);
    try {
      const okVars = await initializeGameVariables(draft);
      if (!okVars) {
        toastr?.error?.('写入 0 层变量失败，请查看控制台');
        return;
      }
      const okStory = await createOpeningStoryMessage(draft);
      if (!okStory) {
        toastr?.warning?.('开局楼层可能未创建（或已存在），变量已写入');
      } else {
        toastr?.success?.('开局档案已写入，并已尝试创建开局楼层');
      }
      onDone();
    } catch (e) {
      console.error('[VaultOpeningBook] opening flow failed', e);
      toastr?.error?.('开局流程失败，请查看控制台');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`vault-crt-shell h-full w-full min-h-[320px] flex flex-col items-center justify-center p-3 sm:p-5 box-border ${useMonoFont ? 'font-mono' : ''}`}
      style={{ fontSize: `${fontSizePx}px` }}
    >
      <div className="w-full max-w-md flex flex-col items-center gap-3">
        <p className="m-0 text-[0.7em] tracking-[0.28em] text-vault-green/50 uppercase text-center">档案编纂 · 开局</p>

        <div className="vault-opening-book-outer w-full">
          <div className="vault-opening-book-spine" aria-hidden />
          <div className="vault-opening-book-main min-h-0 p-0">
            <div className="w-full perspective-distant">
              <div
                ref={flipRef}
                className="vault-opening-book-page vault-panel rounded-none border-0 border-l border-vault-border/40 p-4 sm:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] min-h-[min(58vh,440px)] flex flex-col relative z-1"
                style={{ transformStyle: 'preserve-3d' }}
              >
            {page === 0 ? (
              <>
                <div className="shrink-0 border-b border-vault-border/25 pb-3 mb-3 text-center">
                  <p className="m-0 text-[0.68em] tracking-[0.35em] text-vault-green/45 uppercase">第一卷</p>
                  <h2 className="m-0 mt-1 text-[1.08em] tracking-[0.22em] text-vault-green/95">灾难的本质</h2>
                  <p className="m-0 mt-2 text-[0.88em] opacity-75 leading-relaxed">
                    与原著一样，全球热战滑向核冬天？或选择另一种末日逻辑——将写入「世界环境层 · 灾难本质」。
                  </p>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto vault-scrollbar space-y-2 pr-0.5">
                  {VAULT_DISASTER_PRESETS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setDisasterId(p.id)}
                      className={[
                        'w-full text-left rounded-sm border px-3 py-2.5 transition-colors',
                        disasterId === p.id
                          ? 'border-vault-green/55 bg-vault-green/10'
                          : 'border-vault-border/35 bg-black/20 hover:border-vault-green/35',
                      ].join(' ')}
                    >
                      <div className="text-[0.95em] font-medium text-vault-green/95">{p.title}</div>
                      <div className="text-[0.82em] opacity-65 mt-1 leading-snug">{p.blurb}</div>
                    </button>
                  ))}
                </div>
                {disasterId === 'custom' && (
                  <label className="flex flex-col gap-1 mt-3 shrink-0">
                    <span className="text-[0.8em] opacity-70">自定义灾难设定</span>
                    <textarea
                      value={customDisaster}
                      onChange={e => setCustomDisaster(e.target.value)}
                      rows={3}
                      className="vault-input rounded-sm px-2 py-2 text-[0.9em] w-full resize-y min-h-18"
                      placeholder="简述你的世界观灾难来源……"
                    />
                  </label>
                )}
                <div className="flex justify-end pt-3 shrink-0 border-t border-vault-border/20 mt-3">
                  <button type="button" className="vault-btn rounded-sm px-5 py-2.5 text-[0.95em]" onClick={goNext}>
                    下一页 →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="shrink-0 border-b border-vault-border/25 pb-3 mb-3 text-center">
                  <p className="m-0 text-[0.68em] tracking-[0.35em] text-vault-green/45 uppercase">第二页</p>
                  <h2 className="m-0 mt-1 text-[1.05em] tracking-[0.2em] text-vault-green/95">时间线</h2>
                  <p className="m-0 mt-2 text-[0.88em] opacity-75 leading-relaxed">
                    当前处于灾难爆发的哪一刻？（相对锚点，写入「世界环境层 · 时间线节点」）
                  </p>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto vault-scrollbar space-y-1.5 pr-0.5">
                  {VAULT_TIMELINE_OPTIONS.map(opt => (
                    <label
                      key={opt}
                      className={[
                        'flex items-center gap-2 rounded-sm border px-3 py-2 cursor-pointer transition-colors',
                        timeline === opt
                          ? 'border-vault-green/55 bg-vault-green/10'
                          : 'border-vault-border/35 bg-black/20 hover:border-vault-green/35',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        className="accent-vault-green shrink-0"
                        checked={timeline === opt}
                        onChange={() => setTimeline(opt)}
                      />
                      <span className="text-[0.92em] leading-snug">{opt}</span>
                    </label>
                  ))}
                </div>
                {selectedPreset && disasterId !== 'custom' && (
                  <p className="text-[0.78em] opacity-50 mt-2 shrink-0 line-clamp-3">
                    已选封面：{selectedPreset.title}
                  </p>
                )}
                <div className="flex justify-between gap-2 pt-3 shrink-0 border-t border-vault-border/20 mt-3">
                  <button
                    type="button"
                    className="vault-btn rounded-sm px-4 py-2.5 text-[0.9em] opacity-90"
                    onClick={goPrev}
                    disabled={busy}
                  >
                    ← 上一页
                  </button>
                  <button
                    type="button"
                    className="vault-btn rounded-sm px-5 py-2.5 text-[0.95em]"
                    onClick={() => void handleFinish()}
                    disabled={busy}
                  >
                    {busy ? '写入中…' : '完成开局'}
                  </button>
                </div>
              </>
            )}
              </div>
            </div>
          </div>
        </div>

        <p className="m-0 text-[0.72em] opacity-45 text-center max-w-md leading-relaxed">
          确认后将写入 <code className="opacity-80">世界环境层</code>：当前日期/时间、灾难本质、时间线节点、世界现状摘要。完整{' '}
          <code className="opacity-80">stat_data</code> 结构见{' '}
          <code className="opacity-80">util/vault-opening-stat-example.json</code>，可用{' '}
          <code className="opacity-80">buildOpeningPromptContext</code> 生成提示词。
        </p>
      </div>
    </div>
  );
}

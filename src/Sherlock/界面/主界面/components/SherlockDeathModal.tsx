import { useCallback, useEffect, useState } from 'react';
import { useSherlockStats } from '../context/SherlockStatContext';
import { cn } from '../lib/utils';

/**
 * 生机归零：阻断式幕布，引导玩家授权回到先前钉下的时标（检查点／回溯）。
 */
export function SherlockDeathModal() {
  const { stats, hasLiveData, refresh } = useSherlockStats();
  const hpMax = Math.max(1, stats.player.hpMax);
  const hp = Math.min(Math.max(0, stats.player.hp), hpMax);
  const dead = hasLiveData && hp <= 0;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!dead) setBusy(false);
  }, [dead]);

  const onRollback = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (typeof triggerSlash === 'function') {
        await triggerSlash('/checkpoint-go');
        toastr.info(
          '已请求回到回溯点。请在主对话里选中你存过档的那一层，再点输入条旁的回溯钮。',
          '伦敦博弈场',
          { timeOut: 9000 },
        );
      } else {
        toastr.warning('此处无法唤起回溯，请在主界面用回溯或存档钮操作。', '伦敦博弈场');
      }
    } catch (e) {
      console.warn('[Sherlock] checkpoint-go', e);
      toastr.error(
        '未能接通回溯。请选中存过档的那一层再试；若从未存过档，请先在主界面用回溯钮建立检查点。',
        '伦敦博弈场',
        { timeOut: 12000 },
      );
    } finally {
      void refresh();
      setBusy(false);
    }
  }, [busy, refresh]);

  if (!dead) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-10040 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sherlock-death-title"
      aria-describedby="sherlock-death-desc"
    >
      <div
        className={cn(
          'max-w-md rounded-2xl border border-rose-500/45 bg-linear-to-b from-[#1a0508]/95 via-black/92 to-[#0a0406]/95 p-6 shadow-[0_0_48px_rgba(244,63,94,0.25),inset_0_1px_0_rgba(255,255,255,0.06)]',
        )}
      >
        <p
          id="sherlock-death-title"
          className="font-serif text-lg tracking-[0.2em] text-rose-200/95"
        >
          雾巷缄默
        </p>
        <p id="sherlock-death-desc" className="mt-3 text-sm leading-relaxed text-slate-300/95">
          生机散尽，雾吞没了最后一丝脉搏。案卷在此封缄，你仍可从存下的
          <strong className="text-rose-200/90">回溯点</strong>把故事重新翻开。
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          点下列按钮，即表示同意回到<strong className="text-slate-400">上一回溯点</strong>
          。请先在主对话里选中你存过档的那一层；若从未存过档，请先在主界面用输入条旁的回溯钮建一档。
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onRollback()}
          className={cn(
            'mt-5 w-full rounded-xl border border-rose-400/50 bg-linear-to-r from-rose-950/80 to-red-950/70 py-3 text-sm font-medium tracking-widest text-rose-100 transition',
            'hover:border-rose-300/60 hover:shadow-[0_0_24px_rgba(244,63,94,0.35)]',
            'disabled:cursor-wait disabled:opacity-60',
          )}
        >
          {busy ? '正在接通回溯…' : '授令 · 回到上一回溯点'}
        </button>
      </div>
    </div>
  );
}

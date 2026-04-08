import { Sparkles, Zap } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSherlockStats } from '../context/SherlockStatContext';
import {
  apHudStatusGlyphBorderClass,
  apHudStatusStressShell,
  apStressBarFillClass,
  apStressBarTrackClass,
  apStressPercentTextClass,
  apStressZapClass,
  getApStressTier,
} from '../lib/apStressVisual';
import { cn } from '../lib/utils';
import { clampPct } from '../utils/sherlockStatModel';
import { HpHudGlyph } from './hudWidgets';
import { SherlockHudFullPanel } from './SherlockHudFullPanel';

/**
 * 侧栏品牌行：案卷 HUD 收束为此按钮；AP 变动时高亮闪动，点击展开浮层查看完整指标（全屏与非全屏相同）。
 */
export function SherlockHudStatusButton() {
  const { stats } = useSherlockStats();
  const apMax = Math.max(1, stats.player.apMax);
  const ap = Math.min(Math.max(0, stats.player.ap), apMax);
  const hpMax = Math.max(1, stats.player.hpMax);
  const hp = Math.min(Math.max(0, stats.player.hp), hpMax);
  const apPct = Math.round(clampPct((ap / apMax) * 100));
  const stressTier = getApStressTier(apPct);
  const reserveRaw = stats.player.apReserve;
  const reserveN = reserveRaw != null && reserveRaw > 0 ? reserveRaw : 0;
  const reservePct = Math.round(clampPct(apMax > 0 ? (reserveN / apMax) * 100 : 0));

  const [open, setOpen] = useState(false);
  const [apFlash, setApFlash] = useState(false);
  const prevApRef = useRef(ap);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [panelPos, setPanelPos] = useState({ top: 72, left: 8, width: 400, maxH: 560 });

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevApRef.current = ap;
      return;
    }
    if (prevApRef.current !== ap) {
      prevApRef.current = ap;
      setApFlash(true);
      const id = window.setTimeout(() => setApFlash(false), 1100);
      return () => window.clearTimeout(id);
    }
  }, [ap]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      const el = btnRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const maxW = Math.min(520, window.innerWidth - 16);
      let left = rect.right - maxW;
      if (left < 8) left = 8;
      if (left + maxW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - maxW - 8);
      const gap = 8;
      let top = rect.bottom + gap;
      const maxH = Math.min(Math.floor(window.innerHeight * 0.78), Math.max(200, window.innerHeight - top - gap));
      const estMin = 280;
      if (top + estMin > window.innerHeight - gap) {
        top = Math.max(gap, window.innerHeight - estMin - gap);
      }
      setPanelPos({
        top,
        left,
        width: maxW,
        maxH,
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const portalEl = typeof document !== 'undefined' ? document.getElementById('sherlock-portal-root') : null;

  const close = useCallback(() => setOpen(false), []);

  const overlay =
    open &&
    portalEl &&
    createPortal(
      <div
        className="sherlock-hud-status-overlay fixed inset-0 z-10035 bg-black/55 backdrop-blur-[3px]"
        role="presentation"
        onClick={close}
      >
        <div
          className="sherlock-hud-status-panel glass-panel-gold pointer-events-auto fixed sherlock-scroll-y-invisible rounded-2xl border border-sherlock-gold/35 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-4"
          style={{
            top: panelPos.top,
            left: panelPos.left,
            width: panelPos.width,
            maxHeight: panelPos.maxH,
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sherlock-hud-status-title"
          onClick={e => e.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-3 border-b border-sherlock-gold/20 pb-3">
            <div>
              <p id="sherlock-hud-status-title" className="font-serif text-xs tracking-[0.35em] text-sherlock-gold">
                雾都态势
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[10px] text-sherlock-text-muted">
                <Sparkles className="h-3 w-3 shrink-0 text-sherlock-gold/80" />
                剧情资源与势力刻度一览
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-sherlock-text-secondary transition-colors hover:border-sherlock-gold/40 hover:text-sherlock-gold"
              onClick={close}
            >
              关闭
            </button>
          </div>
          <SherlockHudFullPanel dense className="pb-1" />
        </div>
      </div>,
      portalEl,
    );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={cn(
          'sherlock-hud-status-btn group relative flex max-w-[min(100%,18rem)] shrink-0 items-center gap-2 overflow-hidden rounded-2xl border px-2.5 py-1.5 text-left shadow-[inset_0_0_24px_rgba(184,134,11,0.12)] transition-[transform,box-shadow] duration-300 sm:gap-2.5 sm:px-3 sm:py-2',
          apHudStatusStressShell(stressTier),
          'focus-visible:outline-none focus-visible:ring-2',
          apFlash && 'sherlock-hud-status-btn--ap-flash',
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(o => !o)}
        title="展开案卷侧栏：时间、势力、生机与行动余地"
      >
        <span className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen">
          <span className="absolute -left-1/2 top-0 h-full w-1/2 rotate-12 bg-linear-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-[220%]" />
        </span>
        <div className="relative flex shrink-0 items-center gap-1">
          <HpHudGlyph hp={hp} hpMax={hpMax} />
          <div
            className={cn(
              'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-black/50',
              apHudStatusGlyphBorderClass(stressTier),
              apFlash && 'sherlock-hud-status-btn__glyph--pulse',
            )}
          >
            <Zap className={cn('h-4 w-4', apStressZapClass(stressTier))} aria-hidden />
          </div>
        </div>
        <div className="relative min-w-0 flex-1">
          <p className="text-[9px] font-medium uppercase tracking-[0.28em] text-sherlock-text-muted">行动余地</p>
          <p
            className={cn(
              'text-sm font-semibold tabular-nums sm:text-base',
              apStressPercentTextClass(stressTier),
            )}
          >
            {apPct}%
          </p>
          <div className={cn(apStressBarTrackClass(stressTier), 'mt-1 h-1.5')} aria-hidden>
            <div
              className={cn('h-full rounded-full transition-[width] duration-500', apStressBarFillClass(stressTier))}
              style={{ width: `${apPct}%` }}
            />
          </div>
          {reserveN > 0 ? (
            <div
              className="mt-1 h-1 w-full overflow-hidden rounded-full border border-sky-500/20 bg-black/55"
              role="presentation"
              aria-label={`余力储备约 ${reservePct}%`}
            >
              <div
                className="h-full rounded-full bg-linear-to-r from-sky-700/40 to-cyan-400/50 shadow-[0_0_8px_rgba(34,211,238,0.2)] transition-[width] duration-500"
                style={{ width: `${reservePct}%` }}
              />
            </div>
          ) : null}
        </div>
      </button>
      {overlay}
    </>
  );
}

import { BookOpen, ChevronDown, ChevronUp, CircleHelp, Link2 } from 'lucide-react';
import { useState } from 'react';
import { FOG_GAMBIT_PLAYER_INTRO, MODULE_ATLAS, ROLL_FIELD_LABELS } from '../lib/gameWorldGuide';
import { cn } from '../lib/utils';

const MODULE_ORDER = [
  'plot',
  'faction',
  'bonds',
  'facilities',
  'inventory',
  'growth',
  'companions',
  'fogGambit',
] as const;

export function FogBattlePlaybookSection() {
  /** 默认收起，优先展示当期检定条；需要时再展开图鉴 */
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 rounded-xl border border-cyan-500/20 bg-linear-to-b from-cyan-950/20 to-black/40 shadow-[inset_0_0_32px_rgba(34,211,238,0.04)]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-white/5 sm:px-4"
      >
        <span className="flex items-center gap-2 font-serif text-sm font-semibold text-cyan-100/95">
          <BookOpen className="h-4 w-4 shrink-0 text-cyan-400/90" />
          雾巷档案 · 玩法图鉴
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-cyan-500/70" /> : <ChevronDown className="h-4 w-4 text-cyan-500/70" />}
      </button>

      {open ? (
        <div className="space-y-3 border-t border-cyan-500/15 px-3 pb-4 pt-1 sm:px-4">
          <p className="text-[11px] font-medium leading-relaxed text-slate-200">{FOG_GAMBIT_PLAYER_INTRO.headline}</p>
          <p className="text-[11px] leading-relaxed text-slate-400">{FOG_GAMBIT_PLAYER_INTRO.p1}</p>
          <p className="text-[11px] leading-relaxed text-slate-400">{FOG_GAMBIT_PLAYER_INTRO.p2}</p>
          <p className="rounded-lg border border-cyan-500/15 bg-black/35 px-3 py-2 text-[10px] leading-relaxed text-cyan-100/85">
            {FOG_GAMBIT_PLAYER_INTRO.troubleshooting}
          </p>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <Link2 className="h-3 w-3" />
              模块何以相扣
            </p>
            <ul className="sherlock-scroll-y-invisible max-h-[min(38vh,280px)] space-y-2 pr-1">
              {MODULE_ORDER.map(key => {
                const m = MODULE_ATLAS[key];
                if (!m) return null;
                return (
                  <li
                    key={key}
                    className="rounded-lg border border-white/5 bg-black/30 px-3 py-2.5 text-[10px] leading-relaxed text-slate-400"
                  >
                    <span className="font-serif text-[11px] font-semibold text-sherlock-gold/95">{m.title}</span>
                    <span className="text-slate-500"> — {m.oneLiner}</span>
                    <p className="mt-1 text-slate-400">{m.play}</p>
                    <p className="mt-1 border-l-2 border-cyan-500/30 pl-2 text-slate-500">{m.story}</p>
                    <p className="mt-1 italic text-cyan-600/80">{m.link}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 单个检定格：点击展开该格含义 */
export function RollFieldCell({
  index,
  value,
  active,
  onToggle,
}: {
  index: number;
  value: string;
  active: boolean;
  onToggle: () => void;
}) {
  const label = ROLL_FIELD_LABELS[index] ?? `第 ${index + 1} 项`;

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        'rounded-lg border px-2 py-1.5 text-left transition',
        active
          ? 'border-fuchsia-400/50 bg-fuchsia-950/25 shadow-[0_0_16px_rgba(217,70,239,0.15)]'
          : 'border-cyan-500/20 bg-black/50 hover:border-cyan-400/35',
      )}
    >
      <span className="flex items-center justify-between gap-1">
        <span className="text-[9px] font-medium uppercase tracking-wide text-cyan-500/80">{label}</span>
        <CircleHelp className="h-3 w-3 shrink-0 text-cyan-500/60" aria-hidden />
      </span>
      <span className="mt-0.5 block truncate text-[11px] text-slate-200" title={value}>
        {value || '—'}
      </span>
    </button>
  );
}

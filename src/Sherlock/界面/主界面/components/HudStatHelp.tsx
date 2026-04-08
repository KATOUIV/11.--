import { CircleHelp, X } from 'lucide-react';
import { memo } from 'react';
import { type HudHintId, HUD_HINTS } from '../lib/gameWorldGuide';
import { cn } from '../lib/utils';

/** 顶栏 / 底栏共用的「？」按钮，避免重复绑定 id */
export const HudHintButton = memo(function HudHintButton({
  id,
  activeId,
  onToggle,
  className,
}: {
  id: HudHintId;
  activeId: HudHintId | null;
  onToggle: (id: HudHintId) => void;
  className?: string;
}) {
  const open = activeId === id;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${HUD_HINTS[id].title}说明`}
      title="点击查看说明"
      onClick={e => {
        e.stopPropagation();
        onToggle(id);
      }}
      className={cn(
        'shrink-0 rounded-full border p-0.5 transition',
        open
          ? 'border-cyan-400/55 bg-cyan-950/50 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
          : 'border-white/10 bg-black/50 text-slate-500 hover:border-amber-500/35 hover:text-amber-200/90',
        className,
      )}
    >
      <CircleHelp className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
    </button>
  );
});

export const HudHintPanel = memo(function HudHintPanel({
  activeId,
  onClose,
  variant = 'cyan',
}: {
  activeId: HudHintId | null;
  onClose: () => void;
  variant?: 'cyan' | 'gold';
}) {
  if (!activeId) return null;
  const entry = HUD_HINTS[activeId];
  if (!entry) return null;

  const border =
    variant === 'gold'
      ? 'border-amber-500/35 shadow-[0_0_28px_rgba(184,134,11,0.12)]'
      : 'border-cyan-500/30 shadow-[0_0_28px_rgba(34,211,238,0.1)]';

  return (
    <div
      className={cn(
        'sherlock-hud-hint-panel mt-1 w-full rounded-xl border bg-[#070c14]/95 px-3 py-2 backdrop-blur-md sm:px-4 sm:py-2.5',
        border,
      )}
      role="region"
      aria-label={entry.title}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-serif text-xs font-semibold text-sherlock-gold sm:text-sm">{entry.title}</p>
          <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-400">{entry.body}</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg p-1 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
          aria-label="收起说明"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

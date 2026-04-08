import { useEffect, useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import type { OptionItem } from '../lib/messageParser';
import { normalizeOptionApCosts } from '../lib/messageParser';
import { cn } from '../lib/utils';

const VARIANTS = ['gold', 'blue', 'ember', 'mist'] as const;

type Variant = (typeof VARIANTS)[number];

const variantClass: Record<Variant, string> = {
  gold:
    'border-sherlock-gold/35 bg-gradient-to-br from-sherlock-gold/15 to-black/50 text-sherlock-gold shadow-[0_0_24px_rgba(184,134,11,0.12)] hover:border-sherlock-gold/55 hover:shadow-[0_0_32px_rgba(184,134,11,0.22)]',
  blue:
    'border-sherlock-blue/35 bg-gradient-to-br from-sherlock-blue/12 to-black/50 text-sherlock-blue shadow-[0_0_20px_rgba(30,92,140,0.12)] hover:border-sherlock-blue/50 hover:shadow-[0_0_28px_rgba(30,92,140,0.2)]',
  ember:
    'border-sherlock-red/35 bg-gradient-to-br from-sherlock-red/12 to-black/50 text-red-200 shadow-[0_0_20px_rgba(74,14,23,0.35)] hover:border-sherlock-red/50 hover:shadow-[0_0_28px_rgba(74,14,23,0.45)]',
  mist:
    'border-white/15 bg-gradient-to-br from-white/8 to-black/45 text-sherlock-text-secondary shadow-[0_0_16px_rgba(255,255,255,0.04)] hover:border-white/25 hover:text-sherlock-text-primary hover:shadow-[0_0_24px_rgba(255,255,255,0.08)]',
};

export function SherlockOptionRail({
  options,
  disabled,
  onPick,
  title = '可选行动',
  className,
}: {
  options: string[];
  disabled?: boolean;
  onPick: (text: string) => void;
  title?: string;
  className?: string;
}) {
  const list = normalizeOptionApCosts(
    options.slice(0, 4).map((text, i) => ({ id: String.fromCharCode(65 + i), text })),
  );
  const [expanded, setExpanded] = useState(false);
  const optionsFingerprint = options.join('\u0001');

  useEffect(() => {
    setExpanded(false);
  }, [optionsFingerprint]);

  if (list.length === 0) return null;

  /** 3 条用单列纵向排列，避免 2×2 网格第三格被父级裁切或不易滚动到 */
  const gridClass =
    list.length === 3 ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 gap-4 sm:grid-cols-2';

  return (
    <div
      className={cn(
        'sherlock-option-rail mt-0 flex w-full max-w-[min(100%,896px)] flex-col gap-0 min-h-0',
        expanded && 'min-h-0 flex-1',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        aria-controls="sherlock-option-rail-panel"
        id="sherlock-option-rail-trigger"
        className="mb-2 flex w-full shrink-0 items-center gap-2 rounded-lg border border-white/12 bg-black/35 px-3 py-2.5 text-left transition-colors hover:border-sherlock-gold/35 hover:bg-black/45 sm:py-3"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-sherlock-gold/80" aria-hidden />
        <span className="text-[10px] font-medium tracking-[0.15em] text-sherlock-text-muted">{title}</span>
        <span className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 tabular-nums text-[10px] text-sherlock-text-secondary">
          {list.length}
        </span>
        <span className="h-px min-w-4 flex-1 bg-linear-to-r from-sherlock-gold/25 to-transparent" />
        <span className="text-xs text-sherlock-text-muted">{expanded ? '收起' : '展开选项'}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-sherlock-gold/70 transition-transform duration-200', expanded && 'rotate-180')}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div
          id="sherlock-option-rail-panel"
          role="region"
          aria-labelledby="sherlock-option-rail-trigger"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <div className="sherlock-option-rail-scroll sherlock-scroll-y-invisible max-h-[min(72dvh,720px)] min-h-0 flex-1 pr-0.5">
            <div className={gridClass}>
              {list.map((item, i) => (
                <OptionCard
                  key={`${item.text}-${i}`}
                  index={i}
                  text={item.text}
                  apCost={item.apCost}
                  variant={VARIANTS[i % VARIANTS.length]}
                  disabled={disabled}
                  onPick={() => onPick(item.text)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 浮窗内用：无折叠条，整块可滚动，避免全屏限高裁切选项 */
export function SherlockOptionList({
  optionItems,
  disabled,
  onPick,
  className,
  scrollClassName,
  /** 与战斗仪表一致：本次点选预计扣「上限」的约百分之几（1–3），用于角标 */
  apBurnPreviewPercent,
}: {
  optionItems: OptionItem[];
  disabled?: boolean;
  onPick: (text: string) => void;
  className?: string;
  scrollClassName?: string;
  apBurnPreviewPercent?: number;
}) {
  const list = optionItems.slice(0, 4);
  if (list.length === 0) return null;
  const gridClass =
    list.length === 3 ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 gap-4 sm:grid-cols-2';

  return (
    <div className={cn('min-h-0 min-w-0 flex-1 overflow-hidden', className)}>
      <p className="mb-2 px-0.5 text-[10px] leading-relaxed text-sherlock-text-muted">
        角标表示：若上一段末尾已落下雾巷裁定，点下去可能会削短行动余地；裁定未亮时，点选项不耗气力。
      </p>
      <div
        className={cn(
          'sherlock-scroll-y-invisible max-h-[min(58dvh,520px)] min-h-0 pr-0.5',
          scrollClassName,
        )}
      >
        <div className={gridClass}>
          {list.map((item, i) => (
            <OptionCard
              key={`${item.id}-${item.text}-${i}`}
              index={i}
              text={item.text}
              apCost={item.apCost}
              apBurnPreviewPercent={apBurnPreviewPercent}
              variant={VARIANTS[i % VARIANTS.length]}
              disabled={disabled}
              onPick={() => onPick(item.text)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function OptionCard({
  index,
  text,
  apCost,
  apBurnPreviewPercent,
  variant,
  disabled,
  onPick,
}: {
  index: number;
  text: string;
  apCost: number;
  /** 若给出则优先显示「余地≈n%」，与战斗仪表扣减一致 */
  apBurnPreviewPercent?: number;
  variant: Variant;
  disabled?: boolean;
  onPick: () => void;
}) {
  const label = String.fromCharCode(65 + index);
  const preview = apBurnPreviewPercent;
  const costBadgeClass =
    preview != null
      ? preview <= 1
        ? 'border-emerald-500/40 bg-emerald-950/25 text-emerald-200/95'
        : preview >= 3
          ? 'border-rose-500/45 bg-rose-950/30 text-rose-200/95'
          : 'border-amber-500/40 bg-amber-950/20 text-amber-200/90'
      : apCost <= 0
        ? 'border-emerald-500/40 bg-emerald-950/25 text-emerald-200/95'
        : apCost >= 4
          ? 'border-rose-500/45 bg-rose-950/30 text-rose-200/95'
          : 'border-amber-500/40 bg-amber-950/20 text-amber-200/90';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      style={{ animationDelay: `${index * 85}ms` }}
      className={cn(
        'sherlock-option-card group relative overflow-hidden rounded-xl border px-4 py-3.5 text-left text-sm transition-all duration-300',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sherlock-gold/50',
        variantClass[variant],
        disabled && 'pointer-events-none opacity-45',
      )}
    >
      <span
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/5 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      <div className="relative flex gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-xs font-bold tabular-nums text-sherlock-gold/90">
          {label}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                costBadgeClass,
              )}
            >
              {preview != null ? `余地约 ${preview}%` : `余力 ${apCost}`}
            </span>
            {preview != null ? (
              <span className="text-[10px] text-sherlock-text-muted">裁定亮时单次至多约百分之三</span>
            ) : apCost <= 0 ? (
              <span className="text-[10px] text-sherlock-text-muted">缓进，省余力</span>
            ) : null}
          </div>
          <span className="block leading-snug whitespace-pre-wrap">{text}</span>
        </div>
      </div>
      <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-sherlock-text-muted opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        选择
      </span>
    </button>
  );
}

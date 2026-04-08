import { Fingerprint, Heart, MessageSquareWarning, Scale, Shield, Zap } from 'lucide-react';
import type { ComponentType } from 'react';
import { memo } from 'react';
import {
  apStressBarFillClass,
  apStressBarTrackClass,
  apStressPercentTextClass,
  apStressZapClass,
  getApStressTier,
} from '../lib/apStressVisual';
import {
  getHpStressTier,
  hpHeartIconClass,
  hpMiniBarFillClass,
  hpMiniBarTrackClass,
  hpMistShellClass,
  hpPercentTextClass,
} from '../lib/hpStressVisual';
import { HUD_HINTS, type HudHintId } from '../lib/gameWorldGuide';
import { SHERLOCK_LOW_AP_PERCENT_THRESHOLD } from '../lib/gameBalanceConstants';
import { clampPct } from '../utils/sherlockStatModel';
import { cn } from '../lib/utils';
import { HudHintButton } from './HudStatHelp';

/** 侧栏收束按钮内：生机霓虹方框（置于行动余地闪电左侧） */
export const HpHudGlyph = memo(function HpHudGlyph({ hp, hpMax }: { hp: number; hpMax: number }) {
  const ratio = hpMax > 0 ? hp / hpMax : 0;
  const pct = Math.round(clampPct(ratio * 100));
  const tier = getHpStressTier(pct);
  const title =
    pct <= 10
      ? `生机将熄（${pct}%）——再受创便可能倒地不起。`
      : `血脉余焰约 ${pct}%：雾巷里每一滴血都有价。`;
  return (
    <div
      className={cn(
        'relative flex h-9 w-[2.35rem] shrink-0 flex-col items-center justify-center gap-0 rounded-xl border bg-black/40 px-0.5',
        hpMistShellClass(tier),
      )}
      title={title}
      aria-label={`生机约 ${pct}%`}
    >
      <Heart className={cn('h-3 w-3 shrink-0', hpHeartIconClass(tier))} aria-hidden />
      <span className={cn('text-[8px] font-semibold tabular-nums leading-none', hpPercentTextClass(tier))}>
        {pct}%
      </span>
    </div>
  );
});

/** 浮窗 HUD：生机条（窄列，与行动余地并排） */
export const HpCompact = memo(function HpCompact({
  hp,
  hpMax,
  hint,
  onHintToggle,
}: {
  hp: number;
  hpMax: number;
  hint: HudHintId | null;
  onHintToggle: (id: HudHintId) => void;
}) {
  const max = Math.max(1, hpMax);
  const cur = Math.min(Math.max(0, hp), max);
  const pct = Math.round(clampPct((cur / max) * 100));
  const tier = getHpStressTier(pct);
  return (
    <section
      className={cn(
        'flex w-21 shrink-0 flex-col gap-1 rounded-xl border border-white/10 bg-black/30 px-2 py-1.5',
        tier === 'tense' || tier === 'critical' ? 'sherlock-hp-compact--stress' : '',
      )}
      aria-label="生机"
    >
      <div className="flex items-center justify-between gap-0.5">
        <div className="flex min-w-0 items-center gap-0.5">
          <HudHintButton id="hp" activeId={hint} onToggle={onHintToggle} />
          <Heart className={cn('h-2.5 w-2.5 shrink-0', hpHeartIconClass(tier))} aria-hidden />
        </div>
        <span className={cn('shrink-0 text-[10px] tabular-nums', hpPercentTextClass(tier))}>{pct}%</span>
      </div>
      <p className="pl-5 text-[8px] tracking-wide text-sherlock-text-muted">生机</p>
      <div className={cn(hpMiniBarTrackClass(tier), 'h-1.5')} role="img" aria-label={`生机约 ${pct}%`}>
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', hpMiniBarFillClass(tier))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
});

/** 顶栏右侧：行动余地按占比变色；低档位更醒目。储备雾条不变。 */
export const ApCompact = memo(function ApCompact({
  ap,
  apMax,
  apReserve,
  hint,
  onHintToggle,
}: {
  ap: number;
  apMax: number;
  /** `玩家状态.AP储备`：剧情奖励的可视化雾条（相对 AP 上限换算百分比） */
  apReserve?: number;
  hint: HudHintId | null;
  onHintToggle: (id: HudHintId) => void;
}) {
  const apRatio = apMax > 0 ? ap / apMax : 0;
  const pct = Math.round(clampPct(apRatio * 100));
  const tier = getApStressTier(pct);
  const reserveN = apReserve != null && apReserve > 0 ? apReserve : 0;
  const reservePct = Math.round(clampPct(apMax > 0 ? (reserveN / apMax) * 100 : 0));
  const title =
    pct <= SHERLOCK_LOW_AP_PERCENT_THRESHOLD
      ? `余地告急（${pct}%）——能省则省，留一手给终局。`
      : `行动余地 ${pct}%（相对案卷中的气力上限）；愈薄愈要斟酌下一步。`;

  return (
    <section
      className={cn(
        'w-full',
        (tier === 'tense' || tier === 'critical') && 'sherlock-ap-compact--stress',
      )}
      aria-label="行动余地"
      title={title}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <HudHintButton id="ap" activeId={hint} onToggle={onHintToggle} />
          <Zap className={cn('h-3 w-3 shrink-0', apStressZapClass(tier))} aria-hidden />
          <span className="truncate text-[10px] text-sherlock-text-muted">行动余地</span>
        </div>
        <span
          className={cn('shrink-0 text-[11px] tabular-nums sm:text-xs', apStressPercentTextClass(tier))}
        >
          {pct}%
        </span>
      </div>
      <div
        className={cn(apStressBarTrackClass(tier), 'h-2')}
        role="img"
        aria-label={`行动余地约 ${pct}%`}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', apStressBarFillClass(tier))}
          style={{ width: `${pct}%` }}
        />
      </div>
      {reserveN > 0 ? (
        <div className="mt-1.5 space-y-0.5">
          <div className="flex items-center justify-between gap-2 text-[9px] text-sherlock-text-muted">
            <span className="truncate">余力储备</span>
            <span className="shrink-0 tabular-nums text-sky-300/90">{reservePct}%</span>
          </div>
          <div
            className="relative h-1.5 w-full overflow-hidden rounded-full border border-sky-500/20 bg-black/60 shadow-[inset_0_0_10px_rgba(34,211,238,0.06)]"
            role="img"
            aria-label={`余力储备约 ${reservePct}%`}
          >
            <div
              className="sherlock-ap-reserve-mist h-full rounded-full bg-linear-to-r from-sky-600/25 via-cyan-400/40 to-sky-300/35 shadow-[0_0_12px_rgba(34,211,238,0.18)] transition-[width] duration-500"
              style={{ width: `${reservePct}%` }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
});

export const QuickStat = memo(function QuickStat({
  id,
  icon: Icon,
  label,
  short,
  value,
  color,
  barColor,
  hint,
  onHintToggle,
}: {
  id: HudHintId;
  icon: ComponentType<{ className?: string }>;
  label: string;
  short: string;
  value: number;
  color: string;
  barColor: string;
  hint: HudHintId | null;
  onHintToggle: (id: HudHintId) => void;
}) {
  const v = clampPct(value);
  return (
    <div className="group flex min-w-0 flex-col gap-0.5">
      <div className="flex items-center justify-between gap-0.5">
        <div className="flex min-w-0 items-center gap-0.5">
          <HudHintButton id={id} activeId={hint} onToggle={onHintToggle} />
          <Icon className={cn('h-2.5 w-2.5 shrink-0', color)} />
          <span className="truncate text-[9px] text-sherlock-text-secondary sm:text-[10px]">{label}</span>
        </div>
        <span className={cn('shrink-0 text-[9px] tabular-nums sm:text-[10px]', color)}>{v}%</span>
      </div>
      <div className="sherlock-quick-stat-bar h-1 w-full overflow-hidden rounded-full border border-white/5 bg-black/50">
        <div className={cn('h-full transition-[width] duration-500', barColor)} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
});

export const RuleSlider = memo(function RuleSlider({
  id,
  icon: Icon,
  label,
  short,
  value,
  type,
  hint,
  onHintToggle,
}: {
  id: HudHintId;
  icon: ComponentType<{ className?: string }>;
  label: string;
  short: string;
  value: number;
  type: 'danger' | 'safe';
  hint: HudHintId | null;
  onHintToggle: (id: HudHintId) => void;
}) {
  const color = type === 'danger' ? 'bg-sherlock-red' : 'bg-sherlock-green';
  const glow =
    type === 'danger'
      ? 'shadow-[0_0_6px_rgba(74,14,23,0.45)]'
      : 'shadow-[0_0_6px_rgba(15,46,38,0.4)]';
  const v = clampPct(value);
  const trackClass =
    type === 'danger'
      ? 'border-sherlock-red/25 shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]'
      : 'border-sherlock-green/25 shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]';

  return (
    <div className="group flex min-w-0 flex-col gap-0.5">
      <div className="flex items-center justify-between gap-0.5">
        <div className="flex min-w-0 items-center gap-0.5">
          <HudHintButton id={id} activeId={hint} onToggle={onHintToggle} />
          <Icon
            className={cn(
              'h-2.5 w-2.5 shrink-0 opacity-90',
              type === 'danger' ? 'text-sherlock-red' : 'text-sherlock-green',
            )}
          />
          <span className="truncate text-[9px] text-sherlock-text-secondary sm:text-[10px]">{label}</span>
        </div>
        <span
          className={cn(
            'shrink-0 text-[9px] tabular-nums sm:text-[10px]',
            type === 'danger' ? 'text-sherlock-red' : 'text-sherlock-green',
          )}
        >
          {v}%
        </span>
      </div>
      <div className="relative flex h-1.5 w-full items-center">
        <div
          className={cn(
            'absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full border bg-black/50',
            trackClass,
          )}
        >
          <div className={cn('h-full rounded-full transition-[width] duration-300', color, glow)} style={{ width: `${v}%` }} />
        </div>
        <div
          className={cn(
            'pointer-events-none absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full border border-white/70',
            color,
          )}
          style={{ left: `clamp(0px, calc(${v}% - 3px), calc(100% - 6px))` }}
        />
      </div>
    </div>
  );
});

export const HUD_QUICK_GRID = {
  clue: { icon: Fingerprint, label: '线索权重', short: HUD_HINTS.clue.short, color: 'text-sherlock-blue', bar: 'bg-sherlock-blue' },
  voice: {
    icon: MessageSquareWarning,
    label: '警队话语权',
    short: HUD_HINTS.voice.short,
    color: 'text-sherlock-red',
    bar: 'bg-sherlock-red',
  },
} as const;

export const HUD_RULE_GRID = {
  law: { icon: Scale, label: '执法边界', short: HUD_HINTS.law.short, type: 'danger' as const },
  info: { icon: Shield, label: '信息管控', short: HUD_HINTS.info.short, type: 'safe' as const },
} as const;

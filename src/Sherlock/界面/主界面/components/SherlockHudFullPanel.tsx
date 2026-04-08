import { Activity, Clock, EyeOff, Handshake, Shield } from 'lucide-react';
import { type ComponentType, useCallback, useState, memo } from 'react';
import { type HudHintId } from '../lib/gameWorldGuide';
import { useSherlockStats } from '../context/SherlockStatContext';
import { clampPct } from '../utils/sherlockStatModel';
import { cn } from '../lib/utils';
import { HudHintButton, HudHintPanel } from './HudStatHelp';
import { ApCompact, HpCompact, HUD_QUICK_GRID, HUD_RULE_GRID, QuickStat, RuleSlider } from './hudWidgets';

/**
 * 顶栏完整 HUD：时间/节点、棋局·安保·隐蔽·信任、AP、四维。
 * 仅通过侧栏「行动余量」按钮打开的浮窗内使用（与是否全屏无关）。
 */
export const SherlockHudFullPanel = memo(function SherlockHudFullPanel({
  className,
  dense,
}: {
  className?: string;
  /** 浮窗内略收紧间距 */
  dense?: boolean;
}) {
  const { stats } = useSherlockStats();
  const { world, faction, player } = stats;
  const trust = clampPct(faction.trustTotal);
  const chess = clampPct(faction.macro.chessControl);
  const security = clampPct(faction.macro.securityLevel);
  const stealth = clampPct(faction.macro.stealth);
  const clue = clampPct(faction.clueWeight);
  const voice = clampPct(faction.policeVoice);
  const apMax = Math.max(1, player.apMax);
  const ap = Math.min(Math.max(0, player.ap), apMax);
  const hpMax = Math.max(1, player.hpMax);
  const hp = Math.min(Math.max(0, player.hp), hpMax);
  const apReserve = player.apReserve;

  const [hint, setHint] = useState<HudHintId | null>(null);
  const toggleHint = useCallback((id: HudHintId) => {
    setHint(h => (h === id ? null : id));
  }, []);

  return (
    <>
      <div
        className={cn(
          'sherlock-hud-full-panel grid min-w-0 grid-cols-1 gap-2 min-[640px]:grid-cols-[1fr_minmax(16rem,22rem)] min-[640px]:items-start min-[640px]:gap-3 xl:gap-4',
          dense && 'min-[640px]:gap-2',
          className,
        )}
      >
        <div
          className={cn(
            'sherlock-topbar-left flex min-w-0 flex-col gap-2 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 sm:px-3 sm:py-2.5',
            dense && 'gap-1.5 py-1.5 sm:py-2',
          )}
        >
          <div className="min-w-0 text-[11px] text-sherlock-gold sm:text-xs">
            <div className="flex min-w-0 items-center gap-2 tracking-wider">
              <Clock className="h-4 w-4 shrink-0 text-sherlock-gold/90" />
              <span className="min-w-0 whitespace-nowrap">
                <span className="text-sherlock-text-muted">剧情时间</span>{' '}
                <span className="text-sherlock-text-primary">
                  {world.date} {world.time}
                </span>
              </span>
            </div>
            <p className="sherlock-world-sub mt-1 max-w-[min(100%,42rem)] pl-6 text-[10px] leading-snug text-sherlock-text-muted sm:text-[11px]">
              节点：
              <span className="text-sherlock-text-secondary">{world.timelineNode}</span>
              {world.sceneAnchor ? (
                <>
                  <span className="text-sherlock-text-muted"> · </span>
                  <span className="text-sherlock-gold/90">{world.sceneAnchor}</span>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-white/8 pt-2 sm:gap-x-3">
            <CompactGauge
              id="chess"
              icon={Activity}
              label="棋局"
              value={chess}
              color="text-sherlock-gold"
              barColor="bg-sherlock-gold"
              hint={hint}
              onHintToggle={toggleHint}
            />
            <CompactGauge
              id="security"
              icon={Shield}
              label="安保"
              value={security}
              color="text-sherlock-green"
              barColor="bg-sherlock-green"
              hint={hint}
              onHintToggle={toggleHint}
            />
            <CompactGauge
              id="stealth"
              icon={EyeOff}
              label="隐蔽"
              value={stealth}
              color="text-sherlock-red"
              barColor="bg-sherlock-red"
              hint={hint}
              onHintToggle={toggleHint}
            />
            <CompactGauge
              id="trust"
              icon={Handshake}
              label="信任"
              value={trust}
              color="text-sherlock-blue"
              barColor="bg-sherlock-blue"
              hint={hint}
              onHintToggle={toggleHint}
            />
          </div>
        </div>

        <div
          className={cn(
            'sherlock-topbar-right-hud flex min-h-0 w-full min-w-0 shrink-0 flex-col gap-2 rounded-xl border border-sherlock-gold/25 bg-black/35 p-2 shadow-[inset_0_0_32px_rgba(184,134,11,0.06)]',
            'min-[640px]:max-w-none min-[640px]:justify-start',
            dense && 'gap-1.5 p-1.5 sm:p-2',
          )}
        >
          <div className="flex min-w-0 items-stretch gap-2">
            <HpCompact hp={hp} hpMax={hpMax} hint={hint} onHintToggle={toggleHint} />
            <div className="min-w-0 flex-1">
              <ApCompact ap={ap} apMax={apMax} apReserve={apReserve} hint={hint} onHintToggle={toggleHint} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-2">
            <QuickStat
              id="clue"
              icon={HUD_QUICK_GRID.clue.icon}
              label={HUD_QUICK_GRID.clue.label}
              short={HUD_QUICK_GRID.clue.short}
              value={clue}
              color={HUD_QUICK_GRID.clue.color}
              barColor={HUD_QUICK_GRID.clue.bar}
              hint={hint}
              onHintToggle={toggleHint}
            />
            <QuickStat
              id="voice"
              icon={HUD_QUICK_GRID.voice.icon}
              label={HUD_QUICK_GRID.voice.label}
              short={HUD_QUICK_GRID.voice.short}
              value={voice}
              color={HUD_QUICK_GRID.voice.color}
              barColor={HUD_QUICK_GRID.voice.bar}
              hint={hint}
              onHintToggle={toggleHint}
            />
            <RuleSlider
              id="law"
              icon={HUD_RULE_GRID.law.icon}
              label={HUD_RULE_GRID.law.label}
              short={HUD_RULE_GRID.law.short}
              value={clampPct(faction.rules.lawBoundary)}
              type={HUD_RULE_GRID.law.type}
              hint={hint}
              onHintToggle={toggleHint}
            />
            <RuleSlider
              id="info"
              icon={HUD_RULE_GRID.info.icon}
              label={HUD_RULE_GRID.info.label}
              short={HUD_RULE_GRID.info.short}
              value={clampPct(faction.rules.infoControl)}
              type={HUD_RULE_GRID.info.type}
              hint={hint}
              onHintToggle={toggleHint}
            />
          </div>
        </div>
      </div>

      <HudHintPanel activeId={hint} onClose={() => setHint(null)} variant="gold" />
    </>
  );
});

const CompactGauge = memo(function CompactGauge({
  id,
  icon: Icon,
  label,
  value,
  color,
  barColor,
  hint,
  onHintToggle,
}: {
  id: HudHintId;
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
  barColor: string;
  hint: HudHintId | null;
  onHintToggle: (id: HudHintId) => void;
}) {
  const v = clampPct(value);
  return (
    <div className="group flex min-w-0 items-center gap-1">
      <HudHintButton id={id} activeId={hint} onToggle={onHintToggle} />
      <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="whitespace-nowrap text-[9px] text-sherlock-text-muted">{label}</span>
          <span className={cn('text-[10px] tabular-nums', color)}>{v}%</span>
        </div>
        <div className="h-1 w-18 overflow-hidden rounded-full bg-black/50 sm:w-22">
          <div className={cn('h-full rounded-full transition-[width] duration-300', barColor)} style={{ width: `${v}%` }} />
        </div>
      </div>
    </div>
  );
});

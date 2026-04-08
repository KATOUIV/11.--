import { createPortal } from 'react-dom';
import { useState } from 'react';
import {
  Crosshair,
  Dices,
  Flag,
  Gauge,
  Info,
  Radio,
  Shield,
  Skull,
  Sparkles,
  Swords,
  X,
  Zap,
} from 'lucide-react';
import { BATTLE_TAG_NAMES, parseRollParts } from '../lib/battleProtocolParser';
import { BATTLE_TAG_PLAYER_HELP, FOG_GAMBIT_PLAYER_INTRO, ROLL_FIELD_HELP } from '../lib/gameWorldGuide';
import { useBattleProtocol } from '../context/BattleProtocolContext';
import { cn } from '../lib/utils';
import { getSherlockPortalRoot } from '../utils/sherlockPortalRoot';
import { FogBattlePlaybookSection, RollFieldCell } from './FogBattlePlaybook';

const TAG_LABEL: Record<string, string> = {
  BATTLE_START: '开局',
  STATUS: '态势',
  ROLL: '检定',
  CHANGE: '变动',
  ROUND_END: '回合收束',
  BATTLE_END: '终局',
  INIT: '先攻序',
  ENCOUNTER: '遭遇',
  SKILL: '技艺',
  ITEM: '证物/道具',
  BUFF: '状态',
  CRIT: '极运',
  SYNC: '同步',
  DYING: '濒危',
  EXP: '阅历',
};

function tagIcon(tag: string) {
  switch (tag) {
    case 'ROLL':
      return Dices;
    case 'BATTLE_START':
    case 'ENCOUNTER':
      return Swords;
    case 'STATUS':
    case 'SYNC':
      return Gauge;
    case 'BATTLE_END':
    case 'ROUND_END':
      return Flag;
    case 'CRIT':
      return Sparkles;
    case 'DYING':
      return Skull;
    default:
      return Zap;
  }
}

export function FogBattlePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { parsed, heuristicOnly } = useBattleProtocol();
  const known = parsed.lines.filter(l => BATTLE_TAG_NAMES.has(l.tag));

  const [rollHint, setRollHint] = useState<{ line: number; field: number } | null>(null);
  const [tagHelpLine, setTagHelpLine] = useState<number | null>(null);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-10050 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fog-battle-title"
    >
      <button type="button" className="fog-gambit-backdrop absolute inset-0" aria-label="关闭" onClick={onClose} />

      <div
        className={cn(
          'fog-gambit-shell fog-gambit-modal-in relative max-h-[min(90vh,800px)] w-full max-w-lg overflow-hidden rounded-2xl',
          'bg-[#04080f]/97',
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="fog-gambit-grid-move" aria-hidden />
        <div className="fog-gambit-scan-sweep" aria-hidden />
        <div className="fog-gambit-vignette" aria-hidden />
        <span className="fog-gambit-corner fog-gambit-corner-tl" aria-hidden />
        <span className="fog-gambit-corner fog-gambit-corner-tr" aria-hidden />
        <span className="fog-gambit-corner fog-gambit-corner-bl" aria-hidden />
        <span className="fog-gambit-corner fog-gambit-corner-br" aria-hidden />

        <div className="relative z-10 flex max-h-[min(90vh,800px)] flex-col">
          <div className="relative overflow-hidden border-b border-cyan-400/20 bg-linear-to-r from-black/80 via-cyan-950/25 to-black/80 px-4 py-4 sm:px-5">
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl" />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 gap-y-2">
                  <p className="fog-gambit-title-sub text-[9px] font-semibold sm:text-[10px]">雾巷投影</p>
                  <span className="fog-gambit-badge-pulse rounded border border-cyan-400/35 bg-black/50 px-2 py-0.5 text-[9px] tracking-wide text-cyan-200/95 sm:text-[10px]">
                    战术层
                  </span>
                  <div className="fog-gambit-signal-bar opacity-90" title="案卷脉动">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <h2 id="fog-battle-title" className="fog-gambit-title-zh mt-2 font-serif text-xl font-bold tracking-[0.2em] text-sherlock-gold sm:text-2xl">
                  雾巷博弈
                </h2>
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] leading-relaxed text-slate-400">
                  <Radio className="h-3 w-3 shrink-0 text-cyan-400/80" />
                  <span>本层是运气与对抗在雾里的投影——与正文同案，不同视角。</span>
                </p>
                {parsed.roundHint ? (
                  <p className="mt-2 inline-flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-black/40 px-2.5 py-1 text-xs text-cyan-100/95">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.55)]" />
                    回合 {parsed.roundHint}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                className="group shrink-0 rounded-xl border border-white/10 bg-black/60 p-2.5 text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-rose-500/40 hover:bg-rose-950/30 hover:text-rose-200 hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]"
                aria-label="关闭"
                onClick={onClose}
              >
                <X className="h-5 w-5 transition group-hover:rotate-90" />
              </button>
            </div>
          </div>

          <div className="sherlock-scroll-y-invisible relative max-h-[min(58vh,540px)] flex-1 px-4 py-3 sm:px-5">
            <FogBattlePlaybookSection />

            {known.length === 0 ? (
              <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-linear-to-b from-black/50 to-cyan-950/20 px-4 py-10 text-center shadow-[inset_0_0_40px_rgba(34,211,238,0.04)]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(34,211,238,0.08),transparent_55%)]" />
                <div className="fog-gambit-empty-radar relative z-1">
                  <Crosshair className="absolute left-1/2 top-1/2 z-1 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-cyan-400/70 drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
                </div>
                <p className="relative z-1 mt-5 text-sm font-medium text-slate-200">
                  {heuristicOnly ? '风里已有刀光，灯还没记下这一掷' : '战术层尚在沉睡'}
                </p>
                <p className="relative z-1 mt-2 text-xs leading-relaxed text-cyan-400/85">
                  {heuristicOnly ? FOG_GAMBIT_PLAYER_INTRO.troubleshooting : '等故事里骰子离手、门锁作响，卷末落下裁定时，这里自会亮起。'}
                </p>
                {heuristicOnly ? (
                  <div className="relative z-1 mt-5 rounded-xl border border-amber-400/25 bg-linear-to-br from-amber-950/40 to-black/50 p-4 text-left shadow-[0_0_24px_rgba(245,158,11,0.08)]">
                    <p className="text-[11px] leading-relaxed text-amber-50/95">
                      若此刻该掷骰定夺，请把裁定写在<strong className="text-amber-200">正文之后的单独一行</strong>
                      ，勿夹在段落里。那一行落下后，你再选分支，侧栏<strong className="text-amber-200">行动余地</strong>才会短一截；灯未亮时，发送与选项都不耗它。
                    </p>
                    <p className="mt-3 text-[10px] leading-relaxed text-amber-200/75">
                      下面两句只是样子，案情不同措辞会变；记清：谁、对谁、运气偏哪边。
                    </p>
                    <div className="mt-3 space-y-2 rounded-lg border border-white/5 bg-black/45 p-3 text-[10px] leading-relaxed text-emerald-100/90 shadow-[inset_0_0_20px_rgba(16,185,129,0.06)]">
                      <p className="text-cyan-300/80">推定：调查员对嫌疑人，17 对 16，倾向有罪</p>
                      <p className="text-fuchsia-300/80">破坏：调查员对挂锁，14 对 15，锁未开</p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {known.map((line, i) => {
                  const Icon = tagIcon(line.tag);
                  const label = TAG_LABEL[line.tag] ?? line.tag;
                  const isRoll = line.tag === 'ROLL';
                  const parts = isRoll ? parseRollParts(line.body) : [];
                  const tagHelp = BATTLE_TAG_PLAYER_HELP[line.tag];
                  return (
                    <li
                      key={`${line.tag}-${i}`}
                      className={cn(
                        'fog-gambit-protocol-card group rounded-xl border px-3.5 py-3 backdrop-blur-sm transition duration-300',
                        isRoll
                          ? 'fog-gambit-roll-card border-fuchsia-500/30'
                          : 'border-cyan-500/25 bg-black/45 shadow-[inset_0_0_28px_rgba(34,211,238,0.05)] hover:border-cyan-400/40 hover:shadow-[0_0_24px_rgba(34,211,238,0.1)]',
                      )}
                    >
                      <div className="mb-2 flex items-start gap-2.5">
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-lg transition group-hover:scale-[1.02]',
                            isRoll
                              ? 'border-fuchsia-400/40 bg-linear-to-br from-fuchsia-950/80 to-cyan-950/50 text-fuchsia-100 shadow-fuchsia-500/20'
                              : 'border-cyan-500/35 bg-linear-to-br from-cyan-950/70 to-black/60 text-cyan-100 shadow-cyan-500/15',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-serif text-sm font-semibold tracking-wide text-slate-100">{label}</span>
                            {isRoll ? (
                              <span className="inline-block rounded border border-fuchsia-500/25 bg-fuchsia-950/30 px-1.5 py-0.5 text-[9px] tracking-wide text-fuchsia-200/90">
                                命运检定
                              </span>
                            ) : null}
                            {tagHelp ? (
                              <button
                                type="button"
                                onClick={() => setTagHelpLine(tagHelpLine === i ? null : i)}
                                className={cn(
                                  'inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[9px] transition',
                                  tagHelpLine === i
                                    ? 'border-cyan-400/50 bg-cyan-950/40 text-cyan-100'
                                    : 'border-white/10 bg-black/40 text-slate-500 hover:border-cyan-500/30 hover:text-cyan-200',
                                )}
                              >
                                <Info className="h-3 w-3" />
                                说明
                              </button>
                            ) : null}
                          </div>
                          {!isRoll && tagHelpLine === i && tagHelp ? (
                            <p className="mt-2 rounded-lg border border-cyan-500/20 bg-black/55 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
                              {tagHelp}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {isRoll && parts.length > 0 ? (
                        <>
                          <p className="mb-2 text-[10px] text-slate-500">点格子查看含义（与逗号分段一一对应）</p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {parts.map((p, j) => (
                              <RollFieldCell
                                key={j}
                                index={j}
                                value={p}
                                active={rollHint?.line === i && rollHint?.field === j}
                                onToggle={() => {
                                  setRollHint(
                                    rollHint?.line === i && rollHint?.field === j ? null : { line: i, field: j },
                                  );
                                  setTagHelpLine(null);
                                }}
                              />
                            ))}
                          </div>
                          {rollHint?.line === i && rollHint.field !== undefined ? (
                            <p className="mt-3 rounded-lg border border-fuchsia-500/25 bg-black/55 p-3 text-[11px] leading-relaxed text-slate-300 shadow-[inset_0_0_20px_rgba(217,70,239,0.06)]">
                              {ROLL_FIELD_HELP[rollHint.field] ?? '该段为扩展字段，具体以当段故事为准。'}
                            </p>
                          ) : null}
                        </>
                      ) : !isRoll ? (
                        <p className="wrap-break-word text-[11px] leading-relaxed text-slate-400">{line.body}</p>
                      ) : (
                        <p className="text-[11px] text-slate-500">本条检定暂无分段，全文如下：{line.body}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="relative border-t border-cyan-500/20 bg-linear-to-r from-black/90 via-slate-950/90 to-black/90 px-4 py-3 sm:px-5">
            <div className="flex flex-col items-center gap-1.5 text-center sm:flex-row sm:justify-center sm:gap-2">
              <Shield className="h-3.5 w-3.5 shrink-0 text-sherlock-gold/75 drop-shadow-[0_0_8px_rgba(184,134,11,0.4)]" />
              <p className="text-[10px] leading-relaxed text-slate-500">
                你读到的故事永远是第一位；这里是第二位的「战术投影」，方便复盘与状态同步。
                <span className="text-slate-600"> · </span>
                <span className="text-cyan-700/90">雾都 · 1895</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    getSherlockPortalRoot(),
  );
}

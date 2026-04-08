import { gsap } from 'gsap';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { parseCombatPayloadFromAssistantMessage, type CombatPayload } from '../../../../util/combatHudParse';

export type { CombatActor, CombatPayload, CombatPhase, LastRoll } from '../../../../util/combatHudParse';

declare function getLastMessageId(): number;
declare function getChatMessages(
  range: number,
  opt?: { role?: 'all' | 'assistant' | 'user' | 'system' },
): { message_id: number; message: string; role: string }[];

const PHASE_LABEL: Record<string, string> = {
  idle: '待机',
  encounter: '遇敌',
  initiative: '先攻',
  status: '状态面板',
  check: '检定',
  round_end: '轮末结算',
  battle_end: '战斗结束',
};

const GRADE_LABEL: Record<string, string> = {
  crit_success: '大成功',
  success: '成功',
  fail: '失败',
  crit_fail: '大失败',
};

type PipTab = 'stat' | 'combat' | 'roster';

function gradeColor(g?: string): string {
  switch (g) {
    case 'crit_success':
      return '#ffd54f';
    case 'success':
      return '#81c784';
    case 'fail':
      return '#90a4ae';
    case 'crit_fail':
      return '#e57373';
    default:
      return 'rgba(255,181,71,0.85)';
  }
}

function scanLatestCombatPayload(maxScan = 32): CombatPayload | null {
  if (typeof getLastMessageId !== 'function' || typeof getChatMessages !== 'function') return null;
  const last = getLastMessageId();
  if (last < 0) return null;
  const start = Math.max(0, last - maxScan);
  for (let id = last; id >= start; id--) {
    const msgs = getChatMessages(id, { role: 'assistant' });
    if (!msgs.length) continue;
    const p = parseCombatPayloadFromAssistantMessage(msgs[0].message);
    if (p) return p;
  }
  return null;
}

/** 解析助手消息中的 `[VAULT_COMBAT]` 行或 `COMBAT_JSON:`，Pip-Boy 风格三页签 */
export function CombatHudPanel() {
  const tavernOk = typeof getChatMessages === 'function';
  const [payload, setPayload] = useState<CombatPayload | null>(null);
  const [tick, setTick] = useState(0);
  const [pipTab, setPipTab] = useState<PipTab>('stat');
  const rollCardRef = useRef<HTMLDivElement>(null);
  const diceRef = useRef<HTMLDivElement>(null);
  const tabPanelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    setPayload(scanLatestCombatPayload());
  }, []);

  useEffect(() => {
    if (!tavernOk) return;
    refresh();
    const offU =
      typeof eventOn === 'function'
        ? eventOn(tavern_events.MESSAGE_UPDATED, () => {
            refresh();
            setTick(t => t + 1);
          })
        : null;
    const offR =
      typeof eventOn === 'function'
        ? eventOn(tavern_events.MESSAGE_RECEIVED, () => {
            refresh();
            setTick(t => t + 1);
          })
        : null;
    const offC =
      typeof eventOn === 'function'
        ? eventOn(tavern_events.CHAT_CHANGED, () => {
            refresh();
            setTick(t => t + 1);
          })
        : null;
    return () => {
      offU?.stop();
      offR?.stop();
      offC?.stop();
    };
  }, [tavernOk, refresh]);

  useLayoutEffect(() => {
    const card = rollCardRef.current;
    const dice = diceRef.current;
    if (!card) return;
    gsap.fromTo(
      card,
      { opacity: 0, y: 14, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power3.out' },
    );
    if (dice && payload?.lastRoll) {
      gsap.fromTo(
        dice,
        { rotationX: -40, scale: 0.6 },
        { rotationX: 0, scale: 1, duration: 0.55, ease: 'back.out(1.4)' },
      );
    }
  }, [payload?.lastRoll?.total, payload?.lastRoll?.title, tick]);

  useLayoutEffect(() => {
    const el = tabPanelRef.current;
    if (!el) return;
    gsap.fromTo(el, { opacity: 0.65 }, { opacity: 1, duration: 0.28, ease: 'power2.out' });
  }, [pipTab, tick]);

  if (!tavernOk) {
    return (
      <div className="vault-combat-shell h-full w-full p-4 text-[0.9em] leading-relaxed">
        <p className="font-bold text-vault-amber">战斗 HUD</p>
        <p className="opacity-80 mt-2">
          未检测到酒馆助手聊天 API。请通过正则注入本 Vault 界面（与 &lt;VaultStatus/&gt; 同源），勿使用跨域 iframe。
        </p>
      </div>
    );
  }

  const phase = payload?.phase ? String(payload.phase) : 'idle';
  const actors = payload?.actors ?? [];
  const lr = payload?.lastRoll;

  return (
    <div className="vault-pipboy vault-combat-shell h-full w-full min-h-0 flex flex-col p-2 sm:p-2.5 box-border gap-2">
      <header className="vault-pipboy__header flex flex-col gap-2 min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between shrink-0 border-b border-[rgba(255,179,71,0.28)] pb-2">
        <div className="min-w-0">
          <h2 className="m-0 text-[0.78em] sm:text-[0.85em] tracking-[0.2em] text-vault-amber font-semibold vault-pipboy__glow">
            VAULT-TEC · COMBAT
          </h2>
          <p className="m-0 mt-0.5 text-[0.62em] sm:text-[0.65em] opacity-55 leading-snug tracking-wide">
            解析 `[VAULT_COMBAT]` 单行 或 `COMBAT_JSON:`（见世界书「战斗核心+HUD」）
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 min-[400px]:justify-end">
          {(
            [
              ['stat', 'STAT'],
              ['combat', 'COMBAT'],
              ['roster', 'ROSTER'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={[
                'vault-pipboy-tab rounded-sm px-2.5 py-2 sm:py-1.5 text-[0.68em] sm:text-[0.72em] tracking-[0.12em] min-h-10 sm:min-h-0 touch-manipulation transition-colors',
                pipTab === id ? 'vault-pipboy-tab--active' : 'opacity-75',
              ].join(' ')}
              onClick={() => setPipTab(id)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="vault-combat-btn rounded px-3 py-2 sm:px-2 sm:py-1 text-[0.72em] min-h-10 min-w-12 sm:min-h-0 sm:min-w-0 touch-manipulation ml-1"
            onClick={refresh}
          >
            刷新
          </button>
        </div>
      </header>

      <div ref={tabPanelRef} className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
        {pipTab === 'stat' && (
          <section className="vault-pipboy-panel rounded-md p-3 flex flex-col gap-3 shrink-0" aria-label="战斗状态">
            <div className="flex flex-wrap items-center gap-2 text-[0.8em]">
              <span className="vault-combat-chip rounded px-2 py-1 text-[0.74em]">
                阶段 · <strong>{PHASE_LABEL[phase] ?? phase}</strong>
              </span>
              {payload?.round != null ? (
                <span className="vault-combat-chip rounded px-2 py-1 text-[0.74em] tabular-nums">
                  ROUND {payload.round}
                </span>
              ) : null}
            </div>
            <p className="m-0 text-[0.72em] opacity-60 leading-relaxed">
              与 Pip-Boy 相同思路：用固定前缀的一行数据驱动界面，避免与正文混淆。若本页无数据，请让 AI 在回复
              <strong>末尾另起一行</strong>输出协议行。
            </p>
            <pre className="vault-pipboy-code m-0 rounded p-2 text-[0.62em] sm:text-[0.65em] overflow-auto leading-snug whitespace-pre-wrap break-all">
              {`[VAULT_COMBAT] status,2 | 马库斯,12,18,ally;哥布林,5,8,foe | 攻击|1d20+5|15|14|success|6|挥砍`}
            </pre>
          </section>
        )}

        {pipTab === 'combat' && (
          <section className="flex flex-col gap-2 min-h-0 shrink-0" aria-label="检定">
            {lr ? (
              <div
                ref={rollCardRef}
                className="vault-combat-card vault-pipboy-panel rounded-md p-3 sm:p-4 shrink-0 border-l-4"
                style={{ borderLeftColor: gradeColor(lr.grade) }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[0.88em] font-semibold opacity-95 tracking-wide">{lr.title ?? '检定'}</span>
                  <span className="text-[0.68em] opacity-45 font-mono">{lr.expr}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div
                    ref={diceRef}
                    className="text-[1.5em] sm:text-[1.75em] font-bold tabular-nums vault-pipboy__glow"
                    style={{ color: gradeColor(lr.grade) }}
                  >
                    {lr.total ?? '—'}
                  </div>
                  {lr.dc != null && (
                    <span className="text-[0.78em] opacity-75">
                      vs DC <strong>{lr.dc}</strong>
                    </span>
                  )}
                  {lr.grade && (
                    <span className="text-[0.82em] font-medium" style={{ color: gradeColor(lr.grade) }}>
                      {GRADE_LABEL[lr.grade] ?? lr.grade}
                    </span>
                  )}
                </div>
                {lr.damage != null && (
                  <p className="m-0 mt-3 text-[0.78em] opacity-90 border-t border-[rgba(255,179,71,0.2)] pt-2">
                    伤害 <span className="text-orange-300 font-semibold">{lr.damage}</span>
                    {lr.damageType ? ` · ${lr.damageType}` : ''}
                  </p>
                )}
              </div>
            ) : (
              <div className="vault-pipboy-panel rounded-md p-4 text-[0.78em] opacity-70 text-center">
                暂无检定数据。协议第三段为可选：`标题|表达式|合计|DC|等级|伤害|类型`
              </div>
            )}
          </section>
        )}

        {pipTab === 'roster' && (
          <section
            className="flex-1 min-h-0 overflow-y-auto rounded-md vault-combat-list vault-pipboy-panel p-2 space-y-2 vault-scrollbar"
            aria-label="参战者"
          >
            <h3 className="m-0 text-[0.72em] tracking-[0.15em] opacity-50 px-1">ROSTER</h3>
            {actors.length === 0 && (
              <p className="text-[0.78em] opacity-45 px-1 m-0 leading-relaxed">
                暂无单位。请在协议第二段用分号分隔多名角色：`名称,当前HP,最大HP,阵营(ally|foe)`，五字段可写
                id，七字段可写 MP。
              </p>
            )}
            {actors.map(a => {
              const pct = a.hpMax > 0 ? Math.max(0, Math.min(100, (a.hp / a.hpMax) * 100)) : 0;
              const isFoe = a.side === 'foe';
              return (
                <div
                  key={a.id || a.name}
                  className="vault-pipboy-roster-row rounded border border-[rgba(255,179,71,0.22)] bg-black/40 px-2.5 py-2"
                  style={{
                    borderLeftWidth: 3,
                    borderLeftColor: isFoe ? 'rgba(229,57,53,0.55)' : 'rgba(129,199,132,0.5)',
                  }}
                >
                  <div className="flex justify-between gap-2 text-[0.82em]">
                    <span className="font-medium truncate text-[#e8ffd9]">{a.name}</span>
                    <span className="tabular-nums shrink-0 opacity-90 text-[0.78em]">
                      HP {a.hp}/{a.hpMax}
                      {a.mp != null && a.mpMax != null ? (
                        <span className="opacity-65">
                          {' '}
                          · MP {a.mp}/{a.mpMax}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-black/60 overflow-hidden vault-pipboy-hpbar">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: `${pct}%`,
                        background: isFoe
                          ? 'linear-gradient(90deg,#b71c1c,#ff7043)'
                          : 'linear-gradient(90deg,#1b5e20,#69f0ae)',
                      }}
                    />
                  </div>
                  {a.tags && a.tags.length > 0 && (
                    <p className="m-0 mt-1 text-[0.68em] opacity-50 truncate">{a.tags.join(' · ')}</p>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}

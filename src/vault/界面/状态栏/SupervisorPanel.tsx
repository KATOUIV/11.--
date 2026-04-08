import { useMemo, useState } from 'react';

const PIPBOY_GIF_URL = 'https://pub-0f03753252fb439e966a538d805f20ef.r2.dev/docs/1768108028632.gif';

const SPECIAL_KEYS = ['S', 'P', 'E', 'C', 'I', 'A', 'L'] as const;

/** 点击字母时展示的规则说明（与变量表设计一致） */
const SPECIAL_EXPLANATIONS: Record<(typeof SPECIAL_KEYS)[number], string> = {
  S: 'S (Strength) 威慑力：用于镇压暴乱、恐吓刺客。',
  P: 'P (Perception) 洞察力：发现间谍、提前预警灾难、识破商人的谎言、察觉派系领袖的弱点。',
  E: 'E (Endurance) 抗压值：在长时间高强度工作中保持清醒。',
  C: 'C (Charisma) 统御力：说服派系领袖、招募流浪者、交易谈判。',
  I: 'I (Intelligence) 科研力：加速科技研发、修复复杂设施、破解战前密码。',
  A: 'A (Agility) 反应力：紧急事件（如火灾、入侵）的快速处理能力。',
  L: 'L (Luck) 气运：影响所有事件的检定，但是不如单项数值的鉴定加成，只能达到专项检定加值的33%。例如面对暴乱，事件判定是1d20，10点以上成功应对暴乱。6点威慑力可以在结果数值上增加3点，6点气运只能在结果加值上增加1。',
};

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function formatPrimitive(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return '—';
  return String(v);
}

type TraitEntry = { 名称?: unknown; 效果?: unknown };

export function SupervisorPanel({ raw }: { raw: unknown }) {
  const root = asRecord(raw);
  const basic = asRecord(root?.['基本信息']);
  const specialObj = asRecord(root?.['S.P.E.C.I.A.L属性']);
  const traitsRoot = asRecord(root?.['特质']);

  const [activeLetter, setActiveLetter] = useState<(typeof SPECIAL_KEYS)[number] | null>('S');

  const traitEntries = useMemo(() => {
    if (!traitsRoot) return [] as { key: string; name: string; effect: string }[];
    return Object.entries(traitsRoot)
      .filter(([k]) => k.startsWith('特质'))
      .sort(([a], [b]) => a.localeCompare(b, 'zh-CN', { numeric: true }))
      .map(([key, v]) => {
        const t = asRecord(v) as TraitEntry | null;
        return {
          key,
          name: formatPrimitive(t?.['名称']),
          effect: formatPrimitive(t?.['效果']),
        };
      });
  }, [traitsRoot]);

  if (!root) {
    return (
      <p className="text-[11px] leading-relaxed opacity-65 m-0">
        暂无「监督者系统」数据。请确认最新 assistant 楼层已写入 <code className="opacity-80">stat_data</code>。
      </p>
    );
  }

  return (
    <div className="vault-supervisor-root flex flex-col gap-4 min-h-0">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] gap-4 items-start">
        <aside className="vault-panel rounded-sm border border-vault-border/50 p-2 flex flex-col items-center gap-2 shrink-0">
          <p className="text-[10px] tracking-[0.2em] text-vault-green/80 m-0 w-full text-center border-b border-vault-border/30 pb-1.5">
            PIP-BOY · 终端
          </p>
          <img
            src={PIPBOY_GIF_URL}
            alt=""
            width={200}
            height={200}
            loading="lazy"
            decoding="async"
            className="w-full max-w-[200px] h-auto rounded-sm object-contain opacity-95 ring-1 ring-vault-border/40 shadow-[0_0_24px_rgba(0,255,65,0.08)]"
          />
          <span className="text-[9px] opacity-45 tracking-wider">装饰动画 · 非游戏数据</span>
        </aside>

        <div className="min-w-0 space-y-4">
          <section
            className="vault-panel rounded-sm border border-vault-border/40 p-3"
            aria-labelledby="vault-supervisor-basic"
          >
            <h3 id="vault-supervisor-basic" className="text-[11px] font-semibold tracking-[0.16em] text-vault-green m-0 mb-2">
              基本信息
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] m-0">
              {[
                ['姓名', basic?.['姓名']],
                ['当前位置', basic?.['当前位置']],
                ['行动点数', basic?.['行动点数']],
              ].map(([label, val]) => (
                <div key={String(label)} className="flex gap-2 min-w-0 border-b border-vault-border/15 sm:border-0 pb-1 sm:pb-0">
                  <dt className="opacity-55 shrink-0 w-20">{label}</dt>
                  <dd className="m-0 opacity-95 tabular-nums wrap-break-word">{formatPrimitive(val)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section
            className="vault-panel rounded-sm border border-vault-border/40 p-3"
            aria-labelledby="vault-supervisor-special"
          >
            <h3 id="vault-supervisor-special" className="text-[11px] font-semibold tracking-[0.16em] text-vault-green m-0 mb-2">
              S.P.E.C.I.A.L
            </h3>
            <p className="text-[10px] opacity-55 m-0 mb-2 leading-snug">点击下方字母查看属性含义（与数值独立说明）。</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {SPECIAL_KEYS.map(letter => {
                const num = specialObj?.[letter];
                const n = typeof num === 'number' && Number.isFinite(num) ? num : null;
                const isOn = activeLetter === letter;
                return (
                  <button
                    key={letter}
                    type="button"
                    id={`vault-special-btn-${letter}`}
                    onClick={() => setActiveLetter(letter)}
                    className={[
                      'vault-supervisor-stat-btn min-w-13 rounded-sm border px-2.5 py-2 text-center transition-all',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-vault-green/45',
                      isOn
                        ? 'border-vault-green/70 bg-vault-green/12 text-vault-green shadow-[0_0_16px_rgba(0,255,65,0.12)]'
                        : 'border-vault-border/45 bg-black/25 text-vault-green/85 hover:border-vault-green/50 hover:bg-vault-green/06',
                    ].join(' ')}
                  >
                    <span className="block text-[13px] font-bold leading-none tracking-tight">{letter}</span>
                    <span className="block text-[10px] opacity-75 mt-1 tabular-nums">{n !== null ? n : '—'}</span>
                  </button>
                );
              })}
            </div>
            {activeLetter && (
              <div
                className="rounded-sm border border-vault-border/35 bg-black/30 px-3 py-2.5 text-[11px] leading-relaxed text-vault-green/90"
                role="region"
                aria-labelledby={`vault-special-btn-${activeLetter}`}
              >
                {SPECIAL_EXPLANATIONS[activeLetter]}
              </div>
            )}
          </section>
        </div>
      </div>

      <section
        className="vault-panel rounded-sm border border-vault-border/40 p-3"
        aria-labelledby="vault-supervisor-traits"
      >
        <h3 id="vault-supervisor-traits" className="text-[11px] font-semibold tracking-[0.16em] text-vault-green m-0 mb-2">
          特质
        </h3>
        {traitEntries.length === 0 ? (
          <p className="text-[10px] opacity-55 m-0">暂无特质条目。</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 list-none m-0 p-0">
            {traitEntries.map(t => (
              <li
                key={t.key}
                className="rounded-sm border border-vault-border/30 bg-black/22 px-3 py-2 space-y-1"
              >
                <div className="text-[11px] font-semibold text-vault-green/95">{t.name}</div>
                <div className="text-[10px] opacity-85 leading-snug">{t.effect}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

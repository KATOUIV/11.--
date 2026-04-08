import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  ATTR_BONUS_MAX_PER,
  ATTR_BONUS_POOL,
  ATTR_KEYS,
  buildMessageZeroClipboardText,
  buildMessageZeroFullText,
  stripOpeningStatusPlaceholderForPreview,
  computePreviewStatData,
  createDefaultAttrBonus,
  OPENING_LOCATION_OPTIONS,
  validateAttrBonus,
  type AttrKey,
  type CharacterModeId,
} from '../lib/openingBook';
import {
  CUSTOM_IDENTITY_FIELDS,
  FIXED_CHARACTER_PRESETS,
  OPENING_BOOK_TITLE,
} from '../lib/openingBookConstants';
import { GAME_DIFFICULTY_OPTIONS, GAME_DIFFICULTY_STAT_LABEL } from '../lib/openingBookDifficulty';
import { cn } from '../lib/utils';
import type { SherlockOpeningFormData } from '../types';
import { finalizeOpeningAfterWizard } from '../utils/gameInitializer';
import { computeOpeningConflictHints } from './openingConflictHints';

const DEFAULT_FORM: SherlockOpeningFormData = {
  gameDifficulty: 'standard',
  investigatorName: '',
  appearance: '',
  personalBackstory: '',
  gender: 'other',
  characterMode: 'custom',
  locationId: 'scotland_yard',
  attrBonus: createDefaultAttrBonus(),
};

const PAGE_COUNT = 4;
const STEP_LABELS = ['难度与笔迹', '立足之地', '才具七维', '钤印启程'];

/** 可点击控件：按下缩放 + 过渡，避免「点了像没点」 */
const pressable =
  'cursor-pointer select-none transition duration-150 ease-out will-change-transform motion-safe:active:scale-[0.97] motion-safe:active:brightness-95';
const pressableRing = `${pressable} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sherlock-gold/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a0f0a]`;

function applyCharacterModeToForm(
  prev: SherlockOpeningFormData,
  mode: CharacterModeId,
): SherlockOpeningFormData {
  if (mode === 'custom') {
    return { ...prev, characterMode: 'custom', ...CUSTOM_IDENTITY_FIELDS };
  }
  if (mode === 'chen_yuan') {
    return { ...prev, characterMode: 'chen_yuan', ...FIXED_CHARACTER_PRESETS.chen_yuan };
  }
  return { ...prev, characterMode: 'kesibo', ...FIXED_CHARACTER_PRESETS.kesibo };
}

type OpeningModeVariant = 'custom' | 'chen' | 'kesibo';

const MODE_OPTIONS: Array<{
  id: CharacterModeId;
  title: string;
  tagline: string;
  desc: string;
  egg: string;
  variant: OpeningModeVariant;
  highlights: string[];
}> = [
  {
    id: 'custom',
    title: '自定义 · 穿越者警探',
    tagline: '卷宗由你亲签',
    desc: '姓名、样貌与来历完全自拟。苏格兰场新人、借调、或卷宗里不该出现的名字——雾都棋局从你落笔的第一行开始。',
    egg: '姓名留空时，叙事会以界面显示名或「你」代称，如同华生后来才补全委托人全名。',
    variant: 'custom',
    highlights: ['七维自由分配', '阵营与羁绊随你演绎', '与原著 NPC 同台博弈'],
  },
  {
    id: 'chen_yuan',
    title: '固定 · 陈媛',
    tagline: '八面玲珑 · 警队穿越者',
    desc: '陕西籍穿越者，凭零碎未来记忆在九六年伦敦警队站稳脚跟。特质「八面玲珑」锁定：共情与沟通让笔录与调解成为主场，体育素质撑得起追缉；正义感强却易冲动依赖。失忆暂时遮住你与 K 先生的过往——终局须在挚友与挚爱间抉择。',
    egg: '世界书设定：精致热络、爱吃会买、偶露陕味；对多数异性存偏见，唯独对 K 有潜意识牵引。',
    variant: 'chen',
    highlights: ['共情沟通 · 口供优势', '体能与临场反应', 'K 线与失忆伏笔'],
  },
  {
    id: 'kesibo',
    title: '固定 · 柯司博',
    tagline: '数字破壁 · 技术穿越者',
    desc: '二十一世纪计算机好手，穿越失忆后仍能在九六年的设备上撕开监控、链路与加密的切口。特质「数字破壁」锁定：梳理线索一丝不苟，对外市侩对内仗义；无法忍受独处。与 K 先生曾是死党——记忆复苏时，立场将撕裂你。',
    egg: '世界书设定：会冒出未来梗、聚餐算清账却愿为朋友掏光口袋；怕冷场，总把大家攒在一起。',
    variant: 'kesibo',
    highlights: ['数字取证与穿透', '严谨 · 市侩 · 仗义并存', '孤独恐惧与 K 旧谊'],
  },
];

function OpeningModeGlyph({ variant }: { variant: OpeningModeVariant }) {
  const cls = 'sherlock-opening-mode-glyph';
  if (variant === 'custom') {
    return (
      <svg className={cls} viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M5 4h14v2H5V4zm1 4h12l-1 14H7L6 8zm2 2v10h8V10H8zm2 2h4v1h-4v-1zm0 3h4v1h-4v-1z"
          opacity="0.92"
        />
      </svg>
    );
  }
  if (variant === 'chen') {
    return (
      <svg className={cls} viewBox="0 0 24 24" aria-hidden>
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
          d="M12 4c-2.5 3-6 4.2-6 8.5a6 6 0 1012 0c0-4.3-3.5-5.5-6-8.5zM12 14v6"
        />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="6" width="16" height="12" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.35" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        d="M8 10h8M8 13h6M8 16h5"
      />
    </svg>
  );
}

/** 七维单字徽记（卷上辨行用，与才具名首字相应） */
const ATTR_LETTER: Record<AttrKey, string> = {
  演绎力: '演',
  观察力: '观',
  沟通力: '言',
  应变力: '变',
  抗压性: '韧',
  情报力: '讯',
  气运值: '运',
};

/** 每条才具一行雾都口吻的注脚，替代「基础+合计」式说明 */
const ATTR_WHISPER: Record<AttrKey, string> = {
  演绎力: '把散乱缀成结：链式推理与归纳收束。',
  观察力: '泥印、袖口灰渍、目光落点——先于言语。',
  沟通力: '你开口时，口舌亦是一件证物。',
  应变力: '棋局拐刃、骤雨闭门——身在刃上须活。',
  抗压性: '舆论、追索与审问之下仍能站稳脚跟。',
  情报力: '档案、耳语、线人：把碎片钉回真相墙。',
  气运值: '雾都偶有的偏心：门锁松一寸，风向偏半指。',
};

/** 七维炫彩区分：与 global.css 中 .sherlock-attr-row--* 成对 */
const ATTR_ROW_VARIANT: Record<AttrKey, string> = {
  演绎力: 'sherlock-attr-row--deduction',
  观察力: 'sherlock-attr-row--observe',
  沟通力: 'sherlock-attr-row--comm',
  应变力: 'sherlock-attr-row--adapt',
  抗压性: 'sherlock-attr-row--resist',
  情报力: 'sherlock-attr-row--intel',
  气运值: 'sherlock-attr-row--luck',
};

function sumBonus(b: Record<AttrKey, number>): number {
  return ATTR_KEYS.reduce((s, k) => s + (b[k] ?? 0), 0);
}

/** MVU 中「特质」可能是字符串或 { 名称: true }，不可直接当作 React 子节点渲染 */
function formatTraitForPreview(raw: unknown): string | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    return t.length ? t : null;
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const keys = Object.keys(raw as Record<string, unknown>).filter(
      k => (raw as Record<string, unknown>)[k] != null && (raw as Record<string, unknown>)[k] !== false,
    );
    return keys.length ? keys.join('、') : null;
  }
  return null;
}

function OpeningStatPreview({ form }: { form: SherlockOpeningFormData }) {
  const stat = computePreviewStatData(form);
  const world = stat['世界层'] as Record<string, unknown> | undefined;
  const diffLabel = (world?.['游戏难度'] as string | undefined) ?? GAME_DIFFICULTY_STAT_LABEL[form.gameDifficulty];
  const player = stat['玩家状态'] as Record<string, unknown> | undefined;
  const attrs = player?.['属性'] as Record<string, number> | undefined;
  const ap = player?.['AP'] as number | undefined;
  const apCap = (player?.['AP上限'] as number | undefined) ?? 100;
  const tier = player?.['超能力层级'] as number | undefined;
  const gs = stat['游戏状态'] as Record<string, unknown> | undefined;
  const pos = gs?.['当前位置'] as string | undefined;
  const traitLine = formatTraitForPreview(player?.['特质']);

  const sevenLine =
    attrs &&
    ATTR_KEYS.map(k => `${k.replace(/力$|值$/, '')} ${attrs[k]}`).join(' · ');

  return (
    <div className="sherlock-opening-stat-snapshot relative overflow-hidden p-4">
      <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl" />
      <p className="relative mb-3 border-b border-amber-800/35 pb-2 font-serif text-[10px] tracking-[0.4em] text-sherlock-gold/80">
        探员快照
      </p>
      {diffLabel ? (
        <p className="relative mb-2 text-[10px] tracking-wide text-amber-200/65">
          博弈难度：<span className="text-amber-100/90">{diffLabel}</span>
        </p>
      ) : null}
      {pos ? (
        <p className="relative text-sm font-medium leading-snug text-amber-50/95">{pos}</p>
      ) : null}
      <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-amber-100/85">
        <span>
          行动余地{' '}
          <strong className="text-sherlock-gold tabular-nums">
            {ap != null && apCap > 0 ? `${Math.round((ap / apCap) * 100)}%` : '—'}
          </strong>
        </span>
        <span className="text-amber-200/50">·</span>
        <span>
          异界层级 <strong className="tabular-nums text-amber-100">{tier ?? 0}</strong>
        </span>
      </div>
      {traitLine ? (
        <p className="relative mt-2 text-[11px] leading-relaxed text-amber-200/75">特质：{traitLine}</p>
      ) : null}
      {sevenLine ? (
        <p className="relative mt-3 border-t border-amber-900/35 pt-3 text-[11px] leading-relaxed text-amber-100/70">
          才具七维：{sevenLine}
        </p>
      ) : null}
    </div>
  );
}

export function OpeningBookWizard({ onComplete }: { onComplete: () => void }) {
  const [page, setPage] = useState(0);
  const [form, setForm] = useState<SherlockOpeningFormData>(DEFAULT_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anim, setAnim] = useState(false);
  /** 须先成功复制开局文稿，方可落印（避免未粘贴就封存） */
  const [sealCopied, setSealCopied] = useState(false);

  useEffect(() => {
    if (page !== 3) {
      setSealCopied(false);
    }
  }, [page]);
  const conflictHints = useMemo(() => computeOpeningConflictHints(form), [form]);
  const remaining = ATTR_BONUS_POOL - sumBonus(form.attrBonus);

  const go = (_dir: -1 | 1, nextPage: number) => {
    setAnim(true);
    window.setTimeout(() => {
      setPage(nextPage);
      setAnim(false);
    }, 220);
  };

  const next = () => {
    setError(null);
    if (page === 2 && remaining !== 0) {
      setError(
        `尚有 ${remaining} 豆星烬悬在半空，须尽数落卷（共 ${ATTR_BONUS_POOL} 豆）后方可续页。`,
      );
      return;
    }
    if (page < PAGE_COUNT - 1) go(1, page + 1);
  };

  const back = () => {
    setError(null);
    if (page > 0) go(-1, page - 1);
  };

  const copySealDraft = async () => {
    try {
      await navigator.clipboard.writeText(buildMessageZeroClipboardText(form));
      setSealCopied(true);
      toastr.success(
        '开卷文书已入剪贴板。请先点右下角「落印启程」入卷，再在左下「对话」中粘贴并发送。',
        '伦敦博弈场',
      );
    } catch {
      toastr.error('未能写入剪贴板，请检查权限后重试。', '伦敦博弈场');
    }
  };

  const finish = async () => {
    if (!sealCopied) {
      return;
    }
    if (!validateAttrBonus(form.attrBonus)) {
      setError(
        `七维须恰好烬尽 ${ATTR_BONUS_POOL} 豆星烬，且单条加码不可逾 ${ATTR_BONUS_MAX_PER} 格。`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await finalizeOpeningAfterWizard(form);
    if (!ok) {
      setError('卷宗未能钤印，请稍后再试');
      setBusy(false);
      return;
    }
    toastr.info('案卷已钤印。若递状栏中尚无你的首函，请先遣送后再行探案。', '伦敦博弈场');
    onComplete();
    setBusy(false);
  };

  return (
    <div className="sherlock-opening-wrap relative z-10 flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden px-2 py-2 sm:px-4 sm:py-3">
      <div
        className={cn(
          'book-leather mx-auto flex h-full w-full max-w-3xl min-h-[min(100%,780px)] flex-1 flex-col overflow-hidden rounded-xl border border-[#3d2818]/80 shadow-[0_24px_60px_rgba(0,0,0,0.55)] max-[420px]:min-h-0',
          'bg-[linear-gradient(145deg,#2a1810_0%,#1a0f0a_45%,#120a06_100%)]',
        )}
      >
        <div className="sherlock-opening-header-bar flex shrink-0 flex-col gap-2 border-b px-3 py-2 sm:px-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-serif text-[10px] tracking-[0.2em] text-amber-200/70">{OPENING_BOOK_TITLE}</p>
              <p className="text-[9px] text-amber-200/45">
                四页手记 · 末页复制全文后钤「落印启程」，进场再在「对话」中送出
              </p>
            </div>
            <span className="text-[10px] text-amber-100/50 tabular-nums">
              第 {page + 1} 页，共 {PAGE_COUNT} 页
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STEP_LABELS.map((label, i) => (
              <span
                key={label}
                className={cn(
                  'sherlock-opening-step-pill',
                  i === page
                    ? 'sherlock-opening-step-pill--current'
                    : i < page
                      ? 'sherlock-opening-step-pill--done'
                      : 'sherlock-opening-step-pill--todo',
                )}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div
          className={cn(
            'book-paper sherlock-scroll-y-invisible min-h-0 flex-1 px-3 py-4 transition-all duration-300 ease-out sm:px-6 sm:py-5',
            'bg-[linear-gradient(180deg,rgba(245,240,230,0.04)_0%,transparent_12%),linear-gradient(90deg,rgba(0,0,0,0.15)_0%,transparent_6%,transparent_94%,rgba(0,0,0,0.12)_100%)]',
            anim ? 'translate-x-0.5 opacity-60' : 'opacity-100',
          )}
        >
          {page === 0 && <PageIdentity form={form} setForm={setForm} />}
          {page === 1 && <PageLocation form={form} setForm={setForm} />}
          {page === 2 && (
            <PageAttributes form={form} setForm={setForm} remaining={remaining} />
          )}
          {page === 3 && (
            <PageConfirm
              form={form}
              conflictHints={conflictHints}
              sealCopied={sealCopied}
              onCopySeal={() => void copySealDraft()}
            />
          )}
        </div>

        {error ? <p className="shrink-0 px-3 pb-1 text-center text-xs text-red-300">{error}</p> : null}

        <div className="sherlock-opening-header-bar flex shrink-0 items-center justify-between gap-3 border-t border-amber-900/30 px-3 py-3 sm:px-4">
          <button
            id="sherlock-opening-nav-back"
            type="button"
            disabled={page === 0 || busy}
            onClick={back}
            className={cn(
              pressableRing,
              'sherlock-opening-nav-btn sherlock-opening-nav-btn--back px-4 py-2 disabled:pointer-events-none disabled:opacity-30',
            )}
          >
            返回
          </button>
          {page < PAGE_COUNT - 1 ? (
            <button
              id="sherlock-opening-nav-next"
              type="button"
              disabled={busy || (page === 2 && remaining !== 0)}
              onClick={next}
              className={cn(
                pressableRing,
                'sherlock-opening-nav-btn sherlock-opening-nav-btn--next px-6 py-2 disabled:pointer-events-none disabled:opacity-40',
              )}
            >
              下一章
            </button>
          ) : (
            <button
              id="sherlock-opening-nav-seal"
              type="button"
              disabled={busy || remaining !== 0 || !sealCopied}
              onClick={() => void finish()}
              title={!sealCopied ? '请先在上一栏复制开局文稿' : undefined}
              className={cn(
                pressableRing,
                'sherlock-opening-nav-btn sherlock-opening-nav-btn--seal px-6 py-2 disabled:pointer-events-none disabled:opacity-40',
              )}
            >
              {busy ? '钤印中…' : '落印启程'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PageIdentity({
  form,
  setForm,
}: {
  form: SherlockOpeningFormData;
  setForm: Dispatch<SetStateAction<SherlockOpeningFormData>>;
}) {
  return (
    <div className="space-y-5">
      <h3 className="sherlock-opening-section-h">第一页 · 难度与笔迹</h3>
      <p className="sherlock-opening-lead">
        先选<strong className="text-amber-100/90">博弈难度</strong>
        ：决定叙事松紧与对抗强度（会写入案卷数据）。再选穿越者模板或自定义警探。
      </p>

      <div>
        <p className="sherlock-opening-block-title">博弈难度</p>
        <div className="flex flex-col gap-3">
          {GAME_DIFFICULTY_OPTIONS.map(opt => {
            const active = form.gameDifficulty === opt.id;
            return (
              <button
                key={opt.id}
                id={`sherlock-opening-diff-${opt.id}`}
                type="button"
                onClick={() => setForm(f => ({ ...f, gameDifficulty: opt.id }))}
                className={cn(
                  pressableRing,
                  'sherlock-opening-glass-base sherlock-opening-diff-card',
                  `sherlock-opening-diff-card--${opt.id}`,
                  active && 'sherlock-opening-diff-card--active',
                )}
              >
                <span className="sherlock-opening-card-shimmer" aria-hidden />
                <span className="sherlock-opening-choice-title">{opt.title}</span>
                <span className="sherlock-opening-choice-tag">{opt.tagline}</span>
                <span className="sherlock-opening-choice-desc">{opt.desc}</span>
                <span className="sherlock-opening-choice-egg">{opt.egg}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="sherlock-opening-block-title">角色模板</p>
        <div className="flex flex-col gap-3">
          {MODE_OPTIONS.map(o => {
            const active = form.characterMode === o.id;
            return (
              <button
                key={o.id}
                id={`sherlock-opening-mode-${o.id}`}
                type="button"
                onClick={() => setForm(f => applyCharacterModeToForm(f, o.id))}
                className={cn(
                  pressableRing,
                  'sherlock-opening-glass-base sherlock-opening-mode-card text-left',
                  `sherlock-opening-mode-card--${o.variant}`,
                  active && 'sherlock-opening-mode-card--active',
                )}
              >
                <span className="sherlock-opening-card-shimmer" aria-hidden />
                <span className="sherlock-opening-mode-card__icon" aria-hidden>
                  <OpeningModeGlyph variant={o.variant} />
                </span>
                <span className="sherlock-opening-mode-card__body">
                  <span className="sherlock-opening-mode-card__head">
                    <span className="sherlock-opening-mode-card__title">{o.title}</span>
                    <span className="sherlock-opening-mode-card__tag">{o.tagline}</span>
                  </span>
                  <span className="sherlock-opening-mode-card__desc">{o.desc}</span>
                  <ul className="sherlock-opening-mode-card__highlights">
                    {o.highlights.map(h => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                  <span className="sherlock-opening-mode-card__egg">{o.egg}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="sherlock-opening-lead opacity-90">
        {form.characterMode === 'custom' ? (
          <>姓名为空时，叙事会以你的显示名或「你」代称，如同卷宗里尚未补齐的委托人栏。</>
        ) : (
          <>已铺好固定档案与性别；可略改字句，再赴下一页选开局位置。</>
        )}
      </p>
      <label className="sherlock-opening-field-label">
        调查员姓名
        <input
          id="sherlock-opening-input-name"
          value={form.investigatorName}
          onChange={e => setForm(f => ({ ...f, investigatorName: e.target.value }))}
          placeholder="可留空；与卷宗抬头一致为佳"
          className="sherlock-opening-field px-3 py-2 text-sm"
        />
      </label>
      <label className="sherlock-opening-field-label">
        样貌 · 卷宗侧写（他人第一眼）
        <textarea
          id="sherlock-opening-input-appearance"
          value={form.appearance}
          onChange={e => setForm(f => ({ ...f, appearance: e.target.value }))}
          rows={2}
          placeholder="衣着、步态、手与眼神——福尔摩斯从不会漏看这些。"
          className="sherlock-opening-field resize-none px-3 py-2 text-sm"
        />
      </label>
      <label className="sherlock-opening-field-label">
        执念与来历 · 人物列传
        <textarea
          id="sherlock-opening-input-backstory"
          value={form.personalBackstory}
          onChange={e => setForm(f => ({ ...f, personalBackstory: e.target.value }))}
          rows={3}
          placeholder="为何踏入这场棋局：辐射、穿越、莫里亚蒂或贝克街——写一句让你自己也会信的动机。"
          className="sherlock-opening-field resize-none px-3 py-2 text-sm"
        />
      </label>
      <div>
        <p className="sherlock-opening-block-title">性别</p>
        <div className="flex flex-wrap gap-2">
          {(['male', 'female', 'other'] as const).map(g => (
            <button
              key={g}
              id={`sherlock-opening-gender-${g}`}
              type="button"
              onClick={() => setForm(f => ({ ...f, gender: g }))}
              className={cn(
                pressableRing,
                'sherlock-opening-chip',
                form.gender === g && 'sherlock-opening-chip--on',
              )}
            >
              {g === 'male' ? '男' : g === 'female' ? '女' : '其他'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageLocation({
  form,
  setForm,
}: {
  form: SherlockOpeningFormData;
  setForm: Dispatch<SetStateAction<SherlockOpeningFormData>>;
}) {
  return (
    <div className="grid min-h-0 gap-5 lg:grid-cols-[1fr_min(220px,34%)]">
      <div className="min-h-0 space-y-4">
        <h3 className="sherlock-opening-section-h">第二页 · 立足之地</h3>
        <p className="sherlock-opening-lead">
          选定你踏入雾都的第一盏煤气灯：苏格兰场的咖啡渍、贝克街的化学角、河岸的潮声——开局与谁共桌、与谁对峙，由此落笔。
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPENING_LOCATION_OPTIONS.map(loc => {
            const active = form.locationId === loc.id;
            return (
              <button
                key={loc.id}
                id={`sherlock-opening-loc-${loc.id}`}
                type="button"
                onClick={() => setForm(f => ({ ...f, locationId: loc.id }))}
                className={cn(
                  pressableRing,
                  'sherlock-opening-glass-base sherlock-opening-loc-card',
                  `sherlock-opening-loc-card--${loc.id}`,
                  active && 'sherlock-opening-loc-card--active',
                )}
              >
                <span className="sherlock-opening-card-shimmer" aria-hidden />
                <span className="sherlock-opening-choice-title">{loc.label}</span>
                <span className="sherlock-opening-choice-tag">{loc.subtitle}</span>
                <span className="sherlock-opening-choice-desc">{loc.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-h-0 lg:sticky lg:top-0 lg:self-start">
        <OpeningStatPreview form={form} />
      </div>
    </div>
  );
}

function PageAttributes({
  form,
  setForm,
  remaining,
}: {
  form: SherlockOpeningFormData;
  setForm: Dispatch<SetStateAction<SherlockOpeningFormData>>;
  remaining: number;
}) {
  const adjust = (key: AttrKey, delta: number) => {
    setForm(f => {
      const cur = f.attrBonus[key] ?? 0;
      const next = cur + delta;
      if (next < 0 || next > ATTR_BONUS_MAX_PER) return f;
      const newBonus = { ...f.attrBonus, [key]: next };
      const s = sumBonus(newBonus);
      if (s > ATTR_BONUS_POOL) return f;
      return { ...f, attrBonus: newBonus };
    });
  };

  const presetBalanced = () => setForm(f => ({ ...f, attrBonus: createDefaultAttrBonus() }));
  const presetDeduction = () =>
    setForm(f => ({
      ...f,
      attrBonus: {
        演绎力: 5,
        观察力: 5,
        沟通力: 2,
        应变力: 2,
        抗压性: 2,
        情报力: 3,
        气运值: 2,
      },
    }));
  const presetIntel = () =>
    setForm(f => ({
      ...f,
      attrBonus: {
        演绎力: 2,
        观察力: 3,
        沟通力: 3,
        应变力: 2,
        抗压性: 2,
        情报力: 6,
        气运值: 3,
      },
    }));

  return (
    <div className="grid min-h-0 gap-5 lg:grid-cols-[1fr_min(240px,38%)]">
      <div className="min-h-0 space-y-4">
        <h3 className="sherlock-opening-section-h">第三页 · 才具七维</h3>
        <p className="sherlock-opening-lead">
          手记以七维首字记卷（演、观、沟、应、抗、情、运），卷面各有十格底色，另有{' '}
          <strong className="text-amber-100/85">二十一豆星烬</strong>
          任你拨入（单条至多添八格）。拨至烬尽，方许翻向钤印——像填满一只旧烟斗盒，每一格都须有你的名目。
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            id="sherlock-attr-preset-balanced"
            type="button"
            onClick={presetBalanced}
            className={cn(pressableRing, 'sherlock-attr-preset sherlock-attr-preset--balanced')}
          >
            雾谱 · 均衡
          </button>
          <button
            id="sherlock-attr-preset-deduction"
            type="button"
            onClick={presetDeduction}
            className={cn(pressableRing, 'sherlock-attr-preset sherlock-attr-preset--deduction')}
          >
            雾谱 · 演绎向
          </button>
          <button
            id="sherlock-attr-preset-intel"
            type="button"
            onClick={presetIntel}
            className={cn(pressableRing, 'sherlock-attr-preset sherlock-attr-preset--intel')}
          >
            雾谱 · 情报向
          </button>
        </div>

        <div
          id="sherlock-opening-attr-remaining"
          className={cn(
            'sherlock-opening-points-banner',
            remaining === 0 ? 'sherlock-opening-points-banner--done' : 'sherlock-opening-points-banner--open',
          )}
        >
          {remaining === 0 ? (
            <>
              <span className="sherlock-opening-points-banner__glow" aria-hidden />
              <span className="relative z-1">二十一豆星烬尽数归位，可续写下一章。</span>
            </>
          ) : (
            <>
              <span className="sherlock-opening-points-banner__glow" aria-hidden />
              <span className="relative z-1">
                余灰未扫：尚有{' '}
                <span className="sherlock-opening-points-banner__num tabular-nums">{remaining}</span> 豆星烬待落卷
                <span className="sherlock-opening-points-banner__hint">
                  （共须烬尽 {ATTR_BONUS_POOL} 豆方可钤印）
                </span>
              </span>
            </>
          )}
        </div>

        <div className="space-y-2.5">
          {ATTR_KEYS.map(k => {
            const bonus = form.attrBonus[k] ?? 0;
            const total = 10 + bonus;
            const slug = k.replace(/力$|值$/, '');
            const ariaStem = `${k}（徽记「${ATTR_LETTER[k]}」）`;
            return (
              <div
                key={k}
                id={`sherlock-attr-row-${slug}`}
                className={cn(
                  'sherlock-attr-row sherlock-attr-row--neon flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
                  ATTR_ROW_VARIANT[k],
                )}
              >
                <span className="sherlock-attr-row__mist" aria-hidden />
                <div className="relative z-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="sherlock-attr-row__letter">{ATTR_LETTER[k]}</span>
                    <span className="sherlock-attr-row__label text-sm font-semibold tracking-wide">{k}</span>
                  </div>
                  <p className="sherlock-attr-row__whisper">{ATTR_WHISPER[k]}</p>
                  <p className="sherlock-attr-row__foot">
                    卷上共 <span className="tabular-nums">{total}</span> 刻
                  </p>
                </div>
                <div className="relative z-1 flex shrink-0 items-center justify-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    id={`sherlock-attr-minus-${slug}`}
                    onClick={() => adjust(k, -1)}
                    disabled={bonus <= 0}
                    className={cn(
                      pressableRing,
                      'sherlock-attr-step h-9 w-9 rounded-lg border text-base font-medium leading-none disabled:pointer-events-none disabled:opacity-30',
                    )}
                    aria-label={`${ariaStem}，收束一豆余烬`}
                  >
                    −
                  </button>
                  <div className="sherlock-attr-dial">
                    <span className="sherlock-attr-bonus-num tabular-nums">{bonus}</span>
                    <span className="sherlock-attr-bonus-cap">余烬加码</span>
                  </div>
                  <button
                    type="button"
                    id={`sherlock-attr-plus-${slug}`}
                    onClick={() => adjust(k, 1)}
                    disabled={bonus >= ATTR_BONUS_MAX_PER || remaining <= 0}
                    className={cn(
                      pressableRing,
                      'sherlock-attr-step h-9 w-9 rounded-lg border text-base font-medium leading-none disabled:pointer-events-none disabled:opacity-30',
                    )}
                    aria-label={`${ariaStem}，再添一豆余烬`}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>
      <div className="min-h-0 lg:sticky lg:top-0 lg:self-start">
        <OpeningStatPreview form={form} />
      </div>
    </div>
  );
}

function PageConfirm({
  form,
  conflictHints,
  sealCopied,
  onCopySeal,
}: {
  form: SherlockOpeningFormData;
  conflictHints: string[];
  sealCopied: boolean;
  onCopySeal: () => void;
}) {
  const fullOpeningDraft = buildMessageZeroFullText(form);
  const previewDraft = stripOpeningStatusPlaceholderForPreview(fullOpeningDraft);

  return (
    <div className="grid min-h-0 gap-6 lg:grid-cols-[1fr_min(260px,40%)]">
      <div className="min-h-0 space-y-4">
        <h3 className="sherlock-opening-section-h">第四页 · 钤印之前</h3>
        <p className="sherlock-opening-lead text-[12px] leading-relaxed">
          先点<strong className="text-amber-100/90">「复制开局文稿」</strong>
          收好卷面；再点右下角<strong className="text-amber-50/95">「落印启程」</strong>
          入卷进场。进场后点左下霓虹<strong className="text-amber-100/88">「对话」</strong>
          展开递状栏，<strong className="text-amber-100/88">粘贴全文并送出</strong>
          ，方与案卷相连。未复制时，启程钤会保持黯淡，以免空卷入库。
        </p>

        <div id="sherlock-opening-confirm-preview" className="sherlock-opening-confirm-glass">
          <pre className="sherlock-scroll-y-invisible relative z-1 max-h-[min(42vh,400px)] whitespace-pre-wrap font-serif text-[12px] leading-relaxed text-amber-100/90">
            {previewDraft}
          </pre>
          <p
            className="entry-splash-guide relative z-1 mt-3 border-t border-amber-800/35 pt-3 text-center font-serif text-[11px] tracking-[0.14em] text-sherlock-gold/95"
            aria-live="polite"
          >
            请先钤「落印启程」入卷，再于左下「对话」递状栏送出全文
          </p>
        </div>

        <button
          id="sherlock-opening-copy-draft"
          type="button"
          onClick={onCopySeal}
          className={cn(
            pressableRing,
            'sherlock-opening-copy-btn',
            sealCopied
              ? 'sherlock-opening-copy-btn--done sherlock-opening-copy-btn--neon-state'
              : 'sherlock-opening-copy-btn--idle',
          )}
        >
          {sealCopied ? (
            <span className="sherlock-opening-copy-neon-hint">
              先点右下角「落印启程」入卷，进场后再点左下「对话」粘贴全文并发送
            </span>
          ) : (
            '复制开局文稿'
          )}
        </button>

        {conflictHints.length > 0 ? (
          <div className="sherlock-opening-hint-box">
            <h4>卷宗旁白</h4>
            <ul className="list-inside list-disc space-y-1">
              {conflictHints.map(h => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="min-h-0 lg:sticky lg:top-0 lg:self-start">
        <OpeningStatPreview form={form} />
      </div>
    </div>
  );
}

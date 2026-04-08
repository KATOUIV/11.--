import { Fragment, useEffect, useMemo, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { getSherlockPortalRoot } from '../utils/sherlockPortalRoot';
import { cn } from '../lib/utils';

function TraitCategoryDetailOverlay({ detail, onClose }: { detail: TraitCategoryDetail; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-10050 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trait-category-detail-title"
    >
      <button type="button" className="absolute inset-0 bg-black/80 backdrop-blur-[3px]" aria-label="关闭传承说明" onClick={onClose} />
      <div
        className={cn(
          'relative max-h-[min(88vh,720px)] w-full max-w-lg sherlock-scroll-y-invisible rounded-2xl border border-sherlock-gold/35 bg-[#060a10]/98 p-5 shadow-[0_0_48px_rgba(184,134,11,0.18)] sm:p-6',
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/10 pb-3">
          <div className="min-w-0">
            <p className="font-serif text-[10px] tracking-[0.35em] text-sherlock-gold/80">传承详笺</p>
            <h3 id="trait-category-detail-title" className="mt-1 font-serif text-xl font-bold tracking-wide text-sherlock-gold">
              {detail.title}
            </h3>
            <p className="mt-2 inline-block rounded border border-sherlock-blue/30 bg-sherlock-blue/10 px-2 py-0.5 text-[10px] text-sherlock-blue">
              主属性 {detail.primaryAttr}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-white/15 bg-black/50 p-2 text-sherlock-text-muted transition hover:border-sherlock-red/40 hover:text-sherlock-red"
            aria-label="关闭"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-sherlock-text-secondary">{detail.lore}</p>

        <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-950/15 p-3">
          <h4 className="mb-1 font-serif text-xs font-bold text-amber-200/95">获取与门槛</h4>
          <p className="text-xs italic leading-relaxed text-sherlock-text-muted">{detail.acquisition}</p>
        </div>

        <div className="mb-4">
          <h4 className="mb-2 font-serif text-xs font-bold tracking-wide text-sherlock-text-primary">对调查员的加成</h4>
          <ul className="space-y-2 border-l-2 border-sherlock-gold/40 pl-3 text-xs leading-relaxed text-sherlock-text-secondary">
            {detail.bonuses.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>

        {detail.synergy ? (
          <div className="rounded-lg border border-purple-500/25 bg-purple-950/20 p-3">
            <h4 className="mb-1 font-serif text-xs font-bold text-purple-200/90">与其它门类</h4>
            <p className="text-xs italic leading-relaxed text-sherlock-text-muted">{detail.synergy}</p>
          </div>
        ) : null}

        <p className="mt-4 text-center text-[10px] italic text-sherlock-text-muted">
          兑换时扣气力、写入特质；剧情是否允许入手仍以当案叙事为准。
        </p>
      </div>
    </div>,
    getSherlockPortalRoot(),
  );
}
import {
  X,
  Minus,
  Shield,
  Users,
  Building2,
  Briefcase,
  UserPlus,
  BrainCircuit,
  Map,
  Sparkles,
  Store,
  ChevronDown,
  ChevronUp,
  Archive,
  Fingerprint,
  FileText,
  FlaskConical,
  Package,
  Home,
  Microscope,
  Monitor,
  Lock,
  Landmark,
  Crown,
  Skull,
  Eye,
  Network,
  GitBranch,
  Zap,
  Scale,
  Search,
  Megaphone,
  Globe2,
  Handshake,
  BadgeCheck,
  Flame,
  Gavel,
  FileLock,
  Swords,
  Heart,
  Activity,
  Radio,
  Link2,
  Clock,
  MapPin,
  BookOpen,
} from 'lucide-react';
import { useSherlockStats } from '../context/SherlockStatContext';
import {
  DYNAMIC_SHOP_ID_MIN,
  DIMENSIONAL_SHOP_ITEMS,
  SHOP_TAG_DISPLAY_ORDER,
  TRAIT_CATEGORY_DETAILS,
  TRAIT_CATEGORY_KEYS,
  countShopPurchasesByCategory,
  mergeDimensionalShopCatalog,
  traitCategoryTitle,
  type DimensionalShopItem,
  type ShopSeriesTag,
  type TraitCategoryDetail,
  type TraitCategoryKey,
} from '../lib/dimensionalShop';
import {
  DEDUCTION_RANK_LORE,
  type FactionMetricId,
  factionCorePressure,
  getFactionMetricMeta,
} from '../lib/factionLayerMeta';
import {
  companionAuraClass,
  companionShowSyncPulse,
  mentalStatusTone,
  resolveCompanionProfile,
} from '../lib/companionRosterMeta';
import { bondSynergyPips, bondTierFromPct, resolveBondFaction } from '../lib/bondFactionMeta';
import { MODULE_ATLAS } from '../lib/gameWorldGuide';
import { plotPhaseBadge, plotSyncNarrative, plotTimeFlavor } from '../lib/plotAnchorMeta';
import { purchaseDimensionalShopItem } from '../lib/sherlockShopPurchase';
import { ATTR_RADAR_ORDER, buildRadarRows, clampPct, type SherlockCompanionEntry } from '../utils/sherlockStatModel';
import { ModalType } from './Sidebar';
import { SherlockErrorBoundary } from './SherlockErrorBoundary';

const FACILITY_MAX = 5;

/** 设施 / 派系 / 阵营等卡面共用调色（渐变底 + 进度条） */
const GAME_CARD_PALETTES = [
  {
    border: 'border-amber-400/45',
    bg: 'bg-linear-to-br from-amber-950/50 via-black/40 to-orange-950/28',
    glow: 'shadow-[0_0_26px_rgba(245,158,11,0.13)]',
    orb: 'bg-linear-to-br from-amber-400/28 to-transparent',
    barTrack: 'bg-black/55 ring-1 ring-amber-500/15',
    barFill: 'bg-linear-to-r from-amber-400/95 via-yellow-500/90 to-orange-600/85',
  },
  {
    border: 'border-cyan-400/40',
    bg: 'bg-linear-to-br from-cyan-950/45 via-black/42 to-sky-950/28',
    glow: 'shadow-[0_0_26px_rgba(34,211,238,0.11)]',
    orb: 'bg-linear-to-br from-cyan-400/28 to-transparent',
    barTrack: 'bg-black/55 ring-1 ring-cyan-500/15',
    barFill: 'bg-linear-to-r from-cyan-300 via-sky-400 to-teal-600',
  },
  {
    border: 'border-emerald-400/40',
    bg: 'bg-linear-to-br from-emerald-950/48 via-black/42 to-green-950/26',
    glow: 'shadow-[0_0_26px_rgba(52,211,153,0.11)]',
    orb: 'bg-linear-to-br from-emerald-400/25 to-transparent',
    barTrack: 'bg-black/55 ring-1 ring-emerald-500/15',
    barFill: 'bg-linear-to-r from-emerald-300 via-green-400 to-emerald-800',
  },
  {
    border: 'border-violet-400/40',
    bg: 'bg-linear-to-br from-violet-950/48 via-black/42 to-fuchsia-950/26',
    glow: 'shadow-[0_0_26px_rgba(167,139,250,0.13)]',
    orb: 'bg-linear-to-br from-violet-400/25 to-transparent',
    barTrack: 'bg-black/55 ring-1 ring-violet-500/15',
    barFill: 'bg-linear-to-r from-violet-300 via-fuchsia-500 to-purple-800',
  },
  {
    border: 'border-rose-400/38',
    bg: 'bg-linear-to-br from-rose-950/44 via-black/40 to-red-950/28',
    glow: 'shadow-[0_0_26px_rgba(251,113,133,0.11)]',
    orb: 'bg-linear-to-br from-rose-400/25 to-transparent',
    barTrack: 'bg-black/55 ring-1 ring-rose-500/15',
    barFill: 'bg-linear-to-r from-rose-300 via-rose-500 to-red-800',
  },
  {
    border: 'border-sky-400/38',
    bg: 'bg-linear-to-br from-sky-950/44 via-black/38 to-indigo-950/28',
    glow: 'shadow-[0_0_26px_rgba(56,189,248,0.11)]',
    orb: 'bg-linear-to-br from-sky-400/25 to-transparent',
    barTrack: 'bg-black/55 ring-1 ring-sky-500/15',
    barFill: 'bg-linear-to-r from-sky-300 via-blue-400 to-indigo-700',
  },
] as const;

interface ModalsProps {
  activeModal: ModalType;
  setActiveModal: (modal: ModalType) => void;
}

export function Modals({ activeModal, setActiveModal }: ModalsProps) {
  if (!activeModal) return null;

  return (
    <SherlockErrorBoundary
      key={activeModal}
      fallback={
        <div className="absolute inset-0 z-50 flex min-h-0 items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-panel max-w-md rounded-xl border border-sherlock-red/30 p-6 text-center">
            <p className="text-sm text-sherlock-text-primary">此面板暂时无法展开，请关闭后重试。</p>
            <button
              type="button"
              className="mt-4 rounded-lg border border-sherlock-gold/40 bg-sherlock-gold/15 px-4 py-2 text-sm text-sherlock-gold hover:bg-sherlock-gold/25"
              onClick={() => setActiveModal(null)}
            >
              关闭
            </button>
          </div>
        </div>
      }
    >
      <div className="absolute inset-0 z-50 flex min-h-0 items-center justify-center bg-black/60 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm transition-all duration-300 sm:p-4 lg:p-8">
        <div className="glass-panel-gold flex max-h-full w-full max-w-[min(100%,96rem)] flex-col overflow-hidden rounded-xl transition-all duration-200">
          {/* Modal Header */}
          <div className="flex min-h-0 flex-wrap items-center justify-between gap-2 border-b border-sherlock-gold/20 bg-black/40 p-3 sm:p-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <span className="shrink-0">{getModalIcon(activeModal)}</span>
              <h2 className="min-w-0 wrap-break-word font-serif text-base font-bold tracking-[0.12em] text-sherlock-gold drop-shadow-[0_0_12px_rgba(184,134,11,0.25)] sm:text-xl sm:tracking-[0.18em]">
                {getModalTitle(activeModal)}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <button
                type="button"
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded p-1 text-sherlock-gray transition-colors hover:text-sherlock-text-primary"
              >
                <Minus className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded p-1 text-sherlock-gray transition-colors hover:text-sherlock-red"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {activeModal && MODULE_ATLAS[activeModal] ? (
            <div className="border-b border-sherlock-gold/15 bg-black/35 px-3 py-3 sm:px-5">
              <p className="text-[11px] leading-relaxed text-sherlock-text-secondary">
                <span className="font-serif font-semibold text-sherlock-gold/95">{MODULE_ATLAS[activeModal].title}</span>
                <span className="text-sherlock-text-muted"> — </span>
                {MODULE_ATLAS[activeModal].oneLiner}
              </p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-sherlock-text-muted">{MODULE_ATLAS[activeModal].play}</p>
              <p className="mt-1 border-l-2 border-sherlock-blue/35 pl-2 text-[10px] italic leading-relaxed text-sherlock-blue/85">
                {MODULE_ATLAS[activeModal].story}
              </p>
            </div>
          ) : null}

          {/* Modal Content */}
          <div className="sherlock-scroll-y-invisible min-h-0 flex-1 p-3 sm:p-6">
            {renderModalContent(activeModal)}
          </div>
        </div>
      </div>
    </SherlockErrorBoundary>
  );
}

function getModalIcon(type: ModalType) {
  const className = "w-6 h-6 text-sherlock-gold";
  switch (type) {
    case 'plot': return <Map className={className} />;
    case 'faction': return <Shield className={className} />;
    case 'bonds': return <Users className={className} />;
    case 'facilities': return <Building2 className={className} />;
    case 'inventory': return <Briefcase className={className} />;
    case 'growth': return <BrainCircuit className={className} />;
    case 'companions': return <UserPlus className={className} />;
    default: return null;
  }
}

function getModalTitle(type: ModalType) {
  switch (type) {
    case 'plot':
      return '主线棋局 · 雾都锚点';
    case 'faction':
      return '阵营态势 · 势力天平';
    case 'bonds':
      return '派系羁绊 · 暗线同盟';
    case 'facilities':
      return '探案设施 · 案卷据点';
    case 'inventory':
      return '仓库 · 证物与物证';
    case 'growth':
      return '自身状态 · 异界加护';
    case 'companions':
      return '同行者 · 羁绊名册';
    default:
      return '';
  }
}

function renderModalContent(type: ModalType) {
  switch (type) {
    case 'growth': return <GrowthModal />;
    case 'plot': return <PlotModal />;
    case 'faction': return <FactionModal />;
    case 'bonds': return <BondsModal />;
    case 'facilities': return <FacilitiesModal />;
    case 'inventory': return <InventoryModal />;
    case 'companions': return <CompanionsModal />;
    default: return null;
  }
}

// --- Specific Modal Contents ---

/** 纯 SVG 七维雷达（轻量、无额外图表依赖） */
function SevenAxisRadar({ data }: { data: Array<{ subject: string; A: number }> }) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const n = data.length;
  const outerR = 88;
  const angles = Array.from({ length: n }, (_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / n);

  const gridPolygons = [1 / 3, 2 / 3, 1].map(level => {
    const pts = angles.map(a => {
      const x = cx + outerR * level * Math.cos(a);
      const y = cy + outerR * level * Math.sin(a);
      return `${x},${y}`;
    });
    return `M ${pts.join(' L ')} Z`;
  });

  const dataPolygon = (() => {
    const pts = data.map((d, i) => {
      const a = angles[i];
      const r = outerR * (d.A / 100);
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    });
    return `M ${pts.join(' L ')} Z`;
  })();

  return (
    <div className="flex w-full items-center justify-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-56 w-full max-w-[280px]"
        role="img"
        aria-label="七维属性雷达"
      >
        {gridPolygons.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        ))}
        {angles.map((a, i) => {
          const x = cx + outerR * Math.cos(a);
          const y = cy + outerR * Math.sin(a);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          );
        })}
        <path d={dataPolygon} fill="rgba(184, 134, 11, 0.28)" stroke="#B8860B" strokeWidth={2} />
        {data.map((d, i) => {
          const a = angles[i];
          const lr = outerR + 20;
          const x = cx + lr * Math.cos(a);
          const y = cy + lr * Math.sin(a);
          return (
            <text
              key={d.subject}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#8A95A5"
              fontSize={10}
            >
              {d.subject}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function shopSeriesClass(tag: ShopSeriesTag): string {
  const map: Record<ShopSeriesTag, string> = {
    咒术回战: 'border-purple-400/50 bg-purple-950/40 text-purple-200',
    神精榜: 'border-cyan-400/50 bg-cyan-950/35 text-cyan-100',
    蛊真人: 'border-emerald-400/50 bg-emerald-950/40 text-emerald-100',
    捞尸人: 'border-slate-400/50 bg-slate-950/45 text-slate-200',
    神探夏洛克: 'border-amber-400/50 bg-amber-950/35 text-amber-100',
    穿越者: 'border-fuchsia-400/50 bg-fuchsia-950/40 text-fuchsia-100',
    混合: 'border-rose-400/50 bg-rose-950/35 text-rose-100',
  };
  return map[tag] ?? 'border-white/20 bg-black/40 text-sherlock-text-secondary';
}

function formatTraitValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function GrowthModal() {
  const { stats, refresh } = useSherlockStats();
  const { world, player } = stats;
  const radarData = buildRadarRows(player.attrs);
  const traitEntries = Object.entries(player.traits);
  const tier = player.superPowerTier;
  const [shopOpen, setShopOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState<DimensionalShopItem | null>(null);
  const [traitDetailKey, setTraitDetailKey] = useState<string | null>(null);
  const [shopCategoryFilter, setShopCategoryFilter] = useState<TraitCategoryKey | 'all'>('all');
  const [shopPurchasing, setShopPurchasing] = useState(false);

  const categoryPurchaseTotals = useMemo(
    () => countShopPurchasesByCategory(player.shopPurchaseCounts),
    [player.shopPurchaseCounts],
  );

  const shopCatalog = useMemo(
    () => mergeDimensionalShopCatalog(stats.rawStatData),
    [stats.rawStatData],
  );

  const filteredShopItems = useMemo(() => {
    if (shopCategoryFilter === 'all') return shopCatalog;
    return shopCatalog.filter(i => i.traitCategory === shopCategoryFilter);
  }, [shopCatalog, shopCategoryFilter]);

  const filteredSectionTags = useMemo(() => {
    const present = new Set(filteredShopItems.map(i => i.tag));
    const head = SHOP_TAG_DISPLAY_ORDER.filter(t => present.has(t));
    const extra = [...present].filter(t => !SHOP_TAG_DISPLAY_ORDER.includes(t)).sort() as ShopSeriesTag[];
    return [...head, ...extra];
  }, [filteredShopItems]);

  const activeTraitDetail =
    traitDetailKey != null ? TRAIT_CATEGORY_DETAILS.find(c => c.key === traitDetailKey) ?? null : null;

  useEffect(() => {
    if (selectedShop && !filteredShopItems.some(i => i.id === selectedShop.id)) {
      setSelectedShop(null);
    }
  }, [filteredShopItems, selectedShop]);

  useEffect(() => {
    if (!shopOpen && !traitDetailKey) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [shopOpen, traitDetailKey]);

  const apRatio = player.apMax > 0 ? clampPct((player.ap / player.apMax) * 100) : 0;

  return (
    <div className="space-y-6">
      <div
        className="sherlock-world-clock-strip flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sherlock-blue/40 bg-linear-to-r from-black/60 via-sherlock-blue/10 to-black/60 px-4 py-3 text-sm"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <span className="font-serif text-[10px] italic tracking-[0.25em] text-sherlock-blue/90">雾都时标</span>
          <span className="text-sherlock-text-primary tabular-nums">{world.date}</span>
          <span className="text-sherlock-gold tabular-nums">{world.time}</span>
        </div>
        <div
          className="max-w-full truncate font-serif text-xs italic text-sherlock-text-secondary"
          title={world.timelineNode}
        >
          剧情相位 · {world.timelineNode}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="glass-panel rounded-xl border border-white/10 p-4">
            <h3 className="mb-3 flex items-center gap-2 border-b border-white/10 pb-2 font-serif text-lg font-bold tracking-wide text-sherlock-gold">
              <Sparkles className="h-4 w-4 text-sherlock-gold" />
              自身状态
            </h3>
            <p className="sherlock-epigraph mb-4 text-[11px] leading-relaxed text-sherlock-text-secondary">
              行动余地、七维才具、异界层级与已镌刻的加护——雾都档案在此与你对镜。
            </p>

            <div className="mb-4">
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-sherlock-text-muted">行动余地</span>
                <span className="tabular-nums text-sherlock-text-primary">{Math.round(apRatio)}%</span>
              </div>
              <div className="sherlock-ap-bar-glow h-1.5 w-full overflow-hidden rounded-full bg-black/75 ring-1 ring-sherlock-gold/12">
                <div
                  className="h-full rounded-full bg-linear-to-r from-sherlock-red/55 via-sherlock-gold/75 to-amber-600/45 transition-[width] duration-500"
                  style={{ width: `${apRatio}%` }}
                />
              </div>
              {player.apReserve != null ? (
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-sherlock-text-muted">封存余力</span>
                  <span className="tabular-nums text-sherlock-blue">{player.apReserve}</span>
                </div>
              ) : null}
              <p className="mt-2 text-[10px] leading-relaxed text-sherlock-text-muted">
                长条按气力上限折成百分比；剧情与货架兑换仍按案卷里的点数落账。另有一行封存余力时，表示你还压着一手未动的底牌。
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShopOpen(o => !o);
                setSelectedShop(null);
                setTraitDetailKey(null);
                setShopCategoryFilter('all');
              }}
              className="sherlock-tier-shimmer group mb-4 flex w-full items-center justify-between rounded-lg border border-sherlock-gold/40 px-3 py-3 text-left transition hover:border-sherlock-gold/70"
            >
              <div>
                <p className="text-[10px] tracking-wide text-sherlock-text-muted">异界干涉层级 · 启封次元商城</p>
                <p className="text-2xl font-bold text-sherlock-gold tabular-nums">{tier}</p>
                <p className="mt-1 text-[10px] italic text-sherlock-text-muted">
                  层级决定异界许可；货架奇物带传承门类标签，与下方六门同一套分类。
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Store className="h-8 w-8 text-sherlock-gold/80" />
                {shopOpen ? <ChevronUp className="h-4 w-4 text-sherlock-text-muted" /> : <ChevronDown className="h-4 w-4 text-sherlock-text-muted" />}
              </div>
            </button>

            <div className="space-y-2">
              <h4 className="font-serif text-xs font-semibold tracking-[0.2em] text-sherlock-text-secondary">七维才具</h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ATTR_RADAR_ORDER.map(subject => {
                  const raw = player.attrs[subject] ?? 0;
                  const pct = clampPct(raw);
                  return (
                    <div
                      key={subject}
                      className="rounded-lg border border-white/5 bg-black/30 px-3 py-2"
                    >
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-sherlock-text-primary">{subject}</span>
                        <span className="tabular-nums text-sherlock-gold">{raw}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/50">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-sherlock-blue/80 to-sherlock-gold/90"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] italic leading-relaxed text-sherlock-text-muted">
                探案掷骰依 1d20；才具愈高愈易成事，气运在关头偏斜天平，特质可压低险关。
              </p>
            </div>
          </div>

          <div className="glass-panel flex min-h-56 flex-col rounded-xl border border-white/10 p-4">
            <h3 className="mb-1 font-serif text-base font-bold text-sherlock-gold">七维雷达</h3>
            <p className="mb-3 text-[10px] italic text-sherlock-text-muted">尖角愈长，该项才具在雾都棋盘上愈显眼。</p>
            <SevenAxisRadar data={radarData} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel rounded-xl border border-white/10 p-4">
            <h3 className="mb-3 border-b border-white/10 pb-2 font-serif font-bold text-sherlock-green">已镌刻特质</h3>
            <p className="mb-3 text-[10px] italic text-sherlock-text-muted">
              在商城兑换成功后会写回此处；属性加减仍以剧情与掷骰说明为准。
            </p>
            {traitEntries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center text-sm italic text-sherlock-text-muted">
                尚无特质——待你在博弈与货架中挣得第一枚印记。
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {traitEntries.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex flex-col gap-1 rounded-lg border border-sherlock-gold/25 bg-black/35 px-3 py-2"
                  >
                    <span className="text-xs font-medium text-sherlock-gold">{k}</span>
                    <span className="break-all text-[11px] leading-relaxed text-sherlock-text-secondary">
                      {formatTraitValue(v)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/25 p-4">
            <h4 className="mb-1 font-serif text-xs font-bold tracking-[0.15em] text-sherlock-text-muted">六大传承门类</h4>
            <p className="mb-3 text-[10px] italic text-sherlock-text-muted">
              与商城奇物的「传承门类」一致；数字为你在该门类已兑件数。
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TRAIT_CATEGORY_DETAILS.map(c => {
                const n = categoryPurchaseTotals[c.key as TraitCategoryKey] ?? 0;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      setTraitDetailKey(c.key);
                      setShopOpen(false);
                      setSelectedShop(null);
                    }}
                    className={cn(
                      'rounded-lg border border-white/15 bg-linear-to-br px-3 py-2.5 text-left text-[11px] transition hover:border-sherlock-gold/45 hover:shadow-[inset_0_0_20px_rgba(184,134,11,0.08)]',
                      c.accent,
                    )}
                  >
                    <div className="font-semibold text-sherlock-text-primary">{c.title}</div>
                    <div className="mt-0.5 text-sherlock-text-muted">{c.hint}</div>
                    {n > 0 ? (
                      <span className="mt-1.5 block text-[9px] text-emerald-400/95">已兑 {n} 件</span>
                    ) : (
                      <span className="mt-1.5 block text-[9px] text-sherlock-gold/75">轻触展卷 →</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {activeTraitDetail ? (
        <TraitCategoryDetailOverlay detail={activeTraitDetail} onClose={() => setTraitDetailKey(null)} />
      ) : null}

      {/* 次元商城浮层 */}
      {shopOpen
        ? createPortal(
            <div className="fixed inset-0 z-9999 flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="dimensional-shop-title">
              <button
                type="button"
                className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
                aria-label="关闭次元商城"
                onClick={() => {
                  setShopOpen(false);
                  setSelectedShop(null);
                }}
              />
              <div
                className="relative flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-purple-500/45 bg-[#070b11]/95 shadow-[0_0_60px_rgba(88,28,135,0.35)]"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-purple-500/25 bg-purple-950/30 px-4 py-3">
                  <div className="min-w-0">
                    <h3 id="dimensional-shop-title" className="flex items-center gap-2 text-lg font-bold text-purple-100">
                      <Store className="h-5 w-5 shrink-0 text-purple-300" />
                      次元商城
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-sherlock-text-secondary">
                      <span>
                        行动余地{' '}
                        <strong className="text-sherlock-gold">
                          {player.apMax > 0 ? Math.round(clampPct((player.ap / player.apMax) * 100)) : 0}%
                        </strong>
                      </span>
                      <span>
                        异界层级 <strong className="text-sherlock-text-primary">{tier}</strong>
                      </span>
                      {player.apReserve != null ? (
                        <span>
                          封存余力 <strong className="text-sherlock-blue">{player.apReserve}</strong>
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[10px] leading-relaxed text-sherlock-text-muted">
                      左栏可按<strong>传承门类</strong>筛选奇物。标价较名录基价大约上浮七成半，与兑换实扣一致。兑换会消耗行动余地并写入你的加护；若剧情里尚未解锁对应线索，请先玩到那一幕再换。
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-white/15 bg-black/40 p-2 text-sherlock-text-muted transition hover:border-sherlock-red/40 hover:text-sherlock-red"
                    aria-label="关闭"
                    onClick={() => {
                      setShopOpen(false);
                      setSelectedShop(null);
                    }}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                  <div className="sherlock-scroll-y-invisible min-h-0 flex-[1.15] border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShopCategoryFilter('all')}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[10px] transition',
                          shopCategoryFilter === 'all'
                            ? 'border-sherlock-gold/60 bg-sherlock-gold/15 text-sherlock-gold'
                            : 'border-white/15 bg-black/30 text-sherlock-text-muted hover:border-white/25',
                        )}
                      >
                        全部
                      </button>
                      {TRAIT_CATEGORY_KEYS.map(k => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setShopCategoryFilter(k)}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[10px] transition',
                            shopCategoryFilter === k
                              ? 'border-sherlock-gold/60 bg-sherlock-gold/15 text-sherlock-gold'
                              : 'border-white/15 bg-black/30 text-sherlock-text-muted hover:border-white/25',
                          )}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      {filteredSectionTags.map(tag => {
                        const group = filteredShopItems.filter(i => i.tag === tag);
                        if (group.length === 0) return null;
                        return (
                          <Fragment key={tag}>
                            <div
                              className={cn(
                                'col-span-full flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold tracking-wide',
                                shopSeriesClass(tag),
                              )}
                            >
                              <span className="min-w-0 truncate">{tag}</span>
                              <span className="ml-auto shrink-0 text-[9px] opacity-90">{group.length} 件</span>
                            </div>
                            {group.map(item => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setSelectedShop(selectedShop?.id === item.id ? null : item)}
                                className={cn(
                                  'rounded-lg border p-3 text-left transition',
                                  shopSeriesClass(item.tag),
                                  selectedShop?.id === item.id
                                    ? 'ring-2 ring-sherlock-gold ring-offset-2 ring-offset-[#070b11]'
                                    : 'hover:brightness-110',
                                )}
                              >
                                <div className="mb-1 flex items-start justify-between gap-2">
                                  <span className="text-[11px] font-bold leading-snug text-sherlock-text-primary">
                                    {item.name}
                                  </span>
                                  <span className="shrink-0 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-amber-200">
                                    需 {item.apCost} 点气力
                                  </span>
                                </div>
                                <p className="text-[9px] text-sherlock-blue/90">门类 · {item.traitCategory}</p>
                                <p className="text-[9px] text-sherlock-text-muted">{item.ipSubtitle}</p>
                                {item.id >= DYNAMIC_SHOP_ID_MIN ? (
                                  <p className="mt-1 text-[9px] text-emerald-300/85">剧情上架 · #{item.id}</p>
                                ) : null}
                                {item.purchaseLimit != null ? (
                                  <p className="mt-1 text-[9px] text-red-300/90">限购 {item.purchaseLimit}</p>
                                ) : null}
                              </button>
                            ))}
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex min-h-[200px] w-full shrink-0 flex-col border-t border-white/10 bg-black/35 lg:min-h-0 lg:w-[38%] lg:max-w-none lg:shrink-0 lg:border-l lg:border-t-0">
                    <div className="sherlock-scroll-y-invisible min-h-0 flex-1 p-4">
                      {selectedShop ? (
                        <div className="rounded-lg border border-sherlock-gold/35 bg-black/50 p-4 text-sm">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h4 className="font-serif text-base text-sherlock-gold">{selectedShop.name}</h4>
                            <span className="rounded border border-sherlock-blue/35 bg-sherlock-blue/10 px-2 py-0.5 text-[10px] text-sherlock-blue">
                              {traitCategoryTitle(selectedShop.traitCategory)}
                            </span>
                          </div>
                          <p className="mb-3 leading-relaxed text-sherlock-text-secondary">{selectedShop.effect}</p>
                          <p className="mb-3 text-xs leading-relaxed text-sherlock-blue">
                            <span className="text-sherlock-text-muted">剧情条件（摘要）：</span>
                            {selectedShop.acquire}
                          </p>
                          {(() => {
                            const bought = player.shopPurchaseCounts[selectedShop.id] ?? 0;
                            const cap = selectedShop.purchaseLimit;
                            const atCap = cap != null && bought >= cap;
                            const afford = player.ap >= selectedShop.apCost;
                            return (
                              <div className="border-t border-white/10 pt-3">
                                <p className="mb-2 text-[11px] text-sherlock-text-muted">
                                  已兑 <span className="text-sherlock-text-primary">{bought}</span>
                                  {cap != null ? ` / 限购 ${cap}` : ''}
                                </p>
                                <button
                                  type="button"
                                  disabled={shopPurchasing || atCap || !afford}
                                  onClick={async () => {
                                    if (shopPurchasing) return;
                                    setShopPurchasing(true);
                                    try {
                                      const r = await purchaseDimensionalShopItem(selectedShop.id);
                                      if (r.ok) {
                                        toastr.success(
                                          `已兑换「${selectedShop.name}」，消耗 ${selectedShop.apCost} 点气力`,
                                          '次元商城',
                                        );
                                        await refresh();
                                      } else {
                                        toastr.error(r.reason, '次元商城');
                                      }
                                    } finally {
                                      setShopPurchasing(false);
                                    }
                                  }}
                                  className={cn(
                                    'w-full rounded-lg border px-3 py-2.5 text-sm font-medium transition',
                                    atCap || !afford
                                      ? 'cursor-not-allowed border-white/10 bg-black/30 text-sherlock-text-muted'
                                      : 'border-sherlock-gold/50 bg-sherlock-gold/15 text-sherlock-gold hover:bg-sherlock-gold/25',
                                  )}
                                >
                                  {shopPurchasing
                                    ? '写入中…'
                                    : atCap
                                      ? '已达限购'
                                      : !afford
                                        ? `气力不足（还需 ${selectedShop.apCost} 点）`
                                        : `兑换（扣 ${selectedShop.apCost} 点气力）`}
                                </button>
                                <p className="mt-2 text-[10px] leading-relaxed text-sherlock-text-muted">
                                  此处只校验点数与限购；羁绊、层级与剧情许可仍以叙事为准——若故事里说你还不能拿，就先接着玩下去。
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 bg-black/25 px-4 text-center">
                          <Sparkles className="h-8 w-8 text-sherlock-gold/40" />
                          <p className="text-sm italic text-sherlock-text-muted">点选左栏一枚，在此品读效果与换取条件。</p>
                          <p className="text-[10px] text-sherlock-text-muted">
                            货架共 {shopCatalog.length} 件，其中名录常设 {DIMENSIONAL_SHOP_ITEMS.length} 件
                            {shopCatalog.some(i => i.id >= DYNAMIC_SHOP_ID_MIN)
                              ? `，剧情另增 ${shopCatalog.filter(i => i.id >= DYNAMIC_SHOP_ID_MIN).length} 件`
                              : ''}
                            ；当前筛选可见 {filteredShopItems.length} 件。
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            getSherlockPortalRoot(),
          )
        : null}
    </div>
  );
}

function PlotModal() {
  const { stats } = useSherlockStats();
  const { world, faction } = stats;
  const intel = clampPct(faction.intelCoverage);
  const anchorKey = world.timelineNode || '雾都锚点';
  const phase = useMemo(() => plotPhaseBadge(anchorKey), [anchorKey]);
  const timeFlavor = useMemo(() => plotTimeFlavor(world.time), [world.time]);
  const syncNarr = useMemo(() => plotSyncNarrative(intel), [intel]);
  const stMain = GAME_CARD_PALETTES[paletteHash(anchorKey) % GAME_CARD_PALETTES.length];
  const stIntel = GAME_CARD_PALETTES[paletteHash(`${anchorKey}-intel`) % GAME_CARD_PALETTES.length];
  const stRank = GAME_CARD_PALETTES[paletteHash(`${anchorKey}-rank`) % GAME_CARD_PALETTES.length];

  const breathDots = [0, 1, 2, 3, 4, 5, 6];

  return (
    <div className="space-y-5">
      {/* 顶栏：联网同步 + 故事呼吸点阵 */}
      <div className="relative overflow-hidden rounded-2xl border border-sherlock-gold/25 bg-linear-to-r from-black/70 via-amber-950/25 to-cyan-950/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-6 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-cyan-500/25 bg-black/45 px-2.5 py-1.5">
              <Radio className="h-4 w-4 shrink-0 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)] animate-[pulse_1.4s_ease-in-out_infinite]" strokeWidth={2} />
              <Link2 className="h-4 w-4 shrink-0 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)] animate-[pulse_1.8s_ease-in-out_infinite_0.2s]" strokeWidth={2} />
              <Activity className="h-4 w-4 shrink-0 text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-[pulse_1.2s_ease-in-out_infinite_0.4s]" strokeWidth={2} />
              <span className="text-[11px] font-medium tracking-wide text-sherlock-text-secondary">案卷脉动</span>
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
              </span>
            </div>
            <span
              className={cn(
                'inline-flex items-center rounded-md border px-2 py-0.5 font-serif text-[10px] font-bold tracking-[0.2em]',
                phase.chipClass,
              )}
            >
              {phase.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5" aria-hidden title="故事呼吸灯">
            <span className="mr-1 font-serif text-[9px] tracking-[0.35em] text-sherlock-gold/70">呼吸</span>
            {breathDots.map(i => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-linear-to-br from-amber-300/95 to-cyan-400/80 shadow-[0_0_10px_rgba(251,191,36,0.35)]"
                style={{ animation: 'pulse 2.4s ease-in-out infinite', animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </div>
        </div>
        <p className="relative mt-2 text-xs leading-relaxed text-sherlock-text-muted">{timeFlavor}</p>
      </div>

      {/* 主锚点卡：侧柱呼吸灯 + 纪年 */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border p-5 sm:p-6',
          stMain.border,
          stMain.bg,
          stMain.glow,
        )}
      >
        <div className={cn('pointer-events-none absolute -right-6 -top-6 h-40 w-40 rounded-full blur-2xl', stMain.orb)} />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-stretch">
          {/* 故事呼吸灯柱 */}
          <div className="flex shrink-0 flex-row items-stretch justify-center gap-3 md:flex-col md:items-center">
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-black/80 ring-1 ring-amber-950/50 md:h-auto md:min-h-[120px] md:w-1.5 md:rounded-full md:ring-amber-950/40">
              <div
                className="absolute inset-0 rounded-full bg-linear-to-r from-amber-700/25 via-cyan-900/20 to-amber-900/18 md:bg-linear-to-b"
                style={{
                  opacity: 0.22 + intel / 520,
                  animation: 'pulse 4.2s ease-in-out infinite',
                }}
              />
            </div>
            <div className="hidden text-center md:block">
              <p className="font-serif text-[9px] tracking-[0.4em] text-sherlock-gold/75">锚点</p>
              <p className="mt-1 max-w-18 text-[10px] leading-tight text-sherlock-text-muted">叙事节拍与案情松紧在此相会</p>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <p className="font-serif text-[10px] tracking-[0.35em] text-sherlock-gold/85">雾都纪年 剧情锚点</p>
              <h3 className="mt-1 font-serif text-xl font-bold tracking-wide text-sherlock-gold drop-shadow-[0_0_12px_rgba(184,134,11,0.2)]">
                {anchorKey}
              </h3>
            </div>

            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                <dt className="mb-1 flex items-center gap-1.5 text-[11px] text-sherlock-text-muted">
                  <MapPin className="h-3.5 w-3.5 text-amber-400/90" />
                  当前日期
                </dt>
                <dd className="font-medium text-sherlock-text-primary">{world.date}</dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                <dt className="mb-1 flex items-center gap-1.5 text-[11px] text-sherlock-text-muted">
                  <Clock className="h-3.5 w-3.5 text-cyan-400/90" />
                  当前时间
                </dt>
                <dd className="tabular-nums text-sherlock-text-primary">{world.time}</dd>
              </div>
              <div className="rounded-xl border border-sherlock-gold/20 bg-sherlock-gold/5 p-3 sm:col-span-2">
                <dt className="mb-1 flex items-center gap-1.5 text-[11px] text-sherlock-text-muted">
                  <BookOpen className="h-3.5 w-3.5 text-sherlock-gold" />
                  时间线节点
                </dt>
                <dd className="text-base font-semibold leading-snug text-sherlock-gold">{world.timelineNode}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="relative space-y-6 border-l-2 border-white/10 pl-6 lg:col-span-2">
          <div
            className={cn(
              'relative rounded-2xl border p-5',
              stMain.border,
              'bg-black/35',
            )}
          >
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-amber-500/5 via-transparent to-cyan-500/8" />
            <div className="relative">
              <TimelineNode
                title={world.timelineNode || '当前节点'}
                status="active"
                desc="案情推进，时间线随之扭转；此处是你此刻所立的相位。情报越足，越敢收束；情报不足，就留悬念与误判的余地。"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className={cn('relative overflow-hidden rounded-2xl border p-4', stIntel.border, stIntel.bg, stIntel.glow)}>
            <div className={cn('pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full blur-2xl', stIntel.orb)} />
            <div className="relative">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-sherlock-text-primary">情报覆盖度</h4>
                <Globe2 className="h-4 w-4 text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.45)] animate-[pulse_2s_ease-in-out_infinite]" />
              </div>
              <div className={cn('mb-2 h-2.5 w-full overflow-hidden rounded-full', stIntel.barTrack)}>
                <div
                  className={cn('h-full transition-[width] duration-500', stIntel.barFill)}
                  style={{ width: `${intel}%` }}
                />
              </div>
              <p className="text-right text-xs text-sherlock-text-muted tabular-nums">{intel}%</p>
              <p className="mt-2 font-serif text-xs font-semibold text-sky-200/95">{syncNarr.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-sherlock-text-muted">{syncNarr.body}</p>
            </div>
          </div>

          <div className={cn('relative overflow-hidden rounded-2xl border p-4', stRank.border, stRank.bg, stRank.glow)}>
            <div className={cn('pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full blur-2xl', stRank.orb)} />
            <div className="relative">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-sherlock-text-primary">演绎等级</h4>
                <Sparkles className="h-4 w-4 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)] animate-[pulse_2.4s_ease-in-out_infinite]" />
              </div>
              <p className="font-serif text-2xl font-bold text-sherlock-gold">{faction.deductionRank}</p>
              <p className="mt-2 text-xs italic leading-relaxed text-sherlock-text-muted">{DEDUCTION_RANK_LORE}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type FactionInsight = { kind: 'metric'; id: FactionMetricId; value: number } | { kind: 'rank'; text: string };

function factionMetricLucide(id: FactionMetricId) {
  const m: Record<FactionMetricId, ComponentType<{ className?: string; strokeWidth?: number }>> = {
    clueWeight: Search,
    policeVoice: Megaphone,
    intelCoverage: Globe2,
    trustTotal: Handshake,
    policeCredibility: BadgeCheck,
    teamMorale: Flame,
    chessControl: Crown,
    securityLevel: Shield,
    stealth: Eye,
    lawBoundary: Gavel,
    infoControl: FileLock,
    gameBottom: Swords,
    abilityUse: Sparkles,
  };
  return m[id] ?? Search;
}

function FactionInsightOverlay({ insight, onClose }: { insight: FactionInsight; onClose: () => void }) {
  const { stats } = useSherlockStats();

  if (insight.kind === 'rank') {
    return createPortal(
      <div className="fixed inset-0 z-10050 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
        <button type="button" className="absolute inset-0 bg-black/82 backdrop-blur-[3px]" aria-label="关闭" onClick={onClose} />
        <div
          className="relative w-full max-w-md rounded-2xl border border-sky-500/35 bg-[#060a10]/98 p-6 shadow-[0_0_48px_rgba(14,165,233,0.2)]"
          onClick={e => e.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <h3 className="font-serif text-xl font-bold text-sky-200">演绎等级</h3>
            <button
              type="button"
              className="rounded-lg border border-white/15 p-2 text-sherlock-text-muted hover:border-sherlock-red/40 hover:text-sherlock-red"
              aria-label="关闭"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mb-4 font-serif text-2xl text-sherlock-gold">{insight.text}</p>
          <p className="text-sm leading-relaxed text-sherlock-text-secondary">{DEDUCTION_RANK_LORE}</p>
        </div>
      </div>,
      getSherlockPortalRoot(),
    );
  }

  const meta = getFactionMetricMeta(insight.id);
  const attrs = stats.player.attrs;
  const v = clampPct(insight.value);
  const Icon = factionMetricLucide(insight.id);

  return createPortal(
    <div className="fixed inset-0 z-10050 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/82 backdrop-blur-[3px]" aria-label="关闭" onClick={onClose} />
      <div
        className="relative max-h-[min(88vh,680px)] w-full max-w-lg sherlock-scroll-y-invisible rounded-2xl border border-rose-500/30 bg-[#070a11]/98 p-5 shadow-[0_0_52px_rgba(244,63,94,0.15)] sm:p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3 border-b border-white/10 pb-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rose-400/35 bg-black/45">
            <Icon className="h-6 w-6 text-rose-200/95" strokeWidth={1.25} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[10px] tracking-[0.28em] text-rose-300/85">阵营态势</p>
            <h3 className="font-serif text-xl font-bold text-sherlock-text-primary">{meta.title}</h3>
            <p className="text-[11px] text-sherlock-text-muted">{meta.subtitle}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-white/15 p-2 text-sherlock-text-muted hover:border-rose-400/45 hover:text-rose-200"
            aria-label="关闭"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums text-sherlock-gold">{v}%</span>
          <span className="text-xs text-sherlock-text-muted">当前刻度</span>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-sherlock-text-secondary">{meta.synergy}</p>

        <div className="mb-4 rounded-xl border border-white/10 bg-black/35 p-3">
          <h4 className="mb-2 flex items-center gap-2 font-serif text-xs font-bold text-sherlock-gold">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            联动七维
          </h4>
          <ul className="space-y-2">
            {meta.primaryAttrs.map(attr => {
              const n = attrs[attr] ?? 0;
              const pct = clampPct(n);
              return (
                <li key={attr} className="flex items-center gap-2 text-xs">
                  <span className="w-14 shrink-0 text-sherlock-text-muted">{attr}</span>
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-black/55 ring-1 ring-white/10">
                    <div
                      className="h-full bg-linear-to-r from-rose-500/90 to-amber-500/75"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right tabular-nums text-sherlock-text-primary">{n}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mb-4 rounded-xl border border-fuchsia-500/25 bg-fuchsia-950/15 p-3">
          <h4 className="mb-2 font-serif text-xs font-bold text-fuchsia-200">传承门类</h4>
          <div className="flex flex-wrap gap-2">
            {meta.traitCategories.map(k => (
              <span
                key={k}
                className="rounded-md border border-fuchsia-400/30 bg-black/45 px-2 py-1 text-[10px] text-fuchsia-100/95"
              >
                {traitCategoryTitle(k)}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-sherlock-blue/25 bg-sherlock-blue/5 p-3">
          <h4 className="mb-1 font-serif text-xs font-bold text-sherlock-blue">游玩提示</h4>
          <p className="text-xs leading-relaxed text-sherlock-text-secondary">{meta.playTip}</p>
        </div>
      </div>
    </div>,
    getSherlockPortalRoot(),
  );
}

function FactionModal() {
  const { stats } = useSherlockStats();
  const f = stats.faction;
  const [insight, setInsight] = useState<FactionInsight | null>(null);
  const pressure = factionCorePressure(f);

  const openMetric = (id: FactionMetricId, value: number) => setInsight({ kind: 'metric', id, value });

  const renderMetricCard = (id: FactionMetricId, value: number) => {
    const meta = getFactionMetricMeta(id);
    const v = clampPct(value);
    const st = GAME_CARD_PALETTES[paletteHash(id) % GAME_CARD_PALETTES.length];
    const Icon = factionMetricLucide(id);
    return (
      <div
        key={id}
        role="button"
        tabIndex={0}
        className={cn(
          'group/fc relative cursor-pointer rounded-xl border p-4 transition duration-300 hover:brightness-110',
          st.border,
          st.bg,
          st.glow,
        )}
        onClick={() => openMetric(id, value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openMetric(id, value);
          }
        }}
      >
        <div className={cn('pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full opacity-40 blur-2xl', st.orb)} aria-hidden />
        <div className="relative flex items-start gap-3">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-black/40 shadow-inner', st.border)}>
            <Icon className="h-5 w-5 text-sherlock-text-primary/95" strokeWidth={1.3} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-serif text-sm font-bold text-sherlock-text-primary">{meta.title}</h4>
            <p className="mt-0.5 text-[10px] text-sherlock-text-muted">{meta.subtitle}</p>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-lg font-bold tabular-nums text-sherlock-gold">{v}%</span>
            </div>
          </div>
        </div>
        <div className={cn('relative mt-3 h-2 w-full overflow-hidden rounded-full', st.barTrack)}>
          <div className={cn('h-full rounded-full transition-[width] duration-500', st.barFill)} style={{ width: `${v}%` }} />
        </div>
        <p className="mt-2 line-clamp-2 text-[9px] leading-relaxed text-rose-100/85 transition-[line-clamp] group-hover/fc:line-clamp-none">
          <span className="font-semibold text-amber-200/90">提示</span> · {meta.playTip}
        </p>
        <p className="mt-1 text-center text-[9px] text-sherlock-text-muted">轻触卡片可阅属性与门类</p>
      </div>
    );
  };

  const renderRuleCard = (id: FactionMetricId, value: number) => {
    const meta = getFactionMetricMeta(id);
    const v = clampPct(value);
    const st = GAME_CARD_PALETTES[paletteHash(`rule-${id}`) % GAME_CARD_PALETTES.length];
    return (
      <div
        key={id}
        className={cn('rounded-xl border p-4', st.border, st.bg, st.glow)}
        role="button"
        tabIndex={0}
        onClick={() => openMetric(id, value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openMetric(id, value);
          }
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-sherlock-text-primary">{meta.title}</span>
          <span className="text-xs text-sherlock-gold tabular-nums">{v}%</span>
        </div>
        <div className="relative mb-2 h-2.5 cursor-pointer rounded-full border border-white/10 bg-black/50">
          <div className={cn('absolute bottom-0 left-0 top-0 rounded-full transition-[width] duration-300', st.barFill)} style={{ width: `${v}%` }} />
          <div
            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-black bg-sherlock-gold/90 shadow-[0_0_10px_rgba(184,134,11,0.75)] transition-[left] duration-300"
            style={{ left: `calc(${v}% - 8px)` }}
          />
        </div>
        <p className="line-clamp-2 text-[10px] italic text-sherlock-text-muted">{meta.synergy}</p>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/28 bg-linear-to-r from-rose-950/25 via-black/38 to-amber-500/10 px-4 py-3 shadow-[0_0_24px_rgba(244,63,94,0.09)]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-rose-400/35 bg-black/45 shadow-[inset_0_0_18px_rgba(244,63,94,0.1)]">
            <Scale className="h-6 w-6 text-rose-300/95" />
          </div>
          <div className="min-w-0">
            <p className="font-serif text-sm font-bold tracking-wide text-rose-100">雾都 · 势力天平</p>
            <p className="text-[10px] text-sherlock-text-muted">核心四资源均压 · 与七维、传承门类、检定叙事联动</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] tabular-nums">
          <span className="rounded-md border border-white/10 bg-black/35 px-2 py-1 text-sherlock-text-muted">
            压强指数 <span className="font-bold text-sherlock-gold">{pressure}</span>
          </span>
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-serif text-sm font-bold tracking-wide text-sherlock-gold">核心资源</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {renderMetricCard('clueWeight', f.clueWeight)}
          {renderMetricCard('policeVoice', f.policeVoice)}
          {renderMetricCard('intelCoverage', f.intelCoverage)}
          {renderMetricCard('trustTotal', f.trustTotal)}
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-serif text-sm font-bold tracking-wide text-sherlock-gold">声望与环境</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <button
            type="button"
            className="group/rk rounded-xl border border-sky-400/35 bg-linear-to-br from-sky-950/40 via-black/40 to-indigo-950/30 p-4 text-left shadow-[0_0_22px_rgba(56,189,248,0.1)] transition hover:brightness-110"
            onClick={() => setInsight({ kind: 'rank', text: f.deductionRank })}
          >
            <p className="text-[10px] text-sky-200/85">演绎等级</p>
            <p className="mt-1 font-serif text-xl font-bold text-sherlock-gold">{f.deductionRank}</p>
            <p className="mt-2 line-clamp-2 text-[9px] text-sherlock-text-muted group-hover/rk:line-clamp-none">{DEDUCTION_RANK_LORE}</p>
            <p className="mt-2 text-[9px] text-sky-300/80">轻触阅名望释义</p>
          </button>
          {renderMetricCard('policeCredibility', f.policeCredibility)}
          {renderMetricCard('teamMorale', f.teamMorale)}
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-serif text-sm font-bold tracking-wide text-sherlock-gold">宏观属性</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {renderMetricCard('chessControl', f.macro.chessControl)}
          {renderMetricCard('securityLevel', f.macro.securityLevel)}
          {renderMetricCard('stealth', f.macro.stealth)}
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-serif text-sm font-bold tracking-wide text-sherlock-gold">探案准则</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderRuleCard('lawBoundary', f.rules.lawBoundary)}
          {renderRuleCard('infoControl', f.rules.infoControl)}
          {renderRuleCard('gameBottom', f.rules.gameBottom)}
          {renderRuleCard('abilityUse', f.rules.abilityUse)}
        </div>
      </div>

      {insight ? <FactionInsightOverlay insight={insight} onClose={() => setInsight(null)} /> : null}
    </div>
  );
}

function bondFactionIcon(name: string) {
  if (/大英|政府|内阁|王室|白厅/.test(name)) return Crown;
  if (/莫里亚蒂|犯罪网络/.test(name)) return Skull;
  if (/谢林福特|欧洛丝|监禁|东风/.test(name)) return BrainCircuit;
  if (/地下|线人|耳目|帮派/.test(name)) return Eye;
  return Network;
}

function BondFactionOverlay({
  name,
  bondPct,
  onClose,
}: {
  name: string;
  bondPct: number;
  onClose: () => void;
}) {
  const { stats } = useSherlockStats();
  const meta = resolveBondFaction(name);
  const tier = bondTierFromPct(bondPct);
  const pips = bondSynergyPips(bondPct);
  const attrs = stats.player.attrs;

  return createPortal(
    <div
      className="fixed inset-0 z-10050 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bond-faction-overlay-title"
    >
      <button type="button" className="absolute inset-0 bg-black/82 backdrop-blur-[3px]" aria-label="关闭" onClick={onClose} />
      <div
        className="relative max-h-[min(88vh,680px)] w-full max-w-lg sherlock-scroll-y-invisible rounded-2xl border border-fuchsia-500/35 bg-[#070a12]/98 p-5 shadow-[0_0_56px_rgba(168,85,247,0.2)] sm:p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/10 pb-3">
          <div className="min-w-0">
            <p className="font-serif text-[10px] tracking-[0.3em] text-fuchsia-300/85">暗线同盟档案</p>
            <h3 id="bond-faction-overlay-title" className="mt-1 font-serif text-xl font-bold tracking-wide text-fuchsia-100">
              {name}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-full bg-linear-to-r px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm',
                  tier.accent,
                )}
              >
                {tier.label}
              </span>
              <span className="text-sm tabular-nums text-sherlock-gold">{bondPct}%</span>
              <span className="text-[10px] text-sherlock-text-muted">协同档 {pips}/5</span>
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-white/15 bg-black/50 p-2 text-sherlock-text-muted transition hover:border-fuchsia-400/50 hover:text-fuchsia-200"
            aria-label="关闭"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 inline-block rounded border border-fuchsia-500/25 bg-fuchsia-950/25 px-2 py-0.5 text-[10px] text-fuchsia-200/90">
          {meta.tagline}
        </p>
        <p className="mb-4 text-sm leading-relaxed text-sherlock-text-secondary">{meta.synergy}</p>

        <div className="mb-4 rounded-xl border border-white/10 bg-black/35 p-3">
          <h4 className="mb-2 flex items-center gap-2 font-serif text-xs font-bold text-sherlock-gold">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            联动七维（当前角色）
          </h4>
          <ul className="space-y-2">
            {meta.primaryAttrs.map(attr => {
              const n = attrs[attr] ?? 0;
              const pct = clampPct(n);
              return (
                <li key={attr} className="flex items-center gap-2 text-xs">
                  <span className="w-14 shrink-0 text-sherlock-text-muted">{attr}</span>
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-black/55 ring-1 ring-white/10">
                    <div
                      className="h-full bg-linear-to-r from-fuchsia-500/90 to-amber-500/80"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right tabular-nums text-sherlock-text-primary">{n}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-950/15 p-3">
          <h4 className="mb-2 flex items-center gap-2 font-serif text-xs font-bold text-amber-200/95">
            <GitBranch className="h-3.5 w-3.5" />
            传承门类 · 叙事衔接
          </h4>
          <div className="flex flex-wrap gap-2">
            {meta.traitCategories.map(k => {
              const d = TRAIT_CATEGORY_DETAILS.find(c => c.key === k);
              return (
                <span
                  key={k}
                  title={d?.lore ?? ''}
                  className="rounded-md border border-fuchsia-400/30 bg-black/45 px-2 py-1 text-[10px] font-medium text-fuchsia-100/95"
                >
                  {traitCategoryTitle(k)}
                </span>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-sherlock-text-muted">
            与「自身状态 · 异界加护」中对应门类加成、次元商城奇物门类一致，便于叙事与数值对齐。
          </p>
        </div>

        <div className="rounded-lg border border-sherlock-blue/25 bg-sherlock-blue/5 p-3">
          <h4 className="mb-1 font-serif text-xs font-bold text-sherlock-blue">游玩提示</h4>
          <p className="text-xs leading-relaxed text-sherlock-text-secondary">{meta.playTip}</p>
        </div>
      </div>
    </div>,
    getSherlockPortalRoot(),
  );
}

function BondsModal() {
  const { stats } = useSherlockStats();
  const [detailName, setDetailName] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'bond' | 'name'>('bond');

  const entries = useMemo(() => {
    const e = Object.entries(stats.bondFactions);
    if (sortKey === 'bond') return e.sort((a, b) => b[1] - a[1]);
    return e.sort((a, b) => a[0].localeCompare(b[0], 'zh-Hans-CN'));
  }, [stats.bondFactions, sortKey]);

  const avgBond =
    entries.length > 0 ? Math.round(entries.reduce((s, [, v]) => s + clampPct(v), 0) / entries.length) : 0;

  if (entries.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-fuchsia-500/25 bg-linear-to-br from-black/60 via-fuchsia-950/15 to-purple-950/20 p-8 shadow-[inset_0_0_60px_rgba(168,85,247,0.06)]">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-500/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-fuchsia-400/35 bg-black/45 shadow-[0_0_28px_rgba(168,85,247,0.15)]">
            <Users className="h-10 w-10 text-fuchsia-300/90" strokeWidth={1.15} />
          </div>
          <p className="font-serif text-base font-semibold tracking-wide text-fuchsia-200/95">丝线未系</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-sherlock-text-secondary">
            尚未与任何派系缔结可见的盟约。推进剧情后，大英政府、暗网、线人与高墙之内的名字将在此显影。
          </p>
          <p className="mt-4 text-[10px] text-sherlock-text-muted">派系卷轴尚空，待剧情落笔。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-fuchsia-500/30 bg-linear-to-r from-fuchsia-950/30 via-black/35 to-amber-500/10 px-4 py-3 shadow-[0_0_24px_rgba(168,85,247,0.1)]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-fuchsia-400/35 bg-black/45 shadow-[inset_0_0_18px_rgba(168,85,247,0.12)]">
            <Network className="h-6 w-6 text-fuchsia-300/95" />
          </div>
          <div className="min-w-0">
            <p className="font-serif text-sm font-bold tracking-wide text-fuchsia-200">雾都 · 暗线同盟网络</p>
            <p className="text-[10px] text-sherlock-text-muted">派系羁绊 · 与七维、传承门类叙事联动（轻触卡片看档案）</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-md border border-white/10 bg-black/35 px-2 py-1 text-[11px] tabular-nums text-sherlock-text-muted">
            均势 <span className="text-sherlock-text-primary">{avgBond}%</span>
          </div>
          <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => setSortKey('bond')}
              className={cn(
                'rounded-md px-2 py-1 text-[10px] transition',
                sortKey === 'bond' ? 'bg-fuchsia-600/40 text-fuchsia-100' : 'text-sherlock-text-muted hover:text-sherlock-text-primary',
              )}
            >
              按羁绊
            </button>
            <button
              type="button"
              onClick={() => setSortKey('name')}
              className={cn(
                'rounded-md px-2 py-1 text-[10px] transition',
                sortKey === 'name' ? 'bg-fuchsia-600/40 text-fuchsia-100' : 'text-sherlock-text-muted hover:text-sherlock-text-primary',
              )}
            >
              按名称
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {entries.map(([name, raw]) => {
          const v = clampPct(raw);
          const meta = resolveBondFaction(name);
          const tier = bondTierFromPct(v);
          const hi = paletteHash(name);
          const st = GAME_CARD_PALETTES[hi % GAME_CARD_PALETTES.length];
          const Icon = bondFactionIcon(name);
          const pips = bondSynergyPips(v);

          return (
            <div
              key={name}
              role="button"
              tabIndex={0}
              className={cn(
                'group/card relative cursor-pointer rounded-xl border p-4 transition duration-300 hover:brightness-110',
                st.border,
                st.bg,
                st.glow,
              )}
              onClick={() => setDetailName(name)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailName(name);
                }
              }}
            >
              <div className={cn('pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-45 blur-2xl', st.orb)} aria-hidden />

              <div className="relative flex items-start gap-3">
                <div
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-black/40 shadow-inner',
                    st.border,
                  )}
                >
                  <Icon className="h-6 w-6 text-sherlock-text-primary/95" strokeWidth={1.3} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="font-serif text-[15px] font-bold leading-snug text-sherlock-text-primary">{name}</h4>
                    <span className="text-sm font-bold tabular-nums text-sherlock-gold">{v}%</span>
                  </div>
                  <span
                    className={cn(
                      'mt-1 inline-block rounded-full bg-linear-to-r px-2 py-0.5 text-[9px] font-bold text-white',
                      tier.accent,
                    )}
                  >
                    {tier.label}
                  </span>
                  <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-sherlock-text-muted">{meta.tagline}</p>
                </div>
              </div>

              <div className={cn('relative mt-3 h-2 w-full overflow-hidden rounded-full', st.barTrack)}>
                <div className={cn('h-full rounded-full transition-[width] duration-500', st.barFill)} style={{ width: `${v}%` }} />
              </div>

              <div className="relative mt-3 flex flex-wrap gap-1">
                {meta.primaryAttrs.slice(0, 3).map(a => (
                  <span
                    key={a}
                    className="rounded border border-fuchsia-500/25 bg-black/35 px-1.5 py-0.5 text-[9px] text-fuchsia-200/90"
                  >
                    {a}
                  </span>
                ))}
                <span className="rounded border border-amber-500/30 bg-amber-950/25 px-1.5 py-0.5 text-[9px] text-amber-200/90">
                  协同 {pips} 档
                </span>
              </div>

              <p className="mt-2 line-clamp-2 text-[9px] leading-relaxed text-fuchsia-200/85 transition-[line-clamp] duration-200 group-hover/card:line-clamp-none">
                <span className="font-semibold text-amber-200/90">提示</span> · {meta.playTip}
              </p>

              <p className="relative mt-2 text-center text-[9px] text-sherlock-text-muted">轻触展开完整档案</p>
            </div>
          );
        })}
      </div>

      {detailName ? (
        <BondFactionOverlay
          name={detailName}
          bondPct={clampPct(stats.bondFactions[detailName] ?? 0)}
          onClose={() => setDetailName(null)}
        />
      ) : null}
    </div>
  );
}

/** 设施名 → 图标（关键词匹配） */
function facilityIconForName(name: string) {
  if (/苏格兰场|重案|警视|场站/.test(name)) return Landmark;
  if (/贝克街|221|住所/.test(name)) return Home;
  if (/巴茨|法医|实验室|化验/.test(name)) return Microscope;
  if (/监控|取证|数字|网络/.test(name)) return Monitor;
  if (/安全屋|庇护/.test(name)) return Shield;
  if (/谢林福特|监禁|会客|禁区/.test(name)) return Lock;
  return Building2;
}

function FacilitiesModal() {
  const { stats } = useSherlockStats();
  const names = useMemo(
    () => Object.keys(stats.facilityLevels).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
    [stats.facilityLevels],
  );

  const activeCount = useMemo(() => {
    return names.filter(n => {
      const level = stats.facilityLevels[n] ?? 0;
      const isBool = n in stats.facilityFlags;
      const flagOn = isBool ? stats.facilityFlags[n] : level > 0;
      return flagOn || (!isBool && level > 0);
    }).length;
  }, [names, stats.facilityLevels, stats.facilityFlags]);

  if (names.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-sherlock-gold/25 bg-linear-to-br from-black/60 via-emerald-950/10 to-sherlock-blue/8 p-8 shadow-[inset_0_0_60px_rgba(184,134,11,0.05)]">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-sherlock-gold/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-sherlock-gold/35 bg-black/45 shadow-[0_0_28px_rgba(52,211,153,0.12)]">
            <Building2 className="h-10 w-10 text-emerald-300/90" strokeWidth={1.2} />
          </div>
          <p className="font-serif text-base font-semibold tracking-wide text-sherlock-gold">案卷尚无据点登记</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-sherlock-text-secondary">
            贝克街的壁炉、苏格兰场的卷宗台与化验室灯光，将在你推进剧情后逐一点亮。
          </p>
          <p className="mt-4 text-[10px] text-sherlock-text-muted">据点册页尚空，待故事点亮。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/28 bg-linear-to-r from-emerald-950/25 via-black/35 to-sherlock-gold/10 px-4 py-3 shadow-[0_0_24px_rgba(16,185,129,0.08)]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-400/35 bg-black/45 shadow-[inset_0_0_18px_rgba(52,211,153,0.1)]">
            <Landmark className="h-6 w-6 text-emerald-300/95" />
          </div>
          <div className="min-w-0">
            <p className="font-serif text-sm font-bold tracking-wide text-sherlock-gold">雾都 · 案卷据点总览</p>
            <p className="text-[10px] text-sherlock-text-muted">设施等级与门禁状态 · 未解锁时叙事里亦应「门尚未开」</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] tabular-nums">
          <span className="rounded-md border border-white/10 bg-black/35 px-2 py-1 text-sherlock-text-muted">
            据点 <span className="text-sherlock-text-primary">{names.length}</span>
          </span>
          <span className="rounded-md border border-emerald-500/25 bg-emerald-950/30 px-2 py-1 text-emerald-200/90">
            可用 <span className="font-bold text-emerald-100">{activeCount}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {names.map(name => {
          const level = stats.facilityLevels[name] ?? 0;
          const isBool = name in stats.facilityFlags;
          const flagOn = isBool ? stats.facilityFlags[name] : level > 0;
          const active = flagOn || (!isBool && level > 0);
          const pct = isBool ? (flagOn ? 100 : 0) : clampPct((level / FACILITY_MAX) * 100);
          const hi = paletteHash(name);
          const st = GAME_CARD_PALETTES[hi % GAME_CARD_PALETTES.length];
          const Icon = facilityIconForName(name);
          const locked = (isBool && !flagOn) || (!isBool && level === 0);

          return (
            <div
              key={name}
              className={cn(
                'group relative overflow-hidden rounded-xl border p-4 transition duration-300',
                st.border,
                st.bg,
                st.glow,
                locked ? 'opacity-[0.88] saturate-[0.72]' : 'hover:brightness-110',
              )}
            >
              <div
                className={cn('pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-40 blur-2xl', st.orb)}
                aria-hidden
              />
              {locked ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/45 backdrop-blur-[2px]">
                  <Lock className="h-8 w-8 text-sherlock-red/90" strokeWidth={1.35} />
                  <span className="rounded-full border border-sherlock-red/35 bg-black/75 px-3 py-1 text-xs font-bold tracking-wide text-sherlock-red">
                    {isBool ? '门禁 · 关' : '未解锁'}
                  </span>
                </div>
              ) : null}

              <div className="relative flex items-start gap-3">
                <div
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-black/40 shadow-inner',
                    st.border,
                    locked && 'grayscale-[0.35]',
                  )}
                >
                  <Icon className="h-6 w-6 text-sherlock-text-primary/95" strokeWidth={1.3} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="font-serif text-[15px] font-bold leading-snug text-sherlock-text-primary">{name}</h4>
                    <span
                      className={cn(
                        'shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                        active
                          ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                          : 'border-white/15 bg-black/40 text-sherlock-text-muted',
                      )}
                    >
                      {isBool ? (flagOn ? '开启' : '关闭') : `第 ${level} 阶，满阶 ${FACILITY_MAX}`}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-sherlock-text-muted">
                    {isBool
                      ? flagOn
                        ? '门扉已启，通路无阻；卷宗与探视权限生效。'
                        : '门扉紧闭，叙事中不可当作已开放区域使用。'
                      : `设施等级 · 满阶 ${FACILITY_MAX}；进度影响化验、卷宗与技术支持选项。`}
                  </p>
                </div>
              </div>

              <div className={cn('relative mt-4 h-2.5 w-full overflow-hidden rounded-full', st.barTrack)}>
                <div
                  className={cn('h-full rounded-full transition-[width] duration-500', st.barFill)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {!locked ? (
                <p className="relative mt-2 text-right text-[10px] tabular-nums text-sherlock-text-muted">
                  {isBool ? (flagOn ? '运转中' : '未启用') : `${Math.round(pct)}%`}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 字符串稳定哈希，用于证物卡 / 设施卡配色轮换 */
function paletteHash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 33 + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const WAREHOUSE_CARD_STYLES = [
  {
    border: 'border-amber-400/45',
    bg: 'bg-linear-to-br from-amber-950/55 via-black/45 to-orange-950/25',
    glow: 'shadow-[0_0_28px_rgba(245,158,11,0.14)]',
    chip: 'border-amber-400/35 bg-amber-500/15 text-amber-100',
    qty: 'from-amber-400/90 to-orange-600/90 text-black',
    orb: 'bg-linear-to-br from-amber-400/25 to-transparent',
  },
  {
    border: 'border-cyan-400/40',
    bg: 'bg-linear-to-br from-cyan-950/45 via-black/45 to-sky-950/30',
    glow: 'shadow-[0_0_28px_rgba(34,211,238,0.12)]',
    chip: 'border-cyan-400/35 bg-cyan-500/12 text-cyan-50',
    qty: 'from-cyan-300 to-teal-600 text-black',
    orb: 'bg-linear-to-br from-cyan-400/30 to-transparent',
  },
  {
    border: 'border-emerald-400/40',
    bg: 'bg-linear-to-br from-emerald-950/50 via-black/45 to-green-950/25',
    glow: 'shadow-[0_0_28px_rgba(52,211,153,0.12)]',
    chip: 'border-emerald-400/35 bg-emerald-500/12 text-emerald-50',
    qty: 'from-emerald-300 to-emerald-700 text-black',
    orb: 'bg-linear-to-br from-emerald-400/25 to-transparent',
  },
  {
    border: 'border-violet-400/40',
    bg: 'bg-linear-to-br from-violet-950/50 via-black/45 to-fuchsia-950/25',
    glow: 'shadow-[0_0_28px_rgba(167,139,250,0.14)]',
    chip: 'border-violet-400/35 bg-violet-500/12 text-violet-100',
    qty: 'from-violet-300 to-purple-700 text-white',
    orb: 'bg-linear-to-br from-violet-400/25 to-transparent',
  },
  {
    border: 'border-rose-400/38',
    bg: 'bg-linear-to-br from-rose-950/45 via-black/45 to-red-950/30',
    glow: 'shadow-[0_0_28px_rgba(251,113,133,0.12)]',
    chip: 'border-rose-400/35 bg-rose-500/12 text-rose-50',
    qty: 'from-rose-300 to-rose-700 text-white',
    orb: 'bg-linear-to-br from-rose-400/25 to-transparent',
  },
  {
    border: 'border-sky-400/38',
    bg: 'bg-linear-to-br from-sky-950/45 via-black/40 to-indigo-950/30',
    glow: 'shadow-[0_0_28px_rgba(56,189,248,0.12)]',
    chip: 'border-sky-400/35 bg-sky-500/12 text-sky-50',
    qty: 'from-sky-300 to-blue-700 text-white',
    orb: 'bg-linear-to-br from-sky-400/25 to-transparent',
  },
] as const;

function formatWarehouseScalar(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function iconForWarehouseType(typeLabel: string) {
  const t = typeLabel.toLowerCase();
  if (/指纹|血|痕|弹|刀|械|尸|物证/.test(typeLabel) || /print|blood/i.test(t)) {
    return Fingerprint;
  }
  if (/药|剂|毒|液|瓶/.test(typeLabel) || /chem|drug/i.test(t)) {
    return FlaskConical;
  }
  if (/卷|档|纸|函|令|报告|照片/.test(typeLabel) || /file|doc/i.test(t)) {
    return FileText;
  }
  return Package;
}

interface ParsedWarehouseRow {
  name: string;
  typeLabel: string;
  qty: number | null;
  extras: Array<{ k: string; v: string }>;
  rawFallback: string | null;
}

function parseWarehouseEntry(name: string, val: unknown): ParsedWarehouseRow {
  if (val != null && typeof val === 'object' && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    const typeRaw = o['类型'];
    const typeLabel =
      typeof typeRaw === 'string' && typeRaw.trim() ? typeRaw.trim() : '未分类';
    const qRaw = o['数量'];
    let qty: number | null = null;
    if (typeof qRaw === 'number' && !Number.isNaN(qRaw)) qty = qRaw;
    else if (typeof qRaw === 'string') {
      const n = parseFloat(qRaw.replace(/,/g, ''));
      if (!Number.isNaN(n)) qty = n;
    }
    const extras: Array<{ k: string; v: string }> = [];
    for (const [k, v] of Object.entries(o)) {
      if (k === '类型' || k === '数量') continue;
      extras.push({ k, v: formatWarehouseScalar(v) });
    }
    return { name, typeLabel, qty, extras, rawFallback: null };
  }
  return {
    name,
    typeLabel: '杂项',
    qty: null,
    extras: [],
    rawFallback: formatWarehouseScalar(val),
  };
}

function InventoryModal() {
  const { stats } = useSherlockStats();
  const w = stats.warehouse;
  const rows = useMemo(
    () =>
      Object.keys(w)
        .map(k => parseWarehouseEntry(k, w[k]))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN')),
    [w],
  );

  if (rows.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-sherlock-gold/25 bg-linear-to-br from-black/60 via-sherlock-blue/7 to-amber-950/20 p-8 shadow-[inset_0_0_60px_rgba(184,134,11,0.06)]">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sherlock-gold/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-sherlock-blue/15 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-sherlock-gold/35 bg-black/40 shadow-[0_0_32px_rgba(184,134,11,0.15)]">
            <Archive className="h-10 w-10 text-sherlock-gold/85" strokeWidth={1.25} />
          </div>
          <p className="font-serif text-base font-semibold tracking-wide text-sherlock-gold">物证柜空置</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-sherlock-text-secondary">
            指纹袋、密封瓶与编号卷宗尚未入册。随着案情推进，证物、战利品与来路不明的包裹将在此逐一登记。
          </p>
          <p className="mt-4 text-[10px] text-sherlock-text-muted">物证柜尚无登记条目。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sherlock-blue/30 bg-linear-to-r from-sherlock-blue/12 via-black/35 to-amber-500/8 px-4 py-3 shadow-[0_0_24px_rgba(59,130,246,0.08)]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-sherlock-gold/35 bg-black/45 shadow-[inset_0_0_20px_rgba(184,134,11,0.12)]">
            <Fingerprint className="h-6 w-6 text-sherlock-gold" />
          </div>
          <div className="min-w-0">
            <p className="font-serif text-sm font-bold tracking-wide text-sherlock-gold">苏格兰场 · 物证登记</p>
            <p className="text-[10px] text-sherlock-text-muted">密封编号与类型归档；与雾巷博弈中物证条目相呼应</p>
          </div>
        </div>
        <div className="flex items-baseline gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 tabular-nums">
          <span className="text-[10px] text-sherlock-text-muted">在册</span>
          <span className="text-lg font-bold text-sherlock-text-primary">{rows.length}</span>
          <span className="text-xs text-sherlock-text-muted">件</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(row => {
          const hi = paletteHash(row.name);
          const st = WAREHOUSE_CARD_STYLES[hi % WAREHOUSE_CARD_STYLES.length];
          const Icon = iconForWarehouseType(row.typeLabel);
          return (
            <div
              key={row.name}
              className={cn(
                'group relative overflow-hidden rounded-xl border p-4 transition duration-300',
                st.border,
                st.bg,
                st.glow,
                'hover:brightness-110',
              )}
            >
              <div
                className={cn(
                  'pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-45 blur-2xl',
                  st.orb,
                )}
                aria-hidden
              />
              <div className="relative flex items-start gap-3">
                <div
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-black/35 shadow-inner',
                    st.border,
                  )}
                >
                  <Icon className="h-6 w-6 text-sherlock-text-primary/95" strokeWidth={1.35} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="font-serif text-[15px] font-bold leading-snug text-sherlock-text-primary">{row.name}</h4>
                    {row.qty != null ? (
                      <span
                        className={cn(
                          'shrink-0 rounded-md bg-linear-to-r px-2 py-0.5 text-xs font-bold tabular-nums shadow-sm',
                          st.qty,
                        )}
                      >
                        共 {row.qty} 件
                      </span>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      'mt-2 inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wide',
                      st.chip,
                    )}
                  >
                    {row.typeLabel}
                  </span>
                </div>
              </div>

              {row.extras.length > 0 ? (
                <ul className="relative mt-3 space-y-1.5 border-t border-white/10 pt-3 text-[11px] text-sherlock-text-secondary">
                  {row.extras.map(ex => (
                    <li key={ex.k} className="flex gap-2">
                      <span className="shrink-0 text-sherlock-blue/90">{ex.k}</span>
                      <span className="min-w-0 wrap-break-word text-sherlock-text-muted">{ex.v}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {row.rawFallback ? (
                <p className="relative mt-3 border-t border-white/10 pt-3 text-[11px] leading-relaxed wrap-break-word text-sherlock-text-muted">
                  {row.rawFallback}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function companionLucideIcon(rawName: string) {
  if (/夏洛克|Sherlock/i.test(rawName)) return BrainCircuit;
  if (/华生|Watson|约翰/i.test(rawName)) return Heart;
  if (/雷斯垂德|Lestrade|格雷格/i.test(rawName)) return Shield;
  if (/欧洛丝|Eurus|东风/i.test(rawName)) return Sparkles;
  return UserPlus;
}

function CompanionDetailOverlay({
  rawName,
  companion,
  onClose,
}: {
  rawName: string;
  companion: SherlockCompanionEntry;
  onClose: () => void;
}) {
  const profile = resolveCompanionProfile(rawName);
  const bond = clampPct(companion.bondLevel);
  const hp = clampPct(companion.hp);
  const mental = mentalStatusTone(companion.mental);
  const ex = companion.exclusiveTrait;
  const exStr = typeof ex === 'boolean' ? (ex ? '已解锁' : '未解锁') : String(ex);
  const Icon = companionLucideIcon(rawName);
  const sync = companionShowSyncPulse(bond, hp);

  return createPortal(
    <div className="fixed inset-0 z-10050 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/84 backdrop-blur-[3px]" aria-label="关闭" onClick={onClose} />
      <div
        className="relative max-h-[min(90vh,720px)] w-full max-w-lg sherlock-scroll-y-invisible rounded-2xl border border-teal-500/35 bg-[#060d12]/98 p-5 shadow-[0_0_56px_rgba(20,184,166,0.18)] sm:p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3 border-b border-white/10 pb-4">
          <div
            className={cn(
              'relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-linear-to-br shadow-inner',
              companionAuraClass(profile.aura),
            )}
          >
            {sync ? (
              <span className="absolute inset-0 animate-ping rounded-2xl bg-teal-400/25" aria-hidden />
            ) : null}
            <Icon className="relative z-10 h-8 w-8 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]" strokeWidth={1.2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[10px] tracking-[0.28em] text-teal-300/85">羁绊名册档案</p>
            <h3 className="font-serif text-xl font-bold text-sherlock-text-primary">{profile.displayName}</h3>
            <p className="text-[11px] text-teal-200/90">{profile.epithet}</p>
            <span className={cn('mt-2 inline-block rounded-md border px-2 py-0.5 text-[10px]', mental.className)}>{mental.label}</span>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-white/15 p-2 text-sherlock-text-muted hover:border-teal-400/45 hover:text-teal-200"
            aria-label="关闭"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-sherlock-text-secondary">{profile.tagline}</p>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-amber-500/25 bg-black/35 p-3">
            <p className="text-[10px] text-sherlock-text-muted">羁绊</p>
            <p className="text-2xl font-bold text-amber-200 tabular-nums">{bond}%</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/50">
              <div className="h-full bg-linear-to-r from-amber-400 to-orange-500" style={{ width: `${bond}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-black/35 p-3">
            <p className="text-[10px] text-sherlock-text-muted">体魄 / 生命感</p>
            <p className="text-2xl font-bold text-emerald-200 tabular-nums">{hp}%</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/50">
              <div className="h-full bg-linear-to-r from-emerald-400 to-teal-600" style={{ width: `${hp}%` }} />
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-sherlock-blue/25 bg-sherlock-blue/5 p-3">
          <h4 className="mb-1 flex items-center gap-2 font-serif text-xs font-bold text-sherlock-blue">
            <Radio className="h-3.5 w-3.5" />
            同行默契
          </h4>
          <p className="text-[11px] leading-relaxed text-sherlock-text-secondary">
            {sync
              ? '羁绊与体征稳定——叙事上可优先调用掩护、证言与同行检定加成。'
              : '信号偏弱：剧情中可能出现迟疑、缺席或需要额外说服。'}
          </p>
        </div>

        <div className="mb-4">
          <h4 className="mb-2 font-serif text-xs font-bold tracking-wide text-sherlock-gold">角色技能（叙事向）</h4>
          <ul className="space-y-2">
            {profile.skills.map(s => (
              <li
                key={s.name}
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] leading-relaxed text-sherlock-text-secondary"
              >
                <span className="font-semibold text-teal-200/95">{s.name}</span>
                <span className="text-sherlock-text-muted"> — </span>
                {s.blurb}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-950/15 p-3">
          <h4 className="mb-1 font-serif text-xs font-bold text-fuchsia-200">专属特质</h4>
          <p className="text-sm text-fuchsia-100/95">{exStr}</p>
          <p className="mt-1 text-[10px] text-sherlock-text-muted">满羁绊时部分卡面会解锁额外叙事与掩护选项。</p>
        </div>
      </div>
    </div>,
    getSherlockPortalRoot(),
  );
}

function CompanionsModal() {
  const { stats } = useSherlockStats();
  const [detailName, setDetailName] = useState<string | null>(null);
  const entries = useMemo(
    () => Object.entries(stats.companions).sort((a, b) => b[1].bondLevel - a[1].bondLevel),
    [stats.companions],
  );

  const avgBond =
    entries.length > 0 ? Math.round(entries.reduce((s, [, c]) => s + clampPct(c.bondLevel), 0) / entries.length) : 0;

  if (entries.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-teal-500/25 bg-linear-to-br from-black/60 via-teal-950/15 to-cyan-950/20 p-8 shadow-[inset_0_0_60px_rgba(20,184,166,0.06)]">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-teal-500/12 blur-3xl" aria-hidden />
        <div className="relative flex flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-teal-400/35 bg-black/45 shadow-[0_0_28px_rgba(45,212,191,0.15)]">
            <Users className="h-10 w-10 text-teal-300/90" strokeWidth={1.15} />
          </div>
          <p className="font-serif text-base font-semibold tracking-wide text-teal-200/95">名册尚无姓名</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-sherlock-text-secondary">
            同行者将在剧情中与你并肩或反目。羁绊、体魄与精神状态会在此同步显影。
          </p>
          <p className="mt-4 text-[10px] text-sherlock-text-muted">名册尚无姓名，待人入局。</p>
        </div>
      </div>
    );
  }

  const detailCompanion = detailName ? stats.companions[detailName] : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-500/30 bg-linear-to-r from-teal-950/28 via-black/35 to-cyan-500/10 px-4 py-3 shadow-[0_0_24px_rgba(45,212,191,0.1)]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-teal-400/40 bg-black/45 shadow-[inset_0_0_18px_rgba(45,212,191,0.12)]">
            <Activity className="h-6 w-6 animate-pulse text-teal-300/95" />
            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-serif text-sm font-bold tracking-wide text-teal-100">雾都 · 羁绊网络</p>
            <p className="text-[10px] text-sherlock-text-muted">
              羁绊与体魄都稳时，头像周缘会泛起脉光；轻触卡片可读技能与档案
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] tabular-nums">
          <span className="flex items-center gap-1 rounded-md border border-white/10 bg-black/35 px-2 py-1 text-sherlock-text-muted">
            <Link2 className="h-3 w-3 text-teal-400/90" />
            平均羁绊 <span className="text-sherlock-gold">{avgBond}%</span>
          </span>
          <span className="rounded-md border border-teal-500/25 bg-teal-950/25 px-2 py-1 text-teal-200/90">
            {entries.length} 人在册
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {entries.map(([rawName, c]) => {
          const profile = resolveCompanionProfile(rawName);
          const bond = clampPct(c.bondLevel);
          const hp = clampPct(c.hp);
          const mental = mentalStatusTone(c.mental);
          const st = GAME_CARD_PALETTES[paletteHash(rawName) % GAME_CARD_PALETTES.length];
          const Icon = companionLucideIcon(rawName);
          const sync = companionShowSyncPulse(bond, hp);
          const previewSkills = profile.skills.slice(0, 2);

          return (
            <div
              key={rawName}
              role="button"
              tabIndex={0}
              className={cn(
                'group/cm relative cursor-pointer overflow-hidden rounded-2xl border p-5 transition duration-300 hover:brightness-110',
                st.border,
                st.bg,
                st.glow,
              )}
              onClick={() => setDetailName(rawName)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailName(rawName);
                }
              }}
            >
              <div className={cn('pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-40 blur-3xl', st.orb)} aria-hidden />

              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="relative mx-auto shrink-0 sm:mx-0">
                  <div
                    className={cn(
                      'relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-linear-to-br shadow-lg',
                      companionAuraClass(profile.aura),
                    )}
                  >
                    {sync ? (
                      <>
                        <span className="absolute inset-0 animate-ping rounded-2xl bg-white/20" aria-hidden />
                        <span className="absolute inset-0 rounded-2xl shadow-[0_0_24px_rgba(45,212,191,0.45)]" aria-hidden />
                      </>
                    ) : null}
                    <Icon
                      className={cn(
                        'relative z-10 h-11 w-11 text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.35)]',
                        sync && 'animate-pulse',
                      )}
                      strokeWidth={1.15}
                    />
                  </div>
                  {sync ? (
                    <p className="mt-1 text-center text-[9px] text-teal-300/90 sm:text-left">默契 · 盈</p>
                  ) : (
                    <p className="mt-1 text-center text-[9px] text-sherlock-text-muted sm:text-left">默契 · 弱</p>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-serif text-lg font-bold text-sherlock-gold">{profile.displayName}</h3>
                      <p className="text-[11px] text-teal-200/85">{profile.epithet}</p>
                    </div>
                    <span className={cn('rounded-md border px-2 py-0.5 text-[10px]', mental.className)}>{mental.label}</span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div>
                      <div className="mb-0.5 flex justify-between text-[10px] text-sherlock-text-muted">
                        <span>羁绊</span>
                        <span className="text-sherlock-gold tabular-nums">{bond}%</span>
                      </div>
                      <div className={cn('h-2 overflow-hidden rounded-full', st.barTrack)}>
                        <div className={cn('h-full rounded-full', st.barFill)} style={{ width: `${bond}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-0.5 flex justify-between text-[10px] text-sherlock-text-muted">
                        <span>体魄</span>
                        <span className="tabular-nums text-emerald-300/95">{hp}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-black/50 ring-1 ring-emerald-500/20">
                        <div
                          className="h-full bg-linear-to-r from-emerald-400 to-teal-600"
                          style={{ width: `${hp}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {previewSkills.map(s => (
                      <span
                        key={s.name}
                        className="rounded-md border border-teal-500/30 bg-black/40 px-2 py-0.5 text-[9px] text-teal-100/95"
                      >
                        {s.name}
                      </span>
                    ))}
                    {profile.skills.length > 2 ? (
                      <span className="rounded-md border border-amber-500/35 bg-amber-950/20 px-2 py-0.5 text-[9px] text-amber-200/90">
                        +{profile.skills.length - 2} 技能
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 line-clamp-2 text-[10px] leading-relaxed text-sherlock-text-muted transition-[line-clamp] group-hover/cm:line-clamp-none">
                    {profile.tagline}
                  </p>
                  <p className="mt-2 text-center text-[9px] text-sherlock-text-muted sm:text-left">轻触阅技能与特质全文</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {detailName && detailCompanion ? (
        <CompanionDetailOverlay rawName={detailName} companion={detailCompanion} onClose={() => setDetailName(null)} />
      ) : null}
    </div>
  );
}

// --- Helper Components ---

function TraitBadge({ name, type }: { name: string, type: 'initial' | 'plot' | 'bond' }) {
  const colors = {
    initial: 'border-sherlock-gray text-sherlock-gray',
    plot: 'border-sherlock-gold text-sherlock-gold',
    bond: 'border-sherlock-green text-sherlock-green'
  };
  return (
    <span className={cn("px-2 py-1 text-xs border rounded-sm bg-black/40", colors[type])}>
      {name}
    </span>
  );
}

function TimelineNode({ title, status, desc }: { title: string, status: 'completed' | 'active' | 'locked', desc: string }) {
  return (
    <div className="relative">
      <div className={cn(
        "absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 bg-sherlock-bg",
        status === 'completed' ? "border-sherlock-green shadow-[0_0_10px_rgba(15,46,38,0.8)]" :
        status === 'active' ? "border-sherlock-gold shadow-[0_0_10px_rgba(184,134,11,0.8)]" :
        "border-sherlock-gray"
      )} />
      <h4 className={cn(
        "font-bold mb-1",
        status === 'completed' ? "text-sherlock-green" :
        status === 'active' ? "text-sherlock-gold" :
        "text-sherlock-text-muted"
      )}>{title}</h4>
      <p className="text-sm text-sherlock-text-secondary">{desc}</p>
    </div>
  );
}

import { BrainCircuit, Briefcase, Building2, Map, ShieldAlert, Swords, UserPlus, Users } from 'lucide-react';
import { useBattleProtocol } from '../context/BattleProtocolContext';
import { cn } from '../lib/utils';
import { BabaGamblingEasterEgg } from './BabaGamblingEasterEgg';
import { SherlockHudStatusButton } from './SherlockHudStatusButton';

export type ModalType = 'plot' | 'faction' | 'bonds' | 'facilities' | 'inventory' | 'growth' | 'companions' | null;

interface SidebarProps {
  activeModal: ModalType;
  setActiveModal: (modal: ModalType) => void;
  battlePanelOpen: boolean;
  setBattlePanelOpen: (open: boolean) => void;
}

/**
 * 酒馆消息楼层 iframe 往往较窄：始终使用「顶栏 + 横向滑动的图标导航」，
 * 不再在 lg 断点切换为左侧竖条，避免主区被压成窄条导致整页看不全。
 */
export function Sidebar({ activeModal, setActiveModal, battlePanelOpen, setBattlePanelOpen }: SidebarProps) {
  const { showBattleNav } = useBattleProtocol();
  const battleFlash = showBattleNav && !battlePanelOpen;

  const navItems = [
    { id: 'plot', label: '主线棋局', icon: Map },
    { id: 'faction', label: '阵营状态', icon: ShieldAlert },
    { id: 'bonds', label: '派系羁绊', icon: Users },
    { id: 'facilities', label: '探案设施', icon: Building2 },
    { id: 'inventory', label: '仓库道具', icon: Briefcase },
    { id: 'growth', label: '自身状态', icon: BrainCircuit },
    { id: 'companions', label: '同行者', icon: UserPlus },
  ] as const;

  return (
    <aside className="sherlock-sidebar relative z-10 w-full shrink-0 border-b border-white/5 bg-black/40 backdrop-blur-md pt-[env(safe-area-inset-top,0)]">
      <div className="sherlock-sidebar-brand flex min-w-0 items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="flex h-9 min-w-[3.35rem] shrink-0 cursor-pointer items-center justify-center rounded-full border border-sherlock-gold/50 bg-sherlock-gold/20 px-1 shadow-[0_0_15px_rgba(184,134,11,0.3)] transition-[box-shadow,transform] hover:scale-[1.02] hover:shadow-[0_0_22px_rgba(184,134,11,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sherlock-gold/55 sm:h-10 sm:min-w-[3.85rem]"
            title="查看现实时间"
            onClick={() => {
              const now = new Date();
              const line = now.toLocaleString('zh-CN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              });
              toastr.info(line, '现实时刻');
            }}
          >
            <span className="select-none text-center text-[8px] font-bold leading-tight tracking-[0.06em] text-sherlock-gold sm:text-[9px]">
              伦敦
            </span>
          </button>
          <h1 className="min-w-0 truncate font-serif text-sm font-bold tracking-widest text-sherlock-text-primary sm:text-base">
            伦敦博弈场
          </h1>
          <BabaGamblingEasterEgg />
        </div>
        <div className="pointer-events-auto shrink-0 pl-1">
          <SherlockHudStatusButton />
        </div>
      </div>

      <nav className="sherlock-sidebar-nav scrollbar-hide flex w-full min-w-0 flex-row gap-1 overflow-x-auto overflow-y-hidden px-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0))] pt-0 [-webkit-overflow-scrolling:touch]">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeModal === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveModal(isActive ? null : item.id)}
              className={cn(
                'group relative flex min-h-11 min-w-11 shrink-0 items-center gap-1.5 overflow-hidden rounded-lg p-2 transition-all duration-300 sm:min-h-0 sm:min-w-0 sm:gap-2 sm:p-2.5',
                isActive
                  ? 'border border-sherlock-gold/30 bg-sherlock-gold/10 shadow-[inset_0_0_20px_rgba(184,134,11,0.1)]'
                  : 'border border-transparent hover:bg-white/5',
              )}
            >
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sherlock-gold shadow-[0_0_10px_rgba(184,134,11,0.8)]" />
              )}

              <Icon
                className={cn(
                  'h-5 w-5 shrink-0 transition-colors duration-300 sm:h-6 sm:w-6',
                  isActive ? 'text-sherlock-gold' : 'text-sherlock-gray group-hover:text-sherlock-text-primary',
                )}
              />
              <span
                className={cn(
                  'hidden whitespace-nowrap text-xs font-medium tracking-wide transition-colors duration-300 sm:inline sm:text-sm',
                  isActive
                    ? 'text-glow-gold text-sherlock-gold'
                    : 'text-sherlock-text-secondary group-hover:text-sherlock-text-primary',
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setBattlePanelOpen(!battlePanelOpen)}
          title="雾巷博弈：裁定与掷骰"
          className={cn(
            'group relative flex min-h-11 min-w-11 shrink-0 items-center gap-1.5 overflow-hidden rounded-lg border p-2 transition-all duration-300 sm:min-h-0 sm:min-w-0 sm:gap-2 sm:p-2.5',
            battlePanelOpen
              ? 'sherlock-battle-nav-active border-cyan-400/55 bg-linear-to-br from-cyan-500/20 to-black/40'
              : battleFlash
                ? 'sherlock-battle-nav-flash sherlock-battle-nav-glow border-cyan-500/45 bg-linear-to-br from-cyan-950/50 to-black/30'
                : 'border border-transparent hover:bg-white/5 hover:shadow-[0_0_16px_rgba(34,211,238,0.08)]',
          )}
        >
          {battlePanelOpen && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-linear-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_14px_rgba(34,211,238,0.85)]" />
          )}
          {battleFlash && !battlePanelOpen && (
            <span
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                background:
                  'radial-gradient(circle at 50% 100%, rgba(34,211,238,0.35) 0%, transparent 55%)',
              }}
            />
          )}
          <Swords
            className={cn(
              'relative z-1 h-5 w-5 shrink-0 transition-all duration-300 sm:h-6 sm:w-6',
              battlePanelOpen
                ? 'text-cyan-100 drop-shadow-[0_0_10px_rgba(34,211,238,0.65)]'
                : battleFlash
                  ? 'text-cyan-50 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                  : 'text-sherlock-gray group-hover:text-cyan-200/90',
            )}
          />
          <span
            className={cn(
              'hidden whitespace-nowrap text-xs font-medium tracking-wide transition-colors duration-300 sm:inline sm:text-sm',
              battlePanelOpen ? 'text-cyan-100' : 'text-sherlock-text-secondary group-hover:text-sherlock-text-primary',
            )}
          >
            雾巷博弈
          </span>
        </button>
      </nav>
    </aside>
  );
}

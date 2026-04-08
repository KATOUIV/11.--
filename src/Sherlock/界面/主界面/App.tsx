import { useCallback, useEffect, useRef, useState } from 'react';
import { reloadOnChatChange } from '../../../../util/script';
import { ChatArea } from './components/ChatArea';
import { EntrySplash } from './components/EntrySplash';
import { FullscreenInvite } from './components/FullscreenInvite';
import { ENTRY_SPLASH_FIRST_MS, ENTRY_SPLASH_RETURN_MS } from './components/entrySplashConstants';
import { isFirstEntrySplash, markEntrySplashSeen } from './lib/entrySplashStorage';
import { Modals } from './components/Modals';
import { OpeningBookWizard } from './components/OpeningBookWizard';
import { Sidebar, type ModalType } from './components/Sidebar';
import { BattleProtocolProvider } from './context/BattleProtocolContext';
import { FogBattlePanel } from './components/FogBattlePanel';
import { SherlockDeathModal } from './components/SherlockDeathModal';
import { SherlockLowApAmbience } from './components/SherlockLowApAmbience';
import { SherlockStatProvider } from './context/SherlockStatContext';
import { resolvePhaseAfterSplash, resolvePhaseAfterStartGame, shouldShowOpeningForm } from './gamePhase';
import { captureSherlockOpeningBackup } from './utils/gameInitializer';
import {
  exitFullscreenSafe,
  getFullscreenElement,
  isElementFullscreen,
  requestFullscreenSafe,
} from './utils/fullscreen';

type Phase = 'splash' | 'book' | 'game';

/**
 * 入场顺序：splash →（手记未启封则 book，否则 game）。
 * 首次载入须点「开始游戏」以取得全屏手势；再次进入短时后自动按 `gamePhase` 分流。
 * 「开始游戏」：仅当案卷已有后续楼层且手记已启封时直入主界面，否则仍进手记，避免 MVU 与向导状态不一致。
 */
export default function App() {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [battlePanelOpen, setBattlePanelOpen] = useState(false);
  const needsOpening = shouldShowOpeningForm();
  const [phase, setPhase] = useState<Phase>('splash');
  const shellRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** 非首屏「开始游戏」路径：仍可用手势层邀请全屏（例如从手记回到主界面后） */
  const [fullscreenInviteOpen, setFullscreenInviteOpen] = useState(false);
  /** 挂载时是否首次进入（决定载入页与时长；离开首屏后写入 storage） */
  const splashWelcomeRef = useRef(isFirstEntrySplash());
  const splashDurationMs = splashWelcomeRef.current ? ENTRY_SPLASH_FIRST_MS : ENTRY_SPLASH_RETURN_MS;

  /**
   * 首帧 API 未就绪时：仅在已进入主界面 phase 时，把误判的 game 拉回手记。
   * 不处理 splash / book，避免打断流程。
   */
  useEffect(() => {
    const promoteOpeningIfNeeded = () => {
      if (!shouldShowOpeningForm()) {
        return;
      }
      setPhase(p => (p === 'game' ? 'book' : p));
    };
    promoteOpeningIfNeeded();
    const t0 = window.setTimeout(promoteOpeningIfNeeded, 0);
    const t1 = window.setTimeout(promoteOpeningIfNeeded, 100);
    const t2 = window.setTimeout(promoteOpeningIfNeeded, 400);
    let appReadySub: EventOnReturn | undefined;
    try {
      if (typeof eventOn !== 'undefined' && typeof tavern_events !== 'undefined') {
        appReadySub = eventOn(tavern_events.APP_READY, () => promoteOpeningIfNeeded());
      }
    } catch {
      /* 忽略 */
    }
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      appReadySub?.stop();
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      setIsFullscreen(isElementFullscreen(shellRef.current));
    };
    sync();
    const evs = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange'] as const;
    evs.forEach(ev => document.addEventListener(ev, sync as EventListener));
    return () => evs.forEach(ev => document.removeEventListener(ev, sync as EventListener));
  }, []);

  useEffect(() => {
    if (
      typeof SillyTavern === 'undefined' ||
      typeof SillyTavern.getCurrentChatId !== 'function' ||
      typeof eventOn === 'undefined' ||
      typeof tavern_events === 'undefined'
    ) {
      return;
    }
    let sub: EventOnReturn | undefined;
    try {
      sub = reloadOnChatChange();
    } catch (e) {
      console.warn('[Sherlock] reloadOnChatChange 未注册（可忽略）', e);
      return;
    }
    return () => sub?.stop();
  }, []);

  useEffect(() => {
    if (isFullscreen) {
      setFullscreenInviteOpen(false);
    }
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (getFullscreenElement()) {
        await exitFullscreenSafe();
      } else {
        await requestFullscreenSafe(el);
      }
    } catch (e) {
      console.warn('[Sherlock] fullscreen', e);
      toastr.error('未能全屏：请允许权限，或稍后用行动栏旁的全屏钮。', '伦敦博弈场');
    }
  }, []);

  /** 案卷主界面「入局」：用户手势内请求全屏（已全屏则跳过）；错误仅轻提示 */
  const authorizePlayShellFullscreen = useCallback(async () => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (!isElementFullscreen(el)) {
        await requestFullscreenSafe(el);
      }
    } catch (e) {
      console.warn('[Sherlock] 入局全屏', e);
      toastr.error('全屏未成功，可在行动栏旁再点全屏钮。', '伦敦博弈场');
    }
  }, []);

  /** 再次进入：短计时结束后自动进入手记/主界面（不经「开始游戏」按钮） */
  const advanceFromSplash = useCallback(() => {
    captureSherlockOpeningBackup();
    setPhase(resolvePhaseAfterSplash());
  }, []);

  /** 首次进入：点击「开始游戏」→ 用户手势内请求全屏，并按最新楼层分流 */
  const handleStartGame = useCallback(() => {
    captureSherlockOpeningBackup();
    markEntrySplashSeen();
    const el = shellRef.current;
    if (el) {
      void requestFullscreenSafe(el).catch(e => {
        console.warn('[Sherlock] 开始游戏时全屏', e);
      });
    }
    setPhase(resolvePhaseAfterStartGame());
  }, []);

  const enterFullscreenFromInvite = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    void requestFullscreenSafe(el)
      .then(() => {
        setFullscreenInviteOpen(false);
      })
      .catch(() => {
        toastr.error('未能进入全屏，请稍后在行动栏旁再试。', '伦敦博弈场');
      });
  }, []);

  /** 首屏计时：仅「再次进入」自动跳转；首次进入须点击「开始游戏」（含全屏授权） */
  useEffect(() => {
    if (phase !== 'splash') {
      return;
    }
    if (splashWelcomeRef.current) {
      return;
    }
    const id = window.setTimeout(() => {
      advanceFromSplash();
    }, splashDurationMs);
    return () => window.clearTimeout(id);
  }, [phase, advanceFromSplash, splashDurationMs]);

  const showOpeningFlow = needsOpening && phase === 'book';

  return (
    <div
      ref={shellRef}
      className="sherlock-shell flex h-full min-h-0 w-full min-w-0 flex-1 flex-col text-sherlock-text-primary crt-scanlines"
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-10 mix-blend-overlay"
        style={{
          backgroundImage: "url('https://picsum.photos/seed/london-fog/1920/1080?grayscale&blur=2')",
          backgroundSize: 'cover',
        }}
      />

      <FullscreenInvite
        visible={fullscreenInviteOpen && !isFullscreen && phase !== 'splash'}
        onEnter={enterFullscreenFromInvite}
        onDismiss={() => setFullscreenInviteOpen(false)}
      />

      {phase === 'splash' ? (
        <EntrySplash
          variant={splashWelcomeRef.current ? 'welcome' : 'return'}
          durationMs={splashDurationMs}
          requireStartButton={splashWelcomeRef.current}
          onStartGame={handleStartGame}
        />
      ) : showOpeningFlow ? (
        <OpeningBookWizard
          onComplete={() => {
            setPhase('game');
          }}
        />
      ) : (
        <SherlockStatProvider>
          <BattleProtocolProvider>
            <Sidebar
              activeModal={activeModal}
              setActiveModal={setActiveModal}
              battlePanelOpen={battlePanelOpen}
              setBattlePanelOpen={setBattlePanelOpen}
            />

            <div className="sherlock-main-column relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <SherlockLowApAmbience />
              <ChatArea
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => void toggleFullscreen()}
                onPlaySessionAuthorize={authorizePlayShellFullscreen}
              />
            </div>

            <Modals activeModal={activeModal} setActiveModal={setActiveModal} />
            <SherlockDeathModal />
            <FogBattlePanel open={battlePanelOpen} onClose={() => setBattlePanelOpen(false)} />
          </BattleProtocolProvider>
        </SherlockStatProvider>
      )}
      {/* 全屏时浮层必须挂在此根节点内，否则 portal 到 body 会不可见 */}
      <div id="sherlock-portal-root" className="sherlock-portal-root" aria-hidden />
    </div>
  );
}

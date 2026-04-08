import { gsap } from 'gsap';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import './tavern-ambient';

import { syncChronicleOnAssistantMessage } from '../../../../util/chronicleWorldbook';
import {
  getAssistantFloorsMaintext,
  getAssistantFloorsSum,
  loadFromLatestMessage,
  parseMaintext,
  replaceLastMaintext,
  type OptionItem,
} from '../../../../util/messageParser';
import { getLatestAssistantStatData } from '../../../../util/statData';
import { loadVaultUiSettings, type VaultUiSettings } from '../../../../util/vaultSettings';
import { handleVaultUnifiedRequest } from '../../../../util/vaultRequestHandler';
import {
  VAULT_OS_STREAM_MAINTEXT,
  VAULT_OS_TURN_COMMITTED,
  type DualApiRuntimeConfig,
} from '../../../../util/vaultTurnPipeline';
import { resolveVaultWorldbookName } from '../../../../util/vaultWorldbook';

import { CombatHudPanel } from './CombatHudPanel';
import { StatDataTree } from './StatDataTree';
import { SupervisorPanel } from './SupervisorPanel';
import { VaultOpeningBook } from './VaultOpeningBook';
import { VaultSettingsModal } from './VaultSettingsModal';

/** 底部导航固定分区：与 stat_data 顶层键无关，解析 COMBAT_JSON 战斗动效 */
const VAULT_COMBAT_PANEL_KEY = '战斗 HUD';

/** 与 @types/function/util.d.ts 一致；部分构建环境下需在此声明以便通过检查 */
declare function getLastMessageId(): number;

/** 世界环境层中优先展示的只读字段顺序（日期、背景等） */
const AMBIENT_FIELD_ORDER = ['当前日期', '当前时间', '灾难本质', '世界现状', '时间线节点'] as const;

function getAmbientRows(statData: Record<string, unknown> | null): { label: string; value: string }[] {
  if (!statData) return [];
  const raw = statData['世界环境层'];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const layer = raw as Record<string, unknown>;
  const rows: { label: string; value: string }[] = [];
  const used = new Set<string>();
  for (const key of AMBIENT_FIELD_ORDER) {
    const v = layer[key];
    if (v === undefined || v === null) continue;
    if (typeof v === 'object') continue;
    rows.push({ label: key, value: String(v) });
    used.add(key);
  }
  for (const [k, v] of Object.entries(layer)) {
    if (used.has(k)) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') continue;
    rows.push({ label: k, value: String(v) });
  }
  return rows;
}

/** tab 按钮 id，与 aria-labelledby 一致（避免空格等非法 id 字符） */
function tabIdForStatKey(key: string): string {
  return `vault-tab-${key.replace(/\s+/g, '_')}`;
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z" strokeLinejoin="round" />
    </svg>
  );
}

function IconAmbientDetail({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" opacity="0.45" />
      <path d="M12 10v5M12 7h.01" strokeLinecap="round" />
    </svg>
  );
}

function VaultAmbientStrip({
  statData,
  anchorMessageId,
}: {
  statData: Record<string, unknown> | null;
  anchorMessageId: number | null;
}) {
  const rows = useMemo(() => getAmbientRows(statData), [statData]);
  const [detailOpen, setDetailOpen] = useState(false);
  const detailBtnRef = useRef<HTMLButtonElement>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!detailOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (detailPanelRef.current?.contains(t) || detailBtnRef.current?.contains(t)) return;
      setDetailOpen(false);
    };
    document.addEventListener('click', onDoc, true);
    return () => document.removeEventListener('click', onDoc, true);
  }, [detailOpen]);

  return (
    <section
      className="vault-ambient-strip rounded-sm px-1.5 py-1 sm:px-2 shrink-0 select-text relative"
      aria-label="世界环境层（只读档案）"
    >
      <div className="flex items-start gap-1 sm:gap-1.5 min-w-0">
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          <h1 className="text-[8px] font-bold tracking-[0.14em] text-vault-green/85 m-0 leading-none">环境</h1>
          <span className="text-[8px] opacity-40 tabular-nums leading-none">#{anchorMessageId ?? '—'}</span>
        </div>

        {rows.length === 0 ? (
          <p className="text-[8px] opacity-45 m-0 flex-1 min-w-0 leading-snug pt-0.5">
            {statData ? '暂无字段' : '等待同步…'}
          </p>
        ) : (
          <>
            <div className="vault-ambient-chips flex flex-1 min-w-0 flex-wrap items-center gap-1 content-center py-0.5">
              {rows.map(({ label, value }) => (
                <div
                  key={label}
                  className="vault-ambient-chip rounded px-1.5 py-0.5 text-[8px] leading-tight border border-vault-border/25 bg-black/22 max-w-full"
                  title={`${label}：${value}`}
                >
                  <span className="opacity-50">{label.length > 4 ? `${label.slice(0, 3)}…` : label}</span>
                  <span className="mx-0.5 opacity-25">·</span>
                  <span className="opacity-88 wrap-break-word">{value}</span>
                </div>
              ))}
            </div>
            <div className="relative shrink-0">
              <button
                ref={detailBtnRef}
                type="button"
                className="vault-ambient-detail-btn flex items-center justify-center rounded-sm p-1.5 sm:p-0.5 min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 text-vault-green/55 hover:text-vault-green/90 hover:bg-vault-green/08 border border-transparent hover:border-vault-border/30 touch-manipulation"
                aria-expanded={detailOpen}
                aria-haspopup="dialog"
                aria-label="查看世界环境层完整内容"
                title="完整档案"
                onClick={e => {
                  e.stopPropagation();
                  setDetailOpen(o => !o);
                }}
              >
                <IconAmbientDetail className="w-3.5 h-3.5" />
              </button>
              {detailOpen && (
                <div
                  ref={detailPanelRef}
                  className="vault-ambient-detail-pop absolute right-0 top-full z-50 mt-1 w-[min(100vw-1.5rem,18rem)] rounded-sm border border-vault-border/35 bg-[rgba(3,8,5,0.97)] shadow-[0_8px_28px_rgba(0,0,0,0.55)] p-2 text-[9px] leading-snug"
                  role="dialog"
                  aria-label="世界环境层全文"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="opacity-55 text-[8px] tracking-wider mb-1.5 border-b border-vault-border/20 pb-1">
                    世界环境层
                  </div>
                  <dl className="m-0 space-y-1.5 max-h-[min(40vh,220px)] overflow-y-auto vault-scrollbar">
                    {rows.map(({ label, value }) => (
                      <div key={label}>
                        <dt className="opacity-50 text-[8px]">{label}</dt>
                        <dd className="m-0 opacity-90 wrap-break-word">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function floorMessageIdLabel(): string {
  if (typeof getCurrentMessageId !== 'function') {
    return '—';
  }
  try {
    return String(getCurrentMessageId());
  } catch {
    return '—';
  }
}

/** 启动门：点击后请求全屏，再根据最新楼层分流标题页 / 开局书本 / 主界面 */
type BootPhase = 'gate' | 'title' | 'opening' | 'main';

/** 仅「最新楼层为 0」时走闸门/标题/开局；已有楼层则视为已有存档，直接进入主界面 */
function resolveBootPhaseFromChat(): BootPhase {
  try {
    if (typeof getLastMessageId === 'function' && getLastMessageId() > 0) return 'main';
  } catch {
    /* 与 0 层新会话同等处理 */
  }
  return 'gate';
}

function ModalShell(props: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  if (!props.open) return null;
  return (
    <div
      className="fixed inset-0 z-100 flex items-end justify-center pt-[env(safe-area-inset-top,0)] sm:items-center sm:justify-center sm:p-3 bg-black/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-modal-title"
      onClick={e => e.target === e.currentTarget && props.onClose()}
    >
      <div
        className="vault-panel max-h-[min(88dvh,560px)] sm:max-h-[min(82vh,520px)] w-full max-w-lg flex flex-col rounded-t-xl sm:rounded-sm shadow-[0_0_40px_rgba(0,255,65,0.12)] mb-[env(safe-area-inset-bottom,0)] sm:mb-0"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-vault-border px-3 py-2.5 sm:py-2 shrink-0">
          <h2 id="vault-modal-title" className="text-[1em] sm:text-[1.08em] tracking-widest font-semibold min-w-0 pr-2">
            {props.title}
          </h2>
          <button
            type="button"
            className="vault-btn rounded-sm px-3 py-2 sm:px-2 sm:py-1 text-[0.94em] shrink-0 min-h-11 min-w-12 sm:min-h-0 sm:min-w-0"
            onClick={props.onClose}
          >
            关闭
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-3 text-[0.94em] sm:text-[1em] leading-relaxed">
          {props.children}
        </div>
      </div>
    </div>
  );
}

export function VaultApp() {
  const tavernOk = typeof getVariables === 'function';

  const [customInput, setCustomInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  /** 流式生成时由 vaultTurnPipeline 推送的 maintext 内文预览 */
  const [streamingMaintext, setStreamingMaintext] = useState('');
  const [maintext, setMaintext] = useState('');
  const [parsedOptions, setParsedOptions] = useState<OptionItem[]>([]);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressWindowCleanupRef = useRef<(() => void) | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{
    messageId: number;
    currentText: string;
    fullMessage: string;
  } | null>(null);
  const [currentMessageInfo, setCurrentMessageInfo] = useState<{
    messageId?: number;
    userMessageId?: number;
    fullMessage?: string;
  }>({});

  const [statData, setStatData] = useState<Record<string, unknown> | null>(null);
  const [anchorMessageId, setAnchorMessageId] = useState<number | null>(null);

  const [readOpen, setReadOpen] = useState(false);
  const [readRows, setReadRows] = useState<{ messageId: number; maintext: string }[]>([]);

  const [loadOpen, setLoadOpen] = useState(false);
  const [sumRows, setSumRows] = useState<{ messageId: number; sum: string }[]>([]);
  const [branchBusyId, setBranchBusyId] = useState<number | null>(null);

  const [fsActive, setFsActive] = useState(false);
  /** gate：点击开始；title：新会话（最新楼层为 0）；main：主界面（已有楼层时首屏即 main，刷新不再选开局） */
  const [bootPhase, setBootPhase] = useState<BootPhase>(resolveBootPhaseFromChat);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vaultSettings, setVaultSettings] = useState<VaultUiSettings>(() => loadVaultUiSettings());

  /** home = 首页（正文与选项）；其余为 stat_data 顶层分区键 */
  const [activePanel, setActivePanel] = useState<'home' | string>('home');

  /** 世界环境层仅在顶栏横向展示，底部分区不再重复出现 */
  const statSectionKeys = useMemo(() => {
    if (!statData) return [] as string[];
    return Object.keys(statData).filter(k => k !== '世界环境层');
  }, [statData]);

  const displayMaintext = useMemo(() => {
    if (!isGenerating || !vaultSettings.streamLlm) return maintext;
    if (streamingMaintext.trim().length > 0) return streamingMaintext;
    return maintext;
  }, [isGenerating, maintext, streamingMaintext, vaultSettings.streamLlm]);

  const syncMaintextFromChat = useCallback(() => {
    const result = loadFromLatestMessage();
    setMaintext(result.maintext);
    setParsedOptions(result.options);
    setCurrentMessageInfo({
      messageId: result.messageId,
      userMessageId: result.userMessageId,
      fullMessage: result.fullMessage,
    });
  }, []);

  const syncStatDataFromChat = useCallback(() => {
    const { statData: sd, anchorMessageId: aid } = getLatestAssistantStatData();
    setStatData(sd);
    setAnchorMessageId(aid);
  }, []);

  const refreshReadList = useCallback(() => {
    setReadRows(getAssistantFloorsMaintext());
  }, []);

  const refreshSumList = useCallback(() => {
    setSumRows(getAssistantFloorsSum());
  }, []);

  useLayoutEffect(() => {
    const root = optionsRef.current;
    if (!root || !optionsOpen || parsedOptions.length === 0) return;
    const nodes = root.querySelectorAll('[data-vault-option]');
    if (!nodes.length) return;
    gsap.killTweensOf(nodes);
    gsap.fromTo(
      nodes,
      { opacity: 0, y: 16, scale: 0.97 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.4,
        stagger: 0.085,
        ease: 'power2.out',
      },
    );
  }, [parsedOptions, optionsOpen]);

  /** 切换聊天文件时：有楼层则直接进主界面并同步；仍停在 0 层则回到闸门（新会话流程） */
  useEffect(() => {
    if (!tavernOk || typeof eventOn !== 'function') return;
    const offChat = eventOn(tavern_events.CHAT_CHANGED, () => {
      setBootPhase(resolveBootPhaseFromChat());
      syncMaintextFromChat();
      syncStatDataFromChat();
    });
    return () => offChat.stop();
  }, [tavernOk, syncMaintextFromChat, syncStatDataFromChat]);

  useEffect(() => {
    if (!tavernOk || bootPhase !== 'main') return;
    syncMaintextFromChat();
    syncStatDataFromChat();
    const offUpdated = eventOn(tavern_events.MESSAGE_UPDATED, () => {
      syncMaintextFromChat();
      syncStatDataFromChat();
    });
    const offReceived = eventOn(tavern_events.MESSAGE_RECEIVED, () => {
      syncMaintextFromChat();
      syncStatDataFromChat();
    });
    return () => {
      offUpdated.stop();
      offReceived.stop();
    };
  }, [tavernOk, bootPhase, syncMaintextFromChat, syncStatDataFromChat]);

  /** 指南：流式回调中推送的 maintext 预览（与 vaultTurnPipeline 中 eventEmit 约定） */
  useEffect(() => {
    if (!tavernOk || bootPhase !== 'main' || typeof eventOn !== 'function') return;
    const off = eventOn(VAULT_OS_STREAM_MAINTEXT, (preview: string) => {
      setStreamingMaintext(preview);
    });
    return () => off.stop();
  }, [tavernOk, bootPhase]);

  useEffect(() => {
    if (bootPhase !== 'main' || typeof Mvu === 'undefined' || typeof eventOn !== 'function') return;
    const off = eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => {
      syncStatDataFromChat();
    });
    return () => off.stop();
  }, [bootPhase, syncStatDataFromChat]);

  /** 世界书「编年史」：新 assistant 楼层时按回合编号维护 &lt;sum&gt;（见 util/chronicleWorldbook） */
  useEffect(() => {
    if (!tavernOk || bootPhase !== 'main') return;
    const onMsg = (messageId: number) => {
      void syncChronicleOnAssistantMessage(messageId).catch(e => console.error('[vault] chronicle sync', e));
    };
    const offReceived = eventOn(tavern_events.MESSAGE_RECEIVED, onMsg);
    const offUpdated = eventOn(tavern_events.MESSAGE_UPDATED, onMsg);
    return () => {
      offReceived.stop();
      offUpdated.stop();
    };
  }, [tavernOk, bootPhase]);

  /**
   * 自定义回合管线：user/assistant 均以 refresh:none 写入，最后由 vaultTurnPipeline 发出事件，
   * 在此统一调用 builtin 刷新聊天 DOM，并同步界面状态与编年史。
   */
  useEffect(() => {
    if (!tavernOk || bootPhase !== 'main') return;
    const onCommitted = async (assistantId: number) => {
      try {
        if (typeof builtin !== 'undefined' && typeof builtin.reloadAndRenderChatWithoutEvents === 'function') {
          await builtin.reloadAndRenderChatWithoutEvents();
        }
      } catch (e) {
        console.error('[vault] reloadAndRenderChatWithoutEvents', e);
      }
      syncMaintextFromChat();
      syncStatDataFromChat();
      void syncChronicleOnAssistantMessage(assistantId).catch(err => console.warn('[vault] chronicle after turn', err));
    };
    const off = eventOn(VAULT_OS_TURN_COMMITTED, onCommitted);
    return () => off.stop();
  }, [tavernOk, bootPhase, syncMaintextFromChat, syncStatDataFromChat]);

  useEffect(() => {
    const onFs = () => setFsActive(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    if (readOpen) refreshReadList();
  }, [readOpen, refreshReadList]);

  useEffect(() => {
    if (loadOpen) refreshSumList();
  }, [loadOpen, refreshSumList]);

  useEffect(() => {
    if (activePanel === 'home') return;
    if (activePanel === VAULT_COMBAT_PANEL_KEY) return;
    if (activePanel === '世界环境层') {
      setActivePanel('home');
      return;
    }
    if (!statData || !(activePanel in statData)) setActivePanel('home');
  }, [statData, activePanel]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressWindowCleanupRef.current?.();
    longPressWindowCleanupRef.current = null;
  }, []);

  useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

  const LONG_PRESS_MS = 500;

  const getClientPoint = (e: ReactMouseEvent | ReactTouchEvent) => {
    if ('touches' in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if ('changedTouches' in e && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    const me = e as ReactMouseEvent;
    return { x: me.clientX, y: me.clientY };
  };

  const handleLongPressStart = useCallback(
    (event: ReactMouseEvent | ReactTouchEvent) => {
      if (
        contextMenu ||
        !maintext.trim() ||
        currentMessageInfo.messageId === undefined ||
        currentMessageInfo.messageId === null ||
        isGenerating
      ) {
        return;
      }

      clearLongPressTimer();
      const pos = getClientPoint(event);

      const onWindowPointerEnd = () => {
        clearLongPressTimer();
      };
      window.addEventListener('mouseup', onWindowPointerEnd);
      window.addEventListener('touchend', onWindowPointerEnd);
      longPressWindowCleanupRef.current = () => {
        window.removeEventListener('mouseup', onWindowPointerEnd);
        window.removeEventListener('touchend', onWindowPointerEnd);
      };

      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        longPressWindowCleanupRef.current?.();
        longPressWindowCleanupRef.current = null;
        setContextMenu({ x: pos.x, y: pos.y });
      }, LONG_PRESS_MS);
    },
    [contextMenu, maintext, currentMessageInfo.messageId, isGenerating, clearLongPressTimer],
  );

  const handleLongPressEnd = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  useEffect(() => {
    if (!contextMenu) return;
    const onDocClick = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      if (t.closest('.vault-maintext-context-menu') || t.closest('.vault-maintext-container')) return;
      setContextMenu(null);
    };
    const t = window.setTimeout(() => {
      document.addEventListener('click', onDocClick, true);
    }, 200);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('click', onDocClick, true);
    };
  }, [contextMenu]);

  const handleRegenerate = useCallback(async () => {
    const mid = currentMessageInfo.messageId;
    const uid = currentMessageInfo.userMessageId;
    if (mid === undefined || mid === null || uid === undefined || uid === null) {
      toastr?.error?.('无法重新生成：缺少楼层或上一条用户消息');
      setContextMenu(null);
      return;
    }
    if (typeof deleteChatMessages !== 'function' || typeof triggerSlash !== 'function') {
      toastr?.error?.('deleteChatMessages / triggerSlash 不可用');
      setContextMenu(null);
      return;
    }
    setContextMenu(null);
    setIsGenerating(true);
    try {
      await deleteChatMessages([mid], { refresh: 'affected' });
      await triggerSlash('/trigger await=true');
      syncMaintextFromChat();
      syncStatDataFromChat();
      toastr?.success?.('已按原用户输入重新生成');
    } catch (e) {
      console.error('[vault] regenerate', e);
      toastr?.error?.('重新生成失败');
    } finally {
      setIsGenerating(false);
    }
  }, [currentMessageInfo.messageId, currentMessageInfo.userMessageId, syncMaintextFromChat, syncStatDataFromChat]);

  const handleEditOpen = useCallback(() => {
    const mid = currentMessageInfo.messageId;
    const full = currentMessageInfo.fullMessage;
    if (mid === undefined || mid === null || full === undefined) {
      toastr?.error?.('无法编辑：缺少消息数据');
      setContextMenu(null);
      return;
    }
    setEditingMessage({
      messageId: mid,
      currentText: parseMaintext(full),
      fullMessage: full,
    });
    setContextMenu(null);
  }, [currentMessageInfo.messageId, currentMessageInfo.fullMessage]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessage) return;
    if (typeof setChatMessages !== 'function') {
      toastr?.error?.('setChatMessages 不可用');
      return;
    }
    const { messageId, currentText, fullMessage } = editingMessage;
    const updated = replaceLastMaintext(fullMessage, currentText);
    setIsGenerating(true);
    try {
      await setChatMessages([{ message_id: messageId, message: updated }], { refresh: 'affected' });
      setEditingMessage(null);
      syncMaintextFromChat();
      syncStatDataFromChat();
      toastr?.success?.('正文已保存');
    } catch (e) {
      console.error('[vault] save edit', e);
      toastr?.error?.('保存失败');
    } finally {
      setIsGenerating(false);
    }
  }, [editingMessage, syncMaintextFromChat, syncStatDataFromChat]);

  const headerLine = useMemo(() => {
    return `VAULT-OS · 状态源 assistant #${anchorMessageId ?? '—'}`;
  }, [anchorMessageId]);

  /** 小屏上限制菜单宽高，避免贴边或溢出视口 */
  const contextMenuLayout = useMemo(() => {
    if (!contextMenu) return null;
    if (typeof window === 'undefined') {
      return { left: contextMenu.x, top: contextMenu.y, maxW: 280 };
    }
    const pad = 12;
    const maxW = Math.min(280, window.innerWidth - pad * 2);
    const estH = 140;
    const left = Math.max(pad, Math.min(contextMenu.x, window.innerWidth - maxW - pad));
    const top = Math.max(pad, Math.min(contextMenu.y, window.innerHeight - estH - pad));
    return { left, top, maxW: Math.max(200, maxW) };
  }, [contextMenu]);

  const toggleFullscreen = () => {
    const el = document.getElementById('app');
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.().catch(() => {});
    } else {
      void document.exitFullscreen?.().catch(() => {});
    }
  };

  /** 用户手势内请求全屏；仅最新楼层为 0 时进入标题/开局选择，否则直接进入主界面 */
  const handleBootGateClick = useCallback(() => {
    const el = document.getElementById('app');
    if (el) void el.requestFullscreen?.().catch(() => {});
    let next: 'title' | 'main' = 'title';
    try {
      if (typeof getLastMessageId === 'function') {
        next = getLastMessageId() === 0 ? 'title' : 'main';
      }
    } catch {
      next = 'title';
    }
    setBootPhase(next);
  }, []);

  const onBranchFromFloor = async (messageId: number) => {
    if (typeof triggerSlash !== 'function') {
      toastr?.error?.('triggerSlash 不可用');
      return;
    }
    setBranchBusyId(messageId);
    try {
      await triggerSlash(`/branch-create ${messageId}`);
      toastr?.success?.(`已从楼层 #${messageId} 创建分支`);
      setLoadOpen(false);
    } catch (e) {
      console.error('[vault] branch-create failed', e);
      toastr?.error?.('分支创建失败，请查看控制台');
    } finally {
      setBranchBusyId(null);
    }
  };

  if (!tavernOk) {
    return (
      <div className="h-full w-full p-3 vault-panel rounded-sm text-[1em] leading-relaxed space-y-2">
        <p className="font-bold text-vault-green">VAULT-OS：未检测到酒馆助手 API</p>
        <p className="opacity-90">
          若你用 <span className="text-vault-green/90">Live Server :5500</span> 做 <strong>iframe</strong>
          ，或单独打开打包文件，页面与酒馆<strong>不同源</strong>，这里无法使用{' '}
          <code className="opacity-80">getVariables</code> / <code className="opacity-80">generateRaw</code>。
        </p>
        <p className="opacity-90">
          请把 <code className="opacity-80">pnpm build</code> 生成的 <code className="opacity-80">dist/vault</code>{' '}
          整夹复制到酒馆<strong>同一站点</strong>可访问目录（例如 <code className="opacity-80">public/vault</code>
          ），使能打开：
        </p>
        <p className="opacity-90 break-all">
          <code className="opacity-80">http://&lt;酒馆主机&gt;:&lt;端口&gt;/vault/界面/状态栏/index.html</code>
        </p>
        <p className="opacity-90">
          并在正则里使用（与酒馆页面同源，由 <code className="opacity-80">$.load</code> 注入到当前楼层 DOM）：
        </p>
        <pre className="vault-panel p-2 overflow-auto text-[0.94em] whitespace-pre-wrap">
          {`$('body').load('/vault/界面/状态栏/index.html');`}
        </pre>
        <p className="opacity-90">
          若必须用 <code className="opacity-80">http://localhost:5500/...</code> 跨域{' '}
          <code className="opacity-80">$.load</code>
          ：请使用已配置 CORS 的 Live Server（本仓库工作区端口为 5500）。若仍失败，可将{' '}
          <code className="opacity-80">pnpm build</code> 产出的 <code className="opacity-80">dist/vault</code>{' '}
          放到酒馆同源目录，改用相对路径加载。
        </p>
      </div>
    );
  }

  if (bootPhase === 'gate') {
    return (
      <div
        className={`vault-boot-gate vault-crt-shell relative h-full w-full min-h-[280px] flex flex-col items-center justify-center p-4 sm:p-6 box-border overflow-hidden ${vaultSettings.useMonoFont ? 'font-mono' : ''}`}
        style={{ fontSize: `${vaultSettings.fontSizePx}px` }}
      >
        <div className="vault-boot-gate__art" aria-hidden>
          <div className="vault-boot-gate__art-base" />
          <div className="vault-boot-gate__art-fog" />
          <div className="vault-boot-gate__art-hazard" />
          <div className="vault-boot-gate__art-grid" />
          <div className="vault-boot-gate__art-door-wrap">
            <div className="vault-boot-gate__art-door-glow" />
            <div className="vault-boot-gate__art-door" />
          </div>
          <div className="vault-boot-gate__art-vignette" />
          <div className="vault-boot-gate__art-noise" />
        </div>

        <svg className="vault-boot-gate__rad" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="56" r="11" fill="currentColor" opacity="0.85" />
          <path
            fill="currentColor"
            opacity="0.85"
            d="M50 6 L64 40 L36 40 Z M6 78 L40 52 L48 64 Z M94 78 L60 52 L52 64 Z"
          />
        </svg>

        <div className="relative z-3 flex w-full max-w-md flex-col items-center justify-center px-2">
          <div className="vault-boot-gate__card vault-panel w-full rounded-sm px-6 py-8 sm:px-9 sm:py-10 text-center">
            <p className="m-0 text-[0.72em] tracking-[0.4em] text-vault-green/50 uppercase">VAULT-OS</p>
            <p className="m-0 mt-2 text-[0.68em] tracking-[0.22em] text-[rgba(220,180,90,0.55)]">
              VAULT-TEC INDUSTRIAL INTERFACE
            </p>
            <div className="my-5 h-px w-full bg-linear-to-r from-transparent via-vault-green/35 to-transparent" />
            <p className="m-0 text-[1.05em] leading-relaxed text-vault-green/92">
              系统待机。请通过点击授权，以进入全屏与后续界面。
            </p>
            <p className="m-0 mt-3 text-[0.78em] opacity-45 leading-snug">避难所闸门联机 · 环境辐射读数待机中</p>
            <button
              type="button"
              className="vault-btn mt-8 w-full rounded-sm px-6 py-3.5 text-[1.05em] tracking-[0.2em] shadow-[0_0_28px_rgba(0,255,65,0.2)] transition-shadow hover:shadow-[0_0_36px_rgba(0,255,65,0.28)]"
              onClick={handleBootGateClick}
            >
              点击此处开始
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (bootPhase === 'title') {
    return (
      <div
        className={`vault-crt-shell h-full w-full min-h-[280px] flex flex-col items-center justify-center p-6 box-border ${vaultSettings.useMonoFont ? 'font-mono' : ''}`}
        style={{ fontSize: `${vaultSettings.fontSizePx}px` }}
      >
        <div className="vault-panel rounded-sm p-8 sm:p-10 max-w-lg w-full flex flex-col items-center gap-6 text-center border border-vault-border/45 shadow-[0_0_40px_rgba(0,255,65,0.1)]">
          <h1 className="m-0 text-[1.35em] text-vault-green tracking-[0.28em] font-semibold">VAULT-OS</h1>
          <p className="m-0 text-[0.95em] opacity-75 leading-relaxed">
            检测到本聊天仍停留在开局楼层（最新楼层为 0）。
            <br />
            会话尚未展开——由此进入标题界面。
          </p>
          <p className="m-0 text-[0.85em] opacity-50 tracking-wider">// NEW SESSION · READY</p>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-stretch sm:items-center">
            <button
              type="button"
              className="vault-btn rounded-sm px-8 py-3 text-[1em] tracking-[0.15em] w-full sm:min-w-44"
              onClick={() => setBootPhase('opening')}
            >
              开始游戏
            </button>
            <button
              type="button"
              className="vault-btn rounded-sm px-5 py-2.5 text-[0.88em] opacity-75 w-full sm:w-auto border border-vault-border/35"
              onClick={() => setBootPhase('main')}
            >
              快速进入
            </button>
          </div>
          <p className="m-0 text-[0.78em] opacity-45">「开始游戏」将打开档案式开局；「快速进入」跳过开局设定。</p>
        </div>
      </div>
    );
  }

  if (bootPhase === 'opening') {
    return (
      <VaultOpeningBook
        useMonoFont={vaultSettings.useMonoFont}
        fontSizePx={vaultSettings.fontSizePx}
        onDone={() => {
          setBootPhase('main');
          syncStatDataFromChat();
          syncMaintextFromChat();
        }}
      />
    );
  }

  /**
   * 游戏内发送：不走路馆原生输入框（避免整页楼层刷新），经 `handleVaultUnifiedRequest` → `runVaultTurn`。
   */
  const submitLine = async (raw: string, clearMode: 'custom' | 'none' = 'custom') => {
    const trimmed = raw.trim();
    if (!trimmed || isGenerating) return;
    if (typeof createChatMessages !== 'function' || typeof generate !== 'function') {
      toastr?.error?.('createChatMessages / generate 不可用，无法执行回合管线');
      return;
    }

    if (clearMode === 'custom') setCustomInput('');

    const statSnapshot = statData ? JSON.stringify(statData).slice(0, 2200) : '（当前无 stat_data）';

    const mode = vaultSettings.outputMode;
    let dual: DualApiRuntimeConfig | null = null;
    if (mode === 'dual_api') {
      const wb = await resolveVaultWorldbookName(vaultSettings.worldbookName);
      if (!wb) {
        toastr?.error?.('多 API 模式需要先解析世界书：请在设置中填写名称或为角色绑定主世界书');
        return;
      }
      if (!vaultSettings.dualApi.apiurl.trim() || !vaultSettings.dualApi.model.trim()) {
        toastr?.error?.('多 API 模式请在设置中填写第二 API 的 URL 与模型');
        return;
      }
      dual = {
        apiurl: vaultSettings.dualApi.apiurl,
        key: vaultSettings.dualApi.key,
        model: vaultSettings.dualApi.model,
        maxRetries: vaultSettings.dualApi.maxRetries,
        secondApiExtraTasks: vaultSettings.dualApi.secondApiExtraTasks,
        worldbookName: wb,
      };
    }

    const ok = await handleVaultUnifiedRequest(
      { type: 'custom', content: trimmed },
      {
        statSnapshot,
        shouldStream: vaultSettings.streamLlm,
        mode,
        dual,
      },
      {
        onShowGenerating: () => setIsGenerating(true),
        onHideGenerating: () => {
          setIsGenerating(false);
          setStreamingMaintext('');
        },
        onError: msg => {
          toastr?.error?.(msg || '生成失败');
        },
      },
    );
    if (ok) {
      console.info('[vault] vault turn committed (unified handler)');
    }
  };

  return (
    <div
      className={`vault-crt-shell h-full w-full min-h-0 flex flex-col p-1.5 sm:p-2 box-border ${vaultSettings.useMonoFont ? 'font-mono' : ''}`}
      style={{ fontSize: `${vaultSettings.fontSizePx}px` }}
    >
      <div className="vault-crt-inner flex flex-col flex-1 min-h-0 gap-2">
        <div className="vault-panel rounded-sm p-2 sm:p-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 shrink-0">
          <div className="text-[0.88em] sm:text-[1em] tracking-wider opacity-90 truncate min-w-0 sm:flex-1">
            {headerLine}
          </div>
          <div className="flex flex-col gap-2 w-full sm:w-auto sm:shrink-0 sm:items-end">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-1.5 sm:justify-end">
              <button
                type="button"
                className="vault-btn rounded-sm px-2 py-2.5 sm:py-1.5 text-[0.88em] sm:text-[0.94em] min-h-11 sm:min-h-0 touch-manipulation"
                onClick={() => setSettingsOpen(true)}
              >
                设置
              </button>
              <button
                type="button"
                className="vault-btn rounded-sm px-2 py-2.5 sm:py-1.5 text-[0.88em] sm:text-[0.94em] min-h-11 sm:min-h-0 touch-manipulation"
                onClick={() => setReadOpen(true)}
              >
                阅读模式
              </button>
              <button
                type="button"
                className="vault-btn rounded-sm px-2 py-2.5 sm:py-1.5 text-[0.88em] sm:text-[0.94em] min-h-11 sm:min-h-0 touch-manipulation"
                onClick={() => setLoadOpen(true)}
              >
                读档
              </button>
              <button
                type="button"
                className="vault-btn rounded-sm px-2 py-2.5 sm:py-1.5 text-[0.88em] sm:text-[0.94em] min-h-11 sm:min-h-0 touch-manipulation"
                onClick={toggleFullscreen}
                title={fsActive ? '退出全屏' : '全屏'}
              >
                {fsActive ? '退出全屏' : '全屏'}
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[0.78em] sm:text-[0.85em] opacity-60 sm:justify-end">
              <span className="tabular-nums truncate">界面楼层 MSG #{floorMessageIdLabel()}</span>
              {isGenerating && <span className="animate-pulse shrink-0">生成中…</span>}
            </div>
          </div>
        </div>

        <VaultAmbientStrip statData={statData} anchorMessageId={anchorMessageId} />

        <div
          className="vault-panel rounded-sm flex flex-col flex-1 min-h-0 overflow-hidden"
          role="tabpanel"
          id="vault-tabpanel"
          aria-labelledby={
            activePanel === 'home'
              ? 'vault-tab-home'
              : activePanel === VAULT_COMBAT_PANEL_KEY
                ? 'vault-tab-combat-hud'
                : tabIdForStatKey(activePanel)
          }
        >
          <div
            className={
              activePanel === 'home'
                ? 'flex-1 min-h-0 flex flex-col overflow-hidden p-2 sm:p-2.5'
                : activePanel === VAULT_COMBAT_PANEL_KEY
                  ? 'flex-1 min-h-0 flex flex-col overflow-hidden p-2 sm:p-2.5'
                  : 'flex-1 min-h-0 overflow-y-auto vault-scrollbar p-2 sm:p-2.5'
            }
          >
            {activePanel === 'home' ? (
              <section className="flex flex-col flex-1 min-h-0 gap-2 overflow-hidden">
                <h2 className="text-[0.95em] opacity-75 tracking-widest font-normal m-0 shrink-0">MAINTEXT · 正文</h2>
                <div
                  className={[
                    'vault-maintext-container vault-maintext-region flex-1 min-h-0 overflow-y-auto vault-scrollbar text-[1em] leading-relaxed whitespace-pre-wrap wrap-break-word rounded-sm px-2.5 py-2.5 border border-vault-border/55 bg-black/28 touch-manipulation select-text',
                    currentMessageInfo.messageId !== undefined &&
                    currentMessageInfo.messageId !== null &&
                    displayMaintext.trim() &&
                    !isGenerating
                      ? 'cursor-pointer'
                      : 'cursor-default',
                  ].join(' ')}
                  onMouseDown={e => {
                    if (contextMenu) return;
                    if (e.button !== 0) return;
                    handleLongPressStart(e);
                  }}
                  onMouseUp={e => {
                    e.stopPropagation();
                    handleLongPressEnd();
                  }}
                  onMouseLeave={handleLongPressEnd}
                  onTouchStart={e => {
                    if (contextMenu) return;
                    handleLongPressStart(e);
                  }}
                  onTouchEnd={e => {
                    e.stopPropagation();
                    handleLongPressEnd();
                  }}
                  onTouchCancel={handleLongPressEnd}
                >
                  {displayMaintext.trim() ? displayMaintext : '（当前最新 assistant 楼层中尚无 <maintext> 或正文为空）'}
                </div>

                {parsedOptions.length > 0 && (
                  <div className="space-y-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setOptionsOpen(o => !o)}
                      className="vault-btn w-full rounded-sm px-3 py-2 text-[1em] flex items-center justify-between gap-2"
                    >
                      <span className="tracking-wider">选项</span>
                      <span className="opacity-80">
                        {parsedOptions.length} 项 · {optionsOpen ? '点击收起' : '点击展开'}
                      </span>
                    </button>
                    {optionsOpen && (
                      <div ref={optionsRef} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {parsedOptions.map((o, idx) => (
                          <button
                            key={`${o.id}-${idx}`}
                            type="button"
                            data-vault-option
                            disabled={isGenerating}
                            onClick={() => void submitLine(o.text, 'none')}
                            className={[
                              'vault-option-tile rounded-sm px-3 py-2.5 text-left text-[1em] leading-snug',
                              'text-vault-green disabled:opacity-40 disabled:pointer-events-none',
                              'focus:outline-none focus-visible:ring-2 focus-visible:ring-vault-green/50',
                            ].join(' ')}
                          >
                            <div className="flex items-start gap-2">
                              <span className="vault-option-key font-bold shrink-0 w-5 tabular-nums opacity-95">
                                {o.id}
                              </span>
                              <span className="wrap-break-word opacity-95">{o.text}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 items-stretch pt-1 shrink-0 border-t border-vault-border/20">
                  <input
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') void submitLine(customInput, 'custom');
                    }}
                    className="vault-input flex-1 min-w-0 rounded-sm px-2 py-2.5 sm:py-2 text-[0.95em] sm:text-[1em] min-h-11 sm:min-h-0"
                    placeholder="自定义行动 / 其他指令（Enter 或提交）"
                    disabled={isGenerating}
                    enterKeyHint="send"
                  />
                  <button
                    type="button"
                    className="vault-btn rounded-sm px-3 py-2.5 sm:py-2 text-[0.95em] sm:text-[1em] shrink-0 w-full sm:w-auto min-h-11 sm:min-h-0 touch-manipulation"
                    onClick={() => void submitLine(customInput, 'custom')}
                    disabled={isGenerating}
                  >
                    提交
                  </button>
                </div>
              </section>
            ) : activePanel === VAULT_COMBAT_PANEL_KEY ? (
              <section
                className="flex flex-col flex-1 min-h-0 gap-0 overflow-hidden"
                aria-labelledby="vault-combat-hud-heading"
              >
                <h2 id="vault-combat-hud-heading" className="sr-only">
                  战斗 HUD
                </h2>
                <CombatHudPanel />
              </section>
            ) : activePanel === '监督者系统' ? (
              <section className="flex flex-col min-h-0 gap-2" aria-labelledby="vault-supervisor-heading">
                <h2
                  id="vault-supervisor-heading"
                  className="text-[1em] font-semibold tracking-[0.18em] text-vault-green m-0 shrink-0"
                >
                  监督者系统
                </h2>
                <div className="min-h-0 flex-1 overflow-y-auto vault-scrollbar pr-0.5">
                  <SupervisorPanel raw={statData?.['监督者系统']} />
                </div>
              </section>
            ) : (
              <section className="flex flex-col min-h-0 gap-2" aria-labelledby={`vault-stat-section-${activePanel}`}>
                <h2
                  id={`vault-stat-section-${activePanel}`}
                  className="text-[1em] font-semibold tracking-[0.18em] text-vault-green m-0 shrink-0"
                >
                  {activePanel}
                </h2>
                <div className="min-h-0 flex-1 overflow-y-auto vault-scrollbar pr-0.5">
                  <StatDataTree
                    data={
                      statData && activePanel in statData ? { [activePanel]: statData[activePanel] as unknown } : null
                    }
                  />
                </div>
              </section>
            )}
          </div>
        </div>

        <nav
          className="vault-tab-rail vault-scrollbar flex flex-nowrap items-stretch gap-1.5 overflow-x-auto shrink-0 pb-0.5 pt-1 px-0.5 sm:px-0"
          role="tablist"
          aria-label="状态分区"
        >
          <button
            type="button"
            role="tab"
            id="vault-tab-home"
            aria-selected={activePanel === 'home'}
            aria-controls="vault-tabpanel"
            data-active={activePanel === 'home'}
            className="vault-tab-pill flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-2 sm:px-3 text-[0.82em] sm:text-[0.94em] font-medium"
            onClick={() => setActivePanel('home')}
          >
            <IconHome className="w-3.5 h-3.5 opacity-90" />
            首页
          </button>
          <button
            type="button"
            role="tab"
            id="vault-tab-combat-hud"
            aria-selected={activePanel === VAULT_COMBAT_PANEL_KEY}
            aria-controls="vault-tabpanel"
            data-active={activePanel === VAULT_COMBAT_PANEL_KEY}
            title="解析助手消息中的 COMBAT_JSON"
            className="vault-tab-pill max-w-44 shrink-0 truncate rounded-full px-2.5 py-2 sm:px-3 text-[0.82em] sm:text-[0.94em] font-medium"
            onClick={() => setActivePanel(VAULT_COMBAT_PANEL_KEY)}
          >
            战斗 HUD
          </button>
          {statSectionKeys.map(key => {
            const tabId = tabIdForStatKey(key);
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={tabId}
                aria-selected={activePanel === key}
                aria-controls="vault-tabpanel"
                title={key}
                data-active={activePanel === key}
                className="vault-tab-pill max-w-38 sm:max-w-40 shrink-0 truncate rounded-full px-2.5 py-2 sm:px-3 text-[0.82em] sm:text-[0.94em] font-medium"
                onClick={() => setActivePanel(key)}
              >
                {key}
              </button>
            );
          })}
        </nav>
      </div>

      {contextMenu && contextMenuLayout && (
        <div
          className="vault-maintext-context-menu vault-panel fixed z-110 rounded-sm border border-vault-border shadow-[0_8px_32px_rgba(0,0,0,0.65)] py-1 text-[1em] max-w-[calc(100vw-1.5rem)] sm:min-w-52"
          style={
            {
              left: contextMenuLayout.left,
              top: contextMenuLayout.top,
              width: contextMenuLayout.maxW,
            } as CSSProperties
          }
          role="menu"
          onClick={e => {
            e.stopPropagation();
          }}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-vault-border/40">
            <span className="text-[0.94em] opacity-80">操作</span>
            <button
              type="button"
              className="vault-btn rounded-sm px-2 py-0.5 text-[0.94em] leading-none"
              onClick={() => setContextMenu(null)}
              aria-label="关闭菜单"
            >
              ×
            </button>
          </div>
          <button
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-vault-panel disabled:opacity-40 disabled:pointer-events-none"
            disabled={isGenerating}
            onClick={() => void handleRegenerate()}
          >
            {isGenerating ? '处理中…' : '重 roll'}
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-vault-panel disabled:opacity-40 disabled:pointer-events-none border-t border-vault-border/25"
            disabled={isGenerating}
            onClick={handleEditOpen}
          >
            编辑正文
          </button>
        </div>
      )}

      {editingMessage && (
        <div
          className="fixed inset-0 z-120 flex items-end justify-center sm:items-center pt-[env(safe-area-inset-top,0)] sm:p-3 bg-black/70 backdrop-blur-[3px]"
          role="presentation"
          onClick={() => !isGenerating && setEditingMessage(null)}
        >
          <div
            className="vault-panel w-full max-w-3xl max-h-[min(92dvh,720px)] sm:max-h-[90vh] flex flex-col rounded-t-xl sm:rounded-sm shadow-[0_0_40px_rgba(0,255,65,0.12)] mb-[env(safe-area-inset-bottom,0)] sm:mb-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vault-edit-maintext-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-vault-border px-3 py-2.5 sm:py-2 shrink-0">
              <h2
                id="vault-edit-maintext-title"
                className="text-[0.95em] sm:text-[1.08em] tracking-widest font-semibold m-0 min-w-0 pr-2"
              >
                编辑正文 · maintext
              </h2>
              <button
                type="button"
                className="vault-btn rounded-sm px-3 py-2 sm:px-2 sm:py-1 text-[0.94em] shrink-0 min-h-11 sm:min-h-0"
                onClick={() => setEditingMessage(null)}
                disabled={isGenerating}
              >
                关闭
              </button>
            </div>
            <div className="min-h-0 flex-1 flex flex-col gap-2 p-3 overflow-hidden">
              <textarea
                id="vault-edit-maintext-textarea"
                value={editingMessage.currentText}
                onChange={e => setEditingMessage({ ...editingMessage, currentText: e.target.value })}
                disabled={isGenerating}
                className="vault-input flex-1 min-h-[min(200px,35dvh)] max-h-[min(55dvh,480px)] sm:max-h-[min(60vh,480px)] w-full rounded-sm px-2 py-2 text-[0.95em] sm:text-[1em] leading-relaxed resize-y font-mono"
                spellCheck={false}
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
                <button
                  type="button"
                  className="vault-btn rounded-sm px-3 py-2.5 sm:py-2 text-[1em] w-full sm:w-auto min-h-11 sm:min-h-0 touch-manipulation"
                  onClick={() => setEditingMessage(null)}
                  disabled={isGenerating}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="vault-btn rounded-sm px-3 py-2.5 sm:py-2 text-[1em] w-full sm:w-auto min-h-11 sm:min-h-0 touch-manipulation"
                  onClick={() => void handleSaveEdit()}
                  disabled={isGenerating}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ModalShell title="阅读模式 · 各层 maintext" open={readOpen} onClose={() => setReadOpen(false)}>
        <div className="space-y-3">
          <p className="text-[0.94em] opacity-70">
            按 assistant 楼层列出，每条为对应楼层内解析出的 &lt;maintext&gt;（若无则为空）。
          </p>
          <button type="button" className="vault-btn rounded-sm px-2 py-1 text-[0.94em]" onClick={refreshReadList}>
            刷新列表
          </button>
          <ul className="space-y-2">
            {readRows.length === 0 && <li className="opacity-60">暂无可解析的楼层。</li>}
            {readRows.map(row => (
              <li key={row.messageId} className="vault-panel rounded-sm p-2 border border-vault-border/50">
                <div className="text-[0.94em] opacity-70 mb-1">楼层 #{row.messageId}</div>
                <div className="whitespace-pre-wrap wrap-break-word opacity-95">
                  {row.maintext.trim() ? row.maintext : '（无 <maintext>）'}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </ModalShell>

      <ModalShell title="读档 · 各层 sum" open={loadOpen} onClose={() => setLoadOpen(false)}>
        <div className="space-y-3">
          <p className="text-[0.94em] opacity-70">
            列出各 assistant 楼层内解析的 &lt;sum&gt;。点击一行将执行 <code className="opacity-80">/branch-create</code>{' '}
            从该楼层创建分支并跳转（与酒馆行为一致）。
          </p>
          <button type="button" className="vault-btn rounded-sm px-2 py-1 text-[0.94em]" onClick={refreshSumList}>
            刷新列表
          </button>
          <ul className="space-y-2">
            {sumRows.length === 0 && <li className="opacity-60">暂无楼层数据。</li>}
            {sumRows.map(row => (
              <li key={row.messageId}>
                <button
                  type="button"
                  disabled={branchBusyId !== null}
                  onClick={() => void onBranchFromFloor(row.messageId)}
                  className="vault-panel w-full text-left rounded-sm p-2 border border-vault-border/50 hover:border-vault-green/60 hover:bg-vault-panel transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[0.94em] font-semibold">楼层 #{row.messageId}</span>
                    {branchBusyId === row.messageId ? (
                      <span className="text-[0.85em] opacity-70">处理中…</span>
                    ) : (
                      <span className="text-[0.85em] opacity-50">创建分支</span>
                    )}
                  </div>
                  <div className="text-[0.94em] opacity-90 whitespace-pre-wrap wrap-break-word line-clamp-4">
                    {row.sum.trim() ? row.sum : '（无 <sum>）'}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </ModalShell>

      <VaultSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={s => setVaultSettings(s)}
      />
    </div>
  );
}

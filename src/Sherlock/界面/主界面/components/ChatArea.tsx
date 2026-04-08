import {
  Bookmark,
  Crosshair,
  History,
  Maximize2,
  Minimize2,
  Pencil,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type ReactNode,
} from 'react';
import { useBattleProtocol } from '../context/BattleProtocolContext';
import { useSherlockStats } from '../context/SherlockStatContext';
import { shouldBurnApFromAssistantMessage } from '../lib/apBurnCheckContext';
import { computeApBurnRatioOfApMax, computeBattleGaugeIntensity } from '../lib/apBurnFromBattleGauge';
import { SHERLOCK_OPTION_MAX } from '../lib/messageParser';
import { handleSherlockRequest, handleSherlockReroll } from '../lib/sherlockRequestHandler';
import { SHERLOCK_RECENT_VISIBLE_CHAT_MESSAGES } from '../lib/sherlockHideFloors';
import { showSherlockLoadSave, showSherlockReviewStory } from '../lib/sherlockSaveLoad';
import {
  loadFromLatestMessage,
  parseMaintext,
  parseOptionsDetailed,
  type OptionItem,
} from '../lib/storyTags';
import { cn } from '../lib/utils';
import { SherlockOptionList } from './SherlockOptionRail';

const DEMO_MESSAGES: Array<{
  id: string;
  role: 'system' | 'user' | 'llm';
  content: string;
  type?: 'narrative' | 'clue' | 'check' | 'choice';
}> = [
  {
    id: '1',
    role: 'system',
    content:
      '伦敦，1895年。浓雾笼罩着贝克街，煤气灯在湿漉漉的鹅卵石上投下摇曳的倒影。你站在221B的门前，手中紧紧攥着那封带有火漆印记的密信。',
    type: 'narrative',
  },
  {
    id: '2',
    role: 'llm',
    content:
      '“进来吧，门没锁。”一个低沉而富有磁性的声音从门内传出，伴随着小提琴弦被拨动的清脆声响。“你的脚步声比平时重了三分之一，心跳频率加快，左手袖口沾着泰晤士河畔特有的红泥。看来，苏格兰场又遇到了他们那可怜的智商无法处理的麻烦。”\n\n福尔摩斯放下小提琴，灰色的眼睛锐利地盯着你。“说吧，那封信里写了什么？”',
    type: 'narrative',
  },
  {
    id: '3',
    role: 'system',
    content: '【线索发现】获得关键物品：带有火漆印记的密信。线索权重 +5。',
    type: 'clue',
  },
  {
    id: '4',
    role: 'user',
    content:
      '我深吸一口气，将信件递给他。“是莫里亚蒂。他声称在伦敦塔桥下埋设了炸药，要求我们在午夜前解开他的谜题，否则……”',
  },
  {
    id: '5',
    role: 'system',
    content: '【沟通力检定】难度：困难 (75)。当前沟通力：80。检定成功！福尔摩斯的注意力被完全吸引。',
    type: 'check',
  },
  {
    id: '6',
    role: 'llm',
    content:
      '“莫里亚蒂……”福尔摩斯的眼神瞬间变得狂热，他猛地站起身，一把抓过信件。“游戏开始了！这不仅仅是炸药的问题，这是一个精心设计的棋局。他想测试我们的底线。”\n\n他转身看向你，眼中闪烁着危险的光芒。“我们现在有三个选择。直接去塔桥排爆，这最愚蠢；去苏格兰场调取监控，这最无聊；或者，去他信中提到的那个‘起点’——大英博物馆的古埃及展区。”',
    type: 'choice',
  },
];

/** 离线预览：首项 0 消耗缓推，其余递增示意「激进」路线 */
const DEMO_OPTION_ITEMS: OptionItem[] = [
  { id: 'A', text: '前往大英博物馆古埃及展区', apCost: 0 },
  { id: 'B', text: '前往伦敦塔桥排爆', apCost: 3 },
  { id: 'C', text: '前往苏格兰场调取监控', apCost: 2 },
  { id: 'D', text: '留在贝克街整理已有线索', apCost: 1 },
];

const DEMO_CHOICES: Array<{ text: string; variant: 'primary' | 'danger' | 'neutral' }> = [
  { text: '前往大英博物馆古埃及展区', variant: 'primary' },
  { text: '前往伦敦塔桥排爆', variant: 'danger' },
  { text: '前往苏格兰场调取监控', variant: 'neutral' },
  { text: '留在贝克街整理已有线索', variant: 'neutral' },
];

type LiveLine =
  | { key: string; role: 'user'; messageId: number; text: string }
  | { key: string; role: 'assistant'; messageId: number; text: string };

function canUseTavernChat(): boolean {
  return (
    typeof getLastMessageId === 'function' &&
    typeof getChatMessages === 'function' &&
    typeof createChatMessages === 'function' &&
    typeof generate === 'function'
  );
}

/** 重 roll / 编辑正文依赖；与主聊天检测分开，避免助手未注入时整页误判为离线预览 */
function hasMessageMutationApis(): boolean {
  return typeof deleteChatMessages === 'function' && typeof setChatMessages === 'function';
}

/** 与酒馆同步时拉取的楼层深度（原 8 层易导致长剧情「看不到」） */
const CHAT_HISTORY_DEPTH = 64;

/**
 * 案卷正文不展示「开场白」：仅当整段聊天记录的**首条楼层**就是 assistant 时，跳过该条（常见为开局导语）。
 * 若首条是玩家发言，则第一条助手回复仍正常显示。option / MVU / 回顾仍包含该楼层原文。
 */
function getOpeningAssistantIdToSkip(
  collected: Array<{ message_id: number; role: string; message: string }>,
): number | null {
  if (collected.length === 0) return null;
  const minId = Math.min(...collected.map(c => c.message_id));
  const first = collected.find(c => c.message_id === minId);
  return first?.role === 'assistant' ? first.message_id : null;
}

function collectVisibleChatRows(
  lastMessageId: number,
  maxLayers: number,
): Array<{ message_id: number; role: string; message: string }> {
  const unhidden: GetChatMessagesOption = { hide_state: 'unhidden', include_swipes: false };

  try {
    const bulk = getChatMessages(`0-${lastMessageId}`, unhidden);
    return bulk.map(msg => ({
      message_id: msg.message_id,
      role: msg.role,
      message: msg.message || '',
    }));
  } catch {
    /* 回退：逐层（仅未隐藏） */
  }

  const collected: Array<{ message_id: number; role: string; message: string }> = [];
  const seen = new Set<number>();
  for (let i = 0; i < maxLayers && lastMessageId - i >= 0; i++) {
    try {
      const messages = getChatMessages(lastMessageId - i, unhidden);
      if (messages?.length) {
        const msg = messages[0];
        if (seen.has(msg.message_id)) continue;
        seen.add(msg.message_id);
        collected.push({
          message_id: msg.message_id,
          role: msg.role,
          message: msg.message || '',
        });
      }
    } catch {
      /* 楼层不存在 */
    }
  }
  collected.sort((a, b) => a.message_id - b.message_id);
  return collected;
}

function loadLinesFromChat(maxLayers = CHAT_HISTORY_DEPTH): { lines: LiveLine[] } {
  const lastMessageId = getLastMessageId();
  const lines: LiveLine[] = [];
  if (lastMessageId < 0) {
    return { lines };
  }

  const collected = collectVisibleChatRows(lastMessageId, maxLayers);
  const skipAssistantId = getOpeningAssistantIdToSkip(collected);

  for (const msg of collected) {
    if (msg.role === 'user') {
      const raw = msg.message || '';
      lines.push({
        key: `u-${msg.message_id}`,
        role: 'user',
        messageId: msg.message_id,
        text: raw.replace(/<StatusPlaceHolderImpl\s*\/?>/gi, '').trim(),
      });
    } else if (msg.role === 'assistant') {
      if (skipAssistantId !== null && msg.message_id === skipAssistantId) {
        continue;
      }
      const maintext = parseMaintext(msg.message);
      const display =
        maintext ||
        (msg.message?.trim()
          ? msg.message.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim() || msg.message.slice(0, 2000)
          : '');
      if (display) {
        lines.push({
          key: `a-${msg.message_id}`,
          role: 'assistant',
          messageId: msg.message_id,
          text: display,
        });
      }
    }
  }

  return {
    lines: sliceLinesToLastNFloors(lines, collected, SHERLOCK_RECENT_VISIBLE_CHAT_MESSAGES),
  };
}

/** 仅保留最近 N 个聊天楼层对应的叙事条（与主界面「保留最近 N 楼」一致，而非简单截最后 N 条气泡） */
function sliceLinesToLastNFloors(
  lines: LiveLine[],
  floorRows: Array<{ message_id: number }>,
  n: number,
): LiveLine[] {
  const uniqueIds = [...new Set(floorRows.map(r => r.message_id))].sort((a, b) => a - b);
  if (uniqueIds.length <= n) return lines;
  const keep = new Set(uniqueIds.slice(-n));
  return lines.filter(l => keep.has(l.messageId));
}

/** 长按约 500ms 打开上下文菜单（桌面/触摸） */
function LongPressMaintext({
  children,
  disabled,
  blockStart,
  onLongPress,
}: {
  children: ReactNode;
  disabled: boolean;
  /** 已有菜单打开时不再开始计时 */
  blockStart: boolean;
  onLongPress: (clientX: number, clientY: number) => void;
}) {
  const timerRef = useRef<number | null>(null);
  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || blockStart) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      let clientX = 0;
      let clientY = 0;
      if ('touches' in e && e.touches.length) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      onLongPress(clientX, clientY);
    }, 500);
  };

  return (
    <div
      className="maintext-container cursor-pointer"
      onMouseDown={e => {
        if (disabled || blockStart) return;
        e.stopPropagation();
        start(e);
      }}
      onMouseUp={e => {
        e.stopPropagation();
        clearTimer();
      }}
      onMouseLeave={() => clearTimer()}
      onTouchStart={e => {
        if (disabled || blockStart) return;
        start(e);
      }}
      onTouchEnd={e => {
        e.stopPropagation();
        clearTimer();
      }}
      onTouchCancel={() => clearTimer()}
    >
      {children}
    </div>
  );
}

const FLOOR_NEON_VARIANTS = 6;

function floorNeonVariant(messageId: number, role: 'user' | 'assistant'): number {
  const u = messageId >= 0 ? messageId : 0;
  return Math.abs((u + 1) * 31 + (role === 'user' ? 5 : 0)) % FLOOR_NEON_VARIANTS;
}

/** 非全屏底栏 / 全屏悬浮递状：共用工具条与输入 */
function ChatActionInputChrome({
  layout,
  onCloseFloat,
  inputValue,
  setInputValue,
  onSend,
  offlineDemo,
  isLoading,
  inputUnlocked,
  onToggleFullscreen,
  isFullscreen,
  canReroll,
  canEditBody,
  onReroll,
  onEditBody,
}: {
  layout: 'inline' | 'float';
  onCloseFloat?: () => void;
  inputValue: string;
  setInputValue: (v: string) => void;
  onSend: () => void;
  offlineDemo: boolean;
  isLoading: boolean;
  inputUnlocked: boolean;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  canReroll: boolean;
  canEditBody: boolean;
  onReroll: () => void;
  onEditBody: () => void;
}) {
  const placeholder = offlineDemo
    ? '载入完整案卷后，可在此接续叙事……'
    : !inputUnlocked
      ? '请先掀开雾幕并点「开始游戏」，再于此书写递状……'
      : '写下行动、追问或推演……';

  const toolbar = (
    <div
      className={cn(
        'scrollbar-hide flex min-w-0 shrink-0 flex-nowrap items-center gap-0.5 overflow-x-auto overflow-y-visible border-b border-white/5 px-1 sm:gap-1.5 sm:px-2',
        layout === 'float' ? 'min-h-9 pb-1.5 pt-0.5' : 'min-h-11 pb-2.5 pt-0.5 sm:min-h-12',
      )}
    >
      <button
        type="button"
        className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded p-2 text-sherlock-text-muted transition-colors hover:text-sherlock-gold disabled:opacity-40"
        title="读档 / 存档"
        disabled={offlineDemo || !inputUnlocked}
        onClick={() => {
          if (!offlineDemo) showSherlockLoadSave();
        }}
      >
        <History className="h-4 w-4 shrink-0" />
      </button>
      <button
        type="button"
        className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded p-2 text-sherlock-text-muted transition-colors hover:text-sherlock-gold disabled:opacity-40"
        title="重掷：撤去最新一段回音，用同一递状再生成"
        disabled={!canReroll || !inputUnlocked}
        onClick={() => void onReroll()}
      >
        <RefreshCw className="h-4 w-4 shrink-0" />
      </button>
      <button
        type="button"
        className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded p-2 text-sherlock-text-muted transition-colors hover:text-sherlock-gold disabled:opacity-40"
        title="编辑叙事正文"
        disabled={!canEditBody || !inputUnlocked}
        onClick={() => onEditBody()}
      >
        <Pencil className="h-4 w-4 shrink-0" />
      </button>
      <button
        type="button"
        className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded p-2 text-sherlock-text-muted transition-colors hover:text-sherlock-gold disabled:opacity-40"
        title={isFullscreen ? '退出全屏' : '全屏案卷'}
        disabled={!inputUnlocked}
        onClick={onToggleFullscreen}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4 shrink-0" /> : <Maximize2 className="h-4 w-4 shrink-0" />}
      </button>
      <button
        type="button"
        className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded p-2 text-sherlock-text-muted transition-colors hover:text-sherlock-blue disabled:opacity-40"
        title="正文摘录回顾"
        disabled={offlineDemo || !inputUnlocked}
        onClick={() => {
          if (!offlineDemo) showSherlockReviewStory();
        }}
      >
        <Crosshair className="h-4 w-4 shrink-0" />
      </button>
      <button
        type="button"
        className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded p-2 text-sherlock-text-muted opacity-50"
        title="收藏（尚未开放）"
        disabled
      >
        <Bookmark className="h-4 w-4 shrink-0" />
      </button>
    </div>
  );

  const inputRow = (
    <div
      className={cn(
        'flex gap-2',
        layout === 'float' ? 'min-h-0 items-end pb-1' : 'items-end overflow-visible pb-0.5',
      )}
    >
      {layout === 'float' ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <textarea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={placeholder}
            className="sherlock-input-textarea sherlock-scroll-y-invisible min-h-24 max-h-[min(38dvh,320px)] flex-1 resize-y border-none bg-transparent p-2 text-sm leading-relaxed text-sherlock-text-primary outline-none placeholder:text-sherlock-text-muted sm:text-sm"
            rows={5}
            disabled={offlineDemo || isLoading || !inputUnlocked}
          />
        </div>
      ) : (
        <textarea
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={placeholder}
          className="sherlock-input-textarea sherlock-scroll-y-invisible max-h-32 min-h-11 flex-1 resize-none border-none bg-transparent p-2 text-base text-sherlock-text-primary outline-none placeholder:text-sherlock-text-muted sm:text-sm"
          rows={1}
          disabled={offlineDemo || isLoading || !inputUnlocked}
        />
      )}
      <button
        type="button"
        onClick={onSend}
        disabled={!inputValue.trim() || offlineDemo || isLoading || !inputUnlocked}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-sherlock-gold/30 bg-sherlock-gold/20 p-2.5 text-sherlock-gold transition-colors hover:bg-sherlock-gold/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-5 w-5 shrink-0" />
      </button>
    </div>
  );

  if (layout === 'float') {
    return (
      <div className="sherlock-dialogue-float flex max-h-[min(52dvh,520px)] min-h-0 w-full flex-col overflow-hidden p-2 sm:p-2.5">
        <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2 border-b border-white/10 pb-1.5">
          <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-sherlock-text-muted">
            <span className="h-px w-6 bg-linear-to-r from-sherlock-gold/40 to-transparent" />
            自定义行动
          </p>
          <button
            type="button"
            className="rounded-lg p-1.5 text-sherlock-text-muted transition-colors hover:bg-white/10 hover:text-sherlock-gold"
            aria-label="关闭递状"
            onClick={() => onCloseFloat?.()}
          >
            <X className="h-4 w-4 shrink-0" />
          </button>
        </div>
        <div className="glass-panel flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden rounded-lg border border-white/10 p-1.5 focus-within:border-sherlock-gold/50">
          {toolbar}
          {inputRow}
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="mb-2 shrink-0 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-sherlock-text-muted">
        <span className="h-px w-6 bg-linear-to-r from-sherlock-gold/40 to-transparent" />
        自定义行动
      </p>
      <div className="glass-panel flex min-w-0 flex-col gap-2 overflow-visible rounded-xl border border-white/10 p-2 transition-colors focus-within:border-sherlock-gold/50">
        {toolbar}
        {inputRow}
      </div>
    </>
  );
}

export function ChatArea({
  isFullscreen,
  onToggleFullscreen,
  /** 每次载入案卷主界面须先「入局」：用户手势内全屏；未传入则不做门闸（兼容旧用法） */
  onPlaySessionAuthorize,
}: {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onPlaySessionAuthorize?: () => Promise<void>;
}) {
  const [offlineDemo, setOfflineDemo] = useState(true);
  const [liveLines, setLiveLines] = useState<LiveLine[]>([]);
  const [liveOptionItems, setLiveOptionItems] = useState<OptionItem[]>([]);
  const [demoMessages] = useState(DEMO_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  /** 最新 assistant 楼层信息（message_id 可能为 0，禁止仅用 truthy 判断） */
  const [currentMessageInfo, setCurrentMessageInfo] = useState<{
    messageId?: number;
    userMessageId?: number;
    fullMessage?: string;
  }>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{
    messageId: number;
    currentText: string;
    fullMessage: string;
  } | null>(null);
  const narrativeScrollRef = useRef<HTMLDivElement>(null);
  const refreshDebounceRef = useRef<number | null>(null);
  const isRefreshingRef = useRef(false);
  const emptyWelcomeGrainId = useId().replace(/:/g, '');
  /** 真实环境下每次 iframe 载入须点击「入局」后方可使用行动栏（含粘贴） */
  const [playSessionAuthorized, setPlaySessionAuthorized] = useState(false);
  const [playGateBusy, setPlayGateBusy] = useState(false);
  /** 左下「对话」递状浮窗；右下「选项」浮窗 */
  const [dialoguePanelOpen, setDialoguePanelOpen] = useState(false);
  const [optionsPanelOpen, setOptionsPanelOpen] = useState(false);

  const refreshFromChat = useCallback(() => {
    if (!canUseTavernChat()) return;
    try {
      const { lines } = loadLinesFromChat();
      setLiveLines(lines);
      const latest = loadFromLatestMessage();
      const items =
        latest.options.length > 0
          ? latest.options
          : latest.fullMessage
            ? parseOptionsDetailed(latest.fullMessage)
            : [];
      setLiveOptionItems(items.slice(0, SHERLOCK_OPTION_MAX));
      setCurrentMessageInfo({
        messageId: latest.messageId,
        userMessageId: latest.userMessageId,
        fullMessage: latest.fullMessage,
      });
    } catch (e) {
      console.warn('[Sherlock] refreshFromChat', e);
    }
  }, []);

  const { refresh: refreshSherlockStats } = useSherlockStats();
  const { refresh: refreshBattleProtocol, assistantRaw } = useBattleProtocol();
  const apBurnPreviewPercent = useMemo(() => {
    if (!shouldBurnApFromAssistantMessage(assistantRaw)) return undefined;
    const r = computeApBurnRatioOfApMax(computeBattleGaugeIntensity(assistantRaw));
    return Math.round(r * 100);
  }, [assistantRaw]);

  /** 管线内也会在静默 user 层写入后主动调用；此处仍供生成结束等时机统一拉取 MVU / 博弈协议 / 叙事 */
  const refreshAfterPipeline = useCallback(() => {
    void refreshSherlockStats();
    refreshBattleProtocol();
    refreshFromChat();
  }, [refreshSherlockStats, refreshBattleProtocol, refreshFromChat]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!canUseTavernChat()) {
        setOfflineDemo(true);
        return;
      }
      try {
        await waitGlobalInitialized('Mvu');
        if (cancelled) return;
        setOfflineDemo(false);
        refreshFromChat();
      } catch {
        if (!cancelled) setOfflineDemo(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshFromChat]);

  const scheduleRefreshFromChat = useCallback(
    (delayMs: number) => {
      if (refreshDebounceRef.current !== null) {
        window.clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = null;
      }
      refreshDebounceRef.current = window.setTimeout(() => {
        refreshDebounceRef.current = null;
        if (isRefreshingRef.current) {
          return;
        }
        isRefreshingRef.current = true;
        try {
          refreshFromChat();
        } finally {
          isRefreshingRef.current = false;
        }
      }, delayMs);
    },
    [refreshFromChat],
  );

  useEffect(() => {
    if (offlineDemo || typeof eventOn === 'undefined' || typeof tavern_events === 'undefined') {
      return;
    }
    const subUpdated = eventOn(tavern_events.MESSAGE_UPDATED, () => {
      scheduleRefreshFromChat(300);
    });
    const subReceived = eventOn(tavern_events.MESSAGE_RECEIVED, () => {
      scheduleRefreshFromChat(500);
    });
    return () => {
      subUpdated.stop();
      subReceived.stop();
      if (refreshDebounceRef.current !== null) {
        window.clearTimeout(refreshDebounceRef.current);
      }
    };
  }, [offlineDemo, scheduleRefreshFromChat]);

  const scrollNarrativeToBottom = () => {
    const el = narrativeScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
  };

  useEffect(() => {
    scrollNarrativeToBottom();
  }, [liveLines, demoMessages, streamingText, offlineDemo, liveOptionItems]);

  const runRequest = async (text: string, type: 'option' | 'custom') => {
    if (!text.trim() || isLoading) return;
    setIsLoading(true);
    setStreamingText('');
    const ok = await handleSherlockRequest(
      { type, content: text.trim() },
      {
        onDisableOptions: () => setIsLoading(true),
        onShowGenerating: () => setIsLoading(true),
        onHideGenerating: () => {
          setIsLoading(false);
          setStreamingText('');
        },
        onEnableOptions: () => setIsLoading(false),
        onError: msg => {
          toastr.error(msg, '伦敦博弈场');
          setIsLoading(false);
          setStreamingText('');
        },
        onRefreshStory: refreshAfterPipeline,
        onStreamingUpdate: t => setStreamingText(t || ''),
      },
    );
    if (ok) {
      setStreamingText('');
    }
  };

  const canReroll = useMemo(() => {
    if (offlineDemo || isLoading || !hasMessageMutationApis()) return false;
    const { messageId, userMessageId } = currentMessageInfo;
    return (
      messageId !== undefined &&
      messageId !== null &&
      userMessageId !== undefined &&
      userMessageId !== null
    );
  }, [offlineDemo, isLoading, currentMessageInfo]);

  const canEditBody = useMemo(() => {
    if (offlineDemo || isLoading || !hasMessageMutationApis()) return false;
    const { messageId, fullMessage } = currentMessageInfo;
    return (
      messageId !== undefined &&
      messageId !== null &&
      Boolean(fullMessage?.trim()) &&
      /<maintext>[\s\S]*?<\/maintext>/i.test(fullMessage || '')
    );
  }, [offlineDemo, isLoading, currentMessageInfo]);

  const runReroll = useCallback(async () => {
    if (!hasMessageMutationApis()) {
      toastr.error('当前环境不支持重掷，请使用完整案卷界面。', '伦敦博弈场');
      setContextMenu(null);
      return;
    }
    const { messageId, userMessageId } = currentMessageInfo;
    if (
      messageId === undefined ||
      messageId === null ||
      userMessageId === undefined ||
      userMessageId === null
    ) {
      toastr.error('无法重掷：找不到对应的叙事楼层。', '伦敦博弈场');
      setContextMenu(null);
      return;
    }
    setContextMenu(null);
    setIsLoading(true);
    setStreamingText('');
    const ok = await handleSherlockReroll(
      { assistantMessageId: messageId, userMessageId },
      {
        onDisableOptions: () => setIsLoading(true),
        onShowGenerating: () => setIsLoading(true),
        onHideGenerating: () => {
          setIsLoading(false);
          setStreamingText('');
        },
        onEnableOptions: () => setIsLoading(false),
        onError: msg => {
          toastr.error(msg, '伦敦博弈场');
          setIsLoading(false);
          setStreamingText('');
        },
        onRefreshStory: refreshAfterPipeline,
        onStreamingUpdate: t => setStreamingText(t || ''),
      },
    );
    if (ok) {
      setStreamingText('');
    }
  }, [currentMessageInfo, refreshAfterPipeline]);

  const openEditModal = useCallback(() => {
    if (!hasMessageMutationApis()) {
      toastr.error('当前环境无法修改正文。', '伦敦博弈场');
      setContextMenu(null);
      return;
    }
    const { messageId, fullMessage } = currentMessageInfo;
    if (messageId === undefined || messageId === null || !fullMessage?.trim()) {
      toastr.error('没有可编辑的正文。', '伦敦博弈场');
      setContextMenu(null);
      return;
    }
    const maintextMatch = fullMessage.match(/<maintext>([\s\S]*?)<\/maintext>/i);
    if (!maintextMatch) {
      toastr.error('本段没有可单独修改的正文块。', '伦敦博弈场');
      setContextMenu(null);
      return;
    }
    setEditingMessage({
      messageId,
      currentText: maintextMatch[1].trim(),
      fullMessage,
    });
    setContextMenu(null);
  }, [currentMessageInfo]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessage) return;
    if (!hasMessageMutationApis()) {
      toastr.error('当前环境无法保存修改。', '伦敦博弈场');
      return;
    }
    try {
      const { messageId, currentText, fullMessage } = editingMessage;
      const updatedMessage = fullMessage.replace(
        /<maintext>[\s\S]*?<\/maintext>/i,
        `<maintext>${currentText}</maintext>`,
      );
      await setChatMessages([{ message_id: messageId, message: updatedMessage }], { refresh: 'affected' });
      setEditingMessage(null);
      window.setTimeout(() => refreshFromChat(), 100);
    } catch (e) {
      toastr.error(e instanceof Error ? e.message : String(e), '伦敦博弈场');
    }
  }, [editingMessage, refreshFromChat]);

  const onCopySanitizePlaceholders = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
    const sel = window.getSelection()?.toString() ?? '';
    if (!sel || !/<StatusPlaceHolderImpl/i.test(sel)) return;
    e.preventDefault();
    const cleaned = sel.replace(/<StatusPlaceHolderImpl\s*\/?>/gi, '');
    e.clipboardData.setData('text/plain', cleaned);
  }, []);

  useEffect(() => {
    setDialoguePanelOpen(false);
    setOptionsPanelOpen(false);
  }, [isFullscreen]);

  useEffect(() => {
    if (!dialoguePanelOpen && !optionsPanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDialoguePanelOpen(false);
        setOptionsPanelOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialoguePanelOpen, optionsPanelOpen]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement;
      if (!target.closest('.sherlock-context-menu') && !target.closest('.maintext-container')) {
        setContextMenu(null);
      }
    };
    const timer = window.setTimeout(() => {
      document.addEventListener('click', close, true);
    }, 300);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('click', close, true);
    };
  }, [contextMenu]);

  const showPlayGate = Boolean(onPlaySessionAuthorize) && !offlineDemo && !playSessionAuthorized;
  const inputUnlocked = offlineDemo || !onPlaySessionAuthorize || playSessionAuthorized;

  const showLiveEmpty = !offlineDemo && liveLines.length === 0 && !streamingText && !isLoading;

  const handlePlaySessionStart = async () => {
    if (playGateBusy) return;
    setPlayGateBusy(true);
    try {
      await onPlaySessionAuthorize?.();
    } catch {
      /* 全屏失败仍允许入局；toast 由 App 侧处理 */
    } finally {
      setPlaySessionAuthorized(true);
      setPlayGateBusy(false);
      refreshFromChat();
      window.requestAnimationFrame(() => {
        scrollNarrativeToBottom();
        window.setTimeout(() => scrollNarrativeToBottom(), 350);
      });
    }
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    if (offlineDemo) {
      toastr.info('请在本界面载入案卷后再试。', '伦敦博弈场');
      return;
    }
    if (!inputUnlocked) {
      toastr.info('请先点「开始游戏」掀开雾幕，再递状。', '伦敦博弈场');
      return;
    }
    void runRequest(inputValue, 'custom');
    setInputValue('');
  };

  const lastAssistantIndex = useMemo(
    () => liveLines.reduce((last, line, i) => (line.role === 'assistant' ? i : last), -1),
    [liveLines],
  );

  const lastDemoLlmIndex = useMemo(() => {
    for (let i = demoMessages.length - 1; i >= 0; i--) {
      if (demoMessages[i].role === 'llm') return i;
    }
    return -1;
  }, [demoMessages]);

  return (
    <main className="sherlock-chat-root relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-basis-0 flex-col overflow-hidden">
      {contextMenu && (
        <div
          className="sherlock-context-menu fixed z-1000 min-w-[200px] rounded-lg border border-sherlock-gold/30 bg-black/95 shadow-lg shadow-black/80"
          style={{
            left: `${Math.min(contextMenu.x, window.innerWidth - 220)}px`,
            top: `${Math.min(contextMenu.y, window.innerHeight - 120)}px`,
          }}
          role="menu"
          onClick={e => {
            e.stopPropagation();
          }}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-sherlock-text-muted">
            <span>卷面</span>
            <button
              type="button"
              className="rounded px-2 py-0.5 hover:bg-white/10"
              onClick={() => setContextMenu(null)}
              aria-label="关闭"
            >
              关
            </button>
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-sherlock-text-primary hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isLoading || !canReroll}
            onClick={() => void runReroll()}
          >
            {isLoading ? '处理中…' : '重掷本回合'}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 border-t border-white/5 px-3 py-2.5 text-left text-sm text-sherlock-text-primary hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isLoading || !canEditBody}
            onClick={() => openEditModal()}
          >
            修改正文
          </button>
        </div>
      )}

      {editingMessage && (
        <div
          className="fixed inset-0 z-2000 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={e => {
            if (e.target === e.currentTarget) setEditingMessage(null);
          }}
        >
          <div
            className="glass-panel max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-sherlock-gold/25"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
              <h2 className="text-base font-medium text-sherlock-text-primary">编辑正文</h2>
              <button
                type="button"
                className="rounded p-1 text-sherlock-text-muted hover:bg-white/10 hover:text-sherlock-gold"
                onClick={() => setEditingMessage(null)}
                aria-label="关闭"
              >
                关
              </button>
            </div>
            <div className="p-4 sm:p-5">
              <textarea
                value={editingMessage.currentText}
                onChange={e => setEditingMessage({ ...editingMessage, currentText: e.target.value })}
                className="sherlock-scroll-y-invisible h-[min(400px,50vh)] w-full resize-none rounded-lg border border-white/10 bg-black/50 p-3 text-sm leading-relaxed text-sherlock-text-primary outline-none focus:border-sherlock-gold/40"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-sherlock-gold/40 bg-sherlock-gold/20 px-4 py-2 text-sm text-sherlock-gold hover:bg-sherlock-gold/30"
                  onClick={() => void handleSaveEdit()}
                >
                  保存
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm text-sherlock-text-secondary hover:bg-white/5"
                  onClick={() => setEditingMessage(null)}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center bg-black/25 pt-16 backdrop-blur-[2px]">
          <div className="glass-panel rounded-lg border border-sherlock-gold/30 px-4 py-2 text-sm text-sherlock-gold">
            雾都墨迹未干，叙事正在落笔……
          </div>
        </div>
      )}

      <div
        className={cn(
          'sherlock-chat-main-stage sherlock-chat-stage flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden px-3 py-3 sm:gap-4 sm:px-4 sm:py-4 lg:px-6 lg:py-5',
          /* 全屏：叙事区 flex-1 占满剩余高度；底栏仅内容高度 + max-h，避免抢正文空间 */
          isFullscreen ? 'sherlock-chat-main-stage--fs min-h-0 flex-1 flex-basis-0' : 'flex-1 flex-basis-0',
        )}
      >
        <div
          className={cn(
            'sherlock-narrative-card sherlock-narrative-frame flex min-h-0 min-w-0 flex-1 flex-basis-0 flex-col overflow-hidden rounded-xl',
          )}
        >
          <div className="sherlock-narrative-frame-head" role="presentation">
            <span className="font-serif text-[9px] tracking-[0.42em] text-sherlock-gold/85 sm:text-[10px]">
              CASE FILE
            </span>
            <span className="text-[9px] text-sherlock-text-muted sm:text-[10px]">案卷 · 正文</span>
          </div>
          <div
            ref={narrativeScrollRef}
            className="sherlock-narrative-scroll sherlock-scroll-y-invisible relative z-1 min-h-0 flex-1 px-3 py-2 pb-24 sm:px-5 sm:py-3 sm:pb-28"
            onCopyCapture={onCopySanitizePlaceholders}
          >
            <div className="space-y-3 sm:space-y-4">
              {offlineDemo ? (
                <>
                  {demoMessages.map((msg, idx) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      useMaintextFrame={msg.role === 'llm' && idx === lastDemoLlmIndex}
                      maintextEmbedded
                    />
                  ))}
                </>
              ) : (
                <>
                  {showPlayGate && showLiveEmpty && (
                    <div className="flex min-h-(--sherlock-maintext-min-height) flex-col items-center justify-center rounded-2xl border border-sherlock-gold/20 bg-black/30 px-4 py-10 text-center">
                      <p className="max-w-sm text-[11px] leading-relaxed text-sherlock-text-muted">
                        雾幕仍垂，案卷未启。请先在前页钤印「开始游戏」，掀开雾幕后墨迹方会在此汇聚。
                      </p>
                    </div>
                  )}
                  {showLiveEmpty && !showPlayGate && (
                    <div className="relative flex min-h-(--sherlock-maintext-min-height) flex-col justify-center overflow-hidden rounded-2xl border border-sherlock-gold/35 bg-black/55 px-4 py-8 text-center shadow-[inset_0_0_60px_rgba(184,134,11,0.06),0_0_40px_rgba(30,92,140,0.12)] sm:px-8 sm:py-10">
                      <div
                        className="pointer-events-none absolute inset-0 rounded-2xl opacity-90"
                        style={{
                          background:
                            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(184, 134, 11, 0.18) 0%, transparent 55%), radial-gradient(ellipse 70% 45% at 100% 100%, rgba(30, 92, 140, 0.2) 0%, transparent 50%)',
                        }}
                      />
                      <div className="pointer-events-none absolute -left-[20%] top-1/2 h-[140%] w-[70%] -translate-y-1/2 rounded-full bg-linear-to-br from-cyan-400/25 via-transparent to-transparent blur-3xl sherlock-empty-welcome-blob-a" />
                      <div className="pointer-events-none absolute -right-[25%] -bottom-[30%] h-[120%] w-[65%] rounded-full bg-linear-to-tl from-amber-400/20 via-fuchsia-500/10 to-transparent blur-3xl sherlock-empty-welcome-blob-b" />

                      <div
                        className="pointer-events-none absolute -inset-[22%] z-1 overflow-hidden rounded-3xl sherlock-empty-welcome-gold-sweep"
                        aria-hidden
                      />
                      <div
                        className="pointer-events-none absolute inset-0 z-2 overflow-hidden rounded-2xl sherlock-empty-welcome-mist-css"
                        aria-hidden
                      />
                      <svg
                        className="pointer-events-none absolute inset-0 z-3 h-full w-full mix-blend-soft-light sherlock-empty-welcome-grain-svg"
                        aria-hidden
                      >
                        <defs>
                          <filter
                            id={`${emptyWelcomeGrainId}-fog`}
                            x="-25%"
                            y="-25%"
                            width="150%"
                            height="150%"
                          >
                            <feTurbulence
                              type="fractalNoise"
                              baseFrequency="0.88"
                              numOctaves="4"
                              stitchTiles="stitch"
                            />
                          </filter>
                        </defs>
                        <rect
                          width="100%"
                          height="100%"
                          fill="#cbd5e1"
                          filter={`url(#${emptyWelcomeGrainId}-fog)`}
                          opacity={0.11}
                        />
                      </svg>

                      <div className="relative z-10 flex flex-col items-center">
                        <p className="font-serif text-[10px] tracking-[0.42em] text-sherlock-gold/80 sm:text-[11px]">
                          LONDON · 雾都已入梦
                        </p>
                        <h3 className="sherlock-empty-welcome-title mt-3 max-w-md font-serif text-xl font-semibold leading-snug sm:text-2xl">
                          雾都案卷，恭候执笔
                        </h3>
                        <p className="sherlock-epigraph mt-3 max-w-md text-sm leading-relaxed text-sherlock-text-secondary sm:text-[15px]">
                          煤气灯在泰晤士的雾霭里轻颤，空白卷页已就。待下一阵脚步与证词落定，墨迹自会在此晕开。
                        </p>
                        <p className="mt-4 max-w-md text-xs leading-relaxed text-sherlock-text-muted">
                          若你刚于《探案手记》钤印开卷，请点左下「对话」展开递状栏，誊入全文并遣送；分岔路线在右下「选项」。尚无新函时，亦可静候下一纸雾都回音。
                        </p>
                        <p className="mt-3 max-w-md text-[11px] leading-relaxed text-sherlock-text-muted/90">
                          案卷与信使之间偶有一息时差；若已递状而此页仍空，少待片刻，墨迹便会追上你的步履。
                        </p>
                      </div>
                    </div>
                  )}
                  {liveLines.map((line, idx) => {
                    const prev = idx > 0 ? liveLines[idx - 1] : null;
                    const bridgeMist = line.role === 'assistant' && prev?.role === 'user';
                    /** 助手正文与下一条递状之间多留一行高，避免楼层与玩家气泡贴得过紧 */
                    const gapBeforeUserAfterAssistant = line.role === 'user' && prev?.role === 'assistant';
                    const useNeonBubble = !offlineDemo;
                    const neon = floorNeonVariant(line.messageId, line.role);
                    const pad =
                      line.role === 'assistant' && idx === lastAssistantIndex ? 'p-2 sm:p-3' : 'p-3 sm:p-4';
                    const neonShell = useNeonBubble
                      ? cn(
                          `sherlock-floor-bubble sherlock-floor-bubble--${neon} relative w-full max-w-[min(100%,896px)] overflow-hidden border`,
                          line.role === 'user' ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm',
                          pad,
                        )
                      : cn(
                          'glass-panel relative w-full max-w-[min(100%,896px)] overflow-hidden',
                          line.role === 'user'
                            ? 'rounded-2xl rounded-tr-sm border-sherlock-gold/20 bg-sherlock-gold/10'
                            : 'rounded-2xl rounded-tl-sm border-white/10 bg-black/40',
                          pad,
                        );
                    const body = (
                      <>
                        {line.role === 'assistant' && idx === lastAssistantIndex ? (
                          <LongPressMaintext
                            disabled={
                              offlineDemo ||
                              isLoading ||
                              !hasMessageMutationApis() ||
                              currentMessageInfo.messageId === undefined ||
                              currentMessageInfo.messageId === null
                            }
                            blockStart={Boolean(contextMenu)}
                            onLongPress={(x, y) => setContextMenu({ x, y })}
                          >
                            <MaintextFrame embedded>
                              <p className="wrap-break-word pt-11 text-sm leading-relaxed whitespace-pre-wrap text-sherlock-text-primary sm:pt-13">
                                {line.text}
                              </p>
                            </MaintextFrame>
                          </LongPressMaintext>
                        ) : (
                          <p className="wrap-break-word text-sm leading-relaxed whitespace-pre-wrap text-sherlock-text-primary">
                            {line.text}
                          </p>
                        )}
                      </>
                    );
                    const bubbleRow =
                      line.role === 'user' ? (
                        <div className="flex w-full justify-end">
                          <div className={neonShell}>
                            {useNeonBubble ? (
                              <div className="sherlock-floor-bubble__inner">{body}</div>
                            ) : (
                              body
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="w-full">
                          <div className="flex w-full justify-start">
                            <div className={neonShell}>
                              {useNeonBubble ? (
                                <div className="sherlock-floor-bubble__inner">{body}</div>
                              ) : (
                                body
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    return (
                      <Fragment key={line.key}>
                        {bridgeMist ? (
                          <div className="min-h-12 w-full shrink-0 sm:min-h-17" aria-hidden />
                        ) : null}
                        {gapBeforeUserAfterAssistant ? (
                          <div className="h-5 w-full shrink-0 sm:h-6" aria-hidden />
                        ) : null}
                        {bubbleRow}
                      </Fragment>
                    );
                  })}
                  {streamingText ? (
                    <div className="flex w-full justify-start opacity-90">
                      <div
                        className={cn(
                          'w-full max-w-[min(100%,896px)] overflow-hidden rounded-2xl border p-2 text-sm italic text-sherlock-text-secondary sm:p-3',
                          !offlineDemo
                            ? `sherlock-floor-bubble sherlock-floor-bubble--${currentMessageInfo.messageId != null ? floorNeonVariant(currentMessageInfo.messageId, 'assistant') : 1}`
                            : 'glass-panel border-sherlock-gold/20 bg-black/50',
                        )}
                      >
                        {!offlineDemo ? (
                          <div className="sherlock-floor-bubble__inner">
                            <MaintextFrame embedded>
                              <p className="wrap-break-word whitespace-pre-wrap pt-11 sm:pt-13">
                                {streamingText}
                              </p>
                            </MaintextFrame>
                          </div>
                        ) : (
                          <MaintextFrame embedded>
                            <p className="wrap-break-word whitespace-pre-wrap pt-11 sm:pt-13">
                              {streamingText}
                            </p>
                          </MaintextFrame>
                        )}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>

      </div>

      {!showPlayGate ? (
        <>
          <button
            type="button"
            id="sherlock-dialogue-fab"
            className={cn(
              'sherlock-dialogue-fab pointer-events-auto absolute z-48',
              dialoguePanelOpen && 'sherlock-dialogue-fab--open',
            )}
            style={{
              left: 'max(0.75rem, env(safe-area-inset-left))',
              bottom: 'max(0.75rem, env(safe-area-inset-bottom))',
            }}
            aria-expanded={dialoguePanelOpen}
            aria-controls="sherlock-dialogue-panel"
            onClick={() => {
              setDialoguePanelOpen(o => !o);
              setOptionsPanelOpen(false);
            }}
          >
            <span className="sherlock-dialogue-fab__dot" aria-hidden />
            <span className="leading-none">对话</span>
          </button>

          {offlineDemo || (lastAssistantIndex >= 0 && !streamingText && liveOptionItems.length > 0) ? (
            <button
              type="button"
              id="sherlock-options-fab"
              className={cn(
                'sherlock-options-fab pointer-events-auto absolute z-48',
                optionsPanelOpen && 'sherlock-options-fab--open',
              )}
              style={{
                right: 'max(0.75rem, env(safe-area-inset-right))',
                bottom: 'max(0.75rem, env(safe-area-inset-bottom))',
              }}
              aria-expanded={optionsPanelOpen}
              aria-controls="sherlock-options-panel"
              onClick={() => {
                setOptionsPanelOpen(o => !o);
                setDialoguePanelOpen(false);
              }}
            >
              <span className="sherlock-options-fab__dot" aria-hidden />
              <span className="leading-none">选项</span>
            </button>
          ) : null}

          {dialoguePanelOpen || optionsPanelOpen ? (
            <div
              role="presentation"
              className="pointer-events-auto absolute inset-0 z-52 bg-black/45 backdrop-blur-[2px]"
              aria-hidden
              onClick={() => {
                setDialoguePanelOpen(false);
                setOptionsPanelOpen(false);
              }}
            />
          ) : null}

          {dialoguePanelOpen ? (
            <div
              id="sherlock-dialogue-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sherlock-dialogue-fab"
              className="pointer-events-auto absolute z-53 w-[min(calc(100vw-1.25rem),28rem)] max-w-[calc(100vw-1.25rem)]"
              style={{
                left: 'max(0.625rem, env(safe-area-inset-left))',
                bottom: 'max(calc(3.5rem + 0.5rem), calc(env(safe-area-inset-bottom) + 3.5rem + 0.25rem))',
              }}
              onClick={e => e.stopPropagation()}
            >
              <ChatActionInputChrome
                layout="float"
                onCloseFloat={() => setDialoguePanelOpen(false)}
                inputValue={inputValue}
                setInputValue={setInputValue}
                onSend={handleSend}
                offlineDemo={offlineDemo}
                isLoading={isLoading}
                inputUnlocked={inputUnlocked}
                onToggleFullscreen={onToggleFullscreen}
                isFullscreen={isFullscreen}
                canReroll={canReroll}
                canEditBody={canEditBody}
                onReroll={() => void runReroll()}
                onEditBody={() => openEditModal()}
              />
            </div>
          ) : null}

          {optionsPanelOpen &&
          (offlineDemo || (lastAssistantIndex >= 0 && !streamingText && liveOptionItems.length > 0)) ? (
            <div
              id="sherlock-options-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sherlock-options-fab"
              className="pointer-events-auto absolute z-53 w-[min(calc(100vw-1.25rem),28rem)] max-w-[calc(100vw-1.25rem)]"
              style={{
                right: 'max(0.625rem, env(safe-area-inset-right))',
                bottom: 'max(calc(3.5rem + 0.5rem), calc(env(safe-area-inset-bottom) + 3.5rem + 0.25rem))',
                left: 'auto',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="sherlock-dialogue-float flex max-h-[min(70dvh,600px)] min-h-0 w-full flex-col overflow-hidden p-2 sm:p-2.5">
                <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2 border-b border-white/10 pb-1.5">
                  <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-sherlock-text-muted">
                    <span className="h-px w-6 bg-linear-to-r from-sherlock-gold/40 to-transparent" />
                    {offlineDemo ? '示例选项（预览）' : '可选行动'}
                    <span className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 tabular-nums text-[10px] text-sherlock-text-secondary">
                      {(offlineDemo ? DEMO_OPTION_ITEMS.length : liveOptionItems.length).toString()}
                    </span>
                  </p>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-sherlock-text-muted transition-colors hover:bg-white/10 hover:text-sherlock-gold"
                    aria-label="关闭选项"
                    onClick={() => setOptionsPanelOpen(false)}
                  >
                    <X className="h-4 w-4 shrink-0" />
                  </button>
                </div>
                <SherlockOptionList
                  optionItems={offlineDemo ? DEMO_OPTION_ITEMS : liveOptionItems}
                  apBurnPreviewPercent={apBurnPreviewPercent}
                  disabled={offlineDemo || isLoading || !inputUnlocked}
                  onPick={text => {
                    setOptionsPanelOpen(false);
                    void runRequest(text, 'option');
                  }}
                  scrollClassName="max-h-[min(58dvh,520px)]"
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {showPlayGate ? (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sherlock-play-gate-title"
        >
          <div className="relative max-h-[min(88vh,620px)] w-full max-w-lg sherlock-scroll-y-invisible rounded-2xl border border-sherlock-gold/45 bg-linear-to-b from-[#0c1018]/98 via-[#070a10]/98 to-[#05070c]/98 px-5 py-7 text-center shadow-[0_0_60px_rgba(184,134,11,0.22),0_24px_48px_rgba(0,0,0,0.65)] sm:px-8 sm:py-9">
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-90"
              style={{
                background:
                  'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(184, 134, 11, 0.16) 0%, transparent 55%), radial-gradient(ellipse 70% 45% at 100% 100%, rgba(30, 92, 140, 0.18) 0%, transparent 50%)',
              }}
            />
            <div className="relative z-1">
              {showLiveEmpty ? (
                <>
                  <p className="font-serif text-[10px] tracking-[0.42em] text-sherlock-gold/80 sm:text-[11px]">
                    LONDON · 雾都已入梦
                  </p>
                  <h2
                    id="sherlock-play-gate-title"
                    className="mt-3 font-serif text-xl font-semibold leading-snug text-sherlock-text-primary sm:text-2xl"
                  >
                    雾都案卷，恭候执笔
                  </h2>
                  <p className="sherlock-epigraph mt-3 text-sm leading-relaxed text-sherlock-text-secondary sm:text-[15px]">
                    煤气灯在泰晤士的雾霭里轻颤，空白卷页已就。待下一阵脚步与证词落定，墨迹自会在此晕开。
                  </p>
                  <p className="mt-4 text-xs leading-relaxed text-amber-100/85 sm:text-[13px]">
                    若刚在手记里钤印开卷，请把卷面全文粘贴到左下「对话」浮窗并发送；分岔时点右下「选项」。墨迹方能与案卷相连。
                  </p>
                </>
              ) : (
                <>
                  <p
                    id="sherlock-play-gate-title"
                    className="font-serif text-lg font-semibold tracking-wide text-sherlock-gold sm:text-xl"
                  >
                    案卷未掩
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-sherlock-text-secondary">
                    点此掀开雾幕并铺满视野，卷轴会停在最新一行。之后可在左下「对话」递状，右下「选项」择路。
                  </p>
                </>
              )}
              <button
                type="button"
                disabled={playGateBusy}
                onClick={() => void handlePlaySessionStart()}
                className="mt-7 inline-flex w-full max-w-xs items-center justify-center rounded-xl border border-sherlock-gold/55 bg-sherlock-gold/18 px-6 py-3.5 text-sm font-semibold tracking-wide text-sherlock-gold shadow-[0_0_28px_rgba(184,134,11,0.28)] transition hover:border-sherlock-gold/75 hover:bg-sherlock-gold/26 disabled:cursor-wait disabled:opacity-70"
              >
                {playGateBusy ? '正在掀开雾幕…' : '掀开雾幕，开始游戏'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

interface DemoMessage {
  id: string;
  role: 'system' | 'user' | 'llm';
  content: string;
  type?: 'narrative' | 'clue' | 'check' | 'choice';
}

/** 剧情正文内层：embedded 时由外层叙事面板承担边框与滚动，避免重复描边。 */
function MaintextFrame({ children, embedded }: { children: ReactNode; embedded?: boolean }) {
  return (
    <div
      className={cn(
        'box-border w-full rounded-lg px-3 py-2 sm:px-4 sm:py-3',
        embedded
          ? 'min-h-0 border-0 bg-transparent'
          : 'min-h-(--sherlock-maintext-min-height) border border-white/5 bg-black/30',
      )}
    >
      {children}
    </div>
  );
}

function MessageBubble({
  message,
  useMaintextFrame,
  maintextEmbedded,
}: {
  message: DemoMessage;
  useMaintextFrame?: boolean;
  maintextEmbedded?: boolean;
}) {
  if (message.role === 'system') {
    return (
      <div className="my-4 flex justify-center">
        <div
          className={cn(
            'rounded-full border px-4 py-2 text-xs font-medium backdrop-blur-sm',
            message.type === 'clue'
              ? 'border-sherlock-blue/30 bg-sherlock-blue/10 text-sherlock-blue'
              : message.type === 'check'
                ? 'border-sherlock-green/30 bg-sherlock-green/10 text-sherlock-green'
                : 'border-white/10 bg-white/5 text-sherlock-text-secondary',
          )}
        >
          {message.content}
        </div>
      </div>
    );
  }

  const isUser = message.role === 'user';

  if (!isUser && message.role === 'llm' && useMaintextFrame) {
    return (
      <div className="flex w-full justify-start">
        <div className="glass-panel relative w-full max-w-[min(100%,896px)] rounded-2xl rounded-tl-sm border border-white/10 bg-black/40 p-2 sm:p-3">
          <MaintextFrame embedded={maintextEmbedded}>
            <p className="wrap-break-word text-sm leading-relaxed whitespace-pre-wrap text-sherlock-text-primary">
              {message.content}
            </p>
          </MaintextFrame>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'glass-panel relative rounded-2xl p-3 sm:p-4',
          isUser
            ? 'w-full max-w-[min(100%,896px)] rounded-tr-sm border border-sherlock-gold/20 bg-sherlock-gold/10'
            : 'w-full rounded-tl-sm border border-white/10 bg-black/40',
        )}
      >
        <p className="wrap-break-word text-sm leading-relaxed whitespace-pre-wrap text-sherlock-text-primary">
          {message.content}
        </p>
      </div>
    </div>
  );
}

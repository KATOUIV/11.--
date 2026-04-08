import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { inferBattleSignal, parseBattleProtocols, type ParsedBattleProtocols } from '../lib/battleProtocolParser';

type BattleProtocolContextValue = {
  parsed: ParsedBattleProtocols;
  /** 最新 assistant 楼层全文（与解析源一致，供余地扣减预览等） */
  assistantRaw: string;
  /** 有协议行，或启发式判定为对抗（用于侧栏闪动） */
  showBattleNav: boolean;
  /** 有对抗信号但没有任何 [TAG] 协议行（模型未补行） */
  heuristicOnly: boolean;
  refreshSeq: number;
  refresh: () => void;
};

const defaultParsed: ParsedBattleProtocols = {
  lines: [],
  hasBattleContent: false,
  roundHint: null,
};

const BattleProtocolContext = createContext<BattleProtocolContextValue>({
  parsed: defaultParsed,
  assistantRaw: '',
  showBattleNav: false,
  heuristicOnly: false,
  refreshSeq: 0,
  refresh: () => {},
});

export function useBattleProtocol(): BattleProtocolContextValue {
  return useContext(BattleProtocolContext);
}

function getLatestAssistantFullText(): string {
  if (typeof getChatMessages !== 'function') return '';
  try {
    const msgs = getChatMessages(-1, { role: 'assistant', hide_state: 'unhidden' });
    if (!msgs?.length) return '';
    return msgs[msgs.length - 1]?.message ?? '';
  } catch {
    return '';
  }
}

export function BattleProtocolProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState('');
  const [refreshSeq, setRefreshSeq] = useState(0);
  const debounceRef = useRef<number | null>(null);

  const refresh = useCallback(() => {
    setRaw(getLatestAssistantFullText());
    setRefreshSeq(s => s + 1);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof eventOn === 'undefined' || typeof tavern_events === 'undefined') {
      return;
    }
    const schedule = () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        refresh();
      }, 280);
    };
    const u = eventOn(tavern_events.MESSAGE_UPDATED, schedule);
    const r = eventOn(tavern_events.MESSAGE_RECEIVED, schedule);
    return () => {
      u.stop();
      r.stop();
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [refresh]);

  const parsed = useMemo(() => parseBattleProtocols(raw), [raw, refreshSeq]);

  const showBattleNav = useMemo(
    () => parsed.hasBattleContent || inferBattleSignal(raw),
    [parsed.hasBattleContent, raw],
  );

  const heuristicOnly = useMemo(
    () => inferBattleSignal(raw) && !parsed.hasBattleContent,
    [parsed.hasBattleContent, raw],
  );

  const value = useMemo(
    () => ({ parsed, assistantRaw: raw, showBattleNav, heuristicOnly, refreshSeq, refresh }),
    [parsed, raw, showBattleNav, heuristicOnly, refreshSeq, refresh],
  );

  return <BattleProtocolContext.Provider value={value}>{children}</BattleProtocolContext.Provider>;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { maybeApplyDailyApRefill } from '../lib/dailyApRefill';
import { extractSherlockStats, type SherlockNormalizedStats } from '../utils/sherlockStatModel';
import { ensureMvuInitialized, getGameMvuData } from '../utils/variableReader';

type SherlockStatContextValue = {
  stats: SherlockNormalizedStats;
  refreshSeq: number;
  refresh: () => Promise<void>;
  /** 是否在酒馆中成功读到过非空 stat_data */
  hasLiveData: boolean;
};

const defaultStats = extractSherlockStats({});

const SherlockStatContext = createContext<SherlockStatContextValue>({
  stats: defaultStats,
  refreshSeq: 0,
  refresh: async () => {},
  hasLiveData: false,
});

export function useSherlockStats(): SherlockStatContextValue {
  return useContext(SherlockStatContext);
}

function statDataNonEmpty(sd: Record<string, unknown> | undefined): boolean {
  return Boolean(sd && typeof sd === 'object' && Object.keys(sd).length > 0);
}

export function SherlockStatProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<SherlockNormalizedStats>(defaultStats);
  const [refreshSeq, setRefreshSeq] = useState(0);
  const [hasLiveData, setHasLiveData] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      await ensureMvuInitialized();
      try {
        await maybeApplyDailyApRefill();
      } catch (e) {
        console.warn('[Sherlock] 日更补 AP', e);
      }
      const mvu = await getGameMvuData();
      const sd = mvu.stat_data as Record<string, unknown> | undefined;
      if (statDataNonEmpty(sd)) {
        setHasLiveData(true);
        setStats(extractSherlockStats(sd));
      } else {
        setStats(extractSherlockStats({}));
      }
      setRefreshSeq(s => s + 1);
    } catch (e) {
      console.warn('[Sherlock] SherlockStatProvider refresh', e);
      setStats(extractSherlockStats({}));
      setRefreshSeq(s => s + 1);
    }
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
        void refresh();
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

  const value = useMemo(() => ({ stats, refreshSeq, refresh, hasLiveData }), [stats, refreshSeq, refresh, hasLiveData]);

  return <SherlockStatContext.Provider value={value}>{children}</SherlockStatContext.Provider>;
}

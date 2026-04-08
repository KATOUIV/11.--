import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { ENTRY_SPLASH_FIRST_MS, ENTRY_SPLASH_RETURN_MS } from './entrySplashConstants';

export type EntrySplashVariant = 'welcome' | 'return';

/** 首次：雾都仪式感 + 轻幽默；避免任何「宿主应用」用语 */
const FLOAT_WELCOME = [
  '雾网渐亮……煤气灯一盏盏醒来',
  '苏格兰场的咖啡渍在卷宗上洇开第一圈',
  '贝克街的门环铜绿，比多数证词更诚实',
  '泰晤士潮声把警笛磨成钝响',
  '莫里亚蒂的棋子在暗处就位——而你才刚翻开手记',
  '雷斯垂德叹气：今天雾厚，适合藏真相',
  '法医室的灯管闪了一下——伦敦总爱在细处开玩笑',
  '棋盘已铺好，雾比你先到一步',
];

/** 再次进入：短句、偏沉浸，无技术梗 */
const FLOAT_RETURN = [
  '卷宗接续……',
  '雾都仍在，故事未收束',
  '上一局的余温尚在纸页间',
  '煤气灯色调如旧',
  '你回来了。',
];

const LINE_ROTATE_MS = 380;

type EntrySplashProps = {
  variant: EntrySplashVariant;
  /** 与 App 中自动进入手记/主界面的超时一致 */
  durationMs: number;
  /** 首次进入：进度完成后显示「开始游戏」，不自动跳转 */
  requireStartButton?: boolean;
  /** 点击「开始游戏」（用于全屏授权 + 分流） */
  onStartGame?: () => void;
};

/**
 * 首屏载入：welcome 与 return 使用不同视觉与文案节奏。
 * 进度条与 `durationMs` 同步。
 */
export function EntrySplash({
  variant,
  durationMs,
  requireStartButton = false,
  onStartGame,
}: EntrySplashProps) {
  const [progress, setProgress] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);
  const lines = variant === 'welcome' ? FLOAT_WELCOME : FLOAT_RETURN;
  const isWelcome = variant === 'welcome';
  const showStartCta = requireStartButton && progress >= 100 && typeof onStartGame === 'function';

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(100, (elapsed / durationMs) * 100);
      setProgress(p);
      setLineIndex(Math.floor(elapsed / LINE_ROTATE_MS) % lines.length);
      if (elapsed < durationMs) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, lines.length]);

  return (
    <div
      className={cn(
        'entry-splash-screen relative z-20 flex h-full min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 py-6 sm:px-5 sm:py-10',
        !isWelcome && 'entry-splash-screen--return',
      )}
    >
      {isWelcome ? (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(165deg, #030508 0%, #0a121c 35%, #06090e 70%, #05070a 100%)',
            }}
          />
          <div
            className="entry-splash-fog-blob pointer-events-none absolute -left-1/4 top-0 h-[70%] w-[90%] rounded-full opacity-40 blur-3xl"
            style={{
              background: 'radial-gradient(ellipse at 30% 20%, rgba(184,134,11,0.22), transparent 62%)',
            }}
          />
          <div
            className="entry-splash-fog-blob entry-splash-fog-blob--delayed pointer-events-none absolute -right-1/4 bottom-0 h-[55%] w-[80%] rounded-full opacity-35 blur-3xl"
            style={{
              background: 'radial-gradient(ellipse at 70% 80%, rgba(30,60,90,0.35), transparent 60%)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.045]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(184,134,11,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(184,134,11,0.2) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              boxShadow: 'inset 0 0 120px 40px rgba(0,0,0,0.75)',
            }}
          />
          <div className="entry-splash-flicker pointer-events-none absolute inset-0 bg-amber-100 mix-blend-overlay" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background:repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.45)_2px,rgba(0,0,0,0.45)_3px)]" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-soft-light"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
            }}
          />
        </>
      ) : (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, #070b10 0%, #0f141c 50%, #080c12 100%)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 opacity-30 blur-3xl"
            style={{
              background: 'radial-gradient(ellipse at 50% 0%, rgba(184,134,11,0.12), transparent 55%)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 100%)',
            }}
          />
        </>
      )}

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center gap-6 sm:gap-8">
        <div className={cn('text-center', isWelcome && 'entry-splash-title-flicker')}>
          <p className="font-serif text-[10px] tracking-[0.42em] text-sherlock-gold/65">雾都案卷</p>
          <h2 className="mt-2 font-serif text-xl font-semibold tracking-[0.18em] text-sherlock-text-primary drop-shadow-[0_0_24px_rgba(184,134,11,0.15)] sm:text-3xl">
            伦敦博弈场
          </h2>
          <p className="mt-3 text-xs tracking-wide text-sherlock-text-muted">
            {isWelcome ? '雾都卷宗载入中' : '正在回到你的案卷'}
          </p>
          {isWelcome ? (
            <p className="entry-splash-guide mt-2 max-w-md px-1 text-[11px] leading-relaxed text-amber-100/55">
              侧栏可看图鉴与雾巷裁定；载入结束后，由此入卷。
            </p>
          ) : null}
        </div>

        <div className="w-full max-w-[min(100%,28rem)] px-1">
          <div className="mb-2 flex items-center justify-between text-[10px] tabular-nums text-sherlock-gold/50">
            <span>{isWelcome ? '案卷载入' : '接续剧情'}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div
            className={cn(
              'relative h-2 w-full overflow-hidden rounded-full',
              'border border-amber-900/40 bg-black/60',
              'shadow-[inset_0_1px_2px_rgba(0,0,0,0.6),0_0_20px_rgba(184,134,11,0.08)]',
              !isWelcome && 'border-amber-800/25',
            )}
          >
            <div
              className={cn(
                'absolute inset-y-0 left-0 rounded-full transition-[width] duration-75',
                isWelcome && 'entry-splash-progress-fill',
              )}
              style={
                isWelcome
                  ? {
                      width: `${progress}%`,
                      background:
                        'linear-gradient(90deg, rgba(80,50,20,0.9) 0%, rgba(184,134,11,0.85) 45%, rgba(220,180,80,0.95) 100%)',
                      boxShadow: '0 0 16px rgba(184,134,11,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
                    }
                  : {
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, rgba(60,45,25,0.95), rgba(184,134,11,0.75))',
                    }
              }
            />
            {isWelcome ? (
              <div className="entry-splash-progress-shimmer pointer-events-none absolute inset-0 opacity-30" />
            ) : null}
          </div>
        </div>

        <div className="min-h-12 w-full px-2 text-center sm:min-h-13">
          <p
            key={`${variant}-${lineIndex}`}
            className="entry-splash-float-line text-[12px] leading-relaxed text-amber-100/75 sm:text-[13px]"
          >
            {lines[lineIndex]}
          </p>
        </div>

        {requireStartButton && isWelcome ? (
          <div className="flex min-h-18 w-full flex-col items-center justify-center gap-3">
            {showStartCta ? (
              <button
                type="button"
                onClick={() => onStartGame?.()}
                className="entry-splash-start-btn font-serif text-sm font-semibold tracking-[0.35em] text-[#0a0c10] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sherlock-gold/60"
              >
                开始游戏
              </button>
            ) : (
              <p className="text-center text-[10px] leading-relaxed text-sherlock-text-muted/85">
                载入完成后将开启入口
              </p>
            )}
          </div>
        ) : (
          <p className="max-w-sm px-2 text-center text-[10px] leading-relaxed text-sherlock-text-muted/85">
            {Math.ceil(durationMs / 1000)} 秒后自动进入
            {isWelcome ? '案卷' : '上一进度'}
          </p>
        )}
      </div>
    </div>
  );
}

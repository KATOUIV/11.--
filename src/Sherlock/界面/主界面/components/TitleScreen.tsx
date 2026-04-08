import { cn } from '../lib/utils';

export function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-10 px-6 py-12">
      <div className="max-w-lg text-center">
        <p className="font-serif text-[10px] tracking-[0.38em] text-sherlock-gold/80">神探手记 · 伦敦博弈场</p>
        <h1 className="mt-4 font-serif text-2xl font-semibold tracking-wide text-sherlock-text-primary sm:text-3xl">
          雾都迷案
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-sherlock-text-secondary">
          煤气灯、卷宗与半枚棋子。先启封你的探案手记，再踏入贝克街的阴影。
        </p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className={cn(
          'group relative overflow-hidden rounded-xl border-2 border-sherlock-gold/50 bg-sherlock-gold/10 px-12 py-4',
          'font-serif text-sm font-medium tracking-[0.2em] text-sherlock-gold shadow-[0_0_24px_rgba(184,134,11,0.15)]',
          'transition hover:border-sherlock-gold hover:bg-sherlock-gold/20',
        )}
      >
        <span className="relative z-10">开始游戏</span>
      </button>
    </div>
  );
}

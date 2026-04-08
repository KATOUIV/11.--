import { useCallback, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';

const CLICK_CHAIN_MS = 750;
const FIREWORK_MS = 3000;

type BurstVariant = 'radial' | 'ring' | 'fountain' | 'spiral';

type Particle = {
  id: string;
  tx: number;
  ty: number;
  hue: number;
  delay: number;
  size: number;
  duration: number;
  /** 0–1，控制轨迹曲线感 */
  arc: number;
};

function randomVariant(): BurstVariant {
  const list: BurstVariant[] = ['radial', 'ring', 'fountain', 'spiral'];
  return list[Math.floor(Math.random() * list.length)]!;
}

function buildParticles(variant: BurstVariant, seed: number): Particle[] {
  const rnd = (() => {
    let s = seed % 100000;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  })();

  const n =
    variant === 'fountain'
      ? 55 + Math.floor(rnd() * 35)
      : variant === 'ring'
        ? 70 + Math.floor(rnd() * 40)
        : 48 + Math.floor(rnd() * 45);

  const particles: Particle[] = [];

  for (let i = 0; i < n; i++) {
    const t = rnd() * Math.PI * 2;
    let tx: number;
    let ty: number;
    let arc = rnd() * 0.4;

    switch (variant) {
      case 'radial': {
        const d = 100 + rnd() * 220;
        tx = Math.cos(t) * d;
        ty = Math.sin(t) * d;
        break;
      }
      case 'ring': {
        const ring = 1 + Math.floor(rnd() * 2);
        const d = ring * (90 + rnd() * 100);
        const a = (i / n) * Math.PI * 2 + rnd() * 0.3;
        tx = Math.cos(a) * d;
        ty = Math.sin(a) * d;
        arc = rnd() * 0.2;
        break;
      }
      case 'fountain': {
        const spread = (rnd() - 0.5) * 160;
        tx = spread + (rnd() - 0.5) * 40;
        ty = -(140 + rnd() * 180) + Math.abs(spread) * 0.15;
        arc = 0.6 + rnd() * 0.35;
        break;
      }
      case 'spiral': {
        const turns = 2.2 + rnd() * 1.2;
        const a = t * turns + i * 0.15;
        const d = 40 + (i / n) * 200 * rnd() + rnd() * 80;
        tx = Math.cos(a) * d;
        ty = Math.sin(a) * d;
        arc = 0.5;
        break;
      }
      default: {
        tx = Math.cos(t) * 150;
        ty = Math.sin(t) * 150;
      }
    }

    particles.push({
      id: `${variant}-${i}-${Math.floor(rnd() * 1e6)}`,
      tx,
      ty,
      hue: Math.floor(rnd() * 360),
      delay: rnd() * (variant === 'ring' ? 0.85 : 0.55),
      size: 2 + rnd() * 3.5,
      duration: 0.85 + rnd() * 0.75,
      arc,
    });
  }

  if (variant === 'ring') {
    const extra = 24 + Math.floor(rnd() * 20);
    for (let j = 0; j < extra; j++) {
      const a = rnd() * Math.PI * 2;
      const d = 160 + rnd() * 90;
      particles.push({
        id: `ring2-${j}-${Math.floor(rnd() * 1e6)}`,
        tx: Math.cos(a) * d,
        ty: Math.sin(a) * d,
        hue: Math.floor(rnd() * 360),
        delay: 0.35 + rnd() * 0.45,
        size: 2 + rnd() * 2.5,
        duration: 0.9 + rnd() * 0.5,
        arc: rnd() * 0.15,
      });
    }
  }

  return particles;
}

function FireworkLayer({ variant, particles }: { variant: BurstVariant; particles: Particle[] }) {
  const originY = variant === 'fountain' ? '62%' : '38%';

  return (
    <div
      className="sherlock-baba-fw-overlay pointer-events-none fixed inset-0 flex items-start justify-center"
      role="presentation"
      aria-hidden
    >
      <div
        className="sherlock-baba-fw-aurora pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            variant === 'spiral'
              ? 'radial-gradient(ellipse 55% 45% at 50% 38%, rgba(168,85,247,0.18) 0%, transparent 62%)'
              : variant === 'fountain'
                ? 'radial-gradient(ellipse 40% 35% at 50% 62%, rgba(34,211,238,0.14) 0%, transparent 55%)'
                : 'radial-gradient(ellipse 50% 40% at 50% 38%, rgba(252,211,77,0.12) 0%, transparent 58%)',
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2"
        style={{ top: originY, transform: 'translate(-50%, -50%)' }}
      >
        {particles.map(p => (
          <span
            key={p.id}
            className={cn(
              'sherlock-baba-fw-particle absolute left-0 top-0 block rounded-full',
              variant === 'fountain' && 'sherlock-baba-fw-particle--fountain',
              variant === 'spiral' && 'sherlock-baba-fw-particle--spiral',
            )}
            style={
              {
                width: p.size,
                height: p.size,
                marginLeft: -p.size / 2,
                marginTop: -p.size / 2,
                background: `linear-gradient(135deg, hsla(${p.hue},95%,62%,1), hsla(${(p.hue + 40) % 360},90%,55%,0.85))`,
                boxShadow: `0 0 ${4 + p.size}px hsla(${p.hue},100%,70%,0.9), 0 0 ${12 + p.size * 2}px hsla(${(p.hue + 60) % 360},95%,60%,0.45)`,
                '--tx': `${p.tx}px`,
                '--ty': `${p.ty}px`,
                '--arc': String(p.arc),
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 侧栏「巴巴博弈」：暗金霓虹雾 + 连点三次触发全屏烟花（约 3s，每次参数随机）。
 */
export function BabaGamblingEasterEgg() {
  const [burst, setBurst] = useState<{ seed: number; variant: BurstVariant; particles: Particle[] } | null>(null);
  const chainRef = useRef(0);
  const chainTimerRef = useRef<number | null>(null);

  const trigger = useCallback(() => {
    const seed = Date.now() + Math.floor(Math.random() * 10000);
    const variant = randomVariant();
    const particles = buildParticles(variant, seed);
    setBurst({ seed, variant, particles });
    window.setTimeout(() => setBurst(null), FIREWORK_MS);
  }, []);

  const onClick = useCallback(() => {
    if (chainTimerRef.current !== null) {
      window.clearTimeout(chainTimerRef.current);
    }
    chainRef.current += 1;
    if (chainRef.current >= 3) {
      chainRef.current = 0;
      chainTimerRef.current = null;
      trigger();
      return;
    }
    chainTimerRef.current = window.setTimeout(() => {
      chainRef.current = 0;
      chainTimerRef.current = null;
    }, CLICK_CHAIN_MS);
  }, [trigger]);

  const portalEl = typeof document !== 'undefined' ? document.getElementById('sherlock-portal-root') : null;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="sherlock-baba-label group relative shrink-0 cursor-pointer border-none bg-transparent px-1 py-0.5 text-left outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-cyan-400/50"
        title="连点三次，有惊喜"
        aria-label="巴巴博弈，连点三次触发彩蛋"
      >
        <span className="sherlock-baba-label__mist pointer-events-none absolute -inset-x-3 -inset-y-2 -z-1 rounded-lg" aria-hidden />
        <span className="sherlock-baba-label__text relative font-serif text-xs font-semibold tracking-[0.28em] sm:text-sm">
          巴巴博弈
        </span>
      </button>
      {burst && portalEl
        ? createPortal(
            <FireworkLayer key={burst.seed} variant={burst.variant} particles={burst.particles} />,
            portalEl,
          )
        : null}
    </>
  );
}

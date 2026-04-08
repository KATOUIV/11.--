import { Maximize2, X } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * 浏览器禁止「无用户手势」自动全屏；进度条结束后展示此层，一次点击即可 requestFullscreen。
 */
export function FullscreenInvite({
  visible,
  onEnter,
  onDismiss,
}: {
  visible: boolean;
  onEnter: () => void;
  onDismiss: () => void;
}) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-90 flex items-end justify-center p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sherlock-fs-invite-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        aria-label="关闭全屏提示"
        onClick={onDismiss}
      />
      <div
        className={cn(
          'relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-sherlock-gold/40',
          'bg-linear-to-b from-[#0c1018]/98 via-[#070a10]/98 to-[#05070c]/98',
          'shadow-[0_0_60px_rgba(184,134,11,0.2),0_24px_48px_rgba(0,0,0,0.65)]',
        )}
      >
        <div className="sherlock-fs-invite-sheen pointer-events-none absolute inset-0 opacity-90" />
        <div className="relative z-1 border-b border-sherlock-gold/20 px-4 py-3 sm:px-5">
          <p
            id="sherlock-fs-invite-title"
            className="font-serif text-base font-semibold tracking-[0.12em] text-sherlock-gold"
          >
            雾幕已升
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-sherlock-text-muted">
            浏览器须由你点一下才能全屏。点下方铺满视野；也可稍后用行动栏旁的全屏钮再试。
          </p>
        </div>
        <div className="relative z-1 flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-5 sm:py-4">
          <button
            type="button"
            className="order-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs text-sherlock-text-secondary transition hover:bg-white/10 sm:order-1 sm:w-auto"
            onClick={onDismiss}
          >
            稍后再说
          </button>
          <button
            type="button"
            className="order-1 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sherlock-gold/50 bg-sherlock-gold/15 px-5 py-3 text-sm font-medium text-sherlock-gold shadow-[0_0_24px_rgba(184,134,11,0.25)] transition hover:bg-sherlock-gold/25 sm:order-2 sm:w-auto"
            onClick={() => {
              onEnter();
            }}
          >
            <Maximize2 className="h-4 w-4 shrink-0" aria-hidden />
            铺满视野
          </button>
        </div>
        <button
          type="button"
          className="absolute right-2 top-2 z-2 rounded-lg p-1.5 text-sherlock-text-muted transition hover:bg-white/10 hover:text-sherlock-text-primary"
          aria-label="关闭"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * 酒馆消息层 iframe 内全屏：需宿主 iframe 带 allowfullscreen；
 * 部分浏览器需 webkit / moz 前缀。
 */

export function getFullscreenElement(): Element | null {
  const d = document as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
  };
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? d.mozFullScreenElement ?? null;
}

export async function exitFullscreenSafe(): Promise<void> {
  const d = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    mozCancelFullScreen?: () => Promise<void> | void;
  };
  if (d.fullscreenElement && typeof d.exitFullscreen === 'function') {
    await d.exitFullscreen();
    return;
  }
  if (d.webkitFullscreenElement && typeof d.webkitExitFullscreen === 'function') {
    await d.webkitExitFullscreen();
    return;
  }
  if (d.mozFullScreenElement && typeof d.mozCancelFullScreen === 'function') {
    await d.mozCancelFullScreen();
  }
}

export async function requestFullscreenSafe(el: HTMLElement): Promise<void> {
  if (typeof el.requestFullscreen === 'function') {
    await el.requestFullscreen();
    return;
  }
  const w = el as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    mozRequestFullScreen?: () => Promise<void> | void;
  };
  if (typeof w.webkitRequestFullscreen === 'function') {
    await w.webkitRequestFullscreen();
    return;
  }
  if (typeof w.mozRequestFullScreen === 'function') {
    await w.mozRequestFullScreen();
    return;
  }
  throw new Error('Fullscreen API not available');
}

export function isElementFullscreen(el: HTMLElement | null): boolean {
  if (!el) return false;
  return getFullscreenElement() === el;
}

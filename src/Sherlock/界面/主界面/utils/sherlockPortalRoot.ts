/**
 * 浮层必须挂到 `.sherlock-shell` 内；若挂到 `document.body`，全屏时弹层会落在全屏元素之外而不可见。
 */
export function getSherlockPortalRoot(): HTMLElement {
  if (typeof document === 'undefined') {
    return null as unknown as HTMLElement;
  }
  return document.getElementById('sherlock-portal-root') ?? document.body;
}

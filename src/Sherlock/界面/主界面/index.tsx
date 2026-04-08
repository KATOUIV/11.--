import { createRoot } from 'react-dom/client';
import App from './App';
import './global.css';
import './tavern-ambient';

function mountSherlockApp() {
  const el = document.getElementById('app');
  if (!el) {
    console.error('[Sherlock] missing #app');
    return;
  }
  createRoot(el).render(<App />);
}

/**
 * 优先使用 jQuery ready（与酒馆页面生命周期一致）；若 iframe 内未注入 `$` 则直接挂载，
 * 避免 `ReferenceError` 导致整段脚本不执行、主界面白屏。
 */
const jq = (globalThis as unknown as { $?: (cb: () => void) => void }).$;
if (typeof jq === 'function') {
  jq(mountSherlockApp);
} else {
  mountSherlockApp();
}

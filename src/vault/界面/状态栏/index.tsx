import './tavern-ambient';
import { createRoot } from 'react-dom/client';
import './global.css';
import { VaultApp } from './VaultApp';

$(async () => {
  if (typeof waitGlobalInitialized === 'function') {
    try {
      await waitGlobalInitialized('TavernHelper');
    } catch (e) {
      console.warn('[vault] waitGlobalInitialized', e);
    }
  }
  const el = document.getElementById('app');
  if (!el) throw new Error('[vault] missing #app');
  createRoot(el).render(<VaultApp />);
});


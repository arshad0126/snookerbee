import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { repairLocalHistory } from './lib/database';
import { loadLocalSettings } from './lib/settings';
import { lockAppFeel } from './lib/appFeel';
// Old v1 stylesheets first; v2 tokens load last so their :root values win on
// the handful of shared token names (ball palette, success/warning, radii).
// The v1 sheets are removed in Phase 5. tokens.css must be the last definer.
import './styles/index.css';
import './styles/components.css';
import './styles/scoring.css';
import './styles/pages.css';
import './styles/tokens.css';
import './components/ui/ui.css';
import './styles/accents.css';
import './styles/v3.css';

repairLocalHistory();
lockAppFeel();

// Paint the saved theme before React mounts, so there is no flash of the
// default colours. SettingsProvider keeps it in sync afterwards.
{
  const s = loadLocalSettings();
  const light = s.mode === 'light'
    || (s.mode === 'auto' && window.matchMedia?.('(prefers-color-scheme: light)').matches);
  document.body.classList.toggle('light-theme', !!light);
  document.body.dataset.accent = s.accent;
  document.body.dataset.backdrop = s.backdrop;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

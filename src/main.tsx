import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Old v1 stylesheets first; v2 tokens load last so their :root values win on
// the handful of shared token names (ball palette, success/warning, radii).
// The v1 sheets are removed in Phase 5. tokens.css must be the last definer.
import './styles/index.css';
import './styles/components.css';
import './styles/scoring.css';
import './styles/pages.css';
import './styles/tokens.css';
import './components/ui/ui.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

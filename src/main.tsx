import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadPref, savePref } from './prefs';
import { initPwa } from './pwa';
import { toast } from './toast';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

initPwa({ loadPref, savePref, toast });

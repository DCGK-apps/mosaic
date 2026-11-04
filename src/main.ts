import './styles.css';
import { loadPref, savePref } from './prefs';
import { initPwa } from './pwa';

function toast(text: string): void {
  const t = document.getElementById('toast')!;
  t.textContent = text;
  t.classList.add('show');
  clearTimeout((toast as unknown as { timer: number }).timer);
  (toast as unknown as { timer: number }).timer = window.setTimeout(() => t.classList.remove('show'), 2000);
}

initPwa({ loadPref, savePref, toast });

// Tests wait for this before interacting with the page.
document.body.dataset.ready = 'true';

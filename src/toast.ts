let timer = 0;

/** Short message at the top of the screen. */
export function toast(text: string): void {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(timer);
  timer = window.setTimeout(() => t.classList.remove('show'), 2000);
}

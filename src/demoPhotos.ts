/**
 * Sample photos for preview builds (VITE_DEMO_PHOTOS=1), where a file picker
 * may not be available – e.g. a page shown inside another app on a phone.
 * Plain coloured pictures in different shapes, with a number in the middle.
 */
const SAMPLES: [number, number, string, string][] = [
  [1200, 800, '#ef4444', '#f97316'],
  [800, 1200, '#22c55e', '#14b8a6'],
  [1000, 1000, '#3b82f6', '#6366f1'],
  [1600, 900, '#eab308', '#f59e0b'],
  [900, 1600, '#a855f7', '#ec4899'],
  [1200, 900, '#06b6d4', '#0ea5e9'],
  [900, 1200, '#84cc16', '#22c55e'],
  [1500, 1000, '#f43f5e', '#e11d48'],
  [1000, 1300, '#64748b', '#0f172a'],
];

export async function demoPhotos(): Promise<File[]> {
  const files: File[] = [];
  for (const [i, [fullW, fullH, from, to]] of SAMPLES.entries()) {
    // Small pictures are enough to try the layout, and quick to make.
    const w = Math.round(fullW / 3);
    const h = Math.round(fullH / 3);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold ${Math.round(Math.min(w, h) / 3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), w / 2, h / 2);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (blob) files.push(new File([blob], `przyklad_${i + 1}.jpg`, { type: 'image/jpeg' }));
  }
  return files;
}

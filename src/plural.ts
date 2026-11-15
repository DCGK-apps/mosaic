/** Polish plural: 1 zdjęcie, 2–4 zdjęcia (also 22–24…), 5+ zdjęć (also 12–14). */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 10 || t >= 20) ? few : many;
}

export const photosWord = (n: number) => plural(n, 'zdjęcie', 'zdjęcia', 'zdjęć');
export const collagesWord = (n: number) => plural(n, 'kolaż', 'kolaże', 'kolaży');

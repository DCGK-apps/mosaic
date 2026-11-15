/**
 * File names chosen by the user when saving: the last one is remembered and the next
 * save suggests it again with the following two-digit number ("wakacje" → "wakacje01" → "wakacje02").
 */

/** What is remembered after a save: the name without its number, and that number (0 = none). */
export interface NameMemory {
  base: string;
  n: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Name proposed in the dialog: the default one the first time, then the last one with the next number. */
export function suggestName(memory: NameMemory | null, fallback: string): string {
  return memory ? memory.base + pad(memory.n + 1) : fallback;
}

/**
 * What to remember after saving `name`. The suggested name continues its count
 * ("wakacje99" → "wakacje100" → "wakacje101"); a trailing two-digit number typed by the user
 * counts too ("wakacje05" → next "wakacje06"). Other digits (a year, a size) are part of the name.
 */
export function rememberName(name: string, previous: NameMemory | null): NameMemory {
  if (previous && name === suggestName(previous, '')) return { base: previous.base, n: previous.n + 1 };
  const m = /^(.*?\D|)(\d{2})$/.exec(name);
  if (m) return { base: m[1] ?? '', n: Number(m[2]) };
  return { base: name, n: 0 };
}

/** The user's input made safe for a file name: no extension typed by habit, no forbidden characters. */
export function cleanName(input: string, ext: string): string {
  let name = input.trim();
  for (const e of [ext, ...(ext === '.jpg' ? ['.jpeg'] : [])]) {
    if (name.toLowerCase().endsWith(e)) name = name.slice(0, -e.length);
  }
  const forbidden = (c: string) => c < ' ' || '\\/:*?"<>|'.includes(c);
  return [...name]
    .map((c) => (forbidden(c) ? '_' : c))
    .join('')
    .replace(/^[.\s]+|[.\s]+$/g, '');
}

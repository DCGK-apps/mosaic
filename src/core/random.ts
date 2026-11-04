/** Small seeded PRNG (mulberry32), so layouts can be reproduced in tests. */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

/** Ids generated from the same RNG – deterministic for a given seed. */
export function idGen(rng: Rng): () => string {
  return () => Math.floor(rng() * 2 ** 32).toString(36).padStart(7, '0');
}

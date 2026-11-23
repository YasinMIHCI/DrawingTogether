/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Point aléatoire uniforme dans un disque de rayon r. */
export function inDisk(rand: () => number, r: number): [number, number] {
  const d = Math.sqrt(rand()) * r;
  const a = rand() * Math.PI * 2;
  return [Math.cos(a) * d, Math.sin(a) * d];
}

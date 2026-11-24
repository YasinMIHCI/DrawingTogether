/** Une « Bouille » : personnage du joueur, décrit par un petit objet JSON (quelques centaines d'octets). */

/** Réglages d'une partie : modèle, couleur, taille, hauteur, écart, rotation (en crans). */
export interface Part {
  s: number;
  c: number;
  z: number;
  y: number;
  x: number;
  r: number;
}

export interface BouilleData {
  v: 1;
  face: Part; // s = forme du visage, c = teint
  hair: Part & { f: boolean }; // f = coiffure en miroir
  brows: Part;
  eyes: Part;
  nose: Part;
  mouth: Part; // c = couleur des lèvres
  beard: Part;
  must: Part;
  glasses: Part;
  mark: Part; // grain de beauté, taches de rousseur, joues…
  body: { h: number; w: number; c: number; p: number }; // taille, carrure, haut, bas
  /** Peinture sur le visage : image PNG (data URL en local, ou adresse publique une fois envoyée) */
  paint?: string;
  /** Peinture de l'arrière de la tête, du corps (devant) et du dos — mêmes formats */
  paintHead?: string;
  paintBody?: string;
  paintBack?: string;
}

/** Les 4 feuilles de peinture : champ de la Bouille, taille en pixels, nom du fichier en ligne. */
export const PAINT_SHEETS = {
  face: { key: 'paint', w: 128, h: 128, file: 'paint.png' },
  head: { key: 'paintHead', w: 128, h: 128, file: 'paint-head.png' },
  body: { key: 'paintBody', w: 128, h: 208, file: 'paint-body.png' },
  back: { key: 'paintBack', w: 128, h: 208, file: 'paint-back.png' },
} as const;
export type PaintSheet = keyof typeof PAINT_SHEETS;

/** Zone (repère de la Bouille) couverte par la peinture, et taille de l'image en pixels. */
export const PAINT_BOX = { x: 18, y: 22, s: 164 } as const;
export const PAINT_SIZE = 128;

/** N'accepte que des images PNG en data URL ou hébergées dans le stockage public des avatars (pas de guillemets possibles). */
export function isSafePaint(v: unknown): v is string {
  return typeof v === 'string' && v.length < 400_000 &&
    (/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v) || /^https:\/\/[a-z0-9.-]+\/storage\/v1\/object\/public\/avatars\/[\w\-/.]+(\?v=\d+)?$/.test(v));
}

export type Category = 'face' | 'hair' | 'brows' | 'eyes' | 'nose' | 'mouth' | 'beard' | 'must' | 'glasses' | 'mark' | 'body';

export const SKIN = ['#ffe4cc', '#fcd5b0', '#f6c393', '#eaae7b', '#d69766', '#bb7c4c', '#9a643d', '#734a2d', '#ffdcd2', '#f3cba6'];
export const HAIR = ['#2b2523', '#4a2f23', '#6e4426', '#9a6a3c', '#d9b263', '#efe3c4', '#b0452a', '#d9772f', '#8f8f8f', '#f2f2f2', '#3c6fd1', '#e07aa8', '#4f9a4a', '#7c4ec4'];
export const EYE = ['#2a2420', '#6b4325', '#8a6a2e', '#3e8a4f', '#3b7fc4', '#7c8691', '#7a4fb8', '#b0383a'];
export const LIP = ['#d9776f', '#c75b5b', '#b04a5e', '#e39a8a', '#8d4a3d', '#e2607f'];
export const GLASS = ['#2b2b2b', '#7a4a2a', '#c23b3b', '#2f6fd0', '#3c9a3c', '#d4a12a', '#9a9aa2', '#e07aa8'];
export const CLOTH = ['#e2483d', '#f08a2c', '#f2c933', '#9bd33f', '#3c9a3c', '#2f6fd0', '#5cb8e6', '#ef8fb7', '#8a5ad0', '#8a5a3a', '#f4f4f4', '#3a3a3a'];
export const PANTS = ['#3b4a6b', '#2b2b2b', '#6b5a48', '#8b8f96', '#c8b08a', '#5a3d6b'];

/** Nombre de modèles par partie (le 0 vaut « aucun » pour les parties facultatives). */
export const COUNT: Record<Exclude<Category, 'body'>, number> = {
  face: 12, hair: 24, brows: 12, eyes: 20, nose: 10, mouth: 16, beard: 7, must: 7, glasses: 9, mark: 8,
};
export const COLORS: Partial<Record<Category, string[]>> = {
  face: SKIN, hair: HAIR, brows: HAIR, eyes: EYE, mouth: LIP, glasses: GLASS, body: CLOTH,
};
/** Réglages proposés pour chaque partie. */
export const ADJUST: Record<Category, ('z' | 'y' | 'x' | 'r')[]> = {
  face: [], hair: [], brows: ['z', 'y', 'x', 'r'], eyes: ['z', 'y', 'x', 'r'], nose: ['z', 'y'], mouth: ['z', 'y'],
  beard: [], must: ['z', 'y'], glasses: ['z', 'y'], mark: ['y', 'x'], body: [],
};
export const RANGE = { z: 5, y: 6, x: 6, r: 4 } as const;

const part = (s = 0, c = 0): Part => ({ s, c, z: 0, y: 0, x: 0, r: 0 });

export function defaultBouille(): BouilleData {
  return {
    v: 1,
    face: part(2, 1), hair: { ...part(4, 1), f: false }, brows: part(1, 1), eyes: part(0, 0), nose: part(0),
    mouth: part(0, 0), beard: part(0), must: part(0), glasses: part(0), mark: part(0),
    body: { h: 0, w: 0, c: 5, p: 0 },
  };
}

let rng: () => number = Math.random;
const rnd = (n: number) => Math.floor(rng() * n);
const chance = (p: number) => rng() < p;

/** Générateur pseudo-aléatoire reproductible (mêmes passants à chaque visite). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomBouille(random: () => number = Math.random): BouilleData {
  rng = random;
  const b = defaultBouille();
  const hairC = chance(0.85) ? rnd(9) : rnd(HAIR.length);
  b.face = part(rnd(COUNT.face), rnd(SKIN.length));
  b.hair = { ...part(rnd(COUNT.hair - 1) + 1, hairC), f: chance(0.5) };
  b.brows = { ...part(rnd(COUNT.brows), hairC), y: rnd(3) - 1 };
  b.eyes = { ...part(rnd(COUNT.eyes), rnd(EYE.length)), z: rnd(3) - 1, x: rnd(3) - 1 };
  b.nose = part(rnd(COUNT.nose));
  b.mouth = part(rnd(COUNT.mouth), rnd(LIP.length));
  const man = chance(0.3);
  b.beard = part(man ? rnd(COUNT.beard) : 0);
  b.must = part(man && chance(0.5) ? rnd(COUNT.must) : 0);
  b.glasses = part(chance(0.25) ? rnd(COUNT.glasses - 1) + 1 : 0, rnd(GLASS.length));
  b.mark = part(chance(0.35) ? rnd(COUNT.mark - 1) + 1 : 0);
  b.body = { h: rnd(5) - 2, w: rnd(5) - 2, c: rnd(CLOTH.length), p: rnd(PANTS.length) };
  rng = Math.random;
  return b;
}

const clamp = (v: unknown, lo: number, hi: number, d = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

function cleanPart(p: Partial<Part> | undefined, count: number, colors: number, d: Part): Part {
  return {
    s: clamp(p?.s, 0, count - 1, d.s), c: clamp(p?.c, 0, Math.max(0, colors - 1), d.c),
    z: clamp(p?.z, -RANGE.z, RANGE.z), y: clamp(p?.y, -RANGE.y, RANGE.y), x: clamp(p?.x, -RANGE.x, RANGE.x), r: clamp(p?.r, -RANGE.r, RANGE.r),
  };
}

/** Lit une Bouille (venue du stockage ou du réseau) en corrigeant toute valeur invalide. */
export function parseBouille(raw: unknown): BouilleData | null {
  let o: Partial<BouilleData>;
  try {
    o = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<BouilleData>;
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object') return null;
  const d = defaultBouille();
  const cats = Object.keys(COUNT) as (keyof typeof COUNT)[];
  const out = { ...d } as BouilleData;
  for (const k of cats) {
    const colors = (COLORS[k] ?? [''])
      .length;
    (out[k] as Part) = cleanPart(o[k] as Partial<Part>, COUNT[k], colors, d[k] as Part);
  }
  out.hair = { ...out.hair, f: !!(o.hair as { f?: boolean } | undefined)?.f };
  out.body = {
    h: clamp(o.body?.h, -4, 4), w: clamp(o.body?.w, -4, 4),
    c: clamp(o.body?.c, 0, CLOTH.length - 1, d.body.c), p: clamp(o.body?.p, 0, PANTS.length - 1),
  };
  for (const s of Object.values(PAINT_SHEETS)) {
    const v = (o as Record<string, unknown>)[s.key];
    if (isSafePaint(v)) (out as unknown as Record<string, string>)[s.key] = v;
  }
  return out;
}

export const stringifyBouille = (b: BouilleData) => JSON.stringify(b);

/** Bouille à partager dans une salle : sans peinture intégrée (trop lourde), seulement une adresse en ligne. */
export function presenceBouille(json: string | null | undefined = undefined): string | null {
  const b = parseBouille(json === undefined ? loadLocal() : json);
  if (!b) return null;
  for (const s of Object.values(PAINT_SHEETS)) {
    const k = s.key as keyof BouilleData;
    if (typeof b[k] === 'string' && (b[k] as string).startsWith('data:')) delete b[k];
  }
  return stringifyBouille(b);
}
function loadLocal(): string | null {
  try {
    return (JSON.parse(localStorage.getItem('dt.settings') ?? '{}') as { bouille?: string }).bouille ?? null;
  } catch {
    return null;
  }
}

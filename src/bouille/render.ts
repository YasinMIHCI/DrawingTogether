import { CLOTH, EYE, GLASS, FLAT_HEAD_BOX, HAIR, LIP, PAINT_BOX, PANTS, SKIN, isSafePaint, type BouilleData, type Category, type Part } from './model';

/**
 * Dessin d'une Bouille en SVG (chaîne). Repère : tête centrée en (100, 100), crâne de 38 à 162 en x,
 * sommet à y = 26 ; le menton dépend de la forme du visage.
 */

export type View = 'bust' | 'full' | 'head';

export interface RenderOptions {
  view?: View;
  /** Rotation de la « caméra » (-1 à 1) : décale les traits pour un léger effet de volume. */
  turn?: number;
  /** N'afficher qu'une partie (vignettes du créateur). */
  only?: Category;
  /** Expression du visage */
  expr?: Expression;
  /** Cadrage personnalisé (x y largeur hauteur) */
  viewBox?: string;
  /** Ne pas afficher la peinture du visage (fond de l'éditeur de peinture) */
  noPaint?: boolean;
  /** Seulement les traits du visage, sur fond transparent, cadrés 0 0 200 200 (texture de la Bouille 3D) */
  featuresOnly?: boolean;
}

export type Expression = 'neutral' | 'happy' | 'surprised' | 'sad' | 'angry' | 'wink';
export const EXPRESSIONS: Expression[] = ['neutral', 'happy', 'surprised', 'sad', 'angry', 'wink'];

/** Changements apportés par chaque expression : bouche imposée, sourcils (hauteur, rotation), yeux (échelle verticale). */
const EXPR: Record<Expression, { mouth?: number; browY: number; browR: number; eyeY: number; eyeK: number }> = {
  neutral: { browY: 0, browR: 0, eyeY: 1, eyeK: 1 },
  happy: { mouth: 3, browY: -2, browR: 0, eyeY: 0.8, eyeK: 1 },
  surprised: { mouth: 15, browY: -5, browR: 0, eyeY: 1.18, eyeK: 1.1 },
  sad: { mouth: 2, browY: 0, browR: -3, eyeY: 0.9, eyeK: 1 },
  angry: { mouth: 13, browY: 2, browR: 3, eyeY: 0.85, eyeK: 1 },
  wink: { mouth: 9, browY: -1, browR: 0, eyeY: 1, eyeK: 1 },
};

// ---------- Couleurs ----------

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Assombrit (k < 0) ou éclaircit (k > 0) une couleur. */
export function shade(c: string, k: number): string {
  const [r, g, b] = hex(c).map((v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const INK = '#3a2a25';
const MOUTH_IN = '#7a2a2a';

// ---------- Visage ----------

/** [demi-largeur des joues, demi-largeur de la mâchoire, y du menton, rondeur du menton] */
const FACES: [number, number, number, number][] = [
  [58, 34, 174, 0.75], [60, 40, 172, 1], [56, 30, 177, 0.8], [61, 46, 170, 0.3], [54, 30, 183, 0.6], [59, 18, 176, 0.2],
  [63, 44, 168, 0.9], [52, 26, 178, 0.5], [64, 50, 172, 1], [58, 36, 174, 0], [62, 42, 165, 1], [55, 22, 179, 0.1],
];

function facePath(s: number): { d: string; chin: number; cheek: number } {
  const [cw, jw, cy, round] = FACES[s] ?? FACES[0];
  const k = (1 - round) * 12;
  const d =
    `M100 26C136 26 162 50 162 92C162 106 ${101 + cw} 116 ${100 + cw} 128` +
    `C${99 + cw} ${128 + (cy - 128) * 0.55} ${100 + jw} ${cy - k} 100 ${cy}` +
    `C${100 - jw} ${cy - k} ${101 - cw} ${128 + (cy - 128) * 0.55} ${100 - cw} 128` +
    `C${99 - cw} 116 38 106 38 92C38 50 64 26 100 26Z`;
  return { d, chin: cy, cheek: cw };
}

// ---------- Cheveux ----------

type Cap = 'bowl' | 'swept' | 'part' | 'curtain' | 'spiky' | 'slick' | 'fringe' | 'buzz' | 'mohawk' | 'curly' | null;
type Back = 'bob' | 'long' | 'shoulder' | 'bun' | 'buns' | 'tails' | 'pony' | 'afro' | null;
const HAIRS: [Cap, Back][] = [
  [null, null], ['buzz', null], ['bowl', null], ['swept', null], ['part', null], ['spiky', null], ['slick', null], ['curtain', null],
  ['fringe', null], ['mohawk', null], ['curly', null], ['bowl', 'bob'], ['part', 'bob'], ['curtain', 'shoulder'], ['part', 'long'],
  ['fringe', 'long'], ['swept', 'long'], ['slick', 'bun'], ['part', 'buns'], ['fringe', 'tails'], ['swept', 'pony'], ['curly', 'afro'],
  ['curly', 'long'], ['curtain', 'bob'],
];

const CAP_TOP = 'M33 106C28 44 64 13 100 13C136 13 172 44 167 106';
const EDGES: Record<Exclude<Cap, null | 'mohawk' | 'spiky' | 'buzz' | 'curly'>, string> = {
  bowl: 'L161 106L160 70Q100 57 40 70L39 106Z',
  swept: 'L161 100C157 62 132 50 108 52C84 56 62 72 44 90L39 106Z',
  part: 'L161 102C158 68 132 56 104 46C86 58 58 62 42 88L39 106Z',
  curtain: 'L161 104C157 70 124 64 100 50C76 64 43 70 39 104Z',
  slick: 'L161 96C156 54 130 40 100 40C70 40 44 54 39 96Z',
  fringe: 'L161 106L159 84L149 89L140 80L129 89L118 80L107 89L96 80L85 89L74 80L63 89L52 80L42 86L39 106Z',
};
const SPIKY =
  'M33 106L29 72L39 75L36 46L53 54L56 27L73 39L83 12L98 30L112 9L124 32L141 20L146 47L163 41L161 71L171 73L167 106' +
  'L161 98L151 66L140 76L128 58L116 72L100 56L86 72L72 58L62 76L50 64L39 98Z';

function hairLayers(s: number, color: string, id: string): { back: string; front: string } {
  const [cap, back] = HAIRS[s] ?? HAIRS[0];
  const line = shade(color, -0.32);
  const st = `fill="${color}" stroke="${line}" stroke-width="1.8" stroke-linejoin="round"`;
  let b = '';
  switch (back) {
    case 'bob': b = `<path ${st} d="M30 100C26 40 64 14 100 14C136 14 174 40 170 100L172 152Q152 162 136 152L64 152Q48 162 28 152Z"/>`; break;
    case 'shoulder': b = `<path ${st} d="M30 100C26 40 64 14 100 14C136 14 174 40 170 100L176 182Q156 192 136 182L64 182Q44 192 24 182Z"/>`; break;
    case 'long': b = `<path ${st} d="M30 100C26 40 64 14 100 14C136 14 174 40 170 100L180 214Q150 226 126 214L74 214Q50 226 20 214Z"/>`; break;
    case 'bun': b = `<circle ${st} cx="100" cy="12" r="20"/>`; break;
    case 'buns': b = `<circle ${st} cx="48" cy="34" r="20"/><circle ${st} cx="152" cy="34" r="20"/>`; break;
    case 'tails':
      b = `<path ${st} d="M42 64C14 92 10 152 28 200C40 170 48 120 56 72Z"/><path ${st} d="M158 64C186 92 190 152 172 200C160 170 152 120 144 72Z"/>` +
        `<circle ${st} cx="46" cy="66" r="10"/><circle ${st} cx="154" cy="66" r="10"/>`;
      break;
    case 'pony': b = `<path ${st} d="M128 26C178 28 190 104 170 168C162 126 152 76 118 40Z"/><circle ${st} cx="132" cy="30" r="9"/>`; break;
    case 'afro': {
      let bumps = '';
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        bumps += `<circle cx="${(100 + Math.cos(a) * 74).toFixed(1)}" cy="${(84 + Math.sin(a) * 70).toFixed(1)}" r="20"/>`;
      }
      b = `<g ${st}>${bumps}</g><ellipse fill="${color}" cx="100" cy="84" rx="78" ry="74"/>`;
      break;
    }
  }
  let f = '';
  if (cap === 'buzz') {
    f = `<path fill="${color}" fill-opacity=".85" d="M37 98C34 50 64 22 100 22C136 22 166 50 163 98L160 98C156 58 130 44 100 44C70 44 44 58 40 98Z"/>`;
  } else if (cap === 'mohawk') {
    f = `<path ${st} d="M88 60C82 30 92 4 100 -4C108 4 118 30 112 60Q100 54 88 60Z"/>`;
  } else if (cap === 'spiky') {
    f = `<path ${st} d="${SPIKY}"/>`;
  } else if (cap === 'curly') {
    let bumps = '';
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      bumps += `<circle cx="${(100 + Math.cos(a) * 62).toFixed(1)}" cy="${(92 + Math.sin(a) * 70).toFixed(1)}" r="15"/>`;
    }
    f = `<g ${st}>${bumps}</g><path fill="${color}" d="${CAP_TOP}${EDGES.swept}"/>` +
      `<path fill="none" stroke="${line}" stroke-width="1.8" d="M161 100C157 62 132 50 108 52C84 56 62 72 44 90"/>`;
  } else if (cap) {
    f = `<path ${st} d="${CAP_TOP}${EDGES[cap]}"/>`;
  }
  if (cap && cap !== 'buzz' && cap !== 'mohawk') {
    f += `<path d="M64 34Q100 18 136 34" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round"/>`;
  }
  void id;
  return { back: b, front: f };
}

// ---------- Yeux ----------

/** Contour du blanc de l'œil (œil droit à l'écran, centré en 0, 0) et ligne de la paupière. */
const EYE_SHAPES: { white: string; lid: string; iris: number }[] = [
  { white: 'M-9 0A9 10.5 0 1 1 9 0A9 10.5 0 1 1 -9 0Z', lid: 'M-9 -1A9 10.5 0 0 1 9 -1', iris: 6.2 },
  { white: 'M-8 0A8 11.5 0 1 1 8 0A8 11.5 0 1 1 -8 0Z', lid: 'M-8 -1A8 11.5 0 0 1 8 -1', iris: 5.8 },
  { white: 'M-11 1Q-1 -11 11 -2Q1 9 -11 1Z', lid: 'M-11 1Q-1 -11 11 -2', iris: 5.6 },
  { white: 'M-10 -3Q0 -10 10 2Q0 9 -10 -3Z', lid: 'M-10 -3Q0 -10 10 2', iris: 5.4 },
  { white: 'M-10 2Q-2 -10 11 -5Q2 8 -10 2Z', lid: 'M-10 2Q-2 -10 11 -5', iris: 5.4 },
  { white: 'M-11 0Q0 -6.5 11 0Q0 5.5 -11 0Z', lid: 'M-11 0Q0 -6.5 11 0', iris: 4.6 },
  { white: 'M-11 0A11 12 0 1 1 11 0A11 12 0 1 1 -11 0Z', lid: 'M-11 -1A11 12 0 0 1 11 -1', iris: 7.4 },
  { white: 'M-10 -1L10 -1Q10 9 0 9Q-10 9 -10 -1Z', lid: 'M-11 -1L11 -1', iris: 5.6 },
  { white: '', lid: 'M-9 2Q0 -8 9 2', iris: 0 },
  { white: '', lid: '', iris: 0 },
  { white: 'M-10 0A10 11 0 1 1 10 0A10 11 0 1 1 -10 0Z', lid: 'M-10 -1A10 11 0 0 1 10 -1', iris: 7 },
  { white: 'M-10 -1Q0 -9 10 -1Q0 7 -10 -1Z', lid: 'M-10 -1Q0 -9 10 -1', iris: 5 },
];
/** Styles d'yeux : [forme, cils] */
const EYES: [number, boolean][] = [
  [0, false], [1, false], [2, false], [3, false], [4, false], [5, false], [6, false], [7, false], [8, false], [9, false],
  [10, false], [11, false], [0, true], [1, true], [2, true], [3, true], [4, true], [6, true], [10, true], [11, true],
];

function eye(s: number, color: string, clip: string): string {
  const [shape, lashes] = EYES[s] ?? EYES[0];
  const e = EYE_SHAPES[shape];
  if (shape === 9) return `<ellipse cx="0" cy="0" rx="3.6" ry="4.8" fill="${INK}"/><circle cx="-1" cy="-1.8" r="1.1" fill="#fff"/>`;
  if (!e.white) return `<path d="${e.lid}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  let out = `<clipPath id="${clip}"><path d="${e.white}"/></clipPath>` +
    `<path d="${e.white}" fill="#fff" stroke="${INK}" stroke-width="1.3"/>` +
    `<g clip-path="url(#${clip})"><circle cx="0" cy="1" r="${e.iris}" fill="${color}"/>` +
    `<circle cx="0" cy="1" r="${(e.iris * 0.48).toFixed(2)}" fill="#1b1512"/>` +
    `<circle cx="${(-e.iris * 0.35).toFixed(2)}" cy="${(1 - e.iris * 0.4).toFixed(2)}" r="${(e.iris * 0.3).toFixed(2)}" fill="#fff"/>` +
    `<path d="M-14 -14H14V-4Q0 -9 -14 -4Z" fill="#000" fill-opacity=".06"/></g>` +
    `<path d="${e.lid}" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>`;
  if (lashes) out += `<path d="M7 -6l5 -4M9.5 -2.5l5 -2" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
  return out;
}

// ---------- Sourcils ----------

const BROWS: { d: string; w: number; fill?: boolean }[] = [
  { d: 'M-10 1Q0 -4 10 0', w: 2.4 },
  { d: 'M-10 1Q0 -4 10 0', w: 3.8 },
  { d: 'M-10 1Q0 -4 10 0', w: 5.6 },
  { d: 'M-10 3Q-2 -6 10 1', w: 3.6 },
  { d: 'M-10 3Q0 -1 10 -4', w: 4 },
  { d: 'M-10 -4Q0 -1 10 3', w: 3.6 },
  { d: 'M-5 0L5 0', w: 4.4 },
  { d: 'M-11 2L-8 -3L-4 0L0 -4L4 -1L8 -4L11 1Q0 -1 -11 2Z', w: 1.5, fill: true },
  { d: 'M-10 2Q0 -5 10 2', w: 4 },
  { d: 'M-10 0L10 0', w: 5.4 },
  { d: 'M-11 2Q-6 -5 11 -1Q-2 0 -11 6Z', w: 1, fill: true },
  { d: 'M-4 -2.5A4.5 3 0 1 1 -4 2.5A4.5 3 0 1 1 -4 -2.5Z', w: 0.5, fill: true },
];

function brow(s: number, color: string): string {
  const b = BROWS[s] ?? BROWS[0];
  return b.fill
    ? `<path d="${b.d}" fill="${color}" stroke="${color}" stroke-width="${b.w}" stroke-linejoin="round"/>`
    : `<path d="${b.d}" fill="none" stroke="${color}" stroke-width="${b.w}" stroke-linecap="round"/>`;
}

// ---------- Nez ----------

function nose(s: number, skin: string): string {
  const c = shade(skin, -0.38);
  const ln = (d: string, w = 2.2) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  switch (s) {
    case 0: return ln('M-1 -8Q5 0 0 3');
    case 1: return `<ellipse cx="0" cy="0" rx="5.5" ry="3.8" fill="${c}" fill-opacity=".45"/>`;
    case 2: return `<ellipse cx="-3.2" cy="1" rx="1.6" ry="1.2" fill="${c}"/><ellipse cx="3.2" cy="1" rx="1.6" ry="1.2" fill="${c}"/>`;
    case 3: return ln('M-2 -11Q8 2 -2 4');
    case 4: return ln('M-7 1Q0 6 7 1', 2) + `<ellipse cx="-3" cy="0" rx="1.4" ry="1" fill="${c}"/><ellipse cx="3" cy="0" rx="1.4" ry="1" fill="${c}"/>`;
    case 5: return ln('M0 -10L5 3L-1 3');
    case 6: return `<circle cx="0" cy="0" r="6" fill="${shade(skin, -0.12)}"/><circle cx="-2" cy="-2" r="1.6" fill="#fff" fill-opacity=".6"/>`;
    case 7: return ln('M0 -10L0 3L-5 3', 2.6);
    case 8: return ln('M-3 1Q0 3 3 1', 2);
    default: return '';
  }
}

// ---------- Bouche ----------

function mouth(s: number, lip: string): string {
  const ln = (d: string, w = 2.4) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const open = (d: string, teeth = true, tongue = true) =>
    `<path d="${d}" fill="${MOUTH_IN}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>` +
    (tongue ? `<ellipse cx="0" cy="8" rx="5" ry="3" fill="#e27a7a"/>` : '') +
    (teeth ? `<path d="M-8 -1.5H8L7 2H-7Z" fill="#fff"/>` : '');
  switch (s) {
    case 0: return ln('M-9 -1Q0 7 9 -1');
    case 1: return ln('M-8 0L8 0');
    case 2: return ln('M-9 3Q0 -4 9 3');
    case 3: return open('M-10 -2Q0 -2 10 -2Q8 12 0 12Q-8 12 -10 -2Z');
    case 4: return `<path d="M-11 -2Q0 -3 11 -2Q9 7 0 7Q-9 7 -11 -2Z" fill="#fff" stroke="${INK}" stroke-width="1.8"/><path d="M-10 1.5H10" stroke="#ccc" stroke-width="1"/>`;
    case 5: return `<ellipse cx="0" cy="1" rx="3.6" ry="4.6" fill="${MOUTH_IN}" stroke="${INK}" stroke-width="1.6"/>`;
    case 6: return ln('M-8 1Q2 3 9 -4');
    case 7: return ln('M-9 -2Q-4.5 4 0 -1Q4.5 4 9 -2');
    case 8: return `<path d="M-10 0Q-5 -5 0 -2Q5 -5 10 0Q5 1 0 1Q-5 1 -10 0Z" fill="${lip}"/><path d="M-10 0Q0 9 10 0Q0 2 -10 0Z" fill="${shade(lip, -0.1)}"/>`;
    case 9: return `<path d="M-2 2Q2 12 6 2Z" fill="#e27a7a" stroke="${INK}" stroke-width="1.4"/>` + ln('M-9 -1Q0 5 9 -1');
    case 10: return open('M-12 -3Q0 -3 12 -3Q11 15 0 15Q-11 15 -12 -3Z');
    case 11: return `<ellipse cx="0" cy="0" rx="5" ry="3.6" fill="${lip}" stroke="${shade(lip, -0.3)}" stroke-width="1.2"/><path d="M-4 0H4" stroke="${shade(lip, -0.35)}" stroke-width="1"/>`;
    case 12: return ln('M-9 0Q-4.5 -3 0 0Q4.5 3 9 0');
    case 13: return `<rect x="-10" y="-4" width="20" height="8" rx="3" fill="#fff" stroke="${INK}" stroke-width="1.8"/><path d="M-10 0H10M-5 -4V4M0 -4V4M5 -4V4" stroke="#bbb" stroke-width="1"/>`;
    case 14: return ln('M-5 0Q0 4 5 0', 2.2);
    default: return open('M-5 -1Q-5 -7 0 -7Q5 -7 5 -1Q5 8 0 8Q-5 8 -5 -1Z', false, false);
  }
}

// ---------- Barbe, moustache ----------

function beard(s: number, color: string, face: string, chin: number, id: string): string {
  if (!s) return '';
  const clip = (y: number) => `<clipPath id="${id}b"><rect x="0" y="${y}" width="200" height="120"/></clipPath>`;
  const scaled = (k: number) => `<path d="${face}" transform="translate(100 100) scale(${k}) translate(-100 -100)"/>`;
  switch (s) {
    case 1: return `${clip(132)}<g clip-path="url(#${id}b)" fill="${color}" fill-opacity=".22">${scaled(1)}</g>`;
    case 2: return `${clip(130)}<g clip-path="url(#${id}b)" fill="${color}">${scaled(1.07)}</g><ellipse cx="100" cy="149" rx="14" ry="7" fill="${color}" stroke="${shade(color, -0.3)}" stroke-width="1"/>`;
    case 3: return `<path d="M88 ${chin - 22}Q100 ${chin - 28} 112 ${chin - 22}L110 ${chin - 2}Q100 ${chin + 5} 90 ${chin - 2}Z" fill="${color}"/>`;
    case 4: return `${clip(118)}<g clip-path="url(#${id}b)" fill="none" stroke="${color}" stroke-width="7">${scaled(1.02)}</g>`;
    case 5: return `${clip(100)}<g clip-path="url(#${id}b)" fill="none" stroke="${color}" stroke-width="13" stroke-opacity=".95">${scaled(1.04)}</g>`;
    default: return `${clip(124)}<g clip-path="url(#${id}b)" fill="${color}" stroke="${shade(color, -0.3)}" stroke-width="1">${scaled(1.13)}</g>`;
  }
}

function mustache(s: number, color: string): string {
  const st = `fill="${color}" stroke="${shade(color, -0.3)}" stroke-width="1" stroke-linejoin="round"`;
  switch (s) {
    case 1: return `<path ${st} d="M0 -2Q-8 -5 -15 2Q-8 1 0 2Q8 1 15 2Q8 -5 0 -2Z"/>`;
    case 2: return `<path ${st} d="M0 -2Q-10 -6 -16 0Q-20 4 -22 -3Q-21 6 -14 4Q-6 2 0 2Q6 2 14 4Q21 6 22 -3Q20 4 16 0Q10 -6 0 -2Z"/>`;
    case 3: return `<path d="M-11 0Q0 -4 11 0" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 4: return `<path ${st} d="M0 -4Q-12 -6 -16 4Q-10 8 -4 5Q0 3 4 5Q10 8 16 4Q12 -6 0 -4Z"/>`;
    case 5: return `<path ${st} d="M0 -2Q-6 -5 -12 -1Q-16 2 -15 -4Q-17 4 -11 3Q-5 2 0 2Q5 2 11 3Q17 4 15 -4Q16 2 12 -1Q6 -5 0 -2Z"/>`;
    case 6: return `<path ${st} d="M-6 -2H6V2H-6Z"/>`;
    default: return '';
  }
}

// ---------- Lunettes ----------

function glasses(s: number, color: string, dx: number): string {
  if (!s) return '';
  const st = `fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round"`;
  const pair = (one: string, fill = '') =>
    [-dx, dx].map((x) => `<g transform="translate(${x} 0)${x < 0 ? ' scale(-1 1)' : ''}">${fill}${one}</g>`).join('');
  const bridge = `<path d="M${-dx + 10} -2Q0 -6 ${dx - 10} -2" ${st}/>`;
  const lens = `fill="#bfe3ff" fill-opacity=".18"`;
  switch (s) {
    case 1: return pair(`<circle r="12" ${st}/>`, `<circle r="12" ${lens}/>`) + bridge;
    case 2: return pair(`<rect x="-13" y="-10" width="26" height="20" rx="4" ${st}/>`, `<rect x="-13" y="-10" width="26" height="20" rx="4" ${lens}/>`) + bridge;
    case 3: return pair(`<path d="M-13 -2H13Q13 10 0 10Q-13 10 -13 -2" ${st}/>`) + bridge;
    case 4: return pair(`<circle r="15" ${st}/>`, `<circle r="15" ${lens}/>`) + bridge;
    case 5: return pair(`<path d="M-13 -8H13Q14 10 0 10Q-14 10 -13 -8Z" fill="#20242a" fill-opacity=".88" stroke="${color}" stroke-width="2"/>`) + bridge;
    case 6: return pair(`<path d="M-12 -4Q-4 -10 15 -11Q14 8 0 9Q-12 9 -12 -4Z" ${st}/>`) + bridge;
    case 7: return pair(`<ellipse rx="13" ry="9" ${st}/>`, `<ellipse rx="13" ry="9" ${lens}/>`) + bridge;
    default: return pair(`<rect x="-13" y="-5" width="26" height="10" rx="2" ${st}/>`) + bridge;
  }
}

// ---------- Marques du visage ----------

function mark(p: Part, skin: string, eyeY: number, dx: number): string {
  const c = shade(skin, -0.32);
  const x = p.x * 3;
  const y = p.y * 3;
  switch (p.s) {
    case 1: return `<circle cx="${124 + x}" cy="${150 + y}" r="2.2" fill="#4a3228"/>`;
    case 2: {
      let dots = '';
      for (const [px, py] of [[-6, 0], [0, 3], [6, -1], [-3, 6], [4, 7]]) {
        dots += `<circle cx="${100 - 30 + px}" cy="${132 + py}" r="1.1"/><circle cx="${100 + 30 - px}" cy="${132 + py}" r="1.1"/>`;
      }
      return `<g fill="${c}" fill-opacity=".8">${dots}</g>`;
    }
    case 3: return `<g fill="#ff7b8a" fill-opacity=".38"><ellipse cx="${100 - 34}" cy="134" rx="10" ry="5.5"/><ellipse cx="${100 + 34}" cy="134" rx="10" ry="5.5"/></g>`;
    case 4: return `<path d="M${100 - 22} 132Q${100 - 30} 146 ${100 - 26} 158M${100 + 22} 132Q${100 + 30} 146 ${100 + 26} 158" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>`;
    case 5: return `<path d="M${100 - dx - 7} ${eyeY + 13}Q${100 - dx} ${eyeY + 17} ${100 - dx + 7} ${eyeY + 13}M${100 + dx - 7} ${eyeY + 13}Q${100 + dx} ${eyeY + 17} ${100 + dx + 7} ${eyeY + 13}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`;
    case 6: return `<circle cx="${100 + dx + 9 + x}" cy="${eyeY + 13 + y}" r="1.6" fill="#4a3228"/>`;
    case 7: return `<path d="M${100 - 40} 124l-6 -3M${100 - 40} 128l-7 0M${100 + 40} 124l6 -3M${100 + 40} 128l7 0" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`;
    default: return '';
  }
}

// ---------- Corps ----------

function body(b: BouilleData, view: View, skin: string): { svg: string; bottom: number } {
  const shirt = CLOTH[b.body.c] ?? CLOTH[0];
  const sl = shade(shirt, -0.25);
  const neck = `<path d="M86 150V188H114V150Z" fill="${shade(skin, -0.12)}"/>`;
  const pattern = `<g fill="none" stroke="${shade(shirt, shirt === '#3a3a3a' ? 0.25 : -0.12)}" stroke-width="2" stroke-linecap="round">` +
    `<path d="M62 204q6 -6 12 0"/><circle cx="134" cy="206" r="4"/><path d="M96 214l6 6m0 -6l-6 6"/></g>`;
  if (view !== 'full') {
    return {
      svg: neck + `<path d="M14 226C16 198 46 186 82 182Q100 196 118 182C154 186 184 198 186 226Z" fill="${shirt}" stroke="${sl}" stroke-width="1.6"/>` +
        `<path d="M82 182Q100 200 118 182" fill="none" stroke="${sl}" stroke-width="2"/>` + pattern,
      bottom: 226,
    };
  }
  const hf = 1 + b.body.h * 0.12;
  const bw = 1 + b.body.w * 0.1;
  const top = 182;
  const tb = top + 54 * hf;
  const sw = 34 * bw;
  const ww = 31 * bw;
  const legL = 44 * hf;
  const pants = PANTS[b.body.p] ?? PANTS[0];
  const pl = shade(pants, -0.25);
  const arm = (side: 1 | -1) => {
    const x = 100 + side * (sw + 6);
    return `<g transform="rotate(${side * -8} ${x} ${top + 6})"><rect x="${x - 7}" y="${top + 2}" width="14" height="${46 * hf}" rx="7" fill="${shirt}" stroke="${sl}" stroke-width="1.4"/>` +
      `<circle cx="${x}" cy="${top + 2 + 46 * hf}" r="7.5" fill="${skin}" stroke="${shade(skin, -0.25)}" stroke-width="1.2"/></g>`;
  };
  const leg = (side: 1 | -1) => {
    const x = 100 + side * ww * 0.5;
    const w = ww * 0.82;
    return `<rect x="${x - w / 2}" y="${tb - 6}" width="${w}" height="${legL}" rx="6" fill="${pants}" stroke="${pl}" stroke-width="1.4"/>` +
      `<ellipse cx="${x + side * 2}" cy="${tb - 6 + legL}" rx="${w / 2 + 3}" ry="6.5" fill="#4a3b33"/>`;
  };
  const svg = neck + arm(-1) + arm(1) + leg(-1) + leg(1) +
    `<path d="M${100 - sw} ${top + 10}Q${100 - sw} ${top} ${100 - sw + 14} ${top}H${100 + sw - 14}Q${100 + sw} ${top} ${100 + sw} ${top + 10}L${100 + ww} ${tb}H${100 - ww}Z" fill="${shirt}" stroke="${sl}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M84 182Q100 196 116 182" fill="none" stroke="${sl}" stroke-width="2"/>` +
    `<g transform="translate(0 ${(tb - top - 54) / 2})">${pattern}</g>`;
  return { svg, bottom: tb - 6 + legL + 7 };
}

// ---------- Assemblage ----------

let counter = 0;

const VIEWBOX: Partial<Record<Category, string>> = {
  brows: '64 78 72 30', eyes: '62 96 76 32', nose: '84 114 32 30', mouth: '78 134 44 30', must: '74 128 52 26',
  glasses: '54 90 92 44', beard: '28 96 144 104', mark: '26 60 148 124', face: '22 14 156 176',
};

export function renderBouille(b: BouilleData, opt: RenderOptions = {}): string {
  const id = `bq${++counter}`;
  const view = opt.view ?? 'bust';
  const turn = Math.max(-1, Math.min(1, opt.turn ?? 0));
  const only = opt.only;
  const skin = SKIN[b.face.c] ?? SKIN[0];
  const hairC = HAIR[b.hair.c] ?? HAIR[0];
  const face = facePath(b.face.s);
  const show = (c: Category) => !only || only === c;
  const ex = EXPR[opt.expr ?? 'neutral'] ?? EXPR.neutral;

  // Positions (en crans → pixels)
  const eyeY = 112 + b.eyes.y * 2.5;
  const eyeDx = 23 + b.eyes.x * 1.6;
  const browY = 92 + b.brows.y * 2.5;
  const browDx = 23 + b.brows.x * 1.6;
  const noseY = 131 + b.nose.y * 2.5;
  const mouthY = 150 + b.mouth.y * 2.5;
  const mustY = 141 + b.must.y * 2.5;
  const glassY = eyeY + b.glasses.y * 2;
  const k = (z: number) => 1 + z * 0.09;
  const tx = turn * 7;

  const pairOf = (inner: (side: 1 | -1) => string, dx: number, y: number, z: number, r: number) =>
    ([-1, 1] as const)
      .map((side) => `<g transform="translate(${100 + side * dx} ${y}) scale(${side * k(z)} ${k(z)}) rotate(${-r * 5})">${inner(side)}</g>`)
      .join('');

  const hair = hairLayers(b.hair.s, hairC, id);
  const flip = b.hair.f ? 'translate(200 0) scale(-1 1)' : '';
  const skinLine = shade(skin, -0.22);
  const parts: string[] = [];
  const bod = body(b, view, skin);

  const fo = !!opt.featuresOnly;
  if (fo) {
    if (b.paint && isSafePaint(b.paint) && !opt.noPaint) {
      parts.push(
        `<clipPath id="${id}p"><path d="${face.d}"/></clipPath><image href="${b.paint}" x="${PAINT_BOX.x}" y="${PAINT_BOX.y}" width="${PAINT_BOX.s}" height="${PAINT_BOX.s}" ` +
          `preserveAspectRatio="none" clip-path="url(#${id}p)" style="image-rendering:pixelated"/>`,
      );
    }
  } else if (!only || only === 'body') parts.push(`<g transform="translate(${-turn * 2} 0)">${bod.svg}</g>`);
  if (!fo && (!only || only === 'hair')) parts.push(`<g transform="translate(${-turn * 3} 0) ${flip}">${hair.back}</g>`);
  if (!fo && (!only || only === 'hair' || only === 'face' || only === 'beard' || only === 'mark')) {
    // Oreilles, visage
    const ear = (side: 1 | -1) =>
      `<g transform="translate(${100 + side * (FACES[b.face.s]?.[0] ?? 58) + side * 4 - turn * 4} 114)"><ellipse rx="9" ry="13.5" fill="${skin}" stroke="${skinLine}" stroke-width="1.6"/>` +
      `<path d="M${side * 1} -6Q${side * 5} 0 ${side * 1} 6" fill="none" stroke="${skinLine}" stroke-width="1.6" stroke-linecap="round"/></g>`;
    parts.push(ear(-1) + ear(1));
    parts.push(
      `<radialGradient id="${id}s" cx="50%" cy="38%" r="70%"><stop offset=".6" stop-color="${skin}"/><stop offset="1" stop-color="${shade(skin, -0.09)}"/></radialGradient>` +
        `<path d="${face.d}" fill="url(#${id}s)" stroke="${skinLine}" stroke-width="1.8"/>`,
    );
    if (b.paint && isSafePaint(b.paint) && !opt.noPaint && (!only || only === 'face')) {
      parts.push(
        `<clipPath id="${id}p"><path d="${face.d}"/></clipPath><image href="${b.paint}" x="${PAINT_BOX.x}" y="${PAINT_BOX.y}" width="${PAINT_BOX.s}" height="${PAINT_BOX.s}" ` +
          `preserveAspectRatio="none" clip-path="url(#${id}p)" style="image-rendering:pixelated"/>`,
      );
    }
  }
  const feats: string[] = [];
  if (show('mark') && only !== 'face') feats.push(mark(b.mark, skin, eyeY, eyeDx));
  if (show('beard') && only !== 'face') feats.push(beard(b.beard.s, hairC, face.d, face.chin, id));
  if (show('eyes')) {
    feats.push(pairOf((side) => {
      if (opt.expr === 'wink' && side === 1) return `<path d="M-9 2Q0 -8 9 2" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
      const inner = eye(b.eyes.s, EYE[b.eyes.c] ?? EYE[0], `${id}e${side}`);
      return ex.eyeY === 1 && ex.eyeK === 1 ? inner : `<g transform="scale(${ex.eyeK} ${ex.eyeY * ex.eyeK})">${inner}</g>`;
    }, eyeDx, eyeY, b.eyes.z + 1.4, b.eyes.r));
  }
  if (show('brows')) feats.push(pairOf(() => brow(b.brows.s, HAIR[b.brows.c] ?? HAIR[0]), browDx, browY + ex.browY, b.brows.z, b.brows.r + ex.browR));
  if (show('nose')) feats.push(`<g transform="translate(${100 + turn * 3} ${noseY}) scale(${k(b.nose.z)})">${nose(b.nose.s, skin)}</g>`);
  if (show('mouth')) feats.push(`<g transform="translate(100 ${mouthY}) scale(${k(b.mouth.z)})">${mouth(ex.mouth ?? b.mouth.s, LIP[b.mouth.c] ?? LIP[0])}</g>`);
  if (show('must')) feats.push(`<g transform="translate(100 ${mustY}) scale(${k(b.must.z)})">${mustache(b.must.s, hairC)}</g>`);
  if (feats.length) parts.push(`<g transform="translate(${tx} 0)">${feats.join('')}</g>`);
  if (!fo && (!only || only === 'hair')) parts.push(`<g transform="translate(${turn * 3} 0) ${flip}">${hair.front}</g>`);
  if (!fo && show('glasses')) parts.push(`<g transform="translate(${100 + tx} ${glassY}) scale(${k(b.glasses.z)})">${glasses(b.glasses.s, GLASS[b.glasses.c] ?? GLASS[0], eyeDx / k(b.glasses.z))}</g>`);

  // Calque plat du visage : posé par-dessus tout, il peut dépasser de la tête
  if (!fo && b.flatFace && isSafePaint(b.flatFace) && (!only || only === 'face')) {
    const f = FLAT_HEAD_BOX;
    parts.push(`<image href="${b.flatFace}" x="${f.x}" y="${f.y}" width="${f.s}" height="${f.s}" preserveAspectRatio="none" style="image-rendering:pixelated"/>`);
  }
  let vb: string;
  if (fo) vb = '0 0 200 200';
  else if (opt.viewBox) vb = opt.viewBox;
  else if (only && VIEWBOX[only]) vb = VIEWBOX[only]!;
  else if (only === 'hair') vb = '-14 -16 228 240';
  else if (view === 'full' || only === 'body') vb = `-30 -10 260 ${bod.bottom + 16}`;
  else if (view === 'head') vb = '14 0 172 196';
  else vb = '-6 -6 212 232';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%">${parts.join('')}</svg>`;
}

/** Image PNG (fond transparent ou coloré) d'une Bouille, pour l'avatar du compte. */
export async function bouillePng(b: BouilleData, size = 256, background: string | null = null, view: View = 'bust', expr: Expression = 'neutral'): Promise<Blob> {
  // Une image SVG ouverte comme <img> ne charge rien d'extérieur : la peinture doit être intégrée
  for (const k of ['paint', 'flatFace'] as const) {
    const v = b[k];
    if (v?.startsWith('https:')) b = { ...b, [k]: await toDataUrl(v).catch(() => undefined) };
  }
  const svg = renderBouille(b, { view, expr }).replace('width="100%" height="100%"', `width="${size}" height="${size}"`);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.drawImage(img, 0, 0, size, size);
    return await new Promise((res, rej) => c.toBlob((x) => (x ? res(x) : rej(new Error('png'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Télécharge une image et la renvoie en data URL. */
export async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

/** Constantes de forme exportées pour la Bouille 3D : [demi-largeur des joues, demi-largeur de la mâchoire, y du menton, rondeur]. */
export const FACE_SHAPES = FACES;
/** Position des yeux (repère 2D) pour placer les lunettes en 3D. */
export function eyeLayout(b: BouilleData): { y: number; dx: number; glassY: number; glassK: number } {
  const y = 112 + b.eyes.y * 2.5;
  return { y, dx: 23 + b.eyes.x * 1.6, glassY: y + b.glasses.y * 2, glassK: 1 + b.glasses.z * 0.09 };
}

/** Coiffures (calotte avant, volume arrière) pour la Bouille 3D. */
export const HAIR_STYLES = HAIRS;

/** Contour du visage (chemin SVG, repère 2D) d'une forme. */
export function faceOutline(shape: number): string {
  return facePath(shape).d;
}

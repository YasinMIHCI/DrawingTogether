import * as THREE from 'three';
import { FACE_SHAPES } from './render';

/**
 * Coiffures 3D de la Bouille, générées par le code : une coque qui épouse le crâne (avec une épaisseur à la lisière),
 * des mèches sculptées effilées, et des volumes (chignons, queues, couettes, boucles, pointes).
 * Repère identique à three3d.ts : 1 unité = 62 px du dessin 2D, y = (100 − ySvg) / 62, visage vers +z.
 */

const S = 62;
const TOP = 26;
const HANG = 112; // sous cette hauteur, les cheveux tombent droit au lieu de suivre la mâchoire
const FRONT_DEPTH = 0.8;
const BACK_DEPTH = 0.93;
const toY = (ySvg: number) => (100 - ySvg) / S;

function headHalfWidth(ySvg: number, shape: number): number {
  const [cw] = FACE_SHAPES[shape] ?? FACE_SHAPES[0];
  if (ySvg <= 92) return 62 * Math.sqrt(Math.max(0, 1 - ((92 - ySvg) / 66) ** 2));
  const t = Math.min(1, (ySvg - 92) / 36);
  return 62 + (cw - 62) * t * t * (3 - 2 * t);
}

/** Surface des cheveux : suit le crâne puis tombe droit (légèrement évasée) sous HANG. */
export class Scalp {
  constructor(private shape: number) {}
  radius(ySvg: number): number {
    const y = Math.max(TOP + 0.6, ySvg);
    if (y <= HANG) return headHalfWidth(y, this.shape) / S;
    return (headHalfWidth(HANG, this.shape) / S) * (1 + (y - HANG) / 900);
  }
  /** Point à l'angle θ (0 = face, ±π/2 = côtés, π = dos), hauteur ySvg, décollé de `lift` (fraction du rayon). */
  point(th: number, ySvg: number, lift: number): THREE.Vector3 {
    const r = this.radius(ySvg) * (1 + lift);
    const c = Math.cos(th);
    const d = c >= 0 ? FRONT_DEPTH : BACK_DEPTH;
    // Plus de profondeur vers le haut du crâne pour garder une calotte ronde
    const top = Math.max(0, (80 - ySvg) / 54);
    const depth = d + (1 - d) * top * 0.5;
    return new THREE.Vector3(r * Math.sin(th), toY(ySvg) + lift * 0.35 * top, r * c * depth);
  }
  normal(th: number, ySvg: number): THREE.Vector3 {
    const e = 0.01;
    const a = this.point(th + e, ySvg, 0).sub(this.point(th - e, ySvg, 0));
    const b = this.point(th, ySvg + 1, 0).sub(this.point(th, ySvg - 1, 0));
    const n = new THREE.Vector3().crossVectors(b, a).normalize();
    const p = this.point(th, ySvg, 0);
    if (n.dot(new THREE.Vector3(p.x, Math.max(0, p.y - 0.2), p.z)) < 0) n.negate();
    return n;
  }
}

// ---------- Coque ----------

export type Edge = (th: number) => number;

/** Relief des cheveux : décollement supplémentaire selon (θ, ySvg, t) où t = 0 au sommet, 1 à la lisière. */
export type Relief = (th: number, ySvg: number, t: number) => number;

/** Coque de cheveux de la ligne `edge(θ)` jusqu'au sommet, sculptée par `relief`, avec une épaisseur arrondie à la lisière. */
function shell(sc: Scalp, edge: Edge, lift = 0.075, thick = 0.05, relief: Relief = () => 0): THREE.BufferGeometry {
  const R = 64;
  const C = 192;
  const pos: number[] = [];
  const idx: number[] = [];
  for (const layer of [0, 1]) {
    for (let i = 0; i <= R; i++) {
      const t = i / R;
      for (let j = 0; j < C; j++) {
        const th = -Math.PI + (2 * Math.PI * j) / C;
        const e = edge(th);
        const y = TOP + (e - TOP) * (1 - Math.cos((t * Math.PI) / 2));
        const rel = relief(th, y, t);
        // Bord arrondi : la surface extérieure rejoint la surface intérieure à la lisière
        const round = Math.max(0, (t - 0.9) / 0.1);
        const l = layer ? lift - thick + rel * 0.3 : lift + rel - thick * 0.5 * round * round;
        const p = sc.point(th, y, l);
        pos.push(p.x, p.y, p.z);
      }
    }
  }
  const at = (layer: number, i: number, j: number) => layer * (R + 1) * C + i * C + ((j + C) % C);
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < C; j++) {
      idx.push(at(0, i, j), at(0, i + 1, j), at(0, i, j + 1), at(0, i, j + 1), at(0, i + 1, j), at(0, i + 1, j + 1));
      idx.push(at(1, i, j), at(1, i, j + 1), at(1, i + 1, j), at(1, i, j + 1), at(1, i + 1, j + 1), at(1, i + 1, j));
    }
  }
  for (let j = 0; j < C; j++) {
    idx.push(at(0, R, j), at(1, R, j), at(0, R, j + 1), at(0, R, j + 1), at(1, R, j), at(1, R, j + 1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------- Mèches ----------

/** Tube effilé le long d'un chemin : section elliptique (largeur le long de la surface, épaisseur selon la normale). */
function tube(points: THREE.Vector3[], normals: THREE.Vector3[], width: (t: number) => number, thick: (t: number) => number, seg = 10): THREE.BufferGeometry {
  const n = points.length;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const dir = points[Math.min(n - 1, i + 1)].clone().sub(points[Math.max(0, i - 1)]).normalize();
    const nrm = normals[i].clone().sub(dir.clone().multiplyScalar(normals[i].dot(dir))).normalize();
    const side = new THREE.Vector3().crossVectors(nrm, dir).normalize();
    const w = width(t);
    const h = thick(t);
    for (let k = 0; k < seg; k++) {
      const a = (2 * Math.PI * k) / seg;
      // Section aplatie en dessous (posée sur la tête), bombée au-dessus
      const sy = Math.sin(a);
      const p = points[i].clone().addScaledVector(side, Math.cos(a) * w).addScaledVector(nrm, sy * h * (sy < 0 ? 0.45 : 1));
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < seg; k++) {
      const a = i * seg + k;
      const b = i * seg + ((k + 1) % seg);
      idx.push(a, a + seg, b, b, a + seg, b + seg);
    }
  }
  // Bouchons
  const c0 = pos.length / 3;
  pos.push(points[0].x, points[0].y, points[0].z);
  const c1 = c0 + 1;
  pos.push(points[n - 1].x, points[n - 1].y, points[n - 1].z);
  for (let k = 0; k < seg; k++) {
    idx.push(c0, (k + 1) % seg, k);
    const l = (n - 1) * seg;
    idx.push(c1, l + k, l + ((k + 1) % seg));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

interface LockSpec {
  /** Départ et arrivée sur le crâne : angle θ et hauteur ySvg */
  from: [number, number];
  to: [number, number];
  /** Largeur à la base (px du dessin 2D) */
  w: number;
  /** Bombé de la mèche au milieu (fraction du rayon) */
  bulge?: number;
  /** Épaisseur (unités) */
  thick?: number;
  /** Courbure latérale (θ ajouté au milieu) */
  curve?: number;
  /** Pointe relevée (pointes, mèches rebelles) : décollement au bout */
  flick?: number;
  /** Bout arrondi au lieu d'effilé */
  blunt?: boolean;
}

/** Mèche posée sur le crâne, de `from` à `to`. */
function lock(sc: Scalp, l: LockSpec, base = 0.07): THREE.BufferGeometry {
  const N = 18;
  const pts: THREE.Vector3[] = [];
  const nrm: THREE.Vector3[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const e = t * t * (3 - 2 * t);
    const th = l.from[0] + (l.to[0] - l.from[0]) * e + (l.curve ?? 0) * Math.sin(Math.PI * t);
    const y = l.from[1] + (l.to[1] - l.from[1]) * t;
    const lift = base + (l.bulge ?? 0.03) * Math.sin(Math.PI * Math.min(1, t * 1.2)) + (l.flick ?? 0) * t ** 3;
    pts.push(sc.point(th, y, lift));
    nrm.push(sc.normal(th, y));
  }
  const w0 = l.w / S;
  const h0 = l.thick ?? 0.07;
  return tube(pts, nrm, (t) => w0 * (l.blunt ? 0.85 + 0.15 * Math.cos(t * Math.PI / 2) - (t > 0.9 ? (t - 0.9) * 6 : 0) : (1 - t ** 1.6)) * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, t + 0.35))), (t) => h0 * (1 - 0.7 * t) + 0.005);
}

/** Mèche libre (queue, couette, mèche qui tombe) le long de points 3D. */
function strand(points: THREE.Vector3[], w: number, h: number, outward = new THREE.Vector3(0, 0, -1), taper = 1.3): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const N = 28;
  const pts = curve.getSpacedPoints(N - 1);
  const nrm = pts.map(() => outward.clone());
  return tube(pts, nrm, (t) => w * (1 - t ** taper * 0.85) * (0.8 + 0.2 * Math.sin(Math.PI * Math.min(1, t + 0.2))), (t) => h * (1 - t ** taper * 0.8), 12);
}

// ---------- Coiffures ----------

const D = Math.PI / 180;
type Cap = 'bowl' | 'swept' | 'part' | 'curtain' | 'spiky' | 'slick' | 'fringe' | 'buzz' | 'mohawk' | 'curly' | null;
type Back = 'bob' | 'long' | 'shoulder' | 'bun' | 'buns' | 'tails' | 'pony' | 'afro' | null;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const gauss = (x: number, w: number) => Math.exp(-(x * x) / (2 * w * w));
/** Pointes de mèches : 0 au creux, 1 à la pointe (bout pointu, creux arrondis). */
const tips = (x: number) => 1 - Math.abs(Math.sin(Math.PI * x)) ** 0.7;
/** Mèches en relief : arêtes douces, sillons marqués entre les mèches. */
const ridges = (x: number) => Math.abs(Math.sin(Math.PI * x)) ** 0.55;

/** Ligne du front (ySvg) selon θ ; côtés vers les tempes ; dos jusqu'à la nuque ou plus bas. */
function edgeFor(cap: Cap, back: Back): Edge {
  const nape = back === 'bob' ? 160 : back === 'shoulder' ? 186 : back === 'long' ? 216 : 152;
  const longHair = back === 'bob' || back === 'shoulder' || back === 'long';
  return (th) => {
    const deg = th / D;
    const a = Math.abs(deg);
    const front = (() => {
      switch (cap) {
        case 'bowl': return 72 + 3 * tips(deg / 13);
        case 'swept': return 60 + 24 * smooth(-45, 55, deg) + 7 * tips((deg + 8) / 21);
        case 'part': return 56 + a * 0.14 + 5 * tips(deg / 16);
        case 'curtain': return 54 + a * 0.32 + 5 * tips(deg / 14);
        case 'spiky': return 62 + 8 * tips(deg / 11);
        case 'slick': return 48;
        case 'fringe': return 79 + 7 * tips(deg / 11);
        case 'buzz': case 'mohawk': return 50;
        case 'curly': return 60 + 5 * tips(deg / 12);
        default: return 46;
      }
    })();
    // Tempes : la lisière descend devant les oreilles (pattes)
    const temple = front + (106 - front) * smooth(55, 88, a);
    // Dos : nuque, ou cheveux qui tombent (pointes découpées)
    const back_ = longHair ? nape + 6 * tips(deg / 15) : nape + 3 * tips(deg / 18);
    // Les cheveux longs passent derrière les oreilles puis tombent
    const k = smooth(longHair ? 88 : 95, longHair ? 118 : 140, a);
    return temple * (1 - k) + back_ * k;
  };
}

/** Relief propre à chaque frange (mèches, raie, volume). */
function reliefFor(cap: Cap, back: Back): Relief {
  const longHair = back === 'bob' || back === 'shoulder' || back === 'long';
  return (th, y, t) => {
    const deg = th / D;
    const a = Math.abs(deg);
    // Volume général : plus gonflé sur le dessus, rentré à la lisière
    let r = 0.04 * gauss(y - 40, 22) - 0.02 * t * t;
    // Mèches du dos / des cheveux longs : verticales
    const backRidges = 0.026 * ridges(deg / 15) * smooth(60, 110, y);
    switch (cap) {
      case 'bowl':
        r += 0.03 * ridges(deg / 13) * smooth(40, 70, y) * (1 - smooth(70, 150, a));
        break;
      case 'swept': {
        // Mèches en diagonale qui partent de la raie
        const u = (deg + (y - 30) * 0.9) / 20;
        r += 0.04 * ridges(u) * smooth(32, 60, y) * (1 - smooth(70, 130, a));
        r += 0.06 * gauss(deg - 25, 30) * gauss(y - 40, 12); // volume du côté de la raie
        r -= 0.035 * gauss(deg - 38, 3) * (1 - smooth(30, 60, y)); // raie
        break;
      }
      case 'part':
      case 'curtain': {
        r -= 0.05 * gauss(deg, 2.5) * (1 - smooth(25, 70, y)); // raie au milieu
        const u = (a - (y - 30) * (cap === 'curtain' ? -0.8 : -0.3)) / 16;
        r += 0.035 * ridges(u) * smooth(30, 60, y) * (1 - smooth(70, 130, a));
        r += 0.04 * gauss(a - 25, 14) * gauss(y - 45, 14);
        break;
      }
      case 'fringe':
        r += 0.035 * ridges(deg / 11) * smooth(45, 78, y) * (1 - smooth(70, 120, a));
        r += 0.03 * gauss(y - 60, 12) * (1 - smooth(60, 120, a));
        break;
      case 'slick': {
        // Cheveux plaqués vers l'arrière : sillons fins dans le sens de la tête
        const u = deg / 9;
        r += 0.012 * ridges(u) * smooth(30, 60, y);
        r += 0.05 * gauss(deg, 30) * gauss(y - 44, 8); // petite banane au-dessus du front
        break;
      }
      case 'spiky':
        r += 0.03 * ridges(deg / 11) * smooth(40, 62, y);
        break;
      case 'curly':
        // Surface bouclée
        r += 0.06 * (0.5 + 0.5 * Math.sin(deg / 8) * Math.sin(y / 5.5)) + 0.03;
        break;
      case 'buzz':
      case 'mohawk':
        r = 0;
        break;
    }
    if (longHair || (cap && cap !== 'buzz' && cap !== 'mohawk' && cap !== 'curly' && cap !== 'slick')) r += backRidges * smooth(100, 140, a);
    if (back === 'bob') r += 0.05 * smooth(120, 150, y); // pointes du carré qui se gonflent un peu
    return r;
  };
}

function sphereAt(p: THREE.Vector3, r: number, sy = 1): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 28, 20);
  g.scale(1, sy, 1);
  g.translate(p.x, p.y, p.z);
  return g;
}

/** Construit les pièces de la coiffure (cap, back : voir HAIR_STYLES) pour la forme de visage `shape`. */
export function buildHairGeometries(cap: Cap, back: Back, shape: number): THREE.BufferGeometry[] {
  if (!cap && !back) return [];
  const sc = new Scalp(shape);
  const out: THREE.BufferGeometry[] = [];
  const edge = edgeFor(cap, back);
  const relief = reliefFor(cap, back);

  // Coque principale sculptée
  if (cap === 'buzz') out.push(shell(sc, edge, 0.028, 0.02));
  else if (cap === 'mohawk') out.push(shell(sc, edge, 0.02, 0.015));
  else if (cap === 'curly' && back === 'afro') {
    // Afro : grand volume rond, dégagé devant le visage, surface bouclée
    const afro: Relief = (th, y, t) => {
      const a = Math.abs(th / D);
      // Grand volume partout, sauf juste au-dessus du visage où il redescend vers le front
      const face = (1 - smooth(35, 80, a)) * smooth(45, 70, y);
      return 0.42 * (1 - face) * (1 - t * t * 0.5) + 0.07 * (0.5 + 0.5 * Math.sin(th / D / 9) * Math.sin(y / 6));
    };
    const afroEdge: Edge = (th) => {
      const a = Math.abs(th / D);
      const k = smooth(60, 110, a);
      return (58 + 5 * tips(th / D / 12)) * (1 - k) + (150 + 6 * tips(th / D / 14)) * k;
    };
    out.push(shell(sc, afroEdge, 0.12, 0.08, afro));
  } else if (cap) out.push(shell(sc, edge, cap === 'slick' ? 0.06 : 0.08, 0.06, relief));
  else out.push(shell(sc, (th) => (Math.abs(th) > 100 * D ? 120 : 44), 0.07, 0.05, relief));

  // Pièces en plus
  switch (cap) {
    case 'spiky': {
      // Pointes larges, soudées à la calotte, plus longues au sommet et vers l'arrière
      const rows: [number, number, number, number][] = [[44, 7, 0.3, 26], [32, 6, 0.38, 30], [52, 9, 0.3, 30]];
      rows.forEach(([y, n, len, step], ri) => {
        for (let k = 0; k < n; k++) {
          const th = ri === 2 ? (180 + (k - (n - 1) / 2) * step) * D : ((k - (n - 1) / 2) * step + (ri === 1 ? 10 : 0)) * D;
          const p = sc.point(th, y, 0.04);
          const nrm = sc.normal(th, y);
          const dir = nrm.clone().multiplyScalar(0.6).add(new THREE.Vector3(0, 0.55, ri === 2 ? -0.2 : 0)).normalize();
          const cone = new THREE.ConeGeometry(0.17, len, 16, 1);
          cone.translate(0, len / 2, 0);
          cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
          cone.translate(p.x, p.y, p.z);
          out.push(cone);
        }
      });
      break;
    }
    case 'mohawk': {
      // Crête : suite de lames arrondies le long du milieu du crâne
      for (let i = 0; i < 15; i++) {
        const th = i < 8 ? 0 : Math.PI;
        const y = i < 8 ? 60 - i * 4.5 : 26 + (i - 7) * 13;
        const p = sc.point(th, y, 0.02);
        const nrm = sc.normal(th, y);
        const len = 0.44 - Math.abs(i - 7) * 0.025;
        const blade = new THREE.SphereGeometry(0.5, 20, 14);
        blade.scale(0.09, len, 0.62);
        blade.translate(0, len * 0.55, 0);
        blade.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm));
        blade.translate(p.x, p.y, p.z);
        out.push(blade);
      }
      break;
    }
  }

  switch (back) {
    case 'bun':
    case 'buns': {
      // Chignons posés contre le crâne (à moitié enfoncés), avec un petit bourrelet à la base
      const spots: [number, number][] = back === 'bun' ? [[180 * D, 24]] : [[-62 * D, 30], [62 * D, 30]];
      for (const [th, y] of spots) {
        const r = back === 'bun' ? 0.34 : 0.27;
        const base = sc.point(th, y, 0.08);
        const nrm = sc.normal(th, y);
        const c = base.clone().addScaledVector(nrm, r * 0.5);
        out.push(sphereAt(c, r, 1));
        const tor = new THREE.TorusGeometry(r * 0.82, r * 0.17, 12, 36);
        tor.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm));
        tor.translate(base.x + nrm.x * r * 0.12, base.y + nrm.y * r * 0.12, base.z + nrm.z * r * 0.12);
        out.push(tor);
      }
      break;
    }
    case 'tails':
      for (const s of [-1, 1]) {
        const root = sc.point(s * 104 * D, 72, 0.1);
        const tie = new THREE.TorusGeometry(0.13, 0.055, 12, 24);
        tie.rotateY(Math.PI / 2);
        tie.translate(root.x + s * 0.06, root.y, root.z);
        out.push(tie);
        out.push(strand([root.clone().add(new THREE.Vector3(-s * 0.05, 0, 0)), root.clone().add(new THREE.Vector3(s * 0.3, -0.15, -0.05)), root.clone().add(new THREE.Vector3(s * 0.48, -0.8, -0.08)), root.clone().add(new THREE.Vector3(s * 0.38, -1.6, 0))], 0.3, 0.26, new THREE.Vector3(s, 0.2, 0).normalize(), 1.6));
      }
      break;
    case 'pony': {
      const root = sc.point(Math.PI, 44, 0.1);
      const tie = new THREE.TorusGeometry(0.15, 0.06, 12, 24);
      tie.rotateX(0.5);
      tie.translate(root.x, root.y, root.z - 0.08);
      out.push(tie);
      out.push(strand([root.clone().add(new THREE.Vector3(0, 0, 0.08)), root.clone().add(new THREE.Vector3(0, 0.12, -0.42)), root.clone().add(new THREE.Vector3(0.04, -0.5, -0.66)), root.clone().add(new THREE.Vector3(-0.02, -1.4, -0.55))], 0.32, 0.28, new THREE.Vector3(0, 0.3, -1).normalize(), 1.6));
      break;
    }
  }
  return out;
}

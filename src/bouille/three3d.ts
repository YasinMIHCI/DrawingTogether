import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CLOTH, GLASS, HAIR, PAINT_BOX, PAINT_SHEETS, PANTS, SKIN, type BouilleData, type PaintSheet } from './model';
import { FACE_SHAPES, HAIR_STYLES, eyeLayout, faceOutline, renderBouille, shade, toDataUrl, type Expression, type View } from './render';
import META from './body-meta.json';

/**
 * Bouille en 3D (three.js). Tête et cheveux sont calculés ici (leur forme suit le dessin 2D) ;
 * le corps, d'une seule pièce, vient de Blender (public/models/bouille-body.glb, formes Grandeur / Carrure).
 * Repère : 1 unité = 62 px du dessin 2D ; y = 0 à la hauteur y = 100 du dessin ; la Bouille regarde vers +z.
 *
 * Peintures : 4 feuilles (visage, arrière de la tête, corps devant, dos), plaquées par projection de face / de dos.
 */

const S = 62;
const TOP = 26;
const toY = (ySvg: number) => (100 - ySvg) / S;
const FRONT_DEPTH = 0.8;
const BACK_DEPTH = 0.93;
const HEAD_TEX = 1024; // côté d'une demi-texture de tête (avant | arrière)
const BODY_TEX = { w: 256, h: 416 }; // une feuille du corps dans la texture (devant | dos)

/** Demi-largeur du visage (px du dessin 2D) à une hauteur donnée. */
export function faceHalfWidth(ySvg: number, shape: number): number {
  const [cw, jw, cy, round] = FACE_SHAPES[shape] ?? FACE_SHAPES[0];
  if (ySvg <= 92) return 62 * Math.sqrt(Math.max(0, 1 - ((92 - ySvg) / 66) ** 2));
  if (ySvg <= 128) {
    const t = (ySvg - 92) / 36;
    return 62 + (cw - 62) * t * t * (3 - 2 * t);
  }
  const s = Math.min(1, (ySvg - 128) / (cy - 128));
  const base = cw + (jw - cw) * s ** 1.3;
  const close = Math.max(0, 1 - s ** (2 + round * 4)) ** (0.5 + 0.3 * round);
  return base * close;
}

/**
 * Surface (tête ou coque de cheveux) en deux moitiés : l'avant (UV : moitié gauche, projection de face)
 * et l'arrière (moitié droite, projection de dos). Les colonnes de couture sont doublées puis lissées.
 * `edge(xSvg, back)` limite la hauteur (cheveux) ; sans lui, du sommet au menton.
 */
function shellGeometry(shape: number, grow = 1, edge?: (xs: number, back: number) => number): THREE.BufferGeometry {
  const chin = FACE_SHAPES[shape]?.[2] ?? 174;
  const R = 72;
  const H = 40; // colonnes par moitié
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const half = (backSide: boolean) => {
    const start = pos.length / 3;
    for (let i = 0; i <= R; i++) {
      for (let j = 0; j <= H; j++) {
        const th = (backSide ? Math.PI / 2 : -Math.PI / 2) + (Math.PI * j) / H;
        const c = Math.cos(th);
        const back = Math.max(0, -c);
        const x0 = 62 * Math.sin(th) + 100;
        const bottom = edge ? edge(x0, back) : chin;
        const t = i / R;
        const ySvg = edge ? TOP + (bottom - TOP) * (1 - Math.cos((t * Math.PI) / 2)) : TOP + (chin - TOP) * (1 - Math.cos(t * Math.PI)) / 2;
        const r = (faceHalfWidth(ySvg, shape) / S) * grow;
        const x = r * Math.sin(th);
        const z = r * c * (c >= 0 ? FRONT_DEPTH : BACK_DEPTH) * grow;
        pos.push(x, toY(ySvg), z);
        const xs = x * S + 100;
        uv.push(backSide ? 0.5 + ((200 - xs) / 200) * 0.5 : (xs / 200) * 0.5, 1 - ySvg / 200);
      }
    }
    for (let i = 0; i < R; i++) {
      for (let j = 0; j < H; j++) {
        const a = start + i * (H + 1) + j;
        const b = a + H + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  };
  half(false);
  half(true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Lissage de la couture : moyenne des normales des sommets doublés
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  const per = (R + 1) * (H + 1);
  for (let i = 0; i <= R; i++) {
    for (const [a, b] of [[i * (H + 1) + H, per + i * (H + 1)], [i * (H + 1), per + i * (H + 1) + H]]) {
      const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
      n.setXYZ(a, v.x, v.y, v.z);
      n.setXYZ(b, v.x, v.y, v.z);
    }
  }
  return g;
}

/** Profondeur (z) de la surface du visage en (x, y) du dessin 2D. */
function surfaceZ(xSvg: number, ySvg: number, shape: number): number {
  const r = faceHalfWidth(ySvg, shape) / S;
  const x = (xSvg - 100) / S;
  return Math.sqrt(Math.max(0, r * r - x * x)) * FRONT_DEPTH;
}

const mat = (color: string, rough = 0.6) => new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, metalness: 0 });

function addMesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, p: [number, number, number] = [0, 0, 0], s?: [number, number, number], r?: [number, number, number]) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...p);
  if (s) m.scale.set(...s);
  if (r) m.rotation.set(...r);
  parent.add(m);
  return m;
}

// ---------- Cheveux ----------

type Cap = (typeof HAIR_STYLES)[number][0];
/** Bord avant des cheveux (px du dessin 2D) selon x, pour chaque type de frange. */
function frontEdge(cap: NonNullable<Cap>, xs: number): number {
  const t = Math.min(1, Math.max(0, (xs - 38) / 124));
  const d = Math.abs(xs - 100);
  switch (cap) {
    case 'bowl': return 70;
    case 'swept': case 'curly': return 58 + 30 * (1 - t) ** 1.8;
    case 'part': return 52 + d * 0.32;
    case 'curtain': return 54 + (1 - d / 62) * 4 + d * 0.38;
    case 'spiky': return 64 + 7 * Math.abs(Math.sin(xs / 7));
    case 'slick': return 44;
    case 'fringe': return 84 + 3 * Math.abs(Math.sin(xs / 5));
    case 'buzz': return 50;
    default: return 60;
  }
}

function buildHair(root: THREE.Object3D, b: BouilleData) {
  const [cap, back] = HAIR_STYLES[b.hair.s] ?? HAIR_STYLES[0];
  if (!cap && !back) return;
  const color = HAIR[b.hair.c] ?? HAIR[0];
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.42, metalness: 0, side: THREE.DoubleSide });
  const flip = b.hair.f ? -1 : 1;
  const group = new THREE.Group();
  group.scale.x = flip;
  root.add(group);
  if (cap && cap !== 'mohawk') {
    const nape = back ? 128 : 120;
    const edge = (xs: number, bk: number) => {
      const side = Math.min(1, Math.abs(xs - 100) / 58) ** 5;
      const f = frontEdge(cap, xs) * (1 - side) + 106 * side;
      return f * (1 - bk) + nape * bk;
    };
    const grow = cap === 'buzz' ? 1.025 : cap === 'curly' ? 1.1 : 1.075;
    addMesh(group, shellGeometry(b.face.s, grow, edge), m);
    if (cap === 'curly' || cap === 'spiky') {
      // Volume : boucles ou pointes sur le dessus
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI * 0.85 + (i / 8) * Math.PI * 0.7;
        const p: [number, number, number] = [Math.cos(a) * 0.95, 1.1 + Math.sin(-a) * 0.15, Math.sin(a) * 0.3 - 0.1];
        if (cap === 'curly') addMesh(group, new THREE.SphereGeometry(0.28, 16, 12), m, p);
        else addMesh(group, new THREE.ConeGeometry(0.2, 0.5, 12), m, [p[0] * 0.8, 1.35, p[2]], undefined, [0, 0, -p[0] * 0.5]);
      }
    }
  }
  if (cap === 'mohawk') addMesh(group, new THREE.CapsuleGeometry(0.16, 1.2, 8, 16), m, [0, 1.15, -0.1], [1, 1, 2.2], [Math.PI / 2, 0, 0]);
  if (back === 'bob' || back === 'shoulder' || back === 'long') {
    const len = back === 'bob' ? 0.9 : back === 'shoulder' ? 1.5 : 2.3;
    addMesh(group, new THREE.CapsuleGeometry(0.95, len, 10, 32), m, [0, toY(92) - len / 2, -0.3], [1.14, 1, 0.72]);
  } else if (back === 'bun') addMesh(group, new THREE.SphereGeometry(0.36, 24, 16), m, [0, toY(12), -0.25]);
  else if (back === 'buns') for (const x of [-0.82, 0.82]) addMesh(group, new THREE.SphereGeometry(0.33, 24, 16), m, [x, toY(36), -0.15]);
  else if (back === 'tails') for (const x of [-1.08, 1.08]) addMesh(group, new THREE.CapsuleGeometry(0.22, 1.4, 8, 16), m, [x, toY(140), -0.2], undefined, [0, 0, x * 0.1]);
  else if (back === 'pony') addMesh(group, new THREE.CapsuleGeometry(0.25, 1.3, 8, 16), m, [0, toY(120), -1.0], undefined, [0.35, 0, 0]);
  else if (back === 'afro') addMesh(group, new THREE.SphereGeometry(1.5, 32, 24), m, [0, toY(80), -0.2], [1, 0.95, 0.88]);
}

// ---------- Lunettes ----------

function buildGlasses(root: THREE.Object3D, b: BouilleData) {
  const s = b.glasses.s;
  if (!s) return;
  const { dx, glassY, glassK } = eyeLayout(b);
  const frame = mat(GLASS[b.glasses.c] ?? GLASS[0], 0.35);
  const y = toY(glassY);
  const z = Math.max(surfaceZ(100 - dx, glassY, b.face.s), surfaceZ(100 + dx, glassY, b.face.s)) + 0.07;
  const square = s === 2 || s === 6 || s === 8;
  const r = (s === 4 ? 0.25 : 0.2) * glassK;
  for (const side of [-1, 1]) {
    const x = (side * dx) / S;
    const m = addMesh(root, new THREE.TorusGeometry(r, 0.028, 10, square ? 4 : 40, s === 3 ? Math.PI : Math.PI * 2), frame, [x, y, z]);
    if (square) m.rotation.z = Math.PI / 4;
    if (s === 3) m.rotation.z = Math.PI;
    if (s === 6) m.scale.set(1.15, 0.9, 1);
    if (s === 7) m.scale.set(1.2, 0.75, 1);
    if (s === 8) m.scale.set(1.2, 0.55, 1);
    if (s === 5 || s === 1 || s === 4 || s === 2) {
      const lens = new THREE.MeshStandardMaterial({ color: s === 5 ? 0x20242a : 0xbfe3ff, transparent: true, opacity: s === 5 ? 0.88 : 0.15, roughness: 0.1 });
      const disc = addMesh(root, new THREE.CircleGeometry(r * (square ? 1.1 : 1), square ? 4 : 32), lens, [x, y, z - 0.005]);
      if (square) disc.rotation.z = Math.PI / 4;
    }
    addMesh(root, new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), frame, [side * (dx / S + r * 0.95), y + 0.02, z - 0.45], undefined, [Math.PI / 2, 0, 0]);
  }
  const gap = (2 * dx) / S - 2 * r;
  if (gap > 0.01) addMesh(root, new THREE.CylinderGeometry(0.022, 0.022, gap, 6), frame, [0, y + 0.04, z + 0.01], undefined, [0, 0, Math.PI / 2]);
}

// ---------- Corps (modèle Blender) ----------

let bodyModel: Promise<THREE.Mesh> | null = null;
function loadBody(): Promise<THREE.Mesh> {
  bodyModel ??= new GLTFLoader().loadAsync(new URL('models/bouille-body.glb', document.baseURI).href).then((g) => {
    let mesh: THREE.Mesh | null = null;
    g.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !mesh) mesh = o as THREE.Mesh;
    });
    if (!mesh) throw new Error('body');
    return mesh;
  });
  return bodyModel;
}

/** Matière du corps : la couleur dépend de la zone (cou, mains, haut, bas, chaussures) d'après la pose de base ; peinture par-dessus. */
function bodyMaterial(skin: string, shirt: string, pants: string, paint: THREE.Texture): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  const z = META.zones;
  const col = (c: string) => new THREE.Color(c);
  m.defines = { USE_UV: '' };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uSkin: { value: col(skin) }, uNeck: { value: col(shade(skin, -0.06)) }, uShirt: { value: col(shirt) },
      uPants: { value: col(pants) }, uShoes: { value: col('#4a3b33') }, uPaint: { value: paint },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBase;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBase = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vBase;
uniform vec3 uSkin; uniform vec3 uNeck; uniform vec3 uShirt; uniform vec3 uPants; uniform vec3 uShoes;
uniform sampler2D uPaint;`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
vec3 zc = uShirt;
float ax = abs(vBase.x);
if (vBase.y < ${z.waist.toFixed(3)} && ax < ${z.hand.toFixed(3)}) zc = uPants;
if (vBase.y < ${z.feet.toFixed(3)}) zc = uShoes;
if (vBase.y < ${z.wrist.toFixed(3)} && ax > ${z.hand.toFixed(3)}) zc = uSkin;
if (vBase.y > ${z.neck.toFixed(3)}) zc = uNeck;
vec4 pt = texture2D(uPaint, vUv);
vec4 diffuseColor = vec4(mix(zc, pt.rgb, pt.a), opacity);`);
  };
  return m;
}

// ---------- Peintures ----------

export class PaintSheets {
  canvases = {} as Record<PaintSheet, HTMLCanvasElement>;
  private sources = {} as Record<PaintSheet, string | undefined>;
  constructor() {
    for (const [k, s] of Object.entries(PAINT_SHEETS) as [PaintSheet, (typeof PAINT_SHEETS)[PaintSheet]][]) {
      const c = document.createElement('canvas');
      c.width = s.w;
      c.height = s.h;
      this.canvases[k] = c;
    }
  }
  /** Charge les peintures de la Bouille (seulement celles qui ont changé). */
  async load(b: BouilleData): Promise<void> {
    for (const [k, s] of Object.entries(PAINT_SHEETS) as [PaintSheet, (typeof PAINT_SHEETS)[PaintSheet]][]) {
      const src = b[s.key as keyof BouilleData] as string | undefined;
      if (src === this.sources[k]) continue;
      this.sources[k] = src;
      const ctx = this.canvases[k].getContext('2d')!;
      ctx.clearRect(0, 0, s.w, s.h);
      if (!src) continue;
      const url = src.startsWith('data:') ? src : await toDataUrl(src).catch(() => '');
      if (!url) continue;
      const img = new Image();
      img.src = url;
      await img.decode().catch(() => {});
      ctx.drawImage(img, 0, 0, s.w, s.h);
    }
  }
  /** Contenu d'une feuille (data URL), ou undefined si elle est vide. */
  export(k: PaintSheet): string | undefined {
    const c = this.canvases[k];
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i]) return c.toDataURL('image/png');
    return undefined;
  }
  /** Retient qu'une feuille vient d'être exportée (évite de la recharger). */
  remember(k: PaintSheet, src: string | undefined) {
    this.sources[k] = src;
  }
}

export interface Brush {
  color: string | null; // null = gomme
  size: number;
  mirror: boolean;
}

export interface Options3D {
  view: View;
  expr: Expression;
}

export class Bouille3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  private char = new THREE.Group();
  private headGroup = new THREE.Group();
  private body: THREE.Mesh | null = null;
  private headMesh: THREE.Mesh | null = null;
  private seq = 0;
  private frame = 0;
  private bottom = -4;
  private view: View = 'bust';
  private bouille: BouilleData | null = null;
  private featuresImg: HTMLImageElement | null = null;
  private headCanvas = document.createElement('canvas');
  private bodyCanvas = document.createElement('canvas');
  private headTex: THREE.CanvasTexture;
  private bodyTex: THREE.CanvasTexture;
  private ray = new THREE.Raycaster();
  sheets = new PaintSheets();
  /** Rotation (radians) autour de l'axe vertical. */
  yaw = 0;
  /** Balancement automatique (désactivé pendant la peinture). */
  idle = true;
  private shownYaw = 0;
  private t0 = performance.now();

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environmentIntensity = 0.55;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xcabfa8, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2.5, 4, 5);
    this.scene.add(key);
    this.headCanvas.width = HEAD_TEX * 2;
    this.headCanvas.height = HEAD_TEX;
    this.bodyCanvas.width = BODY_TEX.w * 2;
    this.bodyCanvas.height = BODY_TEX.h;
    this.headTex = new THREE.CanvasTexture(this.headCanvas);
    this.headTex.colorSpace = THREE.SRGBColorSpace;
    this.headTex.anisotropy = 4;
    this.bodyTex = new THREE.CanvasTexture(this.bodyCanvas);
    this.bodyTex.colorSpace = THREE.SRGBColorSpace;
    this.bodyTex.magFilter = THREE.NearestFilter;
    this.bodyTex.flipY = false; // les UV glTF ont l'origine en haut
    this.scene.add(this.char);
    this.char.add(this.headGroup);
    const loop = () => {
      this.frame = requestAnimationFrame(loop);
      this.tick();
    };
    this.frame = requestAnimationFrame(loop);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.frameCamera();
  }

  private frameCamera() {
    const full = this.view === 'full';
    const top = 1.45;
    const bottom = full ? this.bottom - 0.05 : -2.1;
    const h = top - bottom;
    const mid = (top + bottom) / 2;
    const fov = (this.camera.fov * Math.PI) / 180;
    const fitH = h / 2 / Math.tan(fov / 2);
    const fitW = (full ? 3.2 : 3.6) / 2 / Math.tan(fov / 2) / this.camera.aspect;
    const d = Math.max(fitH, fitW) * 1.06 + 1;
    this.camera.position.set(0, mid + 0.35, d);
    this.camera.lookAt(0, mid, 0);
    this.camera.updateProjectionMatrix();
  }

  private dispose3D(o: THREE.Object3D) {
    o.traverse((x) => {
      const m = x as THREE.Mesh;
      if (m.geometry && m !== this.body) m.geometry.dispose();
      const mm = m.material as THREE.Material | THREE.Material[] | undefined;
      if (mm) for (const one of Array.isArray(mm) ? mm : [mm]) one.dispose();
    });
  }

  /** Dessine les traits du visage (sans la peinture) en image. */
  private async features(b: BouilleData, expr: Expression): Promise<HTMLImageElement> {
    const svg = renderBouille({ ...b, paint: undefined }, { featuresOnly: true, expr }).replace('width="100%" height="100%"', `width="${HEAD_TEX}" height="${HEAD_TEX}"`);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {});
    URL.revokeObjectURL(url);
    return img;
  }

  /** Recompose les textures de la tête et du corps (traits + peintures). */
  private composite() {
    const b = this.bouille;
    if (!b) return;
    const k = HEAD_TEX / 200;
    const h = this.headCanvas.getContext('2d')!;
    h.imageSmoothingEnabled = false;
    h.fillStyle = SKIN[b.face.c] ?? SKIN[0];
    h.fillRect(0, 0, this.headCanvas.width, this.headCanvas.height);
    // Visage : peinture (découpée au contour du visage) puis traits
    h.save();
    h.scale(k, k);
    h.clip(new Path2D(faceOutline(b.face.s)));
    h.drawImage(this.sheets.canvases.face, PAINT_BOX.x, PAINT_BOX.y, PAINT_BOX.s, PAINT_BOX.s);
    h.restore();
    if (this.featuresImg) {
      h.imageSmoothingEnabled = true;
      h.drawImage(this.featuresImg, 0, 0, HEAD_TEX, HEAD_TEX);
      h.imageSmoothingEnabled = false;
    }
    // Arrière de la tête (vu de dos)
    h.drawImage(this.sheets.canvases.head, HEAD_TEX + PAINT_BOX.x * k, PAINT_BOX.y * k, PAINT_BOX.s * k, PAINT_BOX.s * k);
    this.headTex.needsUpdate = true;
    const c = this.bodyCanvas.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, this.bodyCanvas.width, this.bodyCanvas.height);
    c.drawImage(this.sheets.canvases.body, 0, 0, BODY_TEX.w, BODY_TEX.h);
    c.drawImage(this.sheets.canvases.back, BODY_TEX.w, 0, BODY_TEX.w, BODY_TEX.h);
    this.bodyTex.needsUpdate = true;
  }

  /** Reconstruit le personnage (rapide) ; les images (traits, peintures, corps) se chargent en parallèle. */
  async set(b: BouilleData, opt: Options3D, keepSheets = false): Promise<void> {
    const seq = ++this.seq;
    this.view = opt.view;
    const [img, body] = await Promise.all([this.features(b, opt.expr), loadBody(), keepSheets ? null : this.sheets.load(b)]);
    if (seq !== this.seq) return;
    this.bouille = b;
    this.featuresImg = img;
    for (const o of [...this.headGroup.children]) {
      this.headGroup.remove(o);
      this.dispose3D(o);
    }
    const skin = SKIN[b.face.c] ?? SKIN[0];
    this.headMesh = addMesh(this.headGroup, shellGeometry(b.face.s), new THREE.MeshStandardMaterial({ map: this.headTex, roughness: 0.55 }));
    const cw = FACE_SHAPES[b.face.s]?.[0] ?? 58;
    for (const side of [-1, 1]) addMesh(this.headGroup, new THREE.SphereGeometry(1, 20, 14), mat(skin, 0.55), [side * (cw / S + 0.02), toY(113), -0.02], [0.11, 0.2, 0.09]);
    buildHair(this.headGroup, b);
    buildGlasses(this.headGroup, b);
    // Corps : formes Grandeur / Carrure, posé sous le menton
    if (!this.body) {
      this.body = body.clone();
      this.char.add(this.body);
    }
    (this.body.material as THREE.Material).dispose();
    this.body.material = bodyMaterial(skin, CLOTH[b.body.c] ?? CLOTH[0], PANTS[b.body.p] ?? PANTS[0], this.bodyTex);
    const dict = this.body.morphTargetDictionary ?? {};
    const inf = this.body.morphTargetInfluences ?? [];
    const hk = b.body.h / 4;
    const wk = b.body.w / 4;
    inf[dict.tall] = Math.max(0, hk);
    inf[dict.short] = Math.max(0, -hk);
    inf[dict.wide] = Math.max(0, wk);
    inf[dict.thin] = Math.max(0, -wk);
    const chinY = toY(FACE_SHAPES[b.face.s]?.[2] ?? 174);
    this.body.position.y = chinY + 0.28;
    const bottomAt = (v: number, plus: number, minus: number) => (v >= 0 ? META.bottom + (plus - META.bottom) * v : META.bottom + (minus - META.bottom) * -v);
    this.bottom = this.body.position.y + bottomAt(hk, META.variants.tall.bottom, META.variants.short.bottom);
    this.composite();
    this.frameCamera();
  }

  // ---------- Peinture directement sur le modèle ----------

  /** Point du modèle sous le doigt → feuille et pixel. */
  private hit(clientX: number, clientY: number): { sheet: PaintSheet; x: number; y: number } | null {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), this.camera);
    const targets = [this.headMesh, this.body].filter(Boolean) as THREE.Mesh[];
    const h = this.ray.intersectObjects(targets, false)[0];
    if (!h?.uv) return null;
    const { x: u, y: v } = h.uv;
    if (h.object === this.headMesh) {
      const sheet: PaintSheet = u < 0.5 ? 'face' : 'head';
      const sx = (u < 0.5 ? u : u - 0.5) * 400; // px du dessin 2D (0..200)
      const sy = (1 - v) * 200;
      const s = PAINT_SHEETS[sheet];
      return { sheet, x: ((sx - PAINT_BOX.x) / PAINT_BOX.s) * s.w, y: ((sy - PAINT_BOX.y) / PAINT_BOX.s) * s.h };
    }
    const sheet: PaintSheet = u < 0.5 ? 'body' : 'back';
    const s = PAINT_SHEETS[sheet];
    return { sheet, x: (u < 0.5 ? u : u - 0.5) * 2 * s.w, y: v * s.h };
  }

  private last: { sheet: PaintSheet; x: number; y: number } | null = null;

  private dab(sheet: PaintSheet, x: number, y: number, brush: Brush) {
    const s = PAINT_SHEETS[sheet];
    const ctx = this.sheets.canvases[sheet].getContext('2d')!;
    const put = (px: number) => {
      const x0 = Math.round(px - brush.size / 2);
      const y0 = Math.round(y - brush.size / 2);
      if (brush.color) {
        ctx.fillStyle = brush.color;
        ctx.fillRect(x0, y0, brush.size, brush.size);
      } else ctx.clearRect(x0, y0, brush.size, brush.size);
    };
    put(x);
    if (brush.mirror) put(s.w - x);
  }

  /** Peint au point touché ; renvoie la feuille modifiée (ou null si on a touché le vide). */
  paint(clientX: number, clientY: number, brush: Brush, start: boolean): PaintSheet | null {
    const p = this.hit(clientX, clientY);
    if (!p) {
      this.last = null;
      return null;
    }
    const prev = !start && this.last && this.last.sheet === p.sheet ? this.last : null;
    const steps = prev ? Math.max(1, Math.ceil(Math.hypot(p.x - prev.x, p.y - prev.y))) : 1;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      this.dab(p.sheet, prev ? prev.x + (p.x - prev.x) * t : p.x, prev ? prev.y + (p.y - prev.y) * t : p.y, brush);
    }
    this.last = p;
    this.composite();
    return p.sheet;
  }
  endStroke() {
    this.last = null;
  }
  /** Redessine après une modification des feuilles (annuler, feuille 2D…). */
  refreshPaint() {
    this.composite();
  }

  /** Image du corps vu de face ou de dos, cadrée comme la feuille de peinture (fond du dessin 2D). */
  guide(sheet: 'body' | 'back'): string {
    const s = PAINT_SHEETS[sheet];
    const box = META.box;
    const cam = new THREE.OrthographicCamera(box.x0, box.x1, box.z1, box.z0, 0.1, 20);
    const by = this.body?.position.y ?? 0;
    cam.position.set(0, by, sheet === 'body' ? 8 : -8);
    cam.lookAt(0, by, 0);
    cam.position.y = by;
    cam.top = box.z1;
    cam.bottom = box.z0;
    cam.updateProjectionMatrix();
    const saved = { yaw: this.char.rotation.y, head: this.headGroup.visible, size: this.renderer.getSize(new THREE.Vector2()), pr: this.renderer.getPixelRatio(), morph: [...(this.body?.morphTargetInfluences ?? [])] };
    this.char.rotation.y = 0;
    this.char.position.y = 0;
    this.headGroup.visible = false;
    if (this.body?.morphTargetInfluences) this.body.morphTargetInfluences.fill(0);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(s.w * 2, s.h * 2, false);
    this.renderer.render(this.scene, cam);
    const url = this.canvas.toDataURL('image/png');
    this.headGroup.visible = saved.head;
    if (this.body?.morphTargetInfluences) saved.morph.forEach((v, i) => (this.body!.morphTargetInfluences![i] = v));
    this.renderer.setPixelRatio(saved.pr);
    this.renderer.setSize(saved.size.x, saved.size.y, false);
    return url;
  }

  private tick() {
    this.shownYaw += (this.yaw - this.shownYaw) * 0.2;
    const t = (performance.now() - this.t0) / 1000;
    const sway = this.idle ? 1 : 0;
    this.char.rotation.y = this.shownYaw + Math.sin(t * 0.8) * 0.04 * sway;
    this.char.position.y = Math.sin(t * 1.6) * 0.015 * sway;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.dispose3D(this.char);
    this.headTex.dispose();
    this.bodyTex.dispose();
    this.renderer.dispose();
  }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}


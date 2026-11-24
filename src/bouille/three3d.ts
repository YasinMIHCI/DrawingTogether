import * as THREE from 'three';
import { CLOTH, GLASS, HAIR, PANTS, SKIN, type BouilleData } from './model';
import { FACE_SHAPES, HAIR_STYLES, eyeLayout, renderBouille, shade, toDataUrl, type Expression, type View } from './render';

/**
 * Bouille en 3D (three.js). La tête est un volume dont le profil suit la forme 2D du visage ;
 * les traits (yeux, bouche, peinture…) sont dessinés en 2D puis plaqués sur l'avant de la tête.
 * Repère : 1 unité = 62 px du dessin 2D ; y = 0 à la hauteur y = 100 du dessin ; la tête regarde vers +z.
 */

const S = 62;
const TOP = 26;
const toY = (ySvg: number) => (100 - ySvg) / S;

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

const FRONT_DEPTH = 0.86;
const BACK_DEPTH = 0.97;

/** Volume de la tête : anneaux du sommet au menton. Avec `arc`, seulement l'avant (support des traits du visage). */
function headGeometry(shape: number, arc = Math.PI, grow = 1): THREE.BufferGeometry {
  const chin = FACE_SHAPES[shape]?.[2] ?? 174;
  const R = 72;
  const C = arc === Math.PI ? 72 : 48;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= R; i++) {
    const t = i / R;
    const ySvg = TOP + (chin - TOP) * t;
    const r = (faceHalfWidth(ySvg, shape) / S) * grow;
    for (let j = 0; j <= C; j++) {
      const th = -arc + (2 * arc * j) / C;
      const x = r * Math.sin(th);
      const c = Math.cos(th);
      const z = r * c * (c >= 0 ? FRONT_DEPTH : BACK_DEPTH) * grow;
      pos.push(x, toY(ySvg), z);
      uv.push((x * S + 100) / 200, 1 - ySvg / 200);
    }
  }
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < C; j++) {
      const a = i * (C + 1) + j;
      const b = a + C + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Profondeur (z) de la surface du visage en (x, y) du dessin 2D. */
function surfaceZ(xSvg: number, ySvg: number, shape: number): number {
  const r = faceHalfWidth(ySvg, shape) / S;
  const x = (xSvg - 100) / S;
  return Math.sqrt(Math.max(0, r * r - x * x)) * FRONT_DEPTH;
}

/** Dessine les traits du visage (SVG) dans une texture. */
async function faceTexture(b: BouilleData, expr: Expression): Promise<THREE.CanvasTexture> {
  if (b.paint?.startsWith('https:')) b = { ...b, paint: await toDataUrl(b.paint).catch(() => undefined) };
  const size = 1024;
  const svg = renderBouille(b, { featuresOnly: true, expr }).replace('width="100%" height="100%"', `width="${size}" height="${size}"`);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    canvas.getContext('2d')!.drawImage(img, 0, 0, size, size);
  } finally {
    URL.revokeObjectURL(url);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const mat = (color: string, rough = 0.75) => new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, metalness: 0 });

function addMesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, p: [number, number, number] = [0, 0, 0], s?: [number, number, number], r?: [number, number, number]) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...p);
  if (s) m.scale.set(...s);
  if (r) m.rotation.set(...r);
  m.castShadow = false;
  parent.add(m);
  return m;
}

/** Cheveux provisoires (T12.2 les remplacera par de vraies coiffures en volume). */
function buildHair(root: THREE.Object3D, b: BouilleData) {
  const [cap, back] = HAIR_STYLES[b.hair.s] ?? HAIR_STYLES[0];
  if (!cap && !back) return;
  const m = mat(HAIR[b.hair.c] ?? HAIR[0], 0.6);
  const sy = 66 / S;
  if (cap) {
    const thin = cap === 'buzz';
    const g = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI * (cap === 'slick' ? 0.42 : 0.5));
    const k = thin ? 1.02 : 1.08;
    addMesh(root, g, m, [0, toY(92), -0.02], [k, sy * k, (BACK_DEPTH + 0.06) * k], [cap === 'fringe' ? 0.12 : -0.18, 0, 0]);
  }
  if (back === 'bob' || back === 'shoulder' || back === 'long') {
    const len = back === 'bob' ? 0.9 : back === 'shoulder' ? 1.4 : 2;
    addMesh(root, new THREE.CapsuleGeometry(1, len, 8, 24), m, [0, toY(92) - len / 2, -0.25], [1.12, 1, 0.75]);
  } else if (back === 'bun') addMesh(root, new THREE.SphereGeometry(0.35, 24, 16), m, [0, toY(10), -0.2]);
  else if (back === 'buns') for (const x of [-0.8, 0.8]) addMesh(root, new THREE.SphereGeometry(0.32, 24, 16), m, [x, toY(36), -0.1]);
  else if (back === 'tails') for (const x of [-1.05, 1.05]) addMesh(root, new THREE.CapsuleGeometry(0.22, 1.3, 8, 16), m, [x, toY(130), -0.15], undefined, [0, 0, x * 0.12]);
  else if (back === 'pony') addMesh(root, new THREE.CapsuleGeometry(0.25, 1.2, 8, 16), m, [0, toY(120), -1.05], undefined, [0.35, 0, 0]);
  else if (back === 'afro') addMesh(root, new THREE.SphereGeometry(1.45, 32, 24), m, [0, toY(84), -0.2], [1, 0.95, 0.9]);
}

function buildGlasses(root: THREE.Object3D, b: BouilleData) {
  const s = b.glasses.s;
  if (!s) return;
  const { dx, glassY, glassK } = eyeLayout(b);
  const color = GLASS[b.glasses.c] ?? GLASS[0];
  const frame = mat(color, 0.35);
  const y = toY(glassY);
  const z = Math.max(surfaceZ(100 - dx, glassY, b.face.s), surfaceZ(100 + dx, glassY, b.face.s)) + 0.07;
  const square = s === 2 || s === 6 || s === 8;
  const r = (s === 4 ? 0.25 : 0.2) * glassK;
  for (const side of [-1, 1]) {
    const x = (side * dx) / S;
    const ring = new THREE.TorusGeometry(r, 0.028, 10, square ? 4 : 40, s === 3 ? Math.PI : Math.PI * 2);
    const m = addMesh(root, ring, frame, [x, y, z]);
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
    // Branche vers l'oreille
    addMesh(root, new THREE.CylinderGeometry(0.02, 0.02, 0.95, 6), frame, [side * (dx / S + r * 0.95), y + 0.02, z - 0.47], undefined, [Math.PI / 2, 0, 0]);
  }
  const gap = (2 * dx) / S - 2 * r;
  if (gap > 0.01) addMesh(root, new THREE.CylinderGeometry(0.022, 0.022, gap, 6), frame, [0, y + 0.04, z + 0.01], undefined, [0, 0, Math.PI / 2]);
}

/** Corps : cou, torse, bras, jambes, chaussures (même silhouette en buste et en pied). */
function buildBody(root: THREE.Object3D, b: BouilleData, chinY: number) {
  const hf = 1 + b.body.h * 0.06;
  const bw = 1 + b.body.w * 0.08;
  const skin = SKIN[b.face.c] ?? SKIN[0];
  const shirt = mat(CLOTH[b.body.c] ?? CLOTH[0], 0.85);
  const pants = mat(PANTS[b.body.p] ?? PANTS[0], 0.85);
  const skinM = mat(skin, 0.7);
  addMesh(root, new THREE.CylinderGeometry(0.2, 0.22, 0.45, 20), mat(shade(skin, -0.08), 0.7), [0, chinY - 0.05, -0.05]);
  const tr = 0.62 * bw;
  const tl = 0.55 * hf;
  const torsoTop = chinY - 0.12;
  const torsoY = torsoTop - (tl / 2 + tr);
  addMesh(root, new THREE.CapsuleGeometry(tr, tl, 10, 32), shirt, [0, torsoY, -0.05], [1, 1, 0.72]);
  // Col
  addMesh(root, new THREE.TorusGeometry(0.24, 0.05, 8, 24), shirt, [0, torsoTop - 0.04, -0.05], undefined, [Math.PI / 2, 0, 0]);
  const armL = 0.75 * hf;
  for (const side of [-1, 1]) {
    const ax = side * (tr + 0.16);
    const ay = torsoTop - 0.28 - armL / 2;
    const arm = new THREE.Group();
    arm.position.set(ax, torsoTop - 0.28, -0.05);
    arm.rotation.z = side * 0.1;
    root.add(arm);
    addMesh(arm, new THREE.CapsuleGeometry(0.17, armL, 8, 16), shirt, [0, -armL / 2, 0]);
    addMesh(arm, new THREE.SphereGeometry(0.17, 16, 12), skinM, [0, -armL - 0.12, 0]);
    void ay;
  }
  const legL = 0.7 * hf;
  const hip = torsoY - tl / 2 - tr * 0.55;
  for (const side of [-1, 1]) {
    const lx = side * 0.28 * bw;
    addMesh(root, new THREE.CapsuleGeometry(0.22 * Math.min(bw, 1.1), legL, 8, 16), pants, [lx, hip - legL / 2, -0.05]);
    addMesh(root, new THREE.SphereGeometry(1, 20, 12), mat('#4a3b33', 0.6), [lx + side * 0.02, hip - legL - 0.22, 0.06], [0.27, 0.15, 0.38]);
  }
  return hip - legL - 0.37;
}

export interface Options3D {
  view: View;
  expr: Expression;
}

export class Bouille3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  private char = new THREE.Group();
  private faceMat: THREE.MeshStandardMaterial | null = null;
  private seq = 0;
  private frame = 0;
  private bottom = -4;
  private view: View = 'bust';
  /** Rotation (radians) autour de l'axe vertical. */
  yaw = 0;
  private shownYaw = 0;
  private t0 = performance.now();

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a4, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2.5, 4, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xfff1dc, 0.6);
    rim.position.set(-4, 2, -3);
    this.scene.add(rim);
    this.scene.add(this.char);
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
    const top = 1.35;
    const bottom = full ? this.bottom : -2.3;
    const h = top - bottom;
    const mid = (top + bottom) / 2;
    const fov = (this.camera.fov * Math.PI) / 180;
    const fitH = h / 2 / Math.tan(fov / 2);
    const fitW = (full ? 3 : 3.4) / 2 / Math.tan(fov / 2) / this.camera.aspect;
    const d = Math.max(fitH, fitW) * 1.08 + 1;
    this.camera.position.set(0, mid + 0.3, d);
    this.camera.lookAt(0, mid, 0);
    this.camera.updateProjectionMatrix();
  }

  private dispose3D(o: THREE.Object3D) {
    o.traverse((x) => {
      const m = x as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mm = m.material as THREE.Material | THREE.Material[] | undefined;
      if (mm) for (const one of Array.isArray(mm) ? mm : [mm]) {
        (one as THREE.MeshStandardMaterial).map?.dispose();
        one.dispose();
      }
    });
  }

  /** Reconstruit le personnage (rapide) puis la texture du visage (asynchrone). */
  async set(b: BouilleData, opt: Options3D): Promise<void> {
    const seq = ++this.seq;
    this.view = opt.view;
    const tex = await faceTexture(b, opt.expr);
    if (seq !== this.seq) return tex.dispose();
    const old = [...this.char.children];
    for (const o of old) {
      this.char.remove(o);
      this.dispose3D(o);
    }
    const skin = SKIN[b.face.c] ?? SKIN[0];
    const head = new THREE.Group();
    this.char.add(head);
    const skinM = mat(skin, 0.68);
    addMesh(head, headGeometry(b.face.s), skinM);
    this.faceMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.68, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    addMesh(head, headGeometry(b.face.s, Math.PI * 0.46, 1.004), this.faceMat);
    const cw = FACE_SHAPES[b.face.s]?.[0] ?? 58;
    for (const side of [-1, 1]) {
      addMesh(head, new THREE.SphereGeometry(1, 20, 14), mat(skin, 0.7), [side * (cw / S + 0.03), toY(114), -0.08], [0.13, 0.22, 0.1]);
    }
    buildHair(head, b);
    buildGlasses(head, b);
    const chinY = toY(FACE_SHAPES[b.face.s]?.[2] ?? 174);
    this.bottom = buildBody(this.char, b, chinY);
    this.frameCamera();
  }

  private tick() {
    // Rotation amortie + léger balancement
    this.shownYaw += (this.yaw - this.shownYaw) * 0.2;
    const t = (performance.now() - this.t0) / 1000;
    this.char.rotation.y = this.shownYaw + Math.sin(t * 0.8) * 0.04;
    this.char.position.y = Math.sin(t * 1.6) * 0.015;
    this.renderer.render(this.scene, this.camera);
  }

  /** Image PNG de la vue actuelle. */
  snapshot(): Promise<Blob | null> {
    this.renderer.render(this.scene, this.camera);
    return new Promise((r) => this.canvas.toBlob((b) => r(b), 'image/png'));
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.dispose3D(this.char);
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

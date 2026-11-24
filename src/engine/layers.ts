import { createSurface, type Surface } from './canvas';

export const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity', 'add',
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

export function compositeOp(mode: BlendMode): GlobalCompositeOperation {
  if (mode === 'normal') return 'source-over';
  if (mode === 'add') return 'lighter';
  return mode;
}

let nextLayerId = 1;

export class Layer {
  readonly id = nextLayerId++;
  /** Numéro affiché par défaut (« Calque 3 ») tant que le calque n'est pas renommé. */
  number: number;
  name: string | null = null;
  visible = true;
  /** 0 à 1 */
  opacity = 1;
  blend: BlendMode = 'normal';
  locked = false;
  /** Toile partagée : identifiant du joueur à qui appartient le calque (null = calque local). */
  owner: string | null = null;
  surface: Surface;

  constructor(width: number, height: number, number: number) {
    this.number = number;
    this.surface = createSurface(width, height);
  }

  /** Nouvelle taille ; le contenu est décalé de (dx, dy). */
  resize(width: number, height: number, dx: number, dy: number): void {
    const next = createSurface(width, height);
    next.ctx.drawImage(this.surface.canvas, dx, dy);
    this.surface = next;
  }
}

export type LayerProps = Partial<Pick<Layer, 'name' | 'visible' | 'opacity' | 'blend' | 'locked'>>;

/** Un dessin : taille, fond et pile de calques (index 0 = calque du bas). */
export class DrawingDocument {
  layers: Layer[] = [];
  activeId: number;
  /** Couleur du fond, ou null pour un fond transparent. */
  background: string | null = '#ffffff';
  private counter = 0;

  constructor(public width: number, public height: number) {
    const first = this.createLayer();
    this.layers.push(first);
    this.activeId = first.id;
  }

  get active(): Layer {
    return this.get(this.activeId) ?? this.layers[this.layers.length - 1];
  }

  get(id: number): Layer | undefined {
    return this.layers.find((l) => l.id === id);
  }

  indexOf(id: number): number {
    return this.layers.findIndex((l) => l.id === id);
  }

  /** Crée un calque vide (non inséré). */
  createLayer(): Layer {
    return new Layer(this.width, this.height, ++this.counter);
  }

  insert(layer: Layer, index: number): void {
    this.layers.splice(Math.max(0, Math.min(index, this.layers.length)), 0, layer);
  }

  remove(id: number): { layer: Layer; index: number } | null {
    const index = this.indexOf(id);
    if (index < 0) return null;
    const [layer] = this.layers.splice(index, 1);
    if (this.activeId === id && this.layers.length) {
      this.activeId = this.layers[Math.max(0, index - 1)].id;
    }
    return { layer, index };
  }

  /** Agrandit / rétrécit la toile ; le contenu est décalé de (dx, dy). */
  resize(width: number, height: number, dx: number, dy: number): void {
    for (const l of this.layers) l.resize(width, height, dx, dy);
    this.width = width;
    this.height = height;
  }

  /** Remplace tous les calques (chargement d'un projet). */
  replaceLayers(layers: Layer[], activeIndex: number): void {
    if (!layers.length) return;
    this.layers = layers;
    this.activeId = layers[Math.max(0, Math.min(activeIndex, layers.length - 1))].id;
    this.counter = Math.max(...layers.map((l) => l.number));
  }

  move(id: number, toIndex: number): void {
    const from = this.indexOf(id);
    if (from < 0) return;
    const [layer] = this.layers.splice(from, 1);
    this.layers.splice(Math.max(0, Math.min(toIndex, this.layers.length)), 0, layer);
  }
}

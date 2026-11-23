import type { BrushSettings } from './settings';

export interface InputPoint {
  x: number;
  y: number;
  /** 0 à 1 */
  pressure: number;
  /** Touche Maj enfoncée (contraintes des formes). */
  shift?: boolean;
}

/** Un tampon à poser : centre, diamètre, densité, direction du trait, distance depuis le début. */
export interface Dab {
  x: number;
  y: number;
  size: number;
  alpha: number;
  dir: number;
  dist: number;
}

/**
 * Transforme les points du stylet/doigt/souris en tampons régulièrement espacés :
 * lissage (stabilisateur), interpolation de la pression, espacement selon la taille,
 * affinage du début du trait quand l'appareil n'a pas de pression.
 */
export class StrokeSampler {
  private pos: InputPoint | null = null;
  private raw: InputPoint | null = null;
  /** Distance restante avant le prochain tampon. */
  private remaining = 0;
  private dist = 0;
  private dir = 0;

  constructor(private readonly s: BrushSettings, private readonly simulatePressure = false) {}

  dab(x: number, y: number, pressure: number, dir = 0, dist = Infinity): Dab {
    const p = Math.max(0, Math.min(1, pressure));
    let sizeFactor = this.s.pressureSize ? this.s.minSize + (1 - this.s.minSize) * p : 1;
    if (this.simulatePressure && this.s.taperIn > 0) {
      sizeFactor *= Math.max(0.08, Math.sqrt(Math.min(1, dist / (this.s.taperIn * this.s.size))));
    }
    const alpha = this.s.flow * (this.s.pressureOpacity ? p : 1);
    return { x, y, size: Math.max(0.5, this.s.size * sizeFactor), alpha, dir, dist };
  }

  private step(pressure: number): number {
    return Math.max(0.5, this.dab(0, 0, pressure).size * this.s.spacing);
  }

  begin(p: InputPoint): Dab[] {
    this.pos = { ...p };
    this.raw = { ...p };
    this.dist = 0;
    this.remaining = this.step(p.pressure);
    return [this.dab(p.x, p.y, p.pressure, 0, 0)];
  }

  add(p: InputPoint): Dab[] {
    if (!this.pos) return this.begin(p);
    this.raw = { ...p };
    const k = 1 - Math.max(0, Math.min(0.95, this.s.smoothing));
    const next = {
      x: this.pos.x + (p.x - this.pos.x) * k,
      y: this.pos.y + (p.y - this.pos.y) * k,
      pressure: this.pos.pressure + (p.pressure - this.pos.pressure) * k,
    };
    return this.segment(next);
  }

  /** Fin du trait : rattrape le retard dû au lissage jusqu'au dernier point réel. */
  end(): Dab[] {
    if (!this.pos || !this.raw) return [];
    const dabs = this.segment(this.raw);
    this.pos = null;
    this.raw = null;
    return dabs;
  }

  private segment(to: InputPoint): Dab[] {
    const from = this.pos!;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const dabs: Dab[] = [];
    if (len > 0.01) this.dir = Math.atan2(dy, dx);
    let t = this.remaining;
    while (t <= len) {
      const f = t / len;
      const pr = from.pressure + (to.pressure - from.pressure) * f;
      dabs.push(this.dab(from.x + dx * f, from.y + dy * f, pr, this.dir, this.dist + t));
      t += this.step(pr);
    }
    this.remaining = t - len;
    this.dist += len;
    this.pos = { ...to };
    return dabs;
  }
}

import type { Command } from './history';
import type { Rect } from './geometry';
import { compositeOp, type DrawingDocument, type Layer, type LayerProps } from './layers';

/** Modification de pixels d'un calque : on garde les pixels avant/après de la zone touchée. */
export class PixelPatch implements Command {
  readonly bytes: number;
  constructor(
    readonly label: string,
    private readonly layer: Layer,
    private readonly rect: Rect,
    private readonly before: ImageData,
    private readonly after: ImageData,
  ) {
    this.bytes = rect.w * rect.h * 8;
  }
  undo(): void {
    this.layer.surface.ctx.putImageData(this.before, this.rect.x, this.rect.y);
  }
  affected() {
    return [{ layer: this.layer, rect: this.rect }];
  }
  redo(): void {
    this.layer.surface.ctx.putImageData(this.after, this.rect.x, this.rect.y);
  }
}

export class AddLayer implements Command {
  readonly label = 'addLayer';
  readonly bytes: number;
  constructor(
    private readonly doc: DrawingDocument,
    private readonly layer: Layer,
    private readonly index: number,
    private readonly prevActive: number,
  ) {
    this.bytes = doc.width * doc.height * 4;
  }
  redo(): void {
    this.doc.insert(this.layer, this.index);
    this.doc.activeId = this.layer.id;
  }
  undo(): void {
    this.doc.remove(this.layer.id);
    this.doc.activeId = this.prevActive;
  }
}

export class RemoveLayer implements Command {
  readonly label = 'removeLayer';
  readonly bytes: number;
  private index = -1;
  constructor(private readonly doc: DrawingDocument, private readonly layer: Layer) {
    this.bytes = doc.width * doc.height * 4;
  }
  redo(): void {
    this.index = this.doc.remove(this.layer.id)?.index ?? -1;
  }
  undo(): void {
    this.doc.insert(this.layer, this.index);
    this.doc.activeId = this.layer.id;
  }
}

export class MoveLayer implements Command {
  readonly label = 'moveLayer';
  readonly bytes = 64;
  constructor(
    private readonly doc: DrawingDocument,
    private readonly id: number,
    private readonly from: number,
    private readonly to: number,
  ) {}
  redo(): void {
    this.doc.move(this.id, this.to);
  }
  undo(): void {
    this.doc.move(this.id, this.from);
  }
}

/** Changement de propriétés (opacité, visibilité…). Les changements rapprochés du même réglage sont fusionnés. */
export class SetLayerProps implements Command {
  readonly label = 'layerProps';
  readonly bytes = 64;
  private time = Date.now();
  constructor(
    private readonly layer: Layer,
    private readonly before: LayerProps,
    private after: LayerProps,
  ) {}
  redo(): void {
    Object.assign(this.layer, this.after);
  }
  undo(): void {
    Object.assign(this.layer, this.before);
  }
  merge(next: Command): boolean {
    if (!(next instanceof SetLayerProps) || next.layer !== this.layer) return false;
    const keys = (p: LayerProps) => Object.keys(p).sort().join();
    if (keys(next.after) !== keys(this.after) || keys(this.after) === 'visible' || keys(this.after) === 'locked') {
      return false;
    }
    if (next.time - this.time > 1000) return false;
    this.after = next.after;
    this.time = next.time;
    return true;
  }
}

/** Fusionne un calque dans celui du dessous. */
export class MergeDown implements Command {
  readonly label = 'mergeDown';
  readonly bytes: number;
  private before: ImageData | null = null;
  private after: ImageData | null = null;
  private index = -1;
  constructor(
    private readonly doc: DrawingDocument,
    private readonly upper: Layer,
    private readonly lower: Layer,
  ) {
    this.bytes = doc.width * doc.height * 12;
  }
  redo(): void {
    const { width: w, height: h } = this.doc;
    const ctx = this.lower.surface.ctx;
    if (!this.before) {
      this.before = ctx.getImageData(0, 0, w, h);
      ctx.save();
      ctx.globalAlpha = this.upper.opacity;
      ctx.globalCompositeOperation = compositeOp(this.upper.blend);
      ctx.drawImage(this.upper.surface.canvas, 0, 0);
      ctx.restore();
      this.after = ctx.getImageData(0, 0, w, h);
    } else {
      ctx.putImageData(this.after!, 0, 0);
    }
    this.index = this.doc.remove(this.upper.id)?.index ?? -1;
    this.doc.activeId = this.lower.id;
  }
  undo(): void {
    this.lower.surface.ctx.putImageData(this.before!, 0, 0);
    this.doc.insert(this.upper, this.index);
    this.doc.activeId = this.upper.id;
  }
}

/** Plusieurs commandes annulées / rétablies ensemble. */
export class CompoundCommand implements Command {
  readonly bytes: number;
  constructor(readonly label: string, private readonly parts: Command[]) {
    this.bytes = parts.reduce((n, c) => n + c.bytes, 0);
  }
  undo(): void {
    for (let i = this.parts.length - 1; i >= 0; i--) this.parts[i].undo();
  }
  redo(): void {
    for (const c of this.parts) c.redo();
  }
  affected() {
    return this.parts.flatMap((c) => c.affected?.() ?? []);
  }
}

import type { Editor } from '../engine/editor';
import type { BlendMode, Layer } from '../engine/layers';
import type { ViewTransform } from '../engine/view';
import { createSurface } from '../engine/canvas';
import { base64ToBlob, blobToBase64, ChunkAssembler, splitChunks } from './chunks';
import type { CanvasStore, SavedCanvas } from './canvasStore';
import type { Room } from './room';

/** Pixels d'un calque (découpés en morceaux si besoin). `snap` = copie complète destinée à un nouveau venu. */
interface PatchMsg {
  o: string; s: number; x: number; y: number; w: number; h: number; W: number; H: number;
  id: string; i: number; n: number; d: string; snap?: string;
}
interface LiveMsg { k: number; c: string; w: number; a: number; e: boolean; p: number[]; end?: boolean }
interface SnapLayer { o: string; name: string | null; opacity: number; blend: BlendMode; seq: number }
interface SnapMeta { to: string; width: number; height: number; background: string | null; layers: SnapLayer[] }
interface ResizeMsg { width: number; height: number; dx: number; dy: number }

export type SaveStatus = 'off' | 'idle' | 'saving' | 'saved' | 'unavailable';
export interface ChatLine { from: string; name: string; text: string; at: number }

/** Couleurs des joueurs (mêmes que les avatars). */
export const PEER_COLORS = ['#ff6b4a', '#2bb3a3', '#ffc94a', '#7a8cff', '#ff8fc7', '#7ccf6b'];
export const peerColor = (avatar: number) => PEER_COLORS[avatar % PEER_COLORS.length];

const LIVE_MS = 250; // aperçu des traits : 4 envois / s au plus
const CURSOR_MS = 500; // curseur : 2 envois / s au plus
const SAVE_MS = 15_000;
const SYNC_RETRY_MS = 6000;

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}

/**
 * Relie un éditeur à une salle : un calque par joueur, synchronisé par morceaux d'image
 * (exact quel que soit l'outil), aperçu des traits en direct, curseurs, chat, sauvegarde.
 */
export class SharedSession {
  synced = false;
  saveStatus: SaveStatus;
  cursors = new Map<string, { x: number; y: number; at: number }>();
  live = new Map<string, { key: number; c: string; w: number; a: number; e: boolean; pts: number[]; at: number }>();
  chat: ChatLine[] = [];
  unread = 0;

  private seq = 0;
  private lastSeq = new Map<string, number>();
  private assembler = new ChunkAssembler();
  private buffered: PatchMsg[] = [];
  private snap: { seqs: Map<string, number>; expected: number; got: number } | null = null;
  private chains = new Map<string, Promise<void>>();
  private sendChain: Promise<void> = Promise.resolve();
  private dirty = new Set<string>();
  private metaDirty = false;
  private offs: (() => void)[] = [];
  private timers: ReturnType<typeof setInterval>[] = [];
  private listeners = new Set<() => void>();
  private liveBuf: number[] = [];
  private liveKey = 0;
  private liveTimer: ReturnType<typeof setTimeout> | undefined;
  private lastCursor = 0;
  private cursorTimer: ReturnType<typeof setTimeout> | undefined;
  private sent = { opacity: 1, blend: 'normal' as BlendMode, bg: undefined as string | null | undefined };
  private disposed = false;

  constructor(readonly room: Room, readonly editor: Editor, private readonly store: CanvasStore | null) {
    this.saveStatus = store ? 'idle' : 'off';
  }

  get me(): string {
    return this.room.me.id;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed(): void {
    for (const fn of this.listeners) fn();
  }

  /** Démarre la synchronisation ; `saved` = dernière sauvegarde de la salle (si on la rouvre). */
  start(saved?: { meta: SavedCanvas; images: Map<string, Blob> } | null): Promise<void> {
    const ed = this.editor;
    // Le premier calque du document devient celui du joueur local
    const own = ed.doc.layers[0];
    own.owner = this.me;
    own.name = this.room.me.nickname;
    ed.doc.activeId = own.id;
    this.sent.bg = ed.doc.background;

    const r = this.room;
    this.offs.push(
      r.on('patch', (d, from) => this.onPatch(d as PatchMsg, from)),
      r.on('live', (d, from) => this.onLive(d as LiveMsg, from)),
      r.on('cur', (d, from) => this.onCursor(d as { x: number; y: number } | null, from)),
      r.on('lprops', (d, from) => this.onLayerProps(d as { opacity: number; blend: BlendMode }, from)),
      r.on('bg', (d) => this.onBackground((d as { c: string | null }).c)),
      r.on('sync-req', (_d, from) => this.room.isHost && this.synced && this.sendSnapshot(from)),
      r.on('snap-meta', (d) => this.onSnapMeta(d as SnapMeta)),
      r.on('resize', (d, from) => from === this.room.state.hostId && this.applyResize(d as ResizeMsg)),
      r.on('chat', (d, from) => this.onChat(d as { text: string }, from)),
      r.subscribe(() => this.onRoomChange()),
      ed.subscribePixels((layer, rect) => layer.owner === this.me && this.sendPatch(layer, rect)),
      ed.subscribeStroke((p, b) => this.onLocalStroke(p, b.size, b.opacity, b.mode === 'erase')),
      ed.subscribeHover(() => this.onLocalHover()),
      ed.subscribe(() => this.onEditorChange()),
    );
    ed.externalOverlay = (ctx, view) => this.drawOverlay(ctx, view);

    this.timers.push(setInterval(() => this.autosave(), SAVE_MS));
    this.timers.push(setInterval(() => this.expire(), 2000));

    const ready = saved ? this.applySaved(saved) : Promise.resolve();
    return ready.then(() => {
      if (this.room.isHost) {
        this.synced = true;
      } else {
        this.requestSync();
      }
      this.onRoomChange();
    });
  }

  dispose(): void {
    this.disposed = true;
    for (const off of this.offs) off();
    for (const t of this.timers) clearInterval(t);
    clearTimeout(this.liveTimer);
    clearTimeout(this.cursorTimer);
    this.editor.externalOverlay = null;
  }

  // ---------- Calques ----------

  private layerOf(owner: string): Layer | undefined {
    return this.editor.doc.layers.find((l) => l.owner === owner);
  }

  private ensureLayer(owner: string, name?: string | null): Layer {
    let layer = this.layerOf(owner);
    if (!layer) {
      layer = this.editor.doc.createLayer();
      layer.owner = owner;
      layer.name = name ?? this.room.peers.find((p) => p.id === owner)?.nickname ?? null;
      this.editor.doc.layers.push(layer);
      this.sortLayers();
    }
    return layer;
  }

  /** Ordre des calques = ordre d'arrivée dans la salle (le premier arrivé en bas). */
  private sortLayers(): void {
    const order = this.room.state.members;
    const rank = (l: Layer) => {
      const i = order.indexOf(l.owner ?? '');
      return i < 0 ? order.length : i;
    };
    this.editor.doc.layers.sort((a, b) => rank(a) - rank(b));
  }

  private onRoomChange(): void {
    const peers = this.room.peers;
    for (const l of this.editor.doc.layers) {
      const p = peers.find((q) => q.id === l.owner);
      if (p && l.name !== p.nickname) l.name = p.nickname;
    }
    for (const id of [...this.cursors.keys()]) if (!peers.some((p) => p.id === id)) this.cursors.delete(id);
    this.sortLayers();
    this.editor.notify();
    this.changed();
  }

  // ---------- Envoi ----------

  private sendPatch(layer: Layer, rect: { x: number; y: number; w: number; h: number }, snapTo?: string, seq?: number): void {
    const s = seq ?? ++this.seq;
    const { width: W, height: H } = this.editor.doc;
    // Copie immédiate de la zone (le calque peut encore changer pendant l'encodage)
    const tmp = createSurface(rect.w, rect.h);
    tmp.ctx.drawImage(layer.surface.canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    const owner = layer.owner!;
    if (!snapTo) this.markDirty(owner);
    this.sendChain = this.sendChain.then(async () => {
      if (this.disposed) return;
      const b64 = await blobToBase64(await toPng(tmp.canvas));
      const parts = splitChunks(b64);
      const id = `${this.me.slice(0, 8)}-${s}-${Math.random().toString(36).slice(2, 7)}`;
      parts.forEach((d, i) => {
        const msg: PatchMsg = { o: owner, s, ...rect, W, H, id, i, n: parts.length, d };
        if (snapTo) msg.snap = snapTo;
        this.room.send('patch', msg);
      });
    }).catch(() => {});
    // On efface l'aperçu en direct de ce trait chez soi aussi
    this.live.delete(this.me);
  }

  private onLocalStroke(p: { x: number; y: number } | null, size: number, opacity: number, erase: boolean): void {
    if (p) {
      if (!this.liveKey) this.liveKey = Date.now();
      this.liveBuf.push(Math.round(p.x), Math.round(p.y));
      this.liveTimer ??= setTimeout(() => this.flushLive(size, opacity, erase, false), LIVE_MS);
    } else if (this.liveKey) {
      clearTimeout(this.liveTimer);
      this.flushLive(size, opacity, erase, true);
    }
  }

  private flushLive(size: number, opacity: number, erase: boolean, end: boolean): void {
    this.liveTimer = undefined;
    if (!this.liveBuf.length && !end) return;
    const msg: LiveMsg = { k: this.liveKey, c: this.editor.color, w: size, a: opacity, e: erase, p: this.liveBuf };
    if (end) msg.end = true;
    this.room.send('live', msg);
    // On garde le dernier point pour relier les morceaux
    this.liveBuf = this.liveBuf.length ? this.liveBuf.slice(-2) : [];
    if (end) {
      this.liveBuf = [];
      this.liveKey = 0;
    }
  }

  private onLocalHover(): void {
    clearTimeout(this.cursorTimer);
    const wait = Math.max(0, CURSOR_MS - (Date.now() - this.lastCursor));
    this.cursorTimer = setTimeout(() => {
      this.lastCursor = Date.now();
      const p = this.editor.pointerDoc;
      const { width, height } = this.editor.doc;
      const inside = p && p.x >= 0 && p.y >= 0 && p.x < width && p.y < height;
      this.room.send('cur', inside ? { x: Math.round(p.x), y: Math.round(p.y) } : null);
    }, wait);
  }

  private onEditorChange(): void {
    const own = this.layerOf(this.me);
    if (own && (own.opacity !== this.sent.opacity || own.blend !== this.sent.blend)) {
      this.sent.opacity = own.opacity;
      this.sent.blend = own.blend;
      this.room.send('lprops', { opacity: own.opacity, blend: own.blend });
      this.metaDirty = true;
    }
    const bg = this.editor.doc.background;
    if (bg !== this.sent.bg) {
      this.sent.bg = bg;
      this.room.send('bg', { c: bg });
      this.metaDirty = true;
    }
  }

  sendChat(text: string): void {
    const t = text.trim().slice(0, 300);
    if (!t) return;
    this.room.send('chat', { text: t });
    this.chat.push({ from: this.me, name: this.room.me.nickname, text: t, at: Date.now() });
    this.changed();
  }

  /** Hôte : agrandit la toile (dx, dy = place ajoutée à gauche / en haut). */
  resize(width: number, height: number, dx: number, dy: number): void {
    if (!this.room.isHost) return;
    const msg: ResizeMsg = { width, height, dx, dy };
    this.room.updateSettings({ width, height });
    this.room.send('resize', msg);
    this.applyResize(msg);
  }

  private applyResize(m: ResizeMsg): void {
    this.editor.resizeDocument(m.width, m.height, m.dx, m.dy);
    for (const l of this.editor.doc.layers) if (l.owner) this.markDirty(l.owner);
    this.metaDirty = true;
    this.changed();
  }

  // ---------- Réception ----------

  private onPatch(m: PatchMsg, from: string): void {
    if (m.snap && m.snap !== this.me) return;
    if (!m.snap && m.o !== from) return; // chacun n'écrit que son calque
    const data = this.assembler.add(m.id, m.i, m.n, m.d);
    if (data === null) return;
    const full = { ...m, d: data };
    if (full.snap) this.applyPatch(full, true);
    else if (!this.synced) this.buffered.push(full);
    else this.applyPatch(full, false);
  }

  private applyPatch(m: PatchMsg, isSnap: boolean): void {
    const prev = this.chains.get(m.o) ?? Promise.resolve();
    const next = prev.then(async () => {
      if (this.disposed) return;
      const doc = this.editor.doc;
      if (!isSnap && m.s <= (this.lastSeq.get(m.o) ?? 0)) return;
      if (m.W !== doc.width || m.H !== doc.height) return; // envoyé avant un changement de taille
      const bmp = await createImageBitmap(base64ToBlob(m.d));
      const layer = this.ensureLayer(m.o);
      this.editor.applyRemotePixels(layer, m.x, m.y, bmp, m.w, m.h);
      bmp.close?.();
      if (!isSnap) {
        this.lastSeq.set(m.o, m.s);
        this.live.delete(m.o);
        this.markDirty(m.o);
      }
    }).catch(() => {});
    this.chains.set(m.o, next);
    if (isSnap) next.then(() => this.snapProgress());
  }

  private requestSync(): void {
    if (this.synced || this.disposed) return;
    this.room.send('sync-req', {});
    setTimeout(() => this.requestSync(), SYNC_RETRY_MS);
  }

  /** Hôte : envoie une copie complète de la toile à un joueur qui arrive. */
  private sendSnapshot(to: string): void {
    const doc = this.editor.doc;
    const layers = doc.layers.filter((l) => l.owner);
    const seqOf = (o: string) => (o === this.me ? this.seq : (this.lastSeq.get(o) ?? 0));
    const meta: SnapMeta = {
      to, width: doc.width, height: doc.height, background: doc.background,
      layers: layers.map((l) => ({ o: l.owner!, name: l.name, opacity: l.opacity, blend: l.blend, seq: seqOf(l.owner!) })),
    };
    this.room.send('snap-meta', meta);
    for (const l of layers) this.sendPatch(l, { x: 0, y: 0, w: doc.width, h: doc.height }, to, seqOf(l.owner!));
  }

  private onSnapMeta(m: SnapMeta): void {
    if (m.to !== this.me || this.synced) return;
    const ed = this.editor;
    if (m.width !== ed.doc.width || m.height !== ed.doc.height) ed.resizeDocument(m.width, m.height, 0, 0);
    ed.doc.background = m.background;
    this.sent.bg = m.background;
    for (const l of m.layers) {
      const layer = this.ensureLayer(l.o, l.name);
      layer.opacity = l.opacity;
      layer.blend = l.blend;
    }
    this.snap = { seqs: new Map(m.layers.map((l) => [l.o, l.seq])), expected: m.layers.length, got: 0 };
    if (!m.layers.length) this.finishSync();
  }

  private snapProgress(): void {
    if (!this.snap) return;
    this.snap.got++;
    if (this.snap.got >= this.snap.expected) this.finishSync();
  }

  private finishSync(): void {
    const seqs = this.snap?.seqs ?? new Map<string, number>();
    for (const [o, s] of seqs) this.lastSeq.set(o, s);
    this.seq = Math.max(this.seq, seqs.get(this.me) ?? 0);
    this.snap = null;
    this.synced = true;
    const pending = this.buffered;
    this.buffered = [];
    for (const m of pending) this.applyPatch(m, false);
    this.editor.notify();
    this.changed();
  }

  private onLive(m: LiveMsg, from: string): void {
    const e = this.live.get(from);
    if (!e || e.key !== m.k) this.live.set(from, { key: m.k, c: m.c, w: m.w, a: m.a, e: m.e, pts: [...m.p], at: Date.now() });
    else {
      e.pts.push(...m.p);
      e.at = Date.now();
    }
    this.editor.requestRender();
  }

  private onCursor(p: { x: number; y: number } | null, from: string): void {
    if (p) this.cursors.set(from, { ...p, at: Date.now() });
    else this.cursors.delete(from);
    this.editor.requestRender();
  }

  private onLayerProps(m: { opacity: number; blend: BlendMode }, from: string): void {
    const l = this.layerOf(from);
    if (!l) return;
    l.opacity = m.opacity;
    l.blend = m.blend;
    this.metaDirty = true;
    this.editor.notify();
  }

  private onBackground(c: string | null): void {
    this.sent.bg = c;
    this.editor.doc.background = c;
    this.metaDirty = true;
    this.editor.notify();
  }

  private onChat(m: { text: string }, from: string): void {
    const name = this.room.peers.find((p) => p.id === from)?.nickname ?? '?';
    this.chat.push({ from, name, text: String(m.text).slice(0, 300), at: Date.now() });
    if (this.chat.length > 200) this.chat.shift();
    this.unread++;
    this.changed();
  }

  /** Les aperçus et curseurs sans nouvelles disparaissent. */
  private expire(): void {
    const now = Date.now();
    let any = false;
    for (const [id, l] of this.live) if (now - l.at > 6000) (this.live.delete(id), (any = true));
    for (const [id, c] of this.cursors) if (now - c.at > 20_000) (this.cursors.delete(id), (any = true));
    if (any) this.editor.requestRender();
  }

  // ---------- Affichage ----------

  private drawOverlay(ctx: CanvasRenderingContext2D, view: ViewTransform): void {
    const color = (id: string) => peerColor(this.room.peers.find((p) => p.id === id)?.avatar ?? 0);
    // Traits en cours des autres joueurs (aperçu simplifié)
    ctx.save();
    ctx.transform(...view.matrix());
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [id, l] of this.live) {
      if (id === this.me || l.e || l.pts.length < 2) continue;
      ctx.globalAlpha = l.a;
      ctx.strokeStyle = l.c;
      ctx.lineWidth = l.w;
      ctx.beginPath();
      ctx.moveTo(l.pts[0], l.pts[1]);
      for (let i = 2; i < l.pts.length; i += 2) ctx.lineTo(l.pts[i], l.pts[i + 1]);
      if (l.pts.length === 2) ctx.lineTo(l.pts[0] + 0.1, l.pts[1]);
      ctx.stroke();
    }
    ctx.restore();
    // Curseurs avec le pseudo
    ctx.save();
    ctx.font = '600 12px system-ui, sans-serif';
    for (const [id, c] of this.cursors) {
      const peer = this.room.peers.find((p) => p.id === id);
      if (!peer) continue;
      const s = view.toScreen(c);
      ctx.fillStyle = color(id);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + 4, s.y + 14);
      ctx.lineTo(s.x + 8, s.y + 8);
      ctx.lineTo(s.x + 14, s.y + 5);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      const w = ctx.measureText(peer.nickname).width + 10;
      ctx.beginPath();
      ctx.roundRect(s.x + 12, s.y + 12, w, 18, 9);
      ctx.fill();
      ctx.fillStyle = '#1f2430';
      ctx.fillText(peer.nickname, s.x + 17, s.y + 25);
    }
    ctx.restore();
  }

  // ---------- Sauvegarde (hôte) ----------

  private markDirty(owner: string): void {
    this.dirty.add(owner);
    this.metaDirty = true;
  }

  private async applySaved(saved: { meta: SavedCanvas; images: Map<string, Blob> }): Promise<void> {
    const ed = this.editor;
    const m = saved.meta;
    if (m.width !== ed.doc.width || m.height !== ed.doc.height) ed.resizeDocument(m.width, m.height, 0, 0);
    ed.doc.background = m.background;
    this.sent.bg = m.background;
    for (const l of m.layers) {
      const layer = this.ensureLayer(l.owner, l.name);
      layer.opacity = l.opacity;
      layer.blend = l.blend;
      this.lastSeq.set(l.owner, l.seq);
      if (l.owner === this.me) this.seq = Math.max(this.seq, l.seq);
      const img = saved.images.get(l.owner);
      if (img) {
        const bmp = await createImageBitmap(img);
        layer.surface.ctx.drawImage(bmp, 0, 0);
        bmp.close?.();
      }
    }
    const own = this.layerOf(this.me);
    if (own) {
      this.sent.opacity = own.opacity;
      this.sent.blend = own.blend;
    }
    ed.notify();
  }

  private savingNow = false;
  private retryAt = 0;

  /** Enregistre les calques modifiés puis la description (une seule sauvegarde par salle, remplacée à chaque fois). */
  async autosave(force = false): Promise<void> {
    if (!this.store || !this.room.isHost || !this.synced || this.savingNow) return;
    if (!force && !this.metaDirty && !this.dirty.size) return;
    if (this.saveStatus === 'unavailable' && Date.now() < this.retryAt) return;
    this.savingNow = true;
    this.saveStatus = 'saving';
    this.changed();
    const owners = [...this.dirty];
    this.dirty.clear();
    this.metaDirty = false;
    try {
      const doc = this.editor.doc;
      for (const o of owners) {
        const l = this.layerOf(o);
        if (l) await this.store.saveLayer(this.room.code, o, await toPng(l.surface.canvas));
      }
      const layers = doc.layers.filter((l) => l.owner);
      await this.store.saveMeta(this.room.code, {
        v: 1, width: doc.width, height: doc.height, background: doc.background, savedAt: Date.now(),
        layers: layers.map((l) => ({
          owner: l.owner!, name: l.name, opacity: l.opacity, blend: l.blend,
          seq: l.owner === this.me ? this.seq : (this.lastSeq.get(l.owner!) ?? 0),
        })),
      });
      this.saveStatus = 'saved';
    } catch {
      for (const o of owners) this.dirty.add(o);
      this.metaDirty = true;
      this.saveStatus = 'unavailable';
      this.retryAt = Date.now() + 60_000;
    }
    this.savingNow = false;
    this.changed();
  }
}

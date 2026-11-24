import type { PeerInfo, Transport, TransportFactory } from './transport';

export const MAX_PLAYERS = 8;
/** Délai avant d'élire un nouvel hôte quand l'hôte disparaît (évite les micro-coupures). */
export const HOST_GRACE_MS = 2500;
const JOIN_TIMEOUT_MS = 6000;

export interface RoomSettings {
  /** Taille de la toile partagée */
  width: number;
  height: number;
  background: string | null;
  /** Salle verrouillée : plus de nouveaux joueurs */
  locked: boolean;
  /** Empreinte du mot de passe (null = pas de mot de passe) */
  passwordHash: string | null;
}

/** État de la salle, tenu par l'hôte et copié chez tous les joueurs. */
export interface RoomState {
  hostId: string;
  settings: RoomSettings;
  /** Joueurs déjà acceptés (ils peuvent revenir même si la salle est verrouillée) */
  members: string[];
  banned: string[];
  version: number;
}

export type RoomStatus = 'joined' | 'reconnecting' | 'left' | 'kicked';
export type RejectReason = 'notFound' | 'full' | 'locked' | 'password' | 'banned' | 'network';

export class JoinError extends Error {
  constructor(readonly reason: RejectReason) {
    super(reason);
  }
}

// Messages internes
interface Hello { peer: PeerInfo; pass: string | null }
interface Welcome { to: string; state: RoomState }
interface Reject { to: string; reason: RejectReason }

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Code de salle de 6 caractères, sans caractères ambigus (0/O, 1/I/L). */
export function generateCode(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
  return s;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function isValidCode(code: string): boolean {
  return code.length === 6 && [...code].every((c) => CODE_CHARS.includes(c));
}

export async function hashPassword(code: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`drawingtogether:${code}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Choix déterministe du nouvel hôte : le joueur arrivé le plus tôt. */
export function electHost(peers: PeerInfo[]): PeerInfo | undefined {
  return [...peers].sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1))[0];
}

type Handler = (data: unknown, from: string) => void;

/**
 * Une salle multijoueur : présence des joueurs, hôte, règles d'entrée.
 * Les messages de l'application (traits…) passent par send() / on().
 */
export class Room {
  status: RoomStatus = 'joined';
  /** Joueurs présents (présence confirmée + ceux que l'hôte vient d'accepter). */
  peers: PeerInfo[] = [];
  /** Présence telle que rapportée par le réseau */
  private present: PeerInfo[] = [];
  state: RoomState;
  private listeners = new Set<() => void>();
  private handlers = new Map<string, Set<Handler>>();
  private electionTimer: ReturnType<typeof setTimeout> | undefined;
  /** Joueurs acceptés mais pas encore visibles dans la présence (affichés tout de suite, comptés pour la limite). */
  private pending = new Map<string, { peer: PeerInfo; at: number }>();
  private offs: (() => void)[] = [];

  private constructor(readonly code: string, readonly me: PeerInfo, private readonly t: Transport, state: RoomState) {
    this.state = state;
    this.offs.push(
      t.onMessage((type, data, from) => this.onMessage(type, data, from)),
      t.onPresence((peers) => this.onPresence(peers)),
      t.onStatus((s) => {
        if (this.status === 'left' || this.status === 'kicked') return;
        if (s === 'reconnecting') this.status = 'reconnecting';
        else if (s === 'connected') this.status = 'joined';
        this.changed();
      }),
    );
  }

  /** Crée une salle et en devient l'hôte. */
  static async create(factory: TransportFactory, code: string, me: PeerInfo, settings: RoomSettings): Promise<Room> {
    const t = factory(code, me.id);
    await t.connect();
    const room = new Room(code, me, t, { hostId: me.id, settings, members: [me.id], banned: [], version: 1 });
    await t.track(me);
    return room;
  }

  /** Rejoint une salle existante ; échoue avec JoinError (salle introuvable, pleine, verrouillée…). */
  static async join(factory: TransportFactory, code: string, me: PeerInfo, password: string | null): Promise<Room> {
    const t = factory(code, me.id);
    try {
      await t.connect();
    } catch {
      t.close();
      throw new JoinError('network');
    }
    const pass = password ? await hashPassword(code, password) : null;
    const state = await new Promise<RoomState>((resolve, reject) => {
      const timer = setTimeout(() => done(() => reject(new JoinError('notFound'))), JOIN_TIMEOUT_MS);
      const off = t.onMessage((type, data) => {
        if (type === 'room:welcome' && (data as Welcome).to === me.id) done(() => resolve((data as Welcome).state));
        if (type === 'room:reject' && (data as Reject).to === me.id) done(() => reject(new JoinError((data as Reject).reason)));
      });
      function done(f: () => void) {
        clearTimeout(timer);
        off();
        f();
      }
      t.send('room:hello', { peer: me, pass } satisfies Hello);
    }).catch((e) => {
      t.close();
      throw e;
    });
    const room = new Room(code, me, t, state);
    await t.track(me);
    return room;
  }

  get isHost(): boolean {
    return this.state.hostId === this.me.id;
  }

  get host(): PeerInfo | undefined {
    return this.peers.find((p) => p.id === this.state.hostId);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed(): void {
    for (const fn of this.listeners) fn();
  }

  // ---------- Messages de l'application ----------

  send(type: string, data: unknown): void {
    this.t.send(`app:${type}`, data);
  }

  on(type: string, fn: Handler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }

  // ---------- Actions de l'hôte ----------

  private updateState(patch: Partial<RoomState>): void {
    if (!this.isHost) return;
    this.state = { ...this.state, ...patch, version: this.state.version + 1 };
    this.t.send('room:state', this.state);
    this.changed();
  }

  setLocked(locked: boolean): void {
    this.updateState({ settings: { ...this.state.settings, locked } });
  }

  async setPassword(password: string | null): Promise<void> {
    const passwordHash = password ? await hashPassword(this.code, password) : null;
    this.updateState({ settings: { ...this.state.settings, passwordHash } });
  }

  updateSettings(patch: Partial<RoomSettings>): void {
    this.updateState({ settings: { ...this.state.settings, ...patch } });
  }

  kick(id: string): void {
    if (!this.isHost || id === this.me.id) return;
    this.updateState({ banned: [...this.state.banned, id], members: this.state.members.filter((m) => m !== id) });
    this.t.send('room:kick', { id });
  }

  transferHost(id: string): void {
    if (this.peers.some((p) => p.id === id)) this.updateState({ hostId: id });
  }

  leave(): void {
    if (this.status === 'left') return;
    this.status = 'left';
    this.dispose();
    this.changed();
  }

  private dispose(): void {
    clearTimeout(this.electionTimer);
    for (const off of this.offs) off();
    this.t.close();
  }

  // ---------- Réception ----------

  private onMessage(type: string, data: unknown, from: string): void {
    if (type.startsWith('app:')) {
      for (const fn of this.handlers.get(type.slice(4)) ?? []) fn(data, from);
      return;
    }
    switch (type) {
      case 'room:hello':
        if (this.isHost) this.admit(data as Hello);
        break;
      case 'room:state': {
        const s = data as RoomState;
        // On garde l'état le plus récent ; à égalité, l'hôte le plus ancien l'emporte.
        if (s.version > this.state.version || (s.version === this.state.version && s.hostId < this.state.hostId)) {
          this.state = s;
          if (s.banned.includes(this.me.id)) this.kicked();
          this.changed();
        }
        break;
      }
      case 'room:kick':
        if ((data as { id: string }).id === this.me.id && from === this.state.hostId) this.kicked();
        break;
    }
  }

  private admit({ peer, pass }: Hello): void {
    const reply = (reason: RejectReason | null) => {
      if (reason) this.t.send('room:reject', { to: peer.id, reason } satisfies Reject);
      else this.t.send('room:welcome', { to: peer.id, state: this.state } satisfies Welcome);
    };
    const s = this.state;
    if (s.banned.includes(peer.id)) return reply('banned');
    if (s.members.includes(peer.id)) return reply(null); // retour après une coupure / un rechargement
    if (s.settings.locked) return reply('locked');
    if (s.settings.passwordHash && pass !== s.settings.passwordHash) return reply('password');
    this.prunePending();
    if (this.peers.length >= MAX_PLAYERS) return reply('full');
    this.pending.set(peer.id, { peer, at: Date.now() });
    this.updateState({ members: [...s.members, peer.id] });
    this.mergePeers();
    reply(null);
  }

  private prunePending(): void {
    const now = Date.now();
    for (const [id, { at }] of this.pending) {
      if (now - at > 15_000 || this.present.some((p) => p.id === id)) this.pending.delete(id);
    }
  }

  private mergePeers(): void {
    this.prunePending();
    const extra = [...this.pending.values()].map((v) => v.peer).filter((p) => !this.present.some((q) => q.id === p.id));
    this.peers = [...this.present, ...extra].sort((a, b) => a.joinedAt - b.joinedAt);
  }

  private onPresence(peers: PeerInfo[]): void {
    this.present = peers;
    this.mergePeers();
    clearTimeout(this.electionTimer);
    if (!this.present.some((p) => p.id === this.state.hostId)) {
      this.electionTimer = setTimeout(() => this.elect(), HOST_GRACE_MS);
    }
    this.changed();
  }

  /** L'hôte est parti : le joueur arrivé le plus tôt prend le relais. */
  private elect(): void {
    if (this.present.some((p) => p.id === this.state.hostId)) return;
    const next = electHost(this.present);
    if (next?.id !== this.me.id) return;
    this.state = { ...this.state, hostId: this.me.id, version: this.state.version + 1 };
    this.t.send('room:state', this.state);
    this.changed();
  }

  private kicked(): void {
    if (this.status === 'kicked') return;
    this.status = 'kicked';
    this.dispose();
    this.changed();
  }
}

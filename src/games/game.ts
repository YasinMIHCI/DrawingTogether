import { ChunkAssembler, splitChunks } from '../net/chunks';
import type { Room } from '../net/room';
import { authorOf, chainFor, DEFAULT_CONFIG, getMode, roundsFor, stepTime, type GameConfig, type StepKind } from './modes';

export interface GamePlayer {
  id: string;
  nickname: string;
  avatar: number;
  avatarUrl?: string | null;
}

/** Contribution d'un joueur : texte, image (PNG en base64) ou rien (temps écoulé, joueur parti). */
export interface Entry {
  kind: 'text' | 'image' | 'empty';
  data: string;
  author: string;
}

export type Phase = 'lobby' | 'play' | 'album';

export interface GameState {
  id: string;
  config: GameConfig;
  players: GamePlayer[];
  rounds: number;
  round: number;
  phase: Phase;
  /** Position dans l'album, que l'hôte fait défiler pour tout le monde */
  album: { chain: number; step: number };
  /** Graine des éléments tirés au hasard (gribouillis, idées) */
  seed: number;
}

export interface Task {
  chain: number;
  round: number;
  kind: StepKind;
  /** Contributions précédentes de la chaîne (de la plus ancienne à la plus récente) */
  history: Entry[];
}

interface SubMsg { g: string; c: number; r: number; k: Entry['kind']; a: string; id: string; i: number; n: number; d: string; to?: string }

/** Délai de grâce après la fin du chrono (le temps que les dernières contributions arrivent). */
export const GRACE_MS = 4000;

const key = (chain: number, round: number) => `${chain}:${round}`;

/**
 * Partie de jeu dans une salle. L'hôte mène les tours ; tout le monde garde une copie
 * de l'état et des contributions, si bien qu'un autre joueur peut reprendre si l'hôte part.
 */
export class Game {
  config: GameConfig = { ...DEFAULT_CONFIG };
  state: GameState | null = null;
  entries = new Map<string, Entry>();
  /** Fin du tour en cours (horloge locale), null = pas de chrono */
  deadline: number | null = null;
  reactions: { emoji: string; from: string; at: number }[] = [];

  private assembler = new ChunkAssembler();
  private listeners = new Set<() => void>();
  private offs: (() => void)[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private wasHost: boolean;

  constructor(readonly room: Room) {
    this.wasHost = room.isHost;
    const on = (type: string, fn: (d: never, from: string) => void) => this.offs.push(room.on(type, fn as never));
    on('g:cfg', (d: { config: GameConfig }, from) => from === room.state.hostId && this.set(() => (this.config = d.config)));
    on('g:start', (d: { state: GameState }, from) => from === room.state.hostId && this.onStart(d.state));
    on('g:round', (d: { id: string; round: number; endsIn: number }, from) => from === room.state.hostId && this.onRound(d));
    on('g:sub', (d: SubMsg) => this.onSub(d));
    on('g:album', (d: { id: string; album: GameState['album'] }, from) => from === room.state.hostId && this.onAlbum(d));
    on('g:lobby', (_d: unknown, from) => from === room.state.hostId && this.onLobby());
    on('g:react', (d: { e: string }, from) => this.onReact(d.e, from));
    on('g:sync-req', (_d: unknown, from) => room.isHost && this.sendSync(from));
    on('g:sync', (d: { to: string; config: GameConfig; state: GameState | null; endsIn: number | null }) => d.to === room.me.id && this.onSync(d));
    this.offs.push(room.subscribe(() => this.onRoomChange()));
    if (!room.isHost) room.send('g:sync-req', {});
  }

  dispose(): void {
    clearTimeout(this.timer);
    for (const off of this.offs) off();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(f: () => void): void {
    f();
    for (const fn of this.listeners) fn();
  }

  // ---------- Infos ----------

  get me(): string {
    return this.room.me.id;
  }

  /** Index du joueur local dans la partie (-1 = spectateur). */
  get myIndex(): number {
    return this.state?.players.findIndex((p) => p.id === this.me) ?? -1;
  }

  entry(chain: number, round: number): Entry | undefined {
    return this.entries.get(key(chain, round));
  }

  /** Ce que le joueur local doit faire à ce tour (null = rien : spectateur, hors partie). */
  task(): Task | null {
    const s = this.state;
    if (!s || s.phase !== 'play' || this.myIndex < 0) return null;
    const n = s.players.length;
    const chain = chainFor(this.myIndex, s.round, n);
    const history: Entry[] = [];
    for (let r = 0; r < s.round; r++) history.push(this.entry(chain, r) ?? { kind: 'empty', data: '', author: '' });
    return { chain, round: s.round, kind: getMode(s.config.mode).step(s.round), history };
  }

  hasSubmitted(round = this.state?.round ?? -1): boolean {
    const t = this.state && this.myIndex >= 0 ? chainFor(this.myIndex, round, this.state.players.length) : -1;
    return t >= 0 && this.entries.has(key(t, round));
  }

  /** Nombre de contributions reçues pour le tour en cours. */
  submittedCount(): number {
    const s = this.state;
    if (!s) return 0;
    let k = 0;
    for (let c = 0; c < s.players.length; c++) if (this.entries.has(key(c, s.round))) k++;
    return k;
  }

  // ---------- Actions de l'hôte ----------

  setConfig(patch: Partial<GameConfig>): void {
    if (!this.room.isHost) return;
    this.set(() => (this.config = { ...this.config, ...patch }));
    this.room.send('g:cfg', { config: this.config });
  }

  start(): void {
    if (!this.room.isHost) return;
    const players = this.room.peers.map((p) => ({ id: p.id, nickname: p.nickname, avatar: p.avatar, avatarUrl: p.avatarUrl ?? null }));
    const state: GameState = {
      id: Math.random().toString(36).slice(2, 10),
      config: { ...this.config },
      players,
      rounds: roundsFor(this.config, players.length),
      round: 0,
      phase: 'play',
      album: { chain: 0, step: 0 },
      seed: Math.floor(Math.random() * 2 ** 31),
    };
    this.room.send('g:start', { state });
    this.onStart(state);
    this.beginRound(0);
  }

  private beginRound(round: number): void {
    const s = this.state;
    if (!s) return;
    const ms = stepTime(s.config, getMode(s.config.mode).step(round)) * 1000;
    this.room.send('g:round', { id: s.id, round, endsIn: ms });
    this.onRound({ id: s.id, round, endsIn: ms });
    this.armTimer(ms);
  }

  private armTimer(ms: number): void {
    clearTimeout(this.timer);
    if (ms > 0) this.timer = setTimeout(() => this.finishRound(), ms + GRACE_MS);
  }

  /** Hôte : passe à la suite sans attendre (ou fin du chrono). */
  finishRound(): void {
    const s = this.state;
    if (!this.room.isHost || !s || s.phase !== 'play') return;
    clearTimeout(this.timer);
    if (s.round + 1 < s.rounds) this.beginRound(s.round + 1);
    else this.showAlbum({ chain: 0, step: 0 });
  }

  showAlbum(album: GameState['album']): void {
    if (!this.room.isHost || !this.state) return;
    this.room.send('g:album', { id: this.state.id, album });
    this.onAlbum({ id: this.state.id, album });
  }

  backToLobby(): void {
    if (!this.room.isHost) return;
    this.room.send('g:lobby', {});
    this.onLobby();
  }

  // ---------- Actions de tous ----------

  /** Envoie sa contribution pour le tour en cours. */
  submit(kind: Entry['kind'], data: string): void {
    const t = this.task();
    const s = this.state;
    if (!t || !s) return;
    this.store(t.chain, t.round, { kind, data, author: this.me });
    this.sendEntry(s.id, t.chain, t.round, { kind, data, author: this.me });
  }

  react(emoji: string): void {
    this.room.send('g:react', { e: emoji });
    this.onReact(emoji, this.me);
  }

  private sendEntry(game: string, c: number, r: number, e: Entry, to?: string): void {
    const parts = splitChunks(e.data);
    const id = `${this.me.slice(0, 6)}-${c}-${r}-${Math.random().toString(36).slice(2, 6)}`;
    parts.forEach((d, i) => {
      const m: SubMsg = { g: game, c, r, k: e.kind, a: e.author, id, i, n: parts.length, d };
      if (to) m.to = to;
      this.room.send('g:sub', m);
    });
  }

  // ---------- Réception ----------

  private onStart(state: GameState): void {
    this.entries.clear();
    this.reactions = [];
    this.set(() => {
      this.state = state;
      this.config = state.config;
    });
  }

  private onRound(d: { id: string; round: number; endsIn: number }): void {
    if (!this.state || d.id !== this.state.id) return;
    this.set(() => {
      this.state!.round = d.round;
      this.state!.phase = 'play';
      this.deadline = d.endsIn > 0 ? Date.now() + d.endsIn : null;
    });
  }

  private onSub(m: SubMsg): void {
    if (m.to && m.to !== this.me) return;
    if (!this.state || m.g !== this.state.id) return;
    const data = this.assembler.add(m.id, m.i, m.n, m.d);
    if (data === null) return;
    this.store(m.c, m.r, { kind: m.k, data, author: m.a });
  }

  private store(chain: number, round: number, e: Entry): void {
    // Un joueur ne remplit que la case qui lui revient
    const s = this.state;
    if (!s) return;
    const expected = s.players[authorOf(chain, round, s.players.length)]?.id;
    if (expected !== e.author) return;
    this.set(() => this.entries.set(key(chain, round), e));
    if (this.room.isHost && s.phase === 'play' && round === s.round && this.everyoneDone()) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.finishRound(), 600);
    }
  }

  /** Tous les joueurs encore présents ont rendu leur contribution. */
  private everyoneDone(): boolean {
    const s = this.state!;
    const n = s.players.length;
    return s.players.every((p, i) => !this.room.peers.some((q) => q.id === p.id) || this.entries.has(key(chainFor(i, s.round, n), s.round)));
  }

  private onAlbum(d: { id: string; album: GameState['album'] }): void {
    if (!this.state || d.id !== this.state.id) return;
    clearTimeout(this.timer);
    this.set(() => {
      this.state!.phase = 'album';
      this.state!.album = d.album;
      this.deadline = null;
    });
  }

  private onLobby(): void {
    clearTimeout(this.timer);
    this.set(() => {
      if (this.state) this.state.phase = 'lobby';
      this.deadline = null;
    });
  }

  private onReact(emoji: string, from: string): void {
    if (!['👍', '😂', '😮', '❤️', '🔥', '👏'].includes(emoji)) return;
    this.set(() => {
      this.reactions = [...this.reactions.filter((r) => Date.now() - r.at < 4000), { emoji, from, at: Date.now() }];
    });
  }

  private sendSync(to: string): void {
    const s = this.state;
    const endsIn = this.deadline ? Math.max(0, this.deadline - Date.now()) : null;
    this.room.send('g:sync', { to, config: this.config, state: s, endsIn });
    if (s) for (const [k, e] of this.entries) {
      const [c, r] = k.split(':').map(Number);
      this.sendEntry(s.id, c, r, e, to);
    }
  }

  private onSync(d: { config: GameConfig; state: GameState | null; endsIn: number | null }): void {
    this.set(() => {
      this.config = d.config;
      if (d.state && (!this.state || this.state.id !== d.state.id)) this.entries.clear();
      this.state = d.state;
      this.deadline = d.endsIn ? Date.now() + d.endsIn : null;
    });
  }

  /** L'hôte est parti : le nouvel hôte reprend le chrono du tour en cours. */
  private onRoomChange(): void {
    const s = this.state;
    if (this.room.isHost && !this.wasHost && s?.phase === 'play') {
      if (this.everyoneDone()) this.finishRound();
      else if (this.deadline) this.armTimer(Math.max(0, this.deadline - Date.now()));
    }
    this.wasHost = this.room.isHost;
    if (this.room.isHost && s?.phase === 'play' && this.everyoneDone()) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.finishRound(), 600);
    }
    for (const fn of this.listeners) fn();
  }
}

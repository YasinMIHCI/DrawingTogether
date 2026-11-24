import { describe, expect, it } from 'vitest';
import { authorOf, chainFor, DEFAULT_CONFIG, getMode, MODES, roundsFor, stepTime } from '../src/games/modes';
import { fr } from '../src/lib/i18n/fr';

describe('game rotation', () => {
  it('each player works on a different chain every round, and each chain sees every player', () => {
    const n = 5;
    for (let r = 0; r < n; r++) {
      const chains = new Set(Array.from({ length: n }, (_, p) => chainFor(p, r, n)));
      expect(chains.size).toBe(n);
    }
    for (let c = 0; c < n; c++) {
      const authors = new Set(Array.from({ length: n }, (_, r) => authorOf(c, r, n)));
      expect(authors.size).toBe(n);
    }
  });
  it('authorOf is the inverse of chainFor', () => {
    for (let p = 0; p < 4; p++) for (let r = 0; r < 7; r++) expect(authorOf(chainFor(p, r, 4), r, 4)).toBe(p);
  });
});

describe('modes', () => {
  it('have translated names and descriptions', () => {
    for (const m of MODES) {
      expect(fr).toHaveProperty(m.name);
      expect(fr).toHaveProperty(m.desc);
    }
  });
  it('classic alternates write / draw starting with write', () => {
    const m = getMode('classic');
    expect([0, 1, 2, 3].map(m.step)).toEqual(['write', 'draw', 'write', 'draw']);
  });
  it('computes rounds and times from config', () => {
    expect(roundsFor({ ...DEFAULT_CONFIG, mode: 'classic' }, 4)).toBe(4);
    expect(roundsFor({ ...DEFAULT_CONFIG, mode: 'atelier' }, 6)).toBe(1);
    expect(roundsFor({ ...DEFAULT_CONFIG, rounds: 3 }, 8)).toBe(3);
    expect(stepTime({ ...DEFAULT_CONFIG, mode: 'atelier' }, 'draw')).toBe(0);
    expect(stepTime({ ...DEFAULT_CONFIG, drawTime: 30 }, 'draw')).toBe(30);
  });
});

import { vi } from 'vitest';
import { MemoryBus } from '../src/net/memoryTransport';
import { Room, type RoomSettings } from '../src/net/room';
import { Game } from '../src/games/game';

const settings: RoomSettings = { width: 10, height: 10, background: null, locked: false, passwordHash: null };
let t0 = 0;
const peer = (name: string) => ({ id: `${name}-id`, nickname: name, avatar: 0, joinedAt: ++t0 });

describe('Game (chain story, 3 players)', () => {
  it('runs every round, rotates chains and ends in the album', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const bus = new MemoryBus();
    const host = await Room.create(bus.factory(), 'GAME01', peer('ana'), settings);
    const b = await Room.join(bus.factory(), 'GAME01', peer('bob'), null);
    const c = await Room.join(bus.factory(), 'GAME01', peer('cyd'), null);
    await vi.advanceTimersByTimeAsync(0);
    const games = [new Game(host), new Game(b), new Game(c)];
    games[0].setConfig({ mode: 'story' });
    await vi.advanceTimersByTimeAsync(0);
    expect(games[2].config.mode).toBe('story');
    games[0].start();
    await vi.advanceTimersByTimeAsync(0);
    const rounds = games[0].state!.rounds;
    expect(rounds).toBe(3);
    for (let r = 0; r < rounds; r++) {
      for (const g of games) {
        const task = g.task()!;
        expect(task.round).toBe(r);
        expect(task.history.length).toBe(r);
        if (r > 0) expect(task.history[r - 1].kind).toBe('text');
        g.submit('text', `${g.room.me.nickname}-r${r}`);
      }
      await vi.advanceTimersByTimeAsync(700);
    }
    for (const g of games) expect(g.state!.phase).toBe('album');
    // La chaîne 0 a été écrite par ana, puis cyd, puis bob (rotation)
    expect([0, 1, 2].map((r) => games[1].entry(0, r)!.data)).toEqual(['ana-r0', 'cyd-r1', 'bob-r2']);
    vi.useRealTimers();
  });

  it('times out missing players and lets a new host take over', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const bus = new MemoryBus();
    const host = await Room.create(bus.factory(), 'GAME02', peer('h'), settings);
    const b = await Room.join(bus.factory(), 'GAME02', peer('b'), null);
    await vi.advanceTimersByTimeAsync(0);
    const gh = new Game(host);
    const gb = new Game(b);
    gh.setConfig({ mode: 'classic', writeTime: 10, rounds: 2 });
    gh.start();
    await vi.advanceTimersByTimeAsync(0);
    gb.submit('text', 'un chat');
    host.leave(); // l'hôte part sans rien rendre
    await vi.advanceTimersByTimeAsync(10_000 + 3000);
    expect(b.isHost).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(gb.state!.round).toBe(1);
    expect(gb.task()!.kind).toBe('draw');
    vi.useRealTimers();
  });
});

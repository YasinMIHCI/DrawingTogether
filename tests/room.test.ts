import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryBus } from '../src/net/memoryTransport';
import { electHost, generateCode, isValidCode, JoinError, normalizeCode, Room, HOST_GRACE_MS, type RoomSettings } from '../src/net/room';
import type { PeerInfo } from '../src/net/transport';

const settings: RoomSettings = { width: 100, height: 100, background: '#ffffff', locked: false, passwordHash: null };
let n = 0;
const peer = (name: string): PeerInfo => ({ id: `${name}-${n}`, nickname: name, avatar: 0, joinedAt: ++n });
const flush = () => new Promise((r) => setTimeout(r, 0));
const reason = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e as JoinError).reason);

afterEach(() => vi.useRealTimers());

describe('room codes', () => {
  it('generates and validates codes', () => {
    const c = generateCode();
    expect(isValidCode(c)).toBe(true);
    expect(normalizeCode(' ab-c12 3x')).toBe('ABC123');
    expect(isValidCode('ABC10O')).toBe(false);
  });
  it('elects the earliest player', () => {
    expect(electHost([{ id: 'b', nickname: '', avatar: 0, joinedAt: 5 }, { id: 'a', nickname: '', avatar: 0, joinedAt: 3 }])?.id).toBe('a');
  });
});

describe('Room', () => {
  it('lets players join, see each other and exchange messages', async () => {
    const bus = new MemoryBus();
    const host = await Room.create(bus.factory(), 'ROOM01', peer('host'), settings);
    const guest = await Room.join(bus.factory(), 'ROOM01', peer('guest'), null);
    await flush();
    expect(host.peers.map((p) => p.nickname)).toEqual(['host', 'guest']);
    expect(guest.isHost).toBe(false);
    expect(guest.state.settings.width).toBe(100);
    const got: unknown[] = [];
    host.on('stroke', (d) => got.push(d));
    guest.send('stroke', { x: 1 });
    await flush();
    expect(got).toEqual([{ x: 1 }]);
  });

  it('rejects: unknown room, wrong password, locked, full, banned', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const bus = new MemoryBus();
    const missing = reason(Room.join(bus.factory(), 'NOROOM', peer('x'), null));
    await vi.advanceTimersByTimeAsync(7000);
    expect(await missing).toBe('notFound');
    vi.useRealTimers();

    const host = await Room.create(bus.factory(), 'ROOM02', peer('host'), settings);
    await host.setPassword('secret');
    expect(await reason(Room.join(bus.factory(), 'ROOM02', peer('a'), 'nope'))).toBe('password');
    expect(await reason(Room.join(bus.factory(), 'ROOM02', peer('b'), 'secret'))).toBe('ok');
    host.setLocked(true);
    expect(await reason(Room.join(bus.factory(), 'ROOM02', peer('c'), 'secret'))).toBe('locked');
    host.setLocked(false);
    for (let i = 0; i < 6; i++) await Room.join(bus.factory(), 'ROOM02', peer(`p${i}`), 'secret');
    await flush();
    expect(host.peers.length).toBe(8);
    expect(await reason(Room.join(bus.factory(), 'ROOM02', peer('ninth'), 'secret'))).toBe('full');
  });

  it('kicks a player and refuses their return; a member can come back even if locked', async () => {
    const bus = new MemoryBus();
    const host = await Room.create(bus.factory(), 'ROOM03', peer('host'), settings);
    const meA = peer('a');
    const meB = peer('b');
    const a = await Room.join(bus.factory(), 'ROOM03', meA, null);
    const b = await Room.join(bus.factory(), 'ROOM03', meB, null);
    await flush();
    host.kick(meA.id);
    await flush();
    expect(a.status).toBe('kicked');
    expect(await reason(Room.join(bus.factory(), 'ROOM03', meA, null))).toBe('banned');
    host.setLocked(true);
    b.leave();
    await flush();
    expect(await reason(Room.join(bus.factory(), 'ROOM03', meB, null))).toBe('ok');
  });

  it('elects a new host when the host leaves, and supports handing over', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const bus = new MemoryBus();
    const host = await Room.create(bus.factory(), 'ROOM04', peer('host'), settings);
    const a = await Room.join(bus.factory(), 'ROOM04', peer('a'), null);
    const b = await Room.join(bus.factory(), 'ROOM04', peer('b'), null);
    await vi.advanceTimersByTimeAsync(0);
    host.transferHost(b.me.id);
    await vi.advanceTimersByTimeAsync(0);
    expect(b.isHost).toBe(true);
    expect(a.state.hostId).toBe(b.me.id);
    b.leave();
    await vi.advanceTimersByTimeAsync(HOST_GRACE_MS + 100);
    // Le plus ancien des restants (l'ancien hôte) reprend la main
    expect(host.isHost).toBe(true);
    expect(a.state.hostId).toBe(host.me.id);
  });
});

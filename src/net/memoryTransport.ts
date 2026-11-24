import type { PeerInfo, Transport, TransportFactory, TransportStatus } from './transport';

/** Réseau simulé en mémoire, pour les tests : plusieurs « clients » sur le même bus. */
export class MemoryBus {
  private members = new Map<string, Set<MemoryTransport>>();
  presence = new Map<string, Map<string, PeerInfo>>();

  factory(): TransportFactory {
    return (room, selfId) => new MemoryTransport(this, room, selfId);
  }

  join(room: string, t: MemoryTransport): void {
    if (!this.members.has(room)) this.members.set(room, new Set());
    this.members.get(room)!.add(t);
  }

  leave(room: string, t: MemoryTransport): void {
    this.members.get(room)?.delete(t);
    this.presence.get(room)?.delete(t.selfId);
    this.syncPresence(room);
  }

  broadcast(room: string, from: MemoryTransport, type: string, data: unknown): void {
    for (const t of this.members.get(room) ?? []) {
      if (t !== from) queueMicrotask(() => t.deliver(type, structuredClone(data), from.selfId));
    }
  }

  track(room: string, info: PeerInfo): void {
    if (!this.presence.has(room)) this.presence.set(room, new Map());
    this.presence.get(room)!.set(info.id, info);
    this.syncPresence(room);
  }

  private syncPresence(room: string): void {
    const peers = [...(this.presence.get(room)?.values() ?? [])];
    for (const t of this.members.get(room) ?? []) queueMicrotask(() => t.presence(peers.map((p) => ({ ...p }))));
  }
}

class MemoryTransport implements Transport {
  private msg = new Set<(type: string, data: unknown, from: string) => void>();
  private pres = new Set<(peers: PeerInfo[]) => void>();
  private stat = new Set<(s: TransportStatus) => void>();

  constructor(private readonly bus: MemoryBus, private readonly room: string, readonly selfId: string) {}

  async connect(): Promise<void> {
    this.bus.join(this.room, this);
    for (const fn of this.stat) fn('connected');
  }
  send(type: string, data: unknown): void {
    this.bus.broadcast(this.room, this, type, data);
  }
  onMessage(fn: (type: string, data: unknown, from: string) => void): () => void {
    this.msg.add(fn);
    return () => this.msg.delete(fn);
  }
  async track(info: PeerInfo): Promise<void> {
    this.bus.track(this.room, info);
  }
  onPresence(fn: (peers: PeerInfo[]) => void): () => void {
    this.pres.add(fn);
    return () => this.pres.delete(fn);
  }
  onStatus(fn: (s: TransportStatus) => void): () => void {
    this.stat.add(fn);
    return () => this.stat.delete(fn);
  }
  close(): void {
    this.bus.leave(this.room, this);
    for (const fn of this.stat) fn('closed');
  }
  deliver(type: string, data: unknown, from: string): void {
    for (const fn of this.msg) fn(type, data, from);
  }
  presence(peers: PeerInfo[]): void {
    for (const fn of this.pres) fn(peers);
  }
}

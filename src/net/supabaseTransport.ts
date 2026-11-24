import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import type { PeerInfo, Transport, TransportFactory, TransportStatus } from './transport';

const getClient = getSupabase;

interface Envelope {
  t: string;
  d: unknown;
  f: string;
}

class SupabaseTransport implements Transport {
  private channel: RealtimeChannel | null = null;
  private msg = new Set<(type: string, data: unknown, from: string) => void>();
  private pres = new Set<(peers: PeerInfo[]) => void>();
  private stat = new Set<(s: TransportStatus) => void>();
  private tracked: PeerInfo | null = null;
  private everConnected = false;
  private closed = false;

  constructor(private readonly room: string, private readonly selfId: string) {}

  async connect(): Promise<void> {
    const sb = await getClient();
    const channel = sb.channel(`drawingtogether:${this.room}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: this.selfId } },
    });
    this.channel = channel;
    channel.on('broadcast', { event: 'm' }, ({ payload }) => {
      const e = payload as Envelope;
      for (const fn of this.msg) fn(e.t, e.d, e.f);
    });
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PeerInfo>();
      const peers: PeerInfo[] = [];
      for (const metas of Object.values(state)) {
        const m = metas[metas.length - 1];
        if (m?.id) peers.push({ id: m.id, nickname: m.nickname, avatar: m.avatar, avatarUrl: m.avatarUrl ?? null, joinedAt: m.joinedAt });
      }
      for (const fn of this.pres) fn(peers);
    });
    this.emit('connecting');
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 12_000);
      channel.subscribe((status) => {
        if (this.closed) return;
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          const again = this.everConnected;
          this.everConnected = true;
          this.emit('connected');
          // Après une coupure, on annonce de nouveau sa présence
          if (again && this.tracked) channel.track(this.tracked);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.emit(this.everConnected ? 'reconnecting' : 'connecting');
        } else if (status === 'CLOSED') {
          this.emit('closed');
        }
      });
    });
  }

  send(type: string, data: unknown): void {
    this.channel?.send({ type: 'broadcast', event: 'm', payload: { t: type, d: data, f: this.selfId } satisfies Envelope });
  }

  onMessage(fn: (type: string, data: unknown, from: string) => void): () => void {
    this.msg.add(fn);
    return () => this.msg.delete(fn);
  }

  async track(info: PeerInfo): Promise<void> {
    this.tracked = info;
    await this.channel?.track(info);
  }

  onPresence(fn: (peers: PeerInfo[]) => void): () => void {
    this.pres.add(fn);
    return () => this.pres.delete(fn);
  }

  onStatus(fn: (s: TransportStatus) => void): () => void {
    this.stat.add(fn);
    return () => this.stat.delete(fn);
  }

  private emit(s: TransportStatus): void {
    for (const fn of this.stat) fn(s);
  }

  close(): void {
    this.closed = true;
    const ch = this.channel;
    this.channel = null;
    if (ch) {
      ch.untrack().catch(() => {});
      getClient().then((sb) => sb.removeChannel(ch));
    }
    this.emit('closed');
  }
}

export const supabaseTransport: TransportFactory = (room, selfId) => new SupabaseTransport(room, selfId);

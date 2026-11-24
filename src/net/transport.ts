/** Un joueur tel que les autres le voient. */
export interface PeerInfo {
  id: string;
  nickname: string;
  avatar: number;
  /** Avatar importé (compte), sinon on dessine l'avatar n° `avatar` */
  avatarUrl?: string | null;
  /** Bouille du joueur (JSON, sans peinture intégrée) */
  bouille?: string | null;
  /** Heure d'arrivée dans la salle (sert à choisir le nouvel hôte). */
  joinedAt: number;
}

export type TransportStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed';

/**
 * Canal temps réel d'une salle : messages diffusés à tous + présence (qui est là).
 * Implémentations : Supabase (réseau) et mémoire (tests).
 */
export interface Transport {
  connect(): Promise<void>;
  /** Diffuse un message à tous les autres membres du canal. */
  send(type: string, data: unknown): void;
  onMessage(fn: (type: string, data: unknown, from: string) => void): () => void;
  /** Annonce sa présence (après avoir été accepté dans la salle). */
  track(info: PeerInfo): Promise<void>;
  onPresence(fn: (peers: PeerInfo[]) => void): () => void;
  onStatus(fn: (status: TransportStatus) => void): () => void;
  close(): void;
}

export type TransportFactory = (roomCode: string, selfId: string) => Transport;

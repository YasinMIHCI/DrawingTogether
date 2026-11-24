import type { RoomSettings } from '../net/room';

/** Identité du joueur dans l'onglet : permet de revenir dans la salle après un rechargement. */
export interface RoomSession {
  code: string;
  id: string;
  joinedAt: number;
  wasHost: boolean;
  settings: RoomSettings;
}

/** Une session par type de page (toile partagée / jeux). */
type Kind = 'shared' | 'games';
const keyOf = (kind: Kind) => (kind === 'shared' ? 'dt.room' : 'dt.gameRoom');

export function loadRoomSession(kind: Kind = 'shared'): RoomSession | null {
  try {
    const raw = sessionStorage.getItem(keyOf(kind));
    return raw ? (JSON.parse(raw) as RoomSession) : null;
  } catch {
    return null;
  }
}

export function saveRoomSession(s: RoomSession | null, kind: Kind = 'shared'): void {
  try {
    if (s) sessionStorage.setItem(keyOf(kind), JSON.stringify(s));
    else sessionStorage.removeItem(keyOf(kind));
  } catch {
    /* stockage indisponible */
  }
}

export function newPlayerId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

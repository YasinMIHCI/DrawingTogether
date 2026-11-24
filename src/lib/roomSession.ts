import type { RoomSettings } from '../net/room';

/** Identité du joueur dans l'onglet : permet de revenir dans la salle après un rechargement. */
export interface RoomSession {
  code: string;
  id: string;
  joinedAt: number;
  wasHost: boolean;
  settings: RoomSettings;
}

const KEY = 'dt.room';

export function loadRoomSession(): RoomSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RoomSession) : null;
  } catch {
    return null;
  }
}

export function saveRoomSession(s: RoomSession | null): void {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible */
  }
}

export function newPlayerId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

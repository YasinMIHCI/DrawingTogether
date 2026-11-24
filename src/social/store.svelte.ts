import { auth } from './auth.svelte';
import { friendState, myConversations, subscribeSocial, type Message } from './api';
import { play } from '../lib/sound';

/** Compteurs du compte (badges) et événements en direct, actifs tant qu'on est connecté. */
export const social = $state({ unread: 0, requests: 0 });

const messageListeners = new Set<(m: Message) => void>();
const friendListeners = new Set<() => void>();

export function onNewMessage(fn: (m: Message) => void): () => void {
  messageListeners.add(fn);
  return () => messageListeners.delete(fn);
}

export function onFriendsChange(fn: () => void): () => void {
  friendListeners.add(fn);
  return () => friendListeners.delete(fn);
}

/** Conversation affichée à l'écran (ses messages ne comptent pas comme non lus). */
export const viewing = { conversation: null as string | null };

export async function refreshCounts(): Promise<void> {
  if (!auth.userId) return;
  try {
    const [convs, friends] = await Promise.all([myConversations(), friendState()]);
    social.unread = convs.reduce((n, c) => n + (c.id === viewing.conversation ? 0 : c.unread), 0);
    social.requests = friends.incoming.length;
  } catch {
    /* tables pas encore installées */
  }
}

let stop: (() => void) | null = null;
let current: string | null = null;

/** À appeler quand l'utilisateur connecté change. */
export async function startSocial(): Promise<void> {
  if (auth.userId === current) return;
  stop?.();
  stop = null;
  current = auth.userId;
  social.unread = 0;
  social.requests = 0;
  if (!auth.userId) return;
  await refreshCounts();
  stop = await subscribeSocial(
    (m) => {
      if (m.sender_id !== auth.userId && m.conversation_id !== viewing.conversation) {
        social.unread++;
        play('message');
      }
      for (const fn of messageListeners) fn(m);
    },
    () => {
      refreshCounts();
      for (const fn of friendListeners) fn();
    },
  );
}

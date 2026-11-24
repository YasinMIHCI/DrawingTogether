import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '../net/supabase';
import { auth } from './auth.svelte';
import { normalizeUsername } from './username';

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio?: string;
}

const PROFILE_COLS = 'id, username, display_name, avatar_url';
const me = () => auth.userId!;

async function sb() {
  return getSupabase();
}

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

// ===================== Profils =====================

export async function searchProfiles(query: string): Promise<PublicProfile[]> {
  const q = normalizeUsername(query);
  if (q.length < 2) return [];
  const r = await (await sb()).from('profiles').select(PROFILE_COLS).ilike('username', `${q}%`).neq('id', me()).limit(12);
  return check(r) as PublicProfile[];
}

export async function profileByUsername(username: string): Promise<PublicProfile | null> {
  const r = await (await sb()).from('profiles').select(`${PROFILE_COLS}, bio`).eq('username', normalizeUsername(username)).maybeSingle();
  return check(r) as PublicProfile | null;
}

export async function profilesByIds(ids: string[]): Promise<Map<string, PublicProfile>> {
  const uniq = [...new Set(ids)].filter(Boolean);
  if (!uniq.length) return new Map();
  const r = await (await sb()).from('profiles').select(PROFILE_COLS).in('id', uniq);
  return new Map((check(r) as PublicProfile[]).map((p) => [p.id, p]));
}

// ===================== Amis =====================

export interface FriendState {
  friends: PublicProfile[];
  incoming: PublicProfile[];
  outgoing: PublicProfile[];
}

export async function friendState(): Promise<FriendState> {
  const rows = check(await (await sb()).from('friendships').select('requester, addressee, status')) as {
    requester: string; addressee: string; status: string;
  }[];
  const other = (r: { requester: string; addressee: string }) => (r.requester === me() ? r.addressee : r.requester);
  const profiles = await profilesByIds(rows.map(other));
  const pick = (f: (r: (typeof rows)[number]) => boolean) =>
    rows.filter(f).map((r) => profiles.get(other(r))).filter((p): p is PublicProfile => !!p);
  return {
    friends: pick((r) => r.status === 'accepted').sort((a, b) => a.username.localeCompare(b.username)),
    incoming: pick((r) => r.status === 'pending' && r.addressee === me()),
    outgoing: pick((r) => r.status === 'pending' && r.requester === me()),
  };
}

export type Relation = 'self' | 'friend' | 'incoming' | 'outgoing' | 'none';

export function relationTo(state: FriendState, id: string): Relation {
  if (id === auth.userId) return 'self';
  if (state.friends.some((p) => p.id === id)) return 'friend';
  if (state.incoming.some((p) => p.id === id)) return 'incoming';
  if (state.outgoing.some((p) => p.id === id)) return 'outgoing';
  return 'none';
}

/** Demande d'ami ; si l'autre nous a déjà demandé, on accepte directement. */
export async function requestFriend(id: string): Promise<void> {
  const client = await sb();
  const back = await client.from('friendships').select('status').eq('requester', id).eq('addressee', me()).maybeSingle();
  if (back.data) return acceptFriend(id);
  check(await client.from('friendships').insert({ requester: me(), addressee: id, status: 'pending' }));
}

export async function acceptFriend(requesterId: string): Promise<void> {
  check(await (await sb()).from('friendships').update({ status: 'accepted' }).eq('requester', requesterId).eq('addressee', me()));
}

/** Refuser, annuler une demande ou retirer un ami. */
export async function removeFriend(id: string): Promise<void> {
  check(
    await (await sb())
      .from('friendships')
      .delete()
      .or(`and(requester.eq.${me()},addressee.eq.${id}),and(requester.eq.${id},addressee.eq.${me()})`),
  );
}

// ===================== Discussions =====================

export interface ConversationSummary {
  id: string;
  kind: 'direct' | 'group';
  name: string;
  avatar_url: string | null;
  updated_at: string;
  last_body: string | null;
  last_post: string | null;
  last_sender: string | null;
  unread: number;
  other_id: string | null;
  other?: PublicProfile;
}

export async function myConversations(): Promise<ConversationSummary[]> {
  const rows = check(await (await sb()).rpc('my_conversations')) as ConversationSummary[];
  const profiles = await profilesByIds(rows.filter((r) => r.kind === 'direct').map((r) => r.other_id!));
  return rows.map((r) => ({ ...r, unread: Number(r.unread), other: r.other_id ? profiles.get(r.other_id) : undefined }));
}

export async function openDirect(friendId: string): Promise<string> {
  return check(await (await sb()).rpc('open_direct', { friend: friendId })) as string;
}

export async function createGroup(name: string, members: string[]): Promise<string> {
  return check(await (await sb()).rpc('create_group', { group_name: name, members })) as string;
}

export async function addGroupMembers(conv: string, members: string[]): Promise<void> {
  check(await (await sb()).rpc('add_group_members', { conv, members }));
}

export async function renameGroup(conv: string, name: string): Promise<void> {
  check(await (await sb()).from('conversations').update({ name: name.trim().slice(0, 60) }).eq('id', conv));
}

export interface Member extends PublicProfile {
  role: 'owner' | 'member';
}

export async function conversationInfo(conv: string): Promise<{ kind: 'direct' | 'group'; name: string; members: Member[] }> {
  const client = await sb();
  const c = check(await client.from('conversations').select('kind, name').eq('id', conv).single()) as { kind: 'direct' | 'group'; name: string };
  const rows = check(await client.from('conversation_members').select('user_id, role').eq('conversation_id', conv)) as { user_id: string; role: 'owner' | 'member' }[];
  const profiles = await profilesByIds(rows.map((r) => r.user_id));
  const members = rows.map((r) => ({ ...(profiles.get(r.user_id) as PublicProfile), role: r.role })).filter((m) => m.id);
  return { ...c, members };
}

/** Quitter un groupe (ou en retirer quelqu'un, pour le créateur). */
export async function removeMember(conv: string, userId: string): Promise<void> {
  check(await (await sb()).from('conversation_members').delete().eq('conversation_id', conv).eq('user_id', userId));
}

export interface Message {
  id: number;
  conversation_id: string;
  sender_id: string;
  body: string;
  post_id: string | null;
  created_at: string;
}

export async function listMessages(conv: string, before?: string): Promise<Message[]> {
  let q = (await sb()).from('messages').select('*').eq('conversation_id', conv).order('created_at', { ascending: false }).limit(50);
  if (before) q = q.lt('created_at', before);
  return (check(await q) as Message[]).reverse();
}

export async function sendMessage(conv: string, body: string, postId: string | null = null): Promise<Message> {
  const r = await (await sb()).from('messages').insert({ conversation_id: conv, body: body.trim().slice(0, 2000), post_id: postId }).select().single();
  return check(r) as Message;
}

export async function markRead(conv: string): Promise<void> {
  await (await sb()).from('conversation_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', conv).eq('user_id', me());
}

/** Nouveaux messages (de toutes mes discussions) et changements d'amitié, en direct. */
export async function subscribeSocial(onMessage: (m: Message) => void, onFriends: () => void, onNotify?: () => void): Promise<() => void> {
  const client = await sb();
  const ch: RealtimeChannel = client
    .channel(`social:${me()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => onMessage(p.new as Message))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => onFriends())
    .subscribe();
  // Canal à part : si la table des notifications n'existe pas encore, les messages restent en direct
  const nc: RealtimeChannel | null = onNotify
    ? client.channel(`notify:${me()}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me()}` }, () => onNotify()).subscribe()
    : null;
  return () => {
    client.removeChannel(ch);
    if (nc) client.removeChannel(nc);
  };
}

// ===================== Dessins partagés =====================

export interface Post {
  id: string;
  owner_id: string;
  title: string;
  /** Texte de la publication (vide si dessin seul) */
  body: string;
  community_id?: string | null;
  hidden?: boolean;
  image_path: string | null;
  width: number;
  height: number;
  created_at: string;
  owner?: PublicProfile;
  likes: number;
  liked: boolean;
  comments: number;
}

/** Publie un dessin et/ou un texte (visible par mes amis, et là où je le partage). */
export async function createPost(png: Blob | null, width: number, height: number, title: string, body = '', community: string | null = null): Promise<string> {
  const client = await sb();
  const id = crypto.randomUUID();
  let path: string | null = null;
  if (png) {
    path = `${me()}/${id}.png`;
    const up = await client.storage.from('posts').upload(path, png, { contentType: 'image/png' });
    if (up.error) throw new Error(up.error.message);
  }
  const row: Record<string, unknown> = { id, owner_id: me(), title: title.trim().slice(0, 80), image_path: path, width, height };
  if (body.trim()) row.body = body.trim().slice(0, 1000);
  if (community) row.community_id = community;
  check(await client.from('posts').insert(row));
  return id;
}

// Colonnes ajoutées par les scripts social-2 / social-4 : on se replie si elles n'existent pas encore
const COLSETS = ['body, community_id, hidden, ', 'body, ', ''];
let colset = 0;
export interface FeedOptions {
  owner?: string;
  /** Seulement ces auteurs (le fil : moi et mes amis) */
  owners?: string[];
  ids?: string[];
  community?: string;
  limit?: number;
  before?: string;
}
export async function feed(options: FeedOptions = {}): Promise<Post[]> {
  const run = async (extra: string) => {
    let q = (await sb())
      .from('posts')
      .select(`id, owner_id, title, ${extra}image_path, width, height, created_at, post_likes(user_id), post_comments(count)`)
      .order('created_at', { ascending: false })
      .limit(options.limit ?? 30);
    if (options.owner) q = q.eq('owner_id', options.owner);
    if (options.ids) q = q.in('id', options.ids);
    if (options.owners) q = q.in('owner_id', options.owners);
    if (options.community) q = q.eq('community_id', options.community);
    if (options.before) q = q.lt('created_at', options.before);
    return q;
  };
  let r = await run(COLSETS[colset]);
  while (r.error && colset < COLSETS.length - 1) r = await run(COLSETS[++colset]);
  const rows = (check(r) as unknown[]).map((x) => ({ body: '', ...(x as object) })) as (Omit<Post, 'likes' | 'liked' | 'comments' | 'owner'> & {
    post_likes: { user_id: string }[]; post_comments: { count: number }[];
  })[];
  const profiles = await profilesByIds(rows.map((r) => r.owner_id));
  return rows.map(({ post_likes, post_comments, ...r }) => ({
    ...r,
    owner: profiles.get(r.owner_id),
    likes: post_likes.length,
    liked: post_likes.some((l) => l.user_id === auth.userId),
    comments: post_comments[0]?.count ?? 0,
  }));
}

const imageCache = new Map<string, Promise<string>>();
/** Image d'un dessin partagé (URL locale, mise en cache). */
export function postImage(path: string): Promise<string> {
  let p = imageCache.get(path);
  if (!p) {
    p = sb().then(async (client) => {
      const r = await client.storage.from('posts').download(path);
      if (r.error || !r.data) throw new Error(r.error?.message ?? 'download');
      return URL.createObjectURL(r.data);
    });
    p.catch(() => imageCache.delete(path));
    imageCache.set(path, p);
  }
  return p;
}

export async function setLike(postId: string, like: boolean): Promise<void> {
  const client = await sb();
  if (like) check(await client.from('post_likes').insert({ post_id: postId, user_id: me() }));
  else check(await client.from('post_likes').delete().eq('post_id', postId).eq('user_id', me()));
}

export interface Comment {
  id: number;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: PublicProfile;
}

export async function listComments(postId: string): Promise<Comment[]> {
  const rows = check(await (await sb()).from('post_comments').select('*').eq('post_id', postId).order('created_at')) as Comment[];
  const profiles = await profilesByIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, author: profiles.get(r.user_id) }));
}

export async function addComment(postId: string, body: string): Promise<void> {
  check(await (await sb()).from('post_comments').insert({ post_id: postId, user_id: me(), body: body.trim().slice(0, 500) }));
}

export async function deleteComment(id: number): Promise<void> {
  check(await (await sb()).from('post_comments').delete().eq('id', id));
}

export async function deletePost(post: Post): Promise<void> {
  const client = await sb();
  const r = await client.from('posts').delete().eq('id', post.id).select('id');
  check(r);
  if (!r.data?.length) throw new Error('forbidden');
  if (post.image_path) await client.storage.from('posts').remove([post.image_path]);
}

/** Publications aimées (« Ouais ! ») par quelqu'un, parmi celles que je peux voir. */
export async function likedPosts(userId: string, limit = 30): Promise<Post[]> {
  const rows = check(await (await sb()).from('post_likes').select('post_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)) as { post_id: string }[];
  if (!rows.length) return [];
  const posts = await feed({ ids: rows.map((r) => r.post_id), limit });
  const order = new Map(rows.map((r, i) => [r.post_id, i]));
  return posts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export interface ProfileStats {
  friends: number;
  posts: number;
  likes_given: number;
}

/** Compteurs d'une page profil (null si social-2.sql n'est pas installé). */
export async function profileStats(userId: string): Promise<ProfileStats | null> {
  const r = await (await sb()).rpc('profile_stats', { uid: userId });
  if (r.error || !r.data?.[0]) return null;
  const s = r.data[0] as Record<string, number | string>;
  return { friends: Number(s.friends), posts: Number(s.posts), likes_given: Number(s.likes_given) };
}

export interface ProfileWithBouille extends PublicProfile {
  bouille: unknown;
}

/** Profils avec leur Bouille (pour la place de l'accueil). */
export async function profilesWithBouille(ids: string[]): Promise<ProfileWithBouille[]> {
  if (!ids.length) return [];
  const r = await (await sb()).from('profiles').select(`${PROFILE_COLS}, bouille`).in('id', ids);
  return r.error ? [] : (r.data as ProfileWithBouille[]);
}

// ===================== Notifications =====================

export type NotificationKind = 'friend_request' | 'friend_accept' | 'like' | 'comment' | 'group_add';
export interface Notification {
  id: number;
  actor_id: string;
  kind: NotificationKind;
  post_id: string | null;
  conversation_id: string | null;
  read: boolean;
  created_at: string;
  actor?: PublicProfile;
}

export async function listNotifications(limit = 50): Promise<Notification[]> {
  const rows = check(await (await sb()).from('notifications').select('*').order('created_at', { ascending: false }).limit(limit)) as Notification[];
  const profiles = await profilesByIds(rows.map((r) => r.actor_id));
  return rows.map((r) => ({ ...r, actor: profiles.get(r.actor_id) }));
}

/** Nombre de notifications non lues (0 si social-3.sql n'est pas installé). */
export async function unreadNotifications(): Promise<number> {
  const r = await (await sb()).from('notifications').select('id', { count: 'exact', head: true }).eq('read', false);
  return r.error ? 0 : (r.count ?? 0);
}

export async function markNotificationsRead(): Promise<void> {
  await (await sb()).from('notifications').update({ read: true }).eq('read', false).eq('user_id', me());
}

export async function clearNotifications(): Promise<void> {
  await (await sb()).from('notifications').delete().eq('user_id', me());
}

// ===================== Salons publics =====================

export interface Community {
  id: string;
  name_fr: string;
  name_en: string;
  desc_fr: string;
  desc_en: string;
  icon: string;
  color: string;
  featured: boolean;
  position: number;
  favorite: boolean;
}

let communityCache: Promise<Community[]> | null = null;
/** Salons (null si social-4.sql n'est pas installé). */
export async function listCommunities(refresh = false): Promise<Community[] | null> {
  if (refresh || !communityCache) {
    communityCache = (async () => {
      const client = await sb();
      const [c, f] = await Promise.all([
        client.from('communities').select('*').order('position'),
        client.from('community_favorites').select('community_id'),
      ]);
      if (c.error) throw new Error(c.error.message);
      const favs = new Set(((f.data ?? []) as { community_id: string }[]).map((x) => x.community_id));
      return (c.data as Community[]).map((x) => ({ ...x, favorite: favs.has(x.id) }));
    })();
    communityCache.catch(() => (communityCache = null));
  }
  return communityCache.catch(() => null);
}

export async function setFavorite(community: string, on: boolean): Promise<void> {
  const client = await sb();
  if (on) check(await client.from('community_favorites').insert({ community_id: community, user_id: me() }));
  else check(await client.from('community_favorites').delete().eq('community_id', community).eq('user_id', me()));
  communityCache = null;
}

export type ReportReason = 'spam' | 'offensive' | 'other';
export async function reportPost(postId: string, reason: ReportReason): Promise<void> {
  const r = await (await sb()).from('reports').insert({ post_id: postId, reporter: me(), reason });
  // Déjà signalé par moi : rien à faire
  if (r.error && !r.error.message.includes('duplicate')) throw new Error(r.error.message);
}

let moderator: Promise<boolean> | null = null;
export function isModerator(): Promise<boolean> {
  moderator ??= sb().then(async (c) => {
    const r = await c.rpc('is_moderator');
    return !r.error && r.data === true;
  });
  return moderator;
}

export interface ReportedPost {
  post: Post;
  reasons: Record<ReportReason, number>;
}
/** Publications signalées (modération). */
export async function reportedPosts(): Promise<ReportedPost[]> {
  const rows = check(await (await sb()).from('reports').select('post_id, reason')) as { post_id: string; reason: ReportReason }[];
  const by = new Map<string, Record<ReportReason, number>>();
  for (const r of rows) {
    const x = by.get(r.post_id) ?? { spam: 0, offensive: 0, other: 0 };
    x[r.reason]++;
    by.set(r.post_id, x);
  }
  if (!by.size) return [];
  const posts = await feed({ ids: [...by.keys()], limit: 100 });
  return posts.map((post) => ({ post, reasons: by.get(post.id)! }));
}

export async function setHidden(postId: string, hidden: boolean): Promise<void> {
  check(await (await sb()).from('posts').update({ hidden }).eq('id', postId));
}
export async function dismissReports(postId: string): Promise<void> {
  check(await (await sb()).from('reports').delete().eq('post_id', postId));
}

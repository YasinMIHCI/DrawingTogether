import { getSupabase } from '../net/supabase';
import { settings } from '../lib/settings.svelte';
import { accountEmail, isValidUsername, MIN_PASSWORD, normalizeUsername } from './username';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  /** Bouille enregistrée avec le compte (null si aucune, ou si social-2.sql n'est pas installé) */
  bouille?: unknown;
}

export type AuthError =
  | 'invalidUsername' | 'weakPassword' | 'taken' | 'badLogin' | 'confirmEmail' | 'noQuestion'
  | 'wrongAnswer' | 'locked' | 'unknownUser' | 'setupMissing' | 'network';

export class AuthFailure extends Error {
  constructor(readonly code: AuthError) {
    super(code);
  }
}

/** Compte connecté (null = visiteur). */
export const auth = $state({ ready: false, userId: null as string | null, profile: null as Profile | null });

let started = false;

/** Restaure la session au chargement et suit les connexions / déconnexions. */
export async function initAuth(): Promise<void> {
  if (started) return;
  started = true;
  // Pas de session enregistrée : inutile de charger Supabase sur la page d'accueil
  let hasSession = false;
  try {
    hasSession = !!localStorage.getItem('dt.auth');
  } catch {
    /* stockage indisponible */
  }
  if (!hasSession) {
    auth.ready = true;
    return;
  }
  await attach();
}

let attached = false;
async function attach(): Promise<void> {
  if (attached) return;
  attached = true;
  const sb = await getSupabase();
  sb.auth.onAuthStateChange((_event, session) => {
    const id = session?.user.id ?? null;
    if (id !== auth.userId) {
      auth.userId = id;
      if (id) loadProfile();
      else auth.profile = null;
    }
  });
  const { data } = await sb.auth.getSession();
  auth.userId = data.session?.user.id ?? null;
  if (auth.userId) await loadProfile();
  auth.ready = true;
}

export async function loadProfile(): Promise<void> {
  if (!auth.userId) return;
  const sb = await getSupabase();
  const cols = 'id, username, display_name, bio, avatar_url';
  let { data, error } = await sb.from('profiles').select(`${cols}, bouille`).eq('id', auth.userId).single();
  // Colonne « bouille » absente tant que social-2.sql n'est pas lancé
  if (error) ({ data, error } = await sb.from('profiles').select(cols).eq('id', auth.userId).single());
  if (data) {
    auth.profile = data as Profile;
    const remote = (data as Profile).bouille;
    if (remote) settings.bouille = JSON.stringify(remote);
    else if (settings.bouille && 'bouille' in data) void saveBouilleJson(settings.bouille);
    // Le pseudo et l'avatar du compte servent aussi dans les salles et les jeux
    settings.nickname = (data.display_name || data.username).slice(0, 20);
    settings.avatarUrl = data.avatar_url;
  }
}

function mapError(message: string | undefined): AuthError {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login')) return 'badLogin';
  if (m.includes('already registered') || m.includes('already exists')) return 'taken';
  if (m.includes('email not confirmed')) return 'confirmEmail';
  if (m.includes('password')) return 'weakPassword';
  if (m.includes('function') || m.includes('relation') || m.includes('schema')) return 'setupMissing';
  if (m.includes('database error')) return 'setupMissing';
  return 'network';
}

export async function signUp(rawUsername: string, password: string, question: string, answer: string): Promise<void> {
  const username = normalizeUsername(rawUsername);
  if (!isValidUsername(username)) throw new AuthFailure('invalidUsername');
  if (password.length < MIN_PASSWORD) throw new AuthFailure('weakPassword');
  if (question.trim().length < 3 || !answer.trim()) throw new AuthFailure('noQuestion');
  await attach();
  const sb = await getSupabase();
  const avail = await sb.rpc('username_available', { uname: username });
  if (avail.error) throw new AuthFailure(mapError(avail.error.message));
  if (avail.data === false) throw new AuthFailure('taken');
  const { data, error } = await sb.auth.signUp({
    email: accountEmail(username),
    password,
    options: { data: { username, display_name: rawUsername.trim().slice(0, 40) || username } },
  });
  if (error) throw new AuthFailure(mapError(error.message));
  // Sans session, Supabase attend une confirmation par e-mail (à désactiver dans le tableau de bord)
  if (!data.session) throw new AuthFailure('confirmEmail');
  const rec = await sb.rpc('set_recovery', { question, answer });
  if (rec.error) throw new AuthFailure(mapError(rec.error.message));
  auth.userId = data.session.user.id;
  await loadProfile();
}

export async function signIn(rawUsername: string, password: string): Promise<void> {
  const username = normalizeUsername(rawUsername);
  if (!isValidUsername(username)) throw new AuthFailure('badLogin');
  await attach();
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email: accountEmail(username), password });
  if (error) throw new AuthFailure(mapError(error.message));
  auth.userId = data.user.id;
  await loadProfile();
}

export async function signOut(): Promise<void> {
  const sb = await getSupabase();
  await sb.auth.signOut();
  auth.userId = null;
  auth.profile = null;
  settings.avatarUrl = null;
}

export async function recoveryQuestion(rawUsername: string): Promise<string> {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('recovery_question', { uname: normalizeUsername(rawUsername) });
  if (error) throw new AuthFailure(mapError(error.message));
  if (!data) throw new AuthFailure('unknownUser');
  return data as string;
}

/** Nouveau mot de passe si la réponse à la question secrète est bonne. */
export async function resetPassword(rawUsername: string, answer: string, newPassword: string): Promise<void> {
  if (newPassword.length < MIN_PASSWORD) throw new AuthFailure('weakPassword');
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('reset_password', { uname: normalizeUsername(rawUsername), answer, new_password: newPassword });
  if (error) throw new AuthFailure(mapError(error.message));
  if (data === 'wrong') throw new AuthFailure('wrongAnswer');
  if (data === 'locked') throw new AuthFailure('locked');
  if (data === 'unknown') throw new AuthFailure('unknownUser');
  if (data === 'weak') throw new AuthFailure('weakPassword');
}

export async function changeRecovery(question: string, answer: string): Promise<void> {
  if (question.trim().length < 3 || !answer.trim()) throw new AuthFailure('noQuestion');
  const sb = await getSupabase();
  const { error } = await sb.rpc('set_recovery', { question, answer });
  if (error) throw new AuthFailure(mapError(error.message));
}

export async function changePassword(newPassword: string): Promise<void> {
  if (newPassword.length < MIN_PASSWORD) throw new AuthFailure('weakPassword');
  const sb = await getSupabase();
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw new AuthFailure(mapError(error.message));
}

export async function updateProfile(patch: { display_name?: string; bio?: string }): Promise<void> {
  if (!auth.userId) return;
  const sb = await getSupabase();
  const { error } = await sb.from('profiles').update(patch).eq('id', auth.userId);
  if (error) throw new AuthFailure('network');
  await loadProfile();
}

/** Avatar importé (photo recadrée ou dessin), enregistré en PNG 256 × 256. */
export async function uploadAvatar(png: Blob): Promise<void> {
  if (!auth.userId) return;
  const sb = await getSupabase();
  const path = `${auth.userId}/avatar.png`;
  const up = await sb.storage.from('avatars').upload(path, png, { upsert: true, contentType: 'image/png' });
  if (up.error) throw new AuthFailure(mapError(up.error.message));
  const url = `${sb.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  const { error } = await sb.from('profiles').update({ avatar_url: url }).eq('id', auth.userId);
  if (error) throw new AuthFailure('network');
  await loadProfile();
}

export async function removeAvatar(): Promise<void> {
  if (!auth.userId) return;
  const sb = await getSupabase();
  await sb.storage.from('avatars').remove([`${auth.userId}/avatar.png`]);
  await sb.from('profiles').update({ avatar_url: null }).eq('id', auth.userId);
  await loadProfile();
}

async function saveBouilleJson(json: string): Promise<void> {
  if (!auth.userId) return;
  const sb = await getSupabase();
  await sb.from('profiles').update({ bouille: JSON.parse(json) }).eq('id', auth.userId);
}

/** Enregistre la Bouille avec le compte et en fait l'avatar (image PNG). */
export async function saveBouille(json: string, png: Blob): Promise<string> {
  if (!auth.userId) return json;
  // La peinture du visage (data URL) part dans le stockage ; le JSON garde son adresse
  const data = JSON.parse(json) as Record<string, unknown>;
  const sheets = [['paint', 'paint.png'], ['paintHead', 'paint-head.png'], ['paintBody', 'paint-body.png'], ['paintBack', 'paint-back.png']];
  for (const [key, file] of sheets) {
    const v = data[key];
    if (typeof v !== 'string' || !v.startsWith('data:')) continue;
    const sb = await getSupabase();
    const blob = await (await fetch(v)).blob();
    const path = `${auth.userId}/${file}`;
    const up = await sb.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/png' });
    if (up.error) throw new AuthFailure(mapError(up.error.message));
    data[key] = `${sb.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  }
  json = JSON.stringify(data);
  await uploadAvatar(png);
  await saveBouilleJson(json).catch(() => {});
  return json;
}

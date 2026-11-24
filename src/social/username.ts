/** Pseudo : 3 à 20 caractères, lettres minuscules, chiffres ou « _ » (unique, insensible à la casse). */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents : é → e
    .replace(/[^a-z0-9_]/g, '');
}

export function isValidUsername(u: string): boolean {
  return USERNAME_RE.test(u);
}

/**
 * Supabase demande un e-mail : on en fabrique un, invisible, à partir du pseudo.
 * Aucun message n'y est jamais envoyé (la confirmation par e-mail doit être désactivée).
 */
export function accountEmail(username: string): string {
  return `${username}@users.drawingtogether.app`;
}

export const MIN_PASSWORD = 8;

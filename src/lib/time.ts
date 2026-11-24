/** « il y a 3 minutes », « hier »… dans la langue choisie. */
export function relativeTime(date: string | number | Date, locale: string, now = Date.now()): string {
  const s = Math.round((new Date(date).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const a = Math.abs(s);
  if (a < 45) return rtf.format(0, 'second');
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (a < 7 * 86400) return rtf.format(Math.round(s / 86400), 'day');
  return new Date(date).toLocaleDateString(locale, { dateStyle: 'medium' });
}

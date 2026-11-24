/** Défis de la semaine : un thème par semaine (lundi → dimanche), le même pour tout le monde, sans rien à gérer côté serveur. */

export interface Theme {
  icon: string;
  fr: string;
  en: string;
}

export const THEMES: Theme[] = [
  { icon: '🐉', fr: 'Dragons', en: 'Dragons' },
  { icon: '🏝️', fr: 'Une île déserte', en: 'A desert island' },
  { icon: '🤖', fr: 'Robots', en: 'Robots' },
  { icon: '🍕', fr: 'Ton plat préféré', en: 'Your favourite food' },
  { icon: '👻', fr: 'Fantômes et monstres', en: 'Ghosts and monsters' },
  { icon: '🚀', fr: "Dans l'espace", en: 'In space' },
  { icon: '🐱', fr: 'Chats en folie', en: 'Crazy cats' },
  { icon: '🏰', fr: 'Un château', en: 'A castle' },
  { icon: '🌧️', fr: 'Un jour de pluie', en: 'A rainy day' },
  { icon: '🦸', fr: 'Invente un super-héros', en: 'Invent a superhero' },
  { icon: '🌊', fr: 'Sous la mer', en: 'Under the sea' },
  { icon: '🎂', fr: "Un gâteau d'anniversaire", en: 'A birthday cake' },
  { icon: '🦖', fr: 'Dinosaures', en: 'Dinosaurs' },
  { icon: '🌸', fr: 'Le printemps', en: 'Spring' },
  { icon: '🎵', fr: 'Dessine une chanson', en: 'Draw a song' },
  { icon: '🪄', fr: 'Magie', en: 'Magic' },
  { icon: '🚲', fr: 'Un voyage', en: 'A journey' },
  { icon: '🍄', fr: 'Une forêt enchantée', en: 'An enchanted forest' },
  { icon: '🐧', fr: 'Animaux du froid', en: 'Cold-weather animals' },
  { icon: '🏙️', fr: 'La ville la nuit', en: 'The city at night' },
  { icon: '👽', fr: 'Extraterrestres', en: 'Aliens' },
  { icon: '🎃', fr: 'Citrouilles', en: 'Pumpkins' },
  { icon: '☕', fr: 'Un moment calme', en: 'A quiet moment' },
  { icon: '🧙', fr: 'Sorciers et sorcières', en: 'Wizards and witches' },
  { icon: '🐸', fr: 'Grenouilles', en: 'Frogs' },
  { icon: '🎮', fr: 'Ton jeu préféré', en: 'Your favourite game' },
  { icon: '⛄', fr: "L'hiver", en: 'Winter' },
  { icon: '🌋', fr: 'Un volcan', en: 'A volcano' },
  { icon: '🪐', fr: 'Une planète inventée', en: 'A made-up planet' },
  { icon: '🦊', fr: 'Renards', en: 'Foxes' },
  { icon: '🏴‍☠️', fr: 'Pirates', en: 'Pirates' },
  { icon: '🌻', fr: 'Un jardin', en: 'A garden' },
  { icon: '😴', fr: 'Un rêve bizarre', en: 'A weird dream' },
  { icon: '🚂', fr: 'Un train', en: 'A train' },
  { icon: '🎪', fr: 'Le cirque', en: 'The circus' },
  { icon: '🐝', fr: 'Insectes', en: 'Bugs' },
  { icon: '🍦', fr: "L'été", en: 'Summer' },
  { icon: '🦉', fr: 'Oiseaux', en: 'Birds' },
  { icon: '🏠', fr: 'Ta maison idéale', en: 'Your dream house' },
  { icon: '🧸', fr: 'Un jouet', en: 'A toy' },
  { icon: '⚔️', fr: 'Chevaliers', en: 'Knights' },
  { icon: '🌈', fr: 'Arc-en-ciel', en: 'Rainbow' },
  { icon: '🐙', fr: 'Pieuvres', en: 'Octopuses' },
  { icon: '🎨', fr: 'Autoportrait', en: 'Self-portrait' },
  { icon: '🍂', fr: "L'automne", en: 'Autumn' },
  { icon: '🦄', fr: 'Créatures légendaires', en: 'Legendary creatures' },
  { icon: '🛸', fr: 'Le futur', en: 'The future' },
  { icon: '🐢', fr: 'Lent mais sûr', en: 'Slow but steady' },
  { icon: '🎭', fr: 'Émotions', en: 'Emotions' },
  { icon: '🍓', fr: 'Fruits', en: 'Fruit' },
  { icon: '🗺️', fr: 'Une carte au trésor', en: 'A treasure map' },
  { icon: '🎁', fr: 'Une surprise', en: 'A surprise' },
];

/** Semaine ISO d'une date (« 2026-W48 »). */
export function weekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // jeudi de la même semaine
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Lundi (local) de la semaine d'une date. */
export function mondayOf(date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const EPOCH = Date.UTC(2024, 0, 1); // un lundi

/** Thème d'une semaine (rotation fixe sur la liste). */
export function themeOf(key: string): Theme {
  const [y, w] = key.split('-W').map(Number);
  // Lundi de la semaine ISO « y-Www »
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const monday = jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000 + (w - 1) * 7 * 86400000;
  const n = Math.round((monday - EPOCH) / (7 * 86400000));
  return THEMES[((n % THEMES.length) + THEMES.length) % THEMES.length];
}

/** Cette semaine et les précédentes (la plus récente d'abord). */
export function recentWeeks(count: number, now = new Date()): string[] {
  const out: string[] = [];
  const m = mondayOf(now);
  for (let i = 0; i < count; i++) {
    const d = new Date(m);
    d.setDate(m.getDate() - 7 * i);
    out.push(weekKey(d));
  }
  return out;
}

/** Jours restants avant la fin du défi (dimanche soir). */
export function daysLeft(now = new Date()): number {
  const end = mondayOf(now);
  end.setDate(end.getDate() + 7);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
}

export const themeName = (th: Theme, locale: string) => (locale === 'fr' ? th.fr : th.en);

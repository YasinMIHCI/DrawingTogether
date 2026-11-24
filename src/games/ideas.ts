import { rng } from '../engine/random';
import type { Locale } from '../lib/i18n/i18n.svelte';

/** Idées de dessin (mode Atelier libre, exemples de phrases). */
const IDEAS: Record<Locale, string[]> = {
  fr: [
    'un chat astronaute', 'une pizza qui fait du ski', 'un dragon qui a peur des souris', 'la maison de tes rêves',
    'un robot jardinier', 'un poisson perdu dans le désert', 'un pique-nique sur la Lune', 'un monstre très gentil',
    'un super-héros fatigué', 'une forêt magique', 'un château en bonbons', 'un dinosaure au restaurant',
    'une tempête dans une tasse de thé', 'un concert d\'animaux', 'ta ville en l\'an 3000', 'un pirate végétarien',
    'un escargot très pressé', 'un volcan qui éternue', 'une sorcière en vacances', 'un éléphant funambule',
    'un fantôme qui a peur du noir', 'une baleine dans le ciel', 'un cactus amoureux', 'un hibou détective',
  ],
  en: [
    'an astronaut cat', 'a pizza going skiing', 'a dragon afraid of mice', 'your dream house',
    'a gardening robot', 'a fish lost in the desert', 'a picnic on the Moon', 'a very kind monster',
    'a tired superhero', 'a magic forest', 'a candy castle', 'a dinosaur at a restaurant',
    'a storm in a teacup', 'an animal concert', 'your town in the year 3000', 'a vegetarian pirate',
    'a snail in a hurry', 'a sneezing volcano', 'a witch on holiday', 'an elephant on a tightrope',
    'a ghost afraid of the dark', 'a whale in the sky', 'a cactus in love', 'an owl detective',
  ],
};

export function ideaFor(locale: Locale, seed: number): string {
  const list = IDEAS[locale];
  return list[Math.floor(rng(seed)() * list.length)];
}

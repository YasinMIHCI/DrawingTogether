import { describe, expect, it } from 'vitest';
import { COUNT, defaultBouille, parseBouille, randomBouille, stringifyBouille } from '../src/bouille/model';
import { renderBouille } from '../src/bouille/render';

describe('Bouille', () => {
  it('relit une Bouille enregistrée à l’identique', () => {
    const b = randomBouille();
    expect(parseBouille(stringifyBouille(b))).toEqual(b);
  });
  it('corrige les valeurs invalides', () => {
    const b = parseBouille({ hair: { s: 999, c: -3, z: 50 }, eyes: { s: 'x' }, body: { h: 99 } })!;
    expect(b.hair.s).toBe(COUNT.hair - 1);
    expect(b.hair.c).toBe(0);
    expect(b.hair.z).toBe(5);
    expect(b.eyes.s).toBe(defaultBouille().eyes.s);
    expect(b.body.h).toBe(4);
    expect(parseBouille('pas du json')).toBeNull();
  });
  it('dessine chaque modèle de chaque partie', () => {
    for (const [cat, n] of Object.entries(COUNT)) {
      for (let s = 0; s < n; s++) {
        const b = defaultBouille();
        (b[cat as keyof typeof COUNT] as { s: number }).s = s;
        const svg = renderBouille(b, { view: 'full', turn: 0.5 });
        expect(svg).toMatch(/^<svg[\s\S]*<\/svg>$/);
        expect(svg).not.toContain('undefined');
        expect(svg).not.toContain('NaN');
      }
    }
  });
});

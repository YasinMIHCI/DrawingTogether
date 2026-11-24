/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Génère le service worker à la construction : il garde en cache tous les fichiers du site
 * (dessin libre et galerie utilisables hors ligne). Le temps réel (Supabase) n'est jamais mis en cache.
 */
function serviceWorker(): Plugin {
  const extra = ['./', 'index.html', 'favicon.svg', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
  return {
    name: 'drawingtogether-sw',
    apply: 'build',
    enforce: 'post',
    // Une fois tous les fichiers écrits (CSS des pages compris), on liste ce qu'il faut garder hors ligne
    writeBundle(opts, bundle) {
      const files = [...extra, ...Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'index.html' && f !== 'sw.js')];
      const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 12);
      const template = readFileSync(new URL('./src/sw-template.js', import.meta.url), 'utf8');
      const source = template.replace('__VERSION__', version).replace('__ASSETS__', JSON.stringify(files));
      writeFileSync(join(opts.dir ?? 'dist', 'sw.js'), source);
    },
  };
}

// base './' : chemins relatifs, fonctionne sur https://<user>.github.io/DrawingTogether/
// comme sur un domaine personnalisé.
export default defineConfig({
  base: './',
  plugins: [svelte(), serviceWorker()],
  test: {
    environment: 'jsdom',
  },
});

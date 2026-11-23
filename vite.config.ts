/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// base './' : chemins relatifs, fonctionne sur https://<user>.github.io/DrawingTogether/
// comme sur un domaine personnalisé.
export default defineConfig({
  base: './',
  plugins: [svelte()],
  test: {
    environment: 'jsdom',
  },
});

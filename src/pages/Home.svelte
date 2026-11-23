<script lang="ts">
  import ProfileCard from '../components/ProfileCard.svelte';
  import { href, type Route } from '../lib/router.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import type { Key } from '../lib/i18n/i18n.svelte';

  const modes: { route: Route; title: Key; desc: Key; color: string; icon: string }[] = [
    { route: 'draw', title: 'home.draw.title', desc: 'home.draw.desc', color: 'var(--accent)',
      icon: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3' },
    { route: 'shared', title: 'home.shared.title', desc: 'home.shared.desc', color: 'var(--teal)',
      icon: 'M3 5h18v12H3zM8 21h8M7 13c2-3 4-1 6-4s3 1 4 0' },
    { route: 'games', title: 'home.games.title', desc: 'home.games.desc', color: 'var(--sun)',
      icon: 'M4 6h16v10H8l-4 4zM9 11h.01M12 11h.01M15 11h.01' },
  ];
</script>

<main>
  <p class="tagline">{t('app.tagline')}</p>
  <div class="layout">
    <div class="modes">
      {#each modes as m (m.route)}
        <a class="mode" href={href(m.route)} style:--c={m.color}>
          <span class="ico">
            <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
              <path d={m.icon} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <span class="txt">
            <strong>{t(m.title)}</strong>
            <span>{t(m.desc)}</span>
          </span>
        </a>
      {/each}
    </div>
    <ProfileCard />
  </div>
</main>

<style>
  main { max-width: 1040px; margin: 0 auto; padding: 8px 16px 32px; }
  .tagline { margin: 4px 0 20px; font-size: 1.25rem; font-weight: 600; color: var(--ink-soft); }
  .layout { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 20px; align-items: start; }
  .modes { display: grid; gap: 14px; }
  .mode { display: flex; gap: 16px; align-items: center; padding: 18px; text-decoration: none; background: var(--surface); border: 2px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); transition: transform 0.12s, border-color 0.12s; }
  .mode:hover { transform: translateY(-2px); border-color: var(--c); }
  .ico { flex: none; display: grid; place-items: center; width: 60px; height: 60px; border-radius: 16px; background: var(--c); color: #1f2430; }
  .txt { display: grid; gap: 2px; min-width: 0; }
  .txt strong { font-size: 1.15rem; }
  .txt span { color: var(--ink-soft); }
  @media (max-width: 760px) { .layout { grid-template-columns: minmax(0, 1fr); } }
</style>

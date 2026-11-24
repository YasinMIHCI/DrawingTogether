<script lang="ts">
  import { listCommunities, type Community } from '../social/api';
  import { auth } from '../social/auth.svelte';
  import { settings } from '../lib/settings.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import RequireAccount from '../ui/social/RequireAccount.svelte';
  import CommunityIcon from '../ui/social/CommunityIcon.svelte';
  import EmptyState from '../components/EmptyState.svelte';

  /** Salons publics : à la une, tous les salons, favoris. */
  let list = $state<Community[] | null | undefined>(undefined);
  let tab = $state<'all' | 'favorites'>('all');
  $effect(() => {
    if (auth.userId) listCommunities(true).then((l) => (list = l));
  });
  const name = (c: Community) => (settings.locale === 'fr' ? c.name_fr : c.name_en);
  const desc = (c: Community) => (settings.locale === 'fr' ? c.desc_fr : c.desc_en);
  const shown = $derived((list ?? []).filter((c) => tab === 'all' || c.favorite));
</script>

<main class="soc wide">
  <h1 class="band">{t('com.title')}
    <span class="seg" role="tablist">
      <button role="tab" aria-selected={tab === 'all'} onclick={() => (tab = 'all')}>{t('com.all')}</button>
      <button role="tab" aria-selected={tab === 'favorites'} onclick={() => (tab = 'favorites')}>★ {t('com.favorites')}</button>
    </span>
  </h1>
  <RequireAccount>
    {#if list === null}<p class="error">{t('com.setup')}</p>{/if}
    {#if list && tab === 'all'}
      <section class="panel spotlight">
        <span class="spot">✦ {t('com.featured')}</span>
        {#each list.filter((c) => c.featured) as c (c.id)}
          <a href="#/c/{c.id}" title={name(c)}><CommunityIcon icon={c.icon} color={c.color} size={72} /><span>{name(c)}</span></a>
        {/each}
      </section>
    {/if}
    {#if list}
      <h2 class="band blue">{tab === 'all' ? t('com.list') : t('com.favorites')}</h2>
      {#if !shown.length}<EmptyState text={t('com.noFavorites')} expr="wink" seed={9} />{/if}
      <ul class="grid">
        {#each shown as c (c.id)}
          <li>
            <a class="item panel" href="#/c/{c.id}">
              <CommunityIcon icon={c.icon} color={c.color} size={64} />
              <span class="txt"><b>{name(c)}{c.favorite ? ' ★' : ''}</b><span>{desc(c)}</span></span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </RequireAccount>
</main>

<style>
  .wide { max-width: 980px; }
  .seg { display: inline-flex; gap: 4px; background: rgba(0, 0, 0, 0.15); border-radius: 12px; padding: 3px; }
  .seg button { font: inherit; font-size: 0.85rem; font-weight: 800; padding: 5px 12px; border-radius: 9px; border: 0; background: none; color: #fff; cursor: pointer; }
  .seg [aria-selected='true'] { background: #fff; color: var(--accent); }
  .spotlight { display: flex; gap: 14px; align-items: center; padding: 12px 16px; overflow-x: auto; }
  .spot { flex: none; font-weight: 800; color: var(--blue); padding: 14px 16px; border-radius: 14px; background: var(--surface-2); }
  .spotlight a { flex: none; display: grid; justify-items: center; gap: 4px; text-decoration: none; font-size: 0.8rem; font-weight: 700; width: 90px; text-align: center; }
  .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }
  .item { display: flex; gap: 14px; align-items: center; padding: 10px 14px; text-decoration: none; }
  .item:hover { background: var(--surface-2); }
  .txt { display: grid; gap: 2px; min-width: 0; }
  .txt b { font-size: 1.05rem; }
  .txt span { color: var(--ink-soft); font-size: 0.88rem; }
</style>

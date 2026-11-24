<script lang="ts">
  import type { Editor } from '../../engine/editor';
  import type { UiPreference } from '../../lib/device';
  import { settings } from '../../lib/settings.svelte';
  import { href } from '../../lib/router.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import Icon from '../common/Icon.svelte';

  let { editor, tick, onclose }: { editor: Editor; tick: number; onclose: () => void } = $props();
  const s = $derived((void tick, { bg: editor.doc.background, sel: editor.selection.active, clip: editor.hasClipboard }));
  const uis: UiPreference[] = ['auto', 'mobile', 'krita', 'paint'];
  const run = (f: () => void) => () => {
    f();
    onclose();
  };
</script>

<div class="menu">
  <h3>{t('m.view')}</h3>
  <div class="m-seg">
    <button onclick={run(() => editor.fit())}><Icon name="fit" size={18} /> {t('draw.fit')}</button>
    <button onclick={run(() => editor.setZoom(1))}>{t('draw.zoom100')}</button>
    <button onclick={run(() => editor.setRotation(0))}>{t('draw.resetRotation')}</button>
  </div>
  <h3>{t('m.selection')}</h3>
  <div class="m-seg">
    <button onclick={run(() => editor.selectAll())}>{t('select.all')}</button>
    <button onclick={run(() => editor.deselect())} disabled={!s.sel}>{t('select.none')}</button>
    <button onclick={run(() => editor.invertSelection())}>{t('select.invert')}</button>
    <button onclick={run(() => editor.copy())}>{t('select.copy')}</button>
    <button onclick={run(() => editor.paste())} disabled={!s.clip}>{t('select.paste')}</button>
  </div>
  <h3>{t('m.background')}</h3>
  <div class="m-seg">
    <button aria-pressed={s.bg !== null} onclick={() => editor.setBackground('#ffffff')}>{t('layers.bgWhite')}</button>
    <button aria-pressed={s.bg === null} onclick={() => editor.setBackground(null)}>{t('layers.bgTransparent')}</button>
  </div>
  <h3>{t('m.interface')}</h3>
  <div class="m-seg">
    {#each uis as u (u)}
      <button aria-pressed={settings.ui === u} onclick={() => (settings.ui = u)}>{t(`settings.ui.${u}`)}</button>
    {/each}
  </div>
  <h3>{t('m.gestures')}</h3>
  <p class="m-hint">{t('m.gesturesText')}</p>
  <a class="m-pill-btn home" href={href('home')}><Icon name="home" size={18} /> {t('m.home')}</a>
</div>

<style>
  .menu { padding: 8px 16px 14px; max-height: 62vh; overflow-y: auto; }
  h3 { font-size: 0.85rem; color: var(--m-soft); margin: 12px 0 6px; font-weight: 600; }
  .m-seg button { display: inline-flex; align-items: center; gap: 4px; }
  .home { margin-top: 14px; text-decoration: none; }
</style>

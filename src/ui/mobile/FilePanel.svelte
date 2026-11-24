<script lang="ts">
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';
  import type { FileActions } from '../common/types';
  import Icon from '../common/Icon.svelte';
  import type { IconName } from '../common/icons';
  import { navigate } from '../../lib/router.svelte';

  let { files, onclose }: { files: FileActions; onclose: () => void } = $props();
  const off = (k: NonNullable<FileActions['disabled']>[number]) => files.disabled?.includes(k) ?? false;
  const items: { icon: IconName; label: Key; run: () => void; off?: boolean }[] = [
    { icon: 'newDoc', label: 'file.new', run: () => files.newDoc(), off: off('newDoc') },
    { icon: 'open', label: 'file.open', run: () => files.open(), off: off('open') },
    { icon: 'save', label: 'file.save', run: () => files.save(), off: off('save') },
    { icon: 'import', label: 'file.import', run: () => files.importImage(), off: off('importImage') },
    { icon: 'export', label: 'file.exportPng', run: () => files.exportImage('png') },
    { icon: 'export', label: 'file.exportJpg', run: () => files.exportImage('jpeg') },
    { icon: 'image', label: 'file.gallery', run: () => navigate('gallery') },
  ];
</script>

<div class="file">
  <div class="grid">
    {#each items as it (it.label)}
      <button disabled={it.off} onclick={() => (onclose(), it.run())}><Icon name={it.icon} size={28} /><span>{t(it.label)}</span></button>
    {/each}
  </div>
  <p class="m-hint">{t('file.autosave')}</p>
</div>

<style>
  .file { padding: 12px 14px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .grid button { display: grid; justify-items: center; gap: 6px; padding: 10px 4px; border-radius: 12px; color: var(--m-ink); }
  .grid span { font-size: 0.8rem; text-align: center; color: var(--m-text); }
  .grid button:active { background: rgba(127, 127, 127, 0.12); }
</style>

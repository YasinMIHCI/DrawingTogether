<script lang="ts">
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';
  import type { FileActions } from '../dev/types';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  let { files, onclose }: { files: FileActions; onclose: () => void } = $props();
  const items: { icon: IconName; label: Key; run: () => void }[] = [
    { icon: 'newDoc', label: 'file.new', run: () => files.newDoc() },
    { icon: 'open', label: 'file.open', run: () => files.open() },
    { icon: 'save', label: 'file.save', run: () => files.save() },
    { icon: 'import', label: 'file.import', run: () => files.importImage() },
    { icon: 'export', label: 'file.exportPng', run: () => files.exportImage('png') },
    { icon: 'export', label: 'file.exportJpg', run: () => files.exportImage('jpeg') },
  ];
</script>

<div class="file">
  <div class="grid">
    {#each items as it (it.label)}
      <button onclick={() => (onclose(), it.run())}><Icon name={it.icon} size={28} /><span>{t(it.label)}</span></button>
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

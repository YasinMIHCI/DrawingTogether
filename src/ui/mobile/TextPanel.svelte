<script lang="ts">
  import type { Editor } from '../../engine/editor';
  import { t } from '../../lib/i18n/t.svelte';

  let { editor }: { editor: Editor } = $props();
  let value = $state('');
</script>

<form class="tp" onsubmit={(e) => { e.preventDefault(); editor.commitText(value); value = ''; }}>
  <!-- svelte-ignore a11y_autofocus -->
  <textarea bind:value placeholder={t('text.placeholder')} rows="3" autofocus></textarea>
  <div class="m-row end">
    <button type="button" class="m-pill-btn" onclick={() => editor.cancelText()}>{t('text.cancel')}</button>
    <button type="submit" class="m-pill-btn primary">{t('text.ok')}</button>
  </div>
</form>

<style>
  .tp { padding: 12px 16px; display: grid; gap: 8px; }
  textarea { width: 100%; font-size: 1rem; resize: vertical; }
  .end { justify-content: flex-end; }
</style>

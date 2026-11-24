<script lang="ts">
  import type { Editor } from '../engine/editor';
  import { uiStyle } from '../lib/screen.svelte';
  import { isDark } from '../lib/theme.svelte';
  import MobileUI from './mobile/MobileUI.svelte';
  import KritaUI from './desktop/KritaUI.svelte';
  import PaintUI from './desktop/PaintUI.svelte';
  import type { Insets } from './desktop/viewport';
  import type { FileActions } from './common/types';

  /** Toile + interface choisie (Krita, Paint ou mobile). `insets` = zone libre pour la toile. */
  let { editor, files, status = '', insets = $bindable({ top: 0, right: 0, bottom: 0, left: 0 }) }: {
    editor: Editor; files: FileActions; status?: string; insets?: Insets;
  } = $props();

  let fitted = false;
  function setViewport(r: Insets | null) {
    insets = r ?? { top: 0, right: 0, bottom: 0, left: 0 };
    if (r && !fitted) {
      // Première mise en page : on ajuste la vue une fois la toile redimensionnée
      fitted = true;
      requestAnimationFrame(() => requestAnimationFrame(() => editor.fit()));
    }
  }
  const ui = $derived(uiStyle());

  // Couleur autour de la toile selon le thème
  $effect(() => {
    editor.setWorkspaceColor(isDark() ? (ui === 'mobile' ? '#1b1c20' : '#3a3b40') : ui === 'paint' ? '#dde3ea' : ui === 'mobile' ? '#c9cacd' : '#a9abb1');
  });

  function attachEditor(node: HTMLCanvasElement, ed: Editor) {
    const detach = ed.attach(node);
    return { destroy: detach };
  }
</script>

<div class="editor-root">
<canvas class="canvas-surface" use:attachEditor={editor}
  style:top="{insets.top}px" style:left="{insets.left}px"
  style:width="calc(100% - {insets.left + insets.right}px)" style:height="calc(100% - {insets.top + insets.bottom}px)"></canvas>
{#if ui === 'krita'}
  <KritaUI {editor} {files} {status} {setViewport} />
{:else if ui === 'paint'}
  <PaintUI {editor} {files} {status} {setViewport} />
{:else}
  <MobileUI {editor} {files} {status} />
{/if}
</div>

<style>
  .editor-root { position: absolute; inset: 0; overflow: hidden; }
  canvas { position: absolute; display: block; }
</style>

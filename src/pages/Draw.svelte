<script lang="ts">
  import { onMount } from 'svelte';
  import { Editor } from '../engine/editor';
  import { exportImage, PROJECT_EXTENSION, projectFromFile, projectToFile, saveProject, type ProjectData } from '../engine/project';
  import { screen } from '../lib/screen.svelte';
  import { dbGet, dbSet } from '../lib/db';
  import { downloadBlob, pickFile, timestampedName } from '../lib/download';
  import { t } from '../lib/i18n/t.svelte';
  import MobileUI from '../ui/mobile/MobileUI.svelte';
  import KritaUI from '../ui/desktop/KritaUI.svelte';
  import PaintUI from '../ui/desktop/PaintUI.svelte';
  import type { Insets } from '../ui/desktop/viewport';
  import { uiStyle } from '../lib/screen.svelte';
  import { isDark } from '../lib/theme.svelte';
  import NewDocDialog from '../ui/common/NewDocDialog.svelte';
  import type { FileActions } from '../ui/common/types';

  const AUTOSAVE_KEY = 'autosave';
  const touch = screen.info.coarse;

  let editor = $state.raw<Editor | null>(null);
  // Zone de la toile entre les panneaux (interfaces bureau) ; 0 partout = plein écran
  let insets = $state<Insets>({ top: 0, right: 0, bottom: 0, left: 0 });
  let fittedFor: Editor | null = null;
  function setViewport(r: Insets | null) {
    insets = r ?? { top: 0, right: 0, bottom: 0, left: 0 };
    if (r && editor && fittedFor !== editor) {
      // Première mise en page de ce dessin : on ajuste la vue une fois la toile redimensionnée
      fittedFor = editor;
      const ed = editor;
      requestAnimationFrame(() => requestAnimationFrame(() => ed.fit()));
    }
  }
  const ui = $derived(uiStyle());

  // Couleur autour de la toile selon le thème
  $effect(() => {
    editor?.setWorkspaceColor(isDark() ? (ui === 'mobile' ? '#1b1c20' : '#3a3b40') : ui === 'paint' ? '#dde3ea' : ui === 'mobile' ? '#c9cacd' : '#a9abb1');
  });
  let showNew = $state(false);
  let status = $state('');

  function makeEditor(width: number, height: number): Editor {
    return new Editor({ width, height, historyBytes: (touch ? 96 : 384) * 2 ** 20 });
  }

  async function restore(data: ProjectData | undefined): Promise<Editor> {
    if (data?.width && data.layers?.length) {
      const e = makeEditor(data.width, data.height);
      try {
        await e.loadProject(data);
        return e;
      } catch {
        /* sauvegarde illisible : on repart d'un dessin vide */
      }
    }
    // Taille par défaut selon l'orientation de l'écran
    const portrait = screen.info.height > screen.info.width;
    return makeEditor(portrait ? 1080 : 1920, portrait ? 1920 : 1080);
  }

  onMount(() => {
    dbGet<ProjectData>(AUTOSAVE_KEY).then(async (data) => (editor = await restore(data)));
  });

  // Sauvegarde automatique 1,5 s après le dernier changement
  $effect(() => {
    const ed = editor;
    if (!ed) return;
    let saved = ed.history.version;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = ed.subscribe(() => {
      if (ed.history.version === saved) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        saved = ed.history.version;
        if (await dbSet(AUTOSAVE_KEY, await saveProject(ed.doc))) flash(t('file.saved'));
      }, 1500);
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  });

  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  function flash(msg: string) {
    status = msg;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (status = ''), 2000);
  }

  async function newDocument(w: number, h: number, bg: string | null) {
    showNew = false;
    const e = makeEditor(w, h);
    e.setBackground(bg);
    editor = e;
    await dbSet(AUTOSAVE_KEY, await saveProject(e.doc));
  }

  async function openProjectFile(file: File) {
    try {
      const data = await projectFromFile(file);
      editor = await restore(data);
      await dbSet(AUTOSAVE_KEY, data);
    } catch {
      alert(t('file.openError'));
    }
  }

  async function importImageFile(file: Blob) {
    if (!editor) return;
    try {
      const bmp = await createImageBitmap(file);
      editor.importImage(bmp, bmp.width, bmp.height);
    } catch {
      alert(t('file.importError'));
    }
  }

  const files: FileActions = {
    newDoc: () => (showNew = true),
    async open() {
      const f = await pickFile(`${PROJECT_EXTENSION},application/json`);
      if (f) await openProjectFile(f);
    },
    async save() {
      if (!editor) return;
      downloadBlob(await projectToFile(await saveProject(editor.doc)), timestampedName('dessin', PROJECT_EXTENSION));
    },
    async importImage() {
      const f = await pickFile('image/*');
      if (f) await importImageFile(f);
    },
    async exportImage(type) {
      if (!editor) return;
      downloadBlob(await exportImage(editor.doc, type), timestampedName('dessin', type === 'png' ? '.png' : '.jpg'));
    },
  };

  // Coller une image depuis le presse-papiers du système, sinon le presse-papiers interne
  function onPaste(e: ClipboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
    const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
    e.preventDefault();
    if (file) importImageFile(file);
    else editor?.paste();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (file.name.endsWith(PROJECT_EXTENSION)) openProjectFile(file);
    else if (file.type.startsWith('image/')) importImageFile(file);
  }

  function attachEditor(node: HTMLCanvasElement, ed: Editor) {
    const detach = ed.attach(node);
    return { destroy: detach };
  }
</script>

<svelte:window onpaste={onPaste} />

<div class="draw" role="application" ondragover={(e) => e.preventDefault()} ondrop={onDrop}>
  {#if editor}
    {#key editor}
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
    {/key}
  {/if}
  {#if showNew}
    <NewDocDialog oncreate={newDocument} oncancel={() => (showNew = false)} />
  {/if}
</div>

<style>
  .draw { position: fixed; inset: 0; overflow: hidden; }
  canvas { position: absolute; display: block; }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import { Editor } from '../engine/editor';
  import { exportImage, PROJECT_EXTENSION, projectFromFile, projectToFile, saveProject, type ProjectData } from '../engine/project';
  import { screen } from '../lib/screen.svelte';
  import { addProject, lastDrawing, loadDrawing, newDrawingId, saveDrawing } from '../lib/gallery';
  import { href, router } from '../lib/router.svelte';
  import { downloadBlob, pickFile, timestampedName } from '../lib/download';
  import { t } from '../lib/i18n/t.svelte';
  import EditorView from '../ui/EditorView.svelte';
  import NewDocDialog from '../ui/common/NewDocDialog.svelte';
  import type { FileActions } from '../ui/common/types';

  const touch = screen.info.coarse;
  /** Dessin ouvert : #/draw/<id> ; sans id, le dernier dessin, sinon un nouveau. */
  const drawingId = router.param || lastDrawing() || newDrawingId();
  if (router.param !== drawingId) history.replaceState(null, '', `${href('draw')}/${drawingId}`);

  let editor = $state.raw<Editor | null>(null);
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
    loadDrawing(drawingId).then(async (data) => (editor = await restore(data)));
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
        if (await saveDrawing(drawingId, ed.doc)) flash(t('file.saved'));
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

  /** Nouveau dessin : il s'ajoute à la galerie (l'actuel y reste). */
  async function newDocument(w: number, h: number, bg: string | null) {
    showNew = false;
    const e = makeEditor(w, h);
    e.setBackground(bg);
    const id = newDrawingId();
    await saveDrawing(id, e.doc);
    location.hash = `${href('draw')}/${id}`;
  }

  async function openProjectFile(file: File) {
    try {
      const data = await projectFromFile(file);
      const id = await addProject(data, file.name.replace(/\.[^.]+$/, ''));
      location.hash = `${href('draw')}/${id}`;
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

</script>

<svelte:window onpaste={onPaste} />

<div class="draw" role="application" ondragover={(e) => e.preventDefault()} ondrop={onDrop}>
  {#if editor}
    {#key editor}
      <EditorView {editor} {files} {status} />
    {/key}
  {/if}
  {#if showNew}
    <NewDocDialog oncreate={newDocument} oncancel={() => (showNew = false)} />
  {/if}
</div>

<style>
  .draw { position: fixed; inset: 0; overflow: hidden; }
</style>

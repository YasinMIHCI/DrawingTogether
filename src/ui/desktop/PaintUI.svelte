<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import './desktop.css';
  import type { Editor, SelectOptions, ToolId } from '../../engine/editor';
  import { BRUSH_CATEGORIES, BRUSH_PRESETS } from '../../engine/brush/presets';
  import type { ShapeKind } from '../../engine/tools/shapes';
  import { brushPrefs, brushSettings, isCustomBrush } from '../../lib/brushPrefs.svelte';
  import { activePalette, colorPrefs } from '../../lib/colorPrefs.svelte';
  import { desktopPrefs } from '../../lib/desktopPrefs.svelte';
  import { isDark } from '../../lib/theme.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';
  import type { FileActions } from '../common/types';
  import Icon from '../common/Icon.svelte';
  import type { IconName } from '../common/icons';
  import BrushPreview from '../common/BrushPreview.svelte';
  import { selectBrush, swapColors, tweakActiveBrush } from '../brushActions';
  import { bindShortcuts, createCommands, formatKeys, type Command, type MenuEntry } from './commands';
  import { effectCommands, filterCommands } from './menus';
  import { viewport, type Insets } from './viewport';
  import Dropdown from './Dropdown.svelte';
  import ToolOptionsBar from './ToolOptionsBar.svelte';
  import ColorPicker from './ColorPicker.svelte';
  import LayersDocker from './LayersDocker.svelte';
  import StatusBar from './StatusBar.svelte';
  import Dialogs from './Dialogs.svelte';
  import DSlider from './DSlider.svelte';

  let { editor, files, status, setViewport }: {
    editor: Editor; files: FileActions; status: string; setViewport: (r: Insets | null) => void;
  } = $props();

  let tick = $state(0);
  let shortcuts = $state(false);
  const commands = untrack(() =>
    createCommands(editor, files, {
      togglePanels: () => (desktopPrefs.paintLayers = !desktopPrefs.paintLayers),
      showShortcuts: () => (shortcuts = true),
    }),
  );
  onMount(() => {
    editor.setBrush(brushSettings(brushPrefs.selected.brush), 'brush');
    editor.setBrush(brushSettings(brushPrefs.selected.eraser), 'eraser');
    const unsub = editor.subscribe(() => tick++);
    const unbind = bindShortcuts(commands);
    return () => {
      unsub();
      unbind();
    };
  });

  const s = $derived.by(() => {
    void tick;
    return {
      tool: editor.tool, color: editor.color, shape: { ...editor.shape }, sel: editor.selectOpts.kind,
      canUndo: editor.history.canUndo, canRedo: editor.history.canRedo, notice: editor.notice, clip: editor.hasClipboard,
    };
  });
  $effect(() => {
    if (!s.notice) return;
    const id = setTimeout(() => ((editor.notice = null), editor.notify()), 2500);
    return () => clearTimeout(id);
  });

  const which = $derived<'brush' | 'eraser'>(s.tool === 'eraser' ? 'eraser' : 'brush');
  const brushId = $derived(brushPrefs.selected[which]);
  const brush = $derived((void tick, brushSettings(brushId)));
  const run = (id: string) => commands[id].run();
  const label = (c: Command) => (c.keys ? `${t(c.label)} (${formatKeys(c.keys[0])})` : t(c.label));
  const smallTools: { tool: ToolId; icon: IconName }[] = [
    { tool: 'brush', icon: 'brush' }, { tool: 'fill', icon: 'fill' }, { tool: 'text', icon: 'text' },
    { tool: 'eraser', icon: 'eraser' }, { tool: 'eyedropper', icon: 'eyedropper' }, { tool: 'liquify', icon: 'liquify' },
  ];
  const shapes: ShapeKind[] = ['line', 'rect', 'ellipse', 'polygon'];
  const selKinds: SelectOptions['kind'][] = ['rect', 'ellipse', 'lasso', 'wand'];
  const sizes = [2, 5, 10, 20];
  const VIEW_MENU: MenuEntry[] = [
    'view.fit', 'view.100', 'view.zoomIn', 'view.zoomOut', '-', 'view.rotateLeft', 'view.rotateRight', 'view.resetRotation', '-',
    { head: 'menu.theme' }, 'view.theme.auto', 'view.theme.light', 'view.theme.dark',
    { head: 'menu.interface' }, 'view.ui.auto', 'view.ui.krita', 'view.ui.paint', 'view.ui.mobile', '-', 'help.shortcuts',
  ];
  function setSelect(kind: SelectOptions['kind']) {
    editor.configure('selectOpts', { kind });
    editor.setTool('select');
  }
  function setShape(kind: ShapeKind) {
    editor.configure('shape', { kind });
    editor.setTool('shape');
  }
  const swatches = $derived(activePalette().colors.slice(0, 20));
  const needsOptions = $derived(['fill', 'text', 'select', 'transform', 'liquify', 'shape'].includes(s.tool));
  const brushName = (id: string) => (isCustomBrush(id) ? brushPrefs.custom[id].name : t(`brushes.${id}` as Key));
</script>

<div class="d paint" class:dark={isDark()} class:with-layers={desktopPrefs.paintLayers}>
  <div class="titlebar">
    <Dropdown label={t('menu.file')}>
      {#snippet button()}<span class="filebtn">{t('menu.file')}</span>{/snippet}
      {#snippet children(close)}
        {#each ['file.new', 'file.open', 'file.save', '-', 'file.import', 'file.exportPng', 'file.exportJpg', '-', 'file.home'] as id, i (i)}
          {#if id === '-'}<div class="d-mline"></div>{:else}
            {@const c = commands[id]}
            <button class="d-mitem" disabled={c.enabled ? !c.enabled() : false} onclick={() => (close(), c.run())}><span class="chk"><Icon name={c.icon!} size={15} /></span>{t(c.label)}{#if c.keys}<span class="k">{formatKeys(c.keys[0])}</span>{/if}</button>
          {/if}
        {/each}
      {/snippet}
    </Dropdown>
    <button class="d-ibtn" onclick={() => editor.undo()} disabled={!s.canUndo} title={label(commands['edit.undo'])} aria-label={t('draw.undo')}><Icon name="undo" size={18} /></button>
    <button class="d-ibtn" onclick={() => editor.redo()} disabled={!s.canRedo} title={label(commands['edit.redo'])} aria-label={t('draw.redo')}><Icon name="redo" size={18} /></button>
    <span class="grow"></span>
    <Dropdown label={t('menu.view')} align="right">
      {#snippet button()}<span class="filebtn">{t('menu.view')} ▾</span>{/snippet}
      {#snippet children(close)}
        {#each VIEW_MENU as it, i (i)}
          {#if it === '-'}<div class="d-mline"></div>
          {:else if typeof it === 'object'}<div class="d-mhead">{t(it.head)}</div>
          {:else}
            {@const c = commands[it]}
            <button class="d-mitem" onclick={() => (close(), c.run())}>
              <span class="chk">{#if c.checked}{#if c.checked()}<Icon name="check" size={14} />{/if}{:else if c.icon}<Icon name={c.icon} size={15} />{/if}</span>
              {t(c.label)}{#if c.keys}<span class="k">{formatKeys(c.keys[0])}</span>{/if}
            </button>
          {/if}
        {/each}
      {/snippet}
    </Dropdown>
  </div>

  <div class="ribbon" role="toolbar">
    <!-- Presse-papiers -->
    <section>
      <div class="content">
        <button class="big" onclick={() => run('edit.paste')} disabled={!s.clip} title={label(commands['edit.paste'])}><Icon name="paste" size={26} /><span>{t('select.paste')}</span></button>
        <div class="stack">
          <button class="small" onclick={() => run('edit.cut')} title={label(commands['edit.cut'])}><Icon name="cut" size={16} />{t('select.cut')}</button>
          <button class="small" onclick={() => run('edit.copy')} title={label(commands['edit.copy'])}><Icon name="duplicate" size={16} />{t('select.copy')}</button>
        </div>
      </div>
      <h4>{t('p.clipboard')}</h4>
    </section>
    <!-- Image -->
    <section>
      <div class="content">
        <Dropdown label={t('p.select')}>
          {#snippet button()}<span class="big" class:on={s.tool === 'select'}><Icon name="select" size={26} /><span>{t('p.select')} ▾</span></span>{/snippet}
          {#snippet children(close)}
            {#each selKinds as k (k)}
              <button class="d-mitem" onclick={() => (close(), setSelect(k))}><span class="chk">{#if s.sel === k}<Icon name="check" size={14} />{/if}</span>{t(`select.${k}`)}</button>
            {/each}
            <div class="d-mline"></div>
            {#each ['select.all', 'select.none', 'select.invert', 'edit.clear'] as id (id)}
              {@const c = commands[id]}
              <button class="d-mitem" onclick={() => (close(), c.run())}><span class="chk"></span>{t(c.label)}{#if c.keys}<span class="k">{formatKeys(c.keys[0])}</span>{/if}</button>
            {/each}
          {/snippet}
        </Dropdown>
        <div class="stack">
          <button class="small" class:on={s.tool === 'transform'} onclick={() => editor.setTool('transform')} title={label(commands['tool.transform'])}><Icon name="move" size={16} />{t('tools.transform')}</button>
          <Dropdown label={t('p.rotate')}>
            {#snippet button()}<span class="small"><Icon name="rotateRight" size={16} />{t('p.rotate')} ▾</span>{/snippet}
            {#snippet children(close)}
              {#each ['image.rotateRight', 'image.rotateLeft', 'image.flipH', 'image.flipV'] as id (id)}
                {@const c = commands[id]}
                <button class="d-mitem" onclick={() => (close(), c.run())}><span class="chk"><Icon name={c.icon!} size={15} /></span>{t(c.label)}</button>
              {/each}
            {/snippet}
          </Dropdown>
        </div>
      </div>
      <h4>{t('p.image')}</h4>
    </section>
    <!-- Outils -->
    <section>
      <div class="content tools">
        {#each smallTools as it (it.tool)}
          {@const c = commands[`tool.${it.tool}`]}
          <button class="d-ibtn" aria-pressed={s.tool === it.tool} onclick={c.run} title={label(c)} aria-label={t(c.label)}><Icon name={it.icon} size={18} /></button>
        {/each}
      </div>
      <h4>{t('p.tools')}</h4>
    </section>
    <!-- Pinceaux -->
    <section>
      <div class="content">
        <Dropdown label={t('p.brushes')} wide>
          {#snippet button()}
            <span class="big brushbtn" class:on={s.tool === 'brush' || s.tool === 'eraser'}>
              <span class="bp"><BrushPreview settings={brush} color={s.color} height={30} /></span>
              <span>{brushName(brushId)} ▾</span>
            </span>
          {/snippet}
          {#snippet children(close)}
            <div class="gallery">
              {#each BRUSH_CATEGORIES.filter((c) => (which === 'eraser') === (c === 'eraser')) as cat (cat)}
                <div class="d-mhead">{t(`brushCat.${cat}`)}</div>
                <div class="gal-grid">
                  {#each BRUSH_PRESETS.filter((p) => p.category === cat) as p (p.id)}
                    <button class="gtile" aria-pressed={brushId === p.id} onclick={() => { selectBrush(editor, which, p.id); if (s.tool !== 'eraser') editor.setTool('brush'); close(); }} title={t(`brushes.${p.id}` as Key)}>
                      <span>{t(`brushes.${p.id}` as Key)}</span>
                      <BrushPreview settings={brushSettings(p.id)} color={s.color} height={26} />
                    </button>
                  {/each}
                </div>
              {/each}
              {#if Object.keys(brushPrefs.custom).length}
                <div class="d-mhead">{t('brush.custom')}</div>
                <div class="gal-grid">
                  {#each Object.entries(brushPrefs.custom) as [id, c] (id)}
                    <button class="gtile" aria-pressed={brushId === id} onclick={() => { selectBrush(editor, which, id); close(); }}>
                      <span>{c.name}</span><BrushPreview settings={brushSettings(id)} color={s.color} height={26} />
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/snippet}
        </Dropdown>
      </div>
      <h4>{t('p.brushes')}</h4>
    </section>
    <!-- Formes -->
    <section>
      <div class="content shapes">
        {#each shapes as k (k)}
          <button class="d-ibtn" aria-pressed={s.tool === 'shape' && s.shape.kind === k} onclick={() => setShape(k)} title={t(`shape.${k}`)} aria-label={t(`shape.${k}`)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
              {#if k === 'line'}<path d="M3 17L17 3" />{:else if k === 'rect'}<rect x="3" y="5" width="14" height="10" />{:else if k === 'ellipse'}<ellipse cx="10" cy="10" rx="7" ry="5" />{:else}<path d="M10 3l7 5-3 9H6L3 8z" />{/if}
            </svg>
          </button>
        {/each}
        <div class="stack">
          <button class="small" class:on={!s.shape.fill} onclick={() => editor.configure('shape', { fill: false })}>{t('p.outline')}</button>
          <button class="small" class:on={s.shape.fill} onclick={() => editor.configure('shape', { fill: true })}>{t('p.filled')}</button>
        </div>
      </div>
      <h4>{t('p.shapes')}</h4>
    </section>
    <!-- Taille -->
    <section>
      <div class="content">
        <Dropdown label={t('p.size')}>
          {#snippet button()}
            <span class="big"><svg width="28" height="26" viewBox="0 0 28 26"><path d="M3 5h22" stroke="currentColor" stroke-width="1" /><path d="M3 11h22" stroke="currentColor" stroke-width="2.5" /><path d="M3 19h22" stroke="currentColor" stroke-width="5" /></svg><span>{t('p.size')} ▾</span></span>
          {/snippet}
          {#snippet children(close)}
            {#each sizes as px (px)}
              <button class="d-mitem" onclick={() => { if (s.tool === 'shape') editor.configure('shape', { width: px }); else tweakActiveBrush(editor, { size: px }); close(); }}>
                <span class="line" style:height="{px / 2 + 1}px"></span><span class="k">{px} px</span>
              </button>
            {/each}
            <div class="d-mline"></div>
            <div class="pad">
              <DSlider label={t('brush.size')} value={s.tool === 'shape' ? s.shape.width : brush.size} min={1} max={300} unit="px"
                onchange={(v) => (s.tool === 'shape' ? editor.configure('shape', { width: Math.round(v) }) : tweakActiveBrush(editor, { size: v }))} />
              <DSlider label={t('brush.opacity')} value={Math.round(brush.opacity * 100)} min={1} max={100} unit="%"
                onchange={(v) => tweakActiveBrush(editor, { opacity: v / 100 })} />
            </div>
          {/snippet}
        </Dropdown>
      </div>
      <h4>{t('p.size')}</h4>
    </section>
    <!-- Couleurs -->
    <section>
      <div class="content colors">
        <div class="c12">
          <span class="cbig"><span class="sw1" style:background={s.color}></span>{t('p.color1')}</span>
          <button class="cbig" onclick={() => swapColors(editor)} title={t('cmd.swapColors')}><span class="sw2" style:background={colorPrefs.secondary}></span>{t('p.color2')}</button>
        </div>
        <div class="palette">
          {#each swatches as c, i (c + i)}
            <button class="sw" style:background={c} title={c} aria-label={c} onclick={() => editor.setColor(c)}></button>
          {/each}
        </div>
        <Dropdown label={t('p.editColors')} align="right" wide>
          {#snippet button()}<span class="big"><Icon name="palette" size={26} /><span>{t('p.editColors')}</span></span>{/snippet}
          {#snippet children()}<ColorPicker {editor} {tick} wheel={220} />{/snippet}
        </Dropdown>
      </div>
      <h4>{t('p.colors')}</h4>
    </section>
    <!-- Calques, filtres, effets -->
    <section>
      <div class="content">
        <button class="big" class:on={desktopPrefs.paintLayers} onclick={() => (desktopPrefs.paintLayers = !desktopPrefs.paintLayers)} title={t('p.layersPanel')}><Icon name="layers" size={26} /><span>{t('p.layers')}</span></button>
        <div class="stack">
          {#each [['p.filters', filterCommands()], ['p.effects', effectCommands()]] as const as [lbl, ids] (lbl)}
            <Dropdown label={t(lbl)} align="right">
              {#snippet button()}<span class="small"><Icon name={lbl === 'p.filters' ? 'filters' : 'effect'} size={16} />{t(lbl)} ▾</span>{/snippet}
              {#snippet children(close)}
                {#each ids as id (id)}<button class="d-mitem" onclick={() => (close(), run(id))}><span class="chk"></span>{t(commands[id].label)}</button>{/each}
              {/snippet}
            </Dropdown>
          {/each}
        </div>
      </div>
      <h4>{t('p.layers')}</h4>
    </section>
  </div>

  {#if needsOptions}<div class="opts"><ToolOptionsBar {editor} {tick} brushes={false} /></div>{/if}

  <div class="main">
    <div class="view" use:viewport={setViewport}>
      {#if s.notice}<div class="notice" role="status">{t(`notice.${s.notice}`)}</div>{/if}
    </div>
    {#if desktopPrefs.paintLayers}
      <aside class="layers"><LayersDocker {editor} {tick} /></aside>
    {/if}
  </div>
  <StatusBar {editor} {tick} {status} />
  <Dialogs {editor} {tick} {commands} bind:shortcuts />
</div>

<style>
  .paint { position: absolute; inset: 0; display: flex; flex-direction: column; pointer-events: none; }
  .paint > :global(:not(.main)), .layers { pointer-events: auto; }
  .titlebar { display: flex; align-items: center; gap: 4px; height: 34px; padding: 0 8px; background: var(--d-panel-2); }
  .filebtn { display: inline-flex; align-items: center; height: 26px; padding: 0 12px; border-radius: 5px; font-weight: 600; }
  .filebtn:hover { background: var(--d-hover); }
  .grow { flex: 1; }
  /* Pas de défilement horizontal : il couperait les menus déroulants ; le ruban passe à la ligne si besoin. */
  .ribbon { display: flex; flex-wrap: wrap; align-items: stretch; gap: 0; padding: 4px 6px 0; background: var(--d-panel); border-bottom: 1px solid var(--d-line); position: relative; z-index: 5; }
  section { display: flex; flex-direction: column; padding: 0 8px; border-right: 1px solid var(--d-line); }
  .content { display: flex; align-items: center; gap: 4px; flex: 1; min-height: 70px; }
  h4 { margin: 0; padding: 2px 0 3px; text-align: center; font-size: 11px; font-weight: 400; color: var(--d-soft); white-space: nowrap; }
  .big { display: inline-grid; justify-items: center; gap: 3px; padding: 4px 6px; border-radius: 5px; min-width: 54px; font-size: 12px; cursor: pointer; }
  .big:hover, .small:hover { background: var(--d-hover); }
  .on { background: var(--d-accent-soft); color: var(--d-accent); }
  .stack { display: grid; gap: 2px; }
  .small { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 8px; border-radius: 4px; white-space: nowrap; cursor: pointer; }
  .tools { display: grid; grid-template-columns: repeat(3, 30px); gap: 2px; align-content: center; }
  .shapes { flex-wrap: nowrap; }
  .brushbtn { min-width: 110px; }
  .bp { width: 96px; background: #fff; border-radius: 4px; }
  .gallery { max-height: 60vh; overflow-y: auto; width: 360px; }
  .gal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; padding: 2px 4px 6px; }
  .gtile { display: grid; justify-items: start; padding: 2px 4px; background: #fff; color: #222; border: 1px solid var(--d-line); border-radius: 4px; font-size: 11px; overflow: hidden; }
  .gtile span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .gtile[aria-pressed='true'] { border-color: var(--d-accent); box-shadow: 0 0 0 1px var(--d-accent); }
  .line { display: inline-block; width: 120px; background: currentColor; border-radius: 2px; }
  .pad { display: grid; gap: 4px; padding: 6px; }
  .colors { gap: 8px; }
  .c12 { display: flex; gap: 4px; }
  .cbig { display: grid; justify-items: center; gap: 3px; font-size: 11px; width: 48px; }
  .sw1, .sw2 { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--d-line); }
  .sw1 { box-shadow: 0 0 0 2px var(--d-accent); }
  .palette { display: grid; grid-template-columns: repeat(10, 20px); gap: 3px; }
  .sw { width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(0, 0, 0, 0.15); }
  .opts { border-bottom: 1px solid var(--d-line); }
  .main { flex: 1; display: flex; min-height: 0; }
  .view { flex: 1; position: relative; min-width: 0; }
  .layers { width: 280px; background: var(--d-panel); border-left: 1px solid var(--d-line); display: flex; flex-direction: column; }
  .notice { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); background: rgba(20, 20, 24, 0.9); color: #fff; padding: 6px 12px; border-radius: 6px; pointer-events: none; }
  .d-mitem .chk { width: 16px; display: inline-grid; place-items: center; }
</style>

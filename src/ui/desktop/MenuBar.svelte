<script lang="ts">
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';
  import Icon from '../common/Icon.svelte';
  import { formatKeys, type Command } from './commands';

  export type MenuEntry = string | '-' | { head: Key };
  export interface MenuDef {
    label: Key;
    items: MenuEntry[];
  }

  let { menus, commands, tick }: { menus: MenuDef[]; commands: Record<string, Command>; tick: number } = $props();
  let open = $state(-1);
  let bar: HTMLElement;

  $effect(() => {
    if (open < 0) return;
    const onDown = (e: PointerEvent) => !bar.contains(e.target as Node) && (open = -1);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') open = -1;
      else if (e.key === 'ArrowRight') open = (open + 1) % menus.length;
      else if (e.key === 'ArrowLeft') open = (open - 1 + menus.length) % menus.length;
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  });

  function run(c: Command) {
    open = -1;
    c.run();
  }
</script>

<div class="menubar" bind:this={bar} role="menubar" tabindex="-1">
  {#each menus as m, i (m.label)}
    <div class="slot">
      <button class="top" class:open={open === i} role="menuitem" aria-haspopup="true" aria-expanded={open === i}
        onclick={() => (open = open === i ? -1 : i)} onpointerenter={() => open >= 0 && (open = i)}>{t(m.label)}</button>
      {#if open === i}
        {@const _ = tick}
        <div class="d-popover" role="menu">
          {#each m.items as it, j (j)}
            {#if it === '-'}
              <div class="d-mline"></div>
            {:else if typeof it === 'object'}
              <div class="d-mhead">{t(it.head)}</div>
            {:else if commands[it]}
              {@const c = commands[it]}
              <button class="d-mitem" role="menuitem" disabled={c.enabled ? !c.enabled() : false} onclick={() => run(c)}>
                <span class="chk">
                  {#if c.checked}{#if c.checked()}<Icon name="check" size={14} />{/if}{:else if c.icon}<Icon name={c.icon} size={15} />{/if}
                </span>
                {t(c.label)}
                {#if c.keys}<span class="k">{formatKeys(c.keys[0])}</span>{/if}
              </button>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .menubar { display: flex; align-items: center; height: 28px; padding: 0 4px; background: var(--d-panel-2); border-bottom: 1px solid var(--d-line); }
  .slot { position: relative; }
  .top { padding: 0 10px; height: 24px; border-radius: 4px; }
  .top:hover, .top.open { background: var(--d-hover); }
  .d-popover { top: 26px; left: 0; min-width: 260px; }
</style>

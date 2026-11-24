<script lang="ts">
  import { parseBouille } from '../bouille/model';
  import type { Expression } from '../bouille/render';
  import BouilleImg from './BouilleImg.svelte';
  import Avatar from './Avatar.svelte';

  /** Avatar d'un joueur : sa Bouille (avec une expression) si elle est connue, sinon son image ou un avatar dessiné. */
  let { avatar = 0, url = null, bouille = null, size = 56, expr = 'neutral' }: {
    avatar?: number; url?: string | null; bouille?: string | null; size?: number; expr?: Expression;
  } = $props();
  const b = $derived(bouille ? parseBouille(bouille) : null);
</script>

{#if b}
  <span class="bq" style:width="{size}px" style:height="{size}px"><BouilleImg bouille={b} view="head" {expr} w={size} h={size} /></span>
{:else}
  <Avatar id={avatar} {url} {size} />
{/if}

<style>
  .bq { display: block; border-radius: 50%; background: #f4efe2; overflow: hidden; flex: none; }
  .bq :global(svg) { width: 100%; height: 100%; display: block; }
</style>

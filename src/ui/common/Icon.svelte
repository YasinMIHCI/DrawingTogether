<script lang="ts">
  import { ICONS, type IconName, type Shape } from './icons';
  let { name, size = 24 }: { name: IconName; size?: number } = $props();
  const shapes = $derived(ICONS[name] as Shape[]);
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#each shapes as s, i (i)}
    {#if typeof s === 'string'}
      <path d={s} />
    {:else}
      <circle cx={s.c[0]} cy={s.c[1]} r={s.c[2]} fill={s.fill ? 'currentColor' : 'none'} stroke={s.fill ? 'none' : 'currentColor'} />
    {/if}
  {/each}
</svg>

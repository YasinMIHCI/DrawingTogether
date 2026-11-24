<script lang="ts">
  // 12 avatars dessinés (6 couleurs × 2 expressions), ou l'avatar importé du compte (photo / dessin).
  let { id, size = 56, url = null }: { id: number; size?: number; url?: string | null } = $props();
  const colors = ['#ff6b4a', '#2bb3a3', '#ffc94a', '#7a8cff', '#ff8fc7', '#7ccf6b'];
  const color = $derived(colors[id % colors.length]);
  const happy = $derived(Math.floor(id / colors.length) % 2 === 0);
  let broken = $state(false);
</script>

{#if url && !broken}
  <img src={url} alt="" width={size} height={size} style:width="{size}px" style:height="{size}px" onerror={() => (broken = true)} />
{:else}
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="34" r="26" fill={color} />
    <ellipse cx="32" cy="42" rx="15" ry="11" fill="#fff" opacity="0.35" />
    <circle cx="23" cy="30" r="6" fill="#fff" />
    <circle cx="41" cy="30" r="6" fill="#fff" />
    <circle cx="24" cy="31" r="3" fill="#1f2430" />
    <circle cx="42" cy="31" r="3" fill="#1f2430" />
    {#if happy}
      <path d="M24 42q8 7 16 0" fill="none" stroke="#1f2430" stroke-width="3" stroke-linecap="round" />
    {:else}
      <ellipse cx="32" cy="44" rx="4" ry="5" fill="#1f2430" />
    {/if}
    <path d="M20 10q4 6 8 8M44 10q-4 6-8 8" fill="none" stroke={color} stroke-width="5" stroke-linecap="round" />
  </svg>
{/if}

<style>
  img { border-radius: 50%; object-fit: cover; display: block; background: #fff; }
</style>

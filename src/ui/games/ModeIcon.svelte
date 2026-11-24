<script lang="ts">
  import type { ModeId } from '../../games/modes';
  /** Petites illustrations des modes (dessinées pour le projet). */
  let { mode, size = 64 }: { mode: ModeId; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="#1f2430" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  {#if mode === 'classic'}
    <path d="M8 12h30a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H22l-8 7v-7h-6a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z" fill="#fff" />
    <path d="M12 22h22M12 28h14" />
    <path d="M40 54l16-16 5 5-16 16h-5z" fill="#ffc94a" />
    <path d="M52 42l5 5" />
  {:else if mode === 'story'}
    <path d="M6 14c8-3 18-3 26 2v38c-8-5-18-5-26-2z" fill="#fff" />
    <path d="M58 14c-8-3-18-3-26 2v38c8-5 18-5 26-2z" fill="#ffe7a8" />
    <path d="M12 24h14M12 31h14M12 38h10M38 24h14M38 31h14M38 38h10" />
  {:else if mode === 'flipbook'}
    <rect x="14" y="8" width="38" height="44" rx="4" fill="#dfe7ff" />
    <rect x="10" y="12" width="38" height="44" rx="4" fill="#fff" />
    <circle cx="30" cy="30" r="7" fill="#ff6b4a" />
    <path d="M17 30h4M18 24l3 2M18 36l3-2" stroke="#ff6b4a" />
  {:else if mode === 'corpse'}
    <rect x="16" y="6" width="32" height="16" rx="3" fill="#fff" />
    <rect x="16" y="24" width="32" height="16" rx="3" fill="#ffe7a8" />
    <rect x="16" y="42" width="32" height="16" rx="3" fill="#d9f2ee" />
    <circle cx="32" cy="15" r="5" fill="#fff" />
    <path d="M24 32h16M32 26v12M28 46l-2 8M36 46l2 8" />
  {:else if mode === 'scribble'}
    <rect x="6" y="8" width="52" height="48" rx="6" fill="#fff" />
    <path d="M14 40c6-18 12 6 18-8s10 10 18-6" stroke="#7a8cff" stroke-width="3.5" />
    <path d="M46 16l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#ffc94a" />
  {:else if mode === 'atelier'}
    <path d="M14 58L24 10M50 58L40 10M32 52v8" />
    <rect x="12" y="14" width="40" height="30" rx="2" fill="#fff" />
    <path d="M18 38l8-10 6 6 5-4 9 8" stroke="#2bb3a3" />
    <circle cx="40" cy="22" r="3" fill="#ffc94a" />
  {:else}
    <rect x="6" y="10" width="52" height="40" rx="4" fill="#fff" />
    <path d="M12 40c6-10 12-10 18-4" stroke="#ff6b4a" stroke-width="3.5" />
    <path d="M30 36c6-12 14-14 22-6" stroke="#2bb3a3" stroke-width="3.5" />
    <path d="M44 56l12-12 4 4-12 12h-4z" fill="#ffc94a" />
  {/if}
</svg>

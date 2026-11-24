<script lang="ts">
  /** Icône de salon : carré brillant coloré avec un emoji. */
  let { icon, color, size = 64 }: { icon: string; color: string; size?: number } = $props();
</script>

<span class="ci" style:--c={color} style:width="{size}px" style:height="{size}px" style:font-size="{size * 0.5}px" aria-hidden="true">{icon}</span>

<style>
  .ci {
    position: relative; flex: none; display: grid; place-items: center; border-radius: 26%; overflow: hidden;
    background: linear-gradient(160deg, color-mix(in srgb, var(--c) 55%, #fff), var(--c));
    border: 3px solid #fff; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  }
  .ci::after { content: ''; position: absolute; left: -10%; right: -10%; top: -45%; height: 75%; border-radius: 50%; background: linear-gradient(rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0)); }
</style>

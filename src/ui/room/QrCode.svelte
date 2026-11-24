<script lang="ts">
  import qrcode from 'qrcode-generator';
  let { text, size = 180 }: { text: string; size?: number } = $props();
  // SVG généré localement à partir du lien d'invitation
  const svg = $derived.by(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  });
</script>

<div class="qr" style:width="{size}px" style:height="{size}px">{@html svg}</div>

<style>
  .qr { background: #fff; border-radius: 10px; padding: 6px; }
  .qr :global(svg) { width: 100%; height: 100%; display: block; }
</style>

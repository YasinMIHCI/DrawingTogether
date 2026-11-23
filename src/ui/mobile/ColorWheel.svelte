<script lang="ts">
  import { hsvToHex } from '../../engine/color';

  /** Anneau de teinte + carré saturation (horizontal) / luminosité (vertical). */
  let { h, s, v, size = 280, onchange }: { h: number; s: number; v: number; size?: number; onchange: (h: number, s: number, v: number) => void } = $props();

  let ring: HTMLCanvasElement;
  let square: HTMLCanvasElement;
  const thick = $derived(size * 0.12);
  const rOut = $derived(size / 2);
  const rIn = $derived(size / 2 - thick);
  const side = $derived(Math.floor(rIn * Math.SQRT2 * 0.92));
  // Le rouge est à gauche et la teinte tourne dans le sens horaire
  const angleOf = (hue: number) => Math.PI + (hue / 360) * Math.PI * 2;

  $effect(() => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ring.width = ring.height = Math.round(size * dpr);
    const ctx = ring.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const c = size / 2;
    for (let i = 0; i < 360; i++) {
      const a0 = angleOf(i) - 0.01;
      const a1 = angleOf(i + 1) + 0.01;
      ctx.beginPath();
      ctx.arc(c, c, rOut - 1, a0, a1);
      ctx.arc(c, c, rIn, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = `hsl(${i}, 100%, 50%)`;
      ctx.fill();
    }
  });

  $effect(() => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    square.width = square.height = Math.round(side * dpr);
    const ctx = square.getContext('2d')!;
    const n = square.width;
    ctx.fillStyle = hsvToHex(h, 1, 1);
    ctx.fillRect(0, 0, n, n);
    const white = ctx.createLinearGradient(0, 0, n, 0);
    white.addColorStop(0, '#fff');
    white.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = white;
    ctx.fillRect(0, 0, n, n);
    const black = ctx.createLinearGradient(0, 0, 0, n);
    black.addColorStop(0, 'rgba(0,0,0,0)');
    black.addColorStop(1, '#000');
    ctx.fillStyle = black;
    ctx.fillRect(0, 0, n, n);
  });

  let dragging: 'ring' | 'square' | null = null;
  function local(e: PointerEvent, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function update(e: PointerEvent, el: HTMLElement) {
    const p = local(e, el);
    const c = size / 2;
    if (dragging === 'ring') {
      let a = Math.atan2(p.y - c, p.x - c) - Math.PI;
      a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      onchange((a / (Math.PI * 2)) * 360, s, v);
    } else if (dragging === 'square') {
      const x0 = c - side / 2;
      const ns = Math.max(0, Math.min(1, (p.x - x0) / side));
      const nv = Math.max(0, Math.min(1, 1 - (p.y - x0) / side));
      onchange(h, ns, nv);
    }
  }
  function down(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    const p = local(e, el);
    const c = size / 2;
    const d = Math.hypot(p.x - c, p.y - c);
    dragging = d >= rIn - 4 && d <= rOut + 4 ? 'ring' : Math.abs(p.x - c) <= side / 2 + 6 && Math.abs(p.y - c) <= side / 2 + 6 ? 'square' : null;
    if (!dragging) return;
    el.setPointerCapture(e.pointerId);
    update(e, el);
  }
  const ringKnob = $derived.by(() => {
    const a = angleOf(h);
    const r = (rIn + rOut) / 2;
    return { x: size / 2 + Math.cos(a) * r, y: size / 2 + Math.sin(a) * r };
  });
</script>

<div class="wheel" style:width="{size}px" style:height="{size}px"
  onpointerdown={down} onpointermove={(e) => dragging && update(e, e.currentTarget)} onpointerup={() => (dragging = null)}
  role="slider" aria-label="Color" aria-valuenow={Math.round(h)} tabindex="-1">
  <canvas bind:this={ring} style:width="{size}px" style:height="{size}px"></canvas>
  <canvas class="sq" bind:this={square} style:width="{side}px" style:height="{side}px"></canvas>
  <span class="knob" style:left="{ringKnob.x}px" style:top="{ringKnob.y}px" style:width="{thick + 6}px" style:height="{thick + 6}px" style:background={hsvToHex(h, 1, 1)}></span>
  <span class="knob" style:left="{size / 2 - side / 2 + s * side}px" style:top="{size / 2 - side / 2 + (1 - v) * side}px"
    style:width="{thick + 2}px" style:height="{thick + 2}px" style:background={hsvToHex(h, s, v)}></span>
</div>

<style>
  .wheel { position: relative; touch-action: none; margin: 0 auto; }
  canvas { position: absolute; left: 0; top: 0; }
  .sq { left: 50%; top: 50%; transform: translate(-50%, -50%); }
  .knob { position: absolute; transform: translate(-50%, -50%); border-radius: 50%; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4); pointer-events: none; }
</style>

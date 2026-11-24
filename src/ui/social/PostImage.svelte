<script lang="ts">
  import { postImage } from '../../social/api';

  let { path, alt = '', width, height }: { path: string; alt?: string; width: number; height: number } = $props();
  const src = $derived(postImage(path));
</script>

<div class="frame" style:aspect-ratio="{width} / {height}">
  {#await src then url}<img src={url} {alt} />{/await}
</div>

<style>
  .frame { width: 100%; max-height: 70vh; background: #fff; border-radius: 10px; overflow: hidden; display: grid; place-items: center; }
  img { width: 100%; height: 100%; object-fit: contain; display: block; }
</style>

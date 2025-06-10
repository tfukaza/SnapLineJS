<script lang="ts">
  import { onMount, setContext } from "svelte";
  import { getEngine } from "./engine.svelte";

  let {
    id,
    children,
  }: { id: string; style?: Record<string, string>; children: any } = $props();
  let canvas: HTMLDivElement | null = null;

  const engine = getEngine(id);
  setContext("engine", engine);

  onMount(() => {
    engine.assignDom(canvas as HTMLElement);
  });

  export function enableDebug() {
    engine.enableDebug();
  }

  export function disableDebug() {
    engine.disableDebug();
  }
</script>

<div
  id="snap-canvas"
  bind:this={canvas}
  style="height: 100%; overflow: hidden; position: relative;"
>
  {@render children()}
</div>

<style lang="scss">
</style>

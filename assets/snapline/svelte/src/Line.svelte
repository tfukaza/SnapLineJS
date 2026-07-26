<script lang="ts">
    import type { LineComponent } from "@snap-engine/snapline";
    import { onDestroy, onMount } from "svelte";
    let {
      line,
      className = "",
      pathClassName = "sl-connector-line",
      pathStyle = "",
      showArrow = true,
      data = {},
    }: {
      line: LineComponent;
      className?: string;
      pathClassName?: string;
      pathStyle?: string;
      showArrow?: boolean;
      data?: Record<string, string>;
    } = $props();

    let style = $state("position: absolute; overflow: visible; pointer-events: none; will-change: transform; transform: translate3d(0px, 0px, 0);");
    let dx = $state(0);
    let dy = $state(0);
    let x0 = $state(line.worldTransform.x);
    let y0 = $state(line.worldTransform.y);
    let x1 = $state(0);
    let y1 = $state(0);
    let x2 = $state(0);
    let y2 = $state(0);
    let x3 = $state(0);
    let y3 = $state(0);

    function renderLine() {
      const thisLine: LineComponent = line;
      x0 = thisLine.worldTransform.x;
      y0 = thisLine.worldTransform.y;
      style = `position: absolute; overflow: visible; pointer-events: none; will-change: transform; transform: translate3d(${x0}px, ${y0}px, 0);`;
      dx = thisLine.endWorldX - thisLine.worldTransform.x;
      dy = thisLine.endWorldY - thisLine.worldTransform.y;
        x1 = Math.abs(dx / 2);
        y1 = 0;
        x2 = dx - Math.abs(dx / 2);
        y2 = dy;
        x3 = dx;
        y3 = dy;
    }

    let lineDOM: SVGElement | null = null;
    let cleanupRenderCallback: (() => void) | null = null;

  onMount(() => {
    line.element = (lineDOM as unknown as HTMLElement);
    cleanupRenderCallback = line.onRender(renderLine);
    renderLine();
  });

  onDestroy(() => {
    cleanupRenderCallback?.();
  });
</script>

<svg
  data-snapline-type="connector-line"
  class={className}
  {...Object.fromEntries(Object.entries(data).map(([key, value]) => [`data-${key}`, value]))}
  width="4"
  height="4"
  style={style}
  bind:this={lineDOM}
>
  <path
    class={pathClassName}
    style={pathStyle}
    d={`M 0,0 C ${x1}, ${y1} ${x2}, ${y2} ${x3}, ${y3}`}
    marker-end={showArrow ? `url(#arrow-${line.id})` : undefined}
  />
  {#if showArrow}
    <marker id={`arrow-${line.id}`} viewBox="0 0 24 24" refX="0" refY="12" orient="auto">
      <polygon points="4,4 20,12 4,22" fill="#545454"/>
    </marker>
  {/if}
</svg>

<style>
  svg {
    z-index: 1000;
  }
  path {
    fill: none;
    stroke: #545454;
    stroke-width: 4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>

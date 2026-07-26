<script lang="ts">
    import type { LineComponent, LineGeometrySnapshot } from "@snap-engine/snapline";
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

    function pathForGeometry(geometry: LineGeometrySnapshot): string {
      const { x: dx, y: dy } = geometry.delta;
      const x1 = Math.abs(dx / 2);
      return `M 0,0 C ${x1}, 0 ${dx - x1}, ${dy} ${dx}, ${dy}`;
    }

    let lineDOM: SVGElement | null = null;
    let pathDOM: SVGPathElement | null = null;
    let cleanupRenderCallback: (() => void) | null = null;
    const initialGeometry = line.geometrySnapshot();

  onMount(() => {
    cleanupRenderCallback = line.bindGeometryWriter((geometry) => {
      if (!lineDOM || !pathDOM) return;
      lineDOM.style.transform = `translate3d(${geometry.start.x}px, ${geometry.start.y}px, 0)`;
      pathDOM.setAttribute("d", pathForGeometry(geometry));
    });
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
  style={`position: absolute; overflow: visible; pointer-events: none; will-change: transform; transform: translate3d(${initialGeometry.start.x}px, ${initialGeometry.start.y}px, 0);`}
  bind:this={lineDOM}
>
  <path
    bind:this={pathDOM}
    class={pathClassName}
    style={pathStyle}
    d={pathForGeometry(initialGeometry)}
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

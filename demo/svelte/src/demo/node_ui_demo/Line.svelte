<script lang="ts">
  import { onMount } from "svelte";
  import type { LineMirror, LineGeometrySnapshot } from "@snap-engine/snapline";
  import {blur} from "svelte/transition";

  let { line }: { line: LineMirror } = $props();

  const radius = 10;
  let svgDOM: SVGSVGElement;
  let pathDOM: SVGPathElement;
  let endRectDOM: SVGRectElement;
  let endCircleDOM: SVGCircleElement;

  function pathForGeometry(geometry: LineGeometrySnapshot): string {
    const { x: dx, y: dy } = geometry.delta;
    const x1 = dx > 0 ? Math.abs(dx / 2) : radius;
    const arc_1 = `A ${radius} ${radius} 0 0 ${dy > 0 ? 1 : 0} ${x1} ${dy > 0 ? radius : -radius}`;
    const arc_2 = `A ${radius} ${radius} 0 0 ${dy > 0 ? (dx > 0 ? 0 : 1) : dx > 0 ? 1 : 0} ${x1 + (dx > 0 ? radius : -radius)} ${dy}`;
    return `M 0,0 h ${x1 - radius} ${arc_1} v ${dy - 2 * (dy > 0 ? radius : -radius)} ${arc_2} h ${dx > 0 ? dx / 2 - radius : dx - radius} `;
  }

  onMount(() => {
    return line.bindGeometryWriter((geometry) => {
      svgDOM.style.transform = `translate3d(${geometry.start.x}px, ${geometry.start.y}px, 0)`;
      pathDOM.setAttribute("d", pathForGeometry(geometry));
      endRectDOM.setAttribute("x", String(geometry.delta.x - 16));
      endRectDOM.setAttribute("y", String(geometry.delta.y - 1.5));
      endCircleDOM.setAttribute("cx", String(geometry.delta.x));
      endCircleDOM.setAttribute("cy", String(geometry.delta.y));
    });
  });
</script>

<svg
  data-snapline-type="connector-line"
  width="4"
  height="4"
  style="position: absolute; overflow: visible; pointer-events: none; will-change: transform;"
  bind:this={svgDOM}
  transition:blur|global={{ duration: 200 }}
>
  <defs>
    <linearGradient id="line-start-gradient" gradientTransform="rotate(0)">
      <stop offset="0%" stop-color="#c34421" />
      <stop offset="100%" stop-color="#F76E33" />
    </linearGradient>
    <linearGradient id="line-end-gradient" gradientTransform="rotate(0)">
      <stop offset="0%" stop-color="#F76E33" />
      <stop offset="100%" stop-color="#c34421" />
    </linearGradient>
  </defs>
  <path bind:this={pathDOM} class="sl-connector-line" />
  <rect x={-1} y={-1} width={16} height={3} fill="url(#line-start-gradient)" />
  <rect
    bind:this={endRectDOM}
    x="-16"
    y="-1.5"
    width={16}
    height={3}
    fill="url(#line-end-gradient)"
  />
  <circle cx={0} cy={0} r="6" />
  <circle bind:this={endCircleDOM} cx="0" cy="0" r="6" />
</svg>

<!-- <svg
  data-snapline-type="connector-line"
  width="4"
  height="4"
  style={shadowStyle}
  class="shadow"
>
  <path
    class="sl-connector-line shadow-line"
    d={path}
    marker-end="url(#arrow)"
  />
</svg> -->

<style>
  svg {
    z-index: 1000;
    pointer-events: none;
  }
  path {
    fill: none;
    stroke: #f76e33;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    border-radius: 10px;
  }
  circle {
    fill: #f76e33;
  }
  .shadow {
    z-index: 0;
  }
  .shadow-line {
    fill: none;
    stroke: #32333845;
    stroke-width: 4;
    stroke-linecap: round;
    filter: blur(5px);
  }
</style>

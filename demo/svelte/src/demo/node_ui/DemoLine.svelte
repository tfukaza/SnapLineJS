<script lang="ts">
    import type { LineComponent } from "../../../../index";
    import { onMount } from "svelte";
    let { line }: { line: { line: LineComponent, gid: string, positionX: number, positionY: number, endPositionX: number, endPositionY: number } } = $props();
    
    let shadowOffset = 6;
    let style = $state("position: absolute; overflow: visible; pointer-events: none; will-change: transform;");
    let shadowStyle = $state("position: absolute; overflow: visible; pointer-events: none; will-change: transform; transform: translate3d(0px, 0px, 0);");
    let endX = $state(0);
    let endY = $state(0);
    let path = $state("");

    let radius = 10;

    function renderLine() { 
      // For now, assume the line starts heading to the right 
      const thisLine:LineComponent = line.line;
      const x0 = thisLine.transform.x;
      const y0 = thisLine.transform.y;
      style = `position: absolute; overflow: visible; pointer-events: none; will-change: transform;`;
      shadowStyle = `position: absolute; overflow: visible; pointer-events: none; will-change: transform; transform: translate3d(${x0 + shadowOffset}px, ${y0 + shadowOffset}px, 0);`;
      const dx = thisLine.endWorldX - thisLine.transform.x;
      const dy = thisLine.endWorldY - thisLine.transform.y;
      const x1 = dx > 0 ? Math.abs(dx / 2) : radius;
      const x3 = dx;
      const y3 = dy;
      const arc_1 = `A ${radius} ${radius} 0 0 ${dy > 0 ? 1 : 0} ${x1} ${dy > 0 ? radius : -radius}`;
      const arc_2 = `A ${radius} ${radius} 0 0 ${dy > 0 ? (dx > 0 ? 0 : 1) : (dx > 0 ? 1 : 0)} ${x1 + (dx > 0 ? radius : -radius)} ${y3}`;
      path = `M 0,0 h ${x1 - radius} ${arc_1} v ${y3 - 2*(dy > 0 ? radius : -radius)} ${arc_2} h ${dx > 0 ? x3/2 - radius : x3 - radius} `;
      endX = x3;
      endY = y3;
    }

  onMount(() => {
    renderLine();
    line.line.writeTransform();
    line.line.callback.afterWrite1 = renderLine;
    line.line.callback.afterWrite2 = renderLine;
  });
</script>

<svg
  data-snapline-type="connector-line"
  width="4"
  height="4"
  style={style}
  bind:this={line.line.element as any}
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
  <path
    class="sl-connector-line"
    d={path}
  />
  <rect x={-1} y={-1} width={16} height={3} fill="url(#line-start-gradient)" />
  <rect x={endX-16} y={endY-1.5} width={16} height={3} fill="url(#line-end-gradient)" />
  <circle cx={0} cy={0} r="6" />
  <circle cx={endX} cy={endY} r="6" />
 
</svg>

<svg
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
 
</svg>

<style>
  svg {
    z-index: 1000;
    pointer-events: none;
  }
  path {
    fill: none;
    stroke: #F76E33;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    border-radius: 10px;
  }
  circle {
    fill: #F76E33;
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
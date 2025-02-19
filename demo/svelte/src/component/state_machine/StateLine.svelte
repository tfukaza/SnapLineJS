<script lang="ts">
    import type { LineComponent } from "../../lib/snapline.mjs";
    let { line }: { line: { line: LineComponent, x_start: number, y_start: number, x_end: number, y_end: number, radius: number } } = $props();
    let style = $derived(`position: absolute; overflow: visible; pointer-events: none; will-change: transform; transform: translate3d(${line.x_start}px, ${line.y_start}px, 0);`);
    let dx = $derived(line.x_end - line.x_start);
    let dy = $derived(line.y_end - line.y_start);
    let distance = $derived(Math.sqrt(dx * dx + dy * dy));
    let startX = $derived(dx * (line.radius - 21) / distance);
    let startY = $derived(dy * (line.radius - 21) / distance);
    let endX = $derived(dx);
    let endY = $derived(dy);
</script>


{#if (startX && startY && endX && endY) || line.line.connectedToSelf}
  <svg
    data-snapline-type="connector-line"
    width="4"
    height="4"
    style={style}
  >
    <marker id="arrow" viewBox="0 0 24 24" refX="6" refY="12" orient="auto">
      <polygon points="4,4 20,12 4,22" fill="#545454"/>
    </marker>
    {#if line.line.connectedToSelf} 
      <path d="M 30, -30  C 60, -60 -60, -60 -30, -30" fill="none" stroke-width="4" marker-end="url(#arrow)" />
    {:else}
      <line
        class="sl-connector-line"
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        marker-end="url(#arrow)"
      />
    {/if}
    <text x={(startX+endX)/2} y={(startY+endY)/2} font-size="12" fill="#545454">{distance.toFixed(2)}</text>
  </svg>
{/if}

<style>
  svg {
    z-index: 1000;
  }
  line, path {
    fill: none;
    stroke: #545454;
    stroke-width: 4;
    /* arrow */
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  text {
    font-size: 16px;
    fill: #545454;
  }
</style>
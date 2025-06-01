<script lang="ts">
    import type { LineComponent } from "../../../../../src/index";
    import { onMount } from "svelte";
    let { line }: { line: { line: LineComponent, gid: string, positionX: number, positionY: number, endPositionX: number, endPositionY: number } } = $props();
    
    let style = $state("position: absolute; overflow: visible; pointer-events: none; will-change: transform; transform: translate3d(0px, 0px, 0);");
    let dx = $state(0);
    let dy = $state(0);
    let x0 = $state(line.line.transform.x);
    let y0 = $state(line.line.transform.y);
    let x1 = $state(0);
    let y1 = $state(0);
    let x2 = $state(0);
    let y2 = $state(0);
    let x3 = $state(0);
    let y3 = $state(0);

    function renderLine() {  
      const thisLine:LineComponent = line.line;
        x0 = thisLine.transform.x;
        y0 = thisLine.transform.y;
        style = `position: absolute; overflow: visible; pointer-events: none; will-change: transform; transform: translate3d(${x0}px, ${y0}px, 0);`;
        dx = thisLine.endWorldX - thisLine.transform.x;
        dy = thisLine.endWorldY - thisLine.transform.y;
        x1 = Math.abs(dx / 2);
        y1 = 0;
        x2 = dx - Math.abs(dx / 2);
        y2 = dy;
        x3 = dx;
        y3 = dy;
        // console.log(x0, y0, x1, y1, x2, y2, x3, y3);
    }

    let lineDOM: SVGElement | null = null; 

  onMount(() => {
    line.line.element = (lineDOM as unknown as HTMLElement);
    line.line.callback.afterPostWrite = renderLine;
  });
</script>

<svg
  data-snapline-type="connector-line"
  width="4"
  height="4"
  style={style}
  bind:this={lineDOM}
>
  <path
    class="sl-connector-line"
    d={`M 0,0 C ${x1}, ${y1} ${x2}, ${y2} ${x3}, ${y3}`}
    marker-end="url(#arrow)"
  />
  <marker id="arrow" viewBox="0 0 24 24" refX="0" refY="12" orient="auto">
    <polygon points="4,4 20,12 4,22" fill="#545454"/>
  </marker>
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
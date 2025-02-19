<script lang="ts">
    import type { LineComponent } from "../../lib/snapline.mjs";
    let { line }: { line: { line: LineComponent, x_start: number, y_start: number, x_end: number, y_end: number } } = $props();
    let style = $derived(`position: absolute; overflow: visible; pointer-events: none; will-change: transform; transform: translate3d(${line.x_start}px, ${line.y_start}px, 0);`);
    let dx = $derived(line.x_end - line.x_start);
    let dy = $derived(line.y_end - line.y_start);
    let x1 = $derived(Math.abs(dx / 2));
    let y1 = $derived(0);
    let x2 = $derived(dx - Math.abs(dx / 2));
    let y2 = $derived(dy);
    let x3 = $derived(dx);
    let y3 = $derived(dy);

    let offset = $derived(
      line.line.target != null || 
      (
        line.line.g.hoverDOM != null && 
        line.line.g.hoverDOM.getAttribute("data-snapline-type") == "connector" &&
        line.line.start.gid != line.line.g.hoverDOM.getAttribute("data-snapline-gid")
        ) ? -24 : 0);
</script>

<svg
  data-snapline-type="connector-line"
  width="4"
  height="4"
  style={style}
>

  <path
    class="sl-connector-line"
    d={`M 0,0 C ${x1}, ${y1} ${x2}, ${y2} ${x3 + offset}, ${y3}`}
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
    /* arrow */
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
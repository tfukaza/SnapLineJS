<script lang="ts">
    // import type { LineComponent } from "../../lib/snapline.mjs";
    let { line }: { line: { x_start: number, y_start: number, x_end: number, y_end: number } } = $props();
    let style = $derived(`position: absolute; overflow: visible; pointer-events: none; will-change: transform; transform: translate3d(${line.x_start}px, ${line.y_start}px, 0);`);
</script>

<svg
  data-snapline-type="connector-line"
  width="4"
  height="4"
  style={style}
>
  <line
    class="sl-connector-line"
    x1="0"
    y1="0"
    x2={line.x_end - line.x_start}
    y2={line.y_end - line.y_start}
  />
</svg>
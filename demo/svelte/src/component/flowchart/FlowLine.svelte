<script lang="ts">
    import { LineComponent, NodeComponent } from "../../lib/snapline.mjs";
    import { onMount } from "svelte";
    let { line }: { line: { line: LineComponent, gid: string, positionX: number, positionY: number, endPositionX: number, endPositionY: number } } = $props();
// 
    // console.debug("FlowLine", line.line.worldX, line.line.worldY, line.line.endWorldX, line.line.endWorldY);

    // let style = $derived(`position: absolute; overflow: visible; pointer-events: none; will-change: transform; transform: translate3d(${positionX}px, ${positionY}px, 0);`);
    // let dx = $derived(endPositionX - positionX);
    // let dy = $derived(endPositionY - positionY);
    // let x1 = $derived(Math.abs(dx / 2));
    // let y1 = $derived(0);
    // let x2 = $derived(dx - Math.abs(dx / 2));
    // let y2 = $derived(dy);
    // let x3 = $derived(dx);
    // let y3 = $derived(dy);

    let style = $state("");
    let dx = $state(0);
    let dy = $state(0);
    let x0 = $state(line.line.worldX);
    let y0 = $state(line.line.worldY);
    let x1 = $state(0);
    let y1 = $state(0);
    let x2 = $state(0);
    let y2 = $state(0);
    let x3 = $state(0);
    let y3 = $state(0);

    function renderLine() {  
        // console.log(`Rendering line ${this.gid} in Svelte`, this.parent.worldX, this.parent.worldY, this.worldX, this.worldY, this.endWorldX, this.endWorldY);
        x0 = this.parent.worldX;
        y0 = this.parent.worldY;
        style = `position: absolute; overflow: visible; pointer-events: none; will-change: transform; transform: translate3d(${x0}px, ${y0}px, 0);`;
        dx = this.endWorldX - this.parent.worldX;
        dy = this.endWorldY - this.parent.worldY;
        x1 = Math.abs(dx / 2);
        y1 = 0;
        x2 = dx - Math.abs(dx / 2);
        y2 = dy;
        x3 = dx;
        y3 = dy;
    }

    // let offset = $derived(
    //   line.line.target != null || 
    //   (
    //     line.line.g.hoverDOM != null && 
    //     line.line.g.hoverDOM.getAttribute("data-snapline-type") == "connector" &&
    //     line.line.start.gid != line.line.g.hoverDOM.getAttribute("data-snapline-gid")
    //     ) ? -24 : 0);
    let lineDOM: SVGElement | null = null; 
    // let lineObject = new LineComponent(nodeObject.g, nodeObject);

    onMount(() => {
        line.line.assignDom(lineDOM);
        line.line.renderLine = renderLine.bind(line.line);
        console.log(`Mounting line ${line.line.gid} in Svelte`);
        // line.submitRender();
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
    /* arrow */
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
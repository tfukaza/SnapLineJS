<script lang="ts">
  import { Engine } from "@snap-engine/asset-base-svelte";
  import ResizableNode from "./ResizableNode.svelte";
  import SimpleNode from "../node_ui_demo/SimpleNode.svelte";
</script>

<Engine id="node-ui-resize-canvas">
  <div id="node-ui-resize">
    <div id="sl-background"></div>
    <!-- Node A is resizable (BR hitbox); Node B is a plain fixed node. Connect
         A's output to B's input, then resize A: its output connector moves and
         the line must stay glued. -->
    <ResizableNode title="Resizable A" x={120} y={140} resizable />
    <SimpleNode title="Fixed B" x={560} y={200} />
    <ResizableNode title="TL Anchor C" x={340} y={480} resizable resizeAnchor="tl" />
  </div>
</Engine>

<style>
  #node-ui-resize {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  :global(.node),
  :global(.rnode) {
    pointer-events: auto;
  }
  #sl-background {
    position: absolute;
    inset: 0;
    pointer-events: auto;
  }
</style>

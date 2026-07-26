<script lang="ts">
  import { Engine } from "@snap-engine/asset-base-svelte";
  import { Select } from "@snap-engine/snapline-svelte";
  import DemoGraph from "./DemoGraph.svelte";
  import SimpleNode from "./SimpleNode.svelte";
</script>

<Engine id="node-ui-demo-canvas">
  <div id="node-ui-demo">
    <div id="sl-background"></div>
    <Select />
    <DemoGraph />
    <SimpleNode title="Node A" x={120} y={120} />
    <SimpleNode title="Node B" x={440} y={170} />
    <SimpleNode title="Node C" x={280} y={360} maxIncoming={2} />
  </div>
</Engine>

<style>
    #node-ui-demo {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }
    
    :global(.node) {
        pointer-events: auto;
    }

    #sl-background {
        position: absolute;
        inset: 0;
        pointer-events: auto;
    }
</style>

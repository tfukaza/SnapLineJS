<script lang="ts">
  import { NodeMirror } from "@snap-engine/snapline";
  import { Connector, Node } from "@snap-engine/snapline-svelte";
  import DemoLine from "./Line.svelte";
  import { onMount } from "svelte";

  let node: any = $state(null);
  let text: string = $state("Hello World");
  let fontSize: number = $state(20);
  let { nodeObject }: { nodeObject?: NodeMirror | null } = $props();

  // Dataflow is application-owned now: SnapLine no longer propagates values
  // through connectors; this demo shows its local defaults.
  onMount(() => {
    nodeObject = (node as any).getNodeObject();
  });
</script>

<Node bind:this={node} className="node card" LineSvelteComponent={DemoLine} nodeObject={nodeObject}>
  <div class="row-container">
    <Connector name="text" rules={{ maxOutgoing: 0, maxIncoming: 1, onFull: "replace-oldest" }} />
    <p>Text</p>
  </div>
  <div class="row-container">
    <Connector name="font-size" rules={{ maxOutgoing: 0, maxIncoming: 1, onFull: "replace-oldest" }} />
    <p>Font Size</p>
  </div>
  <hr/>
  <div class="row-container">
    <h1 style="font-size: {fontSize}px;">{text}</h1>
  </div>
</Node>

<style lang="scss">
  
  h1 {
    font-size: 20px;
    grid-column: 2/3;
    text-align: left;
    width: 100%;
  }

  hr {
    margin: var(--size-12) 0px;
    border: 1px solid var(--color-background-tint);
  }

  p {
    font-size: x-small;
    width: 100%;
    text-align: left;
  
  }

  .row-container {
    width: 300px;
    overflow: hidden;
  }

</style>

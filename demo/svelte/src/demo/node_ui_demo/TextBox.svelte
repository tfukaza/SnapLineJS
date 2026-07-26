<script lang="ts">
  import { Connector, Node } from "@snap-engine/snapline-svelte";
  import DemoLine from "./Line.svelte";
  import { NodeMirror } from "@snap-engine/snapline";
  import { onMount } from "svelte";

  let node: any = $state(null);
  let { nodeObject, text }: { nodeObject?: NodeMirror | null, text?: string | null } = $props();
  let input: HTMLInputElement | null = null;

  // Dataflow is application-owned now: SnapLine no longer propagates values
  // through connectors; the input edits local state only.
  onMount(() => {
    nodeObject = (node as any).getNodeObject();
    if (text) {
      input!.value = text;
    }
  });
</script>

<Node bind:this={node} className="node card" LineSvelteComponent={DemoLine} nodeObject={nodeObject}>
  <div class="row-container">
    <input type="text" bind:this={input} />
    <Connector name="text" rules={{ maxIncoming: 0 }} />
  </div>
</Node>

<style lang="scss">

 input {
    grid-column: 1 / 3;
    width: 100px;
    margin-left: var(--size-12);
    height: var(--size-24);
 }


 
</style>

<script lang="ts">
  import Connector from "./../../../../../svelte/src/lib/node_ui/Connector.svelte";
  import Node from "./../../../../../svelte/src/lib/node_ui/Node.svelte";
  import DemoLine from "./Line.svelte";
  import { NodeComponent } from "./../../../../../../src/asset/node_ui/node";
  import { onMount } from "svelte";

  let node: any = $state(null);
  let { nodeObject, text }: { nodeObject?: NodeComponent | null, text?: string | null } = $props();
  let input: HTMLInputElement | null = null;

  onMount(() => {
    nodeObject = (node as any).getNodeObject();
    if (text) {
      input!.value = text;
      nodeObject!.setProp("text", text);
    }
  });

  function onInput(e: any) {
    const text = (e.target as any).value;
    nodeObject?.setProp("text", text);
  }
</script>

<Node bind:this={node} className="node card" LineSvelteComponent={DemoLine} nodeObject={nodeObject}>
  <div class="row-container">
    <input type="text" oninput={onInput} bind:this={input} />
    <Connector name="text" maxConnectors={0} allowDragOut={true} />
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

<script lang="ts">
  import Connector from "../lib/Connector.svelte";
  import Node from "../lib/Node.svelte";
  import { onMount } from "svelte";

  let output = $state(0);
  let node: Node | null = $state(null);

  onMount(() => {
    node.addSetPropCallback("input", (prop) => {
      output = prop;
    });
  });

</script>

<Node bind:this={node} className="flow-event">
    <div class="flow-event-container"> 
        <div class="flow-event-output" style={`font-size: ${output}px;`}>{output}</div>
        <Connector name="input" maxConnectors={1} allowDragOut={false} />
    </div>
</Node>

<style lang="scss">
    :global(.flow-event) {

        min-width: 50px;
        user-select: none;
        padding: 10px;
        background-color: #fff;
        border: 1px solid #ccc;
        border-radius: 5px;
        box-sizing: border-box;

        &[data-selected="true"] {
            border:1px solid rgb(3, 166, 194);
        }

        .flow-event-output {
            font-size: 48px;
            font-weight: bold;
            color: #333;
        }
    }
</style>

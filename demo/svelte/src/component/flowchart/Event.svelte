<script lang="ts">
  import FlowNode from "./FlowNode.svelte";
  import { NodeComponent } from "../../lib/snapline.mjs";
  import Connector from "../lib/Connector.svelte";
  let { nodeObject }: { nodeObject: NodeComponent } = $props();

  let inputValue = $state("Hello World");

  let dragging = $state(false);

  // nodeObject._callbackIndex.nodeDragStart = (gid: string) => {
  //   dragging = true;
  // };
  // nodeObject._callbackIndex.nodeDragEnd = (gid: string) => {
  //   dragging = false;
  // };
</script>

<FlowNode nodeObject={nodeObject} className="flow-event">
    <div class="flow-event-container">
        <Connector name="input" nodeObject={nodeObject} maxConnectors={1} allowDragOut={false} />
        <input type="text" bind:value={inputValue} style={dragging ? "user-select: none;" : "user-select: none;"} on:mousedown={(e) => {
            console.log("clicked");
            e.stopPropagation();
        }} />
        <Connector name="output" nodeObject={nodeObject} maxConnectors={0} allowDragOut={true} />
    </div>
</FlowNode>

<style lang="scss">
    :global(.flow-event) {
       
        padding: 10px;
        background-color: #fff;
        border: 1px solid #ccc;
        border-radius: 5px;

        .flow-event-container {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 10px;
            justify-content: center;
            width: 100%;
        }

        :global(.sl-connector) {
          position: relative;
        }

        input {
            user-select: none;
            padding: 10px;
            height: 30px;
            border: 0px solid #ccc;
            border-radius: 5px;

            &:focus {
                border: 1px solid #ccc;
            }
        }
    }
    
</style>

<script lang="ts">
  import StateNode from "./StateNode.svelte";
  import { NodeComponent } from "../../lib/snapline.mjs";
  import StateConnector from "./StateConnector.svelte";
  let { nodeObject}: { nodeObject: NodeComponent,} = $props();

  let dragging = $state(false);

  nodeObject.nodeDragStart = () => {
    dragging = true;
  };
  nodeObject.nodeDragEnd = () => {
    dragging = false;
  };

  let radius = $state(50);
</script>
  
<StateNode nodeObject={nodeObject} className="state" radius={radius}>
  <div class="handle" style="--var-handle-radius: {radius}px;"></div>
  <StateConnector name="border" nodeObject={nodeObject} maxConnectors={256} allowDragOut={true} radius={radius} />
</StateNode>

<style lang="scss">

  
    :global(.state) {

      position: relative;
      z-index: 1;
      width: auto;
      height: auto;

      display: grid;
      grid-template-columns: 1fr;
      grid-template-rows: 1fr;
      align-items: center;
      justify-items: center;


      .handle {
        user-select: none;
        cursor: move;
        z-index: 100;
        position: relative;
        top: 0;
        left: 0;
        width: var(--var-handle-radius);
        height: var(--var-handle-radius);
        background-color: rgb(255, 255, 255);
        border: 2px solid #ccc;
        box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
        grid-column: 1 / 2;
        grid-row: 1 / 2;

        border-radius: 50%;

        &:hover {
          background-color: rgb(255, 255, 255);
          box-shadow: 0 0 16px 0 rgba(0, 0, 0, 0.1);
        }
        
      }
  
    }
    
</style>

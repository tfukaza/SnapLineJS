<script lang="ts">
  import NodeUIDemo from "./demo/node_ui/NodeUIDemo.svelte";
  import DragDropDemo from "./demo/drag_and_drop/DragDropDemo.svelte";
  import Landing from "./welcome/Landing.svelte";
  // let selected = $state("drag_and_drop");
</script>

<!-- <select bind:value={selected}>
  <option value="flowchart">Flowchart</option>
  <option value="state_machine">State Machine</option>
  <option value="drag_and_drop">Drag and Drop</option>
</select> -->
  

  <Landing />
  <div class="app-container">
    <NodeUIDemo />
  </div>
  <div class="app-container">
    <DragDropDemo />
  </div>

  <!-- {#if (selected === "flowchart")}
    <NodeUIDemo />
  {:else if (selected === "drag_and_drop")}
    <DragDropDemo />
  {/if} -->


<style lang="scss">
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #ffffff;
  }
    .app-container {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: #f8f8f8;
      padding: 0px 10%;
      box-sizing: border-box;
  }
 
</style>

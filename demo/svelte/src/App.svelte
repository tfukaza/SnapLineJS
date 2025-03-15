<script lang="ts">
  import FlowChartDemo from "./component/flowchart/FlowChartDemo.svelte";
  // import StateMachineDemo from "./component/state_machine/StateMachineDemo.svelte";
  import DragDropDemo from "./component/drag/DragDropDemo.svelte";

  let selected = $state("flowchart");
</script>

<select bind:value={selected}>
  <option value="flowchart">Flowchart</option>
  <option value="state_machine">State Machine</option>
  <option value="drag_and_drop">Drag and Drop</option>
</select>
  
<div class="app-container">

  {#if (selected === "flowchart")}
    <FlowChartDemo />
  {:else if (selected === "state_machine")}
    <!-- <StateMachineDemo /> -->
  {:else if (selected === "drag_and_drop")}
    <DragDropDemo />
  {/if}
</div>

<style lang="scss">


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

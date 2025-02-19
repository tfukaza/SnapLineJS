<script lang="ts">
  import SnapLineSvelte  from "./component/lib/SnapLineSvelte.svelte";
  // import addNode from "./component/flowchart/add";
  import addNode from "./component/state_machine/add";
  import { onMount } from "svelte";
  let nodes = $state([]);

  onMount(() => {
    nodes.push(...addNode());
  });
</script>

<div class="app-container">
  <SnapLineSvelte nodes={nodes} config={{
    cameraConfig: {
      // enablePan: false,
      // enableZoom: false,
    },
  }} />
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

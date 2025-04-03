<script lang="ts">
    import Canvas from "../../lib2/Canvas.svelte";
    import CameraControl from "../../lib2/CameraControl.svelte";
    import Select from "../../lib2/node_ui/Select.svelte";
    import Background from "../../lib2/Background.svelte";
    import { addNode } from "./add";
    import { onMount } from "svelte";
    import type { ObjectData } from "../../lib2/engine.svelte";
    let objects: ObjectData[] = $state([]);
  
    onMount(() => {
      objects.push(...addNode());
    });

  </script>``
  
  <div class="app-container">
    <Canvas id="flowchart">
      <CameraControl>
        <Background />
        <Select />
        {#each objects as object}
          <object.svelteComponent />
        {/each}      
      </CameraControl>
    </Canvas>
  </div>
  
<style lang="scss">
  :global(#snap-canvas) {
    width: 100%;
    height: 100%;
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

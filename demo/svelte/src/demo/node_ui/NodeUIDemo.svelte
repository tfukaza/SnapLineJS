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
  
    <Canvas id="flowchart">
      <CameraControl>
        <Background />
        <Select />
        {#each objects as object}
          <object.svelteComponent />
        {/each}      
      </CameraControl>
    </Canvas>
  
<style lang="scss">
  :global(#snap-canvas) {
    width: 100%;
    height: 100%;
  }

</style>

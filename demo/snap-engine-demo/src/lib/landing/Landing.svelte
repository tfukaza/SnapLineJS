<script lang="ts">
  import Canvas from "../../../../svelte/src/lib/Canvas.svelte";
  import CameraControl from "../../../../svelte/src/lib/CameraControl.svelte";

  import Menu from "./Menu.svelte";
  import NodeUIDemo from "./node_ui_demo/NodeUIDemo.svelte";
  import DragDropDemo from "./drag_drop_demo/DragDropDemo.svelte";
  import Stub from "./Stub.svelte";

  let currentDemo = $state(0);
  let debugEnabled = $state(false);
  let canvas: Canvas;

  function toggleDebug() {
    debugEnabled = !debugEnabled;
    if (debugEnabled) {
      canvas.enableDebug();
    } else {
      canvas.disableDebug();
    }
  }
</script>

<div class="page-width" id="landing" style="height: 80vh; position: relative">
  <div id="debug-toggle">
    <label>
      <input type="checkbox" onchange={toggleDebug} />
      Debug Mode
    </label>
  </div>
  <Canvas id="welcome-canvas" bind:this={canvas}>
    <CameraControl panLock={false} zoomLock={true}>
      <Menu bind:currentDemo />

      {#if currentDemo === 0}
        <Stub />
      {/if}
      {#if currentDemo === 1}
        <NodeUIDemo />
      {/if}
      {#if currentDemo === 2}
        <DragDropDemo />
      {/if}
    </CameraControl>
  </Canvas>
</div>

<style lang="scss">
  #landing {
    background-color: var(--color-background);
    overflow: hidden;
    border-radius: var(--size-12);
  }

  #debug-toggle {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 100;
  }

  #drag-and-drop-container {
    display: flex;
    flex-direction: row;

    position: absolute;
    top: 15%;
    left: 50%;
    transform: translate(-50%, 0%);
    align-items: flex-start;

    :global(.item) {
      padding: 5px;
    }
    :global(.item-content) {
      height: 64px;
      background-color: #f6f6f6;
      border-radius: 10px;
      display: flex;
      padding: 10px;
      box-sizing: border-box;
      border: 2px solid black;
    }

    :global(.item h1) {
      font-size: 16px;
      font-weight: 800;
    }
  }
</style>

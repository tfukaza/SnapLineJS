<script lang="ts">
  import { Camera, Engine } from "@snap-engine/asset-base/svelte";
  import type { CameraControl } from "@snap-engine/asset-base";

  let browserScrollEnabled = $state(false);
  let cameraControl: CameraControl | null = $state(null);
  let cameraInitialized = false;

  function initializeCamera() {
    if (!cameraControl || cameraInitialized) {
      return;
    }
    if (!cameraControl.camera) {
      requestAnimationFrame(initializeCamera);
      return;
    }

    cameraInitialized = true;
    cameraControl.zoomBy(-0.35);
    cameraControl.setCameraPosition(-200, -120);
  }

  $effect(() => {
    initializeCamera();
  });

  const tiles = Array.from({ length: 36 }, (_, index) => {
    const column = index % 6;
    const row = Math.floor(index / 6);
    return {
      id: `tile-${index}`,
      label: `${column},${row}`,
      x: column * 240 - 600,
      y: row * 180 - 450,
    };
  });
</script>

<Engine id="camera-control-demo-canvas" data-testid="camera-engine">
  <div class:scroll-enabled={browserScrollEnabled} class="camera-control-demo">
    <div
      class="camera-toolbar"
      onpointerdown={(event) => event.stopPropagation()}
    >
      <label>
        <input type="checkbox" bind:checked={browserScrollEnabled} />
        <span>Browser scroll</span>
      </label>
    </div>

    <Camera bind:cameraControl>
      <div class="camera-world">
        <div class="origin-axis x"></div>
        <div class="origin-axis y"></div>
        {#each tiles as tile (tile.id)}
          <div
            class="world-tile"
            style={`transform: translate(${tile.x}px, ${tile.y}px);`}
          >
            {tile.label}
          </div>
        {/each}
      </div>
    </Camera>
  </div>
</Engine>

<style lang="scss">
  :global(#camera-control-demo-canvas) {
    width: 100%;
    height: 100%;
  }

  .camera-control-demo {
    width: 100%;
    height: 100%;
    position: relative;
    overscroll-behavior: contain;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;

    :global(#snap-camera-control) {
      touch-action: inherit;
      user-select: inherit;
      -webkit-user-select: inherit;
    }
  }

  .camera-control-demo.scroll-enabled {
    overscroll-behavior: auto;
    touch-action: pan-x pan-y;
  }

  .camera-toolbar {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 10;
    background: #ffffff;
    border: 2px solid #111827;
    color: #111827;
    font-family: "IBM Plex Mono", monospace;
    font-size: 13px;
    padding: 8px 10px;
    user-select: none;

    label {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    input {
      width: 16px;
      height: 16px;
      margin: 0;
    }
  }

  .camera-world {
    position: relative;
    width: 100%;
    height: 100%;
    background:
      linear-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 0, 0, 0.08) 1px, transparent 1px),
      #f8fafc;
    background-size: 60px 60px;
    overflow: visible;
  }

  .origin-axis {
    position: absolute;
    left: 50%;
    top: 50%;
    background: #111827;
    pointer-events: none;
  }

  .origin-axis.x {
    width: 1600px;
    height: 2px;
    transform: translate(-50%, -1px);
  }

  .origin-axis.y {
    width: 2px;
    height: 1200px;
    transform: translate(-1px, -50%);
  }

  .world-tile {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 144px;
    height: 96px;
    border: 2px solid #111827;
    background: #ffffff;
    color: #111827;
    display: grid;
    place-items: center;
    font-family: "IBM Plex Mono", monospace;
    font-size: 14px;
    box-sizing: border-box;
    user-select: none;
  }
</style>

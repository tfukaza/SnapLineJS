<script lang="ts">
  import { onMount, getContext, setContext } from "svelte";
  import { CameraControl } from "../../../../src/asset/cameraControl";
  import type { SnapLine } from "../../../../src/index";

  let {
    children,
    zoomLock,
    panLock,
  }: {
    children: any;
    zoomLock?: boolean;
    panLock?: boolean;
  } = $props();

  let cameraControlElement: HTMLDivElement | null = null;
  const engine: SnapLine = getContext("engine");
  const cameraControl = new CameraControl(engine.global, zoomLock, panLock);

  setContext("cameraControl", cameraControl);

  onMount(() => {
    cameraControl.element = cameraControlElement as HTMLElement;
  });
</script>

<div id="snap-camera-control" bind:this={cameraControlElement}>
  {@render children()}
</div>

<style lang="scss">
  #snap-camera-control {
    width: 100%;
    height: 100%;
    background-color: #fff;
    user-select: none;
  }
</style>

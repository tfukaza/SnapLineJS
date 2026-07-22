<script lang="ts">
  import { Camera, Engine } from "@snap-engine/asset-base-svelte";
  import SimpleNode from "../node_ui_demo/SimpleNode.svelte";

  // The pan button is configurable via ?panButton= so the e2e suite can
  // exercise left / middle / both without a second route.
  const raw = new URLSearchParams(globalThis.location?.search ?? "").get("panButton");
  const panButton: "left" | "middle" | "both" =
    raw === "middle" || raw === "both" ? raw : "left";
</script>

<!--
  SnapLine composed inside a Camera: background drags pan, ctrl/cmd+wheel
  zooms, while node drags and connector-line drags suppress panning via
  global.data.allowCameraControl. The background deliberately does NOT use
  the id "sl-background" so RectSelect (which keys on that id) stays out of
  the way of panning; rubber-band selection under a camera is still an open
  composition question.
-->
<Engine id="node-ui-camera-canvas">
  <Camera id="node-ui-camera" wheelZoomModifier="ctrlOrMeta" {panButton}>
    <div id="node-ui-camera-layer">
      <div id="nuc-background"></div>
      <SimpleNode title="Node A" x={120} y={120} />
      <SimpleNode title="Node B" x={440} y={170} />
      <SimpleNode title="Node C" x={280} y={360} />
    </div>
  </Camera>
</Engine>

<style>
  #node-ui-camera-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  :global(.node) {
    pointer-events: auto;
  }

  #nuc-background {
    position: absolute;
    inset: -4000px;
    pointer-events: auto;
  }
</style>

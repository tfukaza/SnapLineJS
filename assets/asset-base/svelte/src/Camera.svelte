<script lang="ts">
  import {
    getContext,
    onDestroy,
    onMount,
    setContext,
    type Snippet,
    untrack,
  } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { CameraControl as CameraControlObject } from "@snap-engine/asset-base";
  import type { CameraWheelConfig, CameraPointerConfig } from "@snap-engine/asset-base";
  import type { CameraConfig, Engine } from "@snap-engine/core";

  type CameraProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children: Snippet;
    className?: string;
    zoomLock?: boolean;
    panLock?: boolean;
    /** Disable single-pointer panning while leaving pinch panning intact. */
    pointerPanLock?: boolean | "touch";
    /** Require ctrl/cmd for wheel zoom so unmodified scrolling pans the page. */
    wheelZoomModifier?: "none" | "ctrlOrMeta";
    /** Pan on unmodified wheel (trackpad two-finger scroll); ctrl/cmd wheel zooms. */
    wheelPan?: boolean;
    /** Multiplies wheel-zoom speed (default 1); trackpad pinch is scaled up further. */
    zoomSensitivity?: number;
    /** Multiplies wheel-pan speed (default 1 = 1:1 screen pixels), independent of zoom. */
    wheelPanSensitivity?: number;
    /** Which mouse button starts a pointer pan (default "left"). */
    panButton?: "left" | "middle" | "both";
    /** Wheel/trackpad behavior, grouped. Wins over the flat deprecated props. */
    wheel?: CameraWheelConfig;
    /** Pointer behavior, grouped. Wins over the flat deprecated props. */
    pointer?: CameraPointerConfig;
    /** Options forwarded to the underlying Camera, e.g. zoomBounds and contentBounds. */
    cameraConfig?: CameraConfig;
    cameraControl?: CameraControlObject | null;
  };

  let {
    children,
    class: classValue = "",
    className = "",
    id = "snap-camera-control",
    zoomLock = false,
    panLock = false,
    pointerPanLock = false,
    wheelZoomModifier = "none",
    wheelPan = false,
    zoomSensitivity = 1,
    wheelPanSensitivity = 1,
    panButton = "left",
    wheel = undefined,
    pointer = undefined,
    cameraConfig,
    cameraControl = $bindable<CameraControlObject | null>(null),
    style = "",
    ...divProps
  }: CameraProps = $props();

  const engine: Engine | null = getContext("engine");
  if (!engine) {
    throw new Error("SnapEngine Svelte camera consumers must be rendered inside <Engine>.");
  }

  const ownsCameraControl = cameraControl == null;
  const initialConfig = untrack(() => ({
    panLock,
    zoomLock,
    pointerPanLock,
    wheelZoomModifier,
    wheelPan,
    zoomSensitivity,
    wheelPanSensitivity,
    panButton,
    wheel,
    pointer,
    camera: cameraConfig,
  }));
  const cameraControlInstance =
    cameraControl ?? new CameraControlObject(engine, initialConfig);
  if (cameraControlInstance.engine !== engine) {
    throw new Error("The injected CameraControl belongs to another Engine.");
  }
  cameraControl = cameraControlInstance;
  setContext("cameraControl", cameraControlInstance);

  let cameraControlElement: HTMLDivElement | null = null;
  const mergedClass = $derived(`${classValue} ${className}`.trim());
  const mergedStyle = $derived(
    `height:100%;transform-origin:0 0;user-select:none;width:100%;${style ?? ""}`,
  );

  $effect(() => {
    cameraControlInstance.config = {
      ...cameraControlInstance.config,
      panLock,
      zoomLock,
      pointerPanLock,
      wheelZoomModifier,
      wheelPan,
      zoomSensitivity,
      wheelPanSensitivity,
      panButton,
      wheel,
      pointer,
    };
  });

  // Bounds often depend on measured layout, so keep applying them as they change.
  $effect(() => {
    if (!cameraConfig) return;
    cameraControlInstance.setCameraConfig(cameraConfig);
  });

  onMount(() => {
    if (cameraControlElement) {
      cameraControlInstance.element = cameraControlElement;
    }
  });

  onDestroy(() => {
    if (!ownsCameraControl) return;
    if (engine.camera === cameraControlInstance.camera) {
      engine.unsubscribeEvent("containerResized", "camera");
      engine.unsubscribeEvent("containerMoved", "camera");
      engine.camera = null;
    }
    cameraControlInstance.destroy(false);
  });
</script>

<div
  {...divProps}
  {id}
  class={mergedClass || undefined}
  bind:this={cameraControlElement}
  style={mergedStyle}
>
  {@render children()}
</div>

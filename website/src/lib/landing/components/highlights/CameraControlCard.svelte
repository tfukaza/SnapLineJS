<script lang="ts">
  import CardDocsLink from "./CardDocsLink.svelte";
  import { onMount } from "svelte";
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import { Engine, Camera as CameraControlComponent } from "@snap-engine/asset-base/svelte";
  import type { CameraControl as CameraControlApi } from "@snap-engine/asset-base";
  import { debugState } from "$lib/landing/debugState.svelte";

  const topoColumns = 148;
  const topoRows = 86;
  const topoFillCharacters = [" ", ".", ",", "`"] as const;
  // The clear centre of the "donut" is sized relative to the card, not the character
  // grid: the map renders inside the camera world centred on the card, so at zoom 1
  // one world pixel is one card pixel. The clearing is an ellipse matching the card's
  // aspect — half its width across, half its height down — so the contour ring stays
  // visible on every edge instead of being pushed out of frame on a wide card. Cell
  // metrics are measured off the rendered map so we never hardcode the font's advance.
  const CLEARING_WIDTH_FRACTION = 0.5;
  const CLEARING_HEIGHT_FRACTION = 0.5;

  // Type metrics in world pixels. Matching the previous DOM rendering (39px Geist Mono
  // on a 0.92 line-height) keeps the terrain looking the same after the port.
  const TOPO_FONT_SIZE = 39;
  const TOPO_LINE_HEIGHT = 0.92;
  // Ink ramp driven by the shade field. Kept within a narrow, low-contrast band and
  // warmed slightly at the dense end so it reads as depth, never as decoration
  // competing with the heading.
  const TOPO_INK_COLORS = [
    "rgba(24, 26, 30, 0.055)",
    "rgba(24, 26, 30, 0.085)",
    "rgba(28, 26, 28, 0.115)",
    "rgba(42, 30, 26, 0.145)",
    "rgba(58, 34, 24, 0.175)",
  ];
  // How fast the contours drift. Low enough to read as weather, not noise.
  const TOPO_DRIFT = 0.00016;
  // The drift only needs a low frame rate to read as continuous; camera moves still
  // redraw immediately, so interaction never feels stepped.
  const TOPO_FRAME_INTERVAL = 90;

  let viewportWidth = $state(0);
  let viewportHeight = $state(0);
  let cellWidth = $state(0);
  let cellHeight = $state(0);

  const clearingRadiusX = $derived(viewportWidth * CLEARING_WIDTH_FRACTION);
  const clearingRadiusY = $derived(viewportHeight * CLEARING_HEIGHT_FRACTION);
  const clearingColumns = $derived(cellWidth > 0 ? clearingRadiusX / cellWidth : topoColumns * 0.18);
  const clearingRows = $derived(cellHeight > 0 ? clearingRadiusY / cellHeight : topoRows * 0.16);

  // Half-extent of the drawn pattern in world pixels. isInsideMap() bounds the glyphs
  // to an ellipse of 0.48 * the grid, so that ellipse — not the full grid — is the
  // edge the camera must never travel past.
  const MAP_EXTENT_FRACTION = 0.48;
  const mapHalfWidth = $derived(topoColumns * MAP_EXTENT_FRACTION * cellWidth);
  const mapHalfHeight = $derived(topoRows * MAP_EXTENT_FRACTION * cellHeight);

  // Never let the viewport show more world than the pattern covers.
  const minZoom = $derived(
    mapHalfWidth > 0
      ? Math.min(1, Math.max(viewportWidth / (mapHalfWidth * 2), viewportHeight / (mapHalfHeight * 2)))
      : 0.2,
  );

  // The pattern is centred on the camera element rather than on the world origin, so
  // its rect is measured from that centre. contentBounds is zoom-aware, so the camera
  // can still pan to the pattern's edges when zoomed in.
  const cameraConfig = $derived.by(() => {
    if (mapHalfWidth <= 0 || mapHalfHeight <= 0) return undefined;
    const centreX = viewportWidth / 2;
    const centreY = viewportHeight / 2;
    return {
      zoomBounds: { min: minZoom, max: 1 },
      contentBounds: {
        left: centreX - mapHalfWidth,
        right: centreX + mapHalfWidth,
        top: centreY - mapHalfHeight,
        bottom: centreY + mapHalfHeight,
      },
    };
  });

  let cameraControl = $state<CameraControlApi | null>(null);
  let cameraInitialized = $state(false);
  let topoCanvas = $state<HTMLCanvasElement | null>(null);

  // Spatial frequencies are deliberately low so features read as landforms when zoomed
  // out, rather than as per-cell static. The phase term is what animates: shifting each
  // wave makes the contour bands migrate instead of the glyphs flickering at random.
  function terrainHeight(x: number, y: number, phase = 0) {
    const ridge =
      Math.sin(x * 0.062 + y * 0.031 + phase) * 0.42 +
      Math.sin(x * 0.022 - y * 0.074 + 1.7 + phase * 0.6) * 0.31 +
      Math.cos(Math.hypot(x - 34, y + 18) * 0.07 - phase * 0.8) * 0.38 +
      Math.sin(Math.hypot(x + 72, y - 46) * 0.058 + 1.1 + phase * 0.45) * 0.24;

    return ridge;
  }

  // A second, even broader field drives both the fill glyph and the ink colour, so
  // neighbouring cells agree over large patches. That is what removes the granular
  // "static" look — and it also keeps colour runs long enough to batch into few draws.
  function terrainShade(x: number, y: number, phase = 0) {
    return (
      Math.sin(x * 0.028 - y * 0.019 + phase * 0.5) * 0.6 +
      Math.cos(Math.hypot(x + 20, y - 12) * 0.032 + phase * 0.35) * 0.4
    );
  }

  function isInsideMap(column: number, row: number) {
    const normalizedX = (column - topoColumns / 2) / (topoColumns * 0.48);
    const normalizedY = (row - topoRows / 2) / (topoRows * 0.48);
    return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
  }

  function isInsideCenterClearing(column: number, row: number) {
    const normalizedX = (column - topoColumns / 2) / clearingColumns;
    const normalizedY = (row - topoRows / 2) / clearingRows;
    return normalizedX * normalizedX + normalizedY * normalizedY < 1;
  }

  function topoCharacter(column: number, row: number, phase = 0) {
    if (!isInsideMap(column, row) || isInsideCenterClearing(column, row)) return " ";

    const worldColumn = column - topoColumns / 2;
    const worldRow = row - topoRows / 2;
    const height = terrainHeight(worldColumn, worldRow, phase);
    // Fewer, broader contour bands than the original 5.4/10.8, to match the coarser
    // terrain — otherwise the bands crowd back into visual noise.
    const contour = Math.abs(height * 3.1 - Math.round(height * 3.1));
    const fineContour = Math.abs(height * 6.2 - Math.round(height * 6.2));

    if (contour < 0.055) return "#";
    if (contour < 0.095) return "=";
    if (fineContour < 0.04) return "-";
    if (height > 0.62) return "+";
    if (height < -0.72) return ":";

    // Fill glyph from the smooth field rather than a per-cell hash, so flat ground
    // reads as patches of one texture instead of speckle.
    const shade = terrainShade(worldColumn, worldRow, phase);
    const index = Math.min(
      topoFillCharacters.length - 1,
      Math.max(0, Math.floor(((shade + 1) / 2) * topoFillCharacters.length)),
    );
    return topoFillCharacters[index];
  }

  // Ink level, quantised so consecutive cells share a colour and can batch.
  function topoInkLevel(column: number, row: number, phase = 0) {
    const shade = terrainShade(column - topoColumns / 2, row - topoRows / 2, phase);
    return Math.min(
      TOPO_INK_COLORS.length - 1,
      Math.max(0, Math.floor(((shade + 1) / 2) * TOPO_INK_COLORS.length)),
    );
  }

  function initializeCamera() {
    if (!cameraControl || cameraInitialized) {
      return;
    }
    if (!cameraControl.camera) {
      requestAnimationFrame(initializeCamera);
      return;
    }

    cameraInitialized = true;
    cameraControl.setCameraPosition(0, 0);
  }

  // Draw only the cells that land inside the canvas. The grid is defined in world
  // coordinates and projected with the camera's own transform (screen = (world - cameraPos) * zoom),
  // so panning and zooming stay locked to the DOM content beside it.
  function drawTopo(canvas: HTMLCanvasElement, phase: number) {
    const context = canvas.getContext("2d");
    if (!context || cellWidth === 0) return;

    const camera = cameraControl?.camera;
    const zoom = camera?.zoom ?? 1;
    const cameraX = camera?.cameraPositionX ?? 0;
    const cameraY = camera?.cameraPositionY ?? 0;

    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.round(viewportWidth * dpr);
    const targetHeight = Math.round(viewportHeight * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, viewportWidth, viewportHeight);
    context.font = `300 ${TOPO_FONT_SIZE * zoom}px "Geist Mono", "Courier New", monospace`;
    context.textBaseline = "middle";

    // Grid origin in world space: the map is centred on the camera element, matching
    // where the DOM version sat.
    const originX = viewportWidth / 2 - (topoColumns * cellWidth) / 2;
    const originY = viewportHeight / 2 - (topoRows * cellHeight) / 2;

    // Invert the projection to find which cells the canvas can actually see.
    const firstColumn = Math.max(0, Math.floor((cameraX - originX) / cellWidth));
    const lastColumn = Math.min(
      topoColumns - 1,
      Math.ceil((cameraX + viewportWidth / zoom - originX) / cellWidth),
    );
    const firstRow = Math.max(0, Math.floor((cameraY - originY) / cellHeight));
    const lastRow = Math.min(
      topoRows - 1,
      Math.ceil((cameraY + viewportHeight / zoom - originY) / cellHeight),
    );

    // Batched into runs of equal ink colour rather than one call per glyph. The font is
    // monospace and the grid pitch is its advance width, so a run lands on exactly the
    // cells it would glyph-by-glyph. Because the shade field is low frequency the runs
    // are long, which keeps this to a few hundred draws instead of ~12,000.
    for (let row = firstRow; row <= lastRow; row++) {
      const worldY = originY + row * cellHeight + cellHeight / 2;
      const screenY = (worldY - cameraY) * zoom;

      let run = "";
      let runLevel = -1;
      let runStart = firstColumn;

      const flush = () => {
        if (runLevel >= 0 && run.trimEnd() !== "") {
          context.fillStyle = TOPO_INK_COLORS[runLevel];
          context.fillText(run, (originX + runStart * cellWidth - cameraX) * zoom, screenY);
        }
        run = "";
      };

      for (let column = firstColumn; column <= lastColumn; column++) {
        const level = topoInkLevel(column, row, phase);
        if (level !== runLevel) {
          flush();
          runLevel = level;
          runStart = column;
        }
        run += topoCharacter(column, row, phase);
      }
      flush();
    }
  }

  function handleCameraWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) return;

    // Let the browser perform its normal page-scroll default action, but keep
    // the engine's wheel listener from treating this as camera input.
    event.stopPropagation();
  }

  $effect(() => {
    initializeCamera();
  });

  // Resolved after mount so the server-rendered markup stays stable; Ctrl is the safe
  // default because it is also what non-Mac desktops use.
  let zoomModifierLabel = $state("Ctrl");

  onMount(() => {
    if (/Mac|iPhone|iPad|iPod/.test(navigator.platform ?? "")) {
      zoomModifierLabel = "⌘";
    }
    initializeCamera();

    if (!topoCanvas) return;
    const canvas = topoCanvas;

    // Measure the advance directly rather than assuming the font's ratio.
    const context = canvas.getContext("2d");
    if (context) {
      context.font = `300 ${TOPO_FONT_SIZE}px "Geist Mono", "Courier New", monospace`;
      cellWidth = context.measureText("M").width;
      cellHeight = TOPO_FONT_SIZE * TOPO_LINE_HEIGHT;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let onScreen = false;
    let lastPhaseDraw = 0;
    let lastCameraKey = "";

    // Panning and zooming must redraw immediately or the terrain lags the DOM, but the
    // drift is slow enough that it does not need 60fps of its own. Redrawing it on a
    // slower cadence is most of the frame budget back on weak hardware.
    const render = (time: number) => {
      const camera = cameraControl?.camera;
      const cameraKey = `${camera?.zoom ?? 1}|${camera?.cameraPositionX ?? 0}|${camera?.cameraPositionY ?? 0}|${viewportWidth}x${viewportHeight}`;
      const cameraMoved = cameraKey !== lastCameraKey;
      const phaseDue = time - lastPhaseDraw >= TOPO_FRAME_INTERVAL;

      if (cameraMoved || phaseDue) {
        lastCameraKey = cameraKey;
        if (phaseDue) lastPhaseDraw = time;
        drawTopo(canvas, reduceMotion.matches ? 0 : time * TOPO_DRIFT);
      }
      frame = requestAnimationFrame(render);
    };

    // A card scrolled out of view should not be burning frames.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting === onScreen) return;
        onScreen = entry.isIntersecting;
        if (onScreen) frame = requestAnimationFrame(render);
        else cancelAnimationFrame(frame);
      },
      { rootMargin: "100px" },
    );
    observer.observe(canvas);

    // Web fonts can land after mount and change the advance width.
    document.fonts?.ready.then(() => {
      if (!context) return;
      context.font = `300 ${TOPO_FONT_SIZE}px "Geist Mono", "Courier New", monospace`;
      cellWidth = context.measureText("M").width;
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  });
</script>

<article
  class="camera-control-card theme-secondary-7"
  onwheelcapture={handleCameraWheel}
>
  <div class="camera-viewport" bind:clientWidth={viewportWidth} bind:clientHeight={viewportHeight}>
    <!--
      The terrain is scenery, not a DOM demonstration, so it is drawn to a screen-space
      canvas rather than 12k glyph nodes. It is deliberately NOT inside the camera's
      transformed subtree: it covers only the visible viewport and applies the camera
      transform itself, so it stays crisp at any zoom and only ever rasterises the
      cells actually on screen. The heading below is still real DOM being panned and
      zoomed, which is what the card is actually claiming.
    -->
    <canvas class="camera-topo-canvas" bind:this={topoCanvas} aria-hidden="true"></canvas>
    <ClientDemoFrame>
      {#snippet fallback()}
        <div class="camera-scene camera-skeleton" aria-hidden="true"></div>
      {/snippet}
      <Engine id="camera-control-highlight" debug={debugState.enabled}>
      <CameraControlComponent
        bind:cameraControl
        {cameraConfig}
        pointerPanLock="touch"
        wheelZoomModifier="ctrlOrMeta"
      >
        <div class="camera-scene">
          <div class="camera-card-heading">
            <h3>Camera<br />Control</h3>
            <p>Built-in camera module manages zoom and pan for any DOM element.<br>
                Gesture support on mobile devices.</p>
                <CardDocsLink href="/docs/snapengine/introduction/05_camera" label="Camera docs" />
          </div>
        </div>
      </CameraControlComponent>
      </Engine>
    </ClientDemoFrame>
  </div>

  <p class="camera-hint">
    <span class="camera-hint-led slot shallow" aria-hidden="true"></span>
    <span class="camera-hint-text">
      <span class="camera-hint-pointer">Drag to pan · {zoomModifierLabel} + scroll to zoom</span>
      <span class="camera-hint-touch">Pinch to zoom · Drag with two fingers to pan</span>
    </span>
  </p>
</article>

<style lang="scss">
  .camera-control-card {
    --card-padding: var(--size-48);
    --card-top-padding: var(--card-padding);
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--size-32);
    min-height: 520px;
    height: auto;
    box-sizing: border-box;
    background: var(--color-background-tint);
    border-radius: var(--ui-radius);
    overflow: hidden;
    isolation: isolate;
    overscroll-behavior: auto;
    // pan-y keeps one-finger vertical scrolling with the page; two-finger gestures
    // are still delivered to the engine, so pinch zoom/pan continue to work.
    touch-action: pan-y;

    @media (max-width: 720px) {
      --card-padding: var(--size-24);
      --card-top-padding: var(--highlight-card-mobile-top-padding);
      grid-column: span 2;
    }
  }

  .camera-viewport {
    position: absolute;
    inset: 0;
    z-index: 0;
    cursor: grab;
    overscroll-behavior: auto;
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;

    &:active {
      cursor: grabbing;
    }
  }

  .camera-viewport :global(.snap-engine-canvas) {
    width: 100%;
    height: 100%;
    background: transparent;
    overscroll-behavior: auto;
    touch-action: inherit;
    user-select: inherit;
    -webkit-user-select: inherit;
  }

  .camera-viewport :global(#snap-camera-control) {
    position: relative !important;
    top: auto !important;
    left: auto !important;
    width: 100% !important;
    height: 100% !important;
    background: transparent;
    overscroll-behavior: auto;
    touch-action: inherit;
    transform-origin: 0 0;
    user-select: inherit;
    -webkit-user-select: inherit;
  }

  .camera-scene {
    position: relative;
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    overflow: visible;
  }

  .camera-skeleton {
    overflow: hidden;
    background: color-mix(in srgb, var(--color-background-tint) 92%, #000 4%);
  }

  // Screen-space layer: it fills the viewport and never moves, because the camera
  // transform is applied when drawing rather than by CSS.
  .camera-topo-canvas {
    position: absolute;
    inset: 0;
    z-index: 0;
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: none;
    user-select: none;
  }

  .camera-card-heading {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--size-12);
    padding: var(--card-top-padding) var(--card-padding) var(--card-padding);
    box-sizing: border-box;
    text-align: center;
    max-width: 400px;

    h3 {
      margin: 0;
      font-family: "Geist Pixel Circle", "Doto", sans-serif;
      font-size: var(--highlight-card-heading-size);
      line-height: 0.88;
    }

    p {
      margin: 0;
    }

    @media (max-width: 720px) {
      gap: var(--size-12);
    }
  }

  // A notch cut into the bottom edge, filled with the page background rather than the
  // card's tint. Sitting outside the tinted surface marks the hint as screen-space
  // chrome rather than something living in the pannable world.
  .camera-hint {
    --notch-fillet: var(--size-16);
    position: absolute;
    left: 50%;
    bottom: 0;
    z-index: 2;
    margin: 0;
    transform: translateX(-50%);
    width: max-content;
    max-width: calc(100% - (var(--notch-fillet) + var(--card-padding)) * 2);
    padding: var(--size-8) var(--size-24);
    box-sizing: border-box;
    background: var(--color-background);
    border-radius: var(--ui-radius) var(--ui-radius) 0 0;
    display: flex;
    align-items: center;
    gap: var(--size-8);
    text-align: center;
    font-size: 0.82rem;
    color: color-mix(in srgb, var(--color-text) 62%, transparent);
    pointer-events: none;
    user-select: none;
  }

  // A physical LED sunk into the bezel: .slot supplies the recessed socket, and the
  // dot itself switches hard between an unlit black and a driven orange. Blinking in
  // steps rather than easing keeps it reading as a switched lamp, not a soft pulse.
  .camera-hint-led {
    position: relative;
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #14161a;
    animation: camera-hint-led-blink 1.6s steps(1, end) infinite;
  }

  // The glow lives on its own layer so the socket's inset shading from .slot survives.
  .camera-hint-led::after {
    content: "";
    position: absolute;
    inset: -5px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      color-mix(in srgb, var(--color-primary) 60%, transparent) 0%,
      transparent 70%
    );
    opacity: 0;
    animation: camera-hint-led-glow 1.6s steps(1, end) infinite;
  }

  @keyframes camera-hint-led-blink {
    0%,
    55% {
      background: var(--color-primary);
    }
    56%,
    100% {
      background: #14161a;
    }
  }

  @keyframes camera-hint-led-glow {
    0%,
    55% {
      opacity: 1;
    }
    56%,
    100% {
      opacity: 0;
    }
  }

  // Steady lit rather than dark, so the indicator still reads as active.
  @media (prefers-reduced-motion: reduce) {
    .camera-hint-led {
      animation: none;
      background: var(--color-primary);
    }

    .camera-hint-led::after {
      animation: none;
      opacity: 1;
    }
  }

  // Concave corners where the notch meets the card edge, so it reads as cut out of the
  // surface instead of pasted on top of it. Each pseudo-element paints the background
  // colour everywhere except a quarter-disc facing the card.
  .camera-hint::before,
  .camera-hint::after {
    content: "";
    position: absolute;
    bottom: 0;
    width: var(--notch-fillet);
    height: var(--notch-fillet);
  }

  .camera-hint::before {
    left: calc(-1 * var(--notch-fillet));
    background: radial-gradient(
      circle at top left,
      transparent var(--notch-fillet),
      var(--color-background) calc(var(--notch-fillet) + 0.5px)
    );
  }

  .camera-hint::after {
    right: calc(-1 * var(--notch-fillet));
    background: radial-gradient(
      circle at top right,
      transparent var(--notch-fillet),
      var(--color-background) calc(var(--notch-fillet) + 0.5px)
    );
  }

  // Which hint applies is a device capability, not a viewport width, so this keys off
  // pointer/hover rather than a breakpoint. Doing it in CSS keeps SSR output stable.
  .camera-hint-touch {
    display: none;
  }

  @media (hover: none) and (pointer: coarse) {
    .camera-hint-pointer {
      display: none;
    }

    .camera-hint-touch {
      display: inline;
    }
  }

</style>

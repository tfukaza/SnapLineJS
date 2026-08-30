<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import {
    createMaterialStyle,
    defaultInsetSlotMaterialSettings,
    defaultRaisedCardMaterialSettings,
    type MaterialDepth,
    type MaterialSettings,
    type MaterialShape,
  } from "./materialSurface";

  type MaterialSurfaceProps = Omit<
    HTMLAttributes<HTMLSpanElement>,
    "children" | "class"
  > & {
    children?: Snippet;
    depth: MaterialDepth;
    shape: MaterialShape;
    material?: MaterialSettings;
    shadedRim?: boolean;
    creviceOutline?: boolean;
    width?: number;
    height?: number;
    radius?: number;
    color?: string | null;
    class?: string;
    className?: string;
  };

  let {
    children,
    depth,
    shape,
    material,
    shadedRim,
    creviceOutline,
    width,
    height,
    radius = 8,
    color,
    class: classValue = "",
    className = "",
    style: styleValue,
    ...surfaceProps
  }: MaterialSurfaceProps = $props();

  const mergedClass = $derived(
    `material-surface ${depth} ${shape} ${classValue} ${className}`.trim(),
  );
  const surfaceWidth = $derived(width === undefined ? undefined : `${Math.max(0, width)}px`);
  const surfaceHeight = $derived(height === undefined ? undefined : `${Math.max(0, height)}px`);
  const surfaceRadius = $derived(shape === "circle" ? "50%" : `${Math.max(0, radius)}px`);
  const baseMaterial = $derived(
    material ??
      (depth === "recessed"
        ? defaultInsetSlotMaterialSettings
        : defaultRaisedCardMaterialSettings),
  );
  const resolvedMaterial = $derived<MaterialSettings>({
    ...baseMaterial,
    shadedRim: shadedRim ?? baseMaterial.shadedRim,
    creviceOutline: creviceOutline ?? baseMaterial.creviceOutline,
  });
  const generatedStyle = $derived(createMaterialStyle(depth, resolvedMaterial));
  const colorStyle = $derived(
    color == null ? undefined : `--material-color: ${color}`,
  );
  const surfaceStyle = $derived(
    [styleValue, generatedStyle, colorStyle].filter(Boolean).join("; "),
  );
</script>

<span
  {...surfaceProps}
  class={mergedClass}
  style={surfaceStyle}
  style:width={surfaceWidth}
  style:height={surfaceHeight}
  style:--material-radius={surfaceRadius}
>
  <span class="material-surface-clip">
    <span class="material-surface-fill"></span>
    {#if depth === "recessed" && children}
      <span class="material-content">{@render children()}</span>
    {/if}
    <span class="material-surface-inset-shadow"></span>
  </span>
  <span class="material-rim-overlay" aria-hidden="true">
    <span class="material-rim material-rim-shading"></span>
    <span class="material-rim material-rim-specular"></span>
  </span>
  <span class="material-crevice" aria-hidden="true"></span>
  {#if depth !== "recessed" && children}
    <span class="material-content">{@render children()}</span>
  {/if}
</span>

<style>
  .material-surface {
    --material-color: #ececeb;
    --material-radius: 8px;
    --material-rim-width: 2px;
    --material-rim-half-width: 1px;
    --material-rim-blur: 0.75px;
    --material-rim-overscan: var(--material-rim-width);
    --material-rim-render-width: calc(var(--material-rim-width) + var(--material-rim-width));
    --material-rim-render-radius: var(--material-radius);
    --material-diffuse-dark: hsl(from var(--material-color) calc(h - 10) s calc(l - 20) / 0.9);
    --material-diffuse-light: hsl(from var(--material-color) calc(h + 10) s calc(l + 20) / 0.9);
    --material-specular-color: #fff;
    --material-diffuse-0: var(--material-diffuse-light);
    --material-diffuse-45: color-mix(in hsl, var(--material-diffuse-dark), var(--material-diffuse-light) 85%);
    --material-diffuse-90: color-mix(in hsl, var(--material-diffuse-dark), var(--material-diffuse-light) 50%);
    --material-diffuse-135: color-mix(in hsl, var(--material-diffuse-dark), var(--material-diffuse-light) 15%);
    --material-diffuse-180: var(--material-diffuse-dark);
    --material-side-top: var(--material-diffuse-light);
    --material-side-right: var(--material-diffuse-dark);
    --material-side-bottom: var(--material-diffuse-dark);
    --material-side-left: var(--material-diffuse-light);
    --material-normal-0: var(--material-side-top);
    --material-normal-45: var(--material-diffuse-45);
    --material-normal-90: var(--material-side-right);
    --material-normal-135: var(--material-diffuse-135);
    --material-normal-180: var(--material-side-bottom);
    --material-normal-225: var(--material-diffuse-135);
    --material-normal-270: var(--material-side-left);
    --material-normal-315: var(--material-diffuse-45);
    --material-shadow-far-x: 4px;
    --material-shadow-far-y: 4px;
    --material-shadow-near-x: 2px;
    --material-shadow-near-y: 2px;
    --material-shadow-light-x: -2px;
    --material-shadow-light-y: -2px;
    --material-shadow-strength: 1;
    --material-shadow-far-base: hsl(from var(--material-color) h s calc(l - 78) / 0.4);
    --material-shadow-near-base: hsl(from var(--material-color) h s calc(l - 70) / 0.4);
    --material-shadow-light-base: hsl(from var(--material-color) h s calc(l + 10) / 0.5);
    --material-shadow-far: color-mix(in srgb, var(--material-shadow-far-base) calc(var(--material-shadow-strength) * 100%), transparent);
    --material-shadow-near: color-mix(in srgb, var(--material-shadow-near-base) calc(var(--material-shadow-strength) * 100%), transparent);
    --material-shadow-light: color-mix(in srgb, var(--material-shadow-light-base) calc(var(--material-shadow-strength) * 100%), transparent);
    --material-shadow-far-blur: 5px;
    --material-shadow-near-blur: 2.5px;
    --material-shadow-light-blur: 4px;
    --material-shadow-light-spread: -1px;
    --material-crevice-color: #000;
    --material-ambient-shadow: hsl(from var(--material-color) h s calc(l - 45) / 0.16);
    --material-specular-from: 0deg;
    --material-specular-stop-1: 12deg;
    --material-specular-stop-2: 24deg;
    --material-specular-stop-3: 36deg;
    --material-specular-stop-4: 48deg;
    --material-specular-shoulder: rgb(255 255 255 / 20%);
    --material-specular-peak: rgb(255 255 255 / 85%);
    --material-diffuse-stops:
      var(--material-diffuse-0) 0deg,
      var(--material-diffuse-45) 45deg,
      var(--material-diffuse-90) 90deg,
      var(--material-diffuse-135) 135deg,
      var(--material-diffuse-180) 180deg,
      var(--material-diffuse-135) 225deg,
      var(--material-diffuse-90) 270deg,
      var(--material-diffuse-45) 315deg,
      var(--material-diffuse-0) 360deg;
    --material-rounded-stops:
      var(--material-normal-0) 0deg,
      var(--material-normal-45) 45deg,
      var(--material-normal-90) 90deg,
      var(--material-normal-135) 135deg,
      var(--material-normal-180) 180deg,
      var(--material-normal-225) 225deg,
      var(--material-normal-270) 270deg,
      var(--material-normal-315) 315deg,
      var(--material-normal-0) 360deg;
    --material-specular-stops:
      transparent 0deg,
      var(--material-specular-shoulder) var(--material-specular-stop-1),
      var(--material-specular-peak) var(--material-specular-stop-2),
      var(--material-specular-shoulder) var(--material-specular-stop-3),
      transparent var(--material-specular-stop-4),
      transparent 360deg;
    --material-rim-visibility: visible;
    --material-crevice-visibility: visible;

    position: relative;
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    isolation: isolate;
    box-sizing: border-box;
    border-radius: var(--material-radius);
  }

  .material-surface.raised {
    box-shadow:
      var(--material-shadow-far-x) var(--material-shadow-far-y) var(--material-shadow-far-blur) 0 var(--material-shadow-far),
      var(--material-shadow-near-x) var(--material-shadow-near-y) var(--material-shadow-near-blur) 0 var(--material-shadow-near),
      var(--material-shadow-light-x) var(--material-shadow-light-y) var(--material-shadow-light-blur) var(--material-shadow-light-spread) var(--material-shadow-light);
  }

  .material-surface.recessed {
    --material-rim-render-radius: calc(var(--material-radius) + var(--material-rim-overscan));
    box-shadow: 0 0 2px 0.5px var(--material-ambient-shadow);
  }

  .material-surface.circle {
    --material-color: var(--circle-color, #ececeb);
    --material-shadow-far-base: var(--circle-shadow-far, hsl(from var(--material-color) h s calc(l - 78) / 0.4));
    --material-shadow-near-base: var(--circle-shadow-near, hsl(from var(--material-color) h s calc(l - 70) / 0.4));
    --material-shadow-light-base: var(--circle-shadow-light, hsl(from var(--material-color) h s calc(l + 15) / 0.45));
  }

  .material-surface-clip,
  .material-surface-fill,
  .material-surface-inset-shadow,
  .material-crevice {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
  }

  .material-surface-clip {
    z-index: 0;
    overflow: hidden;
  }

  .material-surface-fill {
    z-index: 0;
    background: var(--material-color);
  }

  .material-surface-inset-shadow {
    z-index: 2;
    display: none;
    box-shadow:
      inset var(--material-shadow-far-x) var(--material-shadow-far-y) var(--material-shadow-far-blur) 0 var(--material-shadow-far),
      inset var(--material-shadow-near-x) var(--material-shadow-near-y) var(--material-shadow-near-blur) 0 var(--material-shadow-near),
      inset var(--material-shadow-light-x) var(--material-shadow-light-y) var(--material-shadow-light-blur) 0 var(--material-shadow-light);
  }

  .recessed .material-surface-inset-shadow {
    display: block;
  }

  .material-rim-overlay {
    position: absolute;
    z-index: 2;
    inset: 0;
    border-radius: inherit;
    filter: blur(var(--material-rim-blur));
    visibility: var(--material-rim-visibility);
    pointer-events: none;
  }

  .recessed .material-rim-overlay {
    inset: calc(0px - var(--material-rim-overscan));
    border-radius: var(--material-rim-render-radius);
  }

  .material-rim {
    position: absolute;
    inset: 0;
    padding: var(--material-rim-render-width);
    box-sizing: border-box;
    border-radius: inherit;
    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask-composite: exclude;
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
  }

  .circle .material-rim-shading {
    background: conic-gradient(from var(--material-light-angle), var(--material-diffuse-stops));
  }

  .circle .material-rim-specular {
    background: conic-gradient(from var(--material-specular-from), var(--material-specular-stops));
  }

  .rounded .material-rim-shading {
    background-image:
      conic-gradient(from 0deg at 100% 100%, var(--material-rounded-stops)),
      conic-gradient(from 0deg at 0% 100%, var(--material-rounded-stops)),
      conic-gradient(from 0deg at 0% 0%, var(--material-rounded-stops)),
      conic-gradient(from 0deg at 100% 0%, var(--material-rounded-stops)),
      linear-gradient(var(--material-side-top), var(--material-side-top)),
      linear-gradient(var(--material-side-right), var(--material-side-right)),
      linear-gradient(var(--material-side-bottom), var(--material-side-bottom)),
      linear-gradient(var(--material-side-left), var(--material-side-left));
    background-position: left top, right top, right bottom, left bottom, center top, right center, center bottom, left center;
    background-size:
      var(--material-rim-render-radius) var(--material-rim-render-radius),
      var(--material-rim-render-radius) var(--material-rim-render-radius),
      var(--material-rim-render-radius) var(--material-rim-render-radius),
      var(--material-rim-render-radius) var(--material-rim-render-radius),
      calc(100% - var(--material-rim-render-radius) - var(--material-rim-render-radius)) var(--material-rim-render-width),
      var(--material-rim-render-width) calc(100% - var(--material-rim-render-radius) - var(--material-rim-render-radius)),
      calc(100% - var(--material-rim-render-radius) - var(--material-rim-render-radius)) var(--material-rim-render-width),
      var(--material-rim-render-width) calc(100% - var(--material-rim-render-radius) - var(--material-rim-render-radius));
    background-repeat: no-repeat;
  }

  .rounded .material-rim-specular {
    background-image:
      conic-gradient(from var(--material-specular-from) at 100% 100%, var(--material-specular-stops)),
      conic-gradient(from var(--material-specular-from) at 0% 100%, var(--material-specular-stops)),
      conic-gradient(from var(--material-specular-from) at 0% 0%, var(--material-specular-stops)),
      conic-gradient(from var(--material-specular-from) at 100% 0%, var(--material-specular-stops));
    background-position: left top, right top, right bottom, left bottom;
    background-size:
      var(--material-rim-render-radius) var(--material-rim-render-radius),
      var(--material-rim-render-radius) var(--material-rim-render-radius),
      var(--material-rim-render-radius) var(--material-rim-render-radius),
      var(--material-rim-render-radius) var(--material-rim-render-radius);
    background-repeat: no-repeat;
  }

  .material-crevice {
    z-index: 3;
    box-sizing: border-box;
    border: 1px solid var(--material-crevice-color);
    visibility: var(--material-crevice-visibility);
  }

  .raised > .material-crevice {
    z-index: 1;
  }

  .recessed .material-crevice {
    inset: calc(0px - var(--material-rim-half-width));
  }

  .material-content {
    position: relative;
    z-index: 1;
    display: flex;
    width: 100%;
    height: 100%;
    min-height: inherit;
    align-items: inherit;
    justify-content: inherit;
    flex-direction: var(--material-content-direction, row);
    gap: var(--material-content-gap, 0);
    box-sizing: border-box;
    overflow: hidden;
    border-radius: inherit;
    padding: var(--material-content-padding, 0);
  }

  .raised > .material-content {
    z-index: 4;
  }
</style>

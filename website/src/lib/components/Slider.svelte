<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import Circle from "./Circle.svelte";
  import Slot from "./Slot.svelte";
  import {
    defaultCreviceFreeMaterialSettings,
    type MaterialSettings,
  } from "./materialSurface";

  type SliderProps = Omit<
    HTMLInputAttributes,
    "type" | "value" | "min" | "max" | "step" | "class"
  > & {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    width?: number;
    height?: number;
    thumbSize?: number;
    endPadding?: number;
    class?: string;
    className?: string;
    accentColor?: string;
    material?: MaterialSettings;
  };

  let {
    value = $bindable(50),
    min = 0,
    max = 100,
    step = 1,
    width = 240,
    height = 16,
    thumbSize = 14,
    endPadding = 2,
    class: classValue = "",
    className = "",
    accentColor = "var(--color-primary)",
    material = defaultCreviceFreeMaterialSettings,
    disabled = false,
    oninput,
    ...inputProps
  }: SliderProps = $props();

  const mergedClass = $derived(
    `slider ${classValue} ${className}`.trim(),
  );
  const clampedValue = $derived(Math.min(max, Math.max(min, value)));
  const ratio = $derived(max === min ? 0 : (clampedValue - min) / (max - min));
  const thumbInset = $derived(
    Math.max(0, (height - thumbSize) / 2, endPadding),
  );
  const thumbPosition = $derived(
    `${thumbInset + ratio * Math.max(0, width - thumbSize - thumbInset * 2)}px`,
  );

  function handleInput(
    event: Event & { currentTarget: EventTarget & HTMLInputElement },
  ) {
    value = event.currentTarget.valueAsNumber;
    oninput?.(event);
  }
</script>

<span
  class={mergedClass}
  style:--slider-width={`${width}px`}
  style:--slider-height={`${height}px`}
  style:--slider-thumb-size={`${thumbSize}px`}
  style:--slider-thumb-position={thumbPosition}
  style:--slider-accent-color={accentColor}
>
  <Slot {width} {height} {material}><span aria-hidden="true"></span></Slot>

  <span class="slider-thumb-clip" aria-hidden="true">
    <span class="slider-thumb">
      <Circle
        size={thumbSize}
        {material}
        style="
          --circle-color: var(--slider-accent-color);
          --circle-shadow-far: hsl(from var(--slider-accent-color) h s calc(l - 27) / 0.7);
          --circle-shadow-near: hsl(from var(--slider-accent-color) h s calc(l - 22) / 0.58);
          --circle-shadow-light: hsl(from var(--slider-accent-color) h s calc(l + 15) / 0.42);
        "
      />
    </span>
  </span>

  <input
    {...inputProps}
    type="range"
    {min}
    {max}
    {step}
    {value}
    {disabled}
    oninput={handleInput}
  />
</span>

<style>
  .slider {
    --slider-width: 240px;
    --slider-height: 16px;
    --slider-thumb-size: 14px;
    --slider-thumb-position: 0px;
    --slider-accent-color: var(--color-primary);

    position: relative;
    display: inline-block;
    width: var(--slider-width);
    height: var(--slider-height);
    flex: none;
    border-radius: calc(var(--slider-height) / 2);
  }

  .slider-thumb-clip {
    position: absolute;
    z-index: 2;
    inset: 0;
    overflow: visible;
    clip-path: inset(-12px -16px);
    pointer-events: none;
  }

  .slider-thumb {
    position: absolute;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    top: calc((var(--slider-height) - var(--slider-thumb-size)) / 2 - 0.5px);
    left: var(--slider-thumb-position);
    width: var(--slider-thumb-size);
    height: var(--slider-thumb-size);
    pointer-events: none;
  }

  input[type="range"] {
    position: absolute;
    z-index: 3;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    appearance: none;
    -webkit-appearance: none;
    border: 0;
    border-radius: inherit;
    background: transparent;
    cursor: pointer;
    opacity: 0;
  }

  input[type="range"]:disabled {
    cursor: not-allowed;
  }

  .slider:has(input:disabled) {
    opacity: 0.5;
  }

  .slider:has(input:focus-visible) {
    outline: 2px solid var(--slider-accent-color);
    outline-offset: 3px;
  }
</style>

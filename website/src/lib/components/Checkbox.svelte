<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import Slot from "./Slot.svelte";
  import Square from "./Square.svelte";
  import {
    defaultToggleMaterialSettings,
    type MaterialSettings,
  } from "./materialSurface";

  type CheckboxProps = Omit<
    HTMLInputAttributes,
    "type" | "checked" | "class" | "size"
  > & {
    checked?: boolean;
    size?: number;
    indicatorSize?: number;
    accentColor?: string;
    material?: MaterialSettings;
    class?: string;
    className?: string;
  };

  let {
    checked = $bindable(false),
    size = 22,
    indicatorSize = 16,
    accentColor = "var(--color-primary)",
    material = defaultToggleMaterialSettings,
    disabled = false,
    class: classValue = "",
    className = "",
    onchange,
    ...inputProps
  }: CheckboxProps = $props();

  const mergedClass = $derived(
    `snap-checkbox ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} ${classValue} ${className}`.trim(),
  );
  const slotScale = $derived(Math.max(0, size) / 22);
  const indicatorScale = $derived(Math.max(0, indicatorSize) / 16);
  const slotMaterial = $derived<MaterialSettings>({
    ...material,
    shadowDistance: Math.min(material.shadowDistance, 3.5 * slotScale),
    shadowBlur: Math.min(material.shadowBlur, 3 * slotScale),
    rimWidth: Math.min(material.rimWidth, 0.4 * slotScale),
    rimBlur: Math.min(material.rimBlur, 0.25 * slotScale),
  });
  const indicatorMaterial = $derived<MaterialSettings>({
    ...material,
    shadowDistance: Math.min(material.shadowDistance, 3 * indicatorScale),
    shadowBlur: Math.min(material.shadowBlur, 3.5 * indicatorScale),
    rimWidth: Math.min(material.rimWidth, 0.55 * indicatorScale),
    rimBlur: Math.min(material.rimBlur, 0.2 * indicatorScale),
  });

  function handleChange(
    event: Event & { currentTarget: EventTarget & HTMLInputElement },
  ) {
    onchange?.(event);
  }
</script>

<div
  class={mergedClass}
  style:--checkbox-size={`${size}px`}
  style:--checkbox-accent-color={accentColor}
>
  <Slot
    width={size}
    height={size}
    radius={3 * slotScale}
    material={slotMaterial}
    creviceOutline={false}
    className="checkbox-slot"
  >
    <span aria-hidden="true"></span>
  </Slot>

  <div class="checkbox-indicator" aria-hidden="true">
    <Square
      size={indicatorSize}
      radius={2 * indicatorScale}
      material={indicatorMaterial}
      creviceOutline={false}
      className="checkbox-square"
      style="
        --material-color: var(--checkbox-accent-color);
        --material-shadow-far-base: hsl(from var(--checkbox-accent-color) h s calc(l - 27) / 0.7);
        --material-shadow-near-base: hsl(from var(--checkbox-accent-color) h s calc(l - 22) / 0.58);
        --material-shadow-light-base: hsl(from var(--checkbox-accent-color) h s calc(l + 15) / 0.42);
      "
    />
    <div class="checkbox-glyph">
      <div class="checkbox-check checkbox-check-short"></div>
      <div class="checkbox-check checkbox-check-long"></div>
    </div>
  </div>

  <input
    {...inputProps}
    type="checkbox"
    {disabled}
    bind:checked
    onchange={handleChange}
  />
</div>

<style>
  .snap-checkbox {
    position: relative;
    display: inline-flex;
    width: var(--checkbox-size);
    height: var(--checkbox-size);
    flex: none;
    border-radius: 3px;
    cursor: pointer;
  }

  :global(.checkbox-slot) {
    pointer-events: none;
  }

  .checkbox-indicator {
    position: absolute;
    z-index: 2;
    inset: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transform: scale(0.55);
    transition:
      opacity 140ms ease,
      transform 140ms ease;
  }

  .checkbox-glyph {
    position: absolute;
    z-index: 1;
    top: 50%;
    left: 50%;
    width: 11px;
    height: 9px;
    transform: translate(-40%, -54%);
  }

  .checkbox-check {
    position: absolute;
    height: 2px;
    border-radius: 999px;
    background: #fff;
    transform-origin: left center;
  }

  .checkbox-check-short {
    width: 5px;
    top: 4px;
    left: 0;
    rotate: 45deg;
  }

  .checkbox-check-long {
    width: 9px;
    top: 7px;
    left: 3px;
    rotate: -48deg;
  }

  .checked .checkbox-indicator {
    opacity: 1;
    transform: scale(1);
  }

  input {
    position: absolute;
    z-index: 3;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: inherit;
  }

  .snap-checkbox:has(input:focus-visible) {
    outline: 2px solid var(--color-primary);
    outline-offset: 3px;
  }

  .disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .checkbox-indicator {
      transition: none;
    }
  }
</style>

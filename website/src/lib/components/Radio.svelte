<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import Circle from "./Circle.svelte";
  import Slot from "./Slot.svelte";
  import {
    defaultToggleMaterialSettings,
    type MaterialSettings,
  } from "./materialSurface";

  type RadioProps = Omit<
    HTMLInputAttributes,
    "type" | "checked" | "value" | "class" | "size"
  > & {
    group?: string;
    value: string;
    size?: number;
    indicatorSize?: number;
    accentColor?: string;
    material?: MaterialSettings;
    class?: string;
    className?: string;
  };

  let {
    group = $bindable(""),
    value,
    size = 22,
    indicatorSize = 13,
    accentColor = "var(--color-primary)",
    material = defaultToggleMaterialSettings,
    disabled = false,
    class: classValue = "",
    className = "",
    onchange,
    ...inputProps
  }: RadioProps = $props();

  const checked = $derived(group === value);
  const mergedClass = $derived(
    `snap-radio ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} ${classValue} ${className}`.trim(),
  );
  const slotScale = $derived(Math.max(0, size) / 22);
  const indicatorScale = $derived(Math.max(0, indicatorSize) / 13);
  const slotMaterial = $derived<MaterialSettings>({
    ...material,
    shadowDistance: Math.min(material.shadowDistance, 3.5 * slotScale),
    shadowBlur: Math.min(material.shadowBlur, 3 * slotScale),
    rimWidth: Math.min(material.rimWidth, 0.4 * slotScale),
    rimBlur: Math.min(material.rimBlur, 0.25 * slotScale),
  });
  const indicatorMaterial = $derived<MaterialSettings>({
    ...material,
    shadowDistance: Math.min(
      material.shadowDistance,
      3 * indicatorScale,
    ),
    shadowBlur: Math.min(material.shadowBlur, 3.5 * indicatorScale),
    rimWidth: Math.min(material.rimWidth, 0.55 * indicatorScale),
    rimBlur: Math.min(material.rimBlur, 0.2 * indicatorScale),
  });

  function handleChange(
    event: Event & { currentTarget: EventTarget & HTMLInputElement },
  ) {
    if (event.currentTarget.checked) group = value;
    onchange?.(event);
  }
</script>

<span
  class={mergedClass}
  style:--radio-size={`${size}px`}
  style:--radio-accent-color={accentColor}
>
  <Slot
    width={size}
    height={size}
    material={slotMaterial}
    creviceOutline={false}
    className="radio-slot"
  >
    <span aria-hidden="true"></span>
  </Slot>

  <span class="radio-indicator" aria-hidden="true">
    <Circle
      size={indicatorSize}
      material={indicatorMaterial}
      creviceOutline={false}
      className="radio-circle"
      style="
        --circle-color: var(--radio-accent-color);
        --circle-shadow-far: hsl(from var(--radio-accent-color) h s calc(l - 27) / 0.7);
        --circle-shadow-near: hsl(from var(--radio-accent-color) h s calc(l - 22) / 0.58);
        --circle-shadow-light: hsl(from var(--radio-accent-color) h s calc(l + 15) / 0.42);
      "
    />
  </span>

  <input
    {...inputProps}
    type="radio"
    {value}
    {disabled}
    {checked}
    onchange={handleChange}
  />
</span>

<style>
  .snap-radio {
    position: relative;
    display: inline-flex;
    width: var(--radio-size);
    height: var(--radio-size);
    flex: none;
    border-radius: 50%;
    cursor: pointer;
  }

  :global(.radio-slot) {
    pointer-events: none;
  }

  .radio-indicator {
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

  .checked .radio-indicator {
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

  .snap-radio:has(input:focus-visible) {
    outline: 2px solid var(--color-primary);
    outline-offset: 3px;
  }

  .disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .radio-indicator {
      transition: none;
    }
  }
</style>

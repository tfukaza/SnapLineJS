<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import Circle from "./Circle.svelte";
  import Slot from "./Slot.svelte";
  import {
    defaultCreviceFreeMaterialSettings,
    type MaterialSettings,
  } from "./materialSurface";

  type ToggleProps = Omit<
    HTMLButtonAttributes,
    "children" | "class" | "aria-checked"
  > & {
    checked?: boolean;
    class?: string;
    className?: string;
    accentColor?: string;
    material?: MaterialSettings;
  };

  let {
    checked = $bindable(false),
    class: classValue = "",
    className = "",
    accentColor = "var(--color-primary)",
    material = defaultCreviceFreeMaterialSettings,
    disabled = false,
    type = "button",
    onclick,
    ...buttonProps
  }: ToggleProps = $props();

  const mergedClass = $derived(
    `toggle ${checked ? "checked" : ""} ${classValue} ${className}`.trim(),
  );

  function handleClick(
    event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement },
  ) {
    checked = !checked;
    onclick?.(event);
  }
</script>

<button
  {...buttonProps}
  {type}
  {disabled}
  class={mergedClass}
  role="switch"
  aria-checked={checked}
  onclick={handleClick}
  style:--toggle-accent-color={accentColor}
>
  <Slot {material}>
    <span class="toggle-track-fill" aria-hidden="true"></span>
  </Slot>
  <span class="toggle-thumb-clip" aria-hidden="true">
    <span class="toggle-thumb" aria-hidden="true">
      <Circle
        size={18}
        {material}
        style="
          --circle-color: var(--toggle-thumb-color);
          --circle-shadow-far: hsl(from var(--toggle-thumb-color) h s calc(l - 27) / 0.7);
          --circle-shadow-near: hsl(from var(--toggle-thumb-color) h s calc(l - 22) / 0.58);
          --circle-shadow-light: hsl(from var(--toggle-thumb-color) h s calc(l + 15) / 0.42);
        "
      />
    </span>
  </span>
  <span class="toggle-rim-reflection" aria-hidden="true"></span>
</button>

<style>
  .toggle {
    --toggle-width: 36px;
    --toggle-height: 22px;
    --toggle-radius: 11px;
    --toggle-thumb-size: 18px;
    --toggle-thumb-offset: 1.5px;
    --toggle-thumb-travel: 14px;
    --toggle-thumb-center-start: 10.5px;
    --toggle-track-overhang: 1px;
    --toggle-thumb-color: var(--toggle-accent-color);
    --toggle-track-on-color: var(--toggle-accent-color);
    --toggle-reflection-width: 1px;
    --toggle-reflection-blur: 0.5px;

    position: relative;
    display: inline-flex;
    width: var(--toggle-width);
    height: var(--toggle-height);
    padding: 0;
    border: 0;
    border-radius: var(--toggle-radius);
    background: transparent;
    cursor: pointer;
  }

  .toggle-track-fill {
    position: absolute;
    z-index: 0;
    top: 0;
    bottom: 0;
    left: calc(0px - var(--toggle-track-overhang));
    width: calc(
      var(--toggle-thumb-center-start) + var(--toggle-track-overhang)
    );
    border-radius: 999px 0 0 999px;
    background: var(--toggle-track-on-color);
    transition: width 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    pointer-events: none;
  }

  .toggle.checked .toggle-track-fill {
    width: calc(
      var(--toggle-thumb-center-start) + var(--toggle-thumb-travel) +
        var(--toggle-track-overhang)
    );
  }

  .toggle-thumb-clip {
    position: absolute;
    z-index: 1;
    inset: 0.5px;
    overflow: hidden;
    border-radius: calc(var(--toggle-radius) - 0.5px);
    pointer-events: none;
  }

  .toggle-thumb {
    position: absolute;
    z-index: 1;
    top: var(--toggle-thumb-offset);
    left: var(--toggle-thumb-offset);
    width: var(--toggle-thumb-size);
    height: var(--toggle-thumb-size);
    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .toggle.checked .toggle-thumb {
    transform: translateX(var(--toggle-thumb-travel));
  }

  .toggle-rim-reflection {
    position: absolute;
    z-index: 2;
    inset: calc(0px - var(--toggle-reflection-width));
    padding: calc(var(--toggle-reflection-width) + var(--toggle-reflection-width));
    box-sizing: border-box;
    border-radius: calc(
      var(--toggle-radius) + var(--toggle-reflection-width)
    );
    background-image: radial-gradient(
      circle at 50% 50%,
      color-mix(in srgb, var(--toggle-thumb-color), #fff 24%) 0%,
      hsl(from var(--toggle-thumb-color) h s l / 0.62) 38%,
      hsl(from var(--toggle-thumb-color) h s l / 0) 78%
    );
    background-position: 0 50%;
    background-size: 24px 100%;
    background-repeat: no-repeat;
    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask-composite: exclude;
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    filter: blur(var(--toggle-reflection-blur));
    pointer-events: none;
    transition: background-position 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .toggle.checked .toggle-rim-reflection {
    background-position: var(--toggle-thumb-travel) 50%;
  }

  .toggle:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .toggle:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
</style>

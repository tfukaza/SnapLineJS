<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import MaterialSurface from "./MaterialSurface.svelte";
  import {
    defaultButtonMaterialSettings,
    type MaterialSettings,
  } from "./materialSurface";

  type SnapButtonProps = Omit<HTMLButtonAttributes, "children" | "class"> & {
    children: Snippet;
    material?: MaterialSettings;
    class?: string;
    className?: string;
  };

  let {
    children,
    material,
    class: classValue = "",
    className = "",
    type = "button",
    onmouseenter,
    onmouseleave,
    onpointerdown,
    onpointerup,
    onpointercancel,
    ...buttonProps
  }: SnapButtonProps = $props();

  let hovered = $state(false);
  let pressed = $state(false);
  const mergedClass = $derived(`snap-button ${classValue} ${className}`.trim());
  const resolvedMaterial = $derived(material ?? defaultButtonMaterialSettings);
  const interactiveMaterial = $derived<MaterialSettings>({
    ...resolvedMaterial,
    shadowDistance: buttonProps.disabled
      ? resolvedMaterial.shadowDistance * 0.08
      : pressed
        ? resolvedMaterial.shadowDistance * 0.12
        : hovered
          ? resolvedMaterial.shadowDistance * 0.4
          : resolvedMaterial.shadowDistance,
    shadowBlur: buttonProps.disabled || hovered || pressed
      ? resolvedMaterial.shadowBlur * 0.2
      : resolvedMaterial.shadowBlur,
  });

  function handleMouseEnter(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
    hovered = true;
    onmouseenter?.(event);
  }

  function handleMouseLeave(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
    hovered = false;
    pressed = false;
    onmouseleave?.(event);
  }

  function handlePointerDown(event: PointerEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
    pressed = true;
    onpointerdown?.(event);
  }

  function handlePointerUp(event: PointerEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
    pressed = false;
    onpointerup?.(event);
  }

  function handlePointerCancel(event: PointerEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
    pressed = false;
    onpointercancel?.(event);
  }
</script>

<button
  {...buttonProps}
  {type}
  class={mergedClass}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  onpointerdown={handlePointerDown}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerCancel}
>
  <MaterialSurface depth="raised" shape="rounded" radius={8} material={interactiveMaterial} creviceOutline={false} className="snap-button-surface" style="--material-color: var(--snap-button-color); --material-shadow-light-base: hsl(from var(--snap-button-color) h s calc(l + 10) / 0.35)">
    <span class="snap-button-content">{@render children()}</span>
  </MaterialSurface>
</button>

<style>
  .snap-button {
    --snap-button-color: #ececeb;
    --snap-button-text-color: var(--color-text-muted);
    --snap-button-min-height: 36px;
    --snap-button-padding-block-start: 8px;
    --snap-button-padding-block-end: 6px;
    --snap-button-padding-inline: var(--size-16);

    display: inline-flex;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--snap-button-text-color);
    font: inherit;
    font-family: var(--font-label);
    font-weight: 400;
    cursor: pointer;
  }

  :global(.snap-button-surface) {
    --material-color: var(--snap-button-color);
    --material-content-padding: var(--snap-button-padding-block-start)
      var(--snap-button-padding-inline) var(--snap-button-padding-block-end);
    min-height: var(--snap-button-min-height);
    transition:
      box-shadow 160ms ease,
      opacity 160ms ease,
      transform 160ms ease;
  }

  .snap-button-content {
    line-height: 1.25;
  }

  .snap-button.small {
    --snap-button-padding-block-start: 8px;
    --snap-button-padding-block-end: 6px;
    --snap-button-padding-inline: var(--size-12);
    font-size: 0.875rem;
  }

  .snap-button.primary {
    --snap-button-color: var(--color-primary);
    --snap-button-text-color: #fff;
  }

  .snap-button.active .snap-button-content {
    color: var(--color-primary);
    text-shadow:
      0 0 4px rgb(255 93 15 / 90%),
      0 0 10px rgb(255 93 15 / 62%);
  }

  .snap-button:disabled {
    cursor: not-allowed;
    pointer-events: none;
  }

  .snap-button:disabled :global(.snap-button-surface) {
    opacity: 0.58;
    transform: translateY(2px);
  }

  .snap-button:focus-visible {
    outline: 2px solid var(--color-action);
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.snap-button-surface) {
      transition: none;
    }
  }
</style>

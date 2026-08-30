<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import Circle from "./Circle.svelte";
  import {
    defaultDialMaterialSettings,
    type MaterialSettings,
  } from "./materialSurface";

  type DialProps = Omit<HTMLAttributes<HTMLDivElement>, "class" | "role" | "oninput"> & {
    value?: number;
    step?: number;
    size?: number;
    disabled?: boolean;
    material?: MaterialSettings;
    class?: string;
    className?: string;
    oninput?: (value: number) => void;
  };

  let {
    value = $bindable(325),
    step = 1,
    size = 96,
    disabled = false,
    material,
    class: classValue = "",
    className = "",
    oninput,
    ...dialProps
  }: DialProps = $props();

  let activePointerId = $state<number | null>(null);
  const mergedClass = $derived(`dial ${classValue} ${className}`.trim());
  const normalizedValue = $derived(normalize(value));
  const normalizedStep = $derived(
    Number.isFinite(step) ? Math.max(0.01, step) : 1,
  );
  const markerAngles = $derived.by(() =>
    Array.from(
      { length: Math.max(1, Math.ceil(360 / normalizedStep)) },
      (_, index) => index * normalizedStep,
    ).filter((angle) => angle < 360),
  );
  const activeMarkerIndex = $derived.by(() => {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const [index, angle] of markerAngles.entries()) {
      const directDistance = Math.abs(normalizedValue - angle);
      const circularDistance = Math.min(directDistance, 360 - directDistance);
      if (circularDistance < closestDistance) {
        closestIndex = index;
        closestDistance = circularDistance;
      }
    }

    return closestIndex;
  });
  const dotDistance = $derived(Math.max(0, size / 2 - 13));
  const directionOffsetX = $derived(
    `${Math.sin(normalizedValue * Math.PI / 180) * dotDistance}px`,
  );
  const directionOffsetY = $derived(
    `${-Math.cos(normalizedValue * Math.PI / 180) * dotDistance}px`,
  );
  const markerDistance = $derived(`${Math.max(0, size / 2 + 7)}px`);
  const resolvedMaterial = $derived(
    material ?? defaultDialMaterialSettings,
  );
  const directionMaterial = $derived<MaterialSettings>({
    ...resolvedMaterial,
    shadowDistance: Math.min(resolvedMaterial.shadowDistance, 1.25),
    shadowBlur: Math.min(resolvedMaterial.shadowBlur, 1.5),
    rimWidth: 0,
    rimBlur: 0,
    shadedRim: false,
    creviceOutline: false,
  });

  function normalize(nextValue: number) {
    return ((nextValue % 360) + 360) % 360;
  }

  function commit(nextValue: number) {
    value = normalize(Math.round(nextValue / normalizedStep) * normalizedStep);
    oninput?.(value);
  }

  function commitPointer(event: PointerEvent & { currentTarget: EventTarget & HTMLDivElement }) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    commit(Math.atan2(x, -y) * 180 / Math.PI);
  }

  function handlePointerDown(event: PointerEvent & { currentTarget: EventTarget & HTMLDivElement }) {
    if (disabled) return;
    activePointerId = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    commitPointer(event);
  }

  function handlePointerMove(event: PointerEvent & { currentTarget: EventTarget & HTMLDivElement }) {
    if (disabled || activePointerId !== event.pointerId) return;
    commitPointer(event);
  }

  function releasePointer(event: PointerEvent & { currentTarget: EventTarget & HTMLDivElement }) {
    if (activePointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activePointerId = null;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (disabled) return;
    const increment = event.shiftKey ? normalizedStep * 10 : normalizedStep;
    let nextValue: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowUp") nextValue = normalizedValue + increment;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") nextValue = normalizedValue - increment;
    if (event.key === "PageUp") nextValue = normalizedValue + normalizedStep * 10;
    if (event.key === "PageDown") nextValue = normalizedValue - normalizedStep * 10;
    if (event.key === "Home") nextValue = 0;
    if (event.key === "End") nextValue = markerAngles.at(-1) ?? 0;

    if (nextValue === null) return;
    event.preventDefault();
    commit(nextValue);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  {...dialProps}
  class={mergedClass}
  class:disabled
  class:dragging={activePointerId !== null}
  style:--dial-size={`${size}px`}
  style:--dial-direction-x={directionOffsetX}
  style:--dial-direction-y={directionOffsetY}
  style:--dial-marker-distance={markerDistance}
  role="slider"
  tabindex={disabled ? undefined : 0}
  aria-disabled={disabled}
  aria-valuemin="0"
  aria-valuemax="359"
  aria-valuenow={Math.round(normalizedValue)}
  aria-valuetext={`${Math.round(normalizedValue)}`}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={releasePointer}
  onpointercancel={releasePointer}
  onkeydown={handleKeydown}
>
  <Circle
    {size}
    material={resolvedMaterial}
    className="dial-body"
    aria-hidden="true"
  />
  <span class="dial-markers" aria-hidden="true">
    {#each markerAngles as angle, markerIndex}
      <span
        class="dial-marker"
        class:selected={markerIndex === activeMarkerIndex}
        data-marker-angle={angle}
        style:--dial-marker-angle={`${angle}deg`}
      ></span>
    {/each}
  </span>
  <span class="dial-value" aria-hidden="true">{Math.round(normalizedValue)}</span>
  <Circle
    size={8}
    material={directionMaterial}
    creviceOutline={false}
    className="dial-direction"
    aria-hidden="true"
    style="
      --circle-color: var(--color-primary);
      --circle-shadow-far: hsl(from var(--color-primary) h s calc(l - 27) / 0.7);
      --circle-shadow-near: hsl(from var(--color-primary) h s calc(l - 22) / 0.58);
      --circle-shadow-light: hsl(from var(--color-primary) h s calc(l + 15) / 0.42);
    "
  />
</div>

<style>
  .dial {
    --dial-size: 96px;
    --dial-direction-x: 0px;
    --dial-direction-y: -35px;
    --dial-marker-distance: 55px;

    position: relative;
    display: inline-grid;
    width: var(--dial-size);
    height: var(--dial-size);
    place-items: center;
    flex: none;
    border-radius: 50%;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  .dial:active {
    cursor: grabbing;
  }

  .dial.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .dial:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 5px;
  }

  .dial > :global(.dial-body),
  .dial-markers {
    position: absolute;
  }

  .dial > :global(.dial-body) {
    inset: 0;
  }

  .dial-markers {
    z-index: 5;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .dial-marker {
    position: absolute;
    top: 0;
    left: 0;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background-color: color-mix(
      in srgb,
      var(--color-background-dark) 28%,
      transparent
    );
    transform: translate(-50%, -50%) rotate(var(--dial-marker-angle))
      translateY(calc(0px - var(--dial-marker-distance))) scale(1);
    transform-origin: center;
    box-shadow: 0 0 0 0 transparent;
    transition:
      transform 150ms ease-out,
      background-color 150ms ease-out,
      box-shadow 150ms ease-out;
  }

  .dial:not(.disabled):focus-visible .dial-marker,
  .dial.dragging .dial-marker {
    background-color: color-mix(
      in srgb,
      var(--color-background-dark) 68%,
      transparent
    );
  }

  .dial:not(.disabled):focus-visible .dial-marker.selected,
  .dial:not(.disabled).dragging .dial-marker.selected {
    background-color: color-mix(
      in srgb,
      var(--color-background-dark) 92%,
      transparent
    );
    transform: translate(-50%, -50%) rotate(var(--dial-marker-angle))
      translateY(calc(0px - var(--dial-marker-distance))) scale(2);
  }

  .dial.dragging .dial-marker.selected {
    background-color: var(--color-primary) !important;
    box-shadow: none;
    transition:
      transform 150ms ease-out,
      background-color 0s linear,
      box-shadow 150ms ease-out;
  }

  .dial-value {
    z-index: 6;
    font-family: var(--font-label);
    font-size: calc(var(--dial-size) * 0.18);
    line-height: 1;
    color: var(--color-text);
    pointer-events: none;
  }

  .dial > :global(.dial-direction) {
    position: absolute;
    z-index: 7;
    left: 50%;
    top: 50%;
    right: auto;
    bottom: auto;
    transform: translate(
      calc(-50% + var(--dial-direction-x)),
      calc(-50% + var(--dial-direction-y))
    );
    transform-origin: center;
    pointer-events: none;
  }

  @media (hover: hover) {
    .dial:not(.disabled):not(.dragging):hover .dial-marker {
      background-color: color-mix(
        in srgb,
        var(--color-background-dark) 68%,
        transparent
      );
    }

    .dial:not(.disabled):not(.dragging):hover .dial-marker.selected {
      background-color: color-mix(
        in srgb,
        var(--color-background-dark) 92%,
        transparent
      );
      transform: translate(-50%, -50%) rotate(var(--dial-marker-angle))
        translateY(calc(0px - var(--dial-marker-distance))) scale(2);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dial-marker {
      transition: none;
    }
  }
</style>

<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import Circle from "./Circle.svelte";
  import type { MaterialSettings } from "./materialSurface";

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

  let activePointerId: number | null = null;
  const mergedClass = $derived(`dial ${classValue} ${className}`.trim());
  const normalizedValue = $derived(normalize(value));
  const dotDistance = $derived(`${Math.max(0, size / 2 - 13)}px`);

  function normalize(nextValue: number) {
    return ((nextValue % 360) + 360) % 360;
  }

  function commit(nextValue: number) {
    const safeStep = Math.max(0.01, step);
    value = normalize(Math.round(nextValue / safeStep) * safeStep);
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
    const increment = event.shiftKey ? step * 10 : step;
    let nextValue: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowUp") nextValue = normalizedValue + increment;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") nextValue = normalizedValue - increment;
    if (event.key === "PageUp") nextValue = normalizedValue + step * 10;
    if (event.key === "PageDown") nextValue = normalizedValue - step * 10;
    if (event.key === "Home") nextValue = 0;
    if (event.key === "End") nextValue = 359;

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
  style:--dial-size={`${size}px`}
  style:--dial-angle={`${normalizedValue}deg`}
  style:--dial-dot-distance={dotDistance}
  role="slider"
  tabindex={disabled ? undefined : 0}
  aria-disabled={disabled}
  aria-valuemin="0"
  aria-valuemax="359"
  aria-valuenow={Math.round(normalizedValue)}
  aria-valuetext={`${Math.round(normalizedValue)} degrees`}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={releasePointer}
  onpointercancel={releasePointer}
  onkeydown={handleKeydown}
>
  <Circle {size} {material} aria-hidden="true" />
  <span class="dial-ticks" aria-hidden="true"></span>
  <span class="dial-direction" aria-hidden="true"></span>
</div>

<style>
  .dial {
    --dial-size: 96px;
    --dial-angle: 325deg;
    --dial-inset: 13px;
    --dial-dot-distance: 35px;

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

  .dial > :global(.circle),
  .dial-ticks,
  .dial-direction {
    position: absolute;
    inset: 0;
  }

  .dial-ticks {
    z-index: 5;
    border-radius: 50%;
    background: repeating-conic-gradient(
      from 0deg,
      rgb(0 0 0 / 45%) 0deg 1deg,
      transparent 1deg 15deg
    );
    mask: radial-gradient(
      circle,
      transparent 0 calc(50% - var(--dial-inset) - 5px),
      #000 calc(50% - var(--dial-inset) - 4px) calc(50% - var(--dial-inset)),
      transparent calc(50% - var(--dial-inset) + 1px)
    );
    pointer-events: none;
  }

  .dial-direction {
    z-index: 6;
    left: 50%;
    top: 50%;
    right: auto;
    bottom: auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-primary);
    box-shadow: 0 0 0 1px rgb(0 0 0 / 35%);
    transform: translate(-50%, -50%) rotate(var(--dial-angle)) translateY(calc(0px - var(--dial-dot-distance)));
    transform-origin: center;
    pointer-events: none;
  }
</style>

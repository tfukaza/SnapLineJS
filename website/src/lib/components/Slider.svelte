<script lang="ts">
  import { tick } from "svelte";
  import type { HTMLInputAttributes } from "svelte/elements";
  import { Engine } from "@snap-engine/asset-base/svelte";
  import {
    ElementObject,
    type Engine as CoreEngine,
  } from "@snap-engine/core";
  import Circle from "./Circle.svelte";
  import Slot from "./Slot.svelte";
  import {
    defaultSliderMaterialSettings,
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
    markers?: "dots" | "precision";
    fluid?: boolean;
    class?: string;
    className?: string;
    accentColor?: string;
    material?: MaterialSettings;
  };

  type SliderPointerEvent = PointerEvent & {
    currentTarget: EventTarget & HTMLInputElement;
  };

  type PrecisionMarkerDom = {
    index: number;
    marker: HTMLSpanElement;
    label: HTMLSpanElement;
    tick: HTMLSpanElement;
  };

  type PrecisionLensSide = {
    direction: -1 | 1;
    baseRadius: number;
    displayRadius: number;
    falloffExponent: number;
  };

  type PrecisionLensContext = {
    start: number;
    end: number;
    focus: number;
    activeBase: number;
    activeIndex: number;
    left: PrecisionLensSide;
    right: PrecisionLensSide;
  };

  type PrecisionMarkerVisual = {
    x: number;
    zIndex: number;
    tickScale: number;
    tickColor: string;
    labelScale: number;
    labelOpacity: number;
    labelColor: string;
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
    markers,
    fluid = false,
    class: classValue = "",
    className = "",
    accentColor = "var(--color-primary)",
    material = defaultSliderMaterialSettings,
    disabled = false,
    id,
    oninput,
    onpointerenter,
    onpointerleave,
    onpointerdown,
    onpointerup,
    onpointercancel,
    onlostpointercapture,
    ...inputProps
  }: SliderProps = $props();
  const generatedSliderId = $props.id();

  const precisionReadoutRadius = 2;
  // Immediate neighbors target a 20px gap when the lens has room.
  const precisionCenterMarkerGap = 20;
  const precisionBaseLensRadius = 64;
  const precisionLensSolveIterations = 24;
  const precisionMaximumFalloffExponent = 1024;
  const precisionLensBoundaryEpsilon = 0.000_001;
  const precisionTickHeight = 24;
  const precisionIdleTickHeight = 8;
  const precisionMinimumTickScale =
    precisionIdleTickHeight / precisionTickHeight;
  const precisionVisualExponent = 3;
  const precisionIdleLabelScale = 0.78;
  const precisionSelectedLabelScale = 1.2;
  const precisionIdleTickDarkness = 34;
  const precisionMinimumReadoutLabelOpacity = 0.46;
  const precisionIdleTickColor =
    `color-mix(in srgb, var(--color-background-dark) ${precisionIdleTickDarkness}%, var(--color-background))`;
  const precisionIdleLabelColor =
    "color-mix(in srgb, var(--color-background-dark) 78%, transparent)";

  let clientWidth = $state(0);
  let isHovered = $state(false);
  let activePointerId = $state<number | null>(null);
  let sliderEngine = $state<CoreEngine | null>(null);
  let precisionRulerElement = $state<HTMLSpanElement | null>(null);
  let precisionObject: ElementObject<HTMLSpanElement> | null = null;
  let precisionRulerWidth = 0;
  let precisionMarkerDom: PrecisionMarkerDom[] = [];
  const precisionMarkerElements = new Map<number, HTMLSpanElement>();

  const mergedClass = $derived(
    `slider ${classValue} ${className}`.trim(),
  );
  const isDragging = $derived(activePointerId !== null);
  const renderedWidth = $derived(
    fluid && clientWidth > 0 ? clientWidth : width,
  );
  const clampedValue = $derived(Math.min(max, Math.max(min, value)));
  const ratio = $derived(max === min ? 0 : (clampedValue - min) / (max - min));
  const thumbInset = $derived(
    Math.max(0, (height - thumbSize) / 2, endPadding),
  );
  const thumbPosition = $derived(
    `${thumbCenterPosition(renderedWidth) - thumbSize / 2}px`,
  );
  const markerIntervalCount = $derived.by(() => {
    const span = max - min;

    if (
      !markers ||
      !Number.isFinite(span) ||
      !Number.isFinite(step) ||
      span < 0 ||
      step <= 0
    ) {
      return -1;
    }

    const rawIntervalCount = span / step;
    const roundingTolerance = Number.EPSILON * Math.max(1, rawIntervalCount) * 8;
    return Math.floor(rawIntervalCount + roundingTolerance);
  });
  const activeMarkerIndex = $derived(
    markerIntervalCount < 0
      ? -1
      : Math.min(
          markerIntervalCount,
          Math.max(0, Math.round((clampedValue - min) / step)),
        ),
  );
  const dotMarkerIndices = $derived.by(() =>
    markers === "dots" && markerIntervalCount >= 0
      ? createMarkerIndices(markerIntervalCount)
      : [],
  );
  const precisionMarkerIndices = $derived.by(() =>
    markers === "precision" && markerIntervalCount >= 0
      ? createMarkerIndices(markerIntervalCount)
      : [],
  );
  const precisionMinimumWidth = $derived(
    Math.min(
      2,
      Math.max(0, markerIntervalCount),
    ) * precisionCenterMarkerGap + thumbSize + thumbInset * 2,
  );
  const markerStepPrecision = $derived(decimalPlaces(step));
  const engineCanvasId = $derived(
    id ? `${id}-engine` : `${generatedSliderId}-engine`,
  );

  function clamp(number: number, minimum: number, maximum: number) {
    return Math.min(maximum, Math.max(minimum, number));
  }

  function createMarkerIndices(intervalCount: number) {
    return Array.from({ length: intervalCount + 1 }, (_, index) => index);
  }

  function decimalPlaces(number: number) {
    if (!Number.isFinite(number)) return 0;
    const [coefficient, exponentText = "0"] = Math.abs(number)
      .toString()
      .toLowerCase()
      .split("e");
    const fractionLength = coefficient.split(".")[1]?.length ?? 0;
    return Math.min(12, Math.max(0, fractionLength - Number(exponentText)));
  }

  function markerValue(index: number) {
    return min + index * step;
  }

  function thumbCenterPosition(currentWidth: number) {
    const currentThumbTravel = Math.max(
      0,
      currentWidth - thumbSize - thumbInset * 2,
    );
    return thumbInset + thumbSize / 2 + ratio * currentThumbTravel;
  }

  function markerPosition(index: number, currentWidth = renderedWidth) {
    const currentMarkerValue = markerValue(index);
    const markerRatio = max === min
      ? 0
      : (currentMarkerValue - min) / (max - min);
    const currentThumbTravel = Math.max(
      0,
      currentWidth - thumbSize - thumbInset * 2,
    );
    return thumbInset + thumbSize / 2 + markerRatio * currentThumbTravel;
  }

  function formatMarkerValue(index: number) {
    const currentMarkerValue = markerValue(index);
    const normalizedValue = Math.abs(currentMarkerValue) < Math.abs(step) / 2
      ? 0
      : currentMarkerValue;
    return normalizedValue.toFixed(markerStepPrecision);
  }

  function normalizedExponentialFalloff(
    progress: number,
    exponent: number,
  ) {
    const boundedProgress = clamp(progress, 0, 1);
    if (exponent <= precisionLensBoundaryEpsilon) return boundedProgress;

    return -Math.expm1(-exponent * boundedProgress)
      / -Math.expm1(-exponent);
  }

  function exponentialVisualStrength(proximity: number) {
    const boundedProximity = clamp(proximity, 0, 1);
    return Math.expm1(precisionVisualExponent * boundedProximity)
      / Math.expm1(precisionVisualExponent);
  }

  function solvePrecisionFalloffExponent(
    baseGap: number,
    targetGap: number,
    baseRadius: number,
    displayRadius: number,
  ) {
    const naturalDisplayGap = baseRadius <= 0
      ? 0
      : displayRadius * baseGap / baseRadius;
    if (
      baseRadius <= 0
      || displayRadius <= 0
      || baseGap <= 0
      || naturalDisplayGap >= targetGap
      || baseGap >= baseRadius
    ) {
      return 0;
    }

    const baseProgress = baseGap / baseRadius;
    const targetProgress = Math.min(
      1 - precisionLensBoundaryEpsilon,
      targetGap / displayRadius,
    );
    let minimumExponent = 0;
    let maximumExponent = 1;

    while (
      normalizedExponentialFalloff(baseProgress, maximumExponent)
        < targetProgress
      && maximumExponent < precisionMaximumFalloffExponent
    ) {
      maximumExponent = Math.min(
        precisionMaximumFalloffExponent,
        maximumExponent * 2,
      );
    }

    for (
      let iteration = 0;
      iteration < precisionLensSolveIterations;
      iteration += 1
    ) {
      const exponent = (minimumExponent + maximumExponent) / 2;
      if (
        normalizedExponentialFalloff(baseProgress, exponent) < targetProgress
      ) {
        minimumExponent = exponent;
      } else {
        maximumExponent = exponent;
      }
    }

    return maximumExponent;
  }

  function createPrecisionLensSide(
    direction: -1 | 1,
    activeIndex: number,
    activeBase: number,
    start: number,
    end: number,
    currentWidth: number,
  ): PrecisionLensSide {
    const focus = thumbCenterPosition(currentWidth);
    const availableDisplayRadius = direction < 0
      ? focus - start
      : end - focus;
    const displayRadius = Math.min(
      precisionBaseLensRadius,
      availableDisplayRadius,
    );
    const boundary = focus + direction * displayRadius;
    const baseRadius = Math.max(0, direction * (boundary - activeBase));
    const adjacentIndex = activeIndex + direction;
    const hasAdjacentMarker = adjacentIndex >= 0
      && adjacentIndex <= markerIntervalCount;
    const baseGap = hasAdjacentMarker
      ? Math.abs(markerPosition(adjacentIndex, currentWidth) - activeBase)
      : 0;
    const naturalDisplayGap = baseRadius <= 0
      ? 0
      : displayRadius * baseGap / baseRadius;
    const targetGap = Math.max(
      naturalDisplayGap,
      Math.min(
        precisionCenterMarkerGap,
        Math.max(0, displayRadius - naturalDisplayGap),
      ),
    );

    return {
      direction,
      baseRadius,
      displayRadius,
      falloffExponent: solvePrecisionFalloffExponent(
        baseGap,
        targetGap,
        baseRadius,
        displayRadius,
      ),
    };
  }

  function createPrecisionLensContext(
    currentWidth: number,
  ): PrecisionLensContext {
    const start = thumbInset + thumbSize / 2;
    const end = Math.max(start, currentWidth - thumbInset - thumbSize / 2);
    const activeIndex = Math.max(0, activeMarkerIndex);
    const activeBase = markerPosition(activeIndex, currentWidth);
    const focus = thumbCenterPosition(currentWidth);

    return {
      start,
      end,
      focus,
      activeBase,
      activeIndex,
      left: createPrecisionLensSide(
        -1,
        activeIndex,
        activeBase,
        start,
        end,
        currentWidth,
      ),
      right: createPrecisionLensSide(
        1,
        activeIndex,
        activeBase,
        start,
        end,
        currentWidth,
      ),
    };
  }

  function precisionMarkerPosition(
    index: number,
    baseX: number,
    context: PrecisionLensContext,
  ) {
    const offset = index - context.activeIndex;
    if (offset === 0) return context.focus;

    const side = offset < 0 ? context.left : context.right;
    const baseDistance = Math.abs(baseX - context.activeBase);
    if (baseDistance >= side.baseRadius || side.baseRadius <= 0) return baseX;

    const mappedDistance = side.displayRadius * normalizedExponentialFalloff(
      baseDistance / side.baseRadius,
      side.falloffExponent,
    );
    return context.focus + side.direction * mappedDistance;
  }

  function calculatePrecisionMarkerVisual(
    index: number,
    context: PrecisionLensContext,
    currentWidth: number,
  ): PrecisionMarkerVisual {
    const baseX = markerPosition(index, currentWidth);
    if (!isDragging || activeMarkerIndex < 0) {
      const showsHoverReadout = isHovered
        && !disabled
        && index === activeMarkerIndex;
      return {
        x: baseX,
        zIndex: showsHoverReadout ? 1 : 0,
        tickScale: precisionMinimumTickScale,
        tickColor: precisionIdleTickColor,
        labelScale: precisionIdleLabelScale,
        labelOpacity: showsHoverReadout ? 1 : 0,
        labelColor: precisionIdleLabelColor,
      };
    }

    const x = clamp(
      precisionMarkerPosition(index, baseX, context),
      context.start,
      context.end,
    );
    const sideRadius = index < context.activeIndex
      ? context.left.displayRadius
      : context.right.displayRadius;
    const visualRadius = Math.max(
      precisionLensBoundaryEpsilon,
      sideRadius,
    );
    const proximity = 1 - Math.abs(x - context.focus) / visualRadius;
    const strength = exponentialVisualStrength(proximity);
    const selected = index === context.activeIndex;
    const readoutVisible = Math.abs(index - context.activeIndex)
      <= precisionReadoutRadius;
    const labelDarkness = Math.round(70 + strength * 24);

    return {
      x,
      zIndex: selected ? 1 : 0,
      tickScale:
        precisionMinimumTickScale
        + (1 - precisionMinimumTickScale) * strength,
      tickColor: selected
        ? "var(--slider-accent-color)"
        : precisionIdleTickColor,
      labelScale:
        precisionIdleLabelScale
        + (precisionSelectedLabelScale - precisionIdleLabelScale) * strength,
      labelOpacity: readoutVisible
        ? selected
          ? 1
          : precisionMinimumReadoutLabelOpacity
            + strength * (1 - precisionMinimumReadoutLabelOpacity)
        : 0,
      labelColor: selected
        ? "var(--slider-accent-color)"
        : `color-mix(in srgb, var(--color-background-dark) ${labelDarkness}%, transparent)`,
    };
  }

  function schedulePrecisionRender(
    object = precisionObject,
  ) {
    if (!object) return;
    object.schedule(renderPrecisionMarkers, {
      stage: "WRITE_2",
      queueId: "precision-slider-render",
    });
  }

  function renderPrecisionMarkers() {
    const ruler = precisionRulerElement;
    if (!ruler || precisionRulerWidth <= 0 || precisionMarkerDom.length === 0) {
      return;
    }

    const context = createPrecisionLensContext(precisionRulerWidth);
    for (const elements of precisionMarkerDom) {
      const visual = calculatePrecisionMarkerVisual(
        elements.index,
        context,
        precisionRulerWidth,
      );
      const x = Math.round(visual.x * 1_000) / 1_000;
      const tickScale = Math.max(
        precisionMinimumTickScale,
        Math.round(visual.tickScale * 1_000) / 1_000,
      );
      const labelScale = Math.round(visual.labelScale * 1_000) / 1_000;
      const labelOffset = precisionTickHeight * tickScale + 3;

      elements.marker.style.transform = `translate3d(${x}px, 0, 0)`;
      elements.marker.style.zIndex = String(visual.zIndex);
      elements.tick.style.transform = `translate3d(-50%, 0, 0) scaleY(${tickScale})`;
      elements.tick.style.backgroundColor = visual.tickColor;
      elements.label.style.transform = `translate3d(-50%, -${labelOffset}px, 0) scale(${labelScale})`;
      elements.label.style.opacity = visual.labelOpacity.toFixed(3);
      elements.label.style.color = visual.labelColor;
    }

    ruler.style.opacity = "1";
  }

  function schedulePrecisionMeasurement(
    object = precisionObject,
  ) {
    if (!object) return;
    object.schedule(() => {
      const ruler = precisionRulerElement;
      if (!ruler || object !== precisionObject) return;

      precisionRulerWidth = ruler.getBoundingClientRect().width;
      precisionMarkerDom = [...precisionMarkerElements.entries()]
        .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
        .flatMap(([index, marker]) => {
          const tickElement = marker.querySelector<HTMLSpanElement>(
            ".precision-tick",
          );
          const labelElement = marker.querySelector<HTMLSpanElement>(
            ".precision-label",
          );
          return tickElement && labelElement
            ? [{ index, marker, tick: tickElement, label: labelElement }]
            : [];
        });

      schedulePrecisionRender(object);
    }, {
      stage: "READ_1",
      queueId: "precision-slider-measure",
    });
  }

  function registerPrecisionMarker(
    node: HTMLSpanElement,
    markerIndex: number,
  ) {
    precisionMarkerElements.set(markerIndex, node);
    void tick().then(() => schedulePrecisionMeasurement());

    return {
      destroy() {
        if (precisionMarkerElements.get(markerIndex) === node) {
          precisionMarkerElements.delete(markerIndex);
        }
      },
    };
  }

  function handlePointerDown(event: SliderPointerEvent) {
    if (!disabled) {
      activePointerId = event.pointerId;
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      schedulePrecisionRender();
    }
    onpointerdown?.(event);
  }

  function handlePointerEnter(event: SliderPointerEvent) {
    if (!disabled) {
      isHovered = true;
      schedulePrecisionRender();
    }
    onpointerenter?.(event);
  }

  function handlePointerLeave(event: SliderPointerEvent) {
    isHovered = false;
    schedulePrecisionRender();
    onpointerleave?.(event);
  }

  function finishPointer(event: SliderPointerEvent) {
    if (activePointerId === event.pointerId) {
      activePointerId = null;
      schedulePrecisionRender();
    }
  }

  function handlePointerUp(event: SliderPointerEvent) {
    finishPointer(event);
    onpointerup?.(event);
  }

  function handlePointerCancel(event: SliderPointerEvent) {
    finishPointer(event);
    onpointercancel?.(event);
  }

  function handleLostPointerCapture(event: SliderPointerEvent) {
    finishPointer(event);
    onlostpointercapture?.(event);
  }

  function handleInput(
    event: Event & { currentTarget: EventTarget & HTMLInputElement },
  ) {
    value = event.currentTarget.valueAsNumber;
    schedulePrecisionRender();
    oninput?.(event);
  }

  $effect(() => {
    const engine = sliderEngine;
    const ruler = precisionRulerElement;
    if (!engine || !ruler || markers !== "precision") return;

    const object = new ElementObject<HTMLSpanElement>(engine, null);
    precisionObject = object;
    object.element = ruler;
    object.event.dom.onResize = () => schedulePrecisionMeasurement(object);
    schedulePrecisionMeasurement(object);

    return () => {
      if (precisionObject === object) {
        precisionObject = null;
        precisionRulerWidth = 0;
        precisionMarkerDom = [];
      }
      object.destroy(false);
    };
  });

  $effect(() => {
    if (markers !== "precision") return;
    void min;
    void max;
    void step;
    void thumbSize;
    void endPadding;
    void precisionMarkerIndices.length;
    void tick().then(() => schedulePrecisionMeasurement());
  });

  $effect(() => {
    if (markers !== "precision") return;
    void activeMarkerIndex;
    void ratio;
    void isHovered;
    void isDragging;
    void disabled;
    schedulePrecisionRender();
  });
</script>

<span
  bind:clientWidth
  class={mergedClass}
  class:has-markers={dotMarkerIndices.length > 0 || precisionMarkerIndices.length > 0}
  class:dot-markers={markers === "dots"}
  class:precision-markers={markers === "precision"}
  class:dragging={isDragging}
  class:disabled
  class:fluid
  style:--slider-width={fluid ? "100%" : `${width}px`}
  style:--slider-height={`${height}px`}
  style:--slider-thumb-size={`${thumbSize}px`}
  style:--slider-thumb-position={thumbPosition}
  style:--slider-accent-color={accentColor}
  style:--precision-minimum-width={`${precisionMinimumWidth}px`}
>
  <Engine
    bind:engine={sliderEngine}
    id={engineCanvasId}
    className="slider-visual"
    style="height:100%;inset:0;overflow:visible;pointer-events:none;position:absolute;width:100%;"
  >
    {#if markers === "dots" && dotMarkerIndices.length > 0}
      <span class="slider-markers" aria-hidden="true">
        {#each dotMarkerIndices as markerIndex (markerIndex)}
          <span
            class="slider-dot"
            class:selected={markerIndex === activeMarkerIndex}
            style:left={`${markerPosition(markerIndex)}px`}
          ></span>
        {/each}
      </span>
    {:else if markers === "precision" && precisionMarkerIndices.length > 0}
      <span
        bind:this={precisionRulerElement}
        class="precision-ruler"
        aria-hidden="true"
      >
        {#each precisionMarkerIndices as markerIndex (markerIndex)}
          <span
            class="precision-mark"
            data-marker-index={markerIndex}
            use:registerPrecisionMarker={markerIndex}
          >
            <span class="precision-label">{formatMarkerValue(markerIndex)}</span>
            <span class="precision-tick"></span>
          </span>
        {/each}
      </span>
    {/if}

    <span class="slider-track">
      <Slot width={renderedWidth} {height} {material}>
        <span aria-hidden="true"></span>
      </Slot>

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
    </span>
  </Engine>

  <input
    {...inputProps}
    {id}
    type="range"
    {min}
    {max}
    {step}
    {value}
    {disabled}
    oninput={handleInput}
    onpointerenter={handlePointerEnter}
    onpointerleave={handlePointerLeave}
    onpointerdown={handlePointerDown}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerCancel}
    onlostpointercapture={handleLostPointerCapture}
  />
</span>

<style>
  .slider {
    --slider-width: 240px;
    --slider-height: 16px;
    --slider-thumb-size: 14px;
    --slider-thumb-position: 0px;
    --slider-accent-color: var(--color-primary);
    --slider-marker-offset: 0px;

    position: relative;
    display: inline-block;
    width: var(--slider-width);
    height: calc(var(--slider-height) + var(--slider-marker-offset));
    flex: none;
  }

  .slider.dot-markers.has-markers {
    --slider-marker-offset: 16px;
  }

  .slider.precision-markers.has-markers {
    --slider-marker-offset: 48px;

    min-width: var(--precision-minimum-width);
  }

  .slider :global(.slider-visual) {
    z-index: 1;
  }

  .slider-track {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: var(--slider-height);
    border-radius: calc(var(--slider-height) / 2);
  }

  .slider.fluid .slider-track :global(.snap-slot) {
    width: 100% !important;
  }

  .slider-markers {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 8px;
    pointer-events: none;
  }

  .slider-dot {
    position: absolute;
    top: 50%;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background-color: color-mix(
      in srgb,
      var(--color-background-dark) 28%,
      transparent
    );
    transform: translate(-50%, -50%) scale(1);
    transform-origin: center;
    box-shadow: 0 0 0 0 transparent;
    transition:
      transform 150ms ease-out,
      background-color 150ms ease-out,
      box-shadow 150ms ease-out;
  }

  .slider.dot-markers:not(.disabled):has(input:focus-visible) .slider-dot,
  .slider.dot-markers.dragging .slider-dot {
    background-color: color-mix(
      in srgb,
      var(--color-background-dark) 68%,
      transparent
    );
  }

  .slider.dot-markers:not(.disabled):has(input:focus-visible) .slider-dot.selected,
  .slider.dot-markers.dragging .slider-dot.selected {
    background-color: color-mix(
      in srgb,
      var(--color-background-dark) 92%,
      transparent
    );
    transform: translate(-50%, -50%) scale(2);
  }

  .slider.dot-markers.dragging .slider-dot.selected {
    background-color: var(--slider-accent-color);
    box-shadow: none;
  }

  .precision-ruler {
    position: absolute;
    bottom: var(--slider-height);
    left: 0;
    width: 100%;
    height: 24px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 100ms ease-out;
  }

  .precision-mark {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 0;
    height: 24px;
    transform: translate3d(0, 0, 0);
    transition: transform 100ms cubic-bezier(0.2, 0.7, 0.2, 1);
  }

  .precision-tick {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 2px;
    height: 24px;
    background-color: color-mix(
      in srgb,
      var(--color-background-dark) 34%,
      var(--color-background)
    );
    opacity: 1;
    transform: translate3d(-50%, 0, 0) scaleY(0.333);
    transform-origin: bottom center;
    transition: transform 100ms cubic-bezier(0.2, 0.7, 0.2, 1);
  }

  .precision-label {
    position: absolute;
    bottom: 0;
    left: 0;
    color: color-mix(
      in srgb,
      var(--color-background-dark) 78%,
      transparent
    );
    font-family: "Bitcount Grid Single", var(--font-label), monospace;
    font-size: 0.95rem;
    font-weight: 400;
    line-height: 1;
    opacity: 0;
    transform: translate3d(-50%, -11px, 0) scale(0.78);
    transform-origin: center bottom;
    white-space: nowrap;
    text-shadow: none;
    transition:
      transform 100ms cubic-bezier(0.2, 0.7, 0.2, 1),
      opacity 100ms ease-out;
  }

  .slider.dragging .precision-mark {
    transition: none;
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
    left: 0;
    width: var(--slider-thumb-size);
    height: var(--slider-thumb-size);
    transform: translate3d(var(--slider-thumb-position), 0, 0);
    pointer-events: none;
    will-change: transform;
  }

  input[type="range"] {
    position: absolute;
    z-index: 3;
    right: 0;
    bottom: 0;
    left: 0;
    width: 100%;
    height: var(--slider-height);
    margin: 0;
    padding: 0;
    appearance: none;
    -webkit-appearance: none;
    border: 0;
    border-radius: calc(var(--slider-height) / 2);
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

  .slider:has(input:focus-visible) .slider-track {
    outline: 2px solid var(--slider-accent-color);
    outline-offset: 3px;
  }

  @media (hover: hover) {
    .slider.dot-markers:not(.disabled):not(.dragging):hover .slider-dot {
      background-color: color-mix(
        in srgb,
        var(--color-background-dark) 68%,
        transparent
      );
    }

    .slider.dot-markers:not(.disabled):not(.dragging):hover .slider-dot.selected {
      background-color: color-mix(
        in srgb,
        var(--color-background-dark) 92%,
        transparent
      );
      transform: translate(-50%, -50%) scale(2);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .slider-dot,
    .precision-ruler,
    .precision-mark,
    .precision-tick,
    .precision-label {
      transition: none;
    }
  }
</style>

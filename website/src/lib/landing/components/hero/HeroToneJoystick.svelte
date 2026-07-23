<script lang="ts">
  import { getContext, onDestroy, onMount } from "svelte";
  import { ElementObject } from "@snap-engine/core";
  import type { Engine, dragEndProp, dragProp, dragStartProp } from "@snap-engine/core";

  let {
    x = $bindable(0.5),
    y = $bindable(0.5),
    onValueChange = null,
  }: {
    x?: number;
    y?: number;
    onValueChange?: null | ((value: { x: number; y: number }) => void);
  } = $props();

  let surfaceElement: HTMLDivElement | null = null;
  let knobElement: HTMLDivElement | null = null;
  let knobObject: ElementObject | null = null;
  let engine: Engine = getContext("engine");

  let isDragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let surfaceWidth = 0;
  let surfaceHeight = 0;
  let knobWidth = 0;
  let knobHeight = 0;

  const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  function geometry() {
    const surfaceRadius = Math.min(surfaceWidth, surfaceHeight) / 2;
    const knobRadius = Math.max(knobWidth, knobHeight) / 2;
    const travelRadius = Math.max(1, surfaceRadius - knobRadius);
    const centerX = surfaceWidth / 2;
    const centerY = surfaceHeight / 2;

    return { centerX, centerY, knobRadius, travelRadius };
  }

  function positionFromValue() {
    const { centerX, centerY, knobRadius, travelRadius } = geometry();
    const offsetX = (x * 2 - 1) * travelRadius;
    const offsetY = (y * 2 - 1) * travelRadius;

    return {
      left: centerX + offsetX - knobRadius,
      top: centerY + offsetY - knobRadius,
    };
  }

  function constrainedPosition(left: number, top: number) {
    const { centerX, centerY, knobRadius, travelRadius } = geometry();
    let offsetX = left + knobRadius - centerX;
    let offsetY = top + knobRadius - centerY;
    const distance = Math.hypot(offsetX, offsetY);

    if (distance > travelRadius) {
      const scale = travelRadius / distance;
      offsetX *= scale;
      offsetY *= scale;
    }

    return {
      left: centerX + offsetX - knobRadius,
      top: centerY + offsetY - knobRadius,
    };
  }

  function updateValueFromPosition(left: number, top: number) {
    const { centerX, centerY, knobRadius, travelRadius } = geometry();
    const offsetX = left + knobRadius - centerX;
    const offsetY = top + knobRadius - centerY;

    x = clamp(offsetX / travelRadius / 2 + 0.5);
    y = clamp(offsetY / travelRadius / 2 + 0.5);
    onValueChange?.({ x, y });
  }

  function queueKnobPosition() {
    knobObject?.schedule(
      () => {
        if (!knobObject) return;

        const { left, top } = positionFromValue();
        knobObject.worldTransform = { x: left, y: top };
        knobObject.writeTransform();
      },
      { stage: "WRITE_2", queueId: "hero-tone-joystick-position" },
    );
  }

  function readBounds(callback?: () => void) {
    knobObject?.schedule(
      () => {
        if (!surfaceElement || !knobElement) return;

        const surfaceRect = surfaceElement.getBoundingClientRect();
        const knobRect = knobElement.getBoundingClientRect();
        surfaceWidth = surfaceRect.width;
        surfaceHeight = surfaceRect.height;
        knobWidth = knobRect.width;
        knobHeight = knobRect.height;
        callback?.();
      },
      { stage: "READ_1", queueId: "hero-tone-joystick-read" },
    );
  }

  onMount(() => {
    if (!knobElement) return;

    knobObject = new ElementObject(engine, null);
    knobObject.transformMode = "direct";
    knobObject.style = {
      willChange: "transform",
      position: "absolute",
      transformOrigin: "top left",
    };
    knobObject.element = knobElement;

    readBounds(queueKnobPosition);

    knobObject.event.input.dragStart = (prop: dragStartProp) => {
      if (!knobObject) return;

      knobObject.global.suspend("cameraControl", knobObject.id);
      isDragging = true;
      dragStartX = knobObject.worldTransform.x;
      dragStartY = knobObject.worldTransform.y;
      readBounds();
    };

    knobObject.event.input.drag = (prop: dragProp) => {
      if (!knobObject) return;

      const { left, top } = constrainedPosition(
        dragStartX + prop.delta.x,
        dragStartY + prop.delta.y,
      );

      knobObject.worldTransform = { x: left, y: top };
      knobObject.schedule(() => knobObject?.writeTransform(), {
        stage: "WRITE_2",
        queueId: `${knobObject.id}-transform`,
      });
      updateValueFromPosition(left, top);
    };

    knobObject.event.input.dragEnd = (_: dragEndProp) => {
      if (knobObject) knobObject.global.resume("cameraControl", knobObject.id);
      isDragging = false;
    };
  });

  onDestroy(() => {
    knobObject?.destroy();
  });
</script>

<div class="hero-tone-joystick" bind:this={surfaceElement}>
  <div class="hero-tone-joystick-grid"></div>
  <div class="hero-tone-joystick-knob {isDragging ? 'is-dragging' : ''}" bind:this={knobElement}></div>
</div>

<style lang="scss">
  .hero-tone-joystick {
    width: var(--hero-control-size, 56px);
    aspect-ratio: 1 / 1;
    position: relative;
    overflow: visible;
    border-radius: 999px;
    background: #e2e5eb;
    box-shadow:
      0px 0px 1px 0.5px rgba(1, 11, 38, 0.1) inset,
      1px 1px 1px 0.5px rgba(255, 255, 255, 0.52) inset,
      -0.5px -0.5px 0.5px 0.5px rgba(93, 101, 115, 0.18) inset;
  }

  .hero-tone-joystick-grid {
    display: none;
  }

  .hero-tone-joystick-knob {
    width: clamp(40px, calc(var(--hero-control-size, 56px) * 0.64), 58px);
    height: clamp(40px, calc(var(--hero-control-size, 56px) * 0.64), 58px);
    border-radius: 50%;
    background-color: #c9cfd8;
    cursor: grab;
    touch-action: none;
    box-shadow:
      7px 8px 9px -5px rgba(32, 36, 37, 0.38),
      3px 3px 3px 0px rgba(255, 255, 255, 0.5) inset,
      -1.5px -1.5px 2px 0px rgba(84, 92, 107, 0.28) inset;
    position: absolute;
    z-index: 1;

    &::after {
      content: "";
      position: absolute;
      pointer-events: none;
      top: 1px;
      left: 1px;
      width: calc(100% - 2px);
      height: calc(100% - 2px);
      border-radius: calc(50% - 1px);
      box-sizing: border-box;
      border-style: inset;
      border: 2px solid rgb(255, 255, 255);
      mask-image: conic-gradient(
        from 135deg at 50% 50%,
        rgba(0, 0, 0, 0) 0%,
        rgba(0, 0, 0, 0) 35%,
        rgba(0, 0, 0, 0.9) 50%,
        rgba(0, 0, 0, 0) 65%,
        rgba(0, 0, 0, 0) 100%
      );
      filter: blur(0.35px);
      background-blend-mode: multiply;
    }

    &.is-dragging {
      cursor: grabbing;
    }
  }
</style>

<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { BaseObject } from "@snap-engine/core";
  import type { Engine as EngineType } from "@snap-engine/core";
  import { CircleCollider } from "@snap-engine/core/collision";
  import type { Collider } from "@snap-engine/core/collision";
  import { onDestroy } from "svelte";

  type Dot = {
    id: number;
    x: number;
    y: number;
    radius: number;
  };

  const DOT_COLUMNS = 44;
  const DOT_ROWS = 28;
  const DOT_RADIUS = 5;
  const TARGET_RADIUS = 58;
  const FIELD_PADDING = 72;
  const FIELD_WIDTH = 1120;
  const FIELD_HEIGHT = 680;
  const dots: Dot[] = Array.from({ length: DOT_COLUMNS * DOT_ROWS }, (_, index) => {
    const column = index % DOT_COLUMNS;
    const row = Math.floor(index / DOT_COLUMNS);
    const usableWidth = FIELD_WIDTH - FIELD_PADDING * 2;
    const usableHeight = FIELD_HEIGHT - FIELD_PADDING * 2;

    return {
      id: index,
      x: FIELD_PADDING + (column / (DOT_COLUMNS - 1)) * usableWidth,
      y: FIELD_PADDING + (row / (DOT_ROWS - 1)) * usableHeight,
      radius: DOT_RADIUS,
    };
  });

  let engine: EngineType | null = $state(null);
  let fieldElement: HTMLDivElement | null = $state(null);
  let targetX = $state(FIELD_WIDTH / 2);
  let targetY = $state(FIELD_HEIGHT / 2);
  let activeDotIds = $state<Set<number>>(new Set());
  let contactEvents = $state(0);
  let colliderCount = $state(0);
  let frameMs = $state(0);
  let isDragging = $state(false);
  let initializedEngine: EngineType | null = null;
  let targetObject: BaseObject | null = null;
  let targetCollider: CircleCollider | null = null;
  let dotObjects: BaseObject[] = [];
  let dotIdByCollider = new Map<symbol, number>();
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let lastFrameTime = performance.now();
  let frameRequest = 0;

  function setActiveDot(id: number, active: boolean) {
    const nextActiveDotIds = new Set(activeDotIds);
    if (active) {
      nextActiveDotIds.add(id);
    } else {
      nextActiveDotIds.delete(id);
    }
    activeDotIds = nextActiveDotIds;
  }

  function getDotId(collider: Collider) {
    return dotIdByCollider.get(collider.id);
  }

  function moveTarget(x: number, y: number) {
    targetX = Math.max(TARGET_RADIUS, Math.min(FIELD_WIDTH - TARGET_RADIUS, x));
    targetY = Math.max(TARGET_RADIUS, Math.min(FIELD_HEIGHT - TARGET_RADIUS, y));
    targetObject!.worldTransform = { x: targetX, y: targetY };
  }

  function pointerPosition(event: PointerEvent) {
    const rect = fieldElement!.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function handlePointerDown(event: PointerEvent) {
    if (!fieldElement) {
      return;
    }

    const position = pointerPosition(event);
    dragOffsetX = position.x - targetX;
    dragOffsetY = position.y - targetY;
    isDragging = true;
    fieldElement.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent) {
    if (!isDragging) {
      return;
    }

    const position = pointerPosition(event);
    moveTarget(position.x - dragOffsetX, position.y - dragOffsetY);
  }

  function handlePointerUp(event: PointerEvent) {
    isDragging = false;
    fieldElement?.releasePointerCapture(event.pointerId);
  }

  function startFrameMeter() {
    const update = () => {
      const now = performance.now();
      frameMs = now - lastFrameTime;
      lastFrameTime = now;
      frameRequest = requestAnimationFrame(update);
    };
    frameRequest = requestAnimationFrame(update);
  }

  function initialize(currentEngine: EngineType | null) {
    if (!currentEngine || initializedEngine === currentEngine) {
      return;
    }

    initializedEngine = currentEngine;
    targetObject = new BaseObject(currentEngine);
    targetObject.worldTransform = { x: targetX, y: targetY };
    targetCollider = new CircleCollider(currentEngine, targetObject, 0, 0, TARGET_RADIUS);
    targetObject.addCollider(targetCollider);

    for (const dot of dots) {
      const dotObject = new BaseObject(currentEngine);
      dotObject.worldTransform = { x: dot.x, y: dot.y };
      const collider = new CircleCollider(currentEngine, dotObject, 0, 0, dot.radius);
      dotObject.addCollider(collider);
      dotObjects.push(dotObject);
      dotIdByCollider.set(collider.id, dot.id);
    }

    targetCollider.event.collider.onBeginContact = (_, other) => {
      const dotId = getDotId(other);
      if (dotId == null) {
        return;
      }

      contactEvents += 1;
      setActiveDot(dotId, true);
    };
    targetCollider.event.collider.onEndContact = (_, other) => {
      const dotId = getDotId(other);
      if (dotId == null) {
        return;
      }

      setActiveDot(dotId, false);
    };

    colliderCount = dots.length + 1;
    startFrameMeter();
  }

  $effect(() => {
    initialize(engine);
  });

  onDestroy(() => {
    if (frameRequest) {
      cancelAnimationFrame(frameRequest);
    }
    targetObject?.destroy();
    for (const dotObject of dotObjects) {
      dotObject.destroy();
    }
    dotObjects = [];
    dotIdByCollider = new Map();
  });
</script>

<Engine id="collision-stress-canvas" bind:engine>
  <div class="stress-shell">
    <header class="stress-toolbar">
      <strong>Collision Stress</strong>
      <span>{colliderCount} colliders</span>
      <span>{activeDotIds.size} active contacts</span>
      <span>{contactEvents} begin events</span>
      <span>{frameMs.toFixed(1)} ms/frame</span>
    </header>

    <div
      class="stress-field"
      bind:this={fieldElement}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerUp}
    >
      {#each dots as dot (dot.id)}
        <div
          class:active={activeDotIds.has(dot.id)}
          class="stress-dot"
          style={`left: ${dot.x}px; top: ${dot.y}px; width: ${dot.radius * 2}px; height: ${
            dot.radius * 2
          }px;`}
        ></div>
      {/each}

      <button
        class="stress-target"
        class:dragging={isDragging}
        style={`left: ${targetX}px; top: ${targetY}px; width: ${TARGET_RADIUS * 2}px; height: ${
          TARGET_RADIUS * 2
        }px;`}
        onpointerdown={handlePointerDown}
        aria-label="Drag collision target"
      >
        drag
      </button>
    </div>
  </div>
</Engine>

<style>
  .stress-shell {
    height: 100%;
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 12px;
    padding: 16px;
    box-sizing: border-box;
    background: #f7f7f4;
    color: #111111;
    font-family: system-ui, sans-serif;
  }

  .stress-toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    min-height: 40px;
    font-size: 14px;
  }

  .stress-toolbar strong {
    font-size: 16px;
  }

  .stress-field {
    position: relative;
    width: min(100%, 1120px);
    height: min(100%, 680px);
    min-height: 520px;
    border: 1px solid #111111;
    background: #ffffff;
    overflow: hidden;
    touch-action: none;
  }

  .stress-dot {
    position: absolute;
    border-radius: 50%;
    background: #222222;
    transform: translate(-50%, -50%);
  }

  .stress-dot.active {
    background: #e03d2f;
  }

  .stress-target {
    position: absolute;
    display: grid;
    place-items: center;
    border: 2px solid #111111;
    border-radius: 50%;
    background: rgba(37, 116, 169, 0.18);
    color: #111111;
    font: inherit;
    font-size: 13px;
    cursor: grab;
    transform: translate(-50%, -50%);
    user-select: none;
    touch-action: none;
  }

  .stress-target.dragging {
    cursor: grabbing;
    background: rgba(37, 116, 169, 0.32);
  }
</style>

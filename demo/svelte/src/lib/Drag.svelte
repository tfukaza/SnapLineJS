<script lang="ts">
  import { getContext, onMount, onDestroy } from "svelte";
  import { ElementObject } from "@snap-engine/core";
  import type { Engine } from "@snap-engine/core";
  import type { dragProp, dragStartProp, dragEndProp } from "@snap-engine/core";

  let { 
    children, 
    initialX = 0, 
    initialY = 0,
    object = $bindable<ElementObject | undefined>(undefined),
    onDragStart = null,
    onDrag = null,
    onDragEnd = null
  }: { 
    children: any; 
    initialX?: number; 
    initialY?: number;
    object?: ElementObject;
    onDragStart?: (() => void) | null;
    onDrag?: (() => void) | null;
    onDragEnd?: (() => void) | null;
  } = $props();

  let element: HTMLElement;
  let engine: Engine = getContext("engine");

  let isDragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let mouseDownX = 0;
  let mouseDownY = 0;

  let thisInitialX = initialX;
  let thisInitialY = initialY;

  onMount(() => {
    object = new ElementObject(engine, null);
    
    // Set up DOM transform mode BEFORE assigning element
    object.transformMode = "direct";
    object.style = {
      willChange: "transform",
      position: "absolute",
      transformOrigin: "top left",
    };

    // Assign element before queueing the initial transform write.
    object.element = element;
    // Queue transform write AFTER read completes to apply initial position
    object.schedule(
      () => {
        if (!object) return;
        object.worldTransform = { x: thisInitialX, y: thisInitialY };
        // console.log("Initial position set:", thisInitialX, thisInitialY);
        object.writeTransform();
      },
      { stage: "WRITE_1" },
    );

    // Drag event handlers
    object.event.input.dragStart = (prop: dragStartProp) => {
      if (!object) return;
      // Claim the pointer while dragging (auto-releases at gesture end).
      object.engine.input.claimPointer(prop.pointerId);

      isDragging = true;
      dragStartX = object.worldTransform.x;
      dragStartY = object.worldTransform.y;
      mouseDownX = prop.start.x;
      mouseDownY = prop.start.y;

      if (onDragStart) {
        onDragStart();
      }
    };

    object.event.input.drag = (prop: dragProp) => {
      if (!object) return;
      const dx = prop.position.x - mouseDownX;
      const dy = prop.position.y - mouseDownY;
      
      object.worldTransform = { x: dragStartX + dx, y: dragStartY + dy };
      object.schedule(() => object?.writeTransform(), {
        stage: "WRITE_2",
        queueId: `${object.id}-transform`,
      });
      
      if (onDrag) {
        onDrag();
      }
    };

    object.event.input.dragEnd = (_: dragEndProp) => {

      isDragging = false;

      if (onDragEnd) {
        onDragEnd();
      }
    };
  });

  onDestroy(() => {
    if (object) object.destroy();
  });
</script>

<div
  bind:this={element}
  class="drag-wrapper {isDragging ? 'dragging' : ''}"
>
  {@render children()}
</div>

<style>
  .drag-wrapper {
    cursor: grab;
    user-select: none;
    touch-action: none;
  }
  
  .drag-wrapper.dragging {
    cursor: grabbing;
  }
</style>

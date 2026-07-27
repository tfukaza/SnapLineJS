<script lang="ts" generics="T">
  import type {
    PlacementController,
    PlacementSnapshot,
  } from "@snap-engine/snapline";
  import type { Snippet } from "svelte";

  let {
    controller,
    cancelOnOutside = true,
    cancelOnSecondaryButton = true,
    cancelOnEscape = true,
    preview,
  }: {
    controller: PlacementController<T>;
    cancelOnOutside?: boolean;
    cancelOnSecondaryButton?: boolean;
    cancelOnEscape?: boolean;
    preview?: Snippet<[PlacementSnapshot<T>]>;
  } = $props();

  let snapshot = $state<PlacementSnapshot<T>>(controller.snapshot);
  let latestSnapshot = controller.snapshot;

  $effect(() => {
    const current = controller;
    return current.onStateChange((next) => {
      const previous = latestSnapshot;
      latestSnapshot = next;
      if (
        previous.active !== next.active ||
        previous.payload !== next.payload ||
        previous.size !== next.size ||
        (previous.position === null) !== (next.position === null)
      ) {
        snapshot = next;
      }
    });
  });

  function bindPlacementGeometry(element: HTMLDivElement) {
    const cleanup = controller.bindGeometryWriter((geometry) => {
      element.style.visibility = geometry.visible ? "visible" : "hidden";
      element.style.transform = geometry.position
        ? `translate3d(${geometry.position.x}px, ${geometry.position.y}px, 0)`
        : "translate3d(0px, 0px, 0)";
      if (geometry.size) {
        element.style.width = `${geometry.size.width}px`;
        element.style.height = `${geometry.size.height}px`;
      }
      element.dataset.allowed = String(geometry.allowed);
    });
    return { destroy: cleanup };
  }

  function onPointerMove(event: PointerEvent): void {
    if (!controller.snapshot.active) return;
    controller.update({ x: event.clientX, y: event.clientY }, event);
  }

  function onPointerDown(event: PointerEvent): void {
    if (!controller.snapshot.active) return;
    if (event.button !== 0) {
      if (cancelOnSecondaryButton) {
        event.preventDefault();
        controller.cancel("secondary-button", event);
      }
      return;
    }
    controller.update({ x: event.clientX, y: event.clientY }, event);
    if (controller.commit(event)) {
      event.preventDefault();
      event.stopPropagation();
    } else if (cancelOnOutside) {
      controller.cancel("outside", event);
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (
      cancelOnEscape &&
      event.key === "Escape" &&
      controller.cancel("escape", event)
    ) {
      event.preventDefault();
    }
  }
</script>

<svelte:window
  onpointermove={onPointerMove}
  onpointerdowncapture={onPointerDown}
  onkeydown={onKeyDown}
/>

{#if snapshot.active}
  <div
    use:bindPlacementGeometry
    data-snapline-type="placement-preview"
    data-allowed={String(snapshot.allowed)}
    style="position: absolute; pointer-events: none; transform-origin: top left; visibility: hidden; will-change: transform;"
  >
    {@render preview?.(snapshot)}
  </div>
{/if}

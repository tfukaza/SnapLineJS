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

  $effect(() => {
    const current = controller;
    const previousOnChange = current.callbacks.onChange;
    const onChange = (next: PlacementSnapshot<T>) => {
      snapshot = next;
      previousOnChange?.(next);
    };
    snapshot = current.snapshot;
    current.callbacks.onChange = onChange;

    return () => {
      if (current.callbacks.onChange === onChange) {
        current.callbacks.onChange = previousOnChange;
      }
    };
  });

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

{#if snapshot.active && preview}
  {@render preview(snapshot)}
{/if}

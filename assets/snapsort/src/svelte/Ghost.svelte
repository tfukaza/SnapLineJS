<script lang="ts">
  import {
    insertionMarkerRect,
    stockInsertionMarkerRectOptions,
    toContainerLocalRect,
    type GhostState,
    type InsertionMarkerRectOptions,
  } from "@snap-engine/snapsort";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type GhostProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    ghost: GhostState;
    children?: Snippet;
    className?: string;
    insertionMarker?: InsertionMarkerRectOptions;
  };

  let {
    ghost,
    children,
    class: classValue = "",
    className = "",
    insertionMarker,
    style = "",
    id = "spacer",
    ...divProps
  }: GhostProps = $props();

  const ghostStyle = $derived.by(() => {
    const origProp =
      ghost.original.dragSnapshot?.box ?? ghost.original.currentDomProperty;
    if (ghost.type === "insertion-marker" || ghost.type === "pointer-preview") {
      const marker = ghost.type === "insertion-marker";
      const rect = marker
        ? insertionMarkerRect(
            ghost,
            insertionMarker ?? stockInsertionMarkerRectOptions,
          )
        : toContainerLocalRect(ghost.rect, ghost.location.container);
      return (
        `position:absolute;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;` +
        `height:${rect.height}px;margin:0;` +
        "pointer-events:none;box-sizing:border-box;z-index:1000;" +
        (marker
          ? "border:0;border-radius:999px;background:currentColor;color:rgb(37, 99, 235);"
          : "")
      );
    }
    return (
      `width:${ghost.rect.width}px;height:${ghost.rect.height}px;` +
      `margin:${origProp.margin.top}px ${origProp.margin.right}px ${origProp.margin.bottom}px ${origProp.margin.left}px;` +
      "box-sizing:border-box;"
    );
  });
  const mergedStyle = $derived(`${ghostStyle}${style}`);
  const mergedClass = $derived(
    `snapsort-ghost ${classValue} ${className}`.trim(),
  );

  function bindGhostElement(
    node: HTMLElement,
    initialGhostItem: GhostState["ghostItem"],
  ) {
    let ghostItem = initialGhostItem;
    ghostItem.element = node;
    return {
      update(nextGhostItem: GhostState["ghostItem"]) {
        if (nextGhostItem === ghostItem) return;
        ghostItem.detachElement(node);
        ghostItem = nextGhostItem;
        ghostItem.element = node;
      },
      destroy() {
        ghostItem.detachElement(node);
      },
    };
  }
</script>

<div
  {...divProps}
  {id}
  class={mergedClass || undefined}
  data-snapsort-ghost={ghost.type === "pointer-preview"
    ? "pointer"
    : ghost.type === "insertion-marker"
      ? "insertion"
      : undefined}
  data-snapsort-ghost-entry={ghost.type}
  data-snapsort-ghost-item-count={ghost.items.length}
  style={mergedStyle}
  use:bindGhostElement={ghost.ghostItem}
>
  {@render children?.()}
</div>

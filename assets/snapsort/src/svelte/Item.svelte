<script lang="ts">
  import { getContext, setContext, onDestroy, untrack } from "svelte";
  import { Item as SnapSortItem } from "@snap-engine/snapsort";
  import type {
    Container,
    ItemMetadata,
  } from "@snap-engine/snapsort";
  import type { Engine } from "@snap-engine/core";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type ItemProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children: Snippet;
    className?: string;
    item?: SnapSortItem | null;
    itemId?: string;
    metadata?: ItemMetadata;
    selected?: boolean;
  };

  let {
    children,
    itemId,
    style = "",
    class: classValue = "",
    className = "",
    item = $bindable<SnapSortItem | null>(null),
    metadata,
    selected,
    ...divProps
  }: ItemProps = $props();

  const engine: Engine = getContext("engine");
  const container: Container | null = getContext("container");
  const initial = untrack(() => ({ item, itemId, metadata, selected }));

  if (!container) {
    throw new Error("SnapSort Item: must be rendered inside a Container.");
  }
  if (initial.metadata && "itemId" in initial.metadata) {
    throw new Error("SnapSort Item: `metadata.itemId` was removed. Pass `itemId` as its own prop instead.");
  }
  if (initial.item == null && !initial.itemId) {
    throw new Error("SnapSort Item: missing required `itemId` prop.");
  }

  const ownsItem = initial.item == null;
  const resolvedItem = initial.item ?? new SnapSortItem(engine, container);
  const mergedClass = $derived(`snapsort-item ${classValue} ${className}`.trim());

  if (resolvedItem.engine !== engine) {
    throw new Error("SnapSort Item: the supplied `item` belongs to another Engine.");
  }
  if (!ownsItem && resolvedItem.parent !== container) {
    throw new Error(
      "SnapSort Item: the supplied `item` must already belong to the surrounding Container.",
    );
  }
  item = resolvedItem;
  setContext("item", resolvedItem);

  if (initial.itemId !== undefined) {
    resolvedItem.itemId = initial.itemId;
  }
  if (!resolvedItem.itemId) {
    throw new Error("SnapSort Item: missing required `itemId` prop.");
  }
  if (initial.metadata !== undefined) {
    resolvedItem.metadata = initial.metadata;
  }
  if (initial.selected !== undefined) {
    resolvedItem.selected = initial.selected;
  }

  $effect(() => {
    if (item !== resolvedItem) {
      throw new Error("SnapSort Item: the `item` prop cannot change after mount.");
    }
    if (itemId !== undefined) {
      resolvedItem.itemId = itemId;
    }
    if (metadata !== undefined) {
      if ("itemId" in metadata) {
        throw new Error("SnapSort Item: `metadata.itemId` was removed. Pass `itemId` as its own prop instead.");
      }
      resolvedItem.metadata = metadata;
    }
    if (selected !== undefined) {
      resolvedItem.selected = selected;
    }
  });

  function bindItemElement(element: HTMLDivElement) {
    resolvedItem.element = element;
    if (
      !ownsItem &&
      resolvedItem.parent === container &&
      !container!.itemOrderedList.includes(resolvedItem)
    ) {
      // Adopted Items are already parented before Svelte mounts them. Sync
      // the container's live ordering now so an onDragStart handoff can
      // validate and activate the freshly-mounted replacement immediately.
      container!.addItem(resolvedItem);
    }
    return {
      destroy() {
        resolvedItem.detachElement(element);
      },
    };
  }

  onDestroy(() => {
    if (ownsItem) {
      resolvedItem.destroy(false);
    }
  });
</script>

<div
  {...divProps}
  class={mergedClass}
  data-snapsort-item-id={resolvedItem.resolvedItemId}
  use:bindItemElement
  {style}
>
  {@render children()}
</div>

<style>
  .snapsort-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--size-4);
    box-sizing: border-box;
  }
</style>

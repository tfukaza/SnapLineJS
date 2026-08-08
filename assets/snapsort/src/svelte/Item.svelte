<script lang="ts">
  import { getContext, setContext, onDestroy, untrack } from "svelte";
  import { Item as SnapSortItem } from "@snap-engine/snapsort";
  import type {
    Container,
    ItemSnapshotMetadata,
  } from "@snap-engine/snapsort";
  import type { Engine } from "@snap-engine/core";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type ItemProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children: Snippet;
    className?: string;
    itemId?: string;
    metadata?: ItemSnapshotMetadata;
    selected?: boolean;
    itemObject?: SnapSortItem | null;
  };

  let {
    children,
    itemId,
    style = "",
    class: classValue = "",
    className = "",
    metadata = {},
    selected = false,
    itemObject: providedItemObject = null,
    ...divProps
  }: ItemProps = $props();

  const engine: Engine = getContext("engine");
  const container: Container | null = getContext("container");
  const initial = untrack(() => ({ itemId, metadata, providedItemObject }));
  const ownsItem = initial.providedItemObject == null;
  const itemObject: SnapSortItem = initial.providedItemObject ?? new SnapSortItem(engine, container);
  const mergedClass = $derived(`snapsort-item ${classValue} ${className}`.trim());

  if ("itemId" in initial.metadata) {
    throw new Error("SnapSort Item: `metadata.itemId` was removed. Pass `itemId` as its own prop instead.");
  }

  if ("itemId" in metadata) {
    throw new Error("SnapSort Item: `metadata.itemId` was removed. Pass `itemId` as its own prop instead.");
  }

  setContext("item", itemObject);

  if (initial.itemId !== undefined) {
    itemObject.itemId = initial.itemId;
  }
  if (!itemObject.itemId) {
    throw new Error("SnapSort Item: missing required `itemId` prop.");
  }

  if (ownsItem || Object.keys(initial.metadata).length > 0) {
    itemObject.metadata = initial.metadata;
  }

  $effect(() => {
    if (itemId !== undefined) {
      itemObject.itemId = itemId;
    }
    itemObject.selected = selected;
  });

  onDestroy(() => {
    if (ownsItem) {
      itemObject.destroy(false);
    }
  });
</script>

<div
  {...divProps}
  class={mergedClass}
  data-snapsort-item-id={itemObject.resolvedItemId}
  bind:this={itemObject.element}
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
